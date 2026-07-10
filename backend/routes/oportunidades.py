"""
Módulo Radar de Oportunidades — atualiza automaticamente a cada 30 minutos.

Fontes:
  - Leilões: PNCP (modalidade Leilão) + plataformas externas
  - Licitações: PNCP (Portal Nacional de Compras Públicas)
  - Ofertas ML: Mercado Livre com alto desconto para revenda
"""

from fastapi import APIRouter, Depends, Query, BackgroundTasks
from sqlalchemy.orm import Session
from database import get_db
from utils.security import get_current_user
import httpx, asyncio, re, json
from datetime import datetime, date, timedelta
from typing import Optional

router = APIRouter(prefix="/oportunidades", tags=["oportunidades"])

# ── Cache em memória (atualiza a cada 30 min) ─────────────────────────────────
_cache: dict = {
    "leiloes":    {"itens": [], "plataformas": [], "atualizado_em": None, "total": 0},
    "licitacoes": {"itens": [], "atualizado_em": None, "total": 0},
    "ofertas":    {"itens": [], "atualizado_em": None, "total": 0},
}
_atualizando = {"leiloes": False, "licitacoes": False, "ofertas": False}

PNCP_BASE = "https://pncp.gov.br/api/consulta/v1"
INTERVALO_MINUTOS = 30

# ── Plataformas de leilão externas (sempre exibidas) ─────────────────────────
PLATAFORMAS_LEILAO = [
    {"nome": "Receita Federal",      "url": "https://www.gov.br/receitafederal/pt-br/servicos/leilao/leiloes-de-mercadorias", "tipo": "governo",  "icone": "🏛️", "desc": "Mercadorias apreendidas e abandonadas"},
    {"nome": "Leilão.com.br",        "url": "https://www.leilao.com.br",         "tipo": "privado",  "icone": "🔨", "desc": "Maior plataforma de leilões do Brasil"},
    {"nome": "SuperUsados",          "url": "https://www.superusados.com.br",     "tipo": "privado",  "icone": "📦", "desc": "Leilões de paletes e estoque"},
    {"nome": "Lex Leilões",          "url": "https://www.lexleiloes.com.br",      "tipo": "privado",  "icone": "⚖️", "desc": "Leilões judiciais e extrajudiciais"},
    {"nome": "Zukerman Leilões",     "url": "https://www.zukerman.com.br",        "tipo": "privado",  "icone": "🔨", "desc": "Leilões industriais e equipamentos"},
    {"nome": "Banco do Brasil",      "url": "https://www.lbb.com.br",             "tipo": "banco",    "icone": "🏦", "desc": "Bens recuperados pelo BB"},
    {"nome": "Caixa Econômica",      "url": "https://venda.caixa.gov.br",         "tipo": "banco",    "icone": "🏦", "desc": "Imóveis e bens da Caixa"},
    {"nome": "OLX Paletes",          "url": "https://www.olx.com.br/brasil?q=palete+leilao", "tipo": "privado", "icone": "🏷️", "desc": "Paletes e liquidação no OLX"},
]

def _em_cache_valido(chave: str) -> bool:
    at = _cache[chave].get("atualizado_em")
    if not at:
        return False
    return (datetime.now() - at).total_seconds() < INTERVALO_MINUTOS * 60

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
        params["modalidadeId"] = modalidade_id
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

        # Tenta modalidade 1 (Leilão) — se der erro tenta sem filtro de modalidade
        data = await _fetch_pncp(d_ini, d_fim, 50, 1, q="leilão", modalidade_id=1)
        if not data.get("data"):
            data = await _fetch_pncp(d_ini, d_fim, 50, 1, q="leilão")

        itens_raw = data.get("data") or []
        itens = [_parse_item_pncp(i, "leilao") for i in itens_raw]

        _cache["leiloes"] = {
            "itens": itens,
            "plataformas": PLATAFORMAS_LEILAO,
            "total": data.get("totalRegistros", len(itens)),
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


async def _atualizar_ofertas(token: str = ""):
    if _atualizando["ofertas"]:
        return
    _atualizando["ofertas"] = True
    try:
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        # Busca em várias categorias de forma paralela
        BUSCAS = [
            ("Celulares",       "MLB1055"),
            ("Informática",     "MLB1648"),
            ("Eletrodomésticos","MLB1574"),
            ("Áudio",           "MLB109285"),
            ("Smartwatches",    "MLB7195"),
            ("TV & Vídeo",      "MLB432"),
            ("Games",           "MLB1144"),
            ("Esporte",         "MLB1276"),
        ]
        todos: list = []

        async def _buscar_cat(label: str, cat_id: str):
            try:
                async with httpx.AsyncClient(timeout=15, headers={"User-Agent": "NexusVarejo/2.0", **headers}) as c:
                    r = await c.get(
                        "https://api.mercadolibre.com/sites/MLB/search",
                        params={"category": cat_id, "limit": 20, "sort": "best_match",
                                "discount": "20-100", "condition": "new"},
                    )
                if r.status_code != 200:
                    return
                for item in r.json().get("results", []):
                    preco      = float(item.get("price") or 0)
                    preco_orig = float(item.get("original_price") or preco)
                    if preco <= 0 or preco_orig <= preco:
                        continue
                    desc_pct   = round((1 - preco / preco_orig) * 100, 1)
                    if desc_pct < 15:
                        continue
                    margem_rev = round(preco * 0.15, 2)
                    todos.append({
                        "id":              item.get("id", ""),
                        "titulo":          (item.get("title") or "")[:100],
                        "categoria":       label,
                        "preco":           preco,
                        "preco_original":  preco_orig,
                        "desconto_pct":    desc_pct,
                        "margem_estimada": margem_rev,
                        "imagem":          (item.get("thumbnail") or "").replace("I.jpg", "O.jpg"),
                        "url":             item.get("permalink", ""),
                        "vendas":          item.get("sold_quantity", 0),
                        "frete_gratis":    (item.get("shipping") or {}).get("free_shipping", False),
                        "condition":       item.get("condition", "new"),
                    })
            except Exception:
                pass

        await asyncio.gather(*[_buscar_cat(l, c) for l, c in BUSCAS])
        todos.sort(key=lambda x: x["desconto_pct"], reverse=True)

        _cache["ofertas"] = {
            "itens": todos[:80],
            "total": len(todos),
            "atualizado_em": datetime.now(),
        }
    except Exception as e:
        _cache["ofertas"]["erro"] = str(e)
    finally:
        _atualizando["ofertas"] = False


# ── Loop automático de atualização ────────────────────────────────────────────

async def _loop_atualizacao():
    """Roda em background e atualiza o cache a cada 30 minutos."""
    while True:
        try:
            await asyncio.gather(
                _atualizar_leiloes(),
                _atualizar_licitacoes(),
                _atualizar_ofertas(),
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
        "ofertas":    {"atualizado_em": _fmt(_cache["ofertas"].get("atualizado_em")),    "total": _cache["ofertas"].get("total", 0)},
        "proximo_refresh_min": INTERVALO_MINUTOS,
    }


@router.post("/atualizar/{secao}")
async def forcar_atualizacao(secao: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Força atualização imediata de uma seção (leiloes | licitacoes | ofertas)."""
    if secao == "leiloes":
        background_tasks.add_task(_atualizar_leiloes)
    elif secao == "licitacoes":
        background_tasks.add_task(_atualizar_licitacoes)
    elif secao == "ofertas":
        # Pega token ML se disponível
        token = ""
        try:
            from models import AfiliadoConfig, VendedorConfig
            cfg = db.query(AfiliadoConfig).filter_by(plataforma="ML_AFILIADOS").first()
            if cfg and cfg.access_token:
                token = cfg.access_token
            else:
                vcfg = db.query(VendedorConfig).filter_by(plataforma="ML_VENDEDOR", ativo=True).first()
                if vcfg and vcfg.access_token:
                    token = vcfg.access_token
        except Exception:
            pass
        background_tasks.add_task(_atualizar_ofertas, token)
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
        "plataformas": _cache["leiloes"].get("plataformas", PLATAFORMAS_LEILAO),
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


@router.get("/ofertas")
def get_ofertas(
    categoria: str = Query(""),
    desconto_min: int = Query(15),
    q: str = Query(""),
    _=Depends(get_current_user)
):
    itens = _cache["ofertas"].get("itens", [])
    if categoria:
        itens = [i for i in itens if i.get("categoria", "") == categoria]
    if desconto_min > 0:
        itens = [i for i in itens if i.get("desconto_pct", 0) >= desconto_min]
    if q:
        q_low = q.lower()
        itens = [i for i in itens if q_low in i.get("titulo", "").lower()]
    at = _cache["ofertas"].get("atualizado_em")
    return {
        "ok": True,
        "itens": itens,
        "total": len(itens),
        "atualizado_em": at.strftime("%d/%m/%Y %H:%M") if at else None,
        "atualizando": _atualizando["ofertas"],
    }
