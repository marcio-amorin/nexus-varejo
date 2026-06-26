from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import NotaFiscalEntrada, ItemNFEntrada, Produto, MovimentoEstoque, ContaPagar, Fornecedor
from utils.security import get_current_user
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, timedelta
import xml.etree.ElementTree as ET
import re

router = APIRouter(prefix="/nf-entrada", tags=["nf_entrada"])


# ─── Schemas ────────────────────────────────────────────────────────────────

class ItemNFCreate(BaseModel):
    produto_id: int
    quantidade: float
    preco_unitario: float
    desconto: Optional[float] = 0.0
    margem_aplicada: Optional[float] = None      # usa margem do produto/categoria se None
    atualizar_preco: Optional[bool] = True

class NFEntradaCreate(BaseModel):
    numero: str
    serie: Optional[str] = "1"
    fornecedor_id: int
    data_emissao: date
    data_entrada: date
    chave_nfe: Optional[str] = None
    valor_frete: Optional[float] = 0.0
    valor_outros: Optional[float] = 0.0
    valor_desconto: Optional[float] = 0.0
    condicao_pagamento: Optional[str] = "A_VISTA"
    prazo_dias: Optional[str] = None             # "30,60,90"
    observacoes: Optional[str] = None
    itens: List[ItemNFCreate]


# ─── Helpers ────────────────────────────────────────────────────────────────

def _calcular_preco_venda(custo: float, margem: float) -> float:
    m = margem / 100
    if m >= 1:
        return round(custo * (1 + m), 2)
    return round(custo / (1 - m), 2)


def _nf_dict(nf: NotaFiscalEntrada) -> dict:
    return {
        "id": nf.id,
        "numero": nf.numero,
        "serie": nf.serie,
        "fornecedor_id": nf.fornecedor_id,
        "fornecedor_nome": nf.fornecedor.razao_social if nf.fornecedor else None,
        "data_emissao": str(nf.data_emissao),
        "data_entrada": str(nf.data_entrada),
        "chave_nfe": nf.chave_nfe,
        "valor_produtos": nf.valor_produtos,
        "valor_frete": nf.valor_frete,
        "valor_outros": nf.valor_outros,
        "valor_desconto": nf.valor_desconto,
        "valor_total": nf.valor_total,
        "condicao_pagamento": nf.condicao_pagamento,
        "prazo_dias": nf.prazo_dias,
        "status": nf.status,
        "observacoes": nf.observacoes,
        "created_at": nf.created_at.isoformat() if nf.created_at else None,
        "itens": [_item_dict(i) for i in nf.itens],
    }


def _item_dict(i: ItemNFEntrada) -> dict:
    return {
        "id": i.id,
        "produto_id": i.produto_id,
        "produto_codigo": i.produto.codigo if i.produto else None,
        "produto_descricao": i.produto.descricao if i.produto else None,
        "quantidade": i.quantidade,
        "preco_unitario": i.preco_unitario,
        "desconto": i.desconto,
        "valor_total": i.valor_total,
        "margem_aplicada": i.margem_aplicada,
        "preco_venda_calculado": i.preco_venda_calculado,
        "atualizar_preco": i.atualizar_preco,
    }


# ─── Endpoints ──────────────────────────────────────────────────────────────

@router.get("/")
def list_nfs(
    fornecedor_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(NotaFiscalEntrada).filter(NotaFiscalEntrada.status != "CANCELADA")
    if fornecedor_id:
        q = q.filter(NotaFiscalEntrada.fornecedor_id == fornecedor_id)
    if status:
        q = q.filter(NotaFiscalEntrada.status == status)
    nfs = q.order_by(NotaFiscalEntrada.data_entrada.desc()).all()
    return [{
        "id": nf.id, "numero": nf.numero, "serie": nf.serie,
        "fornecedor_nome": nf.fornecedor.razao_social if nf.fornecedor else None,
        "data_entrada": str(nf.data_entrada),
        "valor_total": nf.valor_total,
        "status": nf.status,
        "total_itens": len(nf.itens),
    } for nf in nfs]


@router.get("/{nf_id}")
def get_nf(nf_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    nf = db.query(NotaFiscalEntrada).filter(NotaFiscalEntrada.id == nf_id).first()
    if not nf:
        raise HTTPException(404, "NF não encontrada")
    return _nf_dict(nf)


@router.post("/")
def create_nf(data: NFEntradaCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    if not data.itens:
        raise HTTPException(400, "NF deve ter ao menos um item")

    # Calcular totais
    valor_produtos = 0.0
    itens_obj = []

    for item_data in data.itens:
        prod = db.query(Produto).filter(Produto.id == item_data.produto_id).first()
        if not prod:
            raise HTTPException(404, f"Produto {item_data.produto_id} não encontrado")

        valor_item = round(item_data.quantidade * item_data.preco_unitario - (item_data.desconto or 0), 2)
        valor_produtos += valor_item

        # Margem: usa a informada, senão a do produto, senão 30%
        margem = item_data.margem_aplicada
        if margem is None:
            margem = prod.margem if prod.margem else (
                prod.categoria.margem_padrao if prod.categoria else 30.0
            )

        preco_venda_calc = _calcular_preco_venda(item_data.preco_unitario, margem)

        item = ItemNFEntrada(
            produto_id=item_data.produto_id,
            quantidade=item_data.quantidade,
            preco_unitario=item_data.preco_unitario,
            desconto=item_data.desconto or 0,
            valor_total=valor_item,
            margem_aplicada=margem,
            preco_venda_calculado=preco_venda_calc,
            atualizar_preco=item_data.atualizar_preco,
        )
        itens_obj.append((item, prod, preco_venda_calc))

    valor_total = round(
        valor_produtos + (data.valor_frete or 0) + (data.valor_outros or 0) - (data.valor_desconto or 0), 2
    )

    nf = NotaFiscalEntrada(
        numero=data.numero,
        serie=data.serie,
        fornecedor_id=data.fornecedor_id,
        data_emissao=data.data_emissao,
        data_entrada=data.data_entrada,
        chave_nfe=data.chave_nfe,
        valor_produtos=valor_produtos,
        valor_frete=data.valor_frete or 0,
        valor_outros=data.valor_outros or 0,
        valor_desconto=data.valor_desconto or 0,
        valor_total=valor_total,
        condicao_pagamento=data.condicao_pagamento,
        prazo_dias=data.prazo_dias,
        status="RECEBIDA",
        observacoes=data.observacoes,
    )
    db.add(nf); db.flush()

    for item, prod, preco_venda_calc in itens_obj:
        item.nf_id = nf.id
        db.add(item)

        # Atualizar estoque do produto
        prod.estoque_atual = round(prod.estoque_atual + item.quantidade, 4)
        prod.preco_custo = item.preco_unitario  # atualiza custo sempre

        # Atualizar preço de venda se marcado
        if item.atualizar_preco:
            prod.preco_venda = preco_venda_calc
            prod.margem = item.margem_aplicada

        # Registrar movimento de estoque
        mov = MovimentoEstoque(
            produto_id=prod.id,
            tipo="ENTRADA",
            quantidade=item.quantidade,
            custo_unitario=item.preco_unitario,
            valor_total=item.valor_total,
            data=data.data_entrada,
            origem="NF_ENTRADA",
            origem_id=nf.id,
            documento_ref=f"NF {data.numero}/{data.serie}",
        )
        db.add(mov)

    # Gerar contas a pagar
    _gerar_contas_pagar(db, nf, valor_total, data)

    db.commit(); db.refresh(nf)
    return _nf_dict(nf)


def _gerar_contas_pagar(db: Session, nf: NotaFiscalEntrada, valor_total: float, data: NFEntradaCreate):
    if data.condicao_pagamento == "A_VISTA":
        cp = ContaPagar(
            fornecedor_id=data.fornecedor_id,
            nf_id=nf.id,
            descricao=f"NF {data.numero}/{data.serie}",
            valor=valor_total,
            vencimento=data.data_entrada,
            status="PENDENTE",
            parcela_num=1,
            total_parcelas=1,
        )
        db.add(cp)
    elif data.prazo_dias:
        prazos = [int(d.strip()) for d in data.prazo_dias.split(",") if d.strip().isdigit()]
        total_parcelas = len(prazos)
        valor_parcela = round(valor_total / total_parcelas, 2)
        for i, dias in enumerate(prazos, 1):
            venc = data.data_entrada + timedelta(days=dias)
            cp = ContaPagar(
                fornecedor_id=data.fornecedor_id,
                nf_id=nf.id,
                descricao=f"NF {data.numero}/{data.serie} — Parcela {i}/{total_parcelas}",
                valor=valor_parcela,
                vencimento=venc,
                status="PENDENTE",
                parcela_num=i,
                total_parcelas=total_parcelas,
            )
            db.add(cp)


# ─── Importação XML NF-e ────────────────────────────────────────────────────

NS = "http://www.portalfiscal.inf.br/nfe"

def _txt(el, tag: str, ns: str = NS) -> str:
    found = el.find(f"{{{ns}}}{tag}") if el is not None else None
    return (found.text or "").strip() if found is not None else ""


def _parse_nfe_xml(xml_str: str) -> dict:
    """Extrai dados principais de um XML NF-e."""
    try:
        root = ET.fromstring(xml_str)
    except ET.ParseError as e:
        raise HTTPException(400, f"XML inválido: {e}")

    # Localiza o elemento infNFe (pode estar dentro de nfeProc ou direto)
    nfe = root.find(f".//{{{NS}}}infNFe")
    if nfe is None:
        raise HTTPException(400, "Elemento infNFe não encontrado no XML")

    ide   = nfe.find(f"{{{NS}}}ide")
    emit  = nfe.find(f"{{{NS}}}emit")
    dest  = nfe.find(f"{{{NS}}}dest")
    total = nfe.find(f".//{{{NS}}}ICMSTot")
    cobr  = nfe.find(f"{{{NS}}}cobr")

    numero = _txt(ide, "nNF")
    serie  = _txt(ide, "serie")
    dhEmi  = _txt(ide, "dhEmi") or _txt(ide, "dEmi")
    data_emissao = dhEmi[:10] if dhEmi else str(date.today())

    # emitente
    emit_cnpj    = re.sub(r"\D", "", _txt(emit, "CNPJ"))
    emit_razao   = _txt(emit, "xNome")
    emit_fantasia= _txt(emit, "xFant") or emit_razao
    emit_ie      = _txt(emit, "IE")
    emit_end     = emit.find(f"{{{NS}}}enderEmit") if emit is not None else None
    emit_cidade  = _txt(emit_end, "xMun")
    emit_uf      = _txt(emit_end, "UF")
    emit_cep     = _txt(emit_end, "CEP")
    emit_logr    = _txt(emit_end, "xLgr")
    emit_num     = _txt(emit_end, "nro")
    emit_bairro  = _txt(emit_end, "xBairro")
    emit_fone    = _txt(emit, "fone")

    # totais
    vProd = float(_txt(total, "vProd") or 0)
    vFret = float(_txt(total, "vFrete") or 0)
    vDesc = float(_txt(total, "vDesc") or 0)
    vNF   = float(_txt(total, "vNF") or 0)
    vTrib = float(_txt(total, "vTotTrib") or 0)

    # duplicatas (parcelas)
    prazos_dias = []
    if cobr is not None:
        for dup in cobr.findall(f"{{{NS}}}dup"):
            dt_venc = _txt(dup, "dVenc")
            if dt_venc:
                try:
                    from datetime import datetime
                    d = datetime.strptime(dt_venc[:10], "%Y-%m-%d").date()
                    delta = (d - date.today()).days
                    if delta > 0:
                        prazos_dias.append(delta)
                except Exception:
                    pass

    # itens
    itens = []
    for det in nfe.findall(f"{{{NS}}}det"):
        prod_el  = det.find(f"{{{NS}}}prod")
        imp_el   = det.find(f"{{{NS}}}imposto")

        xProd    = _txt(prod_el, "xProd")
        cEAN     = _txt(prod_el, "cEAN")
        cProd    = _txt(prod_el, "cProd")
        ncm      = _txt(prod_el, "NCM")
        cfop     = _txt(prod_el, "CFOP")
        uCom     = _txt(prod_el, "uCom")
        qCom     = float(_txt(prod_el, "qCom") or 0)
        vUnCom   = float(_txt(prod_el, "vUnCom") or 0)
        vDesc_i  = float(_txt(prod_el, "vDesc") or 0)
        vProd_i  = float(_txt(prod_el, "vProd") or 0)

        # ICMS
        icms_el = imp_el.find(f".//{{{NS}}}ICMS") if imp_el is not None else None
        cst_icms = ""
        csosn = ""
        icms_aliq = 0.0
        if icms_el is not None:
            for tag in ["ICMS00","ICMS10","ICMS20","ICMS40","ICMS60","ICMS70","ICMS90",
                        "ICMSSN101","ICMSSN102","ICMSSN201","ICMSSN202","ICMSSN500","ICMSSN900"]:
                sub = icms_el.find(f"{{{NS}}}{tag}")
                if sub is not None:
                    cst_icms = _txt(sub, "CST")
                    csosn    = _txt(sub, "CSOSN")
                    icms_aliq= float(_txt(sub, "pICMS") or 0)
                    break

        pis_el  = imp_el.find(f".//{{{NS}}}PIS") if imp_el is not None else None
        pis_aliq = 0.0
        if pis_el is not None:
            for tag in ["PISAliq","PISQtde","PISNT","PISSN","PISOutr"]:
                sub = pis_el.find(f"{{{NS}}}{tag}")
                if sub is not None:
                    pis_aliq = float(_txt(sub, "pPIS") or 0)
                    break

        cof_el  = imp_el.find(f".//{{{NS}}}COFINS") if imp_el is not None else None
        cof_aliq = 0.0
        if cof_el is not None:
            for tag in ["COFINSAliq","COFINSQtde","COFINSNT","COFINSSN","COFINSOutr"]:
                sub = cof_el.find(f"{{{NS}}}{tag}")
                if sub is not None:
                    cof_aliq = float(_txt(sub, "pCOFINS") or 0)
                    break

        itens.append({
            "codigo_fornecedor": cProd,
            "codigo_barras":     cEAN if cEAN not in ("SEM GTIN", "7896") else "",
            "descricao":         xProd,
            "ncm":               ncm,
            "cfop":              cfop,
            "unidade":           uCom,
            "quantidade":        qCom,
            "preco_unitario":    vUnCom,
            "desconto":          vDesc_i,
            "valor_total":       vProd_i,
            "cst_icms":          cst_icms or csosn,
            "icms_aliquota":     icms_aliq,
            "pis_aliquota":      pis_aliq,
            "cofins_aliquota":   cof_aliq,
        })

    chave = ""
    prot = root.find(f".//{{{NS}}}infProt")
    if prot is not None:
        chave = _txt(prot, "chNFe")
    if not chave:
        attr = nfe.get("Id", "")
        chave = attr.replace("NFe", "") if attr else ""

    return {
        "numero":        numero,
        "serie":         serie,
        "data_emissao":  data_emissao,
        "chave_nfe":     chave,
        "emitente": {
            "cnpj":       emit_cnpj,
            "razao_social": emit_razao,
            "fantasia":   emit_fantasia,
            "ie":         emit_ie,
            "rua":        emit_logr,
            "numero":     emit_num,
            "bairro":     emit_bairro,
            "cidade":     emit_cidade,
            "estado":     emit_uf,
            "cep":        emit_cep,
            "telefone":   emit_fone,
        },
        "valor_produtos": vProd,
        "valor_frete":    vFret,
        "valor_desconto": vDesc,
        "valor_total":    vNF,
        "valor_tributos": vTrib,
        "prazos_dias":    prazos_dias,
        "condicao_pagamento": "PRAZO" if prazos_dias else "A_VISTA",
        "itens":          itens,
    }


@router.post("/parse-xml")
def parse_xml(body: dict, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Recebe XML string, faz parse e retorna dados estruturados + verifica fornecedor/produtos."""
    xml_str = body.get("xml", "")
    if not xml_str:
        raise HTTPException(400, "XML não informado")

    dados = _parse_nfe_xml(xml_str)

    # verifica se fornecedor existe
    cnpj_digits = re.sub(r"\D", "", dados["emitente"]["cnpj"])
    forn = None
    if cnpj_digits:
        forn = db.query(Fornecedor).filter(
            Fornecedor.cnpj_cpf.contains(cnpj_digits)
        ).first()
    dados["fornecedor_encontrado"] = forn is not None
    dados["fornecedor_id"] = forn.id if forn else None

    # verifica cada item
    for item in dados["itens"]:
        prod = None
        if item["codigo_barras"]:
            prod = db.query(Produto).filter(
                (Produto.codigo_barras == item["codigo_barras"]) |
                (Produto.codigo == item["codigo_barras"])
            ).first()
        if not prod and item["codigo_fornecedor"]:
            prod = db.query(Produto).filter(
                Produto.codigo == item["codigo_fornecedor"]
            ).first()
        item["produto_id"]       = prod.id if prod else None
        item["produto_encontrado"] = prod is not None
        item["estoque_atual"]    = prod.estoque_atual if prod else 0
        item["preco_custo_atual"]= prod.preco_custo if prod else 0

    return dados


@router.post("/confirmar-xml")
def confirmar_xml(body: dict, db: Session = Depends(get_db), u=Depends(get_current_user)):
    """Confirma a importação do XML: cria/atualiza fornecedor, produtos e lança a NF."""
    dados = body.get("dados", {})
    criar_fornecedor_auto = body.get("criar_fornecedor", False)
    itens_confirmados = body.get("itens", [])

    if not dados:
        raise HTTPException(400, "Dados da NF não informados")

    # resolve fornecedor
    fornecedor_id = dados.get("fornecedor_id")
    if not fornecedor_id and criar_fornecedor_auto:
        emit = dados.get("emitente", {})
        cnpj_digits = re.sub(r"\D", "", emit.get("cnpj", ""))
        cnpj_fmt = ""
        if len(cnpj_digits) == 14:
            cnpj_fmt = f"{cnpj_digits[:2]}.{cnpj_digits[2:5]}.{cnpj_digits[5:8]}/{cnpj_digits[8:12]}-{cnpj_digits[12:]}"
        forn = Fornecedor(
            razao_social=emit.get("razao_social", ""),
            fantasia=emit.get("fantasia", ""),
            cnpj_cpf=cnpj_fmt or emit.get("cnpj", ""),
            ie=emit.get("ie", ""),
            rua=emit.get("rua", ""),
            numero=emit.get("numero", ""),
            bairro=emit.get("bairro", ""),
            cidade=emit.get("cidade", ""),
            estado=emit.get("estado", ""),
            cep=emit.get("cep", ""),
            telefone=emit.get("telefone", ""),
        )
        db.add(forn); db.flush()
        fornecedor_id = forn.id

    if not fornecedor_id:
        raise HTTPException(400, "Fornecedor não identificado")

    # monta itens para criação da NF
    itens_nf = []
    for item in itens_confirmados:
        produto_id = item.get("produto_id")
        # cria produto se não existe e foi marcado para criar
        if not produto_id and item.get("criar_produto", False):
            prod = Produto(
                codigo=item.get("codigo_barras") or item.get("codigo_fornecedor") or f"IMP-{item.get('descricao','')[:8]}",
                codigo_barras=item.get("codigo_barras") or None,
                descricao=item.get("descricao", ""),
                unidade=item.get("unidade", "UN"),
                ncm=item.get("ncm"),
                preco_custo=item.get("preco_unitario", 0),
                preco_venda=round(item.get("preco_unitario", 0) * 1.3, 2),
                margem=30.0,
                estoque_atual=0,
            )
            db.add(prod); db.flush()
            produto_id = prod.id

        if produto_id:
            itens_nf.append(ItemNFCreate(
                produto_id=produto_id,
                quantidade=item.get("quantidade", 0),
                preco_unitario=item.get("preco_unitario", 0),
                desconto=item.get("desconto", 0),
                margem_aplicada=item.get("margem", None),
                atualizar_preco=item.get("atualizar_preco", True),
            ))

    if not itens_nf:
        raise HTTPException(400, "Nenhum item confirmado")

    prazo_str = ",".join(str(d) for d in dados.get("prazos_dias", [])) or None

    nf_data = NFEntradaCreate(
        numero=dados.get("numero", ""),
        serie=dados.get("serie", "1"),
        fornecedor_id=fornecedor_id,
        data_emissao=date.fromisoformat(dados.get("data_emissao", str(date.today()))),
        data_entrada=date.today(),
        chave_nfe=dados.get("chave_nfe"),
        valor_frete=dados.get("valor_frete", 0),
        valor_outros=0,
        valor_desconto=dados.get("valor_desconto", 0),
        condicao_pagamento=dados.get("condicao_pagamento", "A_VISTA"),
        prazo_dias=prazo_str,
        itens=itens_nf,
    )

    return create_nf(nf_data, db, u)


# ── Coletor de Recebimento ────────────────────────────────────────────────────

@router.get("/coletor/recentes")
def nfs_recentes_coletor(db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Lista NFs dos últimos 30 dias para recebimento via coletor."""
    desde = date.today() - timedelta(days=30)
    nfs = (db.query(NotaFiscalEntrada)
           .filter(NotaFiscalEntrada.data_entrada >= desde)
           .filter(NotaFiscalEntrada.status != "CANCELADA")
           .order_by(NotaFiscalEntrada.data_entrada.desc())
           .limit(50).all())
    return [{
        "id": nf.id,
        "numero": nf.numero,
        "fornecedor_nome": nf.fornecedor.razao_social if nf.fornecedor else "",
        "data_entrada": str(nf.data_entrada),
        "valor_total": nf.valor_total,
        "status": nf.status,
        "total_itens": len(nf.itens),
        "total_qty": sum(it.quantidade for it in nf.itens),
    } for nf in nfs]


@router.get("/coletor/{nf_id}")
def nf_coletor_detalhe(nf_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Retorna NF com itens completos para conferência via coletor."""
    nf = db.query(NotaFiscalEntrada).filter_by(id=nf_id).first()
    if not nf: raise HTTPException(404, "NF não encontrada")
    return {
        "id": nf.id,
        "numero": nf.numero,
        "serie": nf.serie,
        "fornecedor_nome": nf.fornecedor.razao_social if nf.fornecedor else "",
        "data_entrada": str(nf.data_entrada),
        "valor_total": nf.valor_total,
        "status": nf.status,
        "itens": [{
            "id": it.id,
            "produto_id": it.produto_id,
            "descricao": it.produto.descricao if it.produto else it.id,
            "codigo": it.produto.codigo if it.produto else "",
            "codigo_barras": it.produto.codigo_barras if it.produto else None,
            "unidade": it.produto.unidade if it.produto else "UN",
            "quantidade": it.quantidade,
            "preco_unitario": it.preco_unitario,
            "valor_total": it.valor_total,
            "controla_validade": getattr(it.produto, "controla_validade", False) if it.produto else False,
        } for it in nf.itens],
    }


@router.delete("/{nf_id}")
def cancelar_nf(nf_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    nf = db.query(NotaFiscalEntrada).filter(NotaFiscalEntrada.id == nf_id).first()
    if not nf:
        raise HTTPException(404, "NF não encontrada")
    if nf.status == "CANCELADA":
        raise HTTPException(400, "NF já cancelada")
    # Reverter estoque
    for item in nf.itens:
        prod = db.query(Produto).filter(Produto.id == item.produto_id).first()
        if prod:
            prod.estoque_atual = max(0, prod.estoque_atual - item.quantidade)
        mov = MovimentoEstoque(
            produto_id=item.produto_id,
            tipo="SAIDA",
            quantidade=item.quantidade,
            custo_unitario=item.preco_unitario,
            valor_total=item.valor_total,
            data=date.today(),
            origem="NF_ENTRADA",
            origem_id=nf.id,
            documento_ref=f"CANCEL NF {nf.numero}",
            observacao="Cancelamento de NF de entrada",
        )
        db.add(mov)
    nf.status = "CANCELADA"
    db.commit()
    return {"ok": True}
