from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import ContaCorrente, MovimentoConta, TaxaCartao
from utils.security import get_current_user
from pydantic import BaseModel
from typing import Optional, List
from datetime import date

router = APIRouter(prefix="/contas-correntes", tags=["contas-correntes"])


def _serial_conta(c: ContaCorrente) -> dict:
    return {
        "id":            c.id,
        "nome":          c.nome,
        "banco":         c.banco,
        "agencia":       c.agencia,
        "conta":         c.conta,
        "tipo":          c.tipo,
        "saldo_inicial": c.saldo_inicial,
        "saldo_atual":   c.saldo_atual,
        "ativo":         c.ativo,
        "cor":           getattr(c, "cor", "#6366f1") or "#6366f1",
        "icone":         getattr(c, "icone", "🏦") or "🏦",
        "observacoes":   c.observacoes,
        "created_at":    c.created_at.isoformat() if c.created_at else None,
    }


def _serial_mov(m: MovimentoConta) -> dict:
    return {
        "id":         m.id,
        "conta_id":   m.conta_id,
        "tipo":       m.tipo,
        "valor":      m.valor,
        "saldo_apos": m.saldo_apos,
        "descricao":  m.descricao,
        "data":       m.data.isoformat() if m.data else None,
        "origem":     m.origem,
        "origem_id":  m.origem_id,
        "usuario":    m.usuario,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


def _serial_taxa(t: TaxaCartao) -> dict:
    return {
        "id":               t.id,
        "nome":             t.nome,
        "bandeira":         t.bandeira,
        "modalidade":       t.modalidade,
        "taxa_pct":         t.taxa_pct,
        "prazo_liquidacao": t.prazo_liquidacao,
        "conta_id":         t.conta_id,
        "conta_nome":       t.conta.nome if t.conta else None,
        "ativo":            t.ativo,
    }


# ── Contas ────────────────────────────────────────────────────────────────────

class ContaSchema(BaseModel):
    nome:          str
    banco:         Optional[str] = None
    agencia:       Optional[str] = None
    conta:         Optional[str] = None
    tipo:          str = "CORRENTE"
    saldo_inicial: float = 0.0
    ativo:         bool = True
    cor:           str = "#6366f1"
    icone:         str = "🏦"
    observacoes:   Optional[str] = None


@router.get("")
def listar_contas(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return [_serial_conta(c) for c in db.query(ContaCorrente).order_by(ContaCorrente.nome).all()]


@router.post("")
def criar_conta(data: ContaSchema, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = ContaCorrente(
        nome=data.nome, banco=data.banco, agencia=data.agencia, conta=data.conta,
        tipo=data.tipo, saldo_inicial=data.saldo_inicial, saldo_atual=data.saldo_inicial,
        ativo=data.ativo, cor=data.cor, icone=data.icone, observacoes=data.observacoes,
    )
    db.add(c); db.commit(); db.refresh(c)
    return _serial_conta(c)


@router.put("/{cid}")
def atualizar_conta(cid: int, data: ContaSchema, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(ContaCorrente).filter_by(id=cid).first()
    if not c: raise HTTPException(404, "Conta não encontrada")
    for k, v in data.dict().items():
        if hasattr(c, k):
            setattr(c, k, v)
    db.commit(); db.refresh(c)
    return _serial_conta(c)


@router.delete("/{cid}")
def excluir_conta(cid: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(ContaCorrente).filter_by(id=cid).first()
    if not c: raise HTTPException(404, "Conta não encontrada")
    db.delete(c); db.commit()
    return {"ok": True}


# ── Movimentos ────────────────────────────────────────────────────────────────

class MovimentoSchema(BaseModel):
    conta_id:  int
    tipo:      str   # ENTRADA | SAIDA
    valor:     float
    descricao: str
    data:      str
    origem:    Optional[str] = "MANUAL"
    usuario:   Optional[str] = None


@router.get("/{cid}/movimentos")
def listar_movimentos(cid: int, limit: int = 100, db: Session = Depends(get_db), _=Depends(get_current_user)):
    movs = (db.query(MovimentoConta)
            .filter(MovimentoConta.conta_id == cid)
            .order_by(MovimentoConta.id.desc())
            .limit(limit).all())
    return [_serial_mov(m) for m in movs]


@router.post("/movimentos")
def lancar_movimento(data: MovimentoSchema, db: Session = Depends(get_db), _=Depends(get_current_user)):
    conta = db.query(ContaCorrente).filter_by(id=data.conta_id).first()
    if not conta: raise HTTPException(404, "Conta não encontrada")

    if data.tipo.upper() == "ENTRADA":
        conta.saldo_atual += data.valor
    else:
        conta.saldo_atual -= data.valor

    mov = MovimentoConta(
        conta_id=data.conta_id,
        tipo=data.tipo.upper(),
        valor=abs(data.valor),
        saldo_apos=conta.saldo_atual,
        descricao=data.descricao,
        data=date.fromisoformat(data.data),
        origem=data.origem or "MANUAL",
        usuario=data.usuario,
    )
    db.add(mov); db.commit(); db.refresh(mov)
    return _serial_mov(mov)


# ── Taxas de Cartão ───────────────────────────────────────────────────────────

class TaxaSchema(BaseModel):
    nome:             str
    bandeira:         Optional[str] = None
    modalidade:       str
    taxa_pct:         float = 0.0
    prazo_liquidacao: int   = 1
    conta_id:         Optional[int] = None
    ativo:            bool = True


@router.get("/taxas-cartao")
def listar_taxas(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return [_serial_taxa(t) for t in db.query(TaxaCartao).order_by(TaxaCartao.bandeira, TaxaCartao.modalidade).all()]


@router.post("/taxas-cartao")
def criar_taxa(data: TaxaSchema, db: Session = Depends(get_db), _=Depends(get_current_user)):
    t = TaxaCartao(**data.dict())
    db.add(t); db.commit(); db.refresh(t)
    return _serial_taxa(t)


@router.put("/taxas-cartao/{tid}")
def atualizar_taxa(tid: int, data: TaxaSchema, db: Session = Depends(get_db), _=Depends(get_current_user)):
    t = db.query(TaxaCartao).filter_by(id=tid).first()
    if not t: raise HTTPException(404, "Taxa não encontrada")
    for k, v in data.dict().items():
        setattr(t, k, v)
    db.commit(); db.refresh(t)
    return _serial_taxa(t)


@router.delete("/taxas-cartao/{tid}")
def excluir_taxa(tid: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    t = db.query(TaxaCartao).filter_by(id=tid).first()
    if not t: raise HTTPException(404, "Taxa não encontrada")
    db.delete(t); db.commit()
    return {"ok": True}
