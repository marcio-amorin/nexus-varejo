from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import (
    PedidoCompra, ItemPedidoCompra, SolicitacaoCompra,
    Produto, Fornecedor
)
from utils.security import get_current_user
from pydantic import BaseModel
from typing import Optional, List
from datetime import date

router = APIRouter(prefix="/compras", tags=["compras"])


# ─── Schemas ────────────────────────────────────────────────────────────────

class SolicitacaoCreate(BaseModel):
    produto_id: int
    quantidade_sugerida: float
    prioridade: Optional[str] = "NORMAL"   # NORMAL | URGENTE | CRITICA
    observacao: Optional[str] = None
    criado_por: Optional[str] = None

class SolicitacaoUpdate(BaseModel):
    status: Optional[str] = None
    prioridade: Optional[str] = None
    observacao: Optional[str] = None

class ItemPedidoCreate(BaseModel):
    produto_id: int
    quantidade: float
    preco_unitario: Optional[float] = 0.0
    solicitacao_id: Optional[int] = None

class PedidoCreate(BaseModel):
    fornecedor_id: int
    prazo_entrega: Optional[date] = None
    observacoes: Optional[str] = None
    itens: List[ItemPedidoCreate]

class PedidoUpdate(BaseModel):
    fornecedor_id: Optional[int] = None
    prazo_entrega: Optional[date] = None
    observacoes: Optional[str] = None
    status: Optional[str] = None

class PedidoDeSolicitacoes(BaseModel):
    fornecedor_id: int
    solicitacao_ids: List[int]
    prazo_entrega: Optional[date] = None
    observacoes: Optional[str] = None


# ─── Helpers ────────────────────────────────────────────────────────────────

def _next_num(db: Session) -> str:
    last = db.query(PedidoCompra).order_by(PedidoCompra.id.desc()).first()
    n = (last.id + 1) if last else 1
    return f"PC-{n:05d}"

def _sol_dict(s: SolicitacaoCompra) -> dict:
    p = s.produto
    return {
        "id": s.id,
        "produto_id": s.produto_id,
        "produto_codigo": p.codigo if p else None,
        "produto_descricao": p.descricao if p else None,
        "produto_unidade": p.unidade if p else "UN",
        "estoque_atual": p.estoque_atual if p else 0,
        "estoque_minimo": p.estoque_minimo if p else 0,
        "estoque_momento": s.estoque_momento,
        "quantidade_sugerida": s.quantidade_sugerida,
        "prioridade": s.prioridade,
        "status": s.status,
        "observacao": s.observacao,
        "criado_por": s.criado_por,
        "pedido_id": s.pedido_id,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }

def _pedido_dict(p: PedidoCompra, itens=True) -> dict:
    f = p.fornecedor
    d = {
        "id": p.id,
        "numero": p.numero,
        "fornecedor_id": p.fornecedor_id,
        "fornecedor_nome": (f.fantasia or f.razao_social) if f else None,
        "status": p.status,
        "data_pedido": str(p.data_pedido),
        "prazo_entrega": str(p.prazo_entrega) if p.prazo_entrega else None,
        "valor_total": p.valor_total,
        "observacoes": p.observacoes,
        "criado_por": p.criado_por,
        "total_itens": len(p.itens),
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }
    if itens:
        d["itens"] = [_item_dict(i) for i in p.itens]
    return d

def _item_dict(i: ItemPedidoCompra) -> dict:
    p = i.produto
    return {
        "id": i.id,
        "produto_id": i.produto_id,
        "produto_codigo": p.codigo if p else None,
        "produto_descricao": p.descricao if p else None,
        "produto_unidade": p.unidade if p else "UN",
        "quantidade": i.quantidade,
        "preco_unitario": i.preco_unitario,
        "valor_total": i.valor_total,
        "solicitacao_id": i.solicitacao_id,
    }


# ─── Dashboard do Módulo ─────────────────────────────────────────────────────

@router.get("/dashboard")
def dashboard_compras(db: Session = Depends(get_db), _=Depends(get_current_user)):
    sols = db.query(SolicitacaoCompra).all()
    pedidos = db.query(PedidoCompra).all()
    prods = db.query(Produto).filter(Produto.is_active == True).all()

    pendentes     = [s for s in sols if s.status == "PENDENTE"]
    urgentes      = [s for s in pendentes if s.prioridade in ("URGENTE", "CRITICA")]
    pedidos_abertos = [p for p in pedidos if p.status not in ("RECEBIDO", "CANCELADO")]
    criticos      = [p for p in prods if p.estoque_atual <= 0]
    baixo_estoque = [p for p in prods if 0 < p.estoque_atual <= p.estoque_minimo and p.estoque_minimo > 0]
    valor_comprometido = sum(p.valor_total for p in pedidos_abertos)

    return {
        "solicitacoes_pendentes": len(pendentes),
        "solicitacoes_urgentes": len(urgentes),
        "pedidos_abertos": len(pedidos_abertos),
        "valor_comprometido": round(valor_comprometido, 2),
        "produtos_criticos": len(criticos),
        "produtos_baixo_estoque": len(baixo_estoque),
        "ultimas_solicitacoes": [_sol_dict(s) for s in sorted(pendentes, key=lambda x: x.created_at or x.id, reverse=True)[:8]],
        "ultimos_pedidos": [_pedido_dict(p, itens=False) for p in sorted(pedidos_abertos, key=lambda x: x.created_at or x.id, reverse=True)[:6]],
        "alertas_estoque": [{
            "produto_id": p.id,
            "codigo": p.codigo,
            "descricao": p.descricao,
            "estoque_atual": p.estoque_atual,
            "estoque_minimo": p.estoque_minimo,
            "status": "CRITICO" if p.estoque_atual <= 0 else "BAIXO",
        } for p in (criticos + baixo_estoque)[:10]],
    }


# ─── Solicitações (Repositor) ─────────────────────────────────────────────────

@router.get("/solicitacoes")
def list_solicitacoes(
    status: Optional[str] = None,
    prioridade: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(SolicitacaoCompra)
    if status:
        q = q.filter(SolicitacaoCompra.status == status)
    if prioridade:
        q = q.filter(SolicitacaoCompra.prioridade == prioridade)
    items = q.order_by(SolicitacaoCompra.id.desc()).all()
    return [_sol_dict(s) for s in items]


@router.get("/solicitacoes/pendentes/count")
def count_pendentes(db: Session = Depends(get_db), _=Depends(get_current_user)):
    n = db.query(SolicitacaoCompra).filter(SolicitacaoCompra.status == "PENDENTE").count()
    return {"pendentes": n}


@router.post("/solicitacoes")
def create_solicitacao(data: SolicitacaoCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    prod = db.query(Produto).filter(Produto.id == data.produto_id).first()
    if not prod:
        raise HTTPException(404, "Produto não encontrado")
    s = SolicitacaoCompra(
        produto_id=data.produto_id,
        quantidade_sugerida=data.quantidade_sugerida,
        estoque_momento=prod.estoque_atual,
        prioridade=data.prioridade or "NORMAL",
        observacao=data.observacao,
        criado_por=data.criado_por,
        status="PENDENTE",
    )
    db.add(s); db.commit(); db.refresh(s)
    return _sol_dict(s)


@router.put("/solicitacoes/{sid}")
def update_solicitacao(sid: int, data: SolicitacaoUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    s = db.query(SolicitacaoCompra).filter(SolicitacaoCompra.id == sid).first()
    if not s:
        raise HTTPException(404, "Solicitação não encontrada")
    if data.status:    s.status = data.status
    if data.prioridade: s.prioridade = data.prioridade
    if data.observacao is not None: s.observacao = data.observacao
    db.commit(); db.refresh(s)
    return _sol_dict(s)


@router.delete("/solicitacoes/{sid}")
def cancel_solicitacao(sid: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    s = db.query(SolicitacaoCompra).filter(SolicitacaoCompra.id == sid).first()
    if not s:
        raise HTTPException(404, "Solicitação não encontrada")
    s.status = "CANCELADA"
    db.commit()
    return {"ok": True}


# ─── Produtos críticos (para app repositor) ──────────────────────────────────

@router.get("/criticos")
def produtos_criticos(db: Session = Depends(get_db), _=Depends(get_current_user)):
    prods = db.query(Produto).filter(Produto.is_active == True).all()
    result = []
    for p in prods:
        if p.estoque_atual <= 0:
            status = "CRITICO"
        elif p.estoque_minimo > 0 and p.estoque_atual <= p.estoque_minimo:
            status = "BAIXO"
        else:
            continue
        result.append({
            "id": p.id, "codigo": p.codigo, "descricao": p.descricao,
            "unidade": p.unidade, "estoque_atual": p.estoque_atual,
            "estoque_minimo": p.estoque_minimo, "status": status,
            "preco_custo": p.preco_custo,
        })
    return sorted(result, key=lambda x: (0 if x["status"] == "CRITICO" else 1, x["descricao"]))


# ─── Pedidos de Compra ────────────────────────────────────────────────────────

@router.get("/pedidos")
def list_pedidos(
    status: Optional[str] = None,
    fornecedor_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(PedidoCompra)
    if status:
        q = q.filter(PedidoCompra.status == status)
    if fornecedor_id:
        q = q.filter(PedidoCompra.fornecedor_id == fornecedor_id)
    pedidos = q.order_by(PedidoCompra.id.desc()).all()
    return [_pedido_dict(p, itens=False) for p in pedidos]


@router.get("/pedidos/{pid}")
def get_pedido(pid: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(PedidoCompra).filter(PedidoCompra.id == pid).first()
    if not p:
        raise HTTPException(404, "Pedido não encontrado")
    return _pedido_dict(p)


@router.post("/pedidos")
def create_pedido(data: PedidoCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if not data.itens:
        raise HTTPException(400, "Pedido deve ter ao menos um item")
    forn = db.query(Fornecedor).filter(Fornecedor.id == data.fornecedor_id).first()
    if not forn:
        raise HTTPException(404, "Fornecedor não encontrado")

    pedido = PedidoCompra(
        numero=_next_num(db),
        fornecedor_id=data.fornecedor_id,
        data_pedido=date.today(),
        prazo_entrega=data.prazo_entrega,
        observacoes=data.observacoes,
        criado_por=user.nome,
        status="RASCUNHO",
        valor_total=0,
    )
    db.add(pedido); db.flush()

    total = 0.0
    for item_data in data.itens:
        prod = db.query(Produto).filter(Produto.id == item_data.produto_id).first()
        if not prod:
            raise HTTPException(404, f"Produto {item_data.produto_id} não encontrado")
        vt = round(item_data.quantidade * (item_data.preco_unitario or prod.preco_custo), 2)
        total += vt
        item = ItemPedidoCompra(
            pedido_id=pedido.id,
            produto_id=item_data.produto_id,
            quantidade=item_data.quantidade,
            preco_unitario=item_data.preco_unitario or prod.preco_custo,
            valor_total=vt,
            solicitacao_id=item_data.solicitacao_id,
        )
        db.add(item)
        if item_data.solicitacao_id:
            sol = db.query(SolicitacaoCompra).filter(SolicitacaoCompra.id == item_data.solicitacao_id).first()
            if sol:
                sol.status = "EM_PEDIDO"
                sol.pedido_id = pedido.id

    pedido.valor_total = round(total, 2)
    db.commit(); db.refresh(pedido)
    return _pedido_dict(pedido)


@router.put("/pedidos/{pid}")
def update_pedido(pid: int, data: PedidoUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(PedidoCompra).filter(PedidoCompra.id == pid).first()
    if not p:
        raise HTTPException(404, "Pedido não encontrado")
    if data.fornecedor_id: p.fornecedor_id = data.fornecedor_id
    if data.prazo_entrega:  p.prazo_entrega = data.prazo_entrega
    if data.observacoes is not None: p.observacoes = data.observacoes
    if data.status:
        p.status = data.status
        if data.status == "RECEBIDO":
            for s in p.solicitacoes:
                s.status = "CONCLUIDA"
    db.commit(); db.refresh(p)
    return _pedido_dict(p)


@router.delete("/pedidos/{pid}")
def cancel_pedido(pid: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(PedidoCompra).filter(PedidoCompra.id == pid).first()
    if not p:
        raise HTTPException(404, "Pedido não encontrado")
    if p.status == "RECEBIDO":
        raise HTTPException(400, "Não é possível cancelar pedido já recebido")
    p.status = "CANCELADO"
    for s in p.solicitacoes:
        s.status = "PENDENTE"
        s.pedido_id = None
    db.commit()
    return {"ok": True}


@router.post("/pedidos/de-solicitacoes")
def pedido_de_solicitacoes(data: PedidoDeSolicitacoes, db: Session = Depends(get_db), user=Depends(get_current_user)):
    forn = db.query(Fornecedor).filter(Fornecedor.id == data.fornecedor_id).first()
    if not forn:
        raise HTTPException(404, "Fornecedor não encontrado")

    pedido = PedidoCompra(
        numero=_next_num(db),
        fornecedor_id=data.fornecedor_id,
        data_pedido=date.today(),
        prazo_entrega=data.prazo_entrega,
        observacoes=data.observacoes,
        criado_por=user.nome,
        status="RASCUNHO",
        valor_total=0,
    )
    db.add(pedido); db.flush()

    total = 0.0
    for sid in data.solicitacao_ids:
        s = db.query(SolicitacaoCompra).filter(SolicitacaoCompra.id == sid).first()
        if not s or s.status != "PENDENTE":
            continue
        prod = db.query(Produto).filter(Produto.id == s.produto_id).first()
        if not prod:
            continue
        vt = round(s.quantidade_sugerida * prod.preco_custo, 2)
        total += vt
        item = ItemPedidoCompra(
            pedido_id=pedido.id,
            produto_id=s.produto_id,
            quantidade=s.quantidade_sugerida,
            preco_unitario=prod.preco_custo,
            valor_total=vt,
            solicitacao_id=s.id,
        )
        db.add(item)
        s.status = "EM_PEDIDO"
        s.pedido_id = pedido.id

    pedido.valor_total = round(total, 2)
    db.commit(); db.refresh(pedido)
    return _pedido_dict(pedido)
