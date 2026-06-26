from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import CaixaAbertura, MovimentoCaixa, Venda
from utils.security import get_current_user
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date
from sqlalchemy import func

router = APIRouter(prefix="/caixa", tags=["caixa"])


class AbrirCaixaIn(BaseModel):
    terminal: Optional[str] = "CAIXA-01"
    fundo_caixa: Optional[float] = 0.0
    operador: Optional[str] = None

class MovCaixaIn(BaseModel):
    valor: float
    observacao: Optional[str] = None

class FecharCaixaIn(BaseModel):
    total_contado: Optional[float] = None
    observacao: Optional[str] = None


def _resumo_caixa(caixa: CaixaAbertura, db: Session) -> dict:
    # Vendas realizadas desde abertura
    abertura_date = caixa.aberto_em.date() if caixa.aberto_em else date.today()
    vendas = db.query(Venda).filter(
        Venda.data_venda >= abertura_date,
        Venda.status == "FINALIZADA"
    ).all()

    total_vendas = sum(v.total for v in vendas)
    por_forma: dict = {}
    for v in vendas:
        f = v.forma_pagamento
        por_forma[f] = por_forma.get(f, 0) + v.total

    # Movimentos (sangria/suprimento)
    movs = db.query(MovimentoCaixa).filter(MovimentoCaixa.caixa_id == caixa.id).all()
    total_sangria    = sum(m.valor for m in movs if m.tipo == "SANGRIA")
    total_suprimento = sum(m.valor for m in movs if m.tipo == "SUPRIMENTO")

    saldo_teorico = round(
        caixa.fundo_caixa
        + sum(v.total for v in vendas if v.forma_pagamento == "DINHEIRO")
        + total_suprimento
        - total_sangria,
        2
    )

    return {
        "id": caixa.id,
        "terminal": caixa.terminal,
        "fundo_caixa": caixa.fundo_caixa,
        "aberto_em": caixa.aberto_em.isoformat() if caixa.aberto_em else None,
        "fechado_em": caixa.fechado_em.isoformat() if caixa.fechado_em else None,
        "is_aberto": caixa.is_aberto,
        "total_vendas": round(total_vendas, 2),
        "qtd_vendas": len(vendas),
        "total_dinheiro": round(por_forma.get("DINHEIRO", 0), 2),
        "total_pix": round(por_forma.get("PIX", 0), 2),
        "total_credito": round(por_forma.get("CREDITO", 0), 2),
        "total_debito": round(por_forma.get("DEBITO", 0), 2),
        "total_outros": round(sum(v for k, v in por_forma.items() if k not in ("DINHEIRO","PIX","CREDITO","DEBITO")), 2),
        "total_sangria": round(total_sangria, 2),
        "total_suprimento": round(total_suprimento, 2),
        "saldo_teorico_dinheiro": saldo_teorico,
        "por_forma": {k: round(v, 2) for k, v in por_forma.items()},
        "movimentos": [
            {"tipo": m.tipo, "valor": m.valor, "observacao": m.observacao, "created_at": m.created_at.isoformat() if m.created_at else None}
            for m in movs
        ],
    }


@router.get("/status")
def status_caixa(db: Session = Depends(get_db), _=Depends(get_current_user)):
    caixa = db.query(CaixaAbertura).filter(CaixaAbertura.is_aberto == True).first()
    if not caixa:
        return {"aberto": False, "caixa": None}
    return {"aberto": True, "caixa": _resumo_caixa(caixa, db)}


@router.post("/abrir")
def abrir_caixa(data: AbrirCaixaIn, db: Session = Depends(get_db), u=Depends(get_current_user)):
    aberto = db.query(CaixaAbertura).filter(CaixaAbertura.is_aberto == True).first()
    if aberto:
        raise HTTPException(400, f"Já existe um caixa aberto: {aberto.terminal}")

    caixa = CaixaAbertura(
        terminal=data.terminal or "CAIXA-01",
        operador_num=u.id,
        fundo_caixa=data.fundo_caixa or 0,
        is_aberto=True,
    )
    db.add(caixa); db.flush()

    mov = MovimentoCaixa(
        caixa_id=caixa.id,
        tipo="ABERTURA",
        valor=data.fundo_caixa or 0,
        observacao="Abertura de caixa",
        operador=u.nome,
    )
    db.add(mov)
    db.commit(); db.refresh(caixa)
    return _resumo_caixa(caixa, db)


@router.post("/fechar")
def fechar_caixa(data: FecharCaixaIn, db: Session = Depends(get_db), u=Depends(get_current_user)):
    caixa = db.query(CaixaAbertura).filter(CaixaAbertura.is_aberto == True).first()
    if not caixa:
        raise HTTPException(400, "Nenhum caixa aberto")

    resumo = _resumo_caixa(caixa, db)
    diferenca = round((data.total_contado or 0) - resumo["saldo_teorico_dinheiro"], 2) if data.total_contado is not None else 0

    caixa.is_aberto = False
    caixa.fechado_em = datetime.now()
    caixa.total_vendas = resumo["total_vendas"]

    mov = MovimentoCaixa(
        caixa_id=caixa.id,
        tipo="FECHAMENTO",
        valor=data.total_contado or resumo["saldo_teorico_dinheiro"],
        observacao=f"Fechamento. Contado: {data.total_contado} | Teórico: {resumo['saldo_teorico_dinheiro']} | Dif: {diferenca}. {data.observacao or ''}",
        operador=u.nome,
    )
    db.add(mov)
    db.commit()

    return {**resumo, "diferenca": diferenca, "total_contado": data.total_contado, "is_aberto": False}


@router.post("/sangria")
def sangria(data: MovCaixaIn, db: Session = Depends(get_db), u=Depends(get_current_user)):
    caixa = db.query(CaixaAbertura).filter(CaixaAbertura.is_aberto == True).first()
    if not caixa:
        raise HTTPException(400, "Nenhum caixa aberto")
    if data.valor <= 0:
        raise HTTPException(400, "Valor deve ser positivo")

    mov = MovimentoCaixa(
        caixa_id=caixa.id,
        tipo="SANGRIA",
        valor=data.valor,
        observacao=data.observacao or "Sangria",
        operador=u.nome,
    )
    db.add(mov); db.commit()
    return {"ok": True, "tipo": "SANGRIA", "valor": data.valor}


@router.post("/suprimento")
def suprimento(data: MovCaixaIn, db: Session = Depends(get_db), u=Depends(get_current_user)):
    caixa = db.query(CaixaAbertura).filter(CaixaAbertura.is_aberto == True).first()
    if not caixa:
        raise HTTPException(400, "Nenhum caixa aberto")
    if data.valor <= 0:
        raise HTTPException(400, "Valor deve ser positivo")

    mov = MovimentoCaixa(
        caixa_id=caixa.id,
        tipo="SUPRIMENTO",
        valor=data.valor,
        observacao=data.observacao or "Suprimento",
        operador=u.nome,
    )
    db.add(mov); db.commit()
    return {"ok": True, "tipo": "SUPRIMENTO", "valor": data.valor}


@router.get("/historico")
def historico(limit: int = 30, db: Session = Depends(get_db), _=Depends(get_current_user)):
    caixas = db.query(CaixaAbertura).order_by(CaixaAbertura.aberto_em.desc()).limit(limit).all()
    return [_resumo_caixa(c, db) for c in caixas]
