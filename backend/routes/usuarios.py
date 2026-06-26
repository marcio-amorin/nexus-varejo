from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Usuario
from utils.security import get_current_user, get_password_hash
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/usuarios", tags=["usuarios"])

PERMISSOES_PADRAO = {
    "ADMIN":    ["pdv", "vendas", "compras", "estoque", "financeiro", "relatorios", "usuarios", "configuracoes"],
    "GERENTE":  ["pdv", "vendas", "compras", "estoque", "financeiro", "relatorios"],
    "OPERADOR": ["pdv", "vendas", "estoque"],
    "CAIXA":    ["pdv"],
}

class UsuarioCreate(BaseModel):
    nome: str
    email: str
    senha: str
    perfil: Optional[str] = "OPERADOR"
    permissoes: Optional[list] = None

class UsuarioUpdate(BaseModel):
    nome: Optional[str] = None
    email: Optional[str] = None
    senha: Optional[str] = None
    perfil: Optional[str] = None
    permissoes: Optional[list] = None
    is_active: Optional[bool] = None

def _dict(u: Usuario) -> dict:
    import json
    try:
        perms = json.loads(u.permissoes) if u.permissoes else PERMISSOES_PADRAO.get(u.perfil, [])
    except Exception:
        perms = PERMISSOES_PADRAO.get(u.perfil, [])
    return {
        "id": u.id,
        "nome": u.nome,
        "email": u.email,
        "perfil": u.perfil,
        "permissoes": perms,
        "is_active": u.is_active,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }

@router.get("/")
def list_usuarios(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return [_dict(u) for u in db.query(Usuario).order_by(Usuario.nome).all()]

@router.get("/perfis")
def perfis(_=Depends(get_current_user)):
    return [
        {"perfil": "ADMIN",    "label": "Administrador",  "permissoes": PERMISSOES_PADRAO["ADMIN"]},
        {"perfil": "GERENTE",  "label": "Gerente",         "permissoes": PERMISSOES_PADRAO["GERENTE"]},
        {"perfil": "OPERADOR", "label": "Operador",        "permissoes": PERMISSOES_PADRAO["OPERADOR"]},
        {"perfil": "CAIXA",    "label": "Operador de Caixa","permissoes": PERMISSOES_PADRAO["CAIXA"]},
    ]

@router.post("/")
def create_usuario(data: UsuarioCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    import json
    if db.query(Usuario).filter(Usuario.email == data.email).first():
        raise HTTPException(400, "E-mail já cadastrado")
    perms = data.permissoes or PERMISSOES_PADRAO.get(data.perfil, [])
    u = Usuario(
        nome=data.nome,
        email=data.email,
        senha_hash=get_password_hash(data.senha),
        perfil=data.perfil or "OPERADOR",
        permissoes=json.dumps(perms),
        is_active=True,
    )
    db.add(u); db.commit(); db.refresh(u)
    return _dict(u)

@router.put("/{uid}")
def update_usuario(uid: int, data: UsuarioUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    import json
    u = db.query(Usuario).filter(Usuario.id == uid).first()
    if not u: raise HTTPException(404, "Usuário não encontrado")
    if data.nome is not None:     u.nome = data.nome
    if data.email is not None:    u.email = data.email
    if data.perfil is not None:   u.perfil = data.perfil
    if data.is_active is not None: u.is_active = data.is_active
    if data.senha:                u.senha_hash = get_password_hash(data.senha)
    if data.permissoes is not None: u.permissoes = json.dumps(data.permissoes)
    db.commit(); db.refresh(u)
    return _dict(u)

@router.delete("/{uid}")
def delete_usuario(uid: int, db: Session = Depends(get_db), current=Depends(get_current_user)):
    u = db.query(Usuario).filter(Usuario.id == uid).first()
    if not u: raise HTTPException(404, "Usuário não encontrado")
    if u.id == current.id: raise HTTPException(400, "Não é possível desativar seu próprio usuário")
    u.is_active = False
    db.commit()
    return {"ok": True}
