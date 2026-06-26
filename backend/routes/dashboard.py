from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import Venda, ItemVenda, Produto, ContaPagar, ContaReceber
from utils.security import get_current_user
from datetime import date, timedelta

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/")
def dashboard(db: Session = Depends(get_db), _=Depends(get_current_user)):
    hoje = date.today()
    ontem = hoje - timedelta(days=1)
    inicio_mes = hoje.replace(day=1)
    inicio_semana = hoje - timedelta(days=hoje.weekday())
    inicio_sem_ant = inicio_semana - timedelta(days=7)
    fim_sem_ant = inicio_semana - timedelta(days=1)

    # ── Vendas do mês ─────────────────────────────────────────────────────────
    vendas_mes = db.query(Venda).filter(
        Venda.data_venda >= inicio_mes,
        Venda.status == "FINALIZADA"
    ).all()
    total_mes = sum(v.total for v in vendas_mes)

    # ── Vendas de hoje e ontem ─────────────────────────────────────────────────
    vendas_hoje = [v for v in vendas_mes if v.data_venda == hoje]
    total_hoje = sum(v.total for v in vendas_hoje)
    ticket_medio_hoje = round(total_hoje / len(vendas_hoje), 2) if vendas_hoje else 0.0

    vendas_ontem = db.query(Venda).filter(
        Venda.data_venda == ontem,
        Venda.status == "FINALIZADA"
    ).all()
    total_ontem = sum(v.total for v in vendas_ontem)
    pct_vs_ontem = round(((total_hoje - total_ontem) / total_ontem) * 100, 1) if total_ontem > 0 else 0.0

    # ── Custo e lucro do mês ──────────────────────────────────────────────────
    custo_mes = sum(
        sum(i.quantidade * i.custo_unitario for i in v.itens) for v in vendas_mes
    )
    lucro_mes = round(total_mes - custo_mes, 2)
    margem_pct = round((lucro_mes / total_mes) * 100, 2) if total_mes > 0 else 0.0

    # ── Vendas da semana atual vs anterior ────────────────────────────────────
    vendas_semana = sum(
        v.total for v in vendas_mes if v.data_venda >= inicio_semana
    )
    vendas_sem_ant = db.query(func.sum(Venda.total)).filter(
        Venda.data_venda >= inicio_sem_ant,
        Venda.data_venda <= fim_sem_ant,
        Venda.status == "FINALIZADA"
    ).scalar() or 0.0
    pct_semana = round(((vendas_semana - vendas_sem_ant) / vendas_sem_ant) * 100, 1) if vendas_sem_ant > 0 else 0.0

    # ── Estoque ───────────────────────────────────────────────────────────────
    prods = db.query(Produto).filter(Produto.is_active == True).all()
    estoque_baixo = sum(1 for p in prods if 0 < p.estoque_atual <= p.estoque_minimo and p.estoque_minimo > 0)
    estoque_zerado = sum(1 for p in prods if p.estoque_atual <= 0 and p.estoque_minimo > 0)

    # ── Financeiro ────────────────────────────────────────────────────────────
    cp_total = db.query(func.sum(ContaPagar.valor)).filter(
        ContaPagar.status.in_(["PENDENTE", "VENCIDO"])
    ).scalar() or 0

    cp_vencidas = db.query(func.sum(ContaPagar.valor)).filter(
        ContaPagar.status == "PENDENTE",
        ContaPagar.vencimento < hoje
    ).scalar() or 0

    cp_hoje = db.query(func.count(ContaPagar.id)).filter(
        ContaPagar.status == "PENDENTE",
        ContaPagar.vencimento == hoje
    ).scalar() or 0

    cp_7dias = db.query(func.sum(ContaPagar.valor)).filter(
        ContaPagar.status == "PENDENTE",
        ContaPagar.vencimento >= hoje,
        ContaPagar.vencimento <= hoje + timedelta(days=7)
    ).scalar() or 0

    cr_total = db.query(func.sum(ContaReceber.valor)).filter(
        ContaReceber.status.in_(["PENDENTE", "VENCIDO"])
    ).scalar() or 0

    cr_vencidas = db.query(func.sum(ContaReceber.valor)).filter(
        ContaReceber.status == "PENDENTE",
        ContaReceber.vencimento < hoje
    ).scalar() or 0

    # ── Alertas ───────────────────────────────────────────────────────────────
    alertas = []
    if cp_vencidas > 0:
        alertas.append({
            "tipo": "danger",
            "icone": "💳",
            "titulo": "Contas vencidas",
            "descricao": f"R$ {cp_vencidas:,.2f} em aberto",
            "acao": "/financeiro/pagar"
        })
    if cp_hoje > 0:
        alertas.append({
            "tipo": "warning",
            "icone": "📅",
            "titulo": f"{cp_hoje} conta(s) vence(m) hoje",
            "descricao": "Verifique o contas a pagar",
            "acao": "/financeiro/pagar"
        })
    if estoque_zerado > 0:
        alertas.append({
            "tipo": "danger",
            "icone": "🚫",
            "titulo": f"{estoque_zerado} produto(s) zerado(s)",
            "descricao": "Ruptura de estoque — pedido urgente",
            "acao": "/estoque"
        })
    if estoque_baixo > 0:
        alertas.append({
            "tipo": "warning",
            "icone": "⚠️",
            "titulo": f"{estoque_baixo} produto(s) abaixo do mínimo",
            "descricao": "Programar reposição em breve",
            "acao": "/estoque"
        })
    if cr_vencidas > 0:
        alertas.append({
            "tipo": "info",
            "icone": "💰",
            "titulo": "Recebíveis vencidos",
            "descricao": f"R$ {cr_vencidas:,.2f} a cobrar",
            "acao": "/financeiro/receber"
        })

    # ── Gráfico 30 dias ───────────────────────────────────────────────────────
    vendas_30 = db.query(Venda).filter(
        Venda.data_venda >= hoje - timedelta(days=29),
        Venda.status == "FINALIZADA"
    ).all()
    dias: dict = {}
    for v in vendas_30:
        key = str(v.data_venda)
        dias[key] = dias.get(key, 0) + v.total
    grafico_vendas = [{"data": k, "total": round(v, 2)} for k, v in sorted(dias.items())]

    # ── Top 5 produtos ────────────────────────────────────────────────────────
    top_prods: dict = {}
    for v in vendas_mes:
        for item in v.itens:
            pid = item.produto_id
            desc = item.descricao_snap or (item.produto.descricao if item.produto else f"#{pid}")
            if pid not in top_prods:
                top_prods[pid] = {"produto": desc, "quantidade": 0, "total": 0}
            top_prods[pid]["quantidade"] += item.quantidade
            top_prods[pid]["total"] += item.total_item
    top5 = sorted(top_prods.values(), key=lambda x: x["total"], reverse=True)[:5]

    # ── Formas de pagamento ───────────────────────────────────────────────────
    formas: dict = {}
    for v in vendas_mes:
        f = v.forma_pagamento
        formas[f] = formas.get(f, 0) + v.total
    formas_list = [{"forma": k, "total": round(v, 2)} for k, v in sorted(formas.items(), key=lambda x: -x[1])]

    return {
        "hoje": {
            "vendas": len(vendas_hoje),
            "total": round(total_hoje, 2),
            "ticket_medio": ticket_medio_hoje,
            "pct_vs_ontem": pct_vs_ontem,
        },
        "mes": {
            "vendas": len(vendas_mes),
            "total": round(total_mes, 2),
            "custo": round(custo_mes, 2),
            "lucro": lucro_mes,
            "margem": margem_pct,
        },
        "semana": {
            "total": round(vendas_semana, 2),
            "pct_vs_anterior": pct_semana,
        },
        "financeiro": {
            "contas_pagar": round(cp_total, 2),
            "contas_pagar_vencidas": round(cp_vencidas, 2),
            "contas_pagar_7dias": round(cp_7dias, 2),
            "contas_receber": round(cr_total, 2),
            "contas_receber_vencidas": round(cr_vencidas, 2),
        },
        "estoque": {
            "total_produtos": len(prods),
            "abaixo_minimo": estoque_baixo,
            "zerado": estoque_zerado,
        },
        "alertas": alertas,
        "grafico_vendas": grafico_vendas,
        "top_produtos": top5,
        "formas_pagamento": formas_list,
    }
