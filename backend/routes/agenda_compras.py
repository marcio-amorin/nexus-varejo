from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import (
    AgendaFornecedor, Fornecedor, PedidoCompra, ItemPedidoCompra,
    ProdutoFornecedor, Produto, ItemVenda, Venda,
)
from utils.security import get_current_user
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, timedelta

router = APIRouter(prefix="/agenda-compras", tags=["agenda_compras"])


class AgendaSchema(BaseModel):
    fornecedor_id:        int
    frequencia_dias:      int   = 7
    proxima_visita:       Optional[date] = None
    dias_media_venda:     int   = 15
    dias_entrega:         int   = 2
    ativo:                bool  = True
    observacoes:          Optional[str] = None
    percentual_reposicao: float = 0.0
    margem_seguranca_pct: float = 0.0
    reposicao_adicional:  float = 0.0
    dias_venda_filtro:    int   = 0
    gerar_automatico:     bool  = True


def _agenda_dict(a: AgendaFornecedor, forn: Fornecedor, hoje: date) -> dict:
    prox = a.proxima_visita
    dias_restantes = (prox - hoje).days if prox else None
    alerta = dias_restantes is not None and dias_restantes <= 2
    return {
        "id":                    a.id,
        "fornecedor_id":         a.fornecedor_id,
        "fornecedor_nome":       forn.fantasia or forn.razao_social,
        "fornecedor_cnpj":       forn.cnpj_cpf,
        "frequencia_dias":       a.frequencia_dias,
        "proxima_visita":        str(prox) if prox else None,
        "dias_restantes":        dias_restantes,
        "alerta_d2":             alerta,
        "dias_media_venda":      a.dias_media_venda,
        "dias_entrega":          a.dias_entrega,
        "ativo":                 a.ativo,
        "observacoes":           a.observacoes,
        "percentual_reposicao":  a.percentual_reposicao or 0.0,
        "margem_seguranca_pct":  a.margem_seguranca_pct or 0.0,
        "reposicao_adicional":   a.reposicao_adicional  or 0.0,
        "dias_venda_filtro":     a.dias_venda_filtro    or 0,
        "gerar_automatico":      a.gerar_automatico if a.gerar_automatico is not None else True,
    }


@router.get("/")
def listar_agendas(db: Session = Depends(get_db), _=Depends(get_current_user)):
    hoje = date.today()
    agendas = db.query(AgendaFornecedor).filter(AgendaFornecedor.ativo == True).all()
    result = []
    for a in agendas:
        forn = db.query(Fornecedor).filter(Fornecedor.id == a.fornecedor_id).first()
        if forn:
            result.append(_agenda_dict(a, forn, hoje))
    result.sort(key=lambda x: x["dias_restantes"] if x["dias_restantes"] is not None else 9999)
    return result


@router.get("/{forn_id}")
def get_agenda(forn_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    a = db.query(AgendaFornecedor).filter(AgendaFornecedor.fornecedor_id == forn_id).first()
    forn = db.query(Fornecedor).filter(Fornecedor.id == forn_id).first()
    if not forn:
        raise HTTPException(404, "Fornecedor não encontrado")
    if not a:
        return {"fornecedor_id": forn_id, "fornecedor_nome": forn.fantasia or forn.razao_social,
                "frequencia_dias": 7, "proxima_visita": None, "dias_media_venda": 15, "dias_entrega": 2}
    return _agenda_dict(a, forn, date.today())


@router.post("/")
def salvar_agenda(data: AgendaSchema, db: Session = Depends(get_db), _=Depends(get_current_user)):
    a = db.query(AgendaFornecedor).filter(AgendaFornecedor.fornecedor_id == data.fornecedor_id).first()
    if a:
        for k, v in data.dict().items():
            setattr(a, k, v)
    else:
        a = AgendaFornecedor(**data.dict())
        db.add(a)
    db.commit(); db.refresh(a)
    forn = db.query(Fornecedor).filter(Fornecedor.id == a.fornecedor_id).first()
    return _agenda_dict(a, forn, date.today())


def _calcular_sugestao(forn_id: int, db: Session) -> dict:
    """Calcula a sugestão de compra para um fornecedor com a fórmula completa."""
    agenda = db.query(AgendaFornecedor).filter(AgendaFornecedor.fornecedor_id == forn_id).first()
    if not agenda:
        raise HTTPException(404, "Agenda não configurada para este fornecedor")

    # parâmetros
    dias_media    = (agenda.dias_venda_filtro or 0) if (agenda.dias_venda_filtro or 0) > 0 else agenda.dias_media_venda
    dias_cobrir   = agenda.dias_entrega + agenda.frequencia_dias
    pct_reposicao = (agenda.percentual_reposicao or 0.0) / 100
    pct_margem    = (agenda.margem_seguranca_pct  or 0.0) / 100
    repos_adicional = agenda.reposicao_adicional or 0.0

    links = db.query(ProdutoFornecedor).filter(ProdutoFornecedor.fornecedor_id == forn_id).all()
    if not links:
        return {"itens": [], "total_itens": 0, "valor_total": 0.0,
                "dias_media": dias_media, "dias_cobrir": dias_cobrir}

    data_ini = date.today() - timedelta(days=dias_media)
    itens = []

    for link in links:
        prod = db.query(Produto).filter(Produto.id == link.produto_id, Produto.is_active == True).first()
        if not prod:
            continue

        total_vendido = db.query(func.sum(ItemVenda.quantidade)).join(Venda).filter(
            ItemVenda.produto_id == prod.id,
            Venda.data_venda >= data_ini,
            Venda.status == "FINALIZADA",
        ).scalar() or 0.0

        media_diaria   = total_vendido / dias_media if dias_media > 0 else 0
        qty_base       = media_diaria * dias_cobrir
        qty_com_margem = qty_base * (1 + pct_margem)
        qty_final      = qty_com_margem * (1 + pct_reposicao) + repos_adicional
        qty_sugerir    = max(0, round(qty_final - prod.estoque_atual, 2))

        itens.append({
            "produto_id":      prod.id,
            "codigo":          prod.codigo,
            "descricao":       prod.descricao,
            "unidade":         prod.unidade,
            "estoque_atual":   prod.estoque_atual,
            "estoque_minimo":  prod.estoque_minimo,
            "media_diaria":    round(media_diaria, 3),
            "dias_cobrir":     dias_cobrir,
            "qty_necessaria":  round(qty_base, 2),
            "qty_sugerida":    qty_sugerir,
            "preco_custo":     prod.preco_custo,
            "valor_total":     round(qty_sugerir * prod.preco_custo, 2),
            "principal":       link.principal,
        })

    itens.sort(key=lambda x: (-x["principal"], x["descricao"]))
    valor_total = sum(i["valor_total"] for i in itens)
    return {"itens": itens, "total_itens": len(itens), "valor_total": round(valor_total, 2),
            "dias_media": dias_media, "dias_cobrir": dias_cobrir,
            "pct_reposicao": pct_reposicao * 100, "pct_margem": pct_margem * 100}


@router.get("/{forn_id}/sugestao")
def sugestao_pedido(forn_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return _calcular_sugestao(forn_id, db)


def _criar_pedido_compra(forn_id: int, itens_data: list, obs: str,
                          origem: str, db: Session, criado_por: str) -> dict:
    """Utilitário interno para criar um PedidoCompra."""
    agenda = db.query(AgendaFornecedor).filter(AgendaFornecedor.fornecedor_id == forn_id).first()

    ultimo = db.query(func.max(PedidoCompra.numero)).scalar() or "PC-00000"
    try:
        seq = int(ultimo.split("-")[1]) + 1
    except Exception:
        seq = 1
    numero = f"PC-{seq:05d}"

    prazo_entrega = date.today() + timedelta(days=agenda.dias_entrega if agenda else 2)

    pedido = PedidoCompra(
        numero=numero,
        fornecedor_id=forn_id,
        status="RASCUNHO",
        origem=origem,
        data_pedido=date.today(),
        prazo_entrega=prazo_entrega,
        criado_por=criado_por,
        observacoes=obs,
    )
    db.add(pedido); db.flush()

    valor_total = 0.0
    for item in itens_data:
        qty = float(item.get("qty_sugerida", 0))
        if qty <= 0:
            continue
        preco = float(item.get("preco_custo", 0))
        vt = round(qty * preco, 2)
        valor_total += vt
        db.add(ItemPedidoCompra(
            pedido_id=pedido.id,
            produto_id=item["produto_id"],
            quantidade=qty,
            preco_unitario=preco,
            valor_total=vt,
        ))

    pedido.valor_total = round(valor_total, 2)
    return {"pedido": pedido, "numero": numero, "valor_total": valor_total}


@router.post("/{forn_id}/gerar-pedido")
def gerar_pedido(forn_id: int, body: dict, db: Session = Depends(get_db), u=Depends(get_current_user)):
    """Gera um PedidoCompra a partir da sugestão confirmada (origem MANUAL)."""
    itens_data = body.get("itens", [])
    if not itens_data:
        raise HTTPException(400, "Nenhum item informado")

    res = _criar_pedido_compra(
        forn_id, itens_data,
        body.get("observacoes", "Gerado pela agenda de compras"),
        "MANUAL", db, u.nome if u else "sistema",
    )
    pedido = res["pedido"]

    agenda = db.query(AgendaFornecedor).filter(AgendaFornecedor.fornecedor_id == forn_id).first()
    if agenda:
        agenda.proxima_visita = date.today() + timedelta(days=agenda.frequencia_dias)

    db.commit()
    return {"ok": True, "pedido_id": pedido.id, "numero": res["numero"], "valor_total": res["valor_total"]}


@router.get("/auto/pendentes")
def auto_pendentes(db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Retorna fornecedores com visita em ≤ 2 dias que ainda não têm pedido RASCUNHO/AUTO gerado."""
    hoje = date.today()
    limite = hoje + timedelta(days=2)
    agendas = db.query(AgendaFornecedor).filter(
        AgendaFornecedor.ativo == True,
        AgendaFornecedor.gerar_automatico == True,
        AgendaFornecedor.proxima_visita != None,
        AgendaFornecedor.proxima_visita <= limite,
    ).all()

    result = []
    for a in agendas:
        forn = db.query(Fornecedor).filter(Fornecedor.id == a.fornecedor_id).first()
        if not forn:
            continue
        # verifica se já tem pedido AUTO em RASCUNHO para esta data
        pedido_existente = db.query(PedidoCompra).filter(
            PedidoCompra.fornecedor_id == a.fornecedor_id,
            PedidoCompra.origem == "AUTO",
            PedidoCompra.status == "RASCUNHO",
            PedidoCompra.data_pedido == hoje,
        ).first()
        d = _agenda_dict(a, forn, hoje)
        d["pedido_auto_id"]     = pedido_existente.id if pedido_existente else None
        d["pedido_auto_numero"] = pedido_existente.numero if pedido_existente else None
        result.append(d)

    result.sort(key=lambda x: x["dias_restantes"] if x["dias_restantes"] is not None else 9999)
    return result


@router.post("/auto/gerar-todos")
def auto_gerar_todos(db: Session = Depends(get_db), u=Depends(get_current_user)):
    """Gera pedidos automáticos para todos os fornecedores com visita em <= 2 dias."""
    hoje = date.today()
    limite = hoje + timedelta(days=2)
    agendas = db.query(AgendaFornecedor).filter(
        AgendaFornecedor.ativo == True,
        AgendaFornecedor.gerar_automatico == True,
        AgendaFornecedor.proxima_visita != None,
        AgendaFornecedor.proxima_visita <= limite,
    ).all()

    gerados = []
    ignorados = []

    for a in agendas:
        existente = db.query(PedidoCompra).filter(
            PedidoCompra.fornecedor_id == a.fornecedor_id,
            PedidoCompra.origem == "AUTO",
            PedidoCompra.status == "RASCUNHO",
            PedidoCompra.data_pedido == hoje,
        ).first()
        if existente:
            ignorados.append({"fornecedor_id": a.fornecedor_id, "motivo": "pedido já existe"})
            continue

        try:
            sugestao = _calcular_sugestao(a.fornecedor_id, db)
            itens_com_qty = [i for i in sugestao["itens"] if i["qty_sugerida"] > 0]
            if not itens_com_qty:
                ignorados.append({"fornecedor_id": a.fornecedor_id, "motivo": "sem itens para pedir"})
                continue
            forn = db.query(Fornecedor).filter(Fornecedor.id == a.fornecedor_id).first()
            res = _criar_pedido_compra(
                a.fornecedor_id, itens_com_qty,
                f"Gerado automaticamente — visita em {a.proxima_visita}",
                "AUTO", db, u.nome if u else "sistema",
            )
            db.flush()
            gerados.append({
                "fornecedor_id":   a.fornecedor_id,
                "fornecedor_nome": forn.fantasia or forn.razao_social if forn else str(a.fornecedor_id),
                "numero":          res["numero"],
                "valor_total":     res["valor_total"],
                "itens":           len(itens_com_qty),
            })
        except Exception as e:
            ignorados.append({"fornecedor_id": a.fornecedor_id, "motivo": str(e)})

    db.commit()
    return {"gerados": gerados, "ignorados": ignorados, "total_gerados": len(gerados)}


@router.post("/{forn_id}/auto-gerar")
def auto_gerar_um(forn_id: int, db: Session = Depends(get_db), u=Depends(get_current_user)):
    """Gera pedido automático para um fornecedor específico."""
    existente = db.query(PedidoCompra).filter(
        PedidoCompra.fornecedor_id == forn_id,
        PedidoCompra.origem == "AUTO",
        PedidoCompra.status == "RASCUNHO",
        PedidoCompra.data_pedido == date.today(),
    ).first()
    if existente:
        return {"ok": False, "mensagem": "Pedido automático já gerado hoje", "pedido_id": existente.id, "numero": existente.numero}

    sugestao = _calcular_sugestao(forn_id, db)
    itens_com_qty = [i for i in sugestao["itens"] if i["qty_sugerida"] > 0]
    if not itens_com_qty:
        raise HTTPException(400, "Nenhum produto necessita reposição")

    agenda = db.query(AgendaFornecedor).filter(AgendaFornecedor.fornecedor_id == forn_id).first()
    res = _criar_pedido_compra(
        forn_id, itens_com_qty,
        f"Gerado automaticamente — visita em {agenda.proxima_visita if agenda else 'agendada'}",
        "AUTO", db, u.nome if u else "sistema",
    )
    db.commit()
    return {"ok": True, "pedido_id": res["pedido"].id, "numero": res["numero"],
            "valor_total": res["valor_total"], "itens": len(itens_com_qty)}
