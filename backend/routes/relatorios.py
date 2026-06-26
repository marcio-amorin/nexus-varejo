from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database import get_db
from models import Venda, ItemVenda, Produto, CategoriaProduto, Cliente, MovimentoEstoque
from utils.security import get_current_user
from typing import Optional
from datetime import date

router = APIRouter(prefix="/relatorios", tags=["relatorios"])


@router.get("/vendas-periodo")
def vendas_periodo(
    data_ini: date, data_fim: date,
    db: Session = Depends(get_db), _=Depends(get_current_user),
):
    vendas = db.query(Venda).filter(
        Venda.data_venda >= data_ini,
        Venda.data_venda <= data_fim,
        Venda.status == "FINALIZADA"
    ).order_by(Venda.data_venda).all()

    total = sum(v.total for v in vendas)
    custo = sum(sum(i.quantidade * i.custo_unitario for i in v.itens) for v in vendas)

    return {
        "resumo": {
            "total_vendas": len(vendas),
            "total_vendido": round(total, 2),
            "total_custo": round(custo, 2),
            "lucro_bruto": round(total - custo, 2),
            "margem_media": round(((total - custo) / total) * 100, 2) if total > 0 else 0,
            "ticket_medio": round(total / len(vendas), 2) if vendas else 0,
        },
        "vendas": [{
            "id": v.id,
            "numero": v.numero,
            "data": str(v.data_venda),
            "cliente": v.cliente_nome or (v.cliente.nome if v.cliente else "Consumidor Final"),
            "total": v.total,
            "desconto": v.desconto,
            "forma_pagamento": v.forma_pagamento,
            "itens": len(v.itens),
        } for v in vendas],
    }


@router.get("/vendas-por-produto")
def vendas_por_produto(
    data_ini: date, data_fim: date,
    db: Session = Depends(get_db), _=Depends(get_current_user),
):
    vendas = db.query(Venda).filter(
        Venda.data_venda >= data_ini,
        Venda.data_venda <= data_fim,
        Venda.status == "FINALIZADA"
    ).all()

    prods: dict = {}
    for v in vendas:
        for item in v.itens:
            pid = item.produto_id
            if pid not in prods:
                prod = db.query(Produto).filter(Produto.id == pid).first()
                prods[pid] = {
                    "produto_id": pid,
                    "codigo": prod.codigo if prod else "",
                    "descricao": item.descricao_snap or (prod.descricao if prod else f"#{pid}"),
                    "unidade": prod.unidade if prod else "UN",
                    "quantidade": 0, "total_vendido": 0, "total_custo": 0,
                }
            prods[pid]["quantidade"]    += item.quantidade
            prods[pid]["total_vendido"] += item.total_item
            prods[pid]["total_custo"]   += item.quantidade * item.custo_unitario

    result = list(prods.values())
    for r in result:
        r["lucro"] = round(r["total_vendido"] - r["total_custo"], 2)
        r["margem"] = round(((r["total_vendido"] - r["total_custo"]) / r["total_vendido"]) * 100, 2) if r["total_vendido"] > 0 else 0
        r["total_vendido"] = round(r["total_vendido"], 2)
        r["total_custo"]   = round(r["total_custo"], 2)

    return sorted(result, key=lambda x: x["total_vendido"], reverse=True)


@router.get("/vendas-por-categoria")
def vendas_por_categoria(
    data_ini: date, data_fim: date,
    db: Session = Depends(get_db), _=Depends(get_current_user),
):
    vendas = db.query(Venda).filter(
        Venda.data_venda >= data_ini,
        Venda.data_venda <= data_fim,
        Venda.status == "FINALIZADA"
    ).all()

    cats: dict = {}
    for v in vendas:
        for item in v.itens:
            prod = db.query(Produto).filter(Produto.id == item.produto_id).first()
            cat_id = prod.categoria_id if prod else None
            cat_nome = prod.categoria.nome if prod and prod.categoria else "Sem Categoria"
            key = cat_id or 0
            if key not in cats:
                cats[key] = {"categoria": cat_nome, "quantidade": 0, "total": 0, "custo": 0}
            cats[key]["quantidade"] += item.quantidade
            cats[key]["total"]      += item.total_item
            cats[key]["custo"]      += item.quantidade * item.custo_unitario

    result = list(cats.values())
    for r in result:
        r["lucro"]  = round(r["total"] - r["custo"], 2)
        r["margem"] = round(((r["total"] - r["custo"]) / r["total"]) * 100, 2) if r["total"] > 0 else 0
        r["total"]  = round(r["total"], 2)
        r["custo"]  = round(r["custo"], 2)
    return sorted(result, key=lambda x: x["total"], reverse=True)


@router.get("/vendas-por-forma-pagamento")
def vendas_por_forma_pagamento(
    data_ini: date, data_fim: date,
    db: Session = Depends(get_db), _=Depends(get_current_user),
):
    vendas = db.query(Venda).filter(
        Venda.data_venda >= data_ini,
        Venda.data_venda <= data_fim,
        Venda.status == "FINALIZADA"
    ).all()

    formas: dict = {}
    for v in vendas:
        f = v.forma_pagamento
        if f not in formas:
            formas[f] = {"forma": f, "quantidade": 0, "total": 0}
        formas[f]["quantidade"] += 1
        formas[f]["total"]      += v.total

    result = list(formas.values())
    total_geral = sum(r["total"] for r in result)
    for r in result:
        r["total"]      = round(r["total"], 2)
        r["percentual"] = round((r["total"] / total_geral) * 100, 2) if total_geral > 0 else 0

    return sorted(result, key=lambda x: x["total"], reverse=True)


@router.get("/curva-abc")
def curva_abc(
    data_ini: date, data_fim: date,
    db: Session = Depends(get_db), _=Depends(get_current_user),
):
    vendas = db.query(Venda).filter(
        Venda.data_venda >= data_ini,
        Venda.data_venda <= data_fim,
        Venda.status == "FINALIZADA"
    ).all()

    prods: dict = {}
    for v in vendas:
        for item in v.itens:
            pid = item.produto_id
            prod = db.query(Produto).filter(Produto.id == pid).first()
            if pid not in prods:
                prods[pid] = {
                    "produto": item.descricao_snap or (prod.descricao if prod else f"#{pid}"),
                    "codigo": prod.codigo if prod else "",
                    "total": 0,
                }
            prods[pid]["total"] += item.total_item

    result = sorted(prods.values(), key=lambda x: x["total"], reverse=True)
    total_geral = sum(r["total"] for r in result)
    acumulado = 0
    for r in result:
        r["total"]      = round(r["total"], 2)
        r["percentual"] = round((r["total"] / total_geral) * 100, 2) if total_geral > 0 else 0
        acumulado      += r["percentual"]
        r["acumulado"]  = round(acumulado, 2)
        r["curva"]      = "A" if acumulado <= 80 else ("B" if acumulado <= 95 else "C")

    return result


@router.get("/margem-produtos")
def margem_produtos(
    db: Session = Depends(get_db), _=Depends(get_current_user),
):
    prods = db.query(Produto).filter(Produto.is_active == True).order_by(Produto.margem.desc()).all()
    return [{
        "id": p.id,
        "codigo": p.codigo,
        "descricao": p.descricao,
        "preco_custo": p.preco_custo,
        "preco_venda": p.preco_venda,
        "margem": p.margem,
        "markup": round(((p.preco_venda - p.preco_custo) / p.preco_custo) * 100, 2) if p.preco_custo > 0 else 0,
        "estoque_atual": p.estoque_atual,
        "valor_estoque": round(p.estoque_atual * p.preco_custo, 2),
    } for p in prods]


@router.get("/estoque-atual")
def estoque_atual(
    db: Session = Depends(get_db), _=Depends(get_current_user),
):
    prods = db.query(Produto).filter(Produto.is_active == True).order_by(Produto.descricao).all()
    return [{
        "codigo": p.codigo,
        "descricao": p.descricao,
        "unidade": p.unidade,
        "estoque_atual": p.estoque_atual,
        "estoque_minimo": p.estoque_minimo,
        "preco_custo": p.preco_custo,
        "preco_venda": p.preco_venda,
        "valor_custo": round(p.estoque_atual * p.preco_custo, 2),
        "valor_venda": round(p.estoque_atual * p.preco_venda, 2),
        "status": "CRITICO" if p.estoque_atual <= 0 else ("BAIXO" if p.estoque_atual <= p.estoque_minimo else "OK"),
    } for p in prods]


@router.get("/dre-simplificado")
def dre_simplificado(
    data_ini: date, data_fim: date,
    db: Session = Depends(get_db), _=Depends(get_current_user),
):
    from models import ContaPagar
    vendas = db.query(Venda).filter(
        Venda.data_venda >= data_ini,
        Venda.data_venda <= data_fim,
        Venda.status == "FINALIZADA"
    ).all()

    receita_bruta  = sum(v.subtotal for v in vendas)
    descontos      = sum(v.desconto for v in vendas)
    receita_liq    = receita_bruta - descontos
    custo_produtos = sum(sum(i.quantidade * i.custo_unitario for i in v.itens) for v in vendas)
    lucro_bruto    = receita_liq - custo_produtos

    # Despesas (contas a pagar pagas no período)
    contas = db.query(ContaPagar).filter(
        ContaPagar.pago_em >= data_ini,
        ContaPagar.pago_em <= data_fim,
        ContaPagar.status == "PAGO"
    ).all()
    total_despesas = sum(c.valor_pago or c.valor for c in contas)
    lucro_operacional = lucro_bruto - total_despesas

    margem_bruta = round((lucro_bruto / receita_liq) * 100, 2) if receita_liq > 0 else 0
    margem_op    = round((lucro_operacional / receita_liq) * 100, 2) if receita_liq > 0 else 0

    return {
        "periodo": {"ini": str(data_ini), "fim": str(data_fim)},
        "receita_bruta": round(receita_bruta, 2),
        "descontos": round(descontos, 2),
        "receita_liquida": round(receita_liq, 2),
        "custo_mercadorias": round(custo_produtos, 2),
        "lucro_bruto": round(lucro_bruto, 2),
        "margem_bruta": margem_bruta,
        "despesas_operacionais": round(total_despesas, 2),
        "lucro_operacional": round(lucro_operacional, 2),
        "margem_operacional": margem_op,
        "total_vendas": len(vendas),
        "ticket_medio": round(receita_liq / len(vendas), 2) if vendas else 0,
    }


@router.get("/fluxo-caixa")
def fluxo_caixa(
    data_ini: date, data_fim: date,
    db: Session = Depends(get_db), _=Depends(get_current_user),
):
    from models import ContaPagar, ContaReceber
    from datetime import timedelta

    # Gerar lista de dias no período
    dias = []
    d = data_ini
    while d <= data_fim:
        dias.append(d)
        d += timedelta(days=1)

    # Vendas por dia
    vendas_all = db.query(Venda).filter(
        Venda.data_venda >= data_ini,
        Venda.data_venda <= data_fim,
        Venda.status == "FINALIZADA"
    ).all()
    vendas_dia: dict = {}
    for v in vendas_all:
        k = str(v.data_venda)
        vendas_dia[k] = vendas_dia.get(k, 0) + v.total

    # Contas pagas por dia (saídas)
    cp_all = db.query(ContaPagar).filter(
        ContaPagar.pago_em >= data_ini,
        ContaPagar.pago_em <= data_fim,
        ContaPagar.status == "PAGO"
    ).all()
    cp_dia: dict = {}
    for c in cp_all:
        k = str(c.pago_em)
        cp_dia[k] = cp_dia.get(k, 0) + (c.valor_pago or c.valor)

    # Contas recebidas por dia (entradas extras)
    cr_all = db.query(ContaReceber).filter(
        ContaReceber.recebido_em >= data_ini,
        ContaReceber.recebido_em <= data_fim,
        ContaReceber.status == "RECEBIDO"
    ).all()
    cr_dia: dict = {}
    for c in cr_all:
        k = str(c.recebido_em)
        cr_dia[k] = cr_dia.get(k, 0) + (c.valor_recebido or c.valor)

    # Montar fluxo dia a dia
    saldo = 0.0
    fluxo = []
    for d in dias:
        k = str(d)
        entradas = round(vendas_dia.get(k, 0) + cr_dia.get(k, 0), 2)
        saidas   = round(cp_dia.get(k, 0), 2)
        saldo    = round(saldo + entradas - saidas, 2)
        fluxo.append({
            "data": k,
            "entradas": entradas,
            "saidas": saidas,
            "saldo_dia": round(entradas - saidas, 2),
            "saldo_acumulado": saldo,
        })

    total_entradas = round(sum(f["entradas"] for f in fluxo), 2)
    total_saidas   = round(sum(f["saidas"] for f in fluxo), 2)

    return {
        "periodo": {"ini": str(data_ini), "fim": str(data_fim)},
        "total_entradas": total_entradas,
        "total_saidas": total_saidas,
        "saldo_periodo": round(total_entradas - total_saidas, 2),
        "fluxo": fluxo,
    }


@router.get("/vendas-por-operador")
def vendas_por_operador(
    data_ini: date, data_fim: date,
    db: Session = Depends(get_db), _=Depends(get_current_user),
):
    vendas = db.query(Venda).filter(
        Venda.data_venda >= data_ini,
        Venda.data_venda <= data_fim,
        Venda.status == "FINALIZADA"
    ).order_by(Venda.data_venda, Venda.created_at).all()

    ops: dict = {}
    for v in vendas:
        op = v.operador or "Sem Operador"
        if op not in ops:
            ops[op] = {
                "operador": op,
                "qtd_vendas": 0,
                "total_vendido": 0.0,
                "total_desconto": 0.0,
                "total_itens": 0,
                "vendas": [],
            }
        ops[op]["qtd_vendas"] += 1
        ops[op]["total_vendido"] += v.total or 0
        ops[op]["total_desconto"] += v.desconto or 0
        ops[op]["total_itens"] += len(v.itens)
        ops[op]["vendas"].append({
            "id": v.id,
            "numero": v.numero,
            "data": str(v.data_venda),
            "hora": str(v.created_at)[11:19] if v.created_at else "",
            "cliente": v.cliente_nome or "Consumidor Final",
            "total": round(v.total or 0, 2),
            "desconto": round(v.desconto or 0, 2),
            "forma_pagamento": v.forma_pagamento or "—",
            "itens": len(v.itens),
            "terminal": v.pdv_terminal or "—",
        })

    result = list(ops.values())
    for r in result:
        r["ticket_medio"]   = round(r["total_vendido"] / r["qtd_vendas"], 2) if r["qtd_vendas"] > 0 else 0
        r["total_vendido"]  = round(r["total_vendido"], 2)
        r["total_desconto"] = round(r["total_desconto"], 2)

    return {
        "periodo":      {"data_ini": str(data_ini), "data_fim": str(data_fim)},
        "total_geral":  round(sum(r["total_vendido"] for r in result), 2),
        "total_vendas": sum(r["qtd_vendas"] for r in result),
        "operadores":   sorted(result, key=lambda x: x["total_vendido"], reverse=True),
    }
