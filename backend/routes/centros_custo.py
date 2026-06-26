from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import CentroCusto, MovimentoEstoque, Produto
from utils.security import get_current_user
from pydantic import BaseModel
from typing import Optional
from datetime import date

router = APIRouter(prefix="/centros-custo", tags=["centros_custo"])

class CCCreate(BaseModel):
    codigo: str
    nome: str
    departamento: Optional[str] = None
    descricao: Optional[str] = None

class MovManualCreate(BaseModel):
    produto_id: int
    tipo: str           # SAIDA | ENTRADA
    quantidade: float
    centro_custo_id: int
    observacao: Optional[str] = None
    custo_unitario: Optional[float] = None

def _cc_dict(c: CentroCusto) -> dict:
    return {"id": c.id, "codigo": c.codigo, "nome": c.nome,
            "departamento": c.departamento, "descricao": c.descricao,
            "is_active": c.is_active,
            "created_at": c.created_at.isoformat() if c.created_at else None}

@router.get("/")
def list_cc(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return [_cc_dict(c) for c in db.query(CentroCusto).filter(CentroCusto.is_active == True).order_by(CentroCusto.nome).all()]

@router.post("/")
def create_cc(data: CCCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    if db.query(CentroCusto).filter(CentroCusto.codigo == data.codigo.upper()).first():
        raise HTTPException(400, "Código já cadastrado")
    c = CentroCusto(codigo=data.codigo.upper(), nome=data.nome,
                    departamento=data.departamento, descricao=data.descricao)
    db.add(c); db.commit(); db.refresh(c)
    return _cc_dict(c)

@router.put("/{cid}")
def update_cc(cid: int, data: CCCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(CentroCusto).filter(CentroCusto.id == cid).first()
    if not c: raise HTTPException(404, "Centro de custo não encontrado")
    c.codigo = data.codigo.upper(); c.nome = data.nome
    c.departamento = data.departamento; c.descricao = data.descricao
    db.commit(); return _cc_dict(c)

@router.delete("/{cid}")
def delete_cc(cid: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(CentroCusto).filter(CentroCusto.id == cid).first()
    if not c: raise HTTPException(404)
    c.is_active = False; db.commit(); return {"ok": True}

@router.post("/movimento-manual")
def movimento_manual(data: MovManualCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    prod = db.query(Produto).filter(Produto.id == data.produto_id).first()
    if not prod: raise HTTPException(404, "Produto não encontrado")
    cc = db.query(CentroCusto).filter(CentroCusto.id == data.centro_custo_id).first()
    if not cc: raise HTTPException(404, "Centro de custo não encontrado")

    custo = data.custo_unitario if data.custo_unitario is not None else prod.preco_custo
    if data.tipo == "SAIDA":
        if prod.estoque_atual < data.quantidade:
            raise HTTPException(400, f"Estoque insuficiente: {prod.estoque_atual} {prod.unidade}")
        prod.estoque_atual = round(prod.estoque_atual - data.quantidade, 4)
    else:
        prod.estoque_atual = round(prod.estoque_atual + data.quantidade, 4)

    mov = MovimentoEstoque(
        produto_id=prod.id,
        tipo=data.tipo,
        quantidade=data.quantidade,
        custo_unitario=custo,
        valor_total=round(data.quantidade * custo, 2),
        data=date.today(),
        origem="MANUAL_CC",
        documento_ref=cc.codigo,
        observacao=f"[{cc.nome}] {data.observacao or ''}",
        usuario_nome=user.nome,
        centro_custo_id=data.centro_custo_id,
    )
    db.add(mov); db.commit()
    return {"ok": True, "estoque_atual": prod.estoque_atual}

@router.get("/{cid}/movimentos")
def movimentos_cc(cid: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    movs = db.query(MovimentoEstoque).filter(MovimentoEstoque.centro_custo_id == cid)\
        .order_by(MovimentoEstoque.id.desc()).limit(100).all()
    return [{
        "id": m.id,
        "produto": m.produto.descricao if m.produto else None,
        "tipo": m.tipo,
        "quantidade": m.quantidade,
        "valor_total": m.valor_total,
        "data": str(m.data),
        "observacao": m.observacao,
    } for m in movs]
