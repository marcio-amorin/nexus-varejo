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

ML_REDIRECT_URI = os.getenv("ML_REDIRECT_URI", "https://nexus-varejo-backend.onrender.com/afiliados/ml-callback")
ML_AUTH_URL     = "https://auth.mercadolivre.com.br/authorization"

@router.get("/ml-auth-url")
def vendedor_ml_auth_url(db: Session = Depends(get_db), _=Depends(get_current_user)):
    cfg = db.query(AfiliadoConfig).filter_by(plataforma="ML_AFILIADOS").first()
    if not cfg or not cfg.client_id:
        raise HTTPException(400, "Configure o Client ID do ML em Config. Afiliados primeiro")
    url = (
        f"{ML_AUTH_URL}?response_type=code"
        f"&client_id={urllib.parse.quote(cfg.client_id)}"
        f"&redirect_uri={urllib.parse.quote(ML_REDIRECT_URI)}"
        f"&state=vendedor"
    )
    return {"url": url}

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

# ─── Preditor de categoria via API do ML (retorna leaf category) ──────────────

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
        # Prediz categoria folha via API do ML (evita item.category_id.invalid)
        cat_id = await _predict_cat_ml(produto.titulo, cfg_vendedor.access_token)
        if not cat_id:
            categoria = _detectar_cat(produto.titulo)
            cat_id = _CAT_ML.get(categoria, "MLB1459")
        brand, model = _extrair_brand_model(produto.titulo)
        payload = {
            "title": produto.titulo[:60],
            "category_id": cat_id,
            "price": preco_venda,
            "currency_id": "BRL",
            "available_quantity": 1,  # free listing: max 1 por categoria
            "buying_mode": "buy_it_now",
            "listing_type_id": "free",
            "condition": "new",
            "pictures": [{"source": produto.imagem_url}] if produto.imagem_url else [],
            "attributes": [
                {"id": "BRAND", "value_name": brand},
                {"id": "MODEL", "value_name": model},
            ],
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
            # Se der erro de grade de tamanho (moda/calçados), retenta com categoria genérica
            if r.status_code == 400:
                err_txt = r.text
                if "fashion_grid" in err_txt or "SIZE_GRID_ID" in err_txt or "grid_id" in err_txt:
                    payload_retry = {**payload, "category_id": "MLB1000"}  # Eletrônicos/Outros (sem grade)
                    r = await _publicar_ml(payload_retry)
            if r.status_code in (200, 201):
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
            else:
                try:
                    err_detail = r.json()
                except Exception:
                    err_detail = r.text[:300]
                resultado["passos"].append({"passo": "ML Vendedor", "status": f"⚠️ API retornou {r.status_code}", "detalhe": str(err_detail)[:300]})
        except Exception as e:
            resultado["passos"].append({"passo": "ML Vendedor", "status": f"❌ Erro: {str(e)[:100]}"})
    else:
        resultado["passos"].append({"passo": "ML Vendedor", "status": "⚠️ Conta vendedor não configurada"})

    # ── Passo 3: Salvar anúncio no banco ──────────────────────────────────────
    anuncio = VendedorAnuncio(
        produto_afiliado_id=produto.id,
        plataforma="ML_VENDEDOR",
        listing_id=ml_listing_id,
        titulo=produto.titulo,
        preco_custo=produto.preco,
        preco_venda=preco_venda,
        margem_pct=margem,
        categoria_ml=_detectar_cat(produto.titulo),
        imagem_url=produto.imagem_url,
        url_anuncio=ml_url,
        status="ATIVO" if ml_listing_id else "PENDENTE",
        publicado_em=datetime.utcnow() if ml_listing_id else None,
    )

    # ── Passo 4: Gerar link de afiliado ───────────────────────────────────────
    cfg_afil = db.query(AfiliadoConfig).filter_by(plataforma="ML_AFILIADOS").first()
    link_afiliado = produto.url_produto or ""
    if cfg_afil:
        extra = json.loads(cfg_afil.extra_json or "{}")
        pub_id = extra.get("publisher_id", "")
        if pub_id and produto.url_produto:
            link_afiliado = f"https://mercadolivre.com/sec/affiliate?deal_print_id={pub_id}&item_id={produto.produto_ext_id}&tracking_id=nexus"
    anuncio.link_afiliado = link_afiliado
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
            {"id": a.id, "titulo": a.titulo[:50], "preco_venda": a.preco_venda, "status": a.status, "plataforma": a.plataforma}
            for a in recentes
        ]
    }

# ─── Sync pedidos ML ─────────────────────────────────────────────────────────

@router.post("/sync-pedidos")
async def sync_pedidos_ml(db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Busca pedidos recentes na conta ML vendedor e salva no banco"""
    cfg = db.query(VendedorConfig).filter_by(plataforma="ML_VENDEDOR", ativo=True).first()
    if not cfg or not cfg.access_token:
        return {"ok": False, "msg": "Conta ML Vendedor não configurada"}

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                "https://api.mercadolibre.com/orders/search?seller=me&sort=date_desc&limit=50",
                headers={"Authorization": f"Bearer {cfg.access_token}"}
            )
        if r.status_code != 200:
            return {"ok": False, "msg": f"API ML retornou {r.status_code}"}

        data = r.json()
        novos = 0
        for order in data.get("results", []):
            ext_id = str(order.get("id", ""))
            existe = db.query(VendedorPedido).filter_by(pedido_ext_id=ext_id).first()
            if not existe:
                for item in order.get("order_items", []):
                    p = VendedorPedido(
                        plataforma="ML_VENDEDOR",
                        pedido_ext_id=ext_id,
                        titulo_produto=item.get("item", {}).get("title", ""),
                        valor_venda=float(item.get("unit_price", 0)) * int(item.get("quantity", 1)),
                        status=order.get("status", "NOVO").upper(),
                        data_pedido=datetime.utcnow(),
                    )
                    db.add(p); novos += 1

        db.commit()
        return {"ok": True, "novos_pedidos": novos}
    except Exception as e:
        return {"ok": False, "msg": str(e)[:200]}
