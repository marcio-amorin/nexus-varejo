from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Venda, ItemVenda, Produto, MovimentoEstoque, ContaReceber, Cliente
from utils.security import get_current_user
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, timedelta

router = APIRouter(prefix="/vendas", tags=["vendas"])


# ─── Schemas ────────────────────────────────────────────────────────────────

class ItemVendaCreate(BaseModel):
    produto_id: int
    quantidade: float
    preco_unitario: Optional[float] = None   # se None, usa preço atual do produto
    desconto_item: Optional[float] = 0.0

class VendaCreate(BaseModel):
    cliente_id: Optional[int] = None
    cliente_nome: Optional[str] = None
    data_venda: Optional[date] = None
    desconto: Optional[float] = 0.0
    forma_pagamento: Optional[str] = "DINHEIRO"
    parcelas: Optional[int] = 1
    troco: Optional[float] = 0.0
    operador: Optional[str] = None
    observacoes: Optional[str] = None
    itens: List[ItemVendaCreate]


# ─── Helpers ────────────────────────────────────────────────────────────────

def _next_numero(db: Session) -> str:
    last = db.query(Venda).order_by(Venda.id.desc()).first()
    n = (last.id + 1) if last else 1
    return f"VD-{n:05d}"


def _venda_dict(v: Venda) -> dict:
    return {
        "id": v.id,
        "numero": v.numero,
        "cliente_id": v.cliente_id,
        "cliente_nome": v.cliente_nome or (v.cliente.nome if v.cliente else "Consumidor Final"),
        "data_venda": str(v.data_venda),
        "subtotal": v.subtotal,
        "desconto": v.desconto,
        "total": v.total,
        "forma_pagamento": v.forma_pagamento,
        "parcelas": v.parcelas,
        "troco": v.troco,
        "status": v.status,
        "operador": v.operador,
        "observacoes": v.observacoes,
        "created_at": v.created_at.isoformat() if v.created_at else None,
        "itens": [_item_dict(i) for i in v.itens],
    }


def _item_dict(i: ItemVenda) -> dict:
    return {
        "id": i.id,
        "produto_id": i.produto_id,
        "descricao": i.descricao_snap or (i.produto.descricao if i.produto else None),
        "quantidade": i.quantidade,
        "preco_unitario": i.preco_unitario,
        "desconto_item": i.desconto_item,
        "total_item": i.total_item,
        "custo_unitario": i.custo_unitario,
        "margem_real": round(((i.preco_unitario - i.custo_unitario) / i.preco_unitario) * 100, 2)
                       if i.preco_unitario > 0 and i.custo_unitario > 0 else 0,
    }


# ─── Endpoints ──────────────────────────────────────────────────────────────

@router.get("/")
def list_vendas(
    data_ini: Optional[date] = None,
    data_fim: Optional[date] = None,
    cliente_id: Optional[int] = None,
    status: Optional[str] = None,
    busca: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Venda)
    if data_ini:
        q = q.filter(Venda.data_venda >= data_ini)
    if data_fim:
        q = q.filter(Venda.data_venda <= data_fim)
    if cliente_id:
        q = q.filter(Venda.cliente_id == cliente_id)
    if status:
        q = q.filter(Venda.status == status)
    else:
        q = q.filter(Venda.status != "CANCELADA")
    if busca:
        q = q.filter(
            Venda.numero.ilike(f"%{busca}%") |
            Venda.cliente_nome.ilike(f"%{busca}%")
        )
    vendas = q.order_by(Venda.data_venda.desc(), Venda.id.desc()).all()
    return [{
        "id": v.id, "numero": v.numero,
        "cliente_nome": v.cliente_nome or (v.cliente.nome if v.cliente else "Consumidor Final"),
        "data_venda": str(v.data_venda),
        "total": v.total,
        "forma_pagamento": v.forma_pagamento,
        "parcelas": v.parcelas,
        "status": v.status,
        "total_itens": len(v.itens),
    } for v in vendas]


@router.get("/stats")
def stats_vendas(
    data_ini: Optional[date] = None,
    data_fim: Optional[date] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Venda).filter(Venda.status == "FINALIZADA")
    if data_ini:
        q = q.filter(Venda.data_venda >= data_ini)
    if data_fim:
        q = q.filter(Venda.data_venda <= data_fim)
    vendas = q.all()
    total_vendido = sum(v.total for v in vendas)
    total_custo = sum(
        sum(i.quantidade * i.custo_unitario for i in v.itens) for v in vendas
    )
    return {
        "total_vendas": len(vendas),
        "total_faturado": round(total_vendido, 2),
        "total_vendido": round(total_vendido, 2),
        "total_custo": round(total_custo, 2),
        "lucro_bruto": round(total_vendido - total_custo, 2),
        "margem_media": round(((total_vendido - total_custo) / total_vendido) * 100, 2) if total_vendido > 0 else 0,
    }


@router.get("/{venda_id}")
def get_venda(venda_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    v = db.query(Venda).filter(Venda.id == venda_id).first()
    if not v:
        raise HTTPException(404, "Venda não encontrada")
    return _venda_dict(v)


@router.post("/")
def create_venda(data: VendaCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if not data.itens:
        raise HTTPException(400, "Venda deve ter ao menos um item")

    hoje = date.today()
    subtotal = 0.0
    itens_obj = []

    for item_data in data.itens:
        prod = db.query(Produto).filter(Produto.id == item_data.produto_id).first()
        if not prod:
            raise HTTPException(404, f"Produto {item_data.produto_id} não encontrado")
        if prod.estoque_atual < item_data.quantidade:
            raise HTTPException(400, f"Estoque insuficiente para {prod.descricao}: disponível {prod.estoque_atual}")

        preco = item_data.preco_unitario if item_data.preco_unitario is not None else prod.preco_venda
        desc  = item_data.desconto_item or 0
        total_item = round(item_data.quantidade * preco - desc, 2)
        subtotal += total_item

        item = ItemVenda(
            produto_id=prod.id,
            descricao_snap=prod.descricao,
            quantidade=item_data.quantidade,
            preco_unitario=preco,
            desconto_item=desc,
            total_item=total_item,
            custo_unitario=prod.preco_custo,
        )
        itens_obj.append((item, prod))

    desconto = data.desconto or 0
    total = round(subtotal - desconto, 2)

    venda = Venda(
        numero=_next_numero(db),
        cliente_id=data.cliente_id,
        cliente_nome=data.cliente_nome,
        data_venda=data.data_venda or hoje,
        subtotal=subtotal,
        desconto=desconto,
        total=total,
        forma_pagamento=data.forma_pagamento,
        parcelas=data.parcelas or 1,
        troco=data.troco or 0,
        status="FINALIZADA",
        operador=data.operador or user.nome,
        observacoes=data.observacoes,
    )
    db.add(venda); db.flush()

    for item, prod in itens_obj:
        item.venda_id = venda.id
        db.add(item)
        prod.estoque_atual = round(prod.estoque_atual - item.quantidade, 4)
        mov = MovimentoEstoque(
            produto_id=prod.id,
            tipo="SAIDA",
            quantidade=item.quantidade,
            custo_unitario=prod.preco_custo,
            valor_total=item.total_item,
            data=venda.data_venda,
            origem="VENDA",
            origem_id=venda.id,
            documento_ref=venda.numero,
        )
        db.add(mov)

    # Gerar conta a receber para crediário/prazo
    if data.forma_pagamento in ("CREDIARIO", "BOLETO"):
        parcelas = data.parcelas or 1
        valor_parcela = round(total / parcelas, 2)
        for i in range(1, parcelas + 1):
            venc = (venda.data_venda or hoje) + timedelta(days=30 * i)
            cr = ContaReceber(
                cliente_id=data.cliente_id,
                venda_id=venda.id,
                descricao=f"{venda.numero} — Parcela {i}/{parcelas}",
                valor=valor_parcela,
                vencimento=venc,
                status="PENDENTE",
                parcela_num=i,
                total_parcelas=parcelas,
            )
            db.add(cr)

    db.commit(); db.refresh(venda)
    return _venda_dict(venda)


@router.delete("/{venda_id}")
def cancelar_venda(venda_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    v = db.query(Venda).filter(Venda.id == venda_id).first()
    if not v:
        raise HTTPException(404, "Venda não encontrada")
    if v.status == "CANCELADA":
        raise HTTPException(400, "Venda já cancelada")
    for item in v.itens:
        prod = db.query(Produto).filter(Produto.id == item.produto_id).first()
        if prod:
            prod.estoque_atual = round(prod.estoque_atual + item.quantidade, 4)
        mov = MovimentoEstoque(
            produto_id=item.produto_id,
            tipo="ENTRADA",
            quantidade=item.quantidade,
            custo_unitario=item.custo_unitario,
            valor_total=item.total_item,
            data=date.today(),
            origem="VENDA",
            origem_id=v.id,
            documento_ref=f"CANCEL {v.numero}",
            observacao="Cancelamento de venda",
        )
        db.add(mov)
    v.status = "CANCELADA"
    db.commit()
    return {"ok": True}
