from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Comprador, CategoriaProduto
from utils.security import get_current_user, get_password_hash, verify_password
from pydantic import BaseModel
from typing import Optional, List
import json

router = APIRouter(prefix="/compradores", tags=["compradores"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class CompradorCreate(BaseModel):
    nome: str
    cpf: Optional[str] = None
    email: Optional[str] = None
    telefone: Optional[str] = None
    celular: Optional[str] = None
    cargo: Optional[str] = None
    departamento: Optional[str] = None
    pin: Optional[str] = None                     # PIN em texto plano (será hasheado)
    categorias_ids: Optional[List[int]] = []
    limite_compra_valor: Optional[float] = 0.0
    nivel_aprovacao: Optional[int] = 1
    pode_aprovar_acima: Optional[float] = 0.0
    observacoes: Optional[str] = None

class LoginPinSchema(BaseModel):
    pin: str


# ─── Helper ───────────────────────────────────────────────────────────────────

def _dict(c: Comprador, categorias_map: dict = None) -> dict:
    ids = []
    try:
        ids = json.loads(c.categorias_ids) if c.categorias_ids else []
    except Exception:
        pass
    cats = []
    if categorias_map and ids:
        cats = [categorias_map[i] for i in ids if i in categorias_map]
    return {
        "id": c.id,
        "nome": c.nome,
        "cpf": c.cpf,
        "email": c.email,
        "telefone": c.telefone,
        "celular": c.celular,
        "cargo": c.cargo,
        "departamento": c.departamento,
        "tem_pin": bool(c.pin_hash),
        "categorias_ids": ids,
        "categorias_nomes": cats,
        "limite_compra_valor": c.limite_compra_valor or 0.0,
        "nivel_aprovacao": c.nivel_aprovacao or 1,
        "pode_aprovar_acima": c.pode_aprovar_acima or 0.0,
        "is_active": c.is_active,
        "observacoes": c.observacoes,
        "ultimo_acesso": c.ultimo_acesso.isoformat() if c.ultimo_acesso else None,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


def _cat_map(db: Session) -> dict:
    cats = db.query(CategoriaProduto).filter(CategoriaProduto.is_active == True).all()
    return {cat.id: cat.nome for cat in cats}


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/")
def list_compradores(
    busca: Optional[str] = None,
    ativo: Optional[bool] = True,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Comprador)
    if ativo is not None:
        q = q.filter(Comprador.is_active == ativo)
    if busca:
        like = f"%{busca}%"
        q = q.filter(
            (Comprador.nome.ilike(like)) |
            (Comprador.cpf.ilike(like)) |
            (Comprador.email.ilike(like)) |
            (Comprador.cargo.ilike(like)) |
            (Comprador.departamento.ilike(like))
        )
    cmap = _cat_map(db)
    return [_dict(c, cmap) for c in q.order_by(Comprador.nome).all()]


@router.get("/categorias")
def list_categorias(db: Session = Depends(get_db), _=Depends(get_current_user)):
    cats = db.query(CategoriaProduto).filter(CategoriaProduto.is_active == True).order_by(CategoriaProduto.nome).all()
    return [{"id": c.id, "nome": c.nome, "icone": c.icone, "cor": c.cor} for c in cats]


@router.get("/{comp_id}")
def get_comprador(comp_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(Comprador).filter(Comprador.id == comp_id).first()
    if not c:
        raise HTTPException(404, "Comprador não encontrado")
    return _dict(c, _cat_map(db))


@router.post("/")
def create_comprador(data: CompradorCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    payload = data.dict(exclude={"pin", "categorias_ids"})
    payload["categorias_ids"] = json.dumps(data.categorias_ids or [])
    if data.pin:
        if len(data.pin) < 4:
            raise HTTPException(400, "PIN deve ter no mínimo 4 dígitos")
        payload["pin_hash"] = get_password_hash(data.pin)
    c = Comprador(**payload)
    db.add(c); db.commit(); db.refresh(c)
    return _dict(c, _cat_map(db))


@router.put("/{comp_id}")
def update_comprador(comp_id: int, data: CompradorCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(Comprador).filter(Comprador.id == comp_id).first()
    if not c:
        raise HTTPException(404, "Comprador não encontrado")
    fields = data.dict(exclude={"pin", "categorias_ids"}, exclude_unset=True)
    for k, v in fields.items():
        setattr(c, k, v)
    c.categorias_ids = json.dumps(data.categorias_ids or [])
    if data.pin is not None:
        if data.pin == "":
            c.pin_hash = None    # Remove PIN
        else:
            if len(data.pin) < 4:
                raise HTTPException(400, "PIN deve ter no mínimo 4 dígitos")
            c.pin_hash = get_password_hash(data.pin)
    db.commit(); db.refresh(c)
    return _dict(c, _cat_map(db))


@router.delete("/{comp_id}")
def delete_comprador(comp_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(Comprador).filter(Comprador.id == comp_id).first()
    if not c:
        raise HTTPException(404, "Comprador não encontrado")
    c.is_active = False
    db.commit()
    return {"ok": True}


@router.post("/{comp_id}/login-pin")
def login_pin(comp_id: int, body: LoginPinSchema, db: Session = Depends(get_db)):
    """Autenticação por PIN para acesso ao módulo de pedido de compra."""
    c = db.query(Comprador).filter(Comprador.id == comp_id, Comprador.is_active == True).first()
    if not c:
        raise HTTPException(404, "Comprador não encontrado")
    if not c.pin_hash:
        raise HTTPException(400, "Comprador sem PIN cadastrado")
    if not verify_password(body.pin, c.pin_hash):
        raise HTTPException(401, "PIN inválido")
    from datetime import datetime, timezone
    c.ultimo_acesso = datetime.now(timezone.utc)
    db.commit()
    return {
        "ok": True,
        "comprador": _dict(c, _cat_map(db)),
    }


@router.post("/verificar-pin")
def verificar_pin(body: LoginPinSchema, db: Session = Depends(get_db)):
    """Verifica PIN sem saber o ID — busca pelo PIN (uso no PDV/compras)."""
    compradores = db.query(Comprador).filter(Comprador.is_active == True, Comprador.pin_hash != None).all()
    for c in compradores:
        if verify_password(body.pin, c.pin_hash):
            from datetime import datetime, timezone
            c.ultimo_acesso = datetime.now(timezone.utc)
            db.commit()
            return {"ok": True, "comprador": _dict(c, _cat_map(db))}
    raise HTTPException(401, "PIN não reconhecido")
