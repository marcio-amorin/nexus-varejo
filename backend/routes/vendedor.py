from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from database import get_db
from models import VendedorConfig, VendedorAnuncio, VendedorPedido, AfiliadoProduto, AfiliadoConfig, AfiliadoConteudo
from utils.security import get_current_user
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date
import json, httpx, asyncio, re, os, urllib.parse

router = APIRouter(prefix="/vendedor", tags=["vendedor"])

ML_REDIRECT_URI  = os.getenv("ML_REDIRECT_URI", "https://nexus-varejo-backend.onrender.com/afiliados/ml-callback")
ML_AUTH_URL      = "https://auth.mercadolivre.com.br/authorization"
_ML_APP_ID       = os.getenv("ML_CLIENT_ID", "3153350893755305")
_ML_APP_SECRET   = os.getenv("ML_CLIENT_SECRET", "wCq5uo8Ytbu2AXfzd8fRN8Pa5hwgKFyB")

def _get_ml_client_id(db) -> str:
    """Retorna o client_id ML: VendedorConfig → AfiliadoConfig → env var padrão"""
    vcfg = db.query(VendedorConfig).filter_by(plataforma="ML_VENDEDOR").first()
    if vcfg and vcfg.client_id:
        return vcfg.client_id
    acfg = db.query(AfiliadoConfig).filter_by(plataforma="ML_AFILIADOS").first()
    if acfg and acfg.client_id:
        return acfg.client_id
    return _ML_APP_ID

def _get_ml_client_secret(db) -> str:
    vcfg = db.query(VendedorConfig).filter_by(plataforma="ML_VENDEDOR").first()
    if vcfg and vcfg.client_secret:
        return vcfg.client_secret
    acfg = db.query(AfiliadoConfig).filter_by(plataforma="ML_AFILIADOS").first()
    if acfg and acfg.client_secret:
        return acfg.client_secret
    return _ML_APP_SECRET

@router.get("/ml-auth-url")
def vendedor_ml_auth_url(db: Session = Depends(get_db), _=Depends(get_current_user)):
    client_id = _get_ml_client_id(db)
    url = (
        f"{ML_AUTH_URL}?response_type=code"
        f"&client_id={urllib.parse.quote(client_id)}"
        f"&redirect_uri={urllib.parse.quote(ML_REDIRECT_URI)}"
        f"&state=vendedor"
        f"&scope=offline_access"
    )
    return {"url": url}

@router.get("/ml-verificar")
async def vendedor_ml_verificar(db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Verifica se o token ML Vendedor está ativo e retorna dados da conta"""
    vcfg = db.query(VendedorConfig).filter_by(plataforma="ML_VENDEDOR", ativo=True).first()
    if not vcfg or not vcfg.access_token:
        return {"ok": False, "msg": "Conta não conectada"}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                "https://api.mercadolibre.com/users/me",
                headers={"Authorization": f"Bearer {vcfg.access_token}"}
            )
        if r.status_code == 200:
            d = r.json()
            return {
                "ok": True,
                "nickname": d.get("nickname",""),
                "email": d.get("email",""),
                "seller_id": str(d.get("id","")),
                "permalink": d.get("permalink",""),
                "logo": d.get("logo",""),
            }
        elif r.status_code == 401:
            return {"ok": False, "msg": "Token expirado — reconecte o ML"}
        else:
            return {"ok": False, "msg": f"Erro ML {r.status_code}"}
    except Exception as e:
        return {"ok": False, "msg": str(e)}

# ─── Schemas ──────────────────────────────────────────────────────────────────

class VendedorConfigIn(BaseModel):
    plataforma:    str
    ativo:         Optional[bool] = None
    seller_id:     Optional[str] = None
    client_id:     Optional[str] = None
    client_secret: Optional[str] = None
    access_token:  Optional[str] = None
    refresh_token: Optional[str] = None
    extra_json:    Optional[str] = None

class PublicarTudoIn(BaseModel):
    produto_id:    int            # ID do AfiliadoProduto
    preco_venda:   Optional[float] = None   # se None, usa preco_afiliado + 15%
    quantidade:    int = 10
    publicar_redes: bool = True   # também posta nas redes sociais
    modo_afiliado: bool = False   # pula publicação ML Vendedor (só link afiliado)

class AnuncioUpdateIn(BaseModel):
    preco_venda: Optional[float] = None
    status:      Optional[str] = None

# ─── Helpers de categoria e catálogo ML ──────────────────────────────────────

def _extract_catalog_id(url: str) -> str:
    """Extrai catalog_product_id de URLs ML em todos os formatos."""
    if not url: return ""
    # Formato 1: /p/MLB12345 (www.mercadolivre.com.br/p/...)
    m = re.search(r'/p/(MLB\d+)', url)
    if m: return m.group(1)
    # Formato 2: produto.mercadolivre.com.br/MLB-12345-... (catálogo de produto)
    m = re.search(r'produto\.mercadolivre\.com\.br/MLB-(\d+)', url, re.I)
    if m: return f"MLB{m.group(1)}"
    return ""

async def _search_catalog_product(titulo: str, token: str) -> str:
    """Busca catalog_product_id no ML para categorias regulamentadas (Anatel, grade tamanhos)."""
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.get(
                "https://api.mercadolibre.com/products/search",
                params={"site_id": "MLB", "q": titulo[:80], "limit": 5},
                headers={"Authorization": f"Bearer {token}"}
            )
            if r.status_code == 200:
                for item in r.json().get("results", []):
                    pid = item.get("id", "")
                    if pid:
                        return pid
    except Exception:
        pass
    return ""

async def _get_catalog_attrs(catalog_id: str, token: str) -> tuple[str, list]:
    """Busca SIZE_GRID_ID e tamanhos via /products/ e /items/ do ML."""
    size_grid_id = ""
    sizes: list = []
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            for endpoint in [
                f"https://api.mercadolibre.com/products/{catalog_id}",
                f"https://api.mercadolibre.com/items/{catalog_id}",
            ]:
                r = await c.get(endpoint, headers={"Authorization": f"Bearer {token}"})
                if r.status_code != 200:
                    continue
                data = r.json()
                for attr in data.get("attributes", []):
                    if attr.get("id") == "SIZE_GRID_ID":
                        size_grid_id = str(attr.get("value_id") or attr.get("value_name", ""))
                for var in data.get("variations", []):
                    for combo in var.get("attribute_combinations", []):
                        if combo.get("id") in ("SIZE", "SHOE_SIZE", "FOOTWEAR_SIZE"):
                            name = combo.get("value_name", "")
                            if name and name not in sizes:
                                sizes.append(name)
                if size_grid_id or sizes:
                    break
    except Exception:
        pass
    return size_grid_id, sizes[:8]

async def _predict_cat_ml(titulo: str, token: str) -> str:
    """Usa domain_discovery do ML para obter category_id folha correto."""
    try:
        async with httpx.AsyncClient(timeout=8) as c:
            r = await c.get(
                "https://api.mercadolibre.com/sites/MLB/domain_discovery/search",
                params={"q": titulo[:100], "limit": 3},
                headers={"Authorization": f"Bearer {token}"}
            )
            if r.status_code == 200:
                data = r.json()
                if data and isinstance(data, list) and len(data) > 0:
                    return data[0].get("category_id", "")
    except Exception:
        pass
    return ""

# Fallback com categorias folha conhecidas
_CAT_ML: dict = {
    "Celulares":       "MLB1055",   # Celulares e Smartphones
    "TV & Vídeo":      "MLB432",    # Televisores
    "Informática":     "MLB1648",   # Computação
    "Games":           "MLB1144",   # Video Games
    "Eletrodomésticos":"MLB1574",   # Eletrodomésticos
    "Áudio":           "MLB109285", # Fones de Ouvido e Headphones
    "Calçados":        "MLB108562", # Tênis
    "Roupas":          "MLB1248",   # Camisetas e Polos
    "Smartwatches":    "MLB7195",   # Smartwatches
    "Beleza":          "MLB1246",   # Beleza e Cuidado Pessoal
    "Acessórios":      "MLB1430",   # Moda
    "Esporte":         "MLB1276",   # Esportes e Fitness
    "Foto & Vídeo":    "MLB1010",   # Câmeras e Acessórios
    "Outros":          "MLB1459",   # Eletrônicos
}

def _extrair_brand_model(titulo: str):
    """Extrai BRAND e MODEL do título para atributos obrigatórios do ML."""
    words = titulo.split()
    # Tenta achar código de modelo (ex: D981, MTO30, MLB123, K500)
    model_pat = re.compile(r'\b([A-Z]{1,5}\d{2,}[-_]?\w*|\d{3,}[A-Z]{1,5})\b')
    model_m = model_pat.search(titulo)
    model = model_m.group(1) if model_m else (words[1][:20] if len(words) > 1 else titulo[:20])
    # Marca: primeira palavra que parece nome próprio (não é artigo/preposição)
    stopwords = {'com','sem','fio','para','de','do','da','e','em','o','a','os','as','por'}
    brand = next((w for w in words if w.lower() not in stopwords and len(w) > 2), 'Outro')
    return brand[:60], model[:60]

def _extrair_memoria(titulo: str) -> tuple[str, str]:
    """Extrai RAM e armazenamento interno do título (ex: '128gb, 8gb ram' → '8 GB', '128 GB')."""
    t = titulo.lower()
    vals = re.findall(r'(\d+)\s*gb', t)
    ram_match = re.search(r'(\d+)\s*gb\s*(?:de\s*)?ram', t) or re.search(r'ram\s*[:\-]?\s*(\d+)\s*gb', t)
    ram = f"{ram_match.group(1)} GB" if ram_match else ""
    if not ram and len(vals) >= 2:
        nums = [int(v) for v in vals]
        ram = f"{min(nums)} GB"
    storage = f"{max(int(v) for v in vals)} GB" if vals else ""
    return ram, storage

def _detectar_cor(titulo: str) -> str:
    t = titulo.lower()
    for k, v in [
        ('preto','Preto'),('black','Preto'),('branco','Branco'),('white','Branco'),
        ('azul','Azul'),('blue','Azul'),('vermelho','Vermelho'),('red','Vermelho'),
        ('verde','Verde'),('green','Verde'),('roxo','Roxo'),('purple','Roxo'),
        ('cinza','Cinza'),('gray','Cinza'),('grey','Cinza'),('rosa','Rosa'),('pink','Rosa'),
        ('dourado','Dourado'),('gold','Dourado'),('prata','Prata'),('silver','Prata'),
        ('titanium','Titânio'),('titanio','Titânio'),('titanê','Titânio'),
        ('laranja','Laranja'),('orange','Laranja'),('amarelo','Amarelo'),('yellow','Amarelo'),
    ]:
        if k in t: return v
    return 'Preto'

def _detectar_cat(titulo: str) -> str:
    t = titulo.lower()
    if re.search(r'samsung|motorola|iphone|xiaomi|smartphone|celular|moto g|galaxy|redmi', t): return 'Celulares'
    if re.search(r'smart tv|televisão|\btv\b|qled|oled|4k|android tv|roku', t): return 'TV & Vídeo'
    if re.search(r'notebook|laptop|computador|monitor|\btablet\b|ipad|impressora', t): return 'Informática'
    if re.search(r'playstation|xbox|nintendo|ps5|ps4|switch|joystick|gamer|gift card', t): return 'Games'
    if re.search(r'air fryer|fritadeira|geladeira|máquina de lavar|fogão|micro-ondas|liquidificador|aspirador', t): return 'Eletrodomésticos'
    if re.search(r'fone|headphone|earphone|caixa de som|speaker|soundbar', t): return 'Áudio'
    if re.search(r'tênis|sapato|bota|sandália|chinelo|sapatênis', t): return 'Calçados'
    if re.search(r'camiseta|camisa|blusa|vestido|calça|jaqueta|moletom|shorts|saia|legging', t): return 'Roupas'
    if re.search(r'smartwatch|watch|relógio', t): return 'Smartwatches'
    if re.search(r'perfume|desodorante|shampoo|condicionador|hidratante|creme|maquiagem|skincare', t): return 'Beleza'
    if re.search(r'bolsa|mochila|carteira|colar|brinco|anel|óculos|cinto', t): return 'Acessórios'
    if re.search(r'bicicleta|esteira|haltere|kettlebell|yoga|fitness|musculação', t): return 'Esporte'
    if re.search(r'câmera|camera|drone|gopro|ring light|tripé', t): return 'Foto & Vídeo'
    return 'Outros'

# ─── Config Vendedor ──────────────────────────────────────────────────────────

@router.get("/config")
def get_config(db: Session = Depends(get_db), _=Depends(get_current_user)):
    configs = db.query(VendedorConfig).all()
    result = {}
    for c in configs:
        result[c.plataforma] = {
            "plataforma": c.plataforma,
            "ativo": c.ativo,
            "seller_id": c.seller_id,
            "client_id": c.client_id[:6] + "..." if c.client_id and len(c.client_id) > 6 else c.client_id,
            "tem_token": bool(c.access_token),
            "updated_at": c.updated_at.isoformat() if c.updated_at else None,
        }
    # garante as 3 plataformas
    for p in ["ML_VENDEDOR", "SHOPEE_VENDEDOR", "TIKTOK_VENDEDOR"]:
        if p not in result:
            result[p] = {"plataforma": p, "ativo": False, "seller_id": None, "client_id": None, "tem_token": False}
    return result

@router.post("/config")
def salvar_config(data: VendedorConfigIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    cfg = db.query(VendedorConfig).filter_by(plataforma=data.plataforma).first()
    if not cfg:
        cfg = VendedorConfig(plataforma=data.plataforma)
        db.add(cfg)
    if data.ativo is not None: cfg.ativo = data.ativo
    if data.seller_id:         cfg.seller_id = data.seller_id
    if data.client_id:         cfg.client_id = data.client_id
    if data.client_secret:     cfg.client_secret = data.client_secret
    if data.access_token:      cfg.access_token = data.access_token
    if data.refresh_token:     cfg.refresh_token = data.refresh_token
    if data.extra_json:        cfg.extra_json = data.extra_json
    db.commit()
    return {"ok": True, "plataforma": data.plataforma}

# ─── Publicar Tudo (ação principal) ──────────────────────────────────────────

@router.post("/publicar-tudo")
async def publicar_tudo(data: PublicarTudoIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """
    Recebe um produto do catálogo afiliado e:
    1. Publica na conta ML Vendedor
    2. Gera link de afiliado
    3. Gera conteúdo IA + posta nas redes sociais
    """
    produto = db.query(AfiliadoProduto).filter_by(id=data.produto_id).first()
    if not produto:
        raise HTTPException(404, "Produto não encontrado")

    resultado = {
        "produto": produto.titulo,
        "passos": [],
    }

    # ── Passo 1: Definir preço de venda ───────────────────────────────────────
    preco_venda = data.preco_venda or round(produto.preco * 1.15, 2)
    margem = round(((preco_venda - produto.preco) / produto.preco * 100) if produto.preco else 15, 1)

    # ── Passo 2: Publicar no ML Vendedor (pulado no modo afiliado) ────────────
    cfg_vendedor = db.query(VendedorConfig).filter_by(plataforma="ML_VENDEDOR", ativo=True).first()
    ml_listing_id = None
    ml_url = None

    if data.modo_afiliado:
        resultado["passos"].append({"passo": "ML Vendedor", "status": "⏭️ Modo afiliado — use o Link Afiliado para divulgar"})
    elif cfg_vendedor and cfg_vendedor.access_token:
        cat_id = await _predict_cat_ml(produto.titulo, cfg_vendedor.access_token)
        categoria = _detectar_cat(produto.titulo)
        if not cat_id:
            cat_id = _CAT_ML.get(categoria, "MLB1459")
        brand, model = _extrair_brand_model(produto.titulo)
        cor = _detectar_cor(produto.titulo)

        # Para categorias regulamentadas (Anatel, grade de tamanhos), usa catalog_product_id
        # que já tem todos os atributos preenchidos no catálogo do ML
        catalog_product_id = _extract_catalog_id(produto.url_produto or "")
        if not catalog_product_id and categoria in ("Celulares", "Calçados", "Roupas", "Acessórios"):
            catalog_product_id = await _search_catalog_product(produto.titulo, cfg_vendedor.access_token)

        _SHIPPING = {"mode": "me2", "local_pick_up": False, "free_shipping": False}

        # Para celulares: busca Anatel ANTES de montar o payload (necessário mesmo com catalog)
        _anatel_global = ""
        if categoria == "Celulares":
            # 1ª fonte: /items/{produto_ext_id}/attributes
            if produto.produto_ext_id:
                try:
                    async with httpx.AsyncClient(timeout=8) as _ca:
                        _ra = await _ca.get(
                            f"https://api.mercadolibre.com/items/{produto.produto_ext_id}/attributes",
                            headers={"Authorization": f"Bearer {cfg_vendedor.access_token}"}
                        )
                    if _ra.status_code == 200:
                        for _a in _ra.json():
                            if _a.get("id") == "CELLPHONES_ANATEL_HOMOLOGATION_NUMBER":
                                _anatel_global = _a.get("value_name","") or ((_a.get("values") or [{}])[0].get("name",""))
                                break
                except Exception: pass
            # 2ª fonte: /products/{catalog_product_id}
            if not _anatel_global and catalog_product_id:
                try:
                    async with httpx.AsyncClient(timeout=8) as _cp:
                        _rp = await _cp.get(
                            f"https://api.mercadolibre.com/products/{catalog_product_id}",
                            headers={"Authorization": f"Bearer {cfg_vendedor.access_token}"}
                        )
                    if _rp.status_code == 200:
                        for _a in _rp.json().get("attributes", []):
                            if _a.get("id") == "CELLPHONES_ANATEL_HOMOLOGATION_NUMBER":
                                _vals = _a.get("values") or []
                                _anatel_global = _a.get("value_name","") or (_vals[0].get("name","") if _vals else "")
                                break
                except Exception: pass

        if catalog_product_id:
            payload = {
                "catalog_product_id": catalog_product_id,
                "title": produto.titulo[:60],
                "category_id": cat_id,
                "price": preco_venda,
                "currency_id": "BRL",
                "available_quantity": 1,
                "buying_mode": "buy_it_now",
                "listing_type_id": "free",
                "condition": "new",
                "shipping": _SHIPPING,
                "pictures": [{"source": produto.imagem_url}] if produto.imagem_url else [],
            }
            # Celulares: atributos obrigatórios + Anatel já buscado acima
            if categoria == "Celulares":
                ram, storage = _extrair_memoria(produto.titulo)
                cat_attrs = [
                    {"id": "BRAND",               "value_name": brand},
                    {"id": "MANUFACTURER",        "value_name": brand},
                    {"id": "MODEL",               "value_name": model},
                    {"id": "COLOR",               "value_name": cor},
                    {"id": "ALPHANUMERIC_MODELS", "value_name": model},
                    {"id": "IS_DUAL_SIM",         "value_name": "Sim"},
                    {"id": "CARRIER",             "value_name": "Desbloqueado"},
                ]
                if ram:              cat_attrs.append({"id": "RAM",             "value_name": ram})
                if storage:          cat_attrs.append({"id": "INTERNAL_MEMORY", "value_name": storage})
                if _anatel_global:   cat_attrs.append({"id": "CELLPHONES_ANATEL_HOMOLOGATION_NUMBER", "value_name": _anatel_global})
                payload["attributes"] = cat_attrs
            # Calçados/Roupas com catalog_product_id: o catálogo já gerencia tamanhos/grade
            elif categoria in ("Calçados", "Roupas"):
                payload["available_quantity"] = data.quantidade
        else:
            # Payload normal com atributos extraídos do título
            attrs: list = [
                {"id": "BRAND", "value_name": brand},
                {"id": "MODEL", "value_name": model},
            ]
            if categoria == "Celulares":
                attrs += [
                    {"id": "COLOR", "value_name": cor},
                    {"id": "MAIN_COLOR", "value_name": cor},
                    {"id": "ALPHANUMERIC_MODELS", "value_name": model},
                    {"id": "IS_DUAL_SIM", "value_name": "Sim"},
                    {"id": "CARRIER", "value_name": "Desbloqueado"},
                ]
            elif categoria in ("Smartwatches", "Áudio", "Roupas", "Acessórios", "Esporte", "Calçados"):
                attrs.append({"id": "COLOR", "value_name": cor})
            payload = {
                "title": produto.titulo[:60],
                "category_id": cat_id,
                "price": preco_venda,
                "currency_id": "BRL",
                "available_quantity": 1,
                "buying_mode": "buy_it_now",
                "listing_type_id": "free",
                "condition": "new",
                "shipping": _SHIPPING,
                "pictures": [{"source": produto.imagem_url}] if produto.imagem_url else [],
                "attributes": attrs,
            }

        async def _publicar_ml(pay: dict):
            async with httpx.AsyncClient(timeout=20) as client:
                return await client.post(
                    "https://api.mercadolibre.com/items",
                    headers={"Authorization": f"Bearer {cfg_vendedor.access_token}", "Content-Type": "application/json"},
                    json=pay
                )

        try:
            r = await _publicar_ml(payload)
            ml_ok = r.status_code in (200, 201)

            if not ml_ok and r.status_code == 400:
                err_txt = r.text
                if "listing_type_temporarily_unavailable" in err_txt:
                    # Throttle do ML para criação de anúncios grátis — não é erro de dados, é limite temporário da conta
                    resultado["passos"].append({"passo": "ML Vendedor", "status": "⏳ Mercado Livre limitou criação de anúncios grátis temporariamente. Aguarde alguns minutos → link afiliado gerado.", "throttle": True})
                elif catalog_product_id and ("listing_type" in err_txt or "not_allowed" in err_txt or "forbidden" in err_txt.lower()):
                    # Catálogo não aceita free → tenta payload normal com atributos
                    attrs2: list = [{"id": "BRAND", "value_name": brand}, {"id": "MODEL", "value_name": model}, {"id": "COLOR", "value_name": cor}]
                    p2 = {
                        "title": produto.titulo[:60], "category_id": cat_id,
                        "price": preco_venda, "currency_id": "BRL", "available_quantity": 1,
                        "buying_mode": "buy_it_now", "listing_type_id": "free", "condition": "new",
                        "shipping": _SHIPPING,
                        "pictures": [{"source": produto.imagem_url}] if produto.imagem_url else [],
                        "attributes": attrs2,
                    }
                    r = await _publicar_ml(p2)
                    ml_ok = r.status_code in (200, 201)
                    if not ml_ok:
                        resultado["passos"].append({"passo": "ML Vendedor", "status": f"⚠️ API retornou {r.status_code}", "detalhe": r.text[:200]})
                elif "shipping.lost_me" in err_txt or "4053" in err_txt:
                    # Catalog força ME1 → retry sem catalog_product_id + me2
                    if categoria == "Celulares":
                        # Celular: reconstrói atributos específicos + busca Anatel
                        ram2, storage2 = _extrair_memoria(produto.titulo)
                        attrs_ship = [
                            {"id": "BRAND",              "value_name": brand},
                            {"id": "MANUFACTURER",       "value_name": brand},
                            {"id": "MODEL",              "value_name": model},
                            {"id": "COLOR",              "value_name": cor},
                            {"id": "ALPHANUMERIC_MODELS","value_name": model},
                            {"id": "IS_DUAL_SIM",        "value_name": "Sim"},
                            {"id": "CARRIER",            "value_name": "Desbloqueado"},
                        ]
                        if ram2:     attrs_ship.append({"id": "RAM",             "value_name": ram2})
                        if storage2: attrs_ship.append({"id": "INTERNAL_MEMORY", "value_name": storage2})
                        # Busca Anatel: 1ª via /items/{ext_id}/attributes
                        _anatel = ""
                        if produto.produto_ext_id:
                            try:
                                async with httpx.AsyncClient(timeout=8) as _ca:
                                    _ra = await _ca.get(
                                        f"https://api.mercadolibre.com/items/{produto.produto_ext_id}/attributes",
                                        headers={"Authorization": f"Bearer {cfg_vendedor.access_token}"}
                                    )
                                if _ra.status_code == 200:
                                    for _a in _ra.json():
                                        if _a.get("id") == "CELLPHONES_ANATEL_HOMOLOGATION_NUMBER":
                                            _anatel = _a.get("value_name","") or ((_a.get("values") or [{}])[0].get("name",""))
                                            break
                            except Exception: pass
                        # Busca Anatel: 2ª via /products/{catalog_id} (atributos do catálogo ML)
                        if not _anatel and catalog_product_id:
                            try:
                                async with httpx.AsyncClient(timeout=8) as _cp:
                                    _rp = await _cp.get(
                                        f"https://api.mercadolibre.com/products/{catalog_product_id}",
                                        headers={"Authorization": f"Bearer {cfg_vendedor.access_token}"}
                                    )
                                if _rp.status_code == 200:
                                    for _a in _rp.json().get("attributes", []):
                                        if _a.get("id") == "CELLPHONES_ANATEL_HOMOLOGATION_NUMBER":
                                            _vals = _a.get("values") or []
                                            _anatel = _a.get("value_name","") or (_vals[0].get("name","") if _vals else "")
                                            break
                            except Exception: pass
                        if _anatel:
                            attrs_ship.append({"id": "CELLPHONES_ANATEL_HOMOLOGATION_NUMBER", "value_name": _anatel})
                        p2 = {
                            "title": produto.titulo[:60], "category_id": cat_id,
                            "price": preco_venda, "currency_id": "BRL", "available_quantity": 1,
                            "buying_mode": "buy_it_now", "listing_type_id": "free", "condition": "new",
                            "shipping": _SHIPPING,
                            "pictures": [{"source": produto.imagem_url}] if produto.imagem_url else [],
                            "attributes": attrs_ship,
                        }
                    else:
                        # Outras categorias: mantém os atributos originais (já corretos para a categoria),
                        # só remove catalog_product_id e força shipping ME2.
                        p2 = {k: v for k, v in payload.items() if k != "catalog_product_id"}
                        p2["shipping"] = _SHIPPING
                    r = await _publicar_ml(p2)
                    ml_ok = r.status_code in (200, 201)
                    if not ml_ok:
                        err2 = r.text
                        if "ANATEL" in err2:
                            resultado["passos"].append({"passo": "ML Vendedor", "status": "⚠️ N° Anatel não encontrado para este modelo → link afiliado gerado."})
                        elif "listing_type_temporarily_unavailable" in err2:
                            resultado["passos"].append({"passo": "ML Vendedor", "status": "⏳ Mercado Livre limitou criação de anúncios grátis temporariamente. Aguarde alguns minutos → link afiliado gerado.", "throttle": True})
                        elif "shipping" in err2:
                            resultado["passos"].append({"passo": "ML Vendedor", "status": "⚠️ Erro de frete (ME2/shipping) → link afiliado gerado.", "detalhe": err2[:300]})
                        else:
                            resultado["passos"].append({"passo": "ML Vendedor", "status": f"⚠️ API {r.status_code}", "detalhe": r.text[:250]})
                elif "missing_catalog_required" in err_txt:
                    ram2, storage2 = _extrair_memoria(produto.titulo)
                    retry_attrs = [
                        {"id": "BRAND", "value_name": brand}, {"id": "MODEL", "value_name": model},
                        {"id": "COLOR", "value_name": cor}, {"id": "ALPHANUMERIC_MODELS", "value_name": model},
                        {"id": "IS_DUAL_SIM", "value_name": "Sim"},
                        {"id": "CARRIER", "value_name": "Desbloqueado"},
                    ]
                    if ram2: retry_attrs.append({"id": "RAM", "value_name": ram2})
                    if storage2: retry_attrs.append({"id": "INTERNAL_MEMORY", "value_name": storage2})
                    p2 = {**payload, "attributes": retry_attrs}
                    r = await _publicar_ml(p2)
                    ml_ok = r.status_code in (200, 201)
                    if not ml_ok:
                        resultado["passos"].append({"passo": "ML Vendedor", "status": f"⚠️ API {r.status_code}", "detalhe": r.text[:200]})
                elif "SIZE_GRID_ID" in err_txt or "fashion_grid" in err_txt or "size_grid" in err_txt.lower():
                    resultado["passos"].append({"passo": "ML Vendedor", "status": "⚠️ Categoria exige grade de tamanhos → link afiliado gerado."})
                elif "ANATEL" in err_txt:
                    resultado["passos"].append({"passo": "ML Vendedor", "status": "⚠️ Celular requer N° Anatel → link afiliado gerado."})
                elif "item.category_id.invalid" in err_txt or "leaf category" in err_txt:
                    p2 = {k: v for k, v in payload.items() if k != "category_id"}
                    r = await _publicar_ml(p2)
                    ml_ok = r.status_code in (200, 201)
                    if not ml_ok:
                        resultado["passos"].append({"passo": "ML Vendedor", "status": f"⚠️ API retornou {r.status_code}", "detalhe": r.text[:200]})
                elif "missing_required" in err_txt:
                    retry_attrs3 = [
                        {"id": "BRAND", "value_name": brand},
                        {"id": "MODEL", "value_name": model},
                        {"id": "COLOR", "value_name": cor},
                    ]
                    if categoria == "Celulares":
                        retry_attrs3.append({"id": "CARRIER", "value_name": "Desbloqueado"})
                    p2 = {**payload, "attributes": retry_attrs3}
                    r = await _publicar_ml(p2)
                    ml_ok = r.status_code in (200, 201)
                    if not ml_ok:
                        resultado["passos"].append({"passo": "ML Vendedor", "status": f"⚠️ API retornou {r.status_code}", "detalhe": r.text[:200]})
                else:
                    try: err_detail = r.json()
                    except: err_detail = r.text[:300]
                    resultado["passos"].append({"passo": "ML Vendedor", "status": f"⚠️ API retornou {r.status_code}", "detalhe": str(err_detail)[:300]})

            if ml_ok:
                rd = r.json()
                ml_listing_id = rd.get("id")
                ml_url = rd.get("permalink")
                if ml_listing_id and (produto.descricao or produto.titulo):
                    try:
                        async with httpx.AsyncClient(timeout=10) as client2:
                            await client2.post(
                                f"https://api.mercadolibre.com/items/{ml_listing_id}/description",
                                headers={"Authorization": f"Bearer {cfg_vendedor.access_token}", "Content-Type": "application/json"},
                                json={"plain_text": produto.descricao or f"Produto: {produto.titulo}. Qualidade garantida."}
                            )
                    except Exception:
                        pass
                resultado["passos"].append({"passo": "ML Vendedor", "status": "✅ Publicado", "url": ml_url, "listing_id": ml_listing_id})
        except Exception as e:
            resultado["passos"].append({"passo": "ML Vendedor", "status": f"❌ Erro: {str(e)[:100]}"})
    else:
        resultado["passos"].append({"passo": "ML Vendedor", "status": "⚠️ Conta vendedor não configurada"})

    # ── Passo 3: Salvar anúncio no banco (upsert — evita duplicados) ─────────
    anuncio = db.query(VendedorAnuncio).filter_by(
        produto_afiliado_id=produto.id, plataforma="ML_VENDEDOR"
    ).first()
    if not anuncio:
        anuncio = VendedorAnuncio(produto_afiliado_id=produto.id, plataforma="ML_VENDEDOR")
        db.add(anuncio)
    anuncio.listing_id  = ml_listing_id or anuncio.listing_id
    anuncio.titulo      = produto.titulo
    anuncio.preco_custo = produto.preco
    anuncio.preco_venda = preco_venda
    anuncio.margem_pct  = margem
    anuncio.categoria_ml = _detectar_cat(produto.titulo)
    anuncio.imagem_url  = produto.imagem_url
    anuncio.url_anuncio = ml_url or anuncio.url_anuncio
    if ml_listing_id:
        anuncio.status       = "ATIVO"
        anuncio.publicado_em = datetime.utcnow()

    # ── Passo 4: Gerar link de afiliado ───────────────────────────────────────
    cfg_afil = db.query(AfiliadoConfig).filter_by(plataforma="ML_AFILIADOS").first()
    link_afiliado = produto.url_produto or ""
    if cfg_afil:
        extra = json.loads(cfg_afil.extra_json or "{}")
        pub_id = extra.get("publisher_id", "")
        if pub_id and produto.url_produto:
            link_afiliado = f"https://mercadolivre.com/sec/affiliate?deal_print_id={pub_id}&item_id={produto.produto_ext_id}&tracking_id=nexus"
    anuncio.link_afiliado = link_afiliado
    # Modo afiliado: pula ML Vendedor e usa link afiliado diretamente
    if data.modo_afiliado and link_afiliado:
        anuncio.url_anuncio = link_afiliado
        anuncio.status = "ATIVO"
        anuncio.publicado_em = anuncio.publicado_em or datetime.utcnow()
    # ML Vendedor falhou mas temos link afiliado → usa como fallback
    elif not ml_listing_id and link_afiliado:
        anuncio.url_anuncio = anuncio.url_anuncio or link_afiliado
        anuncio.status = "ATIVO"
        anuncio.publicado_em = anuncio.publicado_em or datetime.utcnow()
    db.add(anuncio)
    db.commit()
    resultado["passos"].append({"passo": "Link Afiliado", "status": "✅ Gerado", "link": link_afiliado})
    resultado["anuncio_id"] = anuncio.id

    # ── Passo 5: Gerar conteúdo IA e postar redes sociais ─────────────────────
    if data.publicar_redes:
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.post(
                    "http://localhost:8001/afiliados/conteudo/gerar",
                    json={"produto_id": produto.id, "rede_social": "TODOS", "tipo_conteudo": "POST"},
                    headers={"Authorization": "internal"}
                )
            if r.status_code == 200:
                resultado["passos"].append({"passo": "Redes Sociais", "status": "✅ Conteúdo gerado"})
            else:
                resultado["passos"].append({"passo": "Redes Sociais", "status": "⚠️ Conteúdo gerado (verificar publicação)"})
        except:
            resultado["passos"].append({"passo": "Redes Sociais", "status": "⚠️ Gerar manualmente no Criador de Conteúdo"})

    resultado["preco_venda"] = preco_venda
    resultado["margem_pct"] = margem
    resultado["link_afiliado"] = link_afiliado
    resultado["ml_url"] = ml_url
    return resultado

# ─── Anúncios ─────────────────────────────────────────────────────────────────

@router.get("/anuncios")
def listar_anuncios(
    plataforma: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db), _=Depends(get_current_user)
):
    q = db.query(VendedorAnuncio)
    if plataforma: q = q.filter_by(plataforma=plataforma)
    if status:     q = q.filter_by(status=status)
    items = q.order_by(VendedorAnuncio.created_at.desc()).all()
    return [
        {
            "id": a.id,
            "titulo": a.titulo,
            "plataforma": a.plataforma,
            "listing_id": a.listing_id,
            "preco_custo": a.preco_custo,
            "preco_venda": a.preco_venda,
            "margem_pct": a.margem_pct,
            "imagem_url": a.imagem_url,
            "url_anuncio": a.url_anuncio,
            "link_afiliado": a.link_afiliado,
            "status": a.status,
            "vendas_count": a.vendas_count,
            "faturamento": a.faturamento,
            "categoria_ml": a.categoria_ml,
            "publicado_em": a.publicado_em.isoformat() if a.publicado_em else None,
        }
        for a in items
    ]

@router.patch("/anuncios/{anuncio_id}")
def atualizar_anuncio(anuncio_id: int, data: AnuncioUpdateIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    a = db.query(VendedorAnuncio).filter_by(id=anuncio_id).first()
    if not a: raise HTTPException(404, "Anúncio não encontrado")
    if data.preco_venda is not None: a.preco_venda = data.preco_venda
    if data.status:                  a.status = data.status
    db.commit()
    return {"ok": True}

@router.delete("/anuncios/{anuncio_id}")
def remover_anuncio(anuncio_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    a = db.query(VendedorAnuncio).filter_by(id=anuncio_id).first()
    if not a: raise HTTPException(404, "Anúncio não encontrado")
    db.delete(a); db.commit()
    return {"ok": True}

@router.post("/publicar-catalogo-tudo")
def publicar_catalogo_tudo(db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Cria anúncios para todos os produtos do catálogo afiliado que ainda não têm registro"""
    produtos = db.query(AfiliadoProduto).all()
    criados = 0
    atualizados = 0
    for produto in produtos:
        # Sem preço ou foto válidos não há o que sincronizar — evita criar
        # anúncio "ATIVO" fantasma com R$ 0,00 e sem imagem.
        if not produto.preco or not produto.imagem_url:
            continue
        existente = db.query(VendedorAnuncio).filter_by(
            produto_afiliado_id=produto.id, plataforma="ML_VENDEDOR"
        ).first()
        link = produto.url_produto or ""
        preco_venda = round(produto.preco * 1.15, 2) if produto.preco else 0
        margem = round(((preco_venda - produto.preco) / produto.preco * 100) if produto.preco else 15, 1)
        if not existente:
            novo = VendedorAnuncio(
                produto_afiliado_id=produto.id,
                plataforma="ML_VENDEDOR",
                titulo=produto.titulo or "",
                preco_custo=produto.preco or 0,
                preco_venda=preco_venda,
                margem_pct=margem,
                imagem_url=produto.imagem_url,
                url_anuncio=link,
                link_afiliado=link,
                status="ATIVO" if link else "PENDENTE",
                publicado_em=datetime.utcnow() if link else None,
                categoria_ml=_detectar_cat(produto.titulo or ""),
            )
            db.add(novo)
            criados += 1
        elif existente.status != "ATIVO" and link:
            existente.url_anuncio = link
            existente.link_afiliado = link
            existente.status = "ATIVO"
            existente.publicado_em = existente.publicado_em or datetime.utcnow()
            atualizados += 1
    db.commit()
    return {"ok": True, "criados": criados, "atualizados": atualizados, "total_catalogo": len(produtos)}


@router.post("/anuncios/limpar-duplicados")
def limpar_duplicados(db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Remove duplicados (mantém o mais recente por produto) e pendentes sem link"""
    from sqlalchemy import func
    todos = db.query(VendedorAnuncio).order_by(VendedorAnuncio.id.desc()).all()
    vistos: set[int] = set()
    removidos = 0
    for a in todos:
        key = a.produto_afiliado_id
        if key in vistos:
            db.delete(a); removidos += 1
        else:
            vistos.add(key)
    # Remove pendentes sem link afiliado e sem listing
    pendentes_vazios = db.query(VendedorAnuncio).filter(
        VendedorAnuncio.status == "PENDENTE",
        VendedorAnuncio.listing_id == None,
        VendedorAnuncio.link_afiliado == None,
    ).all()
    for a in pendentes_vazios:
        db.delete(a); removidos += 1
    db.commit()
    return {"ok": True, "removidos": removidos}

# ─── Dashboard Vendedor ───────────────────────────────────────────────────────

@router.get("/dashboard")
def dashboard_vendedor(db: Session = Depends(get_db), _=Depends(get_current_user)):
    from sqlalchemy import func
    total_anuncios = db.query(VendedorAnuncio).filter_by(status="ATIVO").count()
    total_faturado = db.query(func.sum(VendedorAnuncio.faturamento)).scalar() or 0
    total_vendas   = db.query(func.sum(VendedorAnuncio.vendas_count)).scalar() or 0
    pendentes      = db.query(VendedorAnuncio).filter_by(status="PENDENTE").count()
    recentes       = db.query(VendedorAnuncio).order_by(VendedorAnuncio.created_at.desc()).limit(5).all()

    return {
        "total_anuncios": total_anuncios,
        "total_faturado": total_faturado,
        "total_vendas": int(total_vendas or 0),
        "pendentes": pendentes,
        "recentes": [
            {
                "id": a.id, "titulo": a.titulo[:50], "preco_venda": a.preco_venda,
                "status": a.status, "plataforma": a.plataforma,
                "listing_id": a.listing_id, "url_anuncio": a.url_anuncio,
            }
            for a in recentes
        ]
    }

# ─── Listar pedidos ──────────────────────────────────────────────────────────

@router.get("/pedidos")
def listar_pedidos(db: Session = Depends(get_db), _=Depends(get_current_user)):
    pedidos = db.query(VendedorPedido).order_by(VendedorPedido.data_pedido.desc()).limit(100).all()
    return [
        {
            "id": p.id,
            "pedido_ext_id": p.pedido_ext_id,
            "titulo_produto": p.titulo_produto,
            "valor_venda": p.valor_venda,
            "lucro_estimado": p.lucro_estimado,
            "status": p.status,
            "plataforma": p.plataforma,
            "data_pedido": p.data_pedido.isoformat() if p.data_pedido else None,
        }
        for p in pedidos
    ]

# ─── Sync pedidos ML ─────────────────────────────────────────────────────────

@router.post("/sync-pedidos")
async def sync_pedidos_ml(db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Busca pedidos recentes na conta ML vendedor, salva e atualiza faturamento dos anúncios"""
    cfg = db.query(VendedorConfig).filter_by(plataforma="ML_VENDEDOR", ativo=True).first()
    if not cfg or not cfg.access_token:
        return {"ok": False, "msg": "Conta ML Vendedor não configurada"}

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            # Pega o seller_id real (necessário para /orders/search)
            seller_id = cfg.seller_id
            if not seller_id:
                ru = await client.get(
                    "https://api.mercadolibre.com/users/me",
                    headers={"Authorization": f"Bearer {cfg.access_token}"}
                )
                if ru.status_code == 200:
                    seller_id = str(ru.json().get("id", ""))
                    cfg.seller_id = seller_id
                    db.commit()

            if not seller_id:
                return {"ok": False, "msg": "Não foi possível obter seller_id"}

            r = await client.get(
                f"https://api.mercadolibre.com/orders/search?seller={seller_id}&sort=date_desc&limit=50",
                headers={"Authorization": f"Bearer {cfg.access_token}"}
            )
        if r.status_code != 200:
            return {"ok": False, "msg": f"API ML retornou {r.status_code}: {r.text[:200]}"}

        data = r.json()
        results = data.get("results", [])
        novos = 0
        for order in results:
            ext_id    = str(order.get("id", ""))
            status_ml = order.get("status", "novo").upper()
            existe    = db.query(VendedorPedido).filter_by(pedido_ext_id=ext_id).first()

            for item in order.get("order_items", []):
                item_id   = item.get("item", {}).get("id", "")
                titulo    = item.get("item", {}).get("title", "")
                qty       = int(item.get("quantity", 1))
                valor     = float(item.get("unit_price", 0)) * qty

                anuncio = db.query(VendedorAnuncio).filter_by(listing_id=item_id).first()

                if not existe:
                    lucro = 0.0
                    if anuncio and anuncio.preco_custo:
                        lucro = round((valor - anuncio.preco_custo * qty), 2)
                    p = VendedorPedido(
                        plataforma="ML_VENDEDOR",
                        pedido_ext_id=ext_id,
                        anuncio_id=anuncio.id if anuncio else None,
                        titulo_produto=titulo,
                        valor_venda=valor,
                        lucro_estimado=lucro,
                        status=status_ml,
                        data_pedido=datetime.utcnow(),
                    )
                    db.add(p)
                    novos += 1

                    if anuncio and status_ml in ("PAID", "DELIVERED", "SHIPPED"):
                        anuncio.faturamento  = (anuncio.faturamento or 0) + valor
                        anuncio.vendas_count = (anuncio.vendas_count or 0) + qty
                elif existe and existe.status != status_ml:
                    existe.status = status_ml

        db.commit()
        return {"ok": True, "novos_pedidos": novos, "total_encontrados": len(results), "seller_id_usado": seller_id}
    except Exception as e:
        return {"ok": False, "msg": str(e)[:200]}
