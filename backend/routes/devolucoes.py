from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc
from database import get_db
from models import DevolucaoMercadoria, ItemDevolucao, Produto, Cliente, MovimentoEstoque
from utils.security import get_current_user
from pydantic import BaseModel
from typing import Optional, List
from datetime import date

router = APIRouter(prefix="/devolucoes", tags=["devolucoes"])

class ItemDevCreate(BaseModel):
    produto_id: int
    quantidade: float
    preco_unitario: float

class DevolucaoCreate(BaseModel):
    cliente_nome: Optional[str] = None
    cliente_cpf: Optional[str] = None
    cliente_id: Optional[int] = None
    venda_numero: Optional[str] = None
    motivo: Optional[str] = None
    observacoes: Optional[str] = None
    itens: List[ItemDevCreate]

def _dev_dict(d: DevolucaoMercadoria, com_itens=True) -> dict:
    r = {
        "id": d.id, "numero": d.numero,
        "cliente_nome": d.cliente_nome,
        "cliente_cpf": d.cliente_cpf,
        "venda_numero": d.venda_numero,
        "status": d.status,
        "motivo": d.motivo,
        "valor_total": d.valor_total,
        "credito_gerado": d.credito_gerado,
        "credito_disponivel": d.credito_disponivel,
        "credito_usado": d.credito_usado,
        "data_devolucao": str(d.data_devolucao),
        "operador": d.operador,
        "observacoes": d.observacoes,
        "created_at": d.created_at.isoformat() if d.created_at else None,
    }
    if com_itens:
        r["itens"] = [{
            "id": i.id,
            "produto_id": i.produto_id,
            "produto_descricao": i.produto.descricao if i.produto else None,
            "produto_codigo": i.produto.codigo if i.produto else None,
            "quantidade": i.quantidade,
            "preco_unitario": i.preco_unitario,
            "total_item": i.total_item,
        } for i in d.itens]
    return r

@router.get("/")
def list_devolucoes(status: Optional[str] = None, db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(DevolucaoMercadoria)
    if status: q = q.filter(DevolucaoMercadoria.status == status)
    return [_dev_dict(d, com_itens=False) for d in q.order_by(DevolucaoMercadoria.id.desc()).all()]

@router.get("/credito/{cpf}")
def credito_cliente(cpf: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    cpf_c = cpf.replace(".", "").replace("-", "")
    total = db.query(sqlfunc.sum(DevolucaoMercadoria.credito_disponivel))\
        .filter(DevolucaoMercadoria.cliente_cpf == cpf_c).scalar() or 0
    devs = db.query(DevolucaoMercadoria).filter(
        DevolucaoMercadoria.cliente_cpf == cpf_c,
        DevolucaoMercadoria.credito_disponivel > 0,
    ).all()
    c = db.query(Cliente).filter(Cliente.documento.contains(cpf_c)).first()
    return {
        "cpf": cpf_c,
        "cliente_nome": c.nome if c else None,
        "credito_total": round(total, 2),
        "devolucoes": [{"numero": d.numero, "credito_disponivel": d.credito_disponivel,
                        "data": str(d.data_devolucao)} for d in devs],
    }

@router.get("/{did}")
def get_devolucao(did: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    d = db.query(DevolucaoMercadoria).filter(DevolucaoMercadoria.id == did).first()
    if not d: raise HTTPException(404)
    return _dev_dict(d)

@router.post("/")
def create_devolucao(data: DevolucaoCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if not data.itens: raise HTTPException(400, "Devolução sem itens")

    last = db.query(DevolucaoMercadoria).order_by(DevolucaoMercadoria.id.desc()).first()
    num  = f"DEV-{(last.id + 1) if last else 1:05d}"

    total = sum(round(i.quantidade * i.preco_unitario, 2) for i in data.itens)

    # Busca cliente por CPF se não foi passado nome
    cliente_nome = data.cliente_nome
    cpf_clean    = data.cliente_cpf.replace(".", "").replace("-", "") if data.cliente_cpf else None
    if not cliente_nome and cpf_clean:
        c = db.query(Cliente).filter(Cliente.documento.contains(cpf_clean)).first()
        if c: cliente_nome = c.nome; data.cliente_id = c.id

    dev = DevolucaoMercadoria(
        numero=num,
        cliente_id=data.cliente_id,
        cliente_nome=cliente_nome,
        cliente_cpf=cpf_clean,
        venda_numero=data.venda_numero,
        status="APROVADA",
        motivo=data.motivo,
        valor_total=total,
        credito_gerado=total,
        credito_disponivel=total,
        credito_usado=0,
        data_devolucao=date.today(),
        operador=user.nome,
        observacoes=data.observacoes,
    )
    db.add(dev); db.flush()

    for item_data in data.itens:
        prod = db.query(Produto).filter(Produto.id == item_data.produto_id).first()
        if not prod: raise HTTPException(404, f"Produto {item_data.produto_id} não encontrado")
        db.add(ItemDevolucao(
            devolucao_id=dev.id,
            produto_id=prod.id,
            quantidade=item_data.quantidade,
            preco_unitario=item_data.preco_unitario,
            total_item=round(item_data.quantidade * item_data.preco_unitario, 2),
        ))
        # Retorna ao estoque
        prod.estoque_atual = round(prod.estoque_atual + item_data.quantidade, 4)
        db.add(MovimentoEstoque(
            produto_id=prod.id, tipo="ENTRADA",
            quantidade=item_data.quantidade,
            custo_unitario=prod.preco_custo,
            valor_total=round(item_data.quantidade * prod.preco_custo, 2),
            data=date.today(),
            origem="DEVOLUCAO",
            origem_id=dev.id,
            documento_ref=num,
            observacao=f"Devolução {num}",
            usuario_nome=user.nome,
        ))

    db.commit(); db.refresh(dev)
    return _dev_dict(dev)

@router.delete("/{did}")
def cancelar_devolucao(did: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    dev = db.query(DevolucaoMercadoria).filter(DevolucaoMercadoria.id == did).first()
    if not dev: raise HTTPException(404)
    if dev.credito_usado > 0: raise HTTPException(400, "Crédito já utilizado, não é possível cancelar")
    dev.status = "CANCELADA"
    dev.credito_disponivel = 0
    # Reverte estoque
    for item in dev.itens:
        prod = db.query(Produto).filter(Produto.id == item.produto_id).first()
        if prod:
            prod.estoque_atual = round(prod.estoque_atual - item.quantidade, 4)
    db.commit()
    return {"ok": True}
