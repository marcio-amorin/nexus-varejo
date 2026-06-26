from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import InventarioEstoque, ItemInventario, Produto, MovimentoEstoque
from utils.security import get_current_user
from pydantic import BaseModel
from typing import Optional, List
from datetime import date

router = APIRouter(prefix="/inventario", tags=["inventario"])

class ContagemItem(BaseModel):
    produto_id: int
    estoque_contado: float

class ContagemBatch(BaseModel):
    itens: List[ContagemItem]

class ItemFlagUpdate(BaseModel):
    validar:  Optional[bool] = None
    recontar: Optional[bool] = None
    manter:   Optional[bool] = None

class CreateInventario(BaseModel):
    descricao: Optional[str] = None
    tipo: Optional[str] = "TOTAL"  # TOTAL | PARCIAL

def _item_dict(i: ItemInventario) -> dict:
    custo   = i.produto.preco_custo  if i.produto else 0.0
    venda   = i.produto.preco_venda  if i.produto else 0.0
    unidade = i.produto.unidade      if i.produto else "UN"
    dif = i.diferenca or 0.0
    return {
        "id": i.id,
        "produto_id": i.produto_id,
        "produto_codigo":    i.produto.codigo      if i.produto else None,
        "produto_descricao": i.produto.descricao   if i.produto else None,
        "produto_unidade":   unidade,
        "estoque_sistema":   i.estoque_sistema,
        "estoque_contado":   i.estoque_contado,
        "diferenca":         dif,
        "div_custo":         round(dif * custo, 2),
        "div_preco":         round(dif * venda, 2),
        "ajustado":  i.ajustado,
        "validar":   i.validar  or False,
        "recontar":  i.recontar or False,
        "manter":    i.manter   or False,
    }

def _inv_dict(inv: InventarioEstoque, com_itens=False) -> dict:
    d = {
        "id": inv.id, "numero": inv.numero,
        "descricao":    inv.descricao or "",
        "tipo":         inv.tipo or "TOTAL",
        "status":       inv.status,
        "data_inicio":  str(inv.data_inicio),
        "data_fim":     str(inv.data_fim) if inv.data_fim else None,
        "criado_por":   inv.criado_por,
        "total_itens":  inv.total_itens,
        "divergencias": inv.divergencias,
        "observacoes":  inv.observacoes,
        "created_at":   inv.created_at.isoformat() if inv.created_at else None,
    }
    if com_itens:
        d["itens"] = [_item_dict(i) for i in inv.itens]
    return d

@router.get("/")
def list_inventarios(db: Session = Depends(get_db), _=Depends(get_current_user)):
    invs = db.query(InventarioEstoque).order_by(InventarioEstoque.id.desc()).all()
    return [_inv_dict(i) for i in invs]

@router.post("/")
def create_inventario(body: CreateInventario = CreateInventario(), db: Session = Depends(get_db), user=Depends(get_current_user)):
    last = db.query(InventarioEstoque).order_by(InventarioEstoque.id.desc()).first()
    num  = f"INV-{(last.id + 1) if last else 1:04d}"
    inv  = InventarioEstoque(
        numero=num,
        descricao=body.descricao or f"Inventário {num}",
        tipo=body.tipo or "TOTAL",
        status="ABERTO",
        data_inicio=date.today(),
        criado_por=user.nome,
    )
    db.add(inv); db.flush()

    produtos = db.query(Produto).filter(Produto.is_active == True).all()
    for p in produtos:
        db.add(ItemInventario(
            inventario_id=inv.id, produto_id=p.id,
            estoque_sistema=p.estoque_atual or 0, estoque_contado=None, diferenca=0,
        ))
    inv.total_itens = len(produtos)
    db.commit(); db.refresh(inv)
    return _inv_dict(inv, com_itens=True)

@router.get("/{inv_id}")
def get_inventario(inv_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    inv = db.query(InventarioEstoque).filter(InventarioEstoque.id == inv_id).first()
    if not inv: raise HTTPException(404)
    return _inv_dict(inv, com_itens=True)

@router.post("/{inv_id}/contar")
def registrar_contagem(inv_id: int, data: ContagemBatch, db: Session = Depends(get_db), _=Depends(get_current_user)):
    inv = db.query(InventarioEstoque).filter(InventarioEstoque.id == inv_id).first()
    if not inv: raise HTTPException(404)
    if inv.status == "FINALIZADO": raise HTTPException(400, "Inventário já finalizado")

    for c in data.itens:
        item = db.query(ItemInventario).filter(
            ItemInventario.inventario_id == inv_id,
            ItemInventario.produto_id == c.produto_id,
        ).first()
        if item:
            item.estoque_contado = c.estoque_contado
            item.diferenca = round(c.estoque_contado - (item.estoque_sistema or 0), 4)

    div = db.query(ItemInventario).filter(
        ItemInventario.inventario_id == inv_id,
        ItemInventario.estoque_contado.isnot(None),
        ItemInventario.diferenca != 0,
    ).count()
    inv.divergencias = div
    db.commit()
    return {"ok": True, "divergencias": div}

@router.patch("/{inv_id}/item/{item_id}")
def update_item_flag(inv_id: int, item_id: int, body: ItemFlagUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    item = db.query(ItemInventario).filter(
        ItemInventario.id == item_id,
        ItemInventario.inventario_id == inv_id,
    ).first()
    if not item: raise HTTPException(404)
    if body.validar  is not None: item.validar  = body.validar
    if body.recontar is not None: item.recontar = body.recontar
    if body.manter   is not None: item.manter   = body.manter
    db.commit()
    return _item_dict(item)

@router.post("/{inv_id}/finalizar")
def finalizar_inventario(inv_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    inv = db.query(InventarioEstoque).filter(InventarioEstoque.id == inv_id).first()
    if not inv: raise HTTPException(404)
    if inv.status == "FINALIZADO": raise HTTPException(400, "Já finalizado")

    ajustados = 0
    for item in inv.itens:
        if item.manter: continue  # manter = não ajustar
        if item.estoque_contado is None or item.diferenca == 0: continue
        prod = db.query(Produto).filter(Produto.id == item.produto_id).first()
        if not prod: continue
        prod.estoque_atual = item.estoque_contado
        item.ajustado = True
        db.add(MovimentoEstoque(
            produto_id=prod.id,
            tipo="AJUSTE",
            quantidade=abs(item.diferenca),
            custo_unitario=prod.preco_custo,
            valor_total=round(abs(item.diferenca) * (prod.preco_custo or 0), 2),
            data=date.today(),
            origem="INVENTARIO",
            origem_id=inv.id,
            documento_ref=inv.numero,
            observacao=f"Ajuste inventário {inv.numero}",
            usuario_nome=user.nome,
        ))
        ajustados += 1

    inv.status   = "FINALIZADO"
    inv.data_fim = date.today()
    db.commit()
    return {"ok": True, "ajustados": ajustados}

@router.delete("/{inv_id}")
def cancelar_inventario(inv_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    inv = db.query(InventarioEstoque).filter(InventarioEstoque.id == inv_id).first()
    if not inv: raise HTTPException(404)
    if inv.status == "FINALIZADO": raise HTTPException(400, "Não é possível cancelar inventário finalizado")
    inv.status = "CANCELADO"; db.commit()
    return {"ok": True}
