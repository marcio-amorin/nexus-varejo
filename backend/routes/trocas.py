from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import Troca, ItemTroca, Produto, Cliente, Fornecedor, Venda, MovimentoEstoque
from utils.security import get_current_user
from pydantic import BaseModel
from typing import Optional, List
from datetime import date

router = APIRouter(prefix="/trocas", tags=["trocas"])

MOTIVOS   = ["DEFEITO", "VENCIMENTO", "AVARIA", "INSATISFACAO", "ERRO_PEDIDO"]
RESOLUCOES= ["PRODUTO", "CREDITO", "REEMBOLSO", "DESCONTO"]


class ItemTrocaCreate(BaseModel):
    produto_id: Optional[int] = None
    descricao:  str
    quantidade: float
    valor_unit: float


class TrocaCreate(BaseModel):
    tipo:             str         # CLIENTE | FORNECEDOR
    data_solicitacao: date
    cliente_id:       Optional[int] = None
    fornecedor_id:    Optional[int] = None
    venda_id:         Optional[int] = None
    nf_entrada_id:    Optional[int] = None
    motivo:           str
    resolucao:        Optional[str] = None
    observacoes:      Optional[str] = None
    itens:            List[ItemTrocaCreate]


def _troca_dict(t: Troca) -> dict:
    return {
        "id":               t.id,
        "numero":           t.numero,
        "tipo":             t.tipo,
        "status":           t.status,
        "data_solicitacao": str(t.data_solicitacao),
        "cliente_id":       t.cliente_id,
        "cliente_nome":     t.cliente.nome if t.cliente else None,
        "fornecedor_id":    t.fornecedor_id,
        "fornecedor_nome":  (t.fornecedor.fantasia or t.fornecedor.razao_social) if t.fornecedor else None,
        "venda_id":         t.venda_id,
        "nf_entrada_id":    t.nf_entrada_id,
        "motivo":           t.motivo,
        "resolucao":        t.resolucao,
        "valor_total":      t.valor_total,
        "observacoes":      t.observacoes,
        "created_at":       t.created_at.isoformat() if t.created_at else None,
        "itens": [{
            "id":          i.id,
            "produto_id":  i.produto_id,
            "descricao":   i.descricao,
            "quantidade":  i.quantidade,
            "valor_unit":  i.valor_unit,
            "valor_total": i.valor_total,
        } for i in t.itens],
    }


def _proximo_numero(db: Session) -> str:
    ultimo = db.query(Troca.numero).order_by(Troca.id.desc()).first()
    if ultimo:
        try:
            seq = int(ultimo[0].split("-")[1]) + 1
        except Exception:
            seq = 1
    else:
        seq = 1
    return f"TR-{seq:05d}"


@router.get("/")
def listar_trocas(tipo: Optional[str] = None, status: Optional[str] = None,
                   busca: Optional[str] = None,
                   db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(Troca)
    if tipo:
        q = q.filter(Troca.tipo == tipo)
    if status:
        q = q.filter(Troca.status == status)
    trocas = q.order_by(Troca.id.desc()).limit(200).all()
    result = []
    for t in trocas:
        d = _troca_dict(t)
        if busca:
            b = busca.lower()
            if not (b in t.numero.lower() or
                    b in (d["cliente_nome"] or "").lower() or
                    b in (d["fornecedor_nome"] or "").lower()):
                continue
        result.append(d)
    return result


@router.get("/{troca_id}")
def get_troca(troca_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    t = db.query(Troca).filter(Troca.id == troca_id).first()
    if not t:
        raise HTTPException(404, "Troca não encontrada")
    return _troca_dict(t)


@router.post("/")
def criar_troca(data: TrocaCreate, db: Session = Depends(get_db), u=Depends(get_current_user)):
    if data.motivo not in MOTIVOS:
        raise HTTPException(400, f"Motivo inválido. Use: {MOTIVOS}")
    if data.tipo not in ["CLIENTE", "FORNECEDOR"]:
        raise HTTPException(400, "Tipo deve ser CLIENTE ou FORNECEDOR")

    t = Troca(
        numero=_proximo_numero(db),
        tipo=data.tipo,
        status="PENDENTE",
        data_solicitacao=data.data_solicitacao,
        cliente_id=data.cliente_id,
        fornecedor_id=data.fornecedor_id,
        venda_id=data.venda_id,
        nf_entrada_id=data.nf_entrada_id,
        motivo=data.motivo,
        resolucao=data.resolucao,
        observacoes=data.observacoes,
    )
    db.add(t); db.flush()

    valor_total = 0.0
    for item in data.itens:
        vt = round(item.quantidade * item.valor_unit, 2)
        valor_total += vt
        db.add(ItemTroca(
            troca_id=t.id,
            produto_id=item.produto_id,
            descricao=item.descricao,
            quantidade=item.quantidade,
            valor_unit=item.valor_unit,
            valor_total=vt,
        ))

    t.valor_total = round(valor_total, 2)
    db.commit(); db.refresh(t)
    return _troca_dict(t)


@router.put("/{troca_id}/status")
def atualizar_status(troca_id: int, body: dict, db: Session = Depends(get_db), u=Depends(get_current_user)):
    t = db.query(Troca).filter(Troca.id == troca_id).first()
    if not t:
        raise HTTPException(404, "Troca não encontrada")
    novo_status = body.get("status")
    if novo_status not in ["PENDENTE", "APROVADA", "CONCLUIDA", "CANCELADA"]:
        raise HTTPException(400, "Status inválido")

    status_anterior = t.status
    t.status = novo_status
    if body.get("resolucao"):
        t.resolucao = body["resolucao"]

    # ao concluir → movimenta estoque
    if novo_status == "CONCLUIDA" and status_anterior != "CONCLUIDA":
        for item in t.itens:
            if not item.produto_id:
                continue
            prod = db.query(Produto).filter(Produto.id == item.produto_id).first()
            if not prod:
                continue
            if t.tipo == "CLIENTE":
                # devolução do cliente → entrada no estoque
                prod.estoque_atual = round(prod.estoque_atual + item.quantidade, 4)
                db.add(MovimentoEstoque(
                    produto_id=prod.id, tipo="ENTRADA", quantidade=item.quantidade,
                    data=date.today(), origem="TROCA", origem_id=t.id,
                    documento_ref=t.numero,
                    observacao=f"Troca cliente: {t.motivo}",
                    usuario_nome=u.nome if u else "sistema",
                ))
            else:
                # devolução ao fornecedor → saída do estoque
                prod.estoque_atual = round(prod.estoque_atual - item.quantidade, 4)
                db.add(MovimentoEstoque(
                    produto_id=prod.id, tipo="SAIDA", quantidade=item.quantidade,
                    data=date.today(), origem="TROCA", origem_id=t.id,
                    documento_ref=t.numero,
                    observacao=f"Devolução fornecedor: {t.motivo}",
                    usuario_nome=u.nome if u else "sistema",
                ))

    db.commit()
    return {"ok": True, "status": t.status}
