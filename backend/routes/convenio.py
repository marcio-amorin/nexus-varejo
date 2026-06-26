from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import ConvenioEmpresa, LancamentoConvenio, Cliente, CampoLivreCliente
from utils.security import get_current_user
from pydantic import BaseModel
from typing import Optional, List
from datetime import date

router = APIRouter(prefix="/convenio", tags=["convenio"])


def _serial(c: ConvenioEmpresa) -> dict:
    return {
        "id":             c.id,
        "cliente_id":     c.cliente_id,
        "cliente_nome":   c.cliente.nome if c.cliente else None,
        "limite_mensal":  c.limite_mensal,
        "dia_fechamento": c.dia_fechamento,
        "desconto_pct":   c.desconto_pct,
        "ativo":          c.ativo,
        "responsavel":    c.responsavel,
        "observacoes":    c.observacoes,
        "created_at":     c.created_at.isoformat() if c.created_at else None,
    }


def _serial_lanc(l: LancamentoConvenio) -> dict:
    return {
        "id":         l.id,
        "convenio_id":l.convenio_id,
        "venda_id":   l.venda_id,
        "descricao":  l.descricao,
        "valor":      l.valor,
        "tipo":       l.tipo,
        "mes_ref":    l.mes_ref,
        "status":     l.status,
        "pago_em":    l.pago_em.isoformat() if l.pago_em else None,
        "created_at": l.created_at.isoformat() if l.created_at else None,
    }


class ConvenioSchema(BaseModel):
    cliente_id:     int
    limite_mensal:  float = 0.0
    dia_fechamento: int   = 25
    desconto_pct:   float = 0.0
    ativo:          bool  = True
    responsavel:    Optional[str] = None
    observacoes:    Optional[str] = None


class LancamentoSchema(BaseModel):
    convenio_id: int
    descricao:   str
    valor:       float
    tipo:        str  = "DEBITO"
    mes_ref:     str  # YYYY-MM


# ── Convênios ─────────────────────────────────────────────────────────────────

@router.get("")
def listar(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return [_serial(c) for c in db.query(ConvenioEmpresa).order_by(ConvenioEmpresa.id.desc()).all()]


@router.post("")
def criar(data: ConvenioSchema, db: Session = Depends(get_db), _=Depends(get_current_user)):
    if db.query(ConvenioEmpresa).filter_by(cliente_id=data.cliente_id).first():
        raise HTTPException(400, "Cliente já tem convênio cadastrado")
    c = ConvenioEmpresa(**data.dict())
    db.add(c); db.commit(); db.refresh(c)
    return _serial(c)


@router.put("/{cid}")
def atualizar(cid: int, data: ConvenioSchema, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(ConvenioEmpresa).filter_by(id=cid).first()
    if not c: raise HTTPException(404, "Convênio não encontrado")
    for k, v in data.dict().items():
        setattr(c, k, v)
    db.commit(); db.refresh(c)
    return _serial(c)


@router.delete("/{cid}")
def excluir(cid: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(ConvenioEmpresa).filter_by(id=cid).first()
    if not c: raise HTTPException(404, "Convênio não encontrado")
    db.delete(c); db.commit()
    return {"ok": True}


# ── Lançamentos ────────────────────────────────────────────────────────────────

@router.get("/{cid}/lancamentos")
def listar_lancamentos(cid: int, mes_ref: Optional[str] = None, db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(LancamentoConvenio).filter_by(convenio_id=cid)
    if mes_ref: q = q.filter_by(mes_ref=mes_ref)
    return [_serial_lanc(l) for l in q.order_by(LancamentoConvenio.id.desc()).all()]


@router.post("/lancamentos")
def lancar(data: LancamentoSchema, db: Session = Depends(get_db), _=Depends(get_current_user)):
    l = LancamentoConvenio(**data.dict())
    db.add(l); db.commit(); db.refresh(l)
    return _serial_lanc(l)


@router.put("/lancamentos/{lid}/pagar")
def pagar_lancamento(lid: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    l = db.query(LancamentoConvenio).filter_by(id=lid).first()
    if not l: raise HTTPException(404, "Lançamento não encontrado")
    l.status = "PAGO"; l.pago_em = date.today()
    db.commit()
    return _serial_lanc(l)


# ── Relatório de Fechamento ────────────────────────────────────────────────────

@router.get("/{cid}/fechamento/{mes_ref}")
def fechamento(cid: int, mes_ref: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    conv = db.query(ConvenioEmpresa).filter_by(id=cid).first()
    if not conv: raise HTTPException(404, "Convênio não encontrado")
    lancamentos = db.query(LancamentoConvenio).filter_by(convenio_id=cid, mes_ref=mes_ref).all()
    total_debito  = sum(l.valor for l in lancamentos if l.tipo == "DEBITO")
    total_credito = sum(l.valor for l in lancamentos if l.tipo == "CREDITO")
    total_pago    = sum(l.valor for l in lancamentos if l.status == "PAGO" and l.tipo == "DEBITO")
    return {
        "convenio_id":    cid,
        "cliente_nome":   conv.cliente.nome if conv.cliente else "",
        "responsavel":    conv.responsavel,
        "mes_ref":        mes_ref,
        "limite_mensal":  conv.limite_mensal,
        "total_debito":   round(total_debito, 2),
        "total_credito":  round(total_credito, 2),
        "saldo_devedor":  round(total_debito - total_credito, 2),
        "total_pago":     round(total_pago, 2),
        "a_pagar":        round(total_debito - total_credito - total_pago, 2),
        "lancamentos":    [_serial_lanc(l) for l in lancamentos],
    }


# ── Campos Livres ──────────────────────────────────────────────────────────────

@router.get("/campos-livres/{cliente_id}")
def listar_campos(cliente_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    campos = db.query(CampoLivreCliente).filter_by(cliente_id=cliente_id).all()
    return [{"id": c.id, "campo": c.campo, "valor": c.valor} for c in campos]


@router.post("/campos-livres")
def salvar_campo(body: dict, db: Session = Depends(get_db), _=Depends(get_current_user)):
    cliente_id = body.get("cliente_id"); campo = body.get("campo"); valor = body.get("valor")
    if not cliente_id or not campo: raise HTTPException(400, "cliente_id e campo obrigatórios")
    existing = db.query(CampoLivreCliente).filter_by(cliente_id=cliente_id, campo=campo).first()
    if existing:
        existing.valor = valor; db.commit()
        return {"id": existing.id, "campo": existing.campo, "valor": existing.valor}
    c = CampoLivreCliente(cliente_id=cliente_id, campo=campo, valor=valor)
    db.add(c); db.commit(); db.refresh(c)
    return {"id": c.id, "campo": c.campo, "valor": c.valor}


@router.delete("/campos-livres/{cid}")
def excluir_campo(cid: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(CampoLivreCliente).filter_by(id=cid).first()
    if not c: raise HTTPException(404, "Campo não encontrado")
    db.delete(c); db.commit()
    return {"ok": True}
