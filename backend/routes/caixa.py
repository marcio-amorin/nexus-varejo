from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from models import CaixaAbertura, MovimentoCaixa, Venda, ItemVenda, OperadorPDV
from utils.security import get_current_user
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date
from sqlalchemy import func

router = APIRouter(prefix="/caixa", tags=["caixa"])


class AbrirCaixaIn(BaseModel):
    terminal: Optional[str] = "CAIXA-01"
    fundo_caixa: Optional[float] = 0.0
    operador: Optional[str] = None

class MovCaixaIn(BaseModel):
    valor: float
    observacao: Optional[str] = None

class FecharCaixaIn(BaseModel):
    dinheiro_contado: Optional[float] = None
    total_contado: Optional[float] = None  # compat
    observacao: Optional[str] = None


def _resumo_caixa(caixa: CaixaAbertura, db: Session) -> dict:
    # Filtra vendas pelo datetime exato do caixa (não pela data, pois vários caixas podem abrir no mesmo dia)
    q = db.query(Venda).filter(
        Venda.created_at >= caixa.aberto_em,
        Venda.status == "FINALIZADA"
    )
    if not caixa.is_aberto and caixa.fechado_em:
        q = q.filter(Venda.created_at <= caixa.fechado_em)
    vendas = q.all()

    total_vendas = sum(v.total for v in vendas)
    por_forma: dict = {}
    qtd_por_forma: dict = {}
    for v in vendas:
        f = v.forma_pagamento
        por_forma[f]    = round(por_forma.get(f, 0) + v.total, 2)
        qtd_por_forma[f] = qtd_por_forma.get(f, 0) + 1

    movs = db.query(MovimentoCaixa).filter(MovimentoCaixa.caixa_id == caixa.id).all()
    # Separa sangrias manuais (dinheiro) das auto-sangrias de fechamento (outras formas)
    sangrias_dinheiro = sum(m.valor for m in movs
        if m.tipo == "SANGRIA"
        and not (m.observacao or '').startswith('Auto-sangria fechamento:'))
    auto_sangrias_list = [
        {"forma": (m.observacao or '').replace("Auto-sangria fechamento: ", ""), "valor": round(m.valor, 2)}
        for m in movs
        if m.tipo == "SANGRIA" and (m.observacao or '').startswith('Auto-sangria fechamento:')
    ]
    total_suprimento  = sum(m.valor for m in movs if m.tipo == "SUPRIMENTO")

    vendas_dinheiro = por_forma.get("DINHEIRO", 0)
    saldo_teorico = round(
        caixa.fundo_caixa + vendas_dinheiro + total_suprimento - sangrias_dinheiro, 2
    )

    return {
        "id": caixa.id,
        "terminal": caixa.terminal,
        "fundo_caixa": caixa.fundo_caixa,
        "aberto_em": caixa.aberto_em.isoformat() if caixa.aberto_em else None,
        "fechado_em": caixa.fechado_em.isoformat() if caixa.fechado_em else None,
        "is_aberto": caixa.is_aberto,
        "total_vendas": round(total_vendas, 2),
        "qtd_vendas": len(vendas),
        "total_dinheiro": round(vendas_dinheiro, 2),
        "sangrias_dinheiro": round(sangrias_dinheiro, 2),
        "total_suprimento": round(total_suprimento, 2),
        "saldo_teorico_dinheiro": saldo_teorico,
        "por_forma": {k: round(v, 2) for k, v in por_forma.items()},
        "qtd_por_forma": qtd_por_forma,
        "auto_sangrias": auto_sangrias_list,
        "movimentos": [
            {"tipo": m.tipo, "valor": m.valor, "observacao": m.observacao,
             "created_at": m.created_at.isoformat() if m.created_at else None}
            for m in movs
        ],
    }


@router.get("/status")
def status_caixa(db: Session = Depends(get_db), _=Depends(get_current_user)):
    caixa = db.query(CaixaAbertura).filter(CaixaAbertura.is_aberto == True).first()
    if not caixa:
        return {"aberto": False, "caixa": None}
    return {"aberto": True, "caixa": _resumo_caixa(caixa, db)}


@router.post("/abrir")
def abrir_caixa(data: AbrirCaixaIn, db: Session = Depends(get_db), u=Depends(get_current_user)):
    aberto = db.query(CaixaAbertura).filter(CaixaAbertura.is_aberto == True).first()
    if aberto:
        raise HTTPException(400, f"Já existe um caixa aberto: {aberto.terminal}")

    caixa = CaixaAbertura(
        terminal=data.terminal or "CAIXA-01",
        operador_num=u.id,
        fundo_caixa=data.fundo_caixa or 0,
        is_aberto=True,
    )
    db.add(caixa); db.flush()

    mov = MovimentoCaixa(
        caixa_id=caixa.id,
        tipo="ABERTURA",
        valor=data.fundo_caixa or 0,
        observacao="Abertura de caixa",
        operador=u.nome,
    )
    db.add(mov)
    db.commit(); db.refresh(caixa)
    return _resumo_caixa(caixa, db)


@router.post("/fechar")
def fechar_caixa(data: FecharCaixaIn, db: Session = Depends(get_db), u=Depends(get_current_user)):
    caixa = db.query(CaixaAbertura).filter(CaixaAbertura.is_aberto == True).first()
    if not caixa:
        raise HTTPException(400, "Nenhum caixa aberto")

    resumo = _resumo_caixa(caixa, db)

    # Auto-sangrias para todas as formas não-DINHEIRO (dinheiro já foi sangrado manualmente)
    auto_s = []
    for forma, valor in resumo["por_forma"].items():
        if forma != "DINHEIRO" and valor > 0:
            db.add(MovimentoCaixa(
                caixa_id=caixa.id,
                tipo="SANGRIA",
                valor=round(valor, 2),
                observacao=f"Auto-sangria fechamento: {forma}",
                operador="SISTEMA",
            ))
            auto_s.append({"forma": forma, "valor": round(valor, 2)})

    dinheiro_contado = data.dinheiro_contado
    saldo_teorico    = resumo["saldo_teorico_dinheiro"]
    diferenca = round(dinheiro_contado - saldo_teorico, 2) if dinheiro_contado is not None else 0.0

    caixa.is_aberto = False
    caixa.fechado_em = datetime.now()
    caixa.total_vendas = resumo["total_vendas"]

    obs_txt = f"Saldo teórico: R${saldo_teorico:.2f}"
    if dinheiro_contado is not None:
        obs_txt += f" | Contado: R${dinheiro_contado:.2f} | Diferença: R${diferenca:+.2f}"
    if data.observacao:
        obs_txt += f" | {data.observacao}"

    db.add(MovimentoCaixa(
        caixa_id=caixa.id,
        tipo="FECHAMENTO",
        valor=dinheiro_contado if dinheiro_contado is not None else saldo_teorico,
        observacao=obs_txt,
        operador=u.nome,
    ))
    db.commit()

    return {
        **resumo,
        "diferenca": diferenca,
        "dinheiro_contado": dinheiro_contado,
        "auto_sangrias": auto_s,
        "is_aberto": False,
    }


@router.post("/sangria")
def sangria(data: MovCaixaIn, db: Session = Depends(get_db), u=Depends(get_current_user)):
    caixa = db.query(CaixaAbertura).filter(CaixaAbertura.is_aberto == True).first()
    if not caixa:
        raise HTTPException(400, "Nenhum caixa aberto")
    if data.valor <= 0:
        raise HTTPException(400, "Valor deve ser positivo")

    mov = MovimentoCaixa(
        caixa_id=caixa.id,
        tipo="SANGRIA",
        valor=data.valor,
        observacao=data.observacao or "Sangria",
        operador=u.nome,
    )
    db.add(mov); db.commit()
    return {"ok": True, "tipo": "SANGRIA", "valor": data.valor}


@router.post("/suprimento")
def suprimento(data: MovCaixaIn, db: Session = Depends(get_db), u=Depends(get_current_user)):
    caixa = db.query(CaixaAbertura).filter(CaixaAbertura.is_aberto == True).first()
    if not caixa:
        raise HTTPException(400, "Nenhum caixa aberto")
    if data.valor <= 0:
        raise HTTPException(400, "Valor deve ser positivo")

    mov = MovimentoCaixa(
        caixa_id=caixa.id,
        tipo="SUPRIMENTO",
        valor=data.valor,
        observacao=data.observacao or "Suprimento",
        operador=u.nome,
    )
    db.add(mov); db.commit()
    return {"ok": True, "tipo": "SUPRIMENTO", "valor": data.valor}


@router.get("/cupons")
def cupons_caixa(db: Session = Depends(get_db), _=Depends(get_current_user)):
    caixa = db.query(CaixaAbertura).filter(CaixaAbertura.is_aberto == True).first()
    if not caixa:
        return []
    vendas = db.query(Venda).filter(
        Venda.created_at >= caixa.aberto_em,
        Venda.status == "FINALIZADA"
    ).order_by(Venda.created_at.asc()).all()

    resultado = []
    for v in vendas:
        hora_str = v.created_at.strftime("%H:%M:%S") if v.created_at else "—"
        resultado.append({
            "id": v.id,
            "numero": v.numero,
            "hora": hora_str,
            "cliente": v.cliente_nome or (v.cliente.nome if v.cliente else None),
            "forma_pagamento": v.forma_pagamento,
            "subtotal": v.subtotal,
            "desconto": v.desconto,
            "total": v.total,
            "troco": v.troco,
            "itens": [
                {
                    "descricao": i.descricao_snap or (i.produto.descricao if i.produto else ""),
                    "quantidade": i.quantidade,
                    "preco_unitario": i.preco_unitario,
                    "desconto_item": i.desconto_item,
                    "total_item": i.total_item,
                }
                for i in v.itens
            ]
        })
    return resultado


@router.get("/{caixa_id}/cupons")
def cupons_por_caixa(
    caixa_id: int,
    forma: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    caixa = db.query(CaixaAbertura).filter(CaixaAbertura.id == caixa_id).first()
    if not caixa:
        raise HTTPException(404, "Caixa não encontrado")

    abertura_date = caixa.aberto_em.date() if caixa.aberto_em else date.today()
    fechamento_dt = caixa.fechado_em if caixa.fechado_em else datetime.now()

    q = db.query(Venda).filter(
        Venda.created_at >= caixa.aberto_em,
        Venda.created_at <= (caixa.fechado_em or datetime.now()),
        Venda.status == "FINALIZADA"
    )
    if forma:
        q = q.filter(Venda.forma_pagamento == forma)

    vendas = q.order_by(Venda.created_at.asc()).all()
    resultado = []
    for v in vendas:
        hora_str = v.created_at.strftime("%H:%M:%S") if v.created_at else "—"
        resultado.append({
            "id": v.id,
            "numero": v.numero,
            "hora": hora_str,
            "cliente": v.cliente_nome or (v.cliente.nome if v.cliente else None),
            "forma_pagamento": v.forma_pagamento,
            "subtotal": v.subtotal,
            "desconto": v.desconto,
            "total": v.total,
            "troco": v.troco,
            "itens": [
                {
                    "descricao": i.descricao_snap or (i.produto.descricao if i.produto else ""),
                    "quantidade": i.quantidade,
                    "preco_unitario": i.preco_unitario,
                    "total_item": i.total_item,
                }
                for i in v.itens
            ]
        })
    return resultado


@router.get("/historico")
def historico(limit: int = 30, db: Session = Depends(get_db), _=Depends(get_current_user)):
    caixas = db.query(CaixaAbertura).order_by(CaixaAbertura.aberto_em.desc()).limit(limit).all()
    return [_resumo_caixa(c, db) for c in caixas]


@router.get("/fechamentos")
def fechamentos(
    data_ini: Optional[str] = Query(None),
    data_fim: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(CaixaAbertura).filter(CaixaAbertura.is_aberto == False)
    if data_ini:
        q = q.filter(CaixaAbertura.fechado_em >= datetime.strptime(data_ini, "%Y-%m-%d"))
    if data_fim:
        from datetime import timedelta
        fim_dt = datetime.strptime(data_fim, "%Y-%m-%d") + timedelta(days=1)
        q = q.filter(CaixaAbertura.fechado_em < fim_dt)
    caixas = q.order_by(CaixaAbertura.fechado_em.desc()).limit(100).all()

    operadores = {o.numero: o.nome for o in db.query(OperadorPDV).all()}
    resultado = []
    for c in caixas:
        resumo = _resumo_caixa(c, db)

        # Busca dinheiro_contado e diferença no mov FECHAMENTO
        mov_fech = next((m for m in c.movimentos if m.tipo == "FECHAMENTO"), None)
        dinheiro_contado = mov_fech.valor if mov_fech else None
        diferenca = round(dinheiro_contado - resumo["saldo_teorico_dinheiro"], 2) if dinheiro_contado is not None else None

        # Auto-sangrias no fechamento
        auto_sangrias = [
            {"forma": m.observacao.replace("Auto-sangria fechamento: ", ""), "valor": m.valor}
            for m in c.movimentos
            if m.tipo == "SANGRIA" and m.observacao and "Auto-sangria fechamento:" in m.observacao
        ]

        # Sangrias manuais
        sangrias_manuais = [
            {"valor": m.valor, "observacao": m.observacao, "created_at": m.created_at.isoformat() if m.created_at else None}
            for m in c.movimentos
            if m.tipo == "SANGRIA" and not (m.observacao and "Auto-sangria fechamento:" in m.observacao)
        ]

        resultado.append({
            **resumo,
            "operador_nome": operadores.get(c.operador_num, f"#{c.operador_num}"),
            "dinheiro_contado": dinheiro_contado,
            "diferenca": diferenca,
            "auto_sangrias": auto_sangrias,
            "sangrias_manuais": sangrias_manuais,
        })

    return resultado
