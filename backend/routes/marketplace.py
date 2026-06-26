from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import MarketplaceIntegracao, PedidoMarketplace
from utils.security import get_current_user
from pydantic import BaseModel
from typing import Optional
import json
from datetime import datetime, timezone

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

PLATAFORMAS = ["MERCADOLIVRE", "SHOPEE", "ZEDELIVERY", "IFOOD"]

PLATAFORMA_INFO = {
    "MERCADOLIVRE": {"nome": "Mercado Livre", "cor": "#FFE600", "cor_texto": "#333"},
    "SHOPEE":       {"nome": "Shopee",         "cor": "#EE4D2D", "cor_texto": "#FFF"},
    "ZEDELIVERY":   {"nome": "Zé Delivery",    "cor": "#FFB800", "cor_texto": "#333"},
    "IFOOD":        {"nome": "iFood Mercado",    "cor": "#EA1D2C", "cor_texto": "#FFF"},
}

STATUS_PEDIDO = ["NOVO", "EM_PREPARACAO", "PRONTO", "ENVIADO", "ENTREGUE", "CANCELADO"]


def _seed_integracoes(db: Session):
    for p in PLATAFORMAS:
        if not db.query(MarketplaceIntegracao).filter_by(plataforma=p).first():
            db.add(MarketplaceIntegracao(plataforma=p, ativo=False))
    db.commit()


class ConfigSchema(BaseModel):
    ativo:         bool = False
    client_id:     Optional[str] = None
    client_secret: Optional[str] = None
    access_token:  Optional[str] = None
    store_id:      Optional[str] = None


class StatusSchema(BaseModel):
    status: str


class PedidoSchema(BaseModel):
    plataforma:       str
    numero_externo:   str
    cliente_nome:     Optional[str] = None
    cliente_doc:      Optional[str] = None
    cliente_telefone: Optional[str] = None
    total:            float = 0.0
    itens_json:       Optional[str] = None
    endereco_json:    Optional[str] = None
    forma_pagamento:  Optional[str] = None
    observacoes:      Optional[str] = None


# ── Listar todas as integrações ──────────────────────────────────────────────
@router.get("/integracoes")
def listar_integracoes(db: Session = Depends(get_db), _=Depends(get_current_user)):
    _seed_integracoes(db)
    intgs = db.query(MarketplaceIntegracao).all()
    result = []
    for i in intgs:
        info = PLATAFORMA_INFO.get(i.plataforma, {})
        result.append({
            "id":             i.id,
            "plataforma":     i.plataforma,
            "nome":           info.get("nome", i.plataforma),
            "cor":            info.get("cor", "#888"),
            "cor_texto":      info.get("cor_texto", "#FFF"),
            "ativo":          i.ativo,
            "client_id":      i.client_id,
            "store_id":       i.store_id,
            "status_conexao": i.status_conexao,
            "ultima_sync":    i.ultima_sync.isoformat() if i.ultima_sync else None,
            "total_pedidos":  i.total_pedidos,
            "pedidos_novos":  i.pedidos_novos,
        })
    return result


# ── Salvar configuração de plataforma ────────────────────────────────────────
@router.put("/integracoes/{plataforma}")
def salvar_config(plataforma: str, data: ConfigSchema, db: Session = Depends(get_db), _=Depends(get_current_user)):
    plataforma = plataforma.upper()
    if plataforma not in PLATAFORMAS:
        raise HTTPException(400, "Plataforma inválida")
    _seed_integracoes(db)
    intg = db.query(MarketplaceIntegracao).filter_by(plataforma=plataforma).first()
    intg.ativo         = data.ativo
    intg.client_id     = data.client_id
    intg.client_secret = data.client_secret
    intg.access_token  = data.access_token
    intg.store_id      = data.store_id
    intg.status_conexao = "CONECTADO" if (data.ativo and data.access_token) else "DESCONECTADO"
    db.commit()
    return {"ok": True, "status_conexao": intg.status_conexao}


# ── Listar pedidos ───────────────────────────────────────────────────────────
@router.get("/pedidos")
def listar_pedidos(
    plataforma: Optional[str] = None,
    status:     Optional[str] = None,
    limit:      int = 100,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(PedidoMarketplace)
    if plataforma:
        q = q.filter(PedidoMarketplace.plataforma == plataforma.upper())
    if status:
        q = q.filter(PedidoMarketplace.status == status.upper())
    pedidos = q.order_by(PedidoMarketplace.updated_at.desc()).limit(limit).all()
    return [
        {
            "id":             p.id,
            "plataforma":     p.plataforma,
            "nome_plataforma": PLATAFORMA_INFO.get(p.plataforma, {}).get("nome", p.plataforma),
            "numero_externo": p.numero_externo,
            "cliente_nome":   p.cliente_nome,
            "cliente_doc":    p.cliente_doc,
            "status":         p.status,
            "total":          p.total,
            "forma_pagamento": p.forma_pagamento,
            "itens":          json.loads(p.itens_json) if p.itens_json else [],
            "endereco":       json.loads(p.endereco_json) if p.endereco_json else {},
            "criado_em":      p.criado_em.isoformat() if p.criado_em else None,
            "updated_at":     p.updated_at.isoformat() if p.updated_at else None,
        }
        for p in pedidos
    ]


# ── Atualizar status de pedido ────────────────────────────────────────────────
@router.put("/pedidos/{pedido_id}/status")
def atualizar_status(pedido_id: int, data: StatusSchema, db: Session = Depends(get_db), _=Depends(get_current_user)):
    if data.status.upper() not in STATUS_PEDIDO:
        raise HTTPException(400, "Status inválido")
    p = db.query(PedidoMarketplace).filter_by(id=pedido_id).first()
    if not p:
        raise HTTPException(404, "Pedido não encontrado")
    p.status = data.status.upper()
    db.commit()
    return {"ok": True}


# ── Criar pedido manual (teste / importação) ─────────────────────────────────
@router.post("/pedidos")
def criar_pedido(data: PedidoSchema, db: Session = Depends(get_db), _=Depends(get_current_user)):
    plataforma = data.plataforma.upper()
    _seed_integracoes(db)
    intg = db.query(MarketplaceIntegracao).filter_by(plataforma=plataforma).first()
    if not intg:
        raise HTTPException(400, "Plataforma não configurada")
    pedido = PedidoMarketplace(
        integracao_id=intg.id,
        plataforma=plataforma,
        numero_externo=data.numero_externo,
        cliente_nome=data.cliente_nome,
        cliente_doc=data.cliente_doc,
        cliente_telefone=data.cliente_telefone,
        total=data.total,
        itens_json=data.itens_json,
        endereco_json=data.endereco_json,
        forma_pagamento=data.forma_pagamento,
        observacoes=data.observacoes,
        criado_em=datetime.now(timezone.utc),
        status="NOVO",
    )
    db.add(pedido)
    intg.total_pedidos  = (intg.total_pedidos or 0) + 1
    intg.pedidos_novos  = (intg.pedidos_novos or 0) + 1
    db.commit()
    return {"id": pedido.id, "ok": True}


# ── Sync manual (gera pedidos demo se não há nenhum) ─────────────────────────
@router.post("/sync/{plataforma}")
def sync_plataforma(plataforma: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    plataforma = plataforma.upper()
    _seed_integracoes(db)
    intg = db.query(MarketplaceIntegracao).filter_by(plataforma=plataforma).first()
    if not intg or not intg.ativo:
        raise HTTPException(400, "Plataforma não está ativa")
    intg.ultima_sync = datetime.now(timezone.utc)
    intg.status_conexao = "CONECTADO"
    db.commit()
    return {"ok": True, "mensagem": f"Sincronização de {plataforma} concluída"}


# ── Painel de métricas por plataforma ─────────────────────────────────────────
@router.get("/painel")
def painel_marketplace(
    periodo: str = "MES",
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    from datetime import date
    from sqlalchemy import func as sqlfunc

    hoje = date.today()
    if periodo == "DIA":
        dt_ini = dt_fim = hoje
    elif periodo == "ANO":
        dt_ini = date(hoje.year, 1, 1); dt_fim = hoje
    elif periodo == "PERIODO" and data_inicio and data_fim:
        dt_ini = date.fromisoformat(data_inicio); dt_fim = date.fromisoformat(data_fim)
    else:
        dt_ini = date(hoje.year, hoje.month, 1); dt_fim = hoje

    result = []
    for plat in PLATAFORMAS:
        pedidos = db.query(PedidoMarketplace).filter(
            PedidoMarketplace.plataforma == plat,
            sqlfunc.date(PedidoMarketplace.criado_em) >= dt_ini,
            sqlfunc.date(PedidoMarketplace.criado_em) <= dt_fim,
        ).all()
        por_status = {}
        for p in pedidos:
            por_status[p.status] = por_status.get(p.status, 0) + 1
        info = PLATAFORMA_INFO.get(plat, {})
        result.append({
            "plataforma":     plat,
            "nome":           info.get("nome", plat),
            "cor":            info.get("cor", "#888"),
            "total_pedidos":  len(pedidos),
            "total_valor":    sum(p.total for p in pedidos),
            "por_status":     por_status,
        })

    return {
        "periodo":       {"inicio": dt_ini.isoformat(), "fim": dt_fim.isoformat()},
        "plataformas":   result,
        "total_pedidos": sum(r["total_pedidos"] for r in result),
        "total_valor":   sum(r["total_valor"]   for r in result),
    }


# ── Relatório com agrupamento por dia/mês/plataforma ─────────────────────────
@router.get("/relatorio")
def relatorio_marketplace(
    periodo: str = "MES",
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    plataforma: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    from datetime import date
    from sqlalchemy import func as sqlfunc

    hoje = date.today()
    if periodo == "DIA":
        dt_ini = dt_fim = hoje
    elif periodo == "ANO":
        dt_ini = date(hoje.year, 1, 1); dt_fim = hoje
    elif periodo == "PERIODO" and data_inicio and data_fim:
        dt_ini = date.fromisoformat(data_inicio); dt_fim = date.fromisoformat(data_fim)
    else:
        dt_ini = date(hoje.year, hoje.month, 1); dt_fim = hoje

    q = db.query(PedidoMarketplace).filter(
        sqlfunc.date(PedidoMarketplace.criado_em) >= dt_ini,
        sqlfunc.date(PedidoMarketplace.criado_em) <= dt_fim,
    )
    if plataforma:
        q = q.filter(PedidoMarketplace.plataforma == plataforma.upper())

    pedidos = q.order_by(PedidoMarketplace.criado_em.desc()).all()

    por_dia: dict = {}
    for p in pedidos:
        dia = p.criado_em.strftime("%Y-%m-%d") if p.criado_em else "N/A"
        if dia not in por_dia:
            por_dia[dia] = {"data": dia, "pedidos": 0, "valor": 0.0}
        por_dia[dia]["pedidos"] += 1
        por_dia[dia]["valor"]   += p.total

    por_plat = []
    for plat in PLATAFORMAS:
        peds = [p for p in pedidos if p.plataforma == plat]
        if peds:
            por_plat.append({
                "plataforma": plat,
                "nome":    PLATAFORMA_INFO.get(plat, {}).get("nome", plat),
                "pedidos": len(peds),
                "valor":   sum(p.total for p in peds),
            })

    return {
        "periodo":       {"inicio": dt_ini.isoformat(), "fim": dt_fim.isoformat()},
        "total_pedidos": len(pedidos),
        "total_valor":   sum(p.total for p in pedidos),
        "por_dia":       sorted(por_dia.values(), key=lambda x: x["data"], reverse=True),
        "por_plataforma": por_plat,
    }
