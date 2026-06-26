from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from database import get_db
from models import Usuario
from utils.security import verify_password, create_access_token, get_password_hash, get_current_user
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/auth", tags=["auth"])


class UsuarioCreate(BaseModel):
    nome: str
    email: str
    senha: str
    perfil: Optional[str] = "OPERADOR"


class SenhaUpdate(BaseModel):
    senha_atual: str
    nova_senha: str


@router.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(Usuario).filter(
        (Usuario.email == form.username) | (Usuario.nome == form.username)
    ).first()
    if not user or not verify_password(form.password, user.senha_hash):
        raise HTTPException(status_code=401, detail="Usuário ou senha incorretos")
    if not user.is_active:
        raise HTTPException(status_code=401, detail="Usuário inativo")
    token = create_access_token({"sub": str(user.id), "nome": user.nome, "perfil": user.perfil})
    return {"access_token": token, "token_type": "bearer", "nome": user.nome, "perfil": user.perfil}


@router.get("/me")
def me(user: Usuario = Depends(get_current_user)):
    return {"id": user.id, "nome": user.nome, "email": user.email, "perfil": user.perfil}


@router.post("/usuarios")
def criar_usuario(data: UsuarioCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    if db.query(Usuario).filter(Usuario.email == data.email).first():
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")
    u = Usuario(nome=data.nome, email=data.email,
                senha_hash=get_password_hash(data.senha), perfil=data.perfil)
    db.add(u); db.commit(); db.refresh(u)
    return {"id": u.id, "nome": u.nome, "email": u.email, "perfil": u.perfil}


@router.get("/usuarios")
def listar_usuarios(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return [{"id": u.id, "nome": u.nome, "email": u.email, "perfil": u.perfil, "is_active": u.is_active}
            for u in db.query(Usuario).order_by(Usuario.nome).all()]


@router.put("/senha")
def alterar_senha(data: SenhaUpdate, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    if not verify_password(data.senha_atual, user.senha_hash):
        raise HTTPException(status_code=400, detail="Senha atual incorreta")
    user.senha_hash = get_password_hash(data.nova_senha)
    db.commit()
    return {"ok": True}
