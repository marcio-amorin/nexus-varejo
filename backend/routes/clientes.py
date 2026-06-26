from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Cliente
from utils.security import get_current_user
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/clientes", tags=["clientes"])


class ClienteCreate(BaseModel):
    nome: str
    tipo: Optional[str] = "PF"
    documento: Optional[str] = None
    ie: Optional[str] = None
    email: Optional[str] = None
    telefone: Optional[str] = None
    celular: Optional[str] = None
    rua: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    cep: Optional[str] = None
    limite_credito: Optional[float] = 0.0
    credito_rotativo: Optional[float] = 0.0
    observacoes: Optional[str] = None


def _dict(c: Cliente) -> dict:
    return {
        "id": c.id,
        "nome": c.nome,
        "tipo": c.tipo,
        "documento": c.documento,
        "ie": c.ie,
        "email": c.email,
        "telefone": c.telefone,
        "celular": c.celular,
        "rua": c.rua,
        "numero": c.numero,
        "complemento": c.complemento,
        "bairro": c.bairro,
        "cidade": c.cidade,
        "estado": c.estado,
        "cep": c.cep,
        "limite_credito": c.limite_credito,
        "credito_rotativo": getattr(c, "credito_rotativo", 0.0) or 0.0,
        "observacoes": c.observacoes,
        "is_active": c.is_active,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


@router.get("/")
def list_clientes(busca: Optional[str] = None, codigo: Optional[str] = None, limit: Optional[int] = 100, db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(Cliente).filter(Cliente.is_active == True)
    if codigo:
        try:
            q = q.filter(Cliente.id == int(codigo))
        except ValueError:
            return []
    elif busca:
        like = f"%{busca}%"
        q = q.filter(
            (Cliente.nome.ilike(like)) |
            (Cliente.documento.ilike(like)) |
            (Cliente.telefone.ilike(like)) |
            (Cliente.celular.ilike(like))
        )
    return [_dict(c) for c in q.order_by(Cliente.nome).limit(limit).all()]


@router.get("/{cli_id}")
def get_cliente(cli_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(Cliente).filter(Cliente.id == cli_id).first()
    if not c:
        raise HTTPException(404, "Cliente não encontrado")
    return _dict(c)


@router.post("/")
def create_cliente(data: ClienteCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = Cliente(**data.dict())
    db.add(c); db.commit(); db.refresh(c)
    return _dict(c)


@router.put("/{cli_id}")
def update_cliente(cli_id: int, data: ClienteCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(Cliente).filter(Cliente.id == cli_id).first()
    if not c:
        raise HTTPException(404, "Cliente não encontrado")
    for k, v in data.dict(exclude_unset=True).items():
        setattr(c, k, v)
    db.commit(); db.refresh(c)
    return _dict(c)


@router.delete("/{cli_id}")
def delete_cliente(cli_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(Cliente).filter(Cliente.id == cli_id).first()
    if not c:
        raise HTTPException(404, "Cliente não encontrado")
    c.is_active = False
    db.commit()
    return {"ok": True}
