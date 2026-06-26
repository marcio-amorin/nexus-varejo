from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import ContaPagar
from utils.security import get_current_user
from pydantic import BaseModel
from typing import Optional
from datetime import date

router = APIRouter(prefix="/contas-pagar", tags=["contas_pagar"])


class ContaPagarCreate(BaseModel):
    fornecedor_id: Optional[int] = None
    descricao: str
    valor: float
    vencimento: date
    parcela_num: Optional[int] = 1
    total_parcelas: Optional[int] = 1
    observacoes: Optional[str] = None

class BaixaContaPagar(BaseModel):
    pago_em: date
    valor_pago: Optional[float] = None
    forma_pagamento: Optional[str] = "DINHEIRO"


def _dict(c: ContaPagar) -> dict:
    return {
        "id": c.id,
        "fornecedor_id": c.fornecedor_id,
        "fornecedor_nome": c.fornecedor.razao_social if c.fornecedor else None,
        "nf_id": c.nf_id,
        "descricao": c.descricao,
        "valor": c.valor,
        "vencimento": str(c.vencimento),
        "status": c.status,
        "forma_pagamento": c.forma_pagamento,
        "pago_em": str(c.pago_em) if c.pago_em else None,
        "valor_pago": c.valor_pago,
        "parcela_num": c.parcela_num,
        "total_parcelas": c.total_parcelas,
        "observacoes": c.observacoes,
        "vencida": c.status == "PENDENTE" and c.vencimento < date.today(),
    }


@router.get("/")
def list_contas(
    status: Optional[str] = None,
    fornecedor_id: Optional[int] = None,
    vencimento_ini: Optional[date] = None,
    vencimento_fim: Optional[date] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(ContaPagar)
    if status:
        q = q.filter(ContaPagar.status == status)
    else:
        q = q.filter(ContaPagar.status != "CANCELADO")
    if fornecedor_id:
        q = q.filter(ContaPagar.fornecedor_id == fornecedor_id)
    if vencimento_ini:
        q = q.filter(ContaPagar.vencimento >= vencimento_ini)
    if vencimento_fim:
        q = q.filter(ContaPagar.vencimento <= vencimento_fim)
    contas = q.order_by(ContaPagar.vencimento).all()
    # atualizar vencidas
    for c in contas:
        if c.status == "PENDENTE" and c.vencimento < date.today():
            c.status = "VENCIDO"
    db.commit()
    return [_dict(c) for c in contas]


@router.get("/stats")
def stats(db: Session = Depends(get_db), _=Depends(get_current_user)):
    hoje = date.today()
    contas = db.query(ContaPagar).filter(ContaPagar.status.in_(["PENDENTE", "VENCIDO"])).all()
    return {
        "total_pendente": round(sum(c.valor for c in contas), 2),
        "vencidas": round(sum(c.valor for c in contas if c.vencimento < hoje), 2),
        "a_vencer_30": round(sum(c.valor for c in contas if c.vencimento >= hoje), 2),
        "quantidade": len(contas),
    }


@router.post("/")
def create_conta(data: ContaPagarCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = ContaPagar(**data.dict())
    db.add(c); db.commit(); db.refresh(c)
    return _dict(c)


@router.put("/{conta_id}/baixa")
def baixar_conta(conta_id: int, data: BaixaContaPagar, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(ContaPagar).filter(ContaPagar.id == conta_id).first()
    if not c:
        raise HTTPException(404, "Conta não encontrada")
    c.pago_em = data.pago_em
    c.valor_pago = data.valor_pago or c.valor
    c.forma_pagamento = data.forma_pagamento
    c.status = "PAGO"
    db.commit(); db.refresh(c)
    return _dict(c)


@router.delete("/{conta_id}")
def cancelar_conta(conta_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(ContaPagar).filter(ContaPagar.id == conta_id).first()
    if not c:
        raise HTTPException(404, "Conta não encontrada")
    c.status = "CANCELADO"
    db.commit()
    return {"ok": True}
