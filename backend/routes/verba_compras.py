from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import VerbaCompras, PedidoCompra, Venda
from utils.security import get_current_user
from pydantic import BaseModel
from typing import Optional
from datetime import date

router = APIRouter(prefix="/verba-compras", tags=["verba_compras"])


class VerbaSchema(BaseModel):
    mes:                    str             # YYYY-MM
    valor_definido:         Optional[float] = 0.0
    percentual_faturamento: Optional[float] = 70.0
    aprovado_por:           Optional[str]   = None
    observacoes:            Optional[str]   = None


def _verba_dict(v: VerbaCompras, gasto: float, faturamento: float) -> dict:
    limite = v.valor_definido
    pct_gasto = (gasto / limite * 100) if limite > 0 else 0
    return {
        "id":                    v.id,
        "mes":                   v.mes,
        "valor_definido":        v.valor_definido,
        "percentual_faturamento":v.percentual_faturamento,
        "aprovado_por":          v.aprovado_por,
        "observacoes":           v.observacoes,
        "gasto_mes":             round(gasto, 2),
        "saldo":                 round(limite - gasto, 2),
        "pct_utilizado":         round(pct_gasto, 1),
        "faturamento_mes":       round(faturamento, 2),
        "status":                "OK" if pct_gasto <= 80 else ("ALERTA" if pct_gasto <= 100 else "ESTOURADO"),
    }


def _calcular_gasto(mes: str, db: Session) -> float:
    """Soma valor dos pedidos de compra do mês (status != CANCELADO)."""
    ano, m = mes.split("-")
    ini = date(int(ano), int(m), 1)
    if int(m) == 12:
        fim = date(int(ano) + 1, 1, 1)
    else:
        fim = date(int(ano), int(m) + 1, 1)
    total = db.query(func.sum(PedidoCompra.valor_total)).filter(
        PedidoCompra.data_pedido >= ini,
        PedidoCompra.data_pedido < fim,
        PedidoCompra.status != "CANCELADO",
    ).scalar() or 0.0
    return total


def _calcular_faturamento(mes: str, db: Session) -> float:
    """Soma total das vendas finalizadas do mês."""
    ano, m = mes.split("-")
    ini = date(int(ano), int(m), 1)
    if int(m) == 12:
        fim = date(int(ano) + 1, 1, 1)
    else:
        fim = date(int(ano), int(m) + 1, 1)
    total = db.query(func.sum(Venda.total)).filter(
        Venda.data_venda >= ini,
        Venda.data_venda < fim,
        Venda.status == "FINALIZADA",
    ).scalar() or 0.0
    return total


@router.get("/atual")
def verba_atual(db: Session = Depends(get_db), _=Depends(get_current_user)):
    hoje = date.today()
    mes = f"{hoje.year}-{hoje.month:02d}"
    v = db.query(VerbaCompras).filter(VerbaCompras.mes == mes).first()
    gasto = _calcular_gasto(mes, db)
    fat = _calcular_faturamento(mes, db)
    if not v:
        return {"mes": mes, "valor_definido": 0, "gasto_mes": gasto, "saldo": -gasto,
                "pct_utilizado": 0, "faturamento_mes": fat, "status": "SEM_VERBA",
                "percentual_faturamento": 70}
    return _verba_dict(v, gasto, fat)


@router.get("/")
def listar_verbas(db: Session = Depends(get_db), _=Depends(get_current_user)):
    verbas = db.query(VerbaCompras).order_by(VerbaCompras.mes.desc()).all()
    result = []
    for v in verbas:
        gasto = _calcular_gasto(v.mes, db)
        fat = _calcular_faturamento(v.mes, db)
        result.append(_verba_dict(v, gasto, fat))
    return result


@router.post("/")
def criar_verba(data: VerbaSchema, db: Session = Depends(get_db), u=Depends(get_current_user)):
    existente = db.query(VerbaCompras).filter(VerbaCompras.mes == data.mes).first()
    if existente:
        for k, v in data.dict().items():
            setattr(existente, k, v)
        db.commit(); db.refresh(existente)
        gasto = _calcular_gasto(existente.mes, db)
        fat   = _calcular_faturamento(existente.mes, db)
        return _verba_dict(existente, gasto, fat)
    v = VerbaCompras(**data.dict())
    db.add(v); db.commit(); db.refresh(v)
    return _verba_dict(v, 0.0, _calcular_faturamento(v.mes, db))


@router.post("/verificar")
def verificar_limite(body: dict, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Verifica se um valor de compra cabe na verba do mês. Usado antes de confirmar pedido."""
    valor = float(body.get("valor", 0))
    hoje = date.today()
    mes = f"{hoje.year}-{hoje.month:02d}"
    v = db.query(VerbaCompras).filter(VerbaCompras.mes == mes).first()
    gasto = _calcular_gasto(mes, db)
    if not v or v.valor_definido == 0:
        return {"ok": True, "aviso": "Sem verba definida para o mês"}
    novo_gasto = gasto + valor
    pct = novo_gasto / v.valor_definido * 100
    if pct > 100:
        return {"ok": False, "requer_aprovacao": True, "pct": round(pct, 1),
                "saldo_atual": round(v.valor_definido - gasto, 2),
                "msg": f"Compra excede a verba em R$ {novo_gasto - v.valor_definido:.2f}. Requer aprovação do supervisor."}
    return {"ok": True, "pct": round(pct, 1), "saldo_pos": round(v.valor_definido - novo_gasto, 2)}
