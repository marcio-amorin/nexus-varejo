from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Fornecedor, FornecedorRepresentante
from utils.security import get_current_user
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter(prefix="/fornecedores", tags=["fornecedores"])


class FornecedorCreate(BaseModel):
    razao_social: str
    fantasia: Optional[str] = None
    cnpj_cpf: Optional[str] = None
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
    observacoes:        Optional[str] = None
    vendedor_nome:      Optional[str] = None
    vendedor_telefone:  Optional[str] = None
    prazo_pagamento:    Optional[str] = None


def _dict(f: Fornecedor) -> dict:
    return {
        "id": f.id,
        "razao_social": f.razao_social,
        "fantasia": f.fantasia,
        "cnpj_cpf": f.cnpj_cpf,
        "ie": f.ie,
        "email": f.email,
        "telefone": f.telefone,
        "celular": f.celular,
        "rua": f.rua,
        "numero": f.numero,
        "complemento": f.complemento,
        "bairro": f.bairro,
        "cidade": f.cidade,
        "estado": f.estado,
        "cep": f.cep,
        "observacoes": f.observacoes,
        "vendedor_nome":      getattr(f, "vendedor_nome", None),
        "vendedor_telefone":  getattr(f, "vendedor_telefone", None),
        "prazo_pagamento":    getattr(f, "prazo_pagamento", None),
        "is_active": f.is_active,
        "created_at": f.created_at.isoformat() if f.created_at else None,
    }


@router.get("/")
def list_fornecedores(busca: Optional[str] = None, db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(Fornecedor).filter(Fornecedor.is_active == True)
    if busca:
        like = f"%{busca}%"
        q = q.filter(
            (Fornecedor.razao_social.ilike(like)) |
            (Fornecedor.fantasia.ilike(like)) |
            (Fornecedor.cnpj_cpf.ilike(like))
        )
    return [_dict(f) for f in q.order_by(Fornecedor.razao_social).all()]


@router.get("/{forn_id}")
def get_fornecedor(forn_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    f = db.query(Fornecedor).filter(Fornecedor.id == forn_id).first()
    if not f:
        raise HTTPException(404, "Fornecedor não encontrado")
    return _dict(f)


@router.post("/")
def create_fornecedor(data: FornecedorCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    f = Fornecedor(**data.dict())
    db.add(f); db.commit(); db.refresh(f)
    return _dict(f)


@router.put("/{forn_id}")
def update_fornecedor(forn_id: int, data: FornecedorCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    f = db.query(Fornecedor).filter(Fornecedor.id == forn_id).first()
    if not f:
        raise HTTPException(404, "Fornecedor não encontrado")
    for k, v in data.dict(exclude_unset=True).items():
        setattr(f, k, v)
    db.commit(); db.refresh(f)
    return _dict(f)


@router.delete("/{forn_id}")
def delete_fornecedor(forn_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    f = db.query(Fornecedor).filter(Fornecedor.id == forn_id).first()
    if not f:
        raise HTTPException(404, "Fornecedor não encontrado")
    f.is_active = False
    db.commit()
    return {"ok": True}


# ─── Representantes ───────────────────────────────────────────────────────────

class RepresentanteSchema(BaseModel):
    nome:      str
    telefone:  Optional[str] = None
    email:     Optional[str] = None
    divisao:   Optional[str] = None
    principal: bool = False

class RepresentanteSync(BaseModel):
    representantes: List[RepresentanteSchema]


@router.get("/{forn_id}/representantes")
def get_representantes(forn_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    reps = db.query(FornecedorRepresentante).filter(FornecedorRepresentante.fornecedor_id == forn_id).all()
    return [{"id":r.id,"nome":r.nome,"telefone":r.telefone,"email":r.email,"divisao":r.divisao,"principal":r.principal} for r in reps]


@router.post("/{forn_id}/representantes/sync")
def sync_representantes(forn_id: int, body: RepresentanteSync, db: Session = Depends(get_db), _=Depends(get_current_user)):
    db.query(FornecedorRepresentante).filter(FornecedorRepresentante.fornecedor_id == forn_id).delete()
    for r in body.representantes:
        db.add(FornecedorRepresentante(fornecedor_id=forn_id, **r.dict()))
    db.commit()
    return {"ok": True}
