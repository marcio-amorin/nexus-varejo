import json
import re
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import MonitorXml, Fornecedor, Produto
from utils.security import get_current_user

router = APIRouter(prefix="/monitor-xml", tags=["monitor-xml"])


def _parse_nfe_xml(xml_str: str) -> dict:
    """Reutiliza a lógica de parse do nf_entrada."""
    import xml.etree.ElementTree as ET
    ns = {'nfe': 'http://www.portalfiscal.inf.br/nfe'}
    root = ET.fromstring(xml_str)
    nfe_node = root.find('.//nfe:NFe', ns) or root
    inf = nfe_node.find('nfe:infNFe', ns) or nfe_node.find('infNFe')

    def txt(node, path):
        ns_opts = [ns, {}]
        for n in ns_opts:
            el = node.find(path, n) if n else None
            if el is not None and el.text:
                return el.text.strip()
        return ''

    emit = inf.find('nfe:emit', ns) or inf.find('emit')
    chave = inf.get('Id', '').replace('NFe', '') if inf is not None else ''

    itens = []
    for det in (inf.findall('nfe:det', ns) if inf is not None else []):
        prod_el = det.find('nfe:prod', ns) or det.find('prod')
        if prod_el is None:
            continue
        itens.append({
            'codigo_fornecedor': txt(prod_el, 'nfe:cProd'),
            'codigo_barras':     txt(prod_el, 'nfe:cEAN'),
            'descricao':         txt(prod_el, 'nfe:xProd'),
            'ncm':               txt(prod_el, 'nfe:NCM'),
            'unidade':           txt(prod_el, 'nfe:uCom'),
            'quantidade':        float(txt(prod_el, 'nfe:qCom') or 0),
            'preco_unitario':    float(txt(prod_el, 'nfe:vUnCom') or 0),
            'valor_total':       float(txt(prod_el, 'nfe:vProd') or 0),
        })

    total_node = inf.find('nfe:total/nfe:ICMSTot', ns) if inf is not None else None
    valor_total = float(txt(total_node, 'nfe:vNF') if total_node is not None else '0') or 0

    ide = inf.find('nfe:ide', ns) if inf is not None else None
    numero = txt(ide, 'nfe:nNF') if ide is not None else ''
    serie  = txt(ide, 'nfe:serie') if ide is not None else ''
    data   = txt(ide, 'nfe:dhEmi') if ide is not None else ''
    if data and 'T' in data:
        data = data[:10]

    return {
        'chave':        chave,
        'numero_nf':    numero,
        'serie':        serie,
        'data_emissao': data,
        'valor_total':  valor_total,
        'emitente': {
            'nome':  txt(emit, 'nfe:xNome') if emit is not None else '',
            'cnpj':  txt(emit, 'nfe:CNPJ')  if emit is not None else '',
        },
        'itens': itens,
    }


@router.get("/")
def listar(db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Lista todos os XMLs no monitor, mais recentes primeiro."""
    registros = db.query(MonitorXml).order_by(MonitorXml.id.desc()).limit(200).all()
    return [_serial(r) for r in registros]


@router.post("/upload")
def upload_xml(body: dict, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Recebe XML, faz parse, verifica fornecedor/produtos e salva como PENDENTE ou DIVERGENCIA."""
    xml_str = body.get("xml", "")
    if not xml_str:
        raise HTTPException(400, "XML não informado")

    dados = _parse_nfe_xml(xml_str)
    chave = dados["chave"]

    # Evitar duplicata
    if chave:
        existente = db.query(MonitorXml).filter_by(chave_nfe=chave).first()
        if existente:
            raise HTTPException(409, f"XML já recebido (chave {chave[:10]}...)")

    # Verificar fornecedor
    cnpj_digits = re.sub(r"\D", "", dados["emitente"]["cnpj"])
    forn = db.query(Fornecedor).filter(
        Fornecedor.cnpj_cpf.contains(cnpj_digits)
    ).first() if cnpj_digits else None
    dados["fornecedor_encontrado"] = forn is not None
    dados["fornecedor_id"]         = forn.id if forn else None

    # Verificar cada produto
    itens_ok = 0
    itens_novos = 0
    for item in dados["itens"]:
        prod = None
        if item["codigo_barras"] and item["codigo_barras"] not in ("SEM GTIN", ""):
            prod = db.query(Produto).filter(
                (Produto.codigo_barras == item["codigo_barras"]) |
                (Produto.codigo == item["codigo_barras"])
            ).first()
        if not prod and item["codigo_fornecedor"]:
            prod = db.query(Produto).filter(Produto.codigo == item["codigo_fornecedor"]).first()
        item["produto_id"]        = prod.id if prod else None
        item["produto_encontrado"] = prod is not None
        item["preco_custo_atual"] = prod.preco_custo if prod else 0
        if prod:
            itens_ok += 1
        else:
            itens_novos += 1

    # Status automático
    tem_divergencia = (not dados["fornecedor_encontrado"]) or itens_novos > 0
    status = "DIVERGENCIA" if tem_divergencia else "OK"

    reg = MonitorXml(
        chave_nfe       = chave or None,
        numero_nf       = dados["numero_nf"],
        serie           = dados["serie"],
        data_emissao    = dados["data_emissao"],
        fornecedor_nome = dados["emitente"]["nome"],
        fornecedor_doc  = dados["emitente"]["cnpj"],
        fornecedor_found= dados["fornecedor_encontrado"],
        valor_total     = dados["valor_total"],
        total_itens     = len(dados["itens"]),
        itens_ok        = itens_ok,
        itens_novos     = itens_novos,
        xml_raw         = xml_str,
        dados_json      = json.dumps(dados, ensure_ascii=False),
        status          = status,
    )
    db.add(reg)
    db.commit()
    db.refresh(reg)
    return _serial(reg)


@router.get("/{rid}")
def detalhe(rid: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Retorna detalhes de um XML, incluindo itens parseados."""
    reg = db.query(MonitorXml).filter_by(id=rid).first()
    if not reg:
        raise HTTPException(404)
    d = _serial(reg)
    if reg.dados_json:
        try:
            d["dados"] = json.loads(reg.dados_json)
        except Exception:
            pass
    return d


@router.post("/{rid}/importar")
def importar(rid: int, body: dict, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Importa o XML para lançamento de NF (chama a lógica do confirmar-xml internamente)."""
    from routes.nf_entrada import confirmar_xml as _confirmar
    reg = db.query(MonitorXml).filter_by(id=rid).first()
    if not reg:
        raise HTTPException(404)
    if reg.status == "IMPORTADO":
        raise HTTPException(400, "XML já foi importado")

    # Usa os itens ajustados enviados pelo frontend (com criar_produto, margem, etc.)
    body["dados"] = json.loads(reg.dados_json)

    # Chama a função de confirmação diretamente
    from fastapi import Request
    class FakeUser:
        id = 1
    result = _confirmar.__wrapped__(body, db, FakeUser()) if hasattr(_confirmar, '__wrapped__') else None

    # Fallback: chama a rota indiretamente pelo módulo
    if result is None:
        from routes import nf_entrada as nfe_mod
        result = nfe_mod.confirmar_xml(body, db, FakeUser())

    reg.status = "IMPORTADO"
    db.commit()
    return {"ok": True, "nf_id": result.get("id") if isinstance(result, dict) else None}


@router.post("/{rid}/rejeitar")
def rejeitar(rid: int, body: dict, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Rejeita o XML (não importa)."""
    reg = db.query(MonitorXml).filter_by(id=rid).first()
    if not reg:
        raise HTTPException(404)
    reg.status = "REJEITADO"
    reg.obs    = body.get("motivo", "")
    db.commit()
    return {"ok": True}


@router.delete("/{rid}")
def excluir(rid: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    reg = db.query(MonitorXml).filter_by(id=rid).first()
    if not reg:
        raise HTTPException(404)
    db.delete(reg)
    db.commit()
    return {"ok": True}


def _serial(r: MonitorXml) -> dict:
    return {
        "id":             r.id,
        "created_at":     r.created_at.isoformat() if r.created_at else None,
        "chave_nfe":      r.chave_nfe,
        "numero_nf":      r.numero_nf,
        "serie":          r.serie,
        "data_emissao":   r.data_emissao,
        "fornecedor_nome": r.fornecedor_nome,
        "fornecedor_doc":  r.fornecedor_doc,
        "fornecedor_found": r.fornecedor_found,
        "valor_total":    r.valor_total,
        "total_itens":    r.total_itens,
        "itens_ok":       r.itens_ok,
        "itens_novos":    r.itens_novos,
        "status":         r.status,
        "obs":            r.obs,
    }
