from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
from models import FormaRecebimento

router = APIRouter(prefix="/formas-recebimento", tags=["formas-recebimento"])


class FormaSchema(BaseModel):
    nome:                str
    chave:               str
    icone:               str   = "💳"
    cor:                 str   = "#6366f1"
    ativo:               bool  = True
    ordem:               int   = 0
    aceita_troco:        bool  = False
    gera_conta_receber:  bool  = False
    vencimento_dias:     int   = 0


@router.get("/")
def listar(db: Session = Depends(get_db)):
    return db.query(FormaRecebimento).order_by(FormaRecebimento.ordem, FormaRecebimento.id).all()


@router.post("/")
def criar(body: FormaSchema, db: Session = Depends(get_db)):
    if db.query(FormaRecebimento).filter(FormaRecebimento.chave == body.chave.upper()).first():
        raise HTTPException(400, "Chave já existe")
    f = FormaRecebimento(**body.model_dump(), chave=body.chave.upper(), is_sistema=False)
    db.add(f); db.commit(); db.refresh(f)
    return f


@router.put("/{fid}")
def atualizar(fid: int, body: FormaSchema, db: Session = Depends(get_db)):
    f = db.query(FormaRecebimento).filter(FormaRecebimento.id == fid).first()
    if not f:
        raise HTTPException(404, "Não encontrada")
    f.nome               = body.nome
    f.icone              = body.icone
    f.cor                = body.cor
    f.ativo              = body.ativo
    f.ordem              = body.ordem
    f.aceita_troco       = body.aceita_troco
    f.gera_conta_receber = body.gera_conta_receber
    f.vencimento_dias    = body.vencimento_dias
    if not f.is_sistema:
        f.chave          = body.chave.upper()
    db.commit(); db.refresh(f)
    return f


@router.delete("/{fid}")
def excluir(fid: int, db: Session = Depends(get_db)):
    f = db.query(FormaRecebimento).filter(FormaRecebimento.id == fid).first()
    if not f:
        raise HTTPException(404, "Não encontrada")
    if f.is_sistema:
        raise HTTPException(400, "Formas padrão do sistema não podem ser excluídas")
    db.delete(f); db.commit()
    return {"ok": True}
