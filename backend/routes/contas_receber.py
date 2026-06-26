from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import ContaReceber
from utils.security import get_current_user
from pydantic import BaseModel
from typing import Optional
from datetime import date

router = APIRouter(prefix="/contas-receber", tags=["contas_receber"])


class ContaReceberCreate(BaseModel):
    cliente_id: Optional[int] = None
    descricao: str
    valor: float
    vencimento: date
    parcela_num: Optional[int] = 1
    total_parcelas: Optional[int] = 1
    observacoes: Optional[str] = None

class BaixaContaReceber(BaseModel):
    recebido_em: date
    valor_recebido: Optional[float] = None
    forma_pagamento: Optional[str] = "DINHEIRO"


def _dict(c: ContaReceber) -> dict:
    return {
        "id": c.id,
        "cliente_id": c.cliente_id,
        "cliente_nome": c.cliente.nome if c.cliente else None,
        "venda_id": c.venda_id,
        "descricao": c.descricao,
        "valor": c.valor,
        "vencimento": str(c.vencimento),
        "status": c.status,
        "forma_pagamento": c.forma_pagamento,
        "recebido_em": str(c.recebido_em) if c.recebido_em else None,
        "valor_recebido": c.valor_recebido,
        "parcela_num": c.parcela_num,
        "total_parcelas": c.total_parcelas,
        "observacoes": c.observacoes,
        "vencida": c.status == "PENDENTE" and c.vencimento < date.today(),
    }


@router.get("/")
def list_contas(
    status: Optional[str] = None,
    cliente_id: Optional[int] = None,
    vencimento_ini: Optional[date] = None,
    vencimento_fim: Optional[date] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(ContaReceber)
    if status:
        q = q.filter(ContaReceber.status == status)
    else:
        q = q.filter(ContaReceber.status != "CANCELADO")
    if cliente_id:
        q = q.filter(ContaReceber.cliente_id == cliente_id)
    if vencimento_ini:
        q = q.filter(ContaReceber.vencimento >= vencimento_ini)
    if vencimento_fim:
        q = q.filter(ContaReceber.vencimento <= vencimento_fim)
    contas = q.order_by(ContaReceber.vencimento).all()
    for c in contas:
        if c.status == "PENDENTE" and c.vencimento < date.today():
            c.status = "VENCIDO"
    db.commit()
    return [_dict(c) for c in contas]


@router.get("/stats")
def stats(db: Session = Depends(get_db), _=Depends(get_current_user)):
    hoje = date.today()
    contas = db.query(ContaReceber).filter(ContaReceber.status.in_(["PENDENTE", "VENCIDO"])).all()
    return {
        "total_pendente": round(sum(c.valor for c in contas), 2),
        "vencidas": round(sum(c.valor for c in contas if c.vencimento < hoje), 2),
        "a_vencer_30": round(sum(c.valor for c in contas if c.vencimento >= hoje), 2),
        "quantidade": len(contas),
    }


@router.post("/")
def create_conta(data: ContaReceberCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = ContaReceber(**data.dict())
    db.add(c); db.commit(); db.refresh(c)
    return _dict(c)


@router.put("/{conta_id}/baixa")
def baixar_conta(conta_id: int, data: BaixaContaReceber, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(ContaReceber).filter(ContaReceber.id == conta_id).first()
    if not c:
        raise HTTPException(404, "Conta não encontrada")
    c.recebido_em = data.recebido_em
    c.valor_recebido = data.valor_recebido or c.valor
    c.forma_pagamento = data.forma_pagamento
    c.status = "RECEBIDO"
    db.commit(); db.refresh(c)
    return _dict(c)


@router.delete("/{conta_id}")
def cancelar_conta(conta_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(ContaReceber).filter(ContaReceber.id == conta_id).first()
    if not c:
        raise HTTPException(404, "Conta não encontrada")
    c.status = "CANCELADO"
    db.commit()
    return {"ok": True}
