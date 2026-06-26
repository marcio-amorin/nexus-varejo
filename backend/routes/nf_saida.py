from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import NFSaida, ItemNFSaida, Produto, Cliente, ConfigEmpresa, TabelaImposto, Venda, PedidoMarketplace
from utils.security import get_current_user
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import date, datetime
import json, re, xml.etree.ElementTree as ET

router = APIRouter(prefix="/nf-saida", tags=["nf_saida"])


class ItemNFSaidaCreate(BaseModel):
    produto_id:      Optional[int] = None
    descricao:       str
    ncm:             Optional[str] = None
    cfop:            Optional[str] = "5102"
    cst_icms:        Optional[str] = "400"
    quantidade:      float
    preco_unitario:  float
    desconto:        Optional[float] = 0.0
    icms_aliquota:   Optional[float] = 0.0
    pis_aliquota:    Optional[float] = 0.0
    cofins_aliquota: Optional[float] = 0.0


class NFSaidaCreate(BaseModel):
    cliente_id:    Optional[int]  = None
    cliente_nome:  Optional[str]  = None
    cliente_doc:   Optional[str]  = None
    data_emissao:  date
    cfop:          Optional[str]  = "5102"
    valor_frete:   Optional[float] = 0.0
    valor_desconto:Optional[float] = 0.0
    observacoes:   Optional[str]  = None
    venda_id:      Optional[int]  = None
    itens:         List[ItemNFSaidaCreate]


def _nf_dict(nf: NFSaida) -> dict:
    return {
        "id":             nf.id,
        "numero":         nf.numero,
        "serie":          nf.serie,
        "cliente_id":     nf.cliente_id,
        "cliente_nome":   nf.cliente_nome or (nf.cliente.nome if nf.cliente else None),
        "cliente_doc":    nf.cliente_doc,
        "data_emissao":   str(nf.data_emissao),
        "cfop":           nf.cfop,
        "valor_produtos": nf.valor_produtos,
        "valor_frete":    nf.valor_frete,
        "valor_desconto": nf.valor_desconto,
        "valor_total":    nf.valor_total,
        "valor_tributos": nf.valor_tributos,
        "chave_nfe":      nf.chave_nfe,
        "protocolo":      nf.protocolo,
        "status":         nf.status,
        "observacoes":    nf.observacoes,
        "venda_id":       nf.venda_id,
        "created_at":     nf.created_at.isoformat() if nf.created_at else None,
        "itens": [{
            "id":             i.id,
            "produto_id":     i.produto_id,
            "descricao":      i.descricao,
            "ncm":            i.ncm,
            "cfop":           i.cfop,
            "cst_icms":       i.cst_icms,
            "quantidade":     i.quantidade,
            "preco_unitario": i.preco_unitario,
            "desconto":       i.desconto,
            "valor_total":    i.valor_total,
            "icms_aliquota":  i.icms_aliquota,
            "pis_aliquota":   i.pis_aliquota,
            "cofins_aliquota":i.cofins_aliquota,
        } for i in nf.itens],
    }


def _proximo_numero(db: Session) -> int:
    ultimo = db.query(func.max(NFSaida.numero)).scalar()
    return (ultimo or 0) + 1


@router.get("/")
def listar_nf_saida(busca: Optional[str] = None, status: Optional[str] = None,
                     db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(NFSaida)
    if status:
        q = q.filter(NFSaida.status == status)
    notas = q.order_by(NFSaida.id.desc()).limit(200).all()
    result = []
    for nf in notas:
        d = _nf_dict(nf)
        if busca:
            b = busca.lower()
            if not (b in str(nf.numero) or
                    b in (nf.cliente_nome or "").lower() or
                    b in (nf.cliente_doc or "")):
                continue
        result.append(d)
    return result


@router.get("/{nf_id}")
def get_nf_saida(nf_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    nf = db.query(NFSaida).filter(NFSaida.id == nf_id).first()
    if not nf:
        raise HTTPException(404, "NF não encontrada")
    return _nf_dict(nf)


@router.post("/")
def criar_nf_saida(data: NFSaidaCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    # busca regime para calcular tributos
    empresa = db.query(ConfigEmpresa).first()
    regime  = empresa.regime_tributario if empresa else "SIMPLES_NACIONAL"
    tabela  = db.query(TabelaImposto).filter(
        TabelaImposto.regime == regime, TabelaImposto.is_default == True
    ).first()

    nf = NFSaida(
        numero=_proximo_numero(db),
        cliente_id=data.cliente_id,
        cliente_nome=data.cliente_nome,
        cliente_doc=data.cliente_doc,
        data_emissao=data.data_emissao,
        cfop=data.cfop,
        valor_frete=data.valor_frete or 0,
        valor_desconto=data.valor_desconto or 0,
        observacoes=data.observacoes,
        venda_id=data.venda_id,
        status="RASCUNHO",
    )
    db.add(nf); db.flush()

    if data.cliente_id:
        cli = db.query(Cliente).filter(Cliente.id == data.cliente_id).first()
        if cli:
            nf.cliente_nome = cli.nome
            nf.cliente_doc  = cli.documento

    valor_prods = 0.0
    valor_trib  = 0.0
    for item in data.itens:
        vt = round(item.quantidade * item.preco_unitario - (item.desconto or 0), 2)
        valor_prods += vt

        # alíquotas: usa as do item ou do regime
        icms = item.icms_aliquota
        pis  = item.pis_aliquota
        cof  = item.cofins_aliquota
        if tabela and icms == 0 and pis == 0 and cof == 0:
            icms = tabela.icms_aliquota
            pis  = tabela.pis_aliquota
            cof  = tabela.cofins_aliquota

        trib_item = round(vt * (icms + pis + cof) / 100, 2)
        valor_trib += trib_item

        prod = db.query(Produto).filter(Produto.id == item.produto_id).first() if item.produto_id else None
        db.add(ItemNFSaida(
            nf_id=nf.id,
            produto_id=item.produto_id,
            descricao=item.descricao or (prod.descricao if prod else ""),
            ncm=item.ncm or (prod.ncm if prod else None),
            cfop=item.cfop or data.cfop or "5102",
            cst_icms=item.cst_icms or (tabela.cst_icms if tabela else "400"),
            quantidade=item.quantidade,
            preco_unitario=item.preco_unitario,
            desconto=item.desconto or 0,
            valor_total=vt,
            icms_aliquota=icms,
            pis_aliquota=pis,
            cofins_aliquota=cof,
        ))

    nf.valor_produtos = round(valor_prods, 2)
    nf.valor_tributos = round(valor_trib, 2)
    nf.valor_total = round(valor_prods + (data.valor_frete or 0) - (data.valor_desconto or 0), 2)
    db.commit(); db.refresh(nf)
    return _nf_dict(nf)


@router.post("/from-pdv/{venda_id}")
def criar_nf_from_pdv(venda_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    venda = db.query(Venda).filter(Venda.id == venda_id).first()
    if not venda:
        raise HTTPException(404, "Venda não encontrada")

    existing = db.query(NFSaida).filter(NFSaida.venda_id == venda_id).first()
    if existing:
        return _nf_dict(existing)

    empresa = db.query(ConfigEmpresa).first()
    regime  = empresa.regime_tributario if empresa else "SIMPLES_NACIONAL"
    tabela  = db.query(TabelaImposto).filter(
        TabelaImposto.regime == regime, TabelaImposto.is_default == True
    ).first()

    nf = NFSaida(
        numero       = _proximo_numero(db),
        cliente_id   = venda.cliente_id,
        cliente_nome = venda.cliente_nome,
        cliente_doc  = venda.cliente_cpf_fidelidade,
        data_emissao = venda.data_venda,
        cfop         = "5102",
        status       = "RASCUNHO",
        venda_id     = venda_id,
        observacoes  = f"NF-e gerada a partir da venda {venda.numero}",
    )
    db.add(nf); db.flush()

    if venda.cliente_id:
        cli = db.query(Cliente).filter(Cliente.id == venda.cliente_id).first()
        if cli:
            nf.cliente_nome = cli.nome
            nf.cliente_doc  = cli.documento

    valor_prods = 0.0; valor_trib = 0.0
    for item in venda.itens:
        vt   = round(item.quantidade * item.preco_unitario - (item.desconto_item or 0), 2)
        prod = item.produto
        icms = (prod.icms_aliquota   if prod and prod.icms_aliquota   else 0) or (tabela.icms_aliquota   if tabela else 0)
        pis  = (prod.pis_aliquota    if prod and prod.pis_aliquota    else 0) or (tabela.pis_aliquota    if tabela else 0)
        cof  = (prod.cofins_aliquota if prod and prod.cofins_aliquota else 0) or (tabela.cofins_aliquota if tabela else 0)
        valor_prods += vt
        valor_trib  += round(vt * (icms + pis + cof) / 100, 2)
        db.add(ItemNFSaida(
            nf_id          = nf.id,
            produto_id     = item.produto_id,
            descricao      = item.descricao_snap or (prod.descricao if prod else ""),
            ncm            = prod.ncm      if prod else None,
            cfop           = (prod.cfop_saida if prod and prod.cfop_saida else None) or "5102",
            cst_icms       = (prod.cst_icms   if prod and prod.cst_icms   else None) or (tabela.cst_icms if tabela else "400"),
            quantidade     = item.quantidade,
            preco_unitario = item.preco_unitario,
            desconto       = item.desconto_item or 0,
            valor_total    = vt,
            icms_aliquota  = icms, pis_aliquota = pis, cofins_aliquota = cof,
        ))

    nf.valor_produtos = round(valor_prods, 2)
    nf.valor_tributos = round(valor_trib, 2)
    nf.valor_total    = round(valor_prods, 2)
    db.commit(); db.refresh(nf)
    return _nf_dict(nf)


@router.post("/from-marketplace/{pedido_id}")
def criar_nf_from_marketplace(pedido_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    pedido = db.query(PedidoMarketplace).filter(PedidoMarketplace.id == pedido_id).first()
    if not pedido:
        raise HTTPException(404, "Pedido marketplace não encontrado")

    empresa = db.query(ConfigEmpresa).first()
    regime  = empresa.regime_tributario if empresa else "SIMPLES_NACIONAL"
    tabela  = db.query(TabelaImposto).filter(
        TabelaImposto.regime == regime, TabelaImposto.is_default == True
    ).first()

    nf = NFSaida(
        numero       = _proximo_numero(db),
        cliente_nome = pedido.cliente_nome,
        cliente_doc  = pedido.cliente_doc,
        data_emissao = date.today(),
        cfop         = "5102",
        status       = "RASCUNHO",
        observacoes  = f"NF-e gerada a partir do pedido marketplace #{pedido.numero_externo}",
    )
    db.add(nf); db.flush()

    itens = []
    if pedido.itens_json:
        try:
            itens = json.loads(pedido.itens_json)
        except Exception:
            itens = []

    valor_prods = 0.0; valor_trib = 0.0
    for it in itens:
        qtd   = float(it.get("quantidade", 1))
        preco = float(it.get("preco_unitario", it.get("preco", it.get("valor", 0))))
        vt    = round(qtd * preco, 2)
        prod_id = it.get("produto_id") or it.get("id")
        prod  = db.query(Produto).filter(Produto.id == prod_id).first() if prod_id else None
        icms  = (prod.icms_aliquota   if prod and prod.icms_aliquota   else 0) or (tabela.icms_aliquota   if tabela else 0)
        pis   = (prod.pis_aliquota    if prod and prod.pis_aliquota    else 0) or (tabela.pis_aliquota    if tabela else 0)
        cof   = (prod.cofins_aliquota if prod and prod.cofins_aliquota else 0) or (tabela.cofins_aliquota if tabela else 0)
        valor_prods += vt
        valor_trib  += round(vt * (icms + pis + cof) / 100, 2)
        db.add(ItemNFSaida(
            nf_id          = nf.id,
            produto_id     = prod_id,
            descricao      = it.get("nome") or it.get("descricao") or (prod.descricao if prod else "Item"),
            ncm            = prod.ncm if prod else None,
            cfop           = "5102",
            cst_icms       = (tabela.cst_icms if tabela else "400"),
            quantidade     = qtd,
            preco_unitario = preco,
            desconto       = 0,
            valor_total    = vt,
            icms_aliquota  = icms, pis_aliquota = pis, cofins_aliquota = cof,
        ))

    if not itens:
        db.add(ItemNFSaida(
            nf_id=nf.id, descricao=f"Pedido {pedido.numero_externo}",
            cfop="5102", cst_icms="400",
            quantidade=1, preco_unitario=pedido.total,
            desconto=0, valor_total=pedido.total,
        ))
        valor_prods = pedido.total

    nf.valor_produtos = round(valor_prods, 2)
    nf.valor_tributos = round(valor_trib, 2)
    nf.valor_total    = round(valor_prods, 2)
    db.commit(); db.refresh(nf)
    return _nf_dict(nf)


@router.put("/{nf_id}/status")
def atualizar_status(nf_id: int, body: dict, db: Session = Depends(get_db), _=Depends(get_current_user)):
    nf = db.query(NFSaida).filter(NFSaida.id == nf_id).first()
    if not nf:
        raise HTTPException(404, "NF não encontrada")
    novo_status = body.get("status")
    if novo_status not in ["RASCUNHO", "AUTORIZADA", "CANCELADA", "REJEITADA"]:
        raise HTTPException(400, "Status inválido")
    nf.status = novo_status
    if body.get("chave_nfe"):
        nf.chave_nfe = body["chave_nfe"]
    if body.get("protocolo"):
        nf.protocolo = body["protocolo"]
    db.commit()
    return {"ok": True, "status": nf.status}


@router.delete("/{nf_id}")
def cancelar_nf(nf_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    nf = db.query(NFSaida).filter(NFSaida.id == nf_id).first()
    if not nf:
        raise HTTPException(404, "NF não encontrada")
    if nf.status == "AUTORIZADA":
        raise HTTPException(400, "NF autorizada não pode ser excluída. Use cancelamento.")
    db.delete(nf); db.commit()
    return {"ok": True}


@router.get("/empresa/config")
def config_empresa_nf(db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Retorna dados da empresa + próximo número de NF para pré-preencher o formulário."""
    empresa = db.query(ConfigEmpresa).first()
    proximo = _proximo_numero(db)
    return {
        "proximo_numero": proximo,
        "serie":          "1",
        "empresa":        {
            "razao_social":     empresa.razao_social if empresa else "",
            "cnpj":             empresa.cnpj if empresa else "",
            "ie":               empresa.ie if empresa else "",
            "regime":           empresa.regime_tributario if empresa else "SIMPLES_NACIONAL",
        } if empresa else None
    }


# ── XML NF-e / NFC-e ─────────────────────────────────────────────────────────

def _cnpj_digits(v: str) -> str:
    return re.sub(r"\D", "", v or "")

def _build_nfe_xml(nf: NFSaida, empresa: ConfigEmpresa) -> str:
    NS = "http://www.portalfiscal.inf.br/nfe"
    ET.register_namespace("", NS)

    def el(parent, tag, text=None):
        e = ET.SubElement(parent, f"{{{NS}}}{tag}")
        if text is not None:
            e.text = str(text)
        return e

    nfeProc = ET.Element(f"{{{NS}}}nfeProc", {"versao": "4.00", "xmlns": NS})
    NFe = el(nfeProc, "NFe")
    infNFe = el(NFe, "infNFe")
    infNFe.set("versao", "4.00")
    chave = nf.chave_nfe or ("35" + datetime.now().strftime("%y%m") + _cnpj_digits(empresa.cnpj or "")[:14].zfill(14) + f"{nf.numero:09d}")
    infNFe.set("Id", f"NFe{chave[:44].ljust(44,'0')}")

    # ide
    ide = el(infNFe, "ide")
    el(ide, "cUF",  "35")
    el(ide, "cNF",  f"{nf.numero:08d}"[-8:])
    el(ide, "natOp", "VENDA MERCADORIA")
    el(ide, "mod",  "55")
    el(ide, "serie", nf.serie or "1")
    el(ide, "nNF",  str(nf.numero))
    el(ide, "dhEmi", datetime.now().strftime("%Y-%m-%dT%H:%M:%S-03:00"))
    el(ide, "tpNF",  "1")
    el(ide, "idDest","1")
    el(ide, "cMunFG","3550308")
    el(ide, "tpImp", "1")
    el(ide, "tpEmis","1")
    el(ide, "cDV",   "0")
    el(ide, "tpAmb", "2")  # 2=homologação 1=produção
    el(ide, "finNFe","1")
    el(ide, "indFinal","1")
    el(ide, "indPres","1")
    el(ide, "procEmi","0")
    el(ide, "verProc","NexusVarejo 1.0")

    # emit
    emit = el(infNFe, "emit")
    cnpj_emp = _cnpj_digits(empresa.cnpj or "")
    el(emit, "CNPJ", cnpj_emp.zfill(14))
    el(emit, "xNome", empresa.razao_social or "EMPRESA")
    el(emit, "xFant", empresa.nome_fantasia or empresa.razao_social or "")
    end_emit = el(emit, "enderEmit")
    el(end_emit, "xLgr",  getattr(empresa, "endereco", None) or "RUA")
    el(end_emit, "nro",   getattr(empresa, "numero", None) or "S/N")
    el(end_emit, "xBairro", getattr(empresa, "bairro", None) or "BAIRRO")
    el(end_emit, "cMun",  "3550308")
    el(end_emit, "xMun",  getattr(empresa, "cidade", None) or "SAO PAULO")
    el(end_emit, "UF",    getattr(empresa, "estado", None) or "SP")
    el(end_emit, "CEP",   _cnpj_digits(getattr(empresa, "cep", None) or "").zfill(8))
    el(end_emit, "cPais", "1058")
    el(end_emit, "xPais", "BRASIL")
    el(emit, "IE", getattr(empresa, "ie", None) or "ISENTO")
    el(emit, "CRT", "1" if "SIMPLES" in (getattr(empresa, "regime_tributario", None) or "") else "3")

    # dest
    dest = el(infNFe, "dest")
    doc = _cnpj_digits(nf.cliente_doc or "")
    if len(doc) == 14:
        el(dest, "CNPJ", doc)
    elif len(doc) == 11:
        el(dest, "CPF", doc)
    else:
        el(dest, "CPF", "00000000000")
    el(dest, "xNome", nf.cliente_nome or "CONSUMIDOR FINAL")
    el(dest, "indIEDest", "9")

    # itens
    for idx, item in enumerate(nf.itens, 1):
        det = el(infNFe, "det")
        det.set("nItem", str(idx))
        prod = el(det, "prod")
        el(prod, "cProd",  item.produto_id or idx)
        el(prod, "cEAN",   "SEM GTIN")
        el(prod, "xProd",  item.descricao[:120])
        el(prod, "NCM",    (item.ncm or "22021000").replace(".", "")[:8].zfill(8))
        el(prod, "CFOP",   item.cfop or "5102")
        el(prod, "uCom",   "UN")
        el(prod, "qCom",   f"{item.quantidade:.4f}")
        el(prod, "vUnCom", f"{item.preco_unitario:.10f}")
        el(prod, "vProd",  f"{item.valor_total:.2f}")
        el(prod, "cEANTrib","SEM GTIN")
        el(prod, "uTrib",  "UN")
        el(prod, "qTrib",  f"{item.quantidade:.4f}")
        el(prod, "vUnTrib",f"{item.preco_unitario:.10f}")
        el(prod, "indTot", "1")
        if item.desconto and item.desconto > 0:
            el(prod, "vDesc", f"{item.desconto:.2f}")

        imp = el(det, "imposto")
        icms_grp = el(imp, "ICMS")
        cst = item.cst_icms or "400"
        if cst in ("102", "300", "400", "500"):
            icms_tag = el(icms_grp, f"ICMSSN{cst}")
            el(icms_tag, "orig", "0")
            el(icms_tag, "CSOSN", cst)
        else:
            icms_tag = el(icms_grp, "ICMS40")
            el(icms_tag, "orig", "0")
            el(icms_tag, "CST", cst)

        pis_grp = el(imp, "PIS")
        pisnt = el(pis_grp, "PISNT")
        el(pisnt, "CST", "07")

        cof_grp = el(imp, "COFINS")
        cofnt = el(cof_grp, "COFINSNT")
        el(cofnt, "CST", "07")

    # total
    total = el(infNFe, "total")
    icms_tot = el(total, "ICMSTot")
    el(icms_tot, "vBC",    "0.00"); el(icms_tot, "vICMS",  "0.00")
    el(icms_tot, "vICMSDeson","0.00"); el(icms_tot, "vFCPUFDest","0.00")
    el(icms_tot, "vICMSUFDest","0.00"); el(icms_tot, "vICMSUFRemet","0.00")
    el(icms_tot, "vFCP",   "0.00"); el(icms_tot, "vBCST",  "0.00")
    el(icms_tot, "vST",    "0.00"); el(icms_tot, "vFCPST", "0.00")
    el(icms_tot, "vFCPSTRet","0.00")
    el(icms_tot, "vProd",  f"{nf.valor_produtos:.2f}")
    el(icms_tot, "vFrete", f"{nf.valor_frete:.2f}")
    el(icms_tot, "vSeg",   "0.00"); el(icms_tot, "vDesc",  f"{nf.valor_desconto:.2f}")
    el(icms_tot, "vII",    "0.00"); el(icms_tot, "vIPI",   "0.00")
    el(icms_tot, "vIPIDevol","0.00"); el(icms_tot, "vPIS",   "0.00")
    el(icms_tot, "vCOFINS","0.00"); el(icms_tot, "vOutro", "0.00")
    el(icms_tot, "vNF",    f"{nf.valor_total:.2f}")

    # transp
    transp = el(infNFe, "transp")
    el(transp, "modFrete", "9")

    # pag
    pag = el(infNFe, "pag")
    detPag = el(pag, "detPag")
    el(detPag, "tPag", "01")
    el(detPag, "vPag", f"{nf.valor_total:.2f}")

    # infAdic
    infAdic = el(infNFe, "infAdic")
    el(infAdic, "infCpl", f"NexusVarejo | NF {nf.numero} | Gerado em {datetime.now().strftime('%d/%m/%Y %H:%M')}")

    xml_str = ET.tostring(nfeProc, encoding="unicode", xml_declaration=False)
    return f'<?xml version="1.0" encoding="UTF-8"?>{xml_str}'


@router.get("/{nf_id}/xml")
def gerar_xml(nf_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Gera e retorna o XML NF-e 4.0 (sem assinatura — requer certificado A1 para transmissão)."""
    nf = db.query(NFSaida).filter(NFSaida.id == nf_id).first()
    if not nf:
        raise HTTPException(404, "NF não encontrada")
    empresa = db.query(ConfigEmpresa).first()
    if not empresa:
        raise HTTPException(400, "Empresa não configurada. Vá em Configurações > Empresa.")
    xml = _build_nfe_xml(nf, empresa)
    return Response(
        content=xml,
        media_type="application/xml",
        headers={"Content-Disposition": f'attachment; filename="NF-e_{nf.numero:06d}.xml"'}
    )


@router.post("/{nf_id}/transmitir")
def transmitir_nfe(nf_id: int, body: Dict[str, Any] = Body(default={}), db: Session = Depends(get_db), _=Depends(get_current_user)):
    """
    Transmite NF-e ao SEFAZ.
    Requer certificado digital A1 (.pfx) configurado em Configurações > Empresa > Certificado.
    Status atual: aguardando configuração de certificado.
    """
    nf = db.query(NFSaida).filter(NFSaida.id == nf_id).first()
    if not nf:
        raise HTTPException(404, "NF não encontrada")

    empresa = db.query(ConfigEmpresa).first()
    cert_path = getattr(empresa, "certificado_path", None) if empresa else None

    if not cert_path:
        # Sem certificado: simula autorização local (ambiente de testes/demo)
        if body.get("forcar_demo"):
            import random, string
            chave_demo = "35" + datetime.now().strftime("%y%m") + "0" * 14 + f"{nf.numero:09d}" + "55001" + "".join(random.choices(string.digits, k=9)) + "1"
            nf.status    = "AUTORIZADA"
            nf.chave_nfe = chave_demo[:44]
            nf.protocolo = f"1{datetime.now().strftime('%y%m%d%H%M%S')}"
            db.commit()
            return {
                "ok": True,
                "status": "AUTORIZADA",
                "chave_nfe": nf.chave_nfe,
                "protocolo": nf.protocolo,
                "aviso": "MODO DEMO — NF autorizada localmente. Não válida perante o Fisco. Configure o certificado A1 para transmissão real.",
            }
        raise HTTPException(422, {
            "erro": "Certificado digital não configurado",
            "instrucoes": [
                "1. Obtenha seu certificado digital A1 (e-CPF ou e-CNPJ) junto a uma AC credenciada",
                "2. Vá em Configurações > Empresa > Certificado Digital",
                "3. Faça upload do arquivo .pfx e informe a senha",
                "4. Tente transmitir novamente",
            ]
        })

    # TODO: com certificado configurado, integrar com pysefaz ou zeiss-nfe
    raise HTTPException(501, "Integração SEFAZ em implementação. Certificado detectado — contate o suporte NexusVarejo.")
