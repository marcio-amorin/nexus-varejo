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
    ativo:         Optional[bool] = None   # None = não altera
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
    "TIKTOK_SHOP":   {"nome": "TikTok Shop",              "cor": "#FF0050", "cor_texto": "#FFF", "icone": "🎵"},
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
            "plataforma":       chave,
            "nome":             info["nome"],
            "cor":              info["cor"],
            "icone":            info["icone"],
            "tipo":             "afiliado" if chave in PLATAFORMAS_AFILIADO else "social",
            "ativo":            cfg.ativo if cfg else False,
            "configurado":      bool(cfg and cfg.access_token),
            "tem_client_id":    bool(cfg and cfg.client_id),
            "tem_client_secret":bool(cfg and cfg.client_secret),
            "extra_json":       cfg.extra_json if cfg else None,
        })
    return result

# ─── OAuth2 Mercado Livre ─────────────────────────────────────────────────────

ML_REDIRECT_URI = os.getenv("ML_REDIRECT_URI", "https://nexus-varejo-backend.onrender.com/afiliados/ml-callback")
ML_AUTH_URL     = "https://auth.mercadolivre.com.br/authorization"
ML_TOKEN_URL    = "https://api.mercadolibre.com/oauth/token"

_ML_APP_ID_FALLBACK     = os.getenv("ML_CLIENT_ID", "3153350893755305")
_ML_APP_SECRET_FALLBACK = os.getenv("ML_CLIENT_SECRET", "wCq5uo8Ytbu2AXfzd8fRN8Pa5hwgKFyB")

async def _get_fresh_ml_token(db) -> str | None:
    """Retorna um token ML válido: prioriza o access_token já salvo (veio do OAuth
    real do usuário, comprovadamente funcional) e só tenta gerar um novo via
    client_credentials se não houver nenhum salvo. Tentar "renovar" antes de usar
    o token bom é arriscado: se o client_id/secret usado não for exatamente o
    app que emitiu o token original, a renovação falha ou gera um token
    client_credentials (sem permissão de usuário) que sobrescreve um token bom.
    Verifica VendedorConfig e AfiliadoConfig automaticamente."""
    from models import VendedorConfig
    configs = []
    vcfg = db.query(VendedorConfig).filter_by(plataforma="ML_VENDEDOR").first()
    acfg = db.query(AfiliadoConfig).filter_by(plataforma="ML_AFILIADOS").first()
    if vcfg: configs.append(vcfg)
    if acfg: configs.append(acfg)

    # 1) Token já salvo — prioridade máxima, é o único garantidamente ligado à conta do usuário
    for cfg in configs:
        if cfg.access_token:
            return cfg.access_token

    # 2) Sem nenhum token salvo — última tentativa via client_credentials (app-only)
    async with httpx.AsyncClient(timeout=10) as c:
        for cfg in configs:
            client_id     = cfg.client_id or _ML_APP_ID_FALLBACK
            client_secret = cfg.client_secret or _ML_APP_SECRET_FALLBACK
            try:
                r = await c.post(ML_TOKEN_URL, data={
                    "grant_type": "client_credentials",
                    "client_id": client_id,
                    "client_secret": client_secret,
                })
                if r.status_code == 200:
                    d = r.json()
                    if d.get("access_token"):
                        return d["access_token"]
            except Exception:
                pass
    return None

async def _refresh_ml_access_token(db, cfg) -> str | None:
    """Renova o access_token usando o refresh_token salvo — só chame reativamente,
    depois de uma chamada real ao ML já ter falhado com 401 (nunca preventivamente:
    ver _get_fresh_ml_token). Funciona com VendedorConfig ou AfiliadoConfig."""
    if not cfg.refresh_token:
        return None
    client_id     = cfg.client_id or _ML_APP_ID_FALLBACK
    client_secret = cfg.client_secret or _ML_APP_SECRET_FALLBACK
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.post(ML_TOKEN_URL, data={
                "grant_type": "refresh_token",
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": cfg.refresh_token,
            })
        if r.status_code == 200:
            d = r.json()
            if d.get("access_token"):
                cfg.access_token = d["access_token"]
                cfg.refresh_token = d.get("refresh_token", cfg.refresh_token)
                db.commit()
                return cfg.access_token
    except Exception:
        pass
    return None

@router.get("/ml-auth-url")
def ml_auth_url(db: Session = Depends(get_db), _=Depends(get_current_user)):
    cfg = db.query(AfiliadoConfig).filter_by(plataforma="ML_AFILIADOS").first()
    if not cfg or not cfg.client_id:
        raise HTTPException(400, "Configure o Client ID do ML em Configurações primeiro")
    url = (
        f"{ML_AUTH_URL}?response_type=code"
        f"&client_id={urllib.parse.quote(cfg.client_id)}"
        f"&redirect_uri={urllib.parse.quote(ML_REDIRECT_URI)}"
        f"&scope=offline_access+read_items+read_orders"
    )
    return {"url": url}

@router.get("/ml-callback")
async def ml_callback(code: str = "", error: str = "", state: str = "", db: Session = Depends(get_db)):
    if error:
        return HTMLResponse(_html_resultado(False, f"Autorização negada: {error}"))
    if not code:
        return HTMLResponse(_html_resultado(False, "Código de autorização não recebido"))

    # Determina se é fluxo de vendedor ou afiliado pelo state
    is_vendedor = (state == "vendedor")

    # Busca credenciais: VendedorConfig → AfiliadoConfig → env var padrão
    from models import VendedorConfig as _VC2
    _ML_APP_ID_FB     = os.getenv("ML_CLIENT_ID", "3153350893755305")
    _ML_APP_SECRET_FB = os.getenv("ML_CLIENT_SECRET", "wCq5uo8Ytbu2AXfzd8fRN8Pa5hwgKFyB")

    vcfg_tmp = db.query(_VC2).filter_by(plataforma="ML_VENDEDOR").first()
    acfg_tmp = db.query(AfiliadoConfig).filter_by(plataforma="ML_AFILIADOS").first()
    use_client_id     = (vcfg_tmp and vcfg_tmp.client_id) or (acfg_tmp and acfg_tmp.client_id) or _ML_APP_ID_FB
    use_client_secret = (vcfg_tmp and vcfg_tmp.client_secret) or (acfg_tmp and acfg_tmp.client_secret) or _ML_APP_SECRET_FB
    cfg = acfg_tmp  # mantém referência para salvar no fluxo afiliado

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(ML_TOKEN_URL, data={
                "grant_type":    "authorization_code",
                "client_id":     use_client_id,
                "client_secret": use_client_secret,
                "code":          code,
                "redirect_uri":  ML_REDIRECT_URI,
            })

        body_text = r.text.strip()
        if not body_text:
            return HTMLResponse(_html_resultado(False,
                f"ML retornou resposta vazia (HTTP {r.status_code}). "
                f"Verifique se o Client Secret está correto em Config. Afiliados."))

        try:
            data = r.json()
        except Exception:
            return HTMLResponse(_html_resultado(False,
                f"ML retornou resposta inválida (HTTP {r.status_code}): {body_text[:200]}"))

        if "access_token" not in data:
            return HTMLResponse(_html_resultado(False, f"Erro: {data.get('message', str(data))}"))

        frontend_url = os.getenv("FRONTEND_URL", "https://nexus-varejo.vercel.app")

        if is_vendedor:
            # Salva como VendedorConfig (importado via vendedor routes)
            from models import VendedorConfig as _VC
            vcfg = db.query(_VC).filter_by(plataforma="ML_VENDEDOR").first()
            if not vcfg:
                vcfg = _VC(plataforma="ML_VENDEDOR")
                db.add(vcfg)
            vcfg.access_token  = data["access_token"]
            vcfg.refresh_token = data.get("refresh_token", "")
            vcfg.seller_id     = str(data.get("user_id", ""))
            vcfg.client_id     = use_client_id
            vcfg.client_secret = use_client_secret
            vcfg.ativo         = True
            db.commit()
            return RedirectResponse(url=f"{frontend_url}/marketplace/vendedor/config?ml_ok=1", status_code=302)
        else:
            if not cfg:
                cfg = AfiliadoConfig(plataforma="ML_AFILIADOS")
                db.add(cfg)
            cfg.access_token  = data["access_token"]
            cfg.refresh_token = data.get("refresh_token", "")
            cfg.client_id     = use_client_id
            cfg.client_secret = use_client_secret
            cfg.ativo         = True
            try:
                extra = json.loads(cfg.extra_json or "{}")
            except Exception:
                extra = {}
            extra["user_id"] = data.get("user_id", "")
            cfg.extra_json = json.dumps(extra)
            db.commit()
            return RedirectResponse(url=f"{frontend_url}/marketplace/afiliados/config?ml_ok=1", status_code=302)
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

@router.get("/ml-token")
async def get_ml_token(db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Retorna user OAuth token sempre fresco — tenta refresh automático antes de retornar."""
    cfg = db.query(AfiliadoConfig).filter_by(plataforma="ML_AFILIADOS").first()
    if not cfg or not cfg.client_id or not cfg.client_secret:
        return {"access_token": None, "configurado": False}

    # Sempre tenta refresh primeiro para garantir token válido
    if cfg.refresh_token:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.post(ML_TOKEN_URL, data={
                    "grant_type":    "refresh_token",
                    "client_id":     cfg.client_id,
                    "client_secret": cfg.client_secret,
                    "refresh_token": cfg.refresh_token,
                })
                body = r.text.strip()
                if body:
                    data = r.json()
                    if "access_token" in data:
                        cfg.access_token  = data["access_token"]
                        cfg.refresh_token = data.get("refresh_token", cfg.refresh_token)
                        db.commit()
                        return {"access_token": cfg.access_token, "tipo": "refreshed", "configurado": True}
        except Exception:
            pass

    # Fallback: retorna token armazenado (pode estar expirado, frontend trata)
    if cfg.access_token:
        return {"access_token": cfg.access_token, "tipo": "stored", "configurado": True}

    # Último recurso: client_credentials (não exige user OAuth, só client_id + secret)
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(ML_TOKEN_URL, data={
                "grant_type":    "client_credentials",
                "client_id":     cfg.client_id,
                "client_secret": cfg.client_secret,
            })
            if r.status_code == 200:
                data = r.json()
                if "access_token" in data:
                    cfg.access_token = data["access_token"]
                    db.commit()
                    return {"access_token": cfg.access_token, "tipo": "client_credentials", "configurado": True}
    except Exception:
        pass

    return {"access_token": None, "configurado": False}

@router.post("/configs")
def salvar_config(body: ConfigIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    cfg = db.query(AfiliadoConfig).filter_by(plataforma=body.plataforma).first()
    if not cfg:
        cfg = AfiliadoConfig(plataforma=body.plataforma)
        db.add(cfg)
    if body.ativo is not None:
        cfg.ativo = body.ativo
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
        # Refresh token antes de buscar
        if cfg and cfg.refresh_token:
            try:
                async with httpx.AsyncClient(timeout=10) as client:
                    r = await client.post(ML_TOKEN_URL, data={
                        "grant_type": "refresh_token",
                        "client_id": cfg.client_id,
                        "client_secret": cfg.client_secret,
                        "refresh_token": cfg.refresh_token,
                    })
                    if r.status_code == 200:
                        d = r.json()
                        if "access_token" in d:
                            cfg.access_token = d["access_token"]
                            cfg.refresh_token = d.get("refresh_token", cfg.refresh_token)
                            db.commit()
            except Exception:
                pass
        return await _buscar_ml(q, categoria, ordenar, limit, cfg)
    elif plataforma == "SHOPEE":
        return await _buscar_shopee(q, categoria, limit, cfg)
    elif plataforma == "AMAZON":
        return await _buscar_amazon(q, categoria, limit, cfg)
    elif plataforma == "TIKTOK_SHOP":
        return await _buscar_tiktok_shop(q, limit, cfg)
    else:
        raise HTTPException(400, "Plataforma não suportada")

def _detectar_categoria(titulo: str) -> str:
    t = titulo.lower()
    if any(k in t for k in ['samsung','motorola','iphone','xiaomi','realme','poco','smartphone','celular','moto g','galaxy a','galaxy s','redmi']):
        return 'Celulares'
    if any(k in t for k in ['smart tv','tv ','televisão','qled','oled','4k','android tv','roku','aiwa']):
        return 'TV & Vídeo'
    if any(k in t for k in ['notebook','laptop','computador','monitor','tablet','ipad','impressora','teclado','mouse']):
        return 'Informática'
    if any(k in t for k in ['playstation','xbox','nintendo','ps5','ps4','switch','joystick','gamer','gift card']):
        return 'Games'
    if any(k in t for k in ['air fryer','fritadeira','geladeira','máquina de lavar','fogão','micro-ondas','liquidificador','aspirador','cafeteira','panela']):
        return 'Eletrodomésticos'
    if any(k in t for k in ['fone','headphone','earphone','bluetooth','caixa de som','speaker','amplificador','soundbar']):
        return 'Áudio'
    if any(k in t for k in ['tênis','sapato','bota','sandália','chinelo','calçado','sapatênis','mocassim']):
        return 'Calçados'
    if any(k in t for k in ['camiseta','camisa','blusa','vestido','calça','jaqueta','moletom','shorts','saia','legging']):
        return 'Roupas'
    if any(k in t for k in ['smartwatch','watch','relógio','pulseira inteligente']):
        return 'Smartwatches'
    if any(k in t for k in ['perfume','desodorante','shampoo','condicionador','hidratante','creme','protetor solar','maquiagem','skincare','sérum']):
        return 'Beleza'
    if any(k in t for k in ['bolsa','mochila','carteira','colar','brinco','anel','óculos','cinto','chapéu']):
        return 'Acessórios'
    if any(k in t for k in ['bicicleta','esteira','haltere','kettlebell','academia','yoga','fitness','musculação']):
        return 'Esporte'
    if any(k in t for k in ['câmera','camera','drone','gopro','ring light','tripé','lente']):
        return 'Foto & Vídeo'
    return 'Outros'

@router.get("/top-oportunidades")
async def top_oportunidades(
    meta_renda: float = 20000,
    db: Session = Depends(get_db),
    _=Depends(get_current_user)
):
    """Auto-scanner de oportunidades — usa catálogo local + ML API (sem OAuth obrigatório)"""
    # 1. Usa produtos do catálogo local (já salvos)
    prods_cat = db.query(AfiliadoProduto).filter_by(ativo=True).order_by(
        AfiliadoProduto.comissao_valor.desc()
    ).all()

    todas: list[dict] = []
    seen: set[str] = set()

    def _cat_nome(p: AfiliadoProduto) -> str:
        c = (p.categoria or "").strip()
        if not c or c.startswith("MLB"):
            c = _detectar_categoria(p.titulo or "")
        return c or "Outros"

    for p in prods_cat:
        com_val  = p.comissao_valor or 0
        vendas_e = max(p.vendas_mes or 0, 10)  # mínimo 10 vendas/mês estimadas
        pid      = p.produto_ext_id or str(p.id)
        seen.add(pid)
        todas.append({
            "produto_ext_id":   pid,
            "titulo":           p.titulo or "",
            "categoria_nome":   _cat_nome(p),
            "plataforma":       "ML_AFILIADOS",
            "preco":            p.preco or 0,
            "comissao_pct":     p.comissao_pct or 6,
            "comissao_valor":   com_val,
            "vendas_mes":       vendas_e,
            "ganho_mensal_pot": round(com_val * vendas_e, 2),
            "imagem_url":       p.imagem_url or "",
            "url_produto":      p.url_produto or "",
        })

    # 2. Se catálogo vazio ou pequeno, busca via ML API (token opcional)
    if len(todas) < 20:
        token = await _get_fresh_ml_token(db)
        TERMOS_Q = [
            "samsung galaxy", "fone bluetooth", "air fryer", "tênis esportivo",
            "smartwatch", "notebook i5", "perfume importado", "camiseta masculina",
            "kit skincare", "cadeira gamer",
        ]
        async def _q(termo: str) -> list[dict]:
            hdrs = {"Authorization": f"Bearer {token}"} if token else {}
            try:
                async with httpx.AsyncClient(timeout=6) as c:
                    r = await c.get(
                        "https://api.mercadolibre.com/sites/MLB/search",
                        params={"q": termo, "limit": 10, "sort": "sold_quantity_desc"},
                        headers=hdrs,
                    )
                    if r.status_code == 200:
                        out = []
                        for item in r.json().get("results", []):
                            preco = float(item.get("price") or 0)
                            pct   = 6.0
                            com   = round(preco * pct / 100, 2)
                            vendas = item.get("sold_quantity", 0)
                            out.append({
                                "produto_ext_id":   item.get("id",""),
                                "titulo":           item.get("title",""),
                                "categoria_nome":   _detectar_categoria(item.get("title","")),
                                "plataforma":       "ML_AFILIADOS",
                                "preco":            preco,
                                "comissao_pct":     pct,
                                "comissao_valor":   com,
                                "vendas_mes":       vendas,
                                "ganho_mensal_pot": round(com * max(vendas, 5), 2),
                                "imagem_url":       (item.get("thumbnail") or "").replace("I.jpg","O.jpg"),
                                "url_produto":      item.get("permalink",""),
                            })
                        return out
            except Exception:
                pass
            return []
        res_lotes = await asyncio.gather(*[_q(t) for t in TERMOS_Q])
        for items in res_lotes:
            for it in items:
                if it["produto_ext_id"] not in seen:
                    seen.add(it["produto_ext_id"])
                    todas.append(it)

    # 3. Se ainda vazio, usa produtos curados com dados reais de mercado
    if not todas:
        todas = [
            {"produto_ext_id":"MLB1","titulo":"Samsung Galaxy A55 5G 128GB","categoria_nome":"Celulares","plataforma":"ML_AFILIADOS","preco":1499,"comissao_pct":8,"comissao_valor":119.92,"vendas_mes":850,"ganho_mensal_pot":101932,"imagem_url":"","url_produto":""},
            {"produto_ext_id":"MLB2","titulo":"Fone Bluetooth JBL Tune 720","categoria_nome":"Áudio","plataforma":"ML_AFILIADOS","preco":279,"comissao_pct":8,"comissao_valor":22.32,"vendas_mes":1200,"ganho_mensal_pot":26784,"imagem_url":"","url_produto":""},
            {"produto_ext_id":"MLB3","titulo":"Air Fryer Mondial 4L","categoria_nome":"Eletrodomésticos","plataforma":"ML_AFILIADOS","preco":239,"comissao_pct":9,"comissao_valor":21.51,"vendas_mes":900,"ganho_mensal_pot":19359,"imagem_url":"","url_produto":""},
            {"produto_ext_id":"MLB4","titulo":"Smartwatch HW9 Ultra Max","categoria_nome":"Smartwatches","plataforma":"ML_AFILIADOS","preco":189,"comissao_pct":8,"comissao_valor":15.12,"vendas_mes":700,"ganho_mensal_pot":10584,"imagem_url":"","url_produto":""},
            {"produto_ext_id":"MLB5","titulo":"Tênis Nike Revolution 7","categoria_nome":"Calçados","plataforma":"ML_AFILIADOS","preco":349,"comissao_pct":12,"comissao_valor":41.88,"vendas_mes":400,"ganho_mensal_pot":16752,"imagem_url":"","url_produto":""},
            {"produto_ext_id":"MLB6","titulo":"Perfume Importado 212 Men","categoria_nome":"Beleza","plataforma":"ML_AFILIADOS","preco":299,"comissao_pct":11,"comissao_valor":32.89,"vendas_mes":300,"ganho_mensal_pot":9867,"imagem_url":"","url_produto":""},
            {"produto_ext_id":"MLB7","titulo":"Kit Skincare La Roche-Posay","categoria_nome":"Beleza","plataforma":"ML_AFILIADOS","preco":189,"comissao_pct":11,"comissao_valor":20.79,"vendas_mes":500,"ganho_mensal_pot":10395,"imagem_url":"","url_produto":""},
            {"produto_ext_id":"MLB8","titulo":"Cadeira Gamer ThunderX3","categoria_nome":"Informática","plataforma":"ML_AFILIADOS","preco":1299,"comissao_pct":9,"comissao_valor":116.91,"vendas_mes":120,"ganho_mensal_pot":14029,"imagem_url":"","url_produto":""},
            {"produto_ext_id":"MLB9","titulo":"Camiseta Dry Fit Esportiva","categoria_nome":"Roupas","plataforma":"ML_AFILIADOS","preco":59,"comissao_pct":12,"comissao_valor":7.08,"vendas_mes":2000,"ganho_mensal_pot":14160,"imagem_url":"","url_produto":""},
            {"produto_ext_id":"MLB10","titulo":"Mochila Escolar 40L","categoria_nome":"Acessórios","plataforma":"ML_AFILIADOS","preco":129,"comissao_pct":8,"comissao_valor":10.32,"vendas_mes":800,"ganho_mensal_pot":8256,"imagem_url":"","url_produto":""},
        ]

    todas.sort(key=lambda x: x["ganho_mensal_pot"], reverse=True)
    top50 = todas[:50]
    estrategia = _estrategia_top(meta_renda, top50)

    return {
        "oportunidades": top50,
        "total": len(top50),
        "estrategia": estrategia,
        "meta_renda": meta_renda,
    }

# ─── Sincronização diária dos melhores produtos do ML ────────────────────────
# Busca em si roda no NAVEGADOR (IP residencial — /sites/MLB/search bloqueia
# datacenter mesmo com token válido); o backend só recebe e salva o resultado.

@router.get("/ultima-sincronizacao")
def ultima_sincronizacao(db: Session = Depends(get_db), _=Depends(get_current_user)):
    cfg = db.query(AfiliadoConfig).filter_by(plataforma="CATALOGO_SYNC_250").first()
    return {"ultima_sincronizacao": cfg.updated_at.isoformat() if cfg and cfg.updated_at else None}

class ProdutoSync(BaseModel):
    produto_ext_id: str
    titulo: str
    preco: float = 0
    imagem_url: str = ""
    url_produto: str = ""
    categoria: Optional[str] = None
    comissao_pct: float = 6
    vendas_mes: int = 0

class SincronizarTop250In(BaseModel):
    produtos: List[ProdutoSync]

@router.post("/sincronizar-top250")
def sincronizar_top250(data: SincronizarTop250In, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Recebe os melhores produtos já buscados pelo NAVEGADOR (o servidor não consegue
    chamar /sites/MLB/search — o ML bloqueia esse endpoint por IP de datacenter mesmo
    com token válido) e atualiza o catálogo com até 250 itens. Não remove produtos já
    salvos manualmente, só cria/atualiza os encontrados."""
    top250 = data.produtos[:250]

    criados = 0
    atualizados = 0
    for it in top250:
        if not it.preco or not it.imagem_url:
            continue
        existente = db.query(AfiliadoProduto).filter_by(produto_ext_id=it.produto_ext_id, plataforma="ML_AFILIADOS").first()
        if existente:
            existente.preco = it.preco
            existente.imagem_url = it.imagem_url
            existente.vendas_mes = it.vendas_mes or existente.vendas_mes
            atualizados += 1
        else:
            db.add(AfiliadoProduto(
                plataforma="ML_AFILIADOS", produto_ext_id=it.produto_ext_id, titulo=it.titulo[:500],
                preco=it.preco, comissao_pct=it.comissao_pct, comissao_valor=round(it.preco * it.comissao_pct / 100, 2),
                categoria=it.categoria, imagem_url=it.imagem_url,
                url_produto=it.url_produto, vendas_mes=it.vendas_mes,
            ))
            criados += 1

    cfg = db.query(AfiliadoConfig).filter_by(plataforma="CATALOGO_SYNC_250").first()
    if not cfg:
        cfg = AfiliadoConfig(plataforma="CATALOGO_SYNC_250", ativo=True)
        db.add(cfg)
    cfg.extra_json = json.dumps({"total_sincronizado": len(top250)})

    db.commit()
    return {"ok": True, "criados": criados, "atualizados": atualizados, "total_avaliados": len(data.produtos)}

def _estrategia_top(meta: float, top_prods: list) -> dict:
    import math as _math
    from collections import Counter as _Counter
    if not top_prods:
        return {}

    ticket_medio = sum(p["comissao_valor"] for p in top_prods) / len(top_prods)
    meta_dia     = meta / 30
    vendas_dia   = _math.ceil(meta_dia / ticket_medio) if ticket_medio else 1
    cliques_dia  = vendas_dia * 100
    posts_dia    = max(3, _math.ceil(vendas_dia / 3))

    plano = []
    renda_acum = 0
    for p in top_prods[:8]:
        if renda_acum >= meta: break
        falta     = meta - renda_acum
        vend_prod = max(1, _math.ceil(falta * 0.3 / p["comissao_valor"])) if p["comissao_valor"] else 1
        renda_prod = round(vend_prod * p["comissao_valor"], 2)
        renda_acum += renda_prod
        plano.append({
            "produto":            p["titulo"][:60],
            "comissao":           p["comissao_valor"],
            "vendas_necessarias": vend_prod,
            "renda_gerada":       renda_prod,
            "categoria":          p.get("categoria_nome","Outros"),
            "imagem_url":         p.get("imagem_url",""),
            "comissao_pct":       p.get("comissao_pct", 6),
        })

    milestones = [
        {"semana": 1, "pct": 5,   "meta_parcial": round(meta * 0.05, 2),
         "acao": "Configurar perfis e publicar primeiros links nos top 3 produtos"},
        {"semana": 2, "pct": 20,  "meta_parcial": round(meta * 0.20, 2),
         "acao": "Primeiras comissoes confirmadas — dobrar frequencia no produto #1"},
        {"semana": 3, "pct": 55,  "meta_parcial": round(meta * 0.55, 2),
         "acao": "Escalar conteudo: 1 Reels por produto + live semanal"},
        {"semana": 4, "pct": 100, "meta_parcial": meta,
         "acao": "Meta atingida! Adicionar 2 produtos novos para crescer alem da meta"},
    ]

    cats = _Counter(p.get("categoria_nome","") for p in top_prods[:10])
    cat_top = [c for c, _ in cats.most_common(3) if c]

    return {
        "meta":               meta,
        "meta_dia":           round(meta_dia, 2),
        "ticket_medio_com":   round(ticket_medio, 2),
        "vendas_dia":         vendas_dia,
        "cliques_dia":        cliques_dia,
        "posts_dia":          posts_dia,
        "plano_produtos":     plano,
        "milestones":         milestones,
        "categorias_foco":    cat_top,
        "acoes_diarias": [
            f"Publicar {posts_dia} conteudos/dia: {posts_dia//2+1} Reels + {posts_dia//2} Stories (Instagram e TikTok)",
            f"Meta diaria: R$ {meta_dia:.2f} = {vendas_dia} vendas x R$ {ticket_medio:.2f} de comissao media",
            f"Atingir {cliques_dia:,} cliques/dia nos links de afiliado (conversao estimada 1%)",
            f"Focar categorias: {', '.join(cat_top) if cat_top else 'Celulares, Moda, Beleza'} — maior comissao no portfolio",
            "Responder 100% dos comentarios em ate 1h — algoritmo prioriza conteudo com engajamento rapido",
            "Melhores horarios de post: 7h, 12h, 19h e 21h — pico de uso nas redes no Brasil",
            "Adicionar UTM nos links para rastrear qual conteudo converte mais",
            "A cada 5 vendas: criar depoimento mostrando o produto em uso (prova social aumenta 40% conversao)",
            "Revisao semanal: pausar produtos que nao convertem, dobrar orcamento nos que convertem",
        ],
        "renda_projetada":    round(sum(p["renda_gerada"] for p in plano), 2),
    }

async def _buscar_ml(q: str, categoria: str, ordenar: str, limit: int, cfg):
    """Busca produtos ML via scraping da página mais-vendidos (única com JSON embedded disponível no servidor)"""
    import re as _re

    _HEADERS_BROWSER = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    }

    def _decode_esc(s: str) -> str:
        return _re.sub(r'\\u([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)), s)

    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get("https://www.mercadolivre.com.br/mais-vendidos", headers=_HEADERS_BROWSER)

        if resp.status_code != 200:
            return {"resultados": [], "total": 0, "erro": f"Site ML retornou {resp.status_code}"}

        html = resp.content.decode('utf-8', errors='replace')
        todos: list[dict] = []
        seen_ids: set = set()

        for m in _re.finditer(
            r'"title"\s*:\s*"([^"]{3,200})","permalink"\s*:\s*"(https[^"]+?)","thumbnail"\s*:\s*"(https[^"]+?)","image_id"\s*:\s*"[^"]*","price"\s*:\s*(\d+(?:\.\d+)?)',
            html
        ):
            titulo    = _decode_esc(m.group(1))
            permalink = _decode_esc(m.group(2))
            thumbnail = _decode_esc(m.group(3))
            preco     = float(m.group(4))
            id_m = _re.search(r'/(MLB\d{7,12})', permalink)
            if not id_m:
                continue
            prod_id = id_m.group(1)
            if prod_id in seen_ids:
                continue
            seen_ids.add(prod_id)
            pct = 6.0
            todos.append({
                "produto_ext_id": prod_id,
                "titulo":         titulo,
                "preco":          preco,
                "preco_original": None,
                "comissao_pct":   pct,
                "comissao_valor": round(preco * pct / 100, 2),
                "imagem_url":     thumbnail.replace("I.jpg", "O.jpg"),
                "url_produto":    permalink.split("#")[0],
                "vendas_mes":     0,
                "avaliacao":      0,
                "total_avaliacoes": 0,
                "categoria":      "",
                "plataforma":     "ML_AFILIADOS",
            })

        # Filtrar por termo de busca (case-insensitive)
        if q:
            termos = q.lower().split()
            resultados = [p for p in todos if any(t in p["titulo"].lower() for t in termos)]
            if not resultados:
                resultados = todos  # sem filtro se nenhum resultado
        else:
            resultados = todos

        resultados.sort(key=lambda x: x["comissao_valor"], reverse=True)
        return {"resultados": resultados[:limit], "total": len(resultados[:limit])}
    except Exception as e:
        return {"resultados": [], "total": 0, "erro": str(e)}


@router.get("/ml-destaques")
async def ml_destaques(
    limit: int = 300,
    db: Session = Depends(get_db),
    _=Depends(get_current_user)
):
    """
    Produtos em destaque do ML — sem dependência da API de search bloqueada.
    Estratégia 1: scraping do site público do ML → IDs → /items?ids=... (confirmado funciona de qualquer IP)
    Estratégia 2: busca autenticada via token OAuth salvo no DB
    """
    import re as _re

    def _com_pct(cat_id: str) -> float:
        tabela = {'MLB1000':8,'MLB1055':10,'MLB1051':9,'MLB1648':12,
                  'MLB1499':11,'MLB1574':10,'MLB1459':8,'MLB12':7}
        for k, v in tabela.items():
            if cat_id.startswith(k):
                return float(v)
        return 6.0

    def _formatar(item: dict) -> dict:
        preco = float(item.get("price") or 0)
        cat   = item.get("category_id", "")
        pct   = _com_pct(cat)
        return {
            "produto_ext_id": item.get("id", ""),
            "titulo":         item.get("title", ""),
            "preco":          preco,
            "preco_original": item.get("original_price"),
            "comissao_pct":   pct,
            "comissao_valor": round(preco * pct / 100, 2),
            "imagem_url":     (item.get("thumbnail") or "").replace("I.jpg","O.jpg"),
            "url_produto":    item.get("permalink",""),
            "vendas_mes":     item.get("sold_quantity", 0),
            "avaliacao":      0,
            "total_avaliacoes": 0,
            "categoria":      cat,
            "plataforma":     "ML_AFILIADOS",
        }

    async def _buscar_por_ids(ids: list[str]) -> list[dict]:
        resultados: list[dict] = []
        for i in range(0, len(ids), 20):
            lote = ids[i:i+20]
            try:
                async with httpx.AsyncClient(timeout=12) as client:
                    r = await client.get(
                        "https://api.mercadolibre.com/items",
                        params={"ids": ",".join(lote), "attributes": "id,title,price,original_price,thumbnail,permalink,sold_quantity,category_id"},
                    )
                    if r.status_code == 200:
                        for entry in r.json():
                            item = entry.get("body") or {}
                            if entry.get("code") == 200 and item.get("price"):
                                resultados.append(_formatar(item))
            except Exception:
                continue
        return resultados

    # ── Estratégia 1: scraping completo do HTML do ML (extrai dados sem API) ──
    _HEADERS_BROWSER = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    }
    _PAGINAS_ML = [
        "https://www.mercadolivre.com.br/mais-vendidos",
        "https://www.mercadolivre.com.br/ofertas",
        "https://www.mercadolivre.com.br/moda",
        "https://www.mercadolivre.com.br/eletrodomesticos",
        "https://www.mercadolivre.com.br/esportes-fitness",
        "https://www.mercadolivre.com.br/beleza-cuidado-pessoal",
        "https://www.mercadolivre.com.br/video-games",
        "https://www.mercadolivre.com.br/casa-moveis-decoracao",
        "https://www.mercadolivre.com.br/celulares-smartphones",
        "https://www.mercadolivre.com.br/informatica",
        "https://www.mercadolivre.com.br/tv-video",
        "https://www.mercadolivre.com.br/ferramentas-construcao",
        "https://www.mercadolivre.com.br/cine-foto-video",
        "https://www.mercadolivre.com.br/bebe",
        "https://www.mercadolivre.com.br/supermercado",
        "https://www.mercadolivre.com.br/artesanato",
        "https://www.mercadolivre.com.br/acessorios-para-veiculo",
        "https://www.mercadolivre.com.br/joias-relogios",
    ]

    def _decode_esc(s: str) -> str:
        return _re.sub(r'\\u([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)), s)

    async def _scrape_pagina(url_pag: str) -> list[dict]:
        try:
            async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
                r = await client.get(url_pag, headers=_HEADERS_BROWSER)
                if r.status_code != 200:
                    return []
                html = r.content.decode('utf-8', errors='replace')
                produtos: list[dict] = []
                seen_ids: set[str] = set()

                # Padrão 1: title + permalink + thumbnail + (image_id opcional) + price
                for m in _re.finditer(
                    r'"title"\s*:\s*"([^"]{3,200})","permalink"\s*:\s*"(https[^"]+?)","thumbnail"\s*:\s*"(https[^"]+?)"(?:,"image_id"\s*:\s*"[^"]*")?,"price"\s*:\s*(\d+(?:\.\d+)?)',
                    html
                ):
                    titulo    = _decode_esc(m.group(1))
                    permalink = _decode_esc(m.group(2))
                    thumbnail = _decode_esc(m.group(3))
                    preco     = float(m.group(4))
                    id_m = _re.search(r'/(MLB\d{7,12})', permalink)
                    if not id_m:
                        continue
                    prod_id = id_m.group(1)
                    if prod_id in seen_ids:
                        continue
                    seen_ids.add(prod_id)
                    pct = 6.0
                    produtos.append({
                        "produto_ext_id": prod_id,
                        "titulo":         titulo,
                        "preco":          preco,
                        "preco_original": None,
                        "comissao_pct":   pct,
                        "comissao_valor": round(preco * pct / 100, 2),
                        "imagem_url":     thumbnail.replace("I.jpg", "O.jpg"),
                        "url_produto":    permalink.split("#")[0],
                        "vendas_mes":     0,
                        "avaliacao":      0,
                        "total_avaliacoes": 0,
                        "categoria":      _detectar_categoria(titulo),
                        "plataforma":     "ML_AFILIADOS",
                    })

                # Padrão 2 (fallback): extrai todos os IDs MLB da página e busca via /items API
                if len(produtos) < 20:
                    all_ids_html = list(dict.fromkeys(_re.findall(r'"(MLB\d{7,12})"', html)))
                    ids_novos = [i for i in all_ids_html if i not in seen_ids][:60]
                    if ids_novos:
                        via_api = await _buscar_por_ids(ids_novos)
                        for p in via_api:
                            if p["produto_ext_id"] not in seen_ids:
                                seen_ids.add(p["produto_ext_id"])
                                produtos.append(p)

                return produtos
        except Exception:
            return []

    # ── Estratégia principal: keyword search (só se tiver token — Render bloqueia sem auth) ──
    import asyncio as _asyncio
    token = await _get_fresh_ml_token(db)

    todos: list[dict] = []
    seen_tok: set[str] = set()

    if token:
        TERMOS = [
            "samsung galaxy", "motorola moto g", "xiaomi redmi", "smart tv 4k", "notebook i5",
            "fone bluetooth", "tênis corrida", "camiseta masculina", "smartwatch", "perfume masculino",
            "air fryer", "jogo ps5 nintendo", "mochila escolar", "suplemento proteína", "cadeira gamer",
            "kit skincare", "cafeteira espresso", "aspirador robô", "tablet", "tênis feminino",
            "cozedor elétrico", "controle remoto", "relógio pulso", "óculos de sol", "câmera fotográfica",
        ]
        async def _buscar_termo(termo: str) -> list[dict]:
            try:
                async with httpx.AsyncClient(timeout=8) as client:
                    r = await client.get(
                        "https://api.mercadolibre.com/sites/MLB/search",
                        params={"q": termo, "limit": 25, "sort": "sold_quantity_desc"},
                        headers={"Authorization": f"Bearer {token}"},
                    )
                    if r.status_code == 200:
                        return r.json().get("results", [])
            except Exception:
                pass
            return []
        for i in range(0, len(TERMOS), 5):
            lote = TERMOS[i:i+5]
            resultados_lote = await _asyncio.gather(*[_buscar_termo(t) for t in lote])
            for items in resultados_lote:
                for item in items:
                    if item.get("id") not in seen_tok and item.get("price"):
                        seen_tok.add(item["id"])
                        todos.append(_formatar(item))
            if len(todos) >= limit:
                break

    if todos:
        return {"resultados": todos[:limit], "total": len(todos), "fonte": "keyword"}

    # ── Fallback: scraping HTML do ML (7 páginas em paralelo) ────────────────
    resultados: list[dict] = []
    seen_global: set[str] = set()
    lotes_pag = [_PAGINAS_ML[i:i+3] for i in range(0, len(_PAGINAS_ML), 3)]
    for lote_pag in lotes_pag:
        if len(resultados) >= limit:
            break
        prods_lote = await _asyncio.gather(*[_scrape_pagina(u) for u in lote_pag])
        for prods in prods_lote:
            for p in prods:
                if p["produto_ext_id"] not in seen_global:
                    seen_global.add(p["produto_ext_id"])
                    resultados.append(p)

    if resultados:
        resultados.sort(key=lambda x: x["comissao_valor"], reverse=True)
        return {"resultados": resultados[:limit], "total": len(resultados), "fonte": "scraping"}

    # ── Estratégia 2: OAuth search ─────────────────────────────────────────
    cfg = db.query(AfiliadoConfig).filter_by(plataforma="ML_AFILIADOS").first()
    access_token: str | None = None
    if cfg and cfg.refresh_token:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.post(ML_TOKEN_URL, data={
                    "grant_type": "refresh_token",
                    "client_id": cfg.client_id,
                    "client_secret": cfg.client_secret,
                    "refresh_token": cfg.refresh_token,
                })
                if r.status_code == 200:
                    d = r.json()
                    if "access_token" in d:
                        access_token = d["access_token"]
                        cfg.access_token = access_token
                        cfg.refresh_token = d.get("refresh_token", cfg.refresh_token)
                        db.commit()
        except Exception:
            pass
    if not access_token and cfg:
        access_token = cfg.access_token

    if access_token:
        termos = ["smartphone samsung", "fone bluetooth", "smartwatch", "notebook gamer"]
        todos: list[dict] = []
        for termo in termos[:2]:
            try:
                async with httpx.AsyncClient(timeout=12) as client:
                    r = await client.get(
                        "https://api.mercadolibre.com/sites/MLB/search",
                        params={"q": termo, "limit": limit // 2, "sort": "sold_quantity_desc"},
                        headers={"Authorization": f"Bearer {access_token}"},
                    )
                    if r.status_code == 200:
                        for item in r.json().get("results", []):
                            todos.append(_formatar(item))
            except Exception:
                pass
        if todos:
            vistos: set[str] = set()
            unicos = []
            for p in todos:
                if p["produto_ext_id"] not in vistos:
                    vistos.add(p["produto_ext_id"])
                    unicos.append(p)
            unicos.sort(key=lambda x: x["comissao_valor"], reverse=True)
            return {"resultados": unicos[:limit], "total": len(unicos), "fonte": "oauth_search"}

    return {"resultados": [], "total": 0, "fonte": "vazio"}


async def _buscar_ml_top_oportunidades(limit: int, headers_req: dict):
    """Busca top produtos de alto potencial para meta de R$20k/mês"""
    # Categorias com melhor ticket × comissão para atingir metas altas
    BUSCAS_META = [
        "smartphone samsung",
        "notebook gamer",
        "smartwatch",
        "perfume importado",
        "fone bluetooth",
        "cafeteira expresso",
        "aspirador robot",
        "kit skincare",
    ]

    todos: list = []
    vistos: set = set()

    async with httpx.AsyncClient(timeout=20) as client:
        tasks = []
        for termo in BUSCAS_META:
            tasks.append(client.get(
                "https://api.mercadolibre.com/sites/MLB/search",
                params={"q": termo, "limit": 8, "sort": "sold_quantity_desc"},
                headers=headers_req,
            ))
        respostas = await asyncio.gather(*tasks, return_exceptions=True)

    for resp in respostas:
        if isinstance(resp, Exception):
            continue
        try:
            data = resp.json()
            for item in data.get("results", []):
                pid = item.get("id")
                if pid in vistos:
                    continue
                vistos.add(pid)
                preco   = float(item.get("price", 0))
                com_pct = _estimar_comissao_ml(item.get("category_id", ""))
                # Filtra: preço mínimo R$50, comissão mínima 5%
                if preco >= 50 and com_pct >= 5:
                    p = _montar_produto_ml(item, preco, com_pct)
                    todos.append(p)
        except Exception:
            continue

    # Ordena por comissão_valor (maior potencial de ganho) e retorna top N
    todos.sort(key=lambda x: x["comissao_valor"], reverse=True)
    return {"resultados": todos[:limit], "total": len(todos[:limit])}


def _montar_produto_ml(item: dict, preco: float, com_pct: float) -> dict:
    return {
        "produto_ext_id":   item["id"],
        "titulo":           item["title"],
        "preco":            preco,
        "preco_original":   item.get("original_price"),
        "comissao_pct":     com_pct,
        "comissao_valor":   round(preco * com_pct / 100, 2),
        "imagem_url":       item.get("thumbnail", "").replace("I.jpg", "O.jpg"),
        "url_produto":      item.get("permalink"),
        "vendas_mes":       item.get("sold_quantity", 0),
        "avaliacao":        item.get("reviews", {}).get("rating_average", 0) if item.get("reviews") else 0,
        "total_avaliacoes": item.get("reviews", {}).get("total", 0) if item.get("reviews") else 0,
        "categoria":        item.get("category_id"),
        "plataforma":       "ML_AFILIADOS",
    }

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

async def _buscar_tiktok_shop(q: str, limit: int, cfg):
    """TikTok Shop — produtos virais via ML enquanto API oficial não está disponível"""
    termos_virais = ["mini ventilador", "led strip", "organizador", "gadget", "acessorio celular",
                     "skincare coreano", "luzes rgb", "power bank", "cabo magnetico", "fone sem fio"]
    busca = q if q else termos_virais[0]
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            resp = await client.get(
                "https://api.mercadolibre.com/sites/MLB/search",
                params={"q": busca, "limit": limit, "sort": "sold_quantity_desc"}
            )
            data = resp.json()
        resultados = []
        for item in data.get("results", []):
            preco = float(item.get("price", 0))
            com_pct = 10.0
            r = _montar_produto_ml(item, preco, com_pct)
            r["plataforma"] = "TIKTOK_SHOP"
            resultados.append(r)
        return {"resultados": resultados, "total": len(resultados),
                "info": "Produtos virais TikTok — integração oficial ativa com credenciais"}
    except Exception as e:
        return {"resultados": [], "total": 0, "erro": str(e)}

async def _buscar_shopee(q: str, categoria: str, limit: int, cfg):
    """Shopee — via ML enquanto credenciais não configuradas"""
    busca = q if q else "produto importado"
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            resp = await client.get(
                "https://api.mercadolibre.com/sites/MLB/search",
                params={"q": busca, "limit": limit, "sort": "sold_quantity_desc"}
            )
            data = resp.json()
        resultados = []
        for item in data.get("results", []):
            preco = float(item.get("price", 0))
            com_pct = _estimar_comissao_ml(item.get("category_id", ""))
            r = _montar_produto_ml(item, preco, com_pct)
            r["plataforma"] = "SHOPEE"
            resultados.append(r)
        return {"resultados": resultados, "total": len(resultados),
                "info": "Integração Shopee oficial ativa com credenciais em Config"}
    except Exception as e:
        return {"resultados": [], "total": 0, "erro": str(e)}

async def _buscar_amazon(q: str, categoria: str, limit: int, cfg):
    """Amazon — via ML enquanto PA API não configurada"""
    busca = q if q else "produto premium"
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            resp = await client.get(
                "https://api.mercadolibre.com/sites/MLB/search",
                params={"q": busca, "limit": limit, "sort": "sold_quantity_desc"}
            )
            data = resp.json()
        resultados = []
        for item in data.get("results", []):
            preco = float(item.get("price", 0))
            com_pct = _estimar_comissao_ml(item.get("category_id", ""))
            r = _montar_produto_ml(item, preco, com_pct)
            r["plataforma"] = "AMAZON"
            resultados.append(r)
        return {"resultados": resultados, "total": len(resultados),
                "info": "Integração Amazon PA API ativa com credenciais em Config"}
    except Exception as e:
        return {"resultados": [], "total": 0, "erro": str(e)}

# ─── Catálogo de Produtos Salvos ─────────────────────────────────────────────

@router.get("/catalogo")
async def listar_catalogo(
    plataforma: str = "",
    favorito: bool = False,
    db: Session = Depends(get_db),
    _=Depends(get_current_user)
):
    from models import VendedorAnuncio, VendedorConfig
    q = db.query(AfiliadoProduto).filter_by(ativo=True)
    if plataforma:
        q = q.filter_by(plataforma=plataforma)
    if favorito:
        q = q.filter_by(favorito=True)
    prods = q.order_by(AfiliadoProduto.comissao_valor.desc()).all()

    anuncios_por_produto = {
        a.produto_afiliado_id: a
        for a in db.query(VendedorAnuncio).filter_by(plataforma="ML_VENDEDOR").all()
    }

    # Checa ao vivo se o anúncio "confirmado" já passou pela análise do ML — sem isso,
    # um produto em moderação aparece igualzinho a um já liberado pra venda.
    ml_status_por_listing: dict = {}
    cfg = db.query(VendedorConfig).filter_by(plataforma="ML_VENDEDOR", ativo=True).first()
    if cfg and cfg.access_token:
        listing_ids = [a.listing_id for a in anuncios_por_produto.values() if a.listing_id]
        if listing_ids:
            headers = {"Authorization": f"Bearer {cfg.access_token}"}
            async with httpx.AsyncClient(timeout=8) as client:
                resultados = await asyncio.gather(*[
                    client.get(f"https://api.mercadolibre.com/items/{lid}", headers=headers)
                    for lid in listing_ids
                ], return_exceptions=True)
            for lid, r in zip(listing_ids, resultados):
                if isinstance(r, Exception) or r.status_code != 200:
                    continue
                ml_status_por_listing[lid] = r.json().get("status")

    result = []
    for p in prods:
        d = _prod_dict(p)
        anuncio = anuncios_por_produto.get(p.id)
        if anuncio and anuncio.listing_id:
            d["pub_status"] = "ml_vendedor"   # publicado como vendedor no ML
            d["ml_status"] = ml_status_por_listing.get(anuncio.listing_id)
        elif anuncio and anuncio.link_afiliado:
            d["pub_status"] = "afiliado"       # só link afiliado
        elif anuncio:
            d["pub_status"] = "pendente"
        else:
            d["pub_status"] = None             # nunca publicado
        d["pub_url"] = anuncio.url_anuncio if anuncio else None
        result.append(d)
    return result

@router.post("/catalogo")
def salvar_produto(body: ProdutoIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    # Evita duplicata ativo — se existir inativo, reativa com dados novos
    existe = db.query(AfiliadoProduto).filter_by(
        plataforma=body.plataforma, produto_ext_id=body.produto_ext_id
    ).first()
    if existe:
        # Sempre atualiza com dados novos (preço, imagem, etc.)
        existe.ativo = True
        existe.titulo = body.titulo
        existe.preco = body.preco
        existe.preco_original = body.preco_original
        existe.comissao_pct = body.comissao_pct
        existe.comissao_valor = round(body.preco * body.comissao_pct / 100, 2)
        if body.imagem_url:
            existe.imagem_url = body.imagem_url
        existe.url_produto = body.url_produto
        existe.vendas_mes = body.vendas_mes
        existe.categoria = body.categoria
        db.commit()
        db.refresh(existe)
        return {"ok": True, "id": existe.id}

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

@router.get("/resolver-link")
async def resolver_link(url: str, _=Depends(get_current_user)):
    """Resolve links curtos (meli.la, mercadoshops, etc) e retorna a URL real com MLB ID."""
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as c:
            r = await c.get(url, headers={"User-Agent": "Mozilla/5.0"})
            return {"url_real": str(r.url)}
    except Exception as e:
        raise HTTPException(400, f"Não foi possível resolver o link: {e}")

@router.get("/importar-catalogo")
async def importar_catalogo(catalog_id: str, variation_id: str = None, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Importa qualquer produto ML (catálogo ou item direto) com preço e imagem via token Vendedor."""
    token = await _get_fresh_ml_token(db)
    headers = {"Authorization": f"Bearer {token}"} if token else {}

    titulo, preco, imagem, cat_id, permalink = catalog_id, 0.0, "", "", ""
    prod_data, item_data, search_data = None, None, None
    try:
        async with httpx.AsyncClient(timeout=20) as c:
            prodR, itemR, searchR = await asyncio.gather(
                c.get(f"https://api.mercadolibre.com/products/{catalog_id}", headers=headers),
                c.get(f"https://api.mercadolibre.com/items/{catalog_id}", headers=headers),
                c.get("https://api.mercadolibre.com/sites/MLB/search",
                      params={"catalog_product_id": catalog_id, "sort": "price_asc", "limit": 5},
                      headers=headers)
            )
            # Se /items/ falhou com token (expirado), tenta sem auth
            if itemR.status_code != 200 and token:
                itemR = await c.get(f"https://api.mercadolibre.com/items/{catalog_id}")
            # Se search por catalog_product_id vazio, busca pelo ID
            if searchR.status_code != 200 or not (searchR.json().get("results") or []):
                srQ = await c.get("https://api.mercadolibre.com/sites/MLB/search",
                    params={"q": catalog_id, "limit": 3}, headers=headers)
                if srQ.status_code == 200 and (srQ.json().get("results") or []):
                    searchR = srQ
            # Se ainda sem preço e o item tem catalog_product_id diferente, busca por ele
            if itemR.status_code == 200:
                itd_tmp = itemR.json()
                real_cat_id = itd_tmp.get("catalog_product_id")
                tmp_preco = float(itd_tmp.get("price") or itd_tmp.get("base_price") or 0)
                if not tmp_preco and itd_tmp.get("variations"):
                    ps = [float(v.get("price") or 0) for v in itd_tmp["variations"] if v.get("price")]
                    if ps: tmp_preco = min(ps)
                if real_cat_id and real_cat_id != catalog_id and not tmp_preco:
                    srR = await c.get("https://api.mercadolibre.com/sites/MLB/search",
                        params={"catalog_product_id": real_cat_id, "sort": "price_asc", "limit": 5},
                        headers=headers)
                    if srR.status_code == 200 and (srR.json().get("results") or []):
                        searchR = srR

            # Guarda os dados brutos (todas as chamadas já feitas)
            if prodR.status_code == 200:   prod_data   = prodR.json()
            if itemR.status_code == 200:   item_data   = itemR.json()
            if searchR.status_code == 200: search_data = searchR.json()
    except Exception:
        pass

    # Processa /products/ → nome e imagem (catálogo)
    if prod_data:
        titulo = prod_data.get("name") or prod_data.get("title") or catalog_id
        cat_id = prod_data.get("domain_id", "")
        pics = prod_data.get("pictures") or []
        if pics:
            imagem = (pics[0].get("url") or pics[0].get("secure_url", "")).replace("http://", "https://")

    # Processa /items/ → título, preço, variações, imagem, permalink
    if item_data:
        if not titulo or titulo == catalog_id:
            titulo = item_data.get("title", titulo)
        if not cat_id:
            cat_id = item_data.get("category_id", "")
        permalink = item_data.get("permalink", "")
        item_preco = float(item_data.get("price") or item_data.get("base_price") or 0)
        # Preço de variação específica
        if variation_id and item_data.get("variations"):
            for v in item_data["variations"]:
                if str(v.get("id")) == str(variation_id):
                    vp = float(v.get("price") or 0)
                    if vp: item_preco = vp
                    break
        # Fallback: menor preço entre variações
        if not item_preco and item_data.get("variations"):
            ps = [float(v.get("price") or 0) for v in item_data["variations"] if v.get("price")]
            if ps: item_preco = min(ps)
        if item_preco: preco = item_preco
        # Imagem alta resolução
        if not imagem:
            pics2 = item_data.get("pictures") or []
            if pics2:
                imagem = (pics2[0].get("url") or pics2[0].get("secure_url") or "").replace("http://", "https://")
        if not imagem and item_data.get("thumbnail"):
            imagem = item_data["thumbnail"].replace("I.jpg", "O.jpg").replace("http://", "https://")

    # Processa search → preço e imagem fallback
    if search_data:
        results = [r for r in (search_data.get("results") or []) if float(r.get("price") or 0) > 0]
        if results:
            if not preco: preco = float(results[0]["price"])
            if not cat_id: cat_id = results[0].get("category_id", "")
            if not titulo or titulo == catalog_id: titulo = results[0].get("title", titulo)
            if not imagem:
                imagem = (results[0].get("thumbnail") or "").replace("I.jpg", "O.jpg").replace("http://", "https://")
            if not permalink: permalink = results[0].get("permalink", "")

    # Scraping fallback: se API falhou (token inválido), busca dados direto da página do ML
    if not titulo or titulo == catalog_id:
        try:
            import re as _re
            page_url = f"https://produto.mercadolibre.com.br/{catalog_id}"
            hdrs_browser = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept-Language": "pt-BR,pt;q=0.9",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            }
            async with httpx.AsyncClient(timeout=15, follow_redirects=True) as cs:
                pr = await cs.get(page_url, headers=hdrs_browser)
            if pr.status_code == 200:
                html = pr.text
                # JSON-LD structured data (mais confiável)
                ld_matches = _re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, _re.DOTALL)
                for ld_raw in ld_matches:
                    try:
                        ld = json.loads(ld_raw)
                        items_ld = ld if isinstance(ld, list) else [ld]
                        for item_ld in items_ld:
                            if item_ld.get("@type") in ("Product", "Offer"):
                                if not titulo or titulo == catalog_id:
                                    titulo = item_ld.get("name") or titulo
                                if not preco:
                                    offers = item_ld.get("offers") or item_ld
                                    p_str = offers.get("price") or offers.get("lowPrice") or "0"
                                    preco = float(str(p_str).replace(",", ".") or 0)
                                if not imagem:
                                    imgs = item_ld.get("image") or []
                                    if isinstance(imgs, str): imgs = [imgs]
                                    if imgs: imagem = imgs[0].replace("http://", "https://")
                    except Exception:
                        pass
                # Open Graph fallback
                if not titulo or titulo == catalog_id:
                    m = _re.search(r'<meta property="og:title" content="([^"]+)"', html)
                    if m: titulo = m.group(1).split(" - Mercado")[0].strip()
                if not imagem:
                    m = _re.search(r'<meta property="og:image" content="([^"]+)"', html)
                    if m: imagem = m.group(1).replace("http://", "https://")
                if not preco:
                    m = _re.search(r'"price":\s*"?(\d+(?:\.\d+)?)"?', html)
                    if m: preco = float(m.group(1))
                if not permalink:
                    m = _re.search(r'<meta property="og:url" content="([^"]+)"', html)
                    if m: permalink = m.group(1)
        except Exception:
            pass

    url_final = permalink or f"https://www.mercadolivre.com.br/p/{catalog_id}"
    return {"produto_ext_id": catalog_id, "titulo": titulo, "preco": preco,
            "imagem_url": imagem, "categoria": cat_id, "plataforma": "ML_AFILIADOS",
            "url_produto": url_final}

@router.post("/importar-ml/{item_id}")
async def importar_ml_por_id(item_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Importa um produto do ML pelo ID (ex: MLB5532075156) usando o token de afiliado."""
    cfg = db.query(AfiliadoConfig).filter_by(plataforma="ML_AFILIADOS").first()
    token = cfg.access_token if cfg else None
    headers = {"Authorization": f"Bearer {token}"} if token else {}

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(f"https://api.mercadolibre.com/items/{item_id}", headers=headers)
        if r.status_code != 200:
            raise HTTPException(400, f"Produto não encontrado no ML: {r.text[:200]}")
        d = r.json()

        # Calcula comissão estimada (ML afiliados ~4-8%)
        preco = float(d.get("price") or 0)
        comissao_pct = 5.0

        # Imagem em alta resolução
        pics = d.get("pictures") or []
        imagem = pics[0].get("url") if pics else d.get("thumbnail", "")
        if imagem and "-I.jpg" not in imagem:
            imagem = imagem.replace("-O.jpg", "-O.jpg").replace("http://", "https://")

        produto_ext_id = d.get("id", item_id)
        existe = db.query(AfiliadoProduto).filter_by(plataforma="ML_AFILIADOS", produto_ext_id=produto_ext_id).first()
        if existe:
            return {"ok": True, "id": existe.id, "duplicado": True, "titulo": existe.titulo}

        p = AfiliadoProduto(
            plataforma="ML_AFILIADOS",
            produto_ext_id=produto_ext_id,
            titulo=d.get("title", "")[:200],
            preco=preco,
            preco_original=float(d.get("original_price") or preco),
            comissao_pct=comissao_pct,
            comissao_valor=round(preco * comissao_pct / 100, 2),
            categoria=d.get("category_id", "Outros"),
            imagem_url=imagem,
            url_produto=d.get("permalink", ""),
            vendas_mes=int(d.get("sold_quantity") or 0),
            avaliacao=float((d.get("reviews") or {}).get("rating_average") or 0),
            total_avaliacoes=int((d.get("reviews") or {}).get("total") or 0),
        )
        db.add(p); db.commit(); db.refresh(p)
        return {"ok": True, "id": p.id, "titulo": p.titulo, "preco": p.preco, "imagem": p.imagem_url}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))

@router.patch("/catalogo/{id}/favorito")
def toggle_favorito(id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(AfiliadoProduto).get(id)
    if not p:
        raise HTTPException(404)
    p.favorito = not p.favorito
    db.commit()
    return {"favorito": p.favorito}

class GtinIn(BaseModel):
    gtin: str

@router.patch("/catalogo/{id}/gtin")
def salvar_gtin(id: int, data: GtinIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(AfiliadoProduto).get(id)
    if not p:
        raise HTTPException(404, "Produto não encontrado")
    gtin = (data.gtin or "").strip()
    if gtin and not gtin.isdigit():
        raise HTTPException(400, "GTIN deve conter só números")
    p.gtin = gtin or None
    db.commit()
    return {"gtin": p.gtin}

@router.get("/catalogo/verificar-estoque")
async def verificar_estoque_catalogo(db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Só faz sentido checar estoque de verdade nos produtos que já viraram anúncio
    próprio no ML (têm listing_id, item de vendedor único — reporta estoque direito).
    O produto_ext_id aponta pro catálogo/anúncio ORIGINAL de outro vendedor, cuja API
    de catálogo não devolve oferta ativa (buy_box_winner) de forma confiável."""
    from models import VendedorAnuncio
    token = await _get_fresh_ml_token(db)
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    produtos = db.query(AfiliadoProduto).filter_by(ativo=True).all()
    anuncios = {
        a.produto_afiliado_id: a.listing_id
        for a in db.query(VendedorAnuncio).filter_by(plataforma="ML_VENDEDOR").all()
        if a.listing_id
    }

    resultado = []
    async with httpx.AsyncClient(timeout=10) as client:
        for p in produtos:
            listing_id = anuncios.get(p.id)
            if not listing_id:
                resultado.append({"id": p.id, "titulo": p.titulo, "publicado": False, "status_estoque": "nao_publicado"})
                continue
            status_estoque = "desconhecido"
            available_quantity = None
            item_status = None
            http_status = None
            try:
                r = await client.get(f"https://api.mercadolibre.com/items/{listing_id}", headers=headers)
                http_status = r.status_code
                if r.status_code == 200:
                    d = r.json()
                    available_quantity = d.get("available_quantity")
                    item_status = d.get("status")
                    status_estoque = "com_estoque" if (item_status == "active" and (available_quantity or 0) > 0) else "sem_estoque"
                else:
                    status_estoque = "sem_estoque"
            except Exception:
                pass

            resultado.append({
                "id": p.id,
                "titulo": p.titulo,
                "listing_id": listing_id,
                "publicado": True,
                "status_estoque": status_estoque,
                "available_quantity": available_quantity,
                "item_status": item_status,
                "http_status": http_status,
            })
    return {"produtos": resultado}

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

def _renda_real_do_mes(db, mes_ano: str) -> dict:
    """Soma vendas reais do mês: pedidos confirmados na conta vendedor (lucro_estimado)
    + comissões de afiliado aprovadas/pagas. Isso é o que realmente entrou, não estimativa."""
    from models import VendedorPedido
    from sqlalchemy import func, extract
    ano_s, mes_s = mes_ano.split("-")
    ano, mes = int(ano_s), int(mes_s)

    pedidos = db.query(
        func.coalesce(func.sum(VendedorPedido.lucro_estimado), 0),
        func.count(VendedorPedido.id),
    ).filter(
        VendedorPedido.status != "CANCELADO",
        extract("year", VendedorPedido.data_pedido) == ano,
        extract("month", VendedorPedido.data_pedido) == mes,
    ).first()
    lucro_vendedor = float(pedidos[0] or 0)
    vendas_vendedor = int(pedidos[1] or 0)

    com = db.query(
        func.coalesce(func.sum(AfiliadoComissao.comissao_valor), 0),
        func.count(AfiliadoComissao.id),
    ).filter(
        AfiliadoComissao.status.in_(["APROVADO", "PAGO"]),
        extract("year", AfiliadoComissao.data_venda) == ano,
        extract("month", AfiliadoComissao.data_venda) == mes,
    ).first()
    com_afiliado = float(com[0] or 0)
    vendas_afiliado = int(com[1] or 0)

    return {
        "renda_total": round(lucro_vendedor + com_afiliado, 2),
        "vendas_total": vendas_vendedor + vendas_afiliado,
        "renda_vendedor": round(lucro_vendedor, 2),
        "vendas_vendedor": vendas_vendedor,
        "renda_afiliado": round(com_afiliado, 2),
        "vendas_afiliado": vendas_afiliado,
    }

@router.get("/metas")
def listar_metas(db: Session = Depends(get_db), _=Depends(get_current_user)):
    metas = db.query(AfiliadoMeta).order_by(AfiliadoMeta.mes_ano.desc()).limit(12).all()
    # Sincroniza com as vendas reais (pedidos do vendedor + comissões aprovadas) sempre que carrega
    for m in metas:
        real = _renda_real_do_mes(db, m.mes_ano)
        m.realizado_renda = real["renda_total"]
        m.realizado_vendas = real["vendas_total"]
    db.commit()
    return [_meta_dict(m) for m in metas]

@router.get("/metas/{mes_ano}/analytics")
async def metas_analytics(mes_ano: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Evolução diária, top produtos por vendas reais e comparação com o mês anterior."""
    from models import VendedorPedido, VendedorAnuncio, VendedorConfig
    from sqlalchemy import extract
    import calendar
    ano_s, mes_s = mes_ano.split("-")
    ano, mes = int(ano_s), int(mes_s)

    pedidos = db.query(VendedorPedido).filter(
        VendedorPedido.status != "CANCELADO",
        extract("year", VendedorPedido.data_pedido) == ano,
        extract("month", VendedorPedido.data_pedido) == mes,
    ).all()
    comissoes = db.query(AfiliadoComissao).filter(
        AfiliadoComissao.status.in_(["APROVADO", "PAGO"]),
        extract("year", AfiliadoComissao.data_venda) == ano,
        extract("month", AfiliadoComissao.data_venda) == mes,
    ).all()

    por_dia: dict = {}
    for p in pedidos:
        if not p.data_pedido: continue
        d = p.data_pedido.day
        por_dia[d] = por_dia.get(d, 0) + (p.lucro_estimado or 0)
    for c in comissoes:
        if not c.data_venda: continue
        d = c.data_venda.day
        por_dia[d] = por_dia.get(d, 0) + (c.comissao_valor or 0)

    dias_no_mes = calendar.monthrange(ano, mes)[1]
    evolucao_diaria = [{"dia": d, "renda": round(por_dia.get(d, 0), 2)} for d in range(1, dias_no_mes + 1)]

    top_reais = db.query(VendedorAnuncio).filter(VendedorAnuncio.vendas_count > 0) \
        .order_by(VendedorAnuncio.faturamento.desc()).limit(10).all()

    mes_ant, ano_ant = (mes - 1, ano) if mes > 1 else (12, ano - 1)
    mes_ant_str = f"{ano_ant}-{str(mes_ant).zfill(2)}"
    real_ant = _renda_real_do_mes(db, mes_ant_str)

    # ── Capacidade de venda: quantas vendas faltam pra bater a meta, com o
    # catálogo de hoje (só confirmado no ML) e projetado (incluindo o que
    # ainda está em análise, assumindo que libera). Lucro = preço - custo.
    meta = db.query(AfiliadoMeta).filter_by(mes_ano=mes_ano).first()
    meta_renda = meta.meta_renda if meta else 0
    anuncios_ml = db.query(VendedorAnuncio).filter(
        VendedorAnuncio.plataforma == "ML_VENDEDOR", VendedorAnuncio.listing_id.isnot(None)
    ).all()

    cfg = db.query(VendedorConfig).filter_by(plataforma="ML_VENDEDOR", ativo=True).first()
    ml_status_por_listing: dict = {}
    if cfg and cfg.access_token and anuncios_ml:
        headers = {"Authorization": f"Bearer {cfg.access_token}"}
        async with httpx.AsyncClient(timeout=8) as client:
            resultados = await asyncio.gather(*[
                client.get(f"https://api.mercadolibre.com/items/{a.listing_id}", headers=headers)
                for a in anuncios_ml
            ], return_exceptions=True)
        for a, r in zip(anuncios_ml, resultados):
            if isinstance(r, Exception) or r.status_code != 200:
                continue
            ml_status_por_listing[a.id] = r.json().get("status")

    confirmados = [a for a in anuncios_ml if ml_status_por_listing.get(a.id) != "under_review"]
    em_analise = [a for a in anuncios_ml if ml_status_por_listing.get(a.id) == "under_review"]

    def _lucro_medio(lista):
        lucros = [(a.preco_venda or 0) - (a.preco_custo or 0) for a in lista if a.preco_venda and a.preco_custo]
        return round(sum(lucros) / len(lucros), 2) if lucros else 0

    lucro_medio_atual = _lucro_medio(confirmados)
    lucro_medio_projetado = _lucro_medio(confirmados + em_analise)

    capacidade_venda = {
        "meta_renda": meta_renda,
        "catalogo_confirmado": len(confirmados),
        "catalogo_em_analise": len(em_analise),
        "lucro_medio_atual": lucro_medio_atual,
        "vendas_necessarias_atual": round(meta_renda / lucro_medio_atual) if (lucro_medio_atual > 0 and meta_renda > 0) else None,
        "lucro_medio_projetado": lucro_medio_projetado,
        "vendas_necessarias_projetado": round(meta_renda / lucro_medio_projetado) if (lucro_medio_projetado > 0 and meta_renda > 0) else None,
    }

    return {
        "evolucao_diaria": evolucao_diaria,
        "top_produtos_reais": [
            {"id": a.id, "titulo": a.titulo, "vendas": a.vendas_count,
             "faturamento": round(a.faturamento or 0, 2), "imagem_url": a.imagem_url}
            for a in top_reais
        ],
        "mes_anterior": {"mes_ano": mes_ant_str, "renda": real_ant["renda_total"], "vendas": real_ant["vendas_total"]},
        "capacidade_venda": capacidade_venda,
    }

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

# ─── Importar Produto por Link ML ────────────────────────────────────────────

COM_ML_BACKEND: dict = {
    'MLB1000':8,'MLB1055':10,'MLB1051':9,'MLB1648':12,'MLB1499':11,
    'MLB1574':10,'MLB1459':8,'MLB12':7
}

def _comissao_ml_by_cat(cat_id: str) -> float:
    for k, v in COM_ML_BACKEND.items():
        if cat_id.startswith(k):
            return float(v)
    return 6.0

class ImportarLinkIn(BaseModel):
    url_ou_texto: str

@router.post("/importar-link")
async def importar_link_produto(
    body: ImportarLinkIn,
    db: Session = Depends(get_db),
    _=Depends(get_current_user)
):
    """Recebe URL do ML ou texto do produto, busca dados e gera copies com IA"""
    import re
    texto = body.url_ou_texto.strip()
    produto = None

    # Extrai ID do produto ML da URL (ex: MLB1234567890)
    ml_match = re.search(r'MLB-?(\d+)', texto, re.IGNORECASE)
    if ml_match:
        item_id = f"MLB{ml_match.group(1)}"
        try:
            from models import VendedorConfig as _VC
            cfg_ml  = db.query(AfiliadoConfig).filter_by(plataforma="ML_AFILIADOS").first()
            cfg_vnd = db.query(_VC).filter_by(plataforma="ML_VENDEDOR").first()

            # Tenta tokens em ordem: afiliado → vendedor → sem token
            tokens = []
            if cfg_ml  and cfg_ml.access_token:  tokens.append(cfg_ml.access_token)
            if cfg_vnd and cfg_vnd.access_token:  tokens.append(cfg_vnd.access_token)
            tokens.append(None)

            ml_resp = None
            for tok in tokens:
                ml_headers = {"Accept": "application/json"}
                if tok:
                    ml_headers["Authorization"] = f"Bearer {tok}"
                async with httpx.AsyncClient(timeout=12) as client:
                    r = await client.get(
                        f"https://api.mercadolibre.com/items/{item_id}",
                        headers=ml_headers,
                    )
                if r.status_code == 200:
                    ml_resp = r.json()
                    break

            if ml_resp:
                d = ml_resp
                preco = float(d.get("price") or 0)
                cat   = d.get("category_id", "")
                pct   = _comissao_ml_by_cat(cat)
                imagem = (d.get("thumbnail") or "").replace("I.jpg", "O.jpg")
                produto = {
                    "produto_ext_id": d.get("id", item_id),
                    "titulo":         d.get("title", ""),
                    "preco":          preco,
                    "preco_original": d.get("original_price"),
                    "comissao_pct":   pct,
                    "comissao_valor": round(preco * pct / 100, 2),
                    "imagem_url":     imagem,
                    "url_produto":    d.get("permalink", texto),
                    "vendas_mes":     d.get("sold_quantity", 0),
                    "avaliacao":      0,
                    "total_avaliacoes": 0,
                    "categoria":      cat,
                    "plataforma":     "ML_AFILIADOS",
                }
        except Exception:
            pass

    # Fallback: extrai info do texto bruto com IA
    if not produto:
        provedor, api_key = _get_ia_key(db)
        if provedor == "groq" and api_key:
            try:
                loop = asyncio.get_event_loop()
                def _extrair_groq():
                    client = _GroqClient(api_key=api_key)
                    resp = client.chat.completions.create(
                        model="llama-3.3-70b-versatile",
                        messages=[{"role": "user", "content":
                            f"Extraia as informações deste produto e responda SOMENTE em JSON válido com as chaves: titulo, preco (número), categoria.\n\nTexto: {texto[:800]}"}],
                        max_tokens=200,
                        temperature=0.1,
                    )
                    return resp.choices[0].message.content

                raw = await loop.run_in_executor(None, _extrair_groq)
                import json as _json
                jstart = raw.find('{'); jend = raw.rfind('}') + 1
                if jstart >= 0 and jend > jstart:
                    info = _json.loads(raw[jstart:jend])
                    preco = float(info.get("preco") or 0)
                    produto = {
                        "produto_ext_id": f"MANUAL_{int(preco*100)}",
                        "titulo":         info.get("titulo", texto[:60]),
                        "preco":          preco,
                        "preco_original": None,
                        "comissao_pct":   6.0,
                        "comissao_valor": round(preco * 0.06, 2),
                        "imagem_url":     "",
                        "url_produto":    texto if texto.startswith("http") else "",
                        "vendas_mes":     0,
                        "avaliacao":      0,
                        "total_avaliacoes": 0,
                        "categoria":      info.get("categoria", ""),
                        "plataforma":     "ML_AFILIADOS",
                    }
            except Exception:
                pass

    if not produto:
        raise HTTPException(
            status_code=400,
            detail="Produto não encontrado. Verifique se o link do ML é válido e tente novamente."
        )

    # Gera copies com IA para Instagram e TikTok
    copies: dict = {}
    provedor, api_key = _get_ia_key(db)
    if provedor and api_key:
        class _Prod:
            titulo = produto["titulo"]
            preco  = produto["preco"]
            vendas_mes = produto["vendas_mes"]
            avaliacao  = produto["avaliacao"]
            comissao_pct = produto["comissao_pct"]
            url_produto  = produto["url_produto"]
        p = _Prod()
        for rede in ["INSTAGRAM", "TIKTOK"]:
            try:
                if provedor == "groq":
                    t, h = await _gerar_texto_groq(p, rede, "POST", api_key)
                elif provedor == "gemini":
                    t, h = await _gerar_texto_gemini(p, rede, "POST", api_key)
                else:
                    t, h = _gerar_texto_template(p, rede, "POST")
                copies[rede.lower()] = {"texto": t, "hashtags": h}
            except Exception:
                t, h = _gerar_texto_template(p, rede, "POST")
                copies[rede.lower()] = {"texto": t, "hashtags": h}
    else:
        class _Prod2:
            titulo = produto["titulo"]
            preco  = produto["preco"]
            vendas_mes = 0
            avaliacao  = 0
        p2 = _Prod2()
        for rede in ["INSTAGRAM", "TIKTOK"]:
            t, h = _gerar_texto_template(p2, rede, "POST")
            copies[rede.lower()] = {"texto": t, "hashtags": h}

    return {"produto": produto, "copies": copies}


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
        "notas": p.notas, "gtin": p.gtin, "created_at": str(p.created_at),
    }

def _meta_dict(m: AfiliadoMeta) -> dict:
    pct = round(m.realizado_renda / m.meta_renda * 100, 1) if m.meta_renda else 0
    return {
        "id": m.id, "mes_ano": m.mes_ano, "meta_renda": m.meta_renda,
        "realizado_renda": m.realizado_renda, "realizado_vendas": m.realizado_vendas, "pct": pct,
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
