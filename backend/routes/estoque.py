from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import Produto, MovimentoEstoque, ItemVenda, Venda
from utils.security import get_current_user
from pydantic import BaseModel
from typing import Optional
from datetime import date, timedelta

router = APIRouter(prefix="/estoque", tags=["estoque"])


class AjusteEstoque(BaseModel):
    produto_id: int
    tipo: Optional[str] = "AJUSTE"   # AJUSTE | ENTRADA | SAIDA
    quantidade: float
    observacao: Optional[str] = None
    data: Optional[date] = None


@router.get("/saldo")
@router.get("/")
def saldo_estoque(
    busca: Optional[str] = None,
    categoria_id: Optional[int] = None,
    abaixo_minimo: Optional[bool] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Produto).filter(Produto.is_active == True)
    if categoria_id:
        q = q.filter(Produto.categoria_id == categoria_id)
    if busca:
        like = f"%{busca}%"
        q = q.filter((Produto.descricao.ilike(like)) | (Produto.codigo.ilike(like)))
    prods = q.order_by(Produto.descricao).all()
    if abaixo_minimo:
        prods = [p for p in prods if p.estoque_atual <= p.estoque_minimo and p.estoque_minimo > 0]
    return [{
        "id": p.id,
        "produto_id": p.id,
        "codigo": p.codigo,
        "descricao": p.descricao,
        "unidade": p.unidade,
        "categoria": p.categoria.nome if p.categoria else None,
        "estoque_atual": p.estoque_atual,
        "estoque_minimo": p.estoque_minimo,
        "preco_custo": p.preco_custo,
        "preco_venda": p.preco_venda,
        "valor_estoque": round(p.estoque_atual * p.preco_custo, 2),
        "abaixo_minimo": p.estoque_atual <= p.estoque_minimo and p.estoque_minimo > 0,
    } for p in prods]


@router.get("/movimentos")
def movimentos(
    produto_id: Optional[int] = None,
    tipo: Optional[str] = None,
    data_ini: Optional[date] = None,
    data_fim: Optional[date] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(MovimentoEstoque)
    if produto_id:
        q = q.filter(MovimentoEstoque.produto_id == produto_id)
    if tipo:
        q = q.filter(MovimentoEstoque.tipo == tipo)
    if data_ini:
        q = q.filter(MovimentoEstoque.data >= data_ini)
    if data_fim:
        q = q.filter(MovimentoEstoque.data <= data_fim)
    movs = q.order_by(MovimentoEstoque.data.desc(), MovimentoEstoque.id.desc()).all()
    return [{
        "id": m.id,
        "produto_id": m.produto_id,
        "produto_descricao": m.produto.descricao if m.produto else None,
        "tipo": m.tipo,
        "quantidade": m.quantidade,
        "custo_unitario": m.custo_unitario,
        "valor_total": m.valor_total,
        "data": str(m.data),
        "origem": m.origem,
        "documento_ref": m.documento_ref,
        "observacao": m.observacao,
    } for m in movs]


@router.post("/ajuste")
def ajuste_estoque(data: AjusteEstoque, db: Session = Depends(get_db), _=Depends(get_current_user)):
    prod = db.query(Produto).filter(Produto.id == data.produto_id).first()
    if not prod:
        raise HTTPException(404, "Produto não encontrado")

    qtd = abs(data.quantidade)
    tipo = data.tipo or "AJUSTE"

    if tipo == "AJUSTE":
        delta = data.quantidade - prod.estoque_atual
        prod.estoque_atual = round(data.quantidade, 4)
        qtd_mov = data.quantidade
    elif tipo == "SAIDA":
        if prod.estoque_atual < qtd:
            raise HTTPException(400, f"Estoque insuficiente: disponível {prod.estoque_atual}")
        prod.estoque_atual = round(prod.estoque_atual - qtd, 4)
        qtd_mov = -qtd
    else:
        prod.estoque_atual = round(prod.estoque_atual + qtd, 4)
        qtd_mov = qtd

    mov = MovimentoEstoque(
        produto_id=prod.id,
        tipo=tipo,
        quantidade=qtd_mov,
        custo_unitario=prod.preco_custo,
        valor_total=round(qtd * prod.preco_custo, 2),
        data=data.data or date.today(),
        origem="AJUSTE",
        observacao=data.observacao or f"Ajuste manual ({tipo.lower()})",
    )
    db.add(mov); db.commit()
    return {"ok": True, "estoque_atual": prod.estoque_atual}


@router.get("/alertas")
def alertas_estoque(db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Produtos zerados ou abaixo do mínimo, ordenados por criticidade."""
    prods = db.query(Produto).filter(Produto.is_active == True, Produto.estoque_minimo > 0).all()
    result = []
    for p in prods:
        if p.estoque_atual <= 0:
            nivel = "ZERADO"
        elif p.estoque_atual <= p.estoque_minimo:
            nivel = "BAIXO"
        else:
            continue
        cobertura = 0
        if p.estoque_minimo > 0:
            cobertura = round((p.estoque_atual / p.estoque_minimo) * 100, 1)
        result.append({
            "produto_id": p.id,
            "codigo": p.codigo,
            "descricao": p.descricao,
            "unidade": p.unidade,
            "categoria": p.categoria.nome if p.categoria else None,
            "estoque_atual": p.estoque_atual,
            "estoque_minimo": p.estoque_minimo,
            "nivel": nivel,
            "cobertura_pct": cobertura,
            "preco_custo": p.preco_custo,
            "preco_venda": p.preco_venda,
        })
    result.sort(key=lambda x: (0 if x["nivel"] == "ZERADO" else 1, x["cobertura_pct"]))
    return result


@router.get("/giro")
def giro_estoque(
    dias: Optional[int] = 30,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Giro de estoque: qtd vendida no período / estoque atual."""
    desde = date.today() - timedelta(days=dias)
    vendas_periodo = (
        db.query(ItemVenda.produto_id, func.sum(ItemVenda.quantidade).label("vendido"))
        .join(Venda, Venda.id == ItemVenda.venda_id)
        .filter(Venda.data_venda >= desde, Venda.status == "FINALIZADA")
        .group_by(ItemVenda.produto_id)
        .all()
    )
    vendas_map = {v.produto_id: float(v.vendido) for v in vendas_periodo}

    prods = db.query(Produto).filter(Produto.is_active == True).all()
    result = []
    for p in prods:
        vendido = vendas_map.get(p.id, 0)
        estoque = p.estoque_atual or 0
        giro = round(vendido / estoque, 2) if estoque > 0 else (99.0 if vendido > 0 else 0.0)
        dias_cobertura = round((estoque / (vendido / dias)) if vendido > 0 else 999, 0)
        result.append({
            "produto_id": p.id,
            "codigo": p.codigo,
            "descricao": p.descricao,
            "unidade": p.unidade,
            "categoria": p.categoria.nome if p.categoria else None,
            "estoque_atual": estoque,
            "vendido_periodo": vendido,
            "media_diaria": round(vendido / dias, 3),
            "giro": giro,
            "dias_cobertura": int(dias_cobertura),
            "valor_estoque": round(estoque * p.preco_custo, 2),
        })
    result.sort(key=lambda x: -x["vendido_periodo"])
    return result


@router.get("/stats")
def stats_estoque(db: Session = Depends(get_db), _=Depends(get_current_user)):
    prods = db.query(Produto).filter(Produto.is_active == True).all()
    return {
        "total_produtos": len(prods),
        "valor_total_estoque": round(sum(p.estoque_atual * p.preco_custo for p in prods), 2),
        "valor_custo": round(sum(p.estoque_atual * p.preco_custo for p in prods), 2),
        "valor_venda": round(sum(p.estoque_atual * p.preco_venda for p in prods), 2),
        "produtos_estoque_baixo": sum(1 for p in prods if 0 < p.estoque_atual <= p.estoque_minimo and p.estoque_minimo > 0),
        "produtos_abaixo_minimo": sum(1 for p in prods if p.estoque_atual <= p.estoque_minimo and p.estoque_minimo > 0),
        "produtos_sem_estoque": sum(1 for p in prods if p.estoque_atual <= 0),
        "produtos_zerados": sum(1 for p in prods if p.estoque_atual <= 0),
    }
