from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, timedelta
from database import get_db
from models import (
    NotaFiscalEntrada, ItemNFEntrada, Produto,
    AgendaAlteracaoPreco, ConfigEmpresa, TabelaImposto
)

router = APIRouter(prefix="/precos-nf", tags=["precos-nf"])


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _calcular_preco(custo: float, margem_pct: float, icms: float, pis: float, cofins: float) -> float:
    """Formação de preço pelo markup por dentro:
       PV = Custo / (1 - impostos_saida% - margem_liquida%)
    """
    divisor = 1 - (icms + pis + cofins + margem_pct) / 100
    if divisor <= 0:
        return custo * (1 + margem_pct / 100)  # fallback markup por fora
    return round(custo / divisor, 2)


def _impostos_produto(p: Produto, empresa: ConfigEmpresa) -> dict:
    icms = getattr(p, 'icms_aliquota', 0.0) or 0.0
    pis  = getattr(p, 'pis_aliquota', 0.0)  or 0.0
    cof  = getattr(p, 'cofins_aliquota', 0.0) or 0.0
    sim  = getattr(empresa, 'aliquota_simples', 6.0) or 6.0

    if empresa.regime_tributario == "SIMPLES_NACIONAL":
        # No Simples, o DAS já está embutido no custo; usamos a alíquota definida na empresa
        return {"icms": 0.0, "pis": 0.0, "cofins": 0.0, "simples": sim}
    return {"icms": icms, "pis": pis, "cofins": cof, "simples": 0.0}


# ─── Schemas ─────────────────────────────────────────────────────────────────

class ItemAplicar(BaseModel):
    produto_id:      int
    custo_novo:      float
    preco_novo:      float
    margem_aplicada: float

class AplicarBody(BaseModel):
    nf_id:           Optional[int] = None
    itens:           List[ItemAplicar]

class AgendarBody(BaseModel):
    nf_id:           Optional[int] = None
    data_aplicacao:  date
    itens:           List[ItemAplicar]


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/nfs")
def listar_nfs(db: Session = Depends(get_db)):
    """Lista todas as NFs de entrada (RECEBIDA) com contagem de itens."""
    nfs = (db.query(NotaFiscalEntrada)
           .filter(NotaFiscalEntrada.status == "RECEBIDA")
           .order_by(NotaFiscalEntrada.data_entrada.desc())
           .limit(100)
           .all())
    resultado = []
    for nf in nfs:
        resultado.append({
            "id":           nf.id,
            "numero":       nf.numero,
            "serie":        nf.serie,
            "data_entrada": str(nf.data_entrada),
            "fornecedor":   nf.fornecedor.razao_social if nf.fornecedor else "",
            "valor_total":  nf.valor_total,
            "qtd_itens":    len(nf.itens),
        })
    return resultado


@router.get("/nf/{nf_id}/preview")
def preview_nf(nf_id: int, db: Session = Depends(get_db)):
    """Retorna os itens da NF com custo efetivo e preço sugerido calculado."""
    nf = db.query(NotaFiscalEntrada).filter(NotaFiscalEntrada.id == nf_id).first()
    if not nf:
        raise HTTPException(404, "NF não encontrada")

    empresa = db.query(ConfigEmpresa).first()
    if not empresa:
        raise HTTPException(404, "Empresa não configurada")

    itens = []
    for item in nf.itens:
        p = item.produto
        if not p:
            continue

        # custo efetivo = valor_total / quantidade (já inclui desconto)
        custo_efetivo = (item.valor_total / item.quantidade) if item.quantidade else item.preco_unitario

        impostos = _impostos_produto(p, empresa)
        margem   = p.margem or 30.0

        if empresa.regime_tributario == "SIMPLES_NACIONAL":
            preco_sugerido = _calcular_preco(custo_efetivo, margem, 0, 0, impostos["simples"])
        else:
            preco_sugerido = _calcular_preco(custo_efetivo, margem,
                                              impostos["icms"], impostos["pis"], impostos["cofins"])

        itens.append({
            "produto_id":      p.id,
            "codigo":          p.codigo,
            "descricao":       p.descricao,
            "unidade":         p.unidade,
            "ncm":             p.ncm or "",
            # custo
            "custo_atual":     p.preco_custo,
            "custo_nf":        round(custo_efetivo, 4),
            "custo_variacao":  round((custo_efetivo - p.preco_custo) / max(p.preco_custo, 0.01) * 100, 2),
            # venda atual
            "preco_atual":     p.preco_venda,
            "margem_atual":    p.margem,
            # impostos de saída
            "icms_saida":      impostos["icms"],
            "pis_saida":       impostos["pis"],
            "cofins_saida":    impostos["cofins"],
            "simples_pct":     impostos["simples"],
            "regime":          empresa.regime_tributario,
            # sugestão
            "margem_sugerida": margem,
            "preco_sugerido":  preco_sugerido,
            "preco_variacao":  round((preco_sugerido - p.preco_venda) / max(p.preco_venda, 0.01) * 100, 2),
            # nf
            "nf_quantidade":   item.quantidade,
            "nf_preco_unit":   item.preco_unitario,
            "nf_desconto":     item.desconto,
        })

    return {"nf": {
        "id": nf.id, "numero": nf.numero, "serie": nf.serie,
        "data_entrada": str(nf.data_entrada),
        "fornecedor": nf.fornecedor.razao_social if nf.fornecedor else "",
    }, "itens": itens, "regime": empresa.regime_tributario}


@router.post("/aplicar")
def aplicar_agora(body: AplicarBody, db: Session = Depends(get_db)):
    """Aplica as alterações de preço imediatamente nos produtos."""
    atualizados = 0
    for it in body.itens:
        p = db.query(Produto).filter(Produto.id == it.produto_id).first()
        if not p:
            continue
        p.preco_custo = it.custo_novo
        p.preco_venda = it.preco_novo
        p.margem      = it.margem_aplicada
        atualizados  += 1
    db.commit()
    return {"ok": True, "produtos_atualizados": atualizados}


@router.post("/agendar")
def agendar(body: AgendarBody, db: Session = Depends(get_db)):
    """Agenda alterações de preço para uma data futura."""
    agendados = 0
    for it in body.itens:
        p = db.query(Produto).filter(Produto.id == it.produto_id).first()
        if not p:
            continue
        # Remove agendamento pendente anterior para o mesmo produto
        db.query(AgendaAlteracaoPreco).filter(
            AgendaAlteracaoPreco.produto_id == it.produto_id,
            AgendaAlteracaoPreco.status == "PENDENTE",
        ).delete()

        db.add(AgendaAlteracaoPreco(
            produto_id      = it.produto_id,
            nf_entrada_id   = body.nf_id,
            custo_atual     = p.preco_custo,
            preco_atual     = p.preco_venda,
            custo_novo      = it.custo_novo,
            preco_novo      = it.preco_novo,
            margem_aplicada = it.margem_aplicada,
            data_aplicacao  = body.data_aplicacao,
        ))
        agendados += 1
    db.commit()
    return {"ok": True, "agendados": agendados, "data_aplicacao": str(body.data_aplicacao)}


@router.get("/agenda")
def listar_agenda(db: Session = Depends(get_db)):
    """Lista alterações agendadas (PENDENTE)."""
    itens = (db.query(AgendaAlteracaoPreco)
             .filter(AgendaAlteracaoPreco.status != "CANCELADA")
             .order_by(AgendaAlteracaoPreco.data_aplicacao)
             .all())
    resultado = []
    for i in itens:
        resultado.append({
            "id":             i.id,
            "produto_id":     i.produto_id,
            "produto":        i.produto.descricao if i.produto else "",
            "codigo":         i.produto.codigo if i.produto else "",
            "nf_id":         i.nf_entrada_id,
            "custo_atual":    i.custo_atual,
            "preco_atual":    i.preco_atual,
            "custo_novo":     i.custo_novo,
            "preco_novo":     i.preco_novo,
            "margem_aplicada": i.margem_aplicada,
            "data_aplicacao": str(i.data_aplicacao),
            "status":         i.status,
            "vencido":        i.data_aplicacao <= date.today() and i.status == "PENDENTE",
        })
    return resultado


@router.post("/executar-agenda")
def executar_agenda(db: Session = Depends(get_db)):
    """Executa todas as alterações pendentes cuja data_aplicacao <= hoje."""
    hoje = date.today()
    pendentes = (db.query(AgendaAlteracaoPreco)
                 .filter(AgendaAlteracaoPreco.status == "PENDENTE",
                         AgendaAlteracaoPreco.data_aplicacao <= hoje)
                 .all())
    aplicados = 0
    for ag in pendentes:
        p = db.query(Produto).filter(Produto.id == ag.produto_id).first()
        if p:
            p.preco_custo = ag.custo_novo
            p.preco_venda = ag.preco_novo
            p.margem      = ag.margem_aplicada
            ag.status     = "APLICADA"
            aplicados    += 1
    db.commit()
    return {"ok": True, "aplicados": aplicados}


@router.delete("/agenda/{agenda_id}")
def cancelar_agenda(agenda_id: int, db: Session = Depends(get_db)):
    ag = db.query(AgendaAlteracaoPreco).filter(AgendaAlteracaoPreco.id == agenda_id).first()
    if not ag:
        raise HTTPException(404, "Não encontrado")
    ag.status = "CANCELADA"
    db.commit()
    return {"ok": True}
