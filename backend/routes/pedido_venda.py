from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Vendedor, PedidoVenda, ItemPedidoVenda, Produto, Cliente
from utils.security import get_current_user
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, timedelta
from collections import defaultdict

router = APIRouter(prefix="/pedido-venda", tags=["pedido-venda"])


def _gerar_numero(db: Session) -> str:
    ano = date.today().year
    ultimo = (
        db.query(PedidoVenda)
        .filter(PedidoVenda.numero.like(f"PV{ano}%"))
        .order_by(PedidoVenda.id.desc())
        .first()
    )
    seq = int(ultimo.numero[6:]) + 1 if ultimo else 1
    return f"PV{ano}{seq:04d}"


def _serial_vendedor(v: Vendedor) -> dict:
    return {
        "id":               v.id,
        "nome":             v.nome,
        "codigo":           v.codigo,
        "comissao_pct":     v.comissao_pct,
        "pode_desconto":    v.pode_desconto,
        "desconto_max_pct": v.desconto_max_pct,
        "ativo":            v.ativo,
    }


def _serial_pedido(p: PedidoVenda) -> dict:
    return {
        "id":                p.id,
        "numero":            p.numero,
        "vendedor_id":       p.vendedor_id,
        "vendedor_nome":     p.vendedor.nome if p.vendedor else None,
        "tipo_cliente":      p.tipo_cliente,
        "cliente_id":        p.cliente_id,
        "cliente_nome":      p.cliente_nome or (p.cliente.nome if p.cliente else None),
        "cliente_doc":       p.cliente_doc,
        "cliente_telefone":  p.cliente_telefone,
        "data_entrega":      p.data_entrega.isoformat() if p.data_entrega else None,
        "tipo_entrega":      p.tipo_entrega,
        "forma_recebimento": p.forma_recebimento,
        "tipo_fiscal":       p.tipo_fiscal,
        "status":            p.status,
        "subtotal":          p.subtotal,
        "desconto_total":    p.desconto_total,
        "total":             p.total,
        "observacoes":       p.observacoes,
        "created_at":        p.created_at.isoformat() if p.created_at else None,
        "itens": [
            {
                "id":             it.id,
                "produto_id":     it.produto_id,
                "descricao":      it.descricao,
                "quantidade":     it.quantidade,
                "preco_unitario": it.preco_unitario,
                "desconto_pct":   it.desconto_pct,
                "preco_final":    it.preco_final,
                "total_item":     it.total_item,
            }
            for it in (p.itens or [])
        ],
    }


# ── Painel ────────────────────────────────────────────────────────────────────

def _periodo_datas(periodo: str, data_inicio: str = None, data_fim: str = None):
    hoje = date.today()
    if periodo == "DIA":
        return hoje, hoje
    if periodo == "MES":
        return hoje.replace(day=1), hoje
    if periodo == "ANO":
        return hoje.replace(month=1, day=1), hoje
    if periodo == "PERIODO" and data_inicio and data_fim:
        return date.fromisoformat(data_inicio), date.fromisoformat(data_fim)
    return hoje.replace(day=1), hoje


@router.get("/painel")
def painel_pedidos(
    periodo: str = "MES",
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    ini, fim = _periodo_datas(periodo, data_inicio, data_fim)

    from sqlalchemy import func
    # func.date() extrai só a parte de data do campo datetime — funciona em SQLite e Postgres
    pedidos = (db.query(PedidoVenda)
               .filter(
                   func.date(PedidoVenda.created_at) >= str(ini),
                   func.date(PedidoVenda.created_at) <= str(fim),
               )
               .all())

    total = len(pedidos)
    total_valor = sum(p.total or 0 for p in pedidos if p.status != "CANCELADO")
    ticket_medio = total_valor / total if total else 0

    # por status
    por_status: dict = defaultdict(lambda: {"qtd": 0, "valor": 0.0})
    for p in pedidos:
        por_status[p.status]["qtd"] += 1
        por_status[p.status]["valor"] += p.total or 0

    # por vendedor
    por_vendedor: dict = defaultdict(lambda: {"nome": "", "qtd": 0, "valor": 0.0})
    for p in pedidos:
        vid = p.vendedor_id or 0
        por_vendedor[vid]["nome"] = p.vendedor.nome if p.vendedor else "Sem Vendedor"
        por_vendedor[vid]["qtd"]  += 1
        por_vendedor[vid]["valor"] += p.total or 0

    # por dia
    por_dia: dict = defaultdict(lambda: {"qtd": 0, "valor": 0.0})
    for p in pedidos:
        d = str(p.created_at.date()) if p.created_at else str(ini)
        por_dia[d]["qtd"]   += 1
        por_dia[d]["valor"] += p.total or 0

    return {
        "periodo": {"inicio": str(ini), "fim": str(fim)},
        "total_pedidos": total,
        "total_valor":   round(total_valor, 2),
        "ticket_medio":  round(ticket_medio, 2),
        "por_status": [
            {"status": k, "qtd": v["qtd"], "valor": round(v["valor"], 2)}
            for k, v in sorted(por_status.items())
        ],
        "por_vendedor": [
            {"id": k, "nome": v["nome"], "qtd": v["qtd"], "valor": round(v["valor"], 2)}
            for k, v in sorted(por_vendedor.items(), key=lambda x: -x[1]["valor"])
        ],
        "por_dia": [
            {"data": k, "qtd": v["qtd"], "valor": round(v["valor"], 2)}
            for k, v in sorted(por_dia.items())
        ],
    }


# ── Vendedores ────────────────────────────────────────────────────────────────

class VendedorSchema(BaseModel):
    nome:             str
    codigo:           str
    comissao_pct:     float = 0.0
    pode_desconto:    bool  = False
    desconto_max_pct: float = 0.0
    ativo:            bool  = True


@router.get("/vendedores")
def listar_vendedores(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return [_serial_vendedor(v) for v in db.query(Vendedor).order_by(Vendedor.nome).all()]


@router.post("/vendedores")
def criar_vendedor(data: VendedorSchema, db: Session = Depends(get_db), _=Depends(get_current_user)):
    if db.query(Vendedor).filter_by(codigo=data.codigo.upper()).first():
        raise HTTPException(400, "Código já existe")
    v = Vendedor(**{**data.dict(), "codigo": data.codigo.upper()})
    db.add(v); db.commit(); db.refresh(v)
    return _serial_vendedor(v)


@router.put("/vendedores/{vid}")
def editar_vendedor(vid: int, data: VendedorSchema, db: Session = Depends(get_db), _=Depends(get_current_user)):
    v = db.query(Vendedor).filter_by(id=vid).first()
    if not v: raise HTTPException(404, "Vendedor não encontrado")
    dup = db.query(Vendedor).filter(Vendedor.codigo == data.codigo.upper(), Vendedor.id != vid).first()
    if dup: raise HTTPException(400, "Código já existe")
    for k, val in data.dict().items():
        setattr(v, k, val.upper() if k == "codigo" else val)
    db.commit(); db.refresh(v)
    return _serial_vendedor(v)


@router.delete("/vendedores/{vid}")
def excluir_vendedor(vid: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    v = db.query(Vendedor).filter_by(id=vid).first()
    if not v: raise HTTPException(404, "Vendedor não encontrado")
    db.delete(v); db.commit()
    return {"ok": True}


# ── Pedidos de Venda ──────────────────────────────────────────────────────────

class ItemSchema(BaseModel):
    produto_id:     int
    quantidade:     float = 1.0
    preco_unitario: float
    desconto_pct:   float = 0.0


class PedidoSchema(BaseModel):
    vendedor_id:      Optional[int]  = None
    tipo_cliente:     str            = "CONSUMIDOR_FINAL"
    cliente_id:       Optional[int]  = None
    cliente_nome:     Optional[str]  = None
    cliente_doc:      Optional[str]  = None
    cliente_telefone: Optional[str]  = None
    data_entrega:     Optional[str]  = None
    tipo_entrega:     str            = "RETIRADA"
    forma_recebimento: Optional[str] = None
    tipo_fiscal:      str            = "ORCAMENTO"
    observacoes:      Optional[str]  = None
    itens:            List[ItemSchema] = []


@router.get("/pedidos")
def listar_pedidos(
    status: Optional[str] = None,
    vendedor_id: Optional[int] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(PedidoVenda)
    if status:      q = q.filter(PedidoVenda.status == status.upper())
    if vendedor_id: q = q.filter(PedidoVenda.vendedor_id == vendedor_id)
    pedidos = q.order_by(PedidoVenda.id.desc()).limit(limit).all()
    return [_serial_pedido(p) for p in pedidos]


@router.post("/pedidos")
def criar_pedido(data: PedidoSchema, db: Session = Depends(get_db), _=Depends(get_current_user)):
    numero = _gerar_numero(db)

    subtotal = 0.0
    desconto_total = 0.0

    pedido = PedidoVenda(
        numero           = numero,
        vendedor_id      = data.vendedor_id,
        tipo_cliente     = data.tipo_cliente,
        cliente_id       = data.cliente_id,
        cliente_nome     = data.cliente_nome,
        cliente_doc      = data.cliente_doc,
        cliente_telefone = data.cliente_telefone,
        data_entrega     = date.fromisoformat(data.data_entrega) if data.data_entrega else None,
        tipo_entrega     = data.tipo_entrega,
        forma_recebimento = data.forma_recebimento,
        tipo_fiscal      = data.tipo_fiscal,
        observacoes      = data.observacoes,
        status           = "ABERTO",
    )
    db.add(pedido); db.flush()

    for it in data.itens:
        prod = db.query(Produto).filter_by(id=it.produto_id).first()
        if not prod: continue
        preco_final = it.preco_unitario * (1 - it.desconto_pct / 100)
        total_item  = preco_final * it.quantidade
        subtotal   += it.preco_unitario * it.quantidade
        desconto_total += (it.preco_unitario - preco_final) * it.quantidade
        db.add(ItemPedidoVenda(
            pedido_id      = pedido.id,
            produto_id     = it.produto_id,
            descricao      = prod.descricao,
            quantidade     = it.quantidade,
            preco_unitario = it.preco_unitario,
            desconto_pct   = it.desconto_pct,
            preco_final    = preco_final,
            total_item     = total_item,
        ))

    pedido.subtotal      = subtotal
    pedido.desconto_total = desconto_total
    pedido.total         = subtotal - desconto_total
    db.commit(); db.refresh(pedido)
    return _serial_pedido(pedido)


@router.get("/pedidos/{numero}")
def buscar_pedido(numero: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(PedidoVenda).filter(PedidoVenda.numero == numero.upper()).first()
    if not p: raise HTTPException(404, "Pedido não encontrado")
    return _serial_pedido(p)


@router.put("/pedidos/{pid}/status")
def atualizar_status(pid: int, status: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(PedidoVenda).filter_by(id=pid).first()
    if not p: raise HTTPException(404, "Pedido não encontrado")
    p.status = status.upper()
    db.commit()
    return {"ok": True}


# ── Endpoint específico para PDV carregar pedido ──────────────────────────────

@router.get("/pdv/{numero}")
def carregar_para_pdv(numero: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(PedidoVenda).filter(PedidoVenda.numero == numero.upper()).first()
    if not p:
        raise HTTPException(404, f"Pedido {numero.upper()} não encontrado")
    if p.status == "FATURADO":
        raise HTTPException(400, "Pedido já faturado")
    if p.status == "CANCELADO":
        raise HTTPException(400, "Pedido está cancelado")

    return {
        "id":                p.id,
        "numero":            p.numero,
        "tipo_fiscal":       p.tipo_fiscal,
        "forma_recebimento": p.forma_recebimento,
        "total":             p.total,
        "cliente_id":        p.cliente_id,
        "cliente_nome":      p.cliente_nome or (p.cliente.nome if p.cliente else "Consumidor Final"),
        "cliente_cpf":       (p.cliente.documento if p.cliente else None),
        "itens": [
            {
                "produto_id":     it.produto_id,
                "descricao":      it.descricao,
                "quantidade":     it.quantidade,
                "preco_unitario": it.preco_final,
                "unidade":        it.produto.unidade if it.produto else "UN",
                "codigo":         it.produto.codigo if it.produto else "",
            }
            for it in p.itens
        ],
    }


# ── Separação ─────────────────────────────────────────────────────────────────

class SeparacaoUpdate(BaseModel):
    status_separacao: str   # EM_SEPARACAO | PRONTO

@router.get("/separacao")
def listar_separacao(db: Session = Depends(get_db), _=Depends(get_current_user)):
    pedidos = db.query(PedidoVenda).filter(
        PedidoVenda.status.notin_(["FATURADO", "CANCELADO"]),
        PedidoVenda.status_separacao.notin_(["PRONTO"]),
    ).order_by(PedidoVenda.id.desc()).limit(100).all()
    return [{
        "id":               p.id,
        "numero":           p.numero,
        "cliente_nome":     p.cliente_nome or (p.cliente.nome if p.cliente else "Consumidor Final"),
        "status":           p.status,
        "status_separacao": getattr(p, "status_separacao", "PENDENTE") or "PENDENTE",
        "total":            p.total,
        "created_at":       p.created_at.isoformat() if p.created_at else None,
        "total_itens":      len(p.itens),
        "itens": [{
            "id":             it.id,
            "produto_id":     it.produto_id,
            "descricao":      it.descricao,
            "codigo":         it.produto.codigo if it.produto else "",
            "codigo_barras":  it.produto.codigo_barras if it.produto else None,
            "quantidade":     it.quantidade,
            "unidade":        it.produto.unidade if it.produto else "UN",
            "embalagem_qtd":  (it.produto.embalagem_qtd or 1) if it.produto else 1,
            "embalagem_tipo": (it.produto.embalagem_tipo or "UN") if it.produto else "UN",
        } for it in p.itens],
    } for p in pedidos]


@router.put("/pedidos/{pid}/separacao")
def atualizar_separacao(pid: int, data: SeparacaoUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(PedidoVenda).filter_by(id=pid).first()
    if not p: raise HTTPException(404, "Pedido não encontrado")
    status = data.status_separacao.upper()
    try:
        p.status_separacao = status
    except Exception:
        from sqlalchemy import text
        with db.connection() as conn:
            conn.execute(text(f"UPDATE pedidos_venda SET status_separacao='{status}' WHERE id={pid}"))
    if status == "PRONTO":
        p.status = "AGUARDANDO_PDV"
    db.commit()
    return {"ok": True, "status_separacao": status}


# ── Conferência de Pedidos (Cega) ─────────────────────────────────────────────

class ItemConfPedidoSchema(BaseModel):
    produto_id:    int
    descricao:     str
    qty_separada:  float
    qty_conferida: float

class FinalizarConfPedidoSchema(BaseModel):
    itens: List[ItemConfPedidoSchema]


@router.get("/conferencia")
def listar_pedidos_conferencia(db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Lista pedidos prontos para conferência (separação concluída, ainda não conferidos)."""
    from sqlalchemy import or_
    pedidos = db.query(PedidoVenda).filter(
        PedidoVenda.status_separacao == "PRONTO",
        PedidoVenda.status.notin_(["FATURADO", "CANCELADO"]),
        or_(
            PedidoVenda.status_conferencia == None,       # nunca conferido (NULL)
            PedidoVenda.status_conferencia == "DIVERGENCIA",  # divergência anterior
        )
    ).order_by(PedidoVenda.id.desc()).all()

    result = []
    for p in pedidos:
        tem_faltante = any(getattr(it, "faltante", False) for it in p.itens)
        result.append({
            "id":                 p.id,
            "numero":             p.numero,
            "cliente_nome":       p.cliente_nome or (p.cliente.nome if p.cliente else "Consumidor Final"),
            "status_separacao":   p.status_separacao,
            "status_conferencia": getattr(p, "status_conferencia", None),
            "total":              p.total,
            "total_itens":        len(p.itens),
            "tem_faltante":       tem_faltante,
            "itens": [{
                "id":            it.id,
                "produto_id":    it.produto_id,
                "descricao":     it.descricao,
                "codigo":        it.produto.codigo if it.produto else "",
                "codigo_barras": it.produto.codigo_barras if it.produto else None,
                "quantidade":    it.quantidade,
                "qty_separada":  it.quantidade,  # qty separada = qtd do pedido (em unidades)
                "unidade":       it.produto.unidade if it.produto else "UN",
                "embalagem_qtd": (it.produto.embalagem_qtd or 1) if it.produto else 1,
                "embalagem_tipo": (it.produto.embalagem_tipo or "UN") if it.produto else "UN",
            } for it in p.itens],
        })
    return result


@router.post("/pedidos/{pid}/conferencia-finalizar")
def finalizar_conf_pedido(pid: int, body: FinalizarConfPedidoSchema, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Salva resultado da conferência de pedido. Marca DIVERGENCIA ou CONFERIDO."""
    import json as _json
    from sqlalchemy import text as sqlt

    p = db.query(PedidoVenda).filter_by(id=pid).first()
    if not p:
        raise HTTPException(404, "Pedido não encontrado")

    itens_div = [
        it for it in body.itens
        if abs(it.qty_separada - it.qty_conferida) > 0.001
    ]
    tem_divergencia = len(itens_div) > 0

    status_conf = "DIVERGENCIA" if tem_divergencia else "CONFERIDO"

    # Salvar detalhe da divergência como JSON para exibição ao supervisor
    detalhe_json = _json.dumps([
        {
            "descricao":     it.descricao,
            "qty_separada":  it.qty_separada,
            "qty_conferida": it.qty_conferida,
        }
        for it in itens_div
    ]) if tem_divergencia else None

    # Garantir coluna conferencia_detalhe existe
    try:
        db.execute(sqlt("ALTER TABLE pedidos_venda ADD COLUMN IF NOT EXISTS conferencia_detalhe TEXT"))
        db.commit()
    except Exception:
        pass

    try:
        p.status_conferencia = status_conf
        if tem_divergencia:
            db.execute(sqlt(f"UPDATE pedidos_venda SET conferencia_detalhe=:d WHERE id=:id"),
                       {"d": detalhe_json, "id": pid})
        else:
            p.status = "PRONTO_NF"
    except Exception:
        db.execute(sqlt(f"UPDATE pedidos_venda SET status_conferencia='{status_conf}' WHERE id={pid}"))
        if tem_divergencia:
            db.execute(sqlt("UPDATE pedidos_venda SET conferencia_detalhe=:d WHERE id=:id"),
                       {"d": detalhe_json, "id": pid})
        else:
            db.execute(sqlt(f"UPDATE pedidos_venda SET status='PRONTO_NF' WHERE id={pid}"))

    db.commit()
    return {
        "ok":               True,
        "tem_divergencia":  tem_divergencia,
        "status_conferencia": status_conf,
    }


@router.get("/divergencias")
def listar_divergencias(db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Lista pedidos com divergência de conferência aguardando liberação do supervisor."""
    from sqlalchemy import text as sqlt
    import json as _json
    pedidos = db.query(PedidoVenda).filter(
        PedidoVenda.status_conferencia == "DIVERGENCIA"
    ).order_by(PedidoVenda.id.desc()).all()

    result = []
    for p in pedidos:
        # Buscar detalhe da divergência
        row = db.execute(sqlt("SELECT conferencia_detalhe FROM pedidos_venda WHERE id=:id"), {"id": p.id}).fetchone()
        detalhe = []
        if row and row[0]:
            try: detalhe = _json.loads(row[0])
            except: pass

        result.append({
            "id":             p.id,
            "numero":         p.numero,
            "cliente_nome":   p.cliente_nome or (p.cliente.nome if p.cliente else "Consumidor Final"),
            "total":          p.total,
            "total_itens":    len(p.itens),
            "detalhe":        detalhe,
        })
    return result


@router.post("/pedidos/{pid}/liberar-divergencia")
def liberar_divergencia(pid: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Supervisor libera pedido com divergência → segue para NF."""
    from sqlalchemy import text as sqlt
    p = db.query(PedidoVenda).filter_by(id=pid).first()
    if not p:
        raise HTTPException(404, "Pedido não encontrado")
    try:
        p.status_conferencia = "LIBERADO"
        p.status = "PRONTO_NF"
    except Exception:
        db.execute(sqlt(f"UPDATE pedidos_venda SET status_conferencia='LIBERADO', status='PRONTO_NF' WHERE id={pid}"))
    db.commit()
    return {"ok": True}


@router.post("/pedidos/{pid}/reconferir")
def reconferir_pedido(pid: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Supervisor devolve pedido para reconferência."""
    from sqlalchemy import text as sqlt
    p = db.query(PedidoVenda).filter_by(id=pid).first()
    if not p:
        raise HTTPException(404, "Pedido não encontrado")
    try:
        p.status_conferencia = None
    except Exception:
        db.execute(sqlt(f"UPDATE pedidos_venda SET status_conferencia=NULL WHERE id={pid}"))
    db.commit()
    return {"ok": True}
