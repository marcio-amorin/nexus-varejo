"""
Módulo Radar de Oportunidades — atualiza automaticamente a cada 30 minutos.

Fontes:
  - Leilões: PNCP (modalidade Leilão Eletrônico + Presencial)
  - Licitações: PNCP (Portal Nacional de Compras Públicas)

A aba de "Ofertas" (busca de descontos no Mercado Livre pra revenda) foi
removida — a Meli passou a bloquear com 403 qualquer chamada não autenticada
ao endpoint de busca geral do marketplace (/sites/MLB/search), e mesmo com
token de vendedor válido e renovado o bloqueio continua (é restrição de
política da plataforma pra esse endpoint específico, não um problema de
token). Sem um caminho oficial de API pra isso, decisão foi tirar a aba em
vez de deixar meio-funcionando.
"""

from fastapi import APIRouter, Depends, Query, BackgroundTasks
from utils.security import get_current_user
import httpx, asyncio
from datetime import datetime, date, timedelta
from typing import Optional

router = APIRouter(prefix="/oportunidades", tags=["oportunidades"])

# ── Cache em memória (atualiza a cada 30 min) ─────────────────────────────────
_cache: dict = {
    "leiloes":    {"itens": [], "atualizado_em": None, "total": 0},
    "licitacoes": {"itens": [], "atualizado_em": None, "total": 0},
}
_atualizando = {"leiloes": False, "licitacoes": False}

PNCP_BASE = "https://pncp.gov.br/api/consulta/v1"
INTERVALO_MINUTOS = 30

# ── Busca PNCP ────────────────────────────────────────────────────────────────

async def _fetch_pncp(data_ini: str, data_fim: str, tam: int, pagina: int, q: str = "", modalidade_id: Optional[int] = None) -> dict:
    params: dict = {
        "dataInicial": data_ini,
        "dataFinal":   data_fim,
        "tamanhoPagina": tam,
        "pagina": pagina,
    }
    if q:
        params["q"] = q
    if modalidade_id:
        params["codigoModalidadeContratacao"] = modalidade_id
    try:
        async with httpx.AsyncClient(timeout=20, headers={"User-Agent": "NexusVarejo/2.0"}) as c:
            r = await c.get(f"{PNCP_BASE}/contratacoes/publicacao", params=params)
        if r.status_code == 200:
            return r.json()
    except Exception:
        pass
    return {}

def _parse_item_pncp(item: dict, tipo: str) -> dict:
    valor = item.get("valorTotalEstimado") or item.get("valorTotalHomologado")
    pub   = (item.get("dataPublicacaoPncp") or "")[:10]
    enc   = (item.get("dataEncerramentoProposta") or item.get("dataAberturaProposta") or "")[:10]
    return {
        "id":          item.get("numeroControlePNCP", ""),
        "tipo":        tipo,
        "orgao":       (item.get("orgaoEntidade") or {}).get("razaoSocial", ""),
        "uf":          (item.get("unidadeOrgao") or {}).get("ufSigla", ""),
        "objeto":      (item.get("objetoCompra") or "")[:250],
        "modalidade":  item.get("modalidadeNome", ""),
        "situacao":    item.get("situacaoCompraNome", ""),
        "valor":       float(valor) if valor else None,
        "publicado":   pub,
        "encerramento": enc,
        "link":        item.get("linkSistemaOrigem") or f"https://pncp.gov.br/app/editais/{item.get('numeroControlePNCP','').replace('/', '-')}",
    }

# ── Updaters ──────────────────────────────────────────────────────────────────

async def _atualizar_leiloes():
    if _atualizando["leiloes"]:
        return
    _atualizando["leiloes"] = True
    try:
        hoje    = date.today()
        d_ini   = (hoje - timedelta(days=90)).strftime("%Y%m%d")
        d_fim   = (hoje + timedelta(days=60)).strftime("%Y%m%d")

        # PNCP tem dois códigos de modalidade pra leilão: 1 = Eletrônico,
        # 13 = Presencial — busca os dois e junta, evitando duplicata pelo
        # número de controle. Só cai pra busca livre por palavra-chave se
        # nenhum dos dois trouxer nada (situação rara, mas evita ficar sem
        # resultado quando um dos dois códigos falha isoladamente).
        eletronico  = await _fetch_pncp(d_ini, d_fim, 50, 1, modalidade_id=1)
        presencial  = await _fetch_pncp(d_ini, d_fim, 50, 1, modalidade_id=13)
        itens_raw = (eletronico.get("data") or []) + (presencial.get("data") or [])
        total = (eletronico.get("totalRegistros") or 0) + (presencial.get("totalRegistros") or 0)

        if not itens_raw:
            data = await _fetch_pncp(d_ini, d_fim, 50, 1, q="leilão")
            itens_raw = data.get("data") or []
            total = data.get("totalRegistros", len(itens_raw))

        vistos = set()
        itens = []
        for i in itens_raw:
            item = _parse_item_pncp(i, "leilao")
            if item["id"] in vistos:
                continue
            vistos.add(item["id"])
            itens.append(item)

        _cache["leiloes"] = {
            "itens": itens,
            "total": total,
            "atualizado_em": datetime.now(),
        }
    except Exception as e:
        _cache["leiloes"]["erro"] = str(e)
    finally:
        _atualizando["leiloes"] = False


async def _atualizar_licitacoes():
    if _atualizando["licitacoes"]:
        return
    _atualizando["licitacoes"] = True
    try:
        hoje  = date.today()
        d_ini = (hoje - timedelta(days=7)).strftime("%Y%m%d")
        d_fim = (hoje + timedelta(days=30)).strftime("%Y%m%d")

        data  = await _fetch_pncp(d_ini, d_fim, 50, 1)
        itens_raw = data.get("data") or []
        itens = [_parse_item_pncp(i, "licitacao") for i in itens_raw]
        # Ordena por encerramento mais próximo
        itens.sort(key=lambda x: x["encerramento"] or "9999")

        _cache["licitacoes"] = {
            "itens": itens,
            "total": data.get("totalRegistros", len(itens)),
            "atualizado_em": datetime.now(),
        }
    except Exception as e:
        _cache["licitacoes"]["erro"] = str(e)
    finally:
        _atualizando["licitacoes"] = False


# ── Loop automático de atualização ────────────────────────────────────────────

async def _loop_atualizacao():
    """Roda em background e atualiza o cache a cada 30 minutos."""
    while True:
        try:
            await asyncio.gather(
                _atualizar_leiloes(),
                _atualizar_licitacoes(),
            )
        except Exception:
            pass
        await asyncio.sleep(INTERVALO_MINUTOS * 60)


def iniciar_loop_oportunidades():
    """Chamado no startup da aplicação."""
    loop = asyncio.new_event_loop()
    import threading
    def _run():
        asyncio.set_event_loop(loop)
        loop.run_until_complete(_loop_atualizacao())
    t = threading.Thread(target=_run, daemon=True, name="oportunidades-loop")
    t.start()


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/status")
def status(_=Depends(get_current_user)):
    """Retorna quando cada seção foi atualizada pela última vez."""
    def _fmt(dt):
        return dt.strftime("%d/%m/%Y %H:%M") if dt else None
    return {
        "leiloes":    {"atualizado_em": _fmt(_cache["leiloes"].get("atualizado_em")),    "total": _cache["leiloes"].get("total", 0)},
        "licitacoes": {"atualizado_em": _fmt(_cache["licitacoes"].get("atualizado_em")), "total": _cache["licitacoes"].get("total", 0)},
        "proximo_refresh_min": INTERVALO_MINUTOS,
    }


@router.post("/atualizar/{secao}")
async def forcar_atualizacao(secao: str, background_tasks: BackgroundTasks, _=Depends(get_current_user)):
    """Força atualização imediata de uma seção (leiloes | licitacoes)."""
    if secao == "leiloes":
        background_tasks.add_task(_atualizar_leiloes)
    elif secao == "licitacoes":
        background_tasks.add_task(_atualizar_licitacoes)
    else:
        return {"ok": False, "msg": f"Seção desconhecida: {secao}"}
    return {"ok": True, "msg": f"Atualizando {secao} em background..."}


@router.get("/leiloes")
def get_leiloes(
    q: str = Query(""),
    _=Depends(get_current_user)
):
    itens = _cache["leiloes"].get("itens", [])
    if q:
        q_low = q.lower()
        itens = [i for i in itens if q_low in i.get("objeto", "").lower() or q_low in i.get("orgao", "").lower()]
    at = _cache["leiloes"].get("atualizado_em")
    return {
        "ok": True,
        "itens": itens,
        "total": len(itens),
        "atualizado_em": at.strftime("%d/%m/%Y %H:%M") if at else None,
        "atualizando": _atualizando["leiloes"],
    }


@router.get("/licitacoes")
def get_licitacoes(
    q: str = Query(""),
    uf: str = Query(""),
    _=Depends(get_current_user)
):
    itens = _cache["licitacoes"].get("itens", [])
    if q:
        q_low = q.lower()
        itens = [i for i in itens if q_low in i.get("objeto", "").lower() or q_low in i.get("orgao", "").lower()]
    if uf:
        itens = [i for i in itens if i.get("uf", "").upper() == uf.upper()]
    at = _cache["licitacoes"].get("atualizado_em")
    return {
        "ok": True,
        "itens": itens,
        "total": len(itens),
        "atualizado_em": at.strftime("%d/%m/%Y %H:%M") if at else None,
        "atualizando": _atualizando["licitacoes"],
    }
