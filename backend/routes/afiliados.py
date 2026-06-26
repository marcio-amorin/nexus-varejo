from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session
from database import get_db
from models import (
    AfiliadoConfig, AfiliadoProduto, AfiliadoLink,
    AfiliadoMeta, AfiliadoComissao, AfiliadoConteudo
)
from utils.security import get_current_user
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
import json, httpx, asyncio, os, urllib.parse

# Google Gemini — novo SDK google-genai
try:
    from google import genai as _gemini_sdk
    _GEMINI_AVAILABLE = True
except ImportError:
    _GEMINI_AVAILABLE = False

# Groq — import opcional
try:
    from groq import Groq as _GroqClient
    _GROQ_AVAILABLE = True
except ImportError:
    _GROQ_AVAILABLE = False

# Anthropic Claude — import opcional
try:
    import anthropic as _anthropic_sdk
    _ANTHROPIC_AVAILABLE = True
except ImportError:
    _ANTHROPIC_AVAILABLE = False

router = APIRouter(prefix="/afiliados", tags=["afiliados"])

# ─── Schemas ─────────────────────────────────────────────────────────────────

class ConfigIn(BaseModel):
    plataforma:    str
    ativo:         bool = False
    client_id:     Optional[str] = None
    client_secret: Optional[str] = None
    access_token:  Optional[str] = None
    refresh_token: Optional[str] = None
    extra_json:    Optional[str] = None   # JSON string

class ProdutoIn(BaseModel):
    plataforma:     str
    produto_ext_id: str
    titulo:         str
    descricao:      Optional[str] = None
    preco:          float = 0
    preco_original: Optional[float] = None
    comissao_pct:   float = 0
    categoria:      Optional[str] = None
    imagem_url:     Optional[str] = None
    url_produto:    Optional[str] = None
    vendas_mes:     int = 0
    avaliacao:      float = 0
    total_avaliacoes: int = 0
    notas:          Optional[str] = None

class MetaIn(BaseModel):
    mes_ano:     str           # "2026-06"
    meta_renda:  float

class ComissaoIn(BaseModel):
    plataforma:          str
    produto_id:          Optional[int] = None
    titulo_produto:      Optional[str] = None
    data_venda:          Optional[date] = None
    data_prevista_pgto:  Optional[date] = None
    valor_venda:         float = 0
    comissao_pct:        float = 0
    comissao_valor:      float = 0
    referencia_ext:      Optional[str] = None

class ConteudoIn(BaseModel):
    produto_id:    Optional[int] = None
    rede_social:   str = "INSTAGRAM"
    tipo_conteudo: str = "POST"
    agendado_para: Optional[datetime] = None
    forcar_ia:     Optional[str] = None  # "gemini" | "claude" | None (auto)

# ─── Plataformas disponíveis ─────────────────────────────────────────────────

PLATAFORMAS_AFILIADO = {
    "ML_AFILIADOS":  {"nome": "Mercado Livre Afiliados", "cor": "#FFE600", "cor_texto": "#333", "icone": "🟡"},
    "SHOPEE":        {"nome": "Shopee Afiliados",         "cor": "#EE4D2D", "cor_texto": "#FFF", "icone": "🟠"},
    "AMAZON":        {"nome": "Amazon Associates",        "cor": "#FF9900", "cor_texto": "#FFF", "icone": "📦"},
}

REDES_SOCIAIS = {
    "INSTAGRAM": {"nome": "Instagram", "cor": "#E1306C", "icone": "📸"},
    "FACEBOOK":  {"nome": "Facebook",  "cor": "#1877F2", "icone": "👤"},
    "TIKTOK":    {"nome": "TikTok",    "cor": "#000000", "icone": "🎵"},
}

# ─── Dashboard ───────────────────────────────────────────────────────────────

@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), _=Depends(get_current_user)):
    hoje = date.today()
    mes_atual = hoje.strftime("%Y-%m")

    total_produtos  = db.query(AfiliadoProduto).filter_by(ativo=True).count()
    total_links     = db.query(AfiliadoLink).count()
    total_conteudos = db.query(AfiliadoConteudo).filter_by(status="PUBLICADO").count()

    # Comissões do mês
    from sqlalchemy import func, extract
    com_mes = db.query(func.sum(AfiliadoComissao.comissao_valor)).filter(
        AfiliadoComissao.status.in_(["APROVADO", "PAGO"]),
        extract("year", AfiliadoComissao.data_venda) == hoje.year,
        extract("month", AfiliadoComissao.data_venda) == hoje.month,
    ).scalar() or 0

    com_total = db.query(func.sum(AfiliadoComissao.comissao_valor)).filter(
        AfiliadoComissao.status == "PAGO"
    ).scalar() or 0

    com_pendente = db.query(func.sum(AfiliadoComissao.comissao_valor)).filter(
        AfiliadoComissao.status.in_(["PENDENTE", "APROVADO"])
    ).scalar() or 0

    # Meta do mês
    meta = db.query(AfiliadoMeta).filter_by(mes_ano=mes_atual).first()

    # Top produtos por comissão
    top_prods = db.query(AfiliadoProduto).filter_by(ativo=True).order_by(
        AfiliadoProduto.comissao_valor.desc()
    ).limit(5).all()

    # Comissões recentes
    recentes = db.query(AfiliadoComissao).order_by(
        AfiliadoComissao.created_at.desc()
    ).limit(10).all()

    return {
        "kpis": {
            "total_produtos":   total_produtos,
            "total_links":      total_links,
            "conteudos_publicados": total_conteudos,
            "comissao_mes":     round(com_mes, 2),
            "comissao_total":   round(com_total, 2),
            "comissao_pendente": round(com_pendente, 2),
        },
        "meta_mes": {
            "mes_ano":     meta.mes_ano if meta else mes_atual,
            "meta_renda":  meta.meta_renda if meta else 0,
            "realizado":   meta.realizado_renda if meta else round(com_mes, 2),
            "pct":         round((com_mes / meta.meta_renda * 100) if meta and meta.meta_renda else 0, 1),
        } if meta else None,
        "top_produtos": [
            {"id": p.id, "titulo": p.titulo, "plataforma": p.plataforma,
             "comissao_pct": p.comissao_pct, "comissao_valor": p.comissao_valor,
             "imagem_url": p.imagem_url, "vendas_mes": p.vendas_mes}
            for p in top_prods
        ],
        "comissoes_recentes": [
            {"titulo": c.titulo_produto, "plataforma": c.plataforma,
             "valor": c.comissao_valor, "status": c.status,
             "data": str(c.data_venda)}
            for c in recentes
        ],
    }

# ─── Configurações de Plataformas ────────────────────────────────────────────

@router.get("/configs")
def listar_configs(db: Session = Depends(get_db), _=Depends(get_current_user)):
    configs = {row.plataforma: row for row in db.query(AfiliadoConfig).all()}
    result = []
    todas = {**PLATAFORMAS_AFILIADO, **REDES_SOCIAIS}
    for chave, info in todas.items():
        cfg = configs.get(chave)
        result.append({
            "plataforma":   chave,
            "nome":         info["nome"],
            "cor":          info["cor"],
            "icone":        info["icone"],
            "tipo":         "afiliado" if chave in PLATAFORMAS_AFILIADO else "social",
            "ativo":        cfg.ativo if cfg else False,
            "configurado":  bool(cfg and cfg.access_token),
            "extra_json":   cfg.extra_json if cfg else None,
        })
    return result

# ─── OAuth2 Mercado Livre ─────────────────────────────────────────────────────

ML_REDIRECT_URI = os.getenv("ML_REDIRECT_URI", "https://nexus-varejo-backend.onrender.com/afiliados/ml-callback")
ML_AUTH_URL     = "https://auth.mercadolivre.com.br/authorization"
ML_TOKEN_URL    = "https://api.mercadolibre.com/oauth/token"

@router.get("/ml-auth-url")
def ml_auth_url(db: Session = Depends(get_db), _=Depends(get_current_user)):
    cfg = db.query(AfiliadoConfig).filter_by(plataforma="ML_AFILIADOS").first()
    if not cfg or not cfg.client_id:
        raise HTTPException(400, "Configure o Client ID do ML em Configurações primeiro")
    url = (
        f"{ML_AUTH_URL}?response_type=code"
        f"&client_id={urllib.parse.quote(cfg.client_id)}"
        f"&redirect_uri={urllib.parse.quote(ML_REDIRECT_URI)}"
        f"&scope=offline_access"
    )
    return {"url": url}

@router.get("/ml-callback")
async def ml_callback(code: str = "", error: str = "", db: Session = Depends(get_db)):
    if error:
        return HTMLResponse(_html_resultado(False, f"Autorização negada: {error}"))
    if not code:
        return HTMLResponse(_html_resultado(False, "Código de autorização não recebido"))

    cfg = db.query(AfiliadoConfig).filter_by(plataforma="ML_AFILIADOS").first()
    if not cfg or not cfg.client_id or not cfg.client_secret:
        return HTMLResponse(_html_resultado(False, "Client ID / Secret não configurados"))

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(ML_TOKEN_URL, data={
                "grant_type":    "authorization_code",
                "client_id":     cfg.client_id,
                "client_secret": cfg.client_secret,
                "code":          code,
                "redirect_uri":  ML_REDIRECT_URI,
            })
            data = r.json()

        if "access_token" not in data:
            return HTMLResponse(_html_resultado(False, f"Erro: {data.get('message', str(data))}"))

        cfg.access_token  = data["access_token"]
        cfg.refresh_token = data.get("refresh_token", "")
        cfg.ativo         = True
        # Salva user_id no extra_json para uso futuro
        extra = json.loads(cfg.extra_json or "{}")
        extra["user_id"] = data.get("user_id", "")
        cfg.extra_json = json.dumps(extra)
        db.commit()
        return HTMLResponse(_html_resultado(True, "Mercado Livre conectado com sucesso! Pode fechar esta janela."))
    except Exception as e:
        return HTMLResponse(_html_resultado(False, str(e)))

@router.post("/ml-refresh-token")
async def ml_refresh_token(db: Session = Depends(get_db), _=Depends(get_current_user)):
    cfg = db.query(AfiliadoConfig).filter_by(plataforma="ML_AFILIADOS").first()
    if not cfg or not cfg.refresh_token:
        raise HTTPException(400, "Sem refresh token. Reconecte o Mercado Livre.")
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(ML_TOKEN_URL, data={
                "grant_type":    "refresh_token",
                "client_id":     cfg.client_id,
                "client_secret": cfg.client_secret,
                "refresh_token": cfg.refresh_token,
            })
            data = r.json()
        if "access_token" not in data:
            raise HTTPException(400, data.get("message", "Erro ao renovar token"))
        cfg.access_token  = data["access_token"]
        cfg.refresh_token = data.get("refresh_token", cfg.refresh_token)
        db.commit()
        return {"ok": True, "msg": "Token renovado com sucesso"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))

def _html_resultado(sucesso: bool, msg: str) -> str:
    cor  = "#16a34a" if sucesso else "#dc2626"
    icon = "✅" if sucesso else "❌"
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8">
<title>ML Afiliados</title>
<style>body{{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc}}
.box{{text-align:center;padding:40px;border-radius:20px;border:2px solid {cor};background:#fff;max-width:400px}}
h2{{color:{cor}}}p{{color:#374151;font-size:15px}}
button{{margin-top:20px;padding:12px 28px;background:{cor};color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:bold;cursor:pointer}}</style></head>
<body><div class="box"><div style="font-size:52px">{icon}</div><h2>{'Conectado!' if sucesso else 'Erro'}</h2>
<p>{msg}</p>
<button onclick="window.close()">Fechar</button></div>
<script>if({'true' if sucesso else 'false'}){{setTimeout(()=>window.close(),3000)}}</script></body></html>"""

@router.post("/configs")
def salvar_config(body: ConfigIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    cfg = db.query(AfiliadoConfig).filter_by(plataforma=body.plataforma).first()
    if not cfg:
        cfg = AfiliadoConfig(plataforma=body.plataforma)
        db.add(cfg)
    cfg.ativo         = body.ativo
    if body.client_id:     cfg.client_id     = body.client_id
    if body.client_secret: cfg.client_secret = body.client_secret
    if body.access_token:  cfg.access_token  = body.access_token
    if body.refresh_token: cfg.refresh_token = body.refresh_token
    if body.extra_json:    cfg.extra_json    = body.extra_json
    db.commit()
    return {"ok": True}

# ─── Busca de Produtos nas Plataformas ───────────────────────────────────────

# Categorias ML com maior potencial de afiliados
ML_CATEGORIAS_TOP = [
    ("MLB1000",  "Eletrônicos",       8.0,  ["fone bluetooth", "smartwatch", "caixa de som"]),
    ("MLB1051",  "Celulares",         9.0,  ["smartphone samsung", "iphone", "celular xiaomi"]),
    ("MLB1055",  "Computadores",      10.0, ["notebook gamer", "monitor", "ssd"]),
    ("MLB1648",  "Moda",              12.0, ["tênis nike", "vestido", "jaqueta"]),
    ("MLB1499",  "Beleza",            11.0, ["perfume importado", "sérum facial", "protetor solar"]),
    ("MLB1574",  "Esportes",          10.0, ["suplemento", "bicicleta", "colchonete"]),
    ("MLB1459",  "Casa",              8.0,  ["air fryer", "panela elétrica", "aspirador"]),
    ("MLB1430",  "Bebês",             9.0,  ["carrinho bebê", "kit berço", "monitor bebê"]),
    ("MLB1743",  "Ferramentas",       7.0,  ["furadeira", "kit ferramentas", "parafusadeira"]),
    ("MLB2996",  "Jogos",             8.0,  ["controle ps5", "headset gamer", "teclado gamer"]),
]

@router.get("/buscar-produtos")
async def buscar_produtos(
    q: str = "",
    plataforma: str = "ML_AFILIADOS",
    categoria: str = "",
    ordenar: str = "vendas",  # vendas | comissao | preco
    limit: int = 20,
    db: Session = Depends(get_db),
    _=Depends(get_current_user)
):
    cfg = db.query(AfiliadoConfig).filter_by(plataforma=plataforma).first()

    if plataforma == "ML_AFILIADOS":
        return await _buscar_ml(q, categoria, ordenar, limit, cfg)
    elif plataforma == "SHOPEE":
        return await _buscar_shopee(q, categoria, limit, cfg)
    elif plataforma == "AMAZON":
        return await _buscar_amazon(q, categoria, limit, cfg)
    else:
        raise HTTPException(400, "Plataforma não suportada")

@router.get("/top-oportunidades")
async def top_oportunidades(
    meta_renda: float = 20000,
    db: Session = Depends(get_db),
    _=Depends(get_current_user)
):
    """Auto-scanner: busca as melhores oportunidades de afiliado em todas as categorias"""
    cfg = db.query(AfiliadoConfig).filter_by(plataforma="ML_AFILIADOS", ativo=True).first()
    if not cfg or not cfg.access_token:
        return {
            "precisa_config": True,
            "erro": "Conecte o Mercado Livre em Configurações para ver as melhores oportunidades",
            "oportunidades": [],
        }

    todas = []
    headers_req = {"Authorization": f"Bearer {cfg.access_token}"}

    # Valida token com uma requisição rápida antes do scan completo
    try:
        async with httpx.AsyncClient(timeout=5) as test_client:
            test_resp = await test_client.get(
                "https://api.mercadolibre.com/users/me",
                headers=headers_req
            )
            if test_resp.status_code == 401:
                return {
                    "precisa_config": True,
                    "erro": "Token do Mercado Livre expirado. Reconecte em Configurações.",
                    "oportunidades": [],
                }
    except Exception:
        return {
            "precisa_config": True,
            "erro": "Não foi possível conectar ao Mercado Livre. Verifique sua conexão.",
            "oportunidades": [],
        }

    async with httpx.AsyncClient(timeout=8) as client:
        # Busca os mais vendidos de cada categoria em paralelo
        tasks = []
        for cat_id, cat_nome, com_pct, termos in ML_CATEGORIAS_TOP:
            params = {"q": termos[0], "limit": 5, "sort": "sold_quantity_desc"}
            tasks.append(client.get(
                "https://api.mercadolibre.com/sites/MLB/search",
                params=params, headers=headers_req
            ))
        respostas = await asyncio.gather(*tasks, return_exceptions=True)

    for i, (resp) in enumerate(respostas):
        if isinstance(resp, Exception): continue
        cat_id, cat_nome, com_pct, termos = ML_CATEGORIAS_TOP[i]
        try:
            data = resp.json()
            for item in data.get("results", [])[:3]:
                preco         = float(item.get("price", 0))
                vendas        = item.get("sold_quantity", 0)
                com_valor     = round(preco * com_pct / 100, 2)
                ganho_mensal  = round(com_valor * vendas, 2)  # potencial máximo
                todas.append({
                    "produto_ext_id":  item["id"],
                    "titulo":          item["title"],
                    "categoria_nome":  cat_nome,
                    "plataforma":      "ML_AFILIADOS",
                    "preco":           preco,
                    "comissao_pct":    com_pct,
                    "comissao_valor":  com_valor,
                    "vendas_mes":      vendas,
                    "ganho_mensal_pot": ganho_mensal,
                    "imagem_url":      item.get("thumbnail", "").replace("I.jpg", "O.jpg"),
                    "url_produto":     item.get("permalink"),
                    "avaliacao":       item.get("reviews", {}).get("rating_average", 0) if item.get("reviews") else 0,
                })
        except Exception:
            continue

    # Ordena por ganho mensal potencial
    todas.sort(key=lambda x: x["ganho_mensal_pot"], reverse=True)
    top50 = todas[:50]

    # Estratégia para atingir a meta
    estrategia = _estrategia_top(meta_renda, top50[:10])

    return {
        "oportunidades": top50,
        "total": len(top50),
        "estrategia": estrategia,
        "meta_renda": meta_renda,
    }

def _estrategia_top(meta: float, top_prods: list) -> dict:
    if not top_prods:
        return {}
    ticket_medio = sum(p["comissao_valor"] for p in top_prods) / len(top_prods)
    vendas_dia   = round(meta / 30 / ticket_medio, 1) if ticket_medio else 0
    cliques_dia  = int(vendas_dia * 50)  # ~2% conversão

    # Quantas vendas de cada produto
    plano = []
    renda_acumulada = 0
    for p in top_prods[:5]:
        if renda_acumulada >= meta: break
        vendas_necessarias = max(1, int((meta * 0.25) / p["comissao_valor"])) if p["comissao_valor"] else 0
        renda_produto = round(vendas_necessarias * p["comissao_valor"], 2)
        renda_acumulada += renda_produto
        plano.append({
            "produto": p["titulo"][:60],
            "comissao": p["comissao_valor"],
            "vendas_necessarias": vendas_necessarias,
            "renda_gerada": renda_produto,
            "categoria": p["categoria_nome"],
            "imagem_url": p["imagem_url"],
        })

    return {
        "meta": meta,
        "ticket_medio_com": round(ticket_medio, 2),
        "vendas_dia": vendas_dia,
        "cliques_dia": cliques_dia,
        "posts_dia": max(3, int(vendas_dia * 2)),
        "plano_produtos": plano,
        "acoes_diarias": [
            f"📸 Publique {max(3, int(vendas_dia * 2))} posts/dia (Reels convertem 3× mais)",
            f"🔗 Gere links para os top 5 produtos acima",
            f"💬 Responda 100% dos comentários nas primeiras 1h",
            f"📊 Foco em categorias Moda ({[p for p in top_prods if p['categoria_nome']=='Moda'][:1] and '12%' or ''}) e Beleza (11% comissão)",
            f"🎯 Meta diária: R$ {round(meta/30,2):.2f} = {vendas_dia} vendas × R$ {round(ticket_medio,2):.2f}",
            f"📱 TikTok/Reels: mostre o produto em uso, link na bio",
            f"⏰ Melhores horários: 7h, 12h, 19h e 21h",
        ],
    }

async def _buscar_ml(q: str, categoria: str, ordenar: str, limit: int, cfg):
    """Busca produtos no Mercado Livre — API pública, access_token opcional"""
    try:
        sort_map = {"vendas": "sold_quantity_desc", "preco": "price_asc", "comissao": "sold_quantity_desc"}
        sort = sort_map.get(ordenar, "sold_quantity_desc")
        params = {"q": q or "produto", "limit": limit, "sort": sort}
        if categoria:
            params["category"] = categoria

        headers_req = {}
        if cfg and cfg.access_token:
            headers_req["Authorization"] = f"Bearer {cfg.access_token}"

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                "https://api.mercadolibre.com/sites/MLB/search",
                params=params, headers=headers_req
            )
            data = resp.json()

        if resp.status_code == 401:
            return {"resultados": [], "total": 0,
                    "precisa_config": True,
                    "erro": "Token do Mercado Livre expirado. Atualize em Configurações."}

        resultados = []
        for item in data.get("results", []):
            preco    = float(item.get("price", 0))
            com_pct  = _estimar_comissao_ml(item.get("category_id", ""))
            resultados.append({
                "produto_ext_id":  item["id"],
                "titulo":          item["title"],
                "preco":           preco,
                "preco_original":  item.get("original_price"),
                "comissao_pct":    com_pct,
                "comissao_valor":  round(preco * com_pct / 100, 2),
                "imagem_url":      item.get("thumbnail", "").replace("I.jpg", "O.jpg"),
                "url_produto":     item.get("permalink"),
                "vendas_mes":      item.get("sold_quantity", 0),
                "avaliacao":       item.get("reviews", {}).get("rating_average", 0) if item.get("reviews") else 0,
                "total_avaliacoes": item.get("reviews", {}).get("total", 0) if item.get("reviews") else 0,
                "categoria":       item.get("category_id"),
                "plataforma":      "ML_AFILIADOS",
            })
        return {"resultados": resultados, "total": len(resultados)}
    except Exception as e:
        return {"resultados": [], "total": 0, "erro": str(e)}

def _estimar_comissao_ml(category_id: str) -> float:
    """Comissões típicas ML Afiliados por categoria"""
    tabela = {
        "MLB1000": 8.0,   # Eletrônicos
        "MLB1055": 10.0,  # Computadores
        "MLB1051": 9.0,   # Celulares
        "MLB1648": 12.0,  # Moda
        "MLB1499": 11.0,  # Beleza
        "MLB1574": 10.0,  # Esportes
        "MLB1459": 8.0,   # Casa
        "MLB12": 7.0,     # Livros
    }
    for prefix, pct in tabela.items():
        if category_id.startswith(prefix):
            return pct
    return 6.0  # default

async def _buscar_shopee(q: str, categoria: str, limit: int, cfg):
    """Busca produtos Shopee — requer credenciais"""
    if not cfg or not cfg.access_token:
        return {"resultados": [], "total": 0, "erro": "Configure as credenciais Shopee primeiro"}
    return {"resultados": [], "total": 0, "info": "Integração Shopee em breve"}

async def _buscar_amazon(q: str, categoria: str, limit: int, cfg):
    """Busca Amazon PA API 5.0 — requer credenciais"""
    if not cfg or not cfg.access_token:
        return {"resultados": [], "total": 0, "erro": "Configure as credenciais Amazon primeiro"}
    return {"resultados": [], "total": 0, "info": "Integração Amazon em breve"}

# ─── Catálogo de Produtos Salvos ─────────────────────────────────────────────

@router.get("/catalogo")
def listar_catalogo(
    plataforma: str = "",
    favorito: bool = False,
    db: Session = Depends(get_db),
    _=Depends(get_current_user)
):
    q = db.query(AfiliadoProduto).filter_by(ativo=True)
    if plataforma:
        q = q.filter_by(plataforma=plataforma)
    if favorito:
        q = q.filter_by(favorito=True)
    prods = q.order_by(AfiliadoProduto.comissao_valor.desc()).all()
    return [_prod_dict(p) for p in prods]

@router.post("/catalogo")
def salvar_produto(body: ProdutoIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    # Evita duplicata
    existe = db.query(AfiliadoProduto).filter_by(
        plataforma=body.plataforma, produto_ext_id=body.produto_ext_id
    ).first()
    if existe:
        return {"ok": True, "id": existe.id, "duplicado": True}

    p = AfiliadoProduto(
        plataforma=body.plataforma, produto_ext_id=body.produto_ext_id,
        titulo=body.titulo, descricao=body.descricao, preco=body.preco,
        preco_original=body.preco_original, comissao_pct=body.comissao_pct,
        comissao_valor=round(body.preco * body.comissao_pct / 100, 2),
        categoria=body.categoria, imagem_url=body.imagem_url,
        url_produto=body.url_produto, vendas_mes=body.vendas_mes,
        avaliacao=body.avaliacao, total_avaliacoes=body.total_avaliacoes,
        notas=body.notas,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return {"ok": True, "id": p.id}

@router.patch("/catalogo/{id}/favorito")
def toggle_favorito(id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(AfiliadoProduto).get(id)
    if not p:
        raise HTTPException(404)
    p.favorito = not p.favorito
    db.commit()
    return {"favorito": p.favorito}

@router.delete("/catalogo/{id}")
def remover_produto(id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(AfiliadoProduto).get(id)
    if not p:
        raise HTTPException(404)
    p.ativo = False
    db.commit()
    return {"ok": True}

# ─── Geração de Links ─────────────────────────────────────────────────────────

@router.post("/gerar-link")
async def gerar_link(
    produto_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user)
):
    prod = db.query(AfiliadoProduto).get(produto_id)
    if not prod:
        raise HTTPException(404)

    cfg = db.query(AfiliadoConfig).filter_by(plataforma=prod.plataforma, ativo=True).first()
    url_afiliado = prod.url_produto or ""

    if prod.plataforma == "ML_AFILIADOS" and cfg:
        extra = json.loads(cfg.extra_json or "{}")
        affiliate_id = extra.get("affiliate_id", "")
        if affiliate_id and prod.url_produto:
            url_afiliado = f"{prod.url_produto}?source=afiliados&aff_id={affiliate_id}"

    link = AfiliadoLink(
        produto_id=produto_id,
        plataforma=prod.plataforma,
        titulo_produto=prod.titulo,
        url_original=prod.url_produto,
        url_afiliado=url_afiliado,
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return {"id": link.id, "url_afiliado": link.url_afiliado, "titulo": prod.titulo}

# ─── Metas ───────────────────────────────────────────────────────────────────

@router.get("/metas")
def listar_metas(db: Session = Depends(get_db), _=Depends(get_current_user)):
    metas = db.query(AfiliadoMeta).order_by(AfiliadoMeta.mes_ano.desc()).limit(12).all()
    return [_meta_dict(m) for m in metas]

@router.post("/metas")
def criar_meta(body: MetaIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    meta = db.query(AfiliadoMeta).filter_by(mes_ano=body.mes_ano).first()
    if not meta:
        meta = AfiliadoMeta(mes_ano=body.mes_ano, meta_renda=body.meta_renda)
        db.add(meta)
    else:
        meta.meta_renda = body.meta_renda
    db.commit()
    db.refresh(meta)
    return _meta_dict(meta)

@router.post("/metas/{id}/estrategia-ia")
async def gerar_estrategia(
    id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user)
):
    meta = db.query(AfiliadoMeta).get(id)
    if not meta:
        raise HTTPException(404)

    # Produtos mais rentáveis do catálogo
    top = db.query(AfiliadoProduto).filter_by(ativo=True).order_by(
        AfiliadoProduto.comissao_valor.desc()
    ).limit(10).all()

    estrategia = _calcular_estrategia(meta.meta_renda, top)
    meta.estrategia_ia = json.dumps(estrategia, ensure_ascii=False)
    db.commit()
    return estrategia

def _calcular_estrategia(meta_renda: float, produtos: list) -> dict:
    """Calcula quantas vendas precisa para atingir a meta"""
    if not produtos:
        return {"erro": "Adicione produtos ao catálogo primeiro"}

    ticket_medio_com = sum(p.comissao_valor for p in produtos) / len(produtos) if produtos else 5
    vendas_necessarias = int(meta_renda / ticket_medio_com) + 1 if ticket_medio_com > 0 else 0

    # Distribuição por semana/dia
    por_semana = round(vendas_necessarias / 4.3, 1)
    por_dia    = round(vendas_necessarias / 30, 1)

    # Cliques estimados (taxa conversão ~2%)
    cliques_necessarios = vendas_necessarias * 50

    recomendacoes = []
    for p in sorted(produtos[:5], key=lambda x: x.comissao_valor, reverse=True):
        vendas_prod = int(meta_renda * 0.3 / p.comissao_valor) if p.comissao_valor else 0
        recomendacoes.append({
            "produto_id":    p.id,
            "titulo":        p.titulo,
            "comissao":      p.comissao_valor,
            "vendas_meta":   vendas_prod,
            "plataforma":    p.plataforma,
            "imagem_url":    p.imagem_url,
        })

    return {
        "meta_renda":          meta_renda,
        "ticket_medio_com":    round(ticket_medio_com, 2),
        "vendas_necessarias":  vendas_necessarias,
        "por_semana":          por_semana,
        "por_dia":             por_dia,
        "cliques_necessarios": cliques_necessarios,
        "recomendacoes":       recomendacoes,
        "acoes": [
            f"📢 Publique {int(por_dia * 2)} posts/dia nas redes sociais",
            f"🔗 Gere links para os {len(recomendacoes)} produtos com maior comissão",
            f"📊 Meta diária: {round(meta_renda/30, 2):.2f} em comissões",
            f"🎯 Foque nos produtos com comissão acima de R$ {round(ticket_medio_com,2):.2f}",
            "📱 Use Reels/TikTok para maior alcance orgânico",
            "💬 Responda comentários para aumentar conversão",
        ],
    }

# ─── Comissões ────────────────────────────────────────────────────────────────

@router.get("/comissoes")
def listar_comissoes(
    status: str = "",
    mes_ano: str = "",
    db: Session = Depends(get_db),
    _=Depends(get_current_user)
):
    from sqlalchemy import extract
    q = db.query(AfiliadoComissao)
    if status:
        q = q.filter_by(status=status)
    if mes_ano:
        ano, mes = mes_ano.split("-")
        q = q.filter(
            extract("year", AfiliadoComissao.data_venda) == int(ano),
            extract("month", AfiliadoComissao.data_venda) == int(mes),
        )
    comissoes = q.order_by(AfiliadoComissao.created_at.desc()).all()
    return [_comissao_dict(c) for c in comissoes]

@router.post("/comissoes")
def registrar_comissao(body: ComissaoIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = AfiliadoComissao(**body.dict())
    db.add(c)
    db.commit()
    db.refresh(c)
    # Atualizar realizado na meta
    _atualizar_realizado_meta(db, c)
    return _comissao_dict(c)

@router.patch("/comissoes/{id}/status")
def atualizar_status_comissao(
    id: int, status: str,
    db: Session = Depends(get_db), _=Depends(get_current_user)
):
    c = db.query(AfiliadoComissao).get(id)
    if not c:
        raise HTTPException(404)
    c.status = status
    if status == "PAGO":
        c.data_pgto = date.today()
    db.commit()
    return {"ok": True}

def _atualizar_realizado_meta(db: Session, comissao: AfiliadoComissao):
    if not comissao.data_venda:
        return
    mes_ano = comissao.data_venda.strftime("%Y-%m")
    meta = db.query(AfiliadoMeta).filter_by(mes_ano=mes_ano).first()
    if meta:
        from sqlalchemy import func, extract
        total = db.query(func.sum(AfiliadoComissao.comissao_valor)).filter(
            AfiliadoComissao.status.in_(["APROVADO", "PAGO"]),
            extract("year", AfiliadoComissao.data_venda) == comissao.data_venda.year,
            extract("month", AfiliadoComissao.data_venda) == comissao.data_venda.month,
        ).scalar() or 0
        meta.realizado_renda = round(total, 2)
        db.commit()

# ─── Criador de Conteúdo com IA ──────────────────────────────────────────────

@router.get("/ia-config")
def ia_config_status(db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Retorna status das IAs configuradas"""
    groq_cfg    = db.query(AfiliadoConfig).filter_by(plataforma="GROQ_API").first()
    gemini_cfg  = db.query(AfiliadoConfig).filter_by(plataforma="GEMINI_API").first()
    claude_cfg  = db.query(AfiliadoConfig).filter_by(plataforma="CLAUDE_API").first()
    groq_key    = (groq_cfg and groq_cfg.access_token) or os.getenv("GROQ_API_KEY", "")
    gemini_key  = (gemini_cfg and gemini_cfg.access_token) or os.getenv("GEMINI_API_KEY", "")
    claude_key  = (claude_cfg and claude_cfg.access_token) or os.getenv("ANTHROPIC_API_KEY", "")
    ia_ativa    = "groq" if groq_key else ("gemini" if gemini_key else ("claude" if claude_key else None))
    return {
        "ativo":      bool(ia_ativa),
        "ia_ativa":   ia_ativa,
        "groq_ok":    bool(groq_key),
        "gemini_ok":  bool(gemini_key),
        "claude_ok":  bool(claude_key),
    }

@router.post("/ia-config")
def salvar_ia_config(body: ConfigIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Salva chave de IA (GEMINI_API ou CLAUDE_API)"""
    plat = body.plataforma if body.plataforma in ("GROQ_API", "GEMINI_API", "CLAUDE_API") else "GROQ_API"
    cfg = db.query(AfiliadoConfig).filter_by(plataforma=plat).first()
    if not cfg:
        cfg = AfiliadoConfig(plataforma=plat)
        db.add(cfg)
    if body.access_token:
        cfg.access_token = body.access_token
    cfg.ativo = body.ativo
    db.commit()
    return {"ok": True}

def _get_ia_key(db: Session) -> tuple:
    """Retorna (provedor, api_key) — Groq (grátis) → Gemini → Claude"""
    groq_cfg = db.query(AfiliadoConfig).filter_by(plataforma="GROQ_API").first()
    groq_key = (groq_cfg and groq_cfg.access_token) or os.getenv("GROQ_API_KEY", "")
    if groq_key and _GROQ_AVAILABLE:
        return ("groq", groq_key)

    gemini_cfg = db.query(AfiliadoConfig).filter_by(plataforma="GEMINI_API").first()
    gemini_key = (gemini_cfg and gemini_cfg.access_token) or os.getenv("GEMINI_API_KEY", "")
    if gemini_key and _GEMINI_AVAILABLE:
        return ("gemini", gemini_key)

    claude_cfg = db.query(AfiliadoConfig).filter_by(plataforma="CLAUDE_API").first()
    claude_key = (claude_cfg and claude_cfg.access_token) or os.getenv("ANTHROPIC_API_KEY", "")
    if claude_key and _ANTHROPIC_AVAILABLE:
        return ("claude", claude_key)

    return (None, "")

async def _gerar_texto_groq(prod, rede: str, tipo: str, api_key: str) -> tuple:
    """Gera conteúdo com Groq (Llama 3.3) — 100% grátis"""
    titulo    = prod.titulo if prod else "produto incrível"
    preco     = f"R$ {prod.preco:.2f}".replace(".", ",") if prod else "preço especial"
    vendas    = (prod.vendas_mes or 0) if prod else 0
    avaliacao = (prod.avaliacao or 0) if prod else 0

    estilos = {
        "INSTAGRAM": {"POST": "post engajante com emojis, tom animado, máx 150 palavras, termina pedindo para marcar um amigo",
                      "REELS": "script curto estilo 'POV' para Reels, máx 80 palavras, muito dinâmico",
                      "STORIES": "texto ultra-curto para stories, máx 30 palavras, impactante"},
        "FACEBOOK":  {"POST": "post informativo, tom confiável, máx 120 palavras, foco em custo-benefício"},
        "TIKTOK":    {"POST": "roteiro TikTok estilo 'POV', linguagem jovem, máx 60 palavras, viral",
                      "VIDEO": "script vídeo TikTok 30s, muito dinâmico"},
    }
    estilo = estilos.get(rede, {}).get(tipo, "post curto e engajante, máx 100 palavras")

    prompt = f"""Você é especialista em marketing de afiliados brasileiro. Crie um {estilo} para o {rede}.

Produto: {titulo}
Preço: {preco}
{f'Vendas: {vendas}/mês' if vendas else ''}
{f'Avaliação: {avaliacao}/5' if avaliacao else ''}

REGRAS:
- Português brasileiro coloquial
- Use emojis naturalmente
- NÃO mencione comissão ou afiliado
- Inclua call-to-action com "link na bio"
- Seja criativo e único

Retorne APENAS o texto do post, depois escreva HASHTAGS: e na linha seguinte 10 hashtags."""

    loop = asyncio.get_event_loop()
    def _chamar_groq():
        client = _GroqClient(api_key=api_key)
        resp   = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=400,
            temperature=0.8,
        )
        return resp.choices[0].message.content

    resposta = await loop.run_in_executor(None, _chamar_groq)

    if "HASHTAGS:" in resposta:
        partes   = resposta.split("HASHTAGS:")
        texto    = partes[0].strip()
        hashtags = partes[1].strip() if len(partes) > 1 else ""
    else:
        texto    = resposta.strip()
        hashtags = "#oferta #promoção #compras #desconto #achados #brasil"

    return texto, hashtags

async def _gerar_texto_gemini(prod, rede: str, tipo: str, api_key: str) -> tuple:
    """Gera conteúdo com Google Gemini 2.0 Flash"""
    titulo   = prod.titulo if prod else "produto incrível"
    preco    = f"R$ {prod.preco:.2f}".replace(".", ",") if prod else "preço especial"
    vendas   = (prod.vendas_mes or 0) if prod else 0
    avaliacao = (prod.avaliacao or 0) if prod else 0

    estilos = {
        "INSTAGRAM": {"POST": "post engajante com emojis, tom animado, máx 150 palavras, termina pedindo para marcar um amigo",
                      "REELS": "script curto estilo 'POV' para Reels, máx 80 palavras, muito dinâmico",
                      "STORIES": "texto ultra-curto para stories, máx 30 palavras, impactante"},
        "FACEBOOK":  {"POST": "post informativo, tom confiável, máx 120 palavras, foco em custo-benefício",
                      "REELS": "post curto animado, máx 80 palavras"},
        "TIKTOK":    {"POST": "roteiro TikTok estilo 'POV', gírias jovens, máx 60 palavras, viral",
                      "VIDEO": "script vídeo TikTok 30s, muito dinâmico"},
    }
    estilo = estilos.get(rede, {}).get(tipo, "post curto e engajante, máx 100 palavras")

    prompt = f"""Você é especialista em marketing de afiliados brasileiro. Crie um {estilo} para o {rede}.

Produto: {titulo}
Preço: {preco}
{f'Vendas: {vendas} unidades/mês' if vendas else ''}
{f'Avaliação: {avaliacao}/5 estrelas' if avaliacao else ''}

REGRAS:
- Português brasileiro coloquial
- Use emojis naturalmente
- NÃO mencione comissão ou afiliado
- Inclua call-to-action com "link na bio" ou "link nos comentários"
- Seja criativo, não use fórmulas óbvias
- Retorne APENAS o texto do post

Depois do texto, numa nova linha escreva: HASHTAGS:
E na linha seguinte as 10 hashtags mais relevantes separadas por espaço."""

    loop = asyncio.get_event_loop()
    def _chamar_gemini():
        client = _gemini_sdk.Client(api_key=api_key)
        resp   = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
        )
        return resp.text

    resposta = await loop.run_in_executor(None, _chamar_gemini)

    if "HASHTAGS:" in resposta:
        partes   = resposta.split("HASHTAGS:")
        texto    = partes[0].strip()
        hashtags = partes[1].strip() if len(partes) > 1 else ""
    else:
        texto    = resposta.strip()
        hashtags = "#oferta #promoção #compras #desconto #achados #brasil"

    return texto, hashtags

async def _gerar_texto_claude(prod, rede: str, tipo: str, api_key: str) -> tuple:
    """Gera conteúdo de afiliado com Claude Haiku — rápido e barato"""
    titulo    = prod.titulo if prod else "produto incrível"
    preco     = f"R$ {prod.preco:.2f}".replace(".", ",") if prod else "preço especial"
    categoria = (prod.categoria or "") if prod else ""
    vendas    = (prod.vendas_mes or 0) if prod else 0
    avaliacao = (prod.avaliacao or 0) if prod else 0

    estilos = {
        "INSTAGRAM": {"POST": "post engajante com emojis, tom animado, máx 150 palavras, termina pedindo para marcar um amigo ou salvar o post",
                      "REELS": "script de vídeo curto estilo 'POV' ou 'Você precisa ver isso', máx 80 palavras, muito dinâmico",
                      "STORIES": "texto ultra-curto para stories, máx 30 palavras, impactante, com call-to-action"},
        "FACEBOOK":  {"POST": "post informativo com prós do produto, tom confiável, máx 120 palavras, foco em custo-benefício",
                      "REELS": "post curto estilo reel, animado, máx 80 palavras"},
        "TIKTOK":    {"POST": "roteiro TikTok estilo 'POV' ou 'trend', gírias jovens, máx 60 palavras, muito viral",
                      "VIDEO": "script para vídeo TikTok de 30s mostrando o produto, muito dinâmico"},
    }
    estilo = estilos.get(rede, {}).get(tipo, "post curto e engajante, máx 100 palavras")

    prompt = f"""Você é especialista em marketing de afiliados brasileiro. Crie um {estilo} para o {rede}.

Produto: {titulo}
Preço: {preco}
{f'Vendas: {vendas} unidades/mês' if vendas else ''}
{f'Avaliação: {avaliacao}/5 estrelas' if avaliacao else ''}

REGRAS:
- Escreva em português brasileiro coloquial
- Use emojis de forma natural
- NÃO mencione comissão nem afiliado
- Inclua call-to-action com "link na bio" ou "link nos comentários"
- Seja criativo, não use fórmulas óbvias
- Retorne APENAS o texto do post, sem explicações

Depois do texto, numa nova linha escreva exatamente: HASHTAGS:
E na linha seguinte as 10 hashtags mais relevantes separadas por espaço."""

    loop = asyncio.get_event_loop()
    def _chamar_claude():
        client = _anthropic_sdk.Anthropic(api_key=api_key)
        msg = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}]
        )
        return msg.content[0].text

    resposta = await loop.run_in_executor(None, _chamar_claude)

    # Separa texto das hashtags
    if "HASHTAGS:" in resposta:
        partes   = resposta.split("HASHTAGS:")
        texto    = partes[0].strip()
        hashtags = partes[1].strip() if len(partes) > 1 else ""
    else:
        texto    = resposta.strip()
        hashtags = "#oferta #promoção #compras #desconto #achados #brasil"

    return texto, hashtags

@router.post("/conteudo/gerar")
async def gerar_conteudo(
    body: ConteudoIn,
    db: Session = Depends(get_db),
    _=Depends(get_current_user)
):
    prod = db.query(AfiliadoProduto).get(body.produto_id) if body.produto_id else None

    redes   = [body.rede_social] if body.rede_social != "TODOS" else ["INSTAGRAM", "FACEBOOK", "TIKTOK"]
    criados = []

    # Detecta qual IA usar — respeita forcar_ia se informado
    provedor_auto, api_key_auto = _get_ia_key(db)

    def _resolver_ia(forcar: str | None):
        if forcar == "groq":
            groq_cfg = db.query(AfiliadoConfig).filter_by(plataforma="GROQ_API").first()
            key = (groq_cfg and groq_cfg.access_token) or os.getenv("GROQ_API_KEY", "")
            return ("groq", key) if key and _GROQ_AVAILABLE else (None, "")
        if forcar == "gemini":
            gemini_cfg = db.query(AfiliadoConfig).filter_by(plataforma="GEMINI_API").first()
            key = (gemini_cfg and gemini_cfg.access_token) or os.getenv("GEMINI_API_KEY", "")
            return ("gemini", key) if key and _GEMINI_AVAILABLE else (None, "")
        if forcar == "claude":
            claude_cfg = db.query(AfiliadoConfig).filter_by(plataforma="CLAUDE_API").first()
            key = (claude_cfg and claude_cfg.access_token) or os.getenv("ANTHROPIC_API_KEY", "")
            return ("claude", key) if key and _ANTHROPIC_AVAILABLE else (None, "")
        return (provedor_auto, api_key_auto)

    provedor, api_key = _resolver_ia(body.forcar_ia)

    for rede in redes:
        try:
            if provedor == "groq":
                texto, hashtags = await _gerar_texto_groq(prod, rede, body.tipo_conteudo, api_key)
            elif provedor == "gemini":
                texto, hashtags = await _gerar_texto_gemini(prod, rede, body.tipo_conteudo, api_key)
            elif provedor == "claude":
                texto, hashtags = await _gerar_texto_claude(prod, rede, body.tipo_conteudo, api_key)
            else:
                texto, hashtags = _gerar_texto_template(prod, rede, body.tipo_conteudo)
        except Exception:
            texto, hashtags = _gerar_texto_template(prod, rede, body.tipo_conteudo)
            provedor = None

        # Buscar link afiliado do produto
        link_url = ""
        if prod:
            link_obj = db.query(AfiliadoLink).filter_by(produto_id=prod.id).order_by(
                AfiliadoLink.created_at.desc()
            ).first()
            link_url = link_obj.url_afiliado if link_obj else (prod.url_produto or "")

        c = AfiliadoConteudo(
            produto_id=body.produto_id,
            titulo_produto=prod.titulo if prod else None,
            rede_social=rede,
            tipo_conteudo=body.tipo_conteudo,
            texto_post=texto,
            hashtags=hashtags,
            link_afiliado=link_url,
            imagem_sugerida=prod.imagem_url if prod else None,
            agendado_para=body.agendado_para,
            status="AGENDADO" if body.agendado_para else "RASCUNHO",
        )
        db.add(c)
        db.flush()
        criados.append({
            "id": c.id, "rede_social": rede, "texto_post": texto,
            "hashtags": hashtags, "link_afiliado": link_url,
            "imagem_sugerida": c.imagem_sugerida,
            "gerado_por": provedor or "template",
        })

    db.commit()
    return {"conteudos": criados, "ia_ativa": provedor or "template"}

def _gerar_texto_template(prod, rede: str, tipo: str) -> tuple:
    """Fallback — templates quando Claude não está configurado"""
    titulo = prod.titulo if prod else "produto incrível"
    preco  = f"R$ {prod.preco:.2f}".replace(".", ",") if prod else ""

    if rede == "INSTAGRAM":
        if tipo == "REELS":
            texto = f"🔥 ACHADO DO DIA!\n\n{titulo}\n\n✅ Preço imbatível: {preco}\n💰 Oferta por tempo limitado!\n\n👇 Link na bio para comprar agora!"
        elif tipo == "STORIES":
            texto = f"😱 {titulo}\nPor apenas {preco}!\n👆 Link na bio"
        else:
            texto = f"👀 Você precisa ver isso!\n\n🛍️ {titulo}\n💵 Por apenas {preco}\n\n✨ Qualidade garantida!\n🔗 Link na bio ⬆️\n\n➡️ Marca um amigo que ia amar isso!"
        hashtags = "#oferta #promoção #compras #desconto #achados #shopee #mercadolivre #dica #economia #brasil"

    elif rede == "FACEBOOK":
        texto = f"🛒 OFERTA IMPERDÍVEL!\n\n{titulo}\n\nPor apenas {preco} — aproveite enquanto tem estoque!\n\n✅ Entrega rápida\n✅ Compra segura\n✅ Melhor preço garantido\n\n👇 Clique no link e garanta o seu:"
        hashtags = "#oferta #promoção #compras #desconto"

    elif rede == "TIKTOK":
        texto = f"POV: você encontrou a melhor oferta do dia 😱\n\n{titulo} por {preco}!\n\nLink na bio pra comprar 🛒\n\n#fyp #viral"
        hashtags = "#fyp #viral #oferta #desconto #compras #tiktokshop #achados"

    else:
        texto    = f"Oferta: {titulo} por {preco}"
        hashtags = "#oferta #promoção"

    return texto, hashtags

@router.get("/conteudos")
def listar_conteudos(
    rede_social: str = "",
    status: str = "",
    db: Session = Depends(get_db),
    _=Depends(get_current_user)
):
    q = db.query(AfiliadoConteudo)
    if rede_social:
        q = q.filter_by(rede_social=rede_social)
    if status:
        q = q.filter_by(status=status)
    items = q.order_by(AfiliadoConteudo.created_at.desc()).limit(100).all()
    return [_conteudo_dict(c) for c in items]

@router.patch("/conteudos/{id}/publicar")
async def publicar_conteudo(
    id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user)
):
    c = db.query(AfiliadoConteudo).get(id)
    if not c:
        raise HTTPException(404)

    cfg_rede = db.query(AfiliadoConfig).filter_by(plataforma=c.rede_social, ativo=True).first()
    if not cfg_rede or not cfg_rede.access_token:
        raise HTTPException(400, f"Configure e ative a conta {c.rede_social} primeiro")

    resultado = await _publicar_na_rede(c, cfg_rede)
    if resultado.get("ok"):
        c.status = "PUBLICADO"
        c.publicado_em = datetime.now()
        c.resultado_post_id = resultado.get("post_id")
        db.commit()
        return {"ok": True, "post_id": c.resultado_post_id}
    else:
        raise HTTPException(400, resultado.get("erro", "Erro ao publicar"))

async def _publicar_na_rede(conteudo, cfg) -> dict:
    """Publica na rede social via API"""
    try:
        extra = json.loads(cfg.extra_json or "{}")

        if conteudo.rede_social == "INSTAGRAM":
            # Meta Graph API — Instagram Business
            page_id = extra.get("instagram_business_id", "")
            if not page_id:
                return {"ok": False, "erro": "instagram_business_id não configurado"}
            token = cfg.access_token
            caption = f"{conteudo.texto_post}\n\n{conteudo.hashtags}\n\n🔗 {conteudo.link_afiliado}"
            async with httpx.AsyncClient(timeout=20) as client:
                # Cria container de mídia
                r1 = await client.post(
                    f"https://graph.facebook.com/v19.0/{page_id}/media",
                    params={"access_token": token},
                    json={"caption": caption, "media_type": "IMAGE",
                          "image_url": conteudo.imagem_sugerida or ""}
                )
                data1 = r1.json()
                if "id" not in data1:
                    return {"ok": False, "erro": str(data1)}
                # Publica
                r2 = await client.post(
                    f"https://graph.facebook.com/v19.0/{page_id}/media_publish",
                    params={"access_token": token},
                    json={"creation_id": data1["id"]}
                )
                data2 = r2.json()
                return {"ok": "id" in data2, "post_id": data2.get("id"), "erro": str(data2) if "id" not in data2 else ""}

        elif conteudo.rede_social == "FACEBOOK":
            page_id = extra.get("page_id", "")
            token   = cfg.access_token
            msg = f"{conteudo.texto_post}\n\n{conteudo.link_afiliado}"
            async with httpx.AsyncClient(timeout=20) as client:
                r = await client.post(
                    f"https://graph.facebook.com/v19.0/{page_id}/feed",
                    params={"access_token": token},
                    json={"message": msg}
                )
                data = r.json()
                return {"ok": "id" in data, "post_id": data.get("id"), "erro": str(data) if "id" not in data else ""}

        elif conteudo.rede_social == "TIKTOK":
            # TikTok Content Posting API
            return {"ok": False, "erro": "TikTok auto-post: envie o conteúdo manualmente pelo app"}

        return {"ok": False, "erro": "Rede social não implementada"}
    except Exception as e:
        return {"ok": False, "erro": str(e)}

# ─── Projeção Financeira ──────────────────────────────────────────────────────

@router.get("/financeiro/projecao")
def projecao_financeira(db: Session = Depends(get_db), _=Depends(get_current_user)):
    from sqlalchemy import func, extract
    hoje = date.today()

    # Últimos 6 meses
    historico = []
    for i in range(5, -1, -1):
        from datetime import timedelta
        primeiro = date(hoje.year, hoje.month, 1)
        # calcular mês i meses atrás
        mes = hoje.month - i
        ano = hoje.year
        while mes <= 0:
            mes += 12; ano -= 1
        total_mes = db.query(func.sum(AfiliadoComissao.comissao_valor)).filter(
            AfiliadoComissao.status.in_(["APROVADO", "PAGO"]),
            extract("year",  AfiliadoComissao.data_venda) == ano,
            extract("month", AfiliadoComissao.data_venda) == mes,
        ).scalar() or 0
        historico.append({"mes": f"{ano}-{mes:02d}", "valor": round(total_mes, 2)})

    # Projeção próximo mês (média dos últimos 3)
    ultimos3 = [h["valor"] for h in historico[-3:] if h["valor"] > 0]
    projecao = round(sum(ultimos3) / len(ultimos3), 2) if ultimos3 else 0

    # A receber (pendente + aprovado)
    a_receber = db.query(func.sum(AfiliadoComissao.comissao_valor)).filter(
        AfiliadoComissao.status.in_(["PENDENTE", "APROVADO"])
    ).scalar() or 0

    # Por plataforma
    por_plat = db.query(
        AfiliadoComissao.plataforma,
        func.sum(AfiliadoComissao.comissao_valor)
    ).filter(AfiliadoComissao.status.in_(["APROVADO", "PAGO"])).group_by(
        AfiliadoComissao.plataforma
    ).all()

    return {
        "historico":   historico,
        "projecao_mes": projecao,
        "a_receber":   round(a_receber, 2),
        "por_plataforma": [{"plataforma": p, "total": round(v, 2)} for p, v in por_plat],
    }

# ─── Helpers ─────────────────────────────────────────────────────────────────

def _prod_dict(p: AfiliadoProduto) -> dict:
    return {
        "id": p.id, "plataforma": p.plataforma, "produto_ext_id": p.produto_ext_id,
        "titulo": p.titulo, "preco": p.preco, "preco_original": p.preco_original,
        "comissao_pct": p.comissao_pct, "comissao_valor": p.comissao_valor,
        "categoria": p.categoria, "imagem_url": p.imagem_url, "url_produto": p.url_produto,
        "vendas_mes": p.vendas_mes, "avaliacao": p.avaliacao,
        "total_avaliacoes": p.total_avaliacoes, "favorito": p.favorito,
        "notas": p.notas, "created_at": str(p.created_at),
    }

def _meta_dict(m: AfiliadoMeta) -> dict:
    pct = round(m.realizado_renda / m.meta_renda * 100, 1) if m.meta_renda else 0
    return {
        "id": m.id, "mes_ano": m.mes_ano, "meta_renda": m.meta_renda,
        "realizado_renda": m.realizado_renda, "pct": pct,
        "status": m.status, "estrategia_ia": json.loads(m.estrategia_ia) if m.estrategia_ia else None,
    }

def _comissao_dict(c: AfiliadoComissao) -> dict:
    return {
        "id": c.id, "plataforma": c.plataforma, "titulo_produto": c.titulo_produto,
        "data_venda": str(c.data_venda), "data_prevista_pgto": str(c.data_prevista_pgto),
        "data_pgto": str(c.data_pgto), "valor_venda": c.valor_venda,
        "comissao_pct": c.comissao_pct, "comissao_valor": c.comissao_valor,
        "status": c.status, "referencia_ext": c.referencia_ext,
    }

def _conteudo_dict(c: AfiliadoConteudo) -> dict:
    return {
        "id": c.id, "produto_id": c.produto_id, "titulo_produto": c.titulo_produto,
        "rede_social": c.rede_social, "tipo_conteudo": c.tipo_conteudo,
        "texto_post": c.texto_post, "hashtags": c.hashtags, "link_afiliado": c.link_afiliado,
        "imagem_sugerida": c.imagem_sugerida, "status": c.status,
        "publicado_em": str(c.publicado_em) if c.publicado_em else None,
        "agendado_para": str(c.agendado_para) if c.agendado_para else None,
        "alcance": c.alcance, "engajamento": c.engajamento, "cliques_link": c.cliques_link,
        "created_at": str(c.created_at),
    }
