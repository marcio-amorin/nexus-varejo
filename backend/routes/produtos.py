from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from database import get_db, SessionLocal
from models import Produto, CategoriaProduto, ProdutoFornecedor, Fornecedor, ApiExternaConfig
from utils.security import get_current_user
from pydantic import BaseModel
from typing import Optional, List
import httpx, re, pathlib, shutil, uuid, asyncio

router = APIRouter(prefix="/produtos", tags=["produtos"])


# ─── Schemas ────────────────────────────────────────────────────────────────

class CategoriaCreate(BaseModel):
    nome: str
    icone: Optional[str] = "📦"
    cor: Optional[str] = "#6366f1"
    margem_padrao: Optional[float] = 30.0

_IMG_DIR = pathlib.Path(__file__).parent.parent / "static" / "imagens" / "produtos"


# ─── Background: busca automática de imagem ──────────────────────────────────

def _ean_to_path(barcode: str) -> str:
    """Converte EAN-13 para formato de path do Open Food Facts: 789/808/064/0222"""
    b = barcode.zfill(13)
    return f"{b[0:3]}/{b[3:6]}/{b[6:9]}/{b[9:]}"


async def _tentar_baixar(url: str, dest: pathlib.Path) -> bool:
    """Tenta baixar a URL e salvar em dest. Retorna True se sucesso."""
    try:
        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as c:
            r = await c.get(url, headers={"User-Agent": "MaxxERP/2.0 (marcio@amorin.com.br)"})
        if r.status_code == 200 and len(r.content) > 1000:
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(r.content)
            return True
    except Exception:
        pass
    return False


async def auto_buscar_imagem(produto_id: int, barcode: str):
    """Background task: busca imagem em múltiplas fontes e salva localmente."""
    if not re.fullmatch(r"\d{8}|\d{12}|\d{13}", barcode or ""):
        return

    db = SessionLocal()
    try:
        p = db.query(Produto).filter(Produto.id == produto_id).first()
        if not p or p.imagem_url:
            return  # Já tem imagem, não sobrescreve

        dest = _IMG_DIR / f"{produto_id}.jpg"

        # 1 — URLs diretas do Open Food Facts (sem passar pela API, mais rápido)
        path = _ean_to_path(barcode)
        candidates = [
            f"https://images.openfoodfacts.org/images/products/{path}/front_pt.400.jpg",
            f"https://images.openfoodfacts.org/images/products/{path}/front.400.jpg",
            f"https://images.openfoodfacts.org/images/products/{path}/front_pt.200.jpg",
            f"https://images.openfoodfacts.org/images/products/{path}/front.200.jpg",
            f"https://images.openfoodfacts.org/images/products/{barcode}/front_pt.400.jpg",
            f"https://images.openfoodfacts.org/images/products/{barcode}/front.400.jpg",
        ]
        for url in candidates:
            if await _tentar_baixar(url, dest):
                p.imagem_url = f"/static/imagens/produtos/{produto_id}.jpg"
                db.commit()
                return

        # 2 — API OFF (pega a URL exata que o produto tem cadastrado)
        try:
            async with httpx.AsyncClient(timeout=8.0) as c:
                r = await c.get(
                    f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json",
                    headers={"User-Agent": "MaxxERP/2.0 (marcio@amorin.com.br)"},
                )
            data = r.json()
            if data.get("status") == 1:
                prod_off = data.get("product", {})
                img_url = (
                    prod_off.get("image_front_url")
                    or prod_off.get("image_url")
                    or prod_off.get("image_front_small_url")
                    or prod_off.get("image_small_url")
                )
                if img_url and await _tentar_baixar(img_url, dest):
                    p.imagem_url = f"/static/imagens/produtos/{produto_id}.jpg"
                    db.commit()
        except Exception:
            pass

    finally:
        db.close()

class ProdutoCreate(BaseModel):
    codigo: str
    descricao: str
    unidade: Optional[str] = "UN"
    categoria_id: Optional[int] = None
    ncm: Optional[str] = None
    codigo_barras: Optional[str] = None
    preco_custo: Optional[float] = 0.0
    preco_venda: Optional[float] = 0.0
    margem: Optional[float] = 30.0
    estoque_atual: Optional[float] = 0.0
    estoque_minimo: Optional[float] = 0.0
    localizacao: Optional[str] = None
    observacoes: Optional[str] = None
    pesavel: Optional[bool] = False
    plu_codigo: Optional[int] = None
    enviar_balanca: Optional[bool] = False
    embalagem_codigo: Optional[str] = None
    embalagem_qtd: Optional[int] = 1
    embalagem_desc: Optional[str] = None
    embalagem_tipo: Optional[str] = "CX"
    atacarejo: Optional[bool] = False
    atacarejo_qtd_min: Optional[int] = 3
    atacarejo_preco: Optional[float] = 0.0
    controla_validade: Optional[bool] = False
    dias_validade_alerta: Optional[int] = 30
    imagem_url: Optional[str] = None

class ProdutoUpdate(BaseModel):
    descricao: Optional[str] = None
    unidade: Optional[str] = None
    categoria_id: Optional[int] = None
    ncm: Optional[str] = None
    codigo_barras: Optional[str] = None
    preco_custo: Optional[float] = None
    preco_venda: Optional[float] = None
    margem: Optional[float] = None
    estoque_minimo: Optional[float] = None
    localizacao: Optional[str] = None
    observacoes: Optional[str] = None
    is_active: Optional[bool] = None
    pesavel: Optional[bool] = None
    plu_codigo: Optional[int] = None
    enviar_balanca: Optional[bool] = None
    embalagem_codigo: Optional[str] = None
    embalagem_qtd: Optional[int] = None
    embalagem_desc: Optional[str] = None
    embalagem_tipo: Optional[str] = None
    atacarejo: Optional[bool] = None
    atacarejo_qtd_min: Optional[int] = None
    atacarejo_preco: Optional[float] = None
    controla_validade: Optional[bool] = None
    dias_validade_alerta: Optional[int] = None
    imagem_url: Optional[str] = None

class FornecedorLink(BaseModel):
    fornecedor_id: int
    principal: bool = False

class PrecoUpdate(BaseModel):
    preco_custo: Optional[float] = None
    preco_venda: Optional[float] = None
    margem: Optional[float] = None
    recalcular_venda: Optional[bool] = False  # recalcula venda a partir do custo + margem


# ─── Helpers ────────────────────────────────────────────────────────────────

def _prod_dict(p: Produto, db: Session) -> dict:
    cat = db.query(CategoriaProduto).filter(CategoriaProduto.id == p.categoria_id).first() if p.categoria_id else None
    return {
        "id": p.id,
        "codigo": p.codigo,
        "codigo_barras": p.codigo_barras,
        "descricao": p.descricao,
        "unidade": p.unidade,
        "categoria_id": p.categoria_id,
        "categoria_nome": cat.nome if cat else None,
        "categoria_cor": cat.cor if cat else None,
        "ncm": p.ncm,
        "preco_custo": p.preco_custo,
        "preco_venda": p.preco_venda,
        "margem": p.margem,
        "estoque_atual": p.estoque_atual,
        "estoque_minimo": p.estoque_minimo,
        "estoque_baixo": p.estoque_atual <= p.estoque_minimo,
        "localizacao": p.localizacao,
        "observacoes": p.observacoes,
        "is_active": p.is_active,
        "pesavel": getattr(p, "pesavel", False) or False,
        "plu_codigo": getattr(p, "plu_codigo", None),
        "enviar_balanca": getattr(p, "enviar_balanca", False) or False,
        "embalagem_codigo": getattr(p, "embalagem_codigo", None),
        "embalagem_qtd": getattr(p, "embalagem_qtd", 1) or 1,
        "embalagem_desc": getattr(p, "embalagem_desc", None),
        "embalagem_tipo": getattr(p, "embalagem_tipo", "CX") or "CX",
        "atacarejo": getattr(p, "atacarejo", False) or False,
        "atacarejo_qtd_min": getattr(p, "atacarejo_qtd_min", 3) or 3,
        "atacarejo_preco": getattr(p, "atacarejo_preco", 0) or 0,
        "controla_validade": getattr(p, "controla_validade", False) or False,
        "dias_validade_alerta": getattr(p, "dias_validade_alerta", 30) or 30,
        "imagem_url": getattr(p, "imagem_url", None),
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


def _cat_dict(c: CategoriaProduto, db: Session) -> dict:
    total = db.query(Produto).filter(Produto.categoria_id == c.id, Produto.is_active == True).count()
    return {
        "id": c.id, "nome": c.nome, "icone": c.icone, "cor": c.cor,
        "margem_padrao": c.margem_padrao, "is_active": c.is_active,
        "total_produtos": total,
    }


def _next_codigo(db: Session) -> str:
    last = db.query(Produto).order_by(Produto.id.desc()).first()
    n = (last.id + 1) if last else 1
    return f"P{n:05d}"


# ─── Categorias ─────────────────────────────────────────────────────────────

@router.get("/categorias")
def list_categorias(db: Session = Depends(get_db), _=Depends(get_current_user)):
    cats = db.query(CategoriaProduto).filter(CategoriaProduto.is_active == True).order_by(CategoriaProduto.nome).all()
    return [_cat_dict(c, db) for c in cats]


@router.post("/categorias")
def create_categoria(data: CategoriaCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = CategoriaProduto(**data.dict())
    db.add(c); db.commit(); db.refresh(c)
    return _cat_dict(c, db)


@router.put("/categorias/{cat_id}")
def update_categoria(cat_id: int, data: CategoriaCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(CategoriaProduto).filter(CategoriaProduto.id == cat_id).first()
    if not c:
        raise HTTPException(404, "Categoria não encontrada")
    for k, v in data.dict(exclude_unset=True).items():
        setattr(c, k, v)
    db.commit(); db.refresh(c)
    return _cat_dict(c, db)


@router.delete("/categorias/{cat_id}")
def delete_categoria(cat_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(CategoriaProduto).filter(CategoriaProduto.id == cat_id).first()
    if not c:
        raise HTTPException(404, "Categoria não encontrada")
    c.is_active = False
    db.commit()
    return {"ok": True}


# ─── Produtos ────────────────────────────────────────────────────────────────

def _ean13_check(digits12: str) -> str:
    """Calcula dígito verificador EAN-13 a partir de 12 dígitos."""
    total = sum(int(d) * (1 if i % 2 == 0 else 3) for i, d in enumerate(digits12))
    return str((10 - total % 10) % 10)

def _gerar_ean_pesavel(plu: int, prefixo: str = "20") -> str:
    """Gera EAN-13 para produto pesável: prefixo(2) + PLU(5) + zeros(5) + check(1)."""
    corpo = f"{prefixo}{str(plu).zfill(5)}00000"  # 12 dígitos
    return corpo + _ean13_check(corpo)


@router.get("/proximo-codigo")
def proximo_codigo(pesavel: bool = False, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Retorna o próximo código sequencial disponível.
    - pesavel=false: busca max código numérico geral → formata em 6 dígitos
    - pesavel=true:  busca max plu_codigo → próximo PLU (1-99999)
    """
    from sqlalchemy import text as sqlt

    if pesavel:
        # Busca o maior PLU já cadastrado
        rows = db.execute(sqlt("SELECT plu_codigo FROM produtos WHERE plu_codigo IS NOT NULL ORDER BY plu_codigo DESC LIMIT 1")).fetchall()
        ultimo_plu = rows[0][0] if rows else 0
        proximo_plu = int(ultimo_plu) + 1
        if proximo_plu > 99999:
            raise HTTPException(400, "PLU máximo atingido (99999)")
        ean = _gerar_ean_pesavel(proximo_plu)
        return {"codigo": str(proximo_plu), "plu": proximo_plu, "ean_balanca": ean}
    else:
        # Busca o maior código numérico existente (até 12 dígitos)
        all_codigos = [p.codigo for p in db.query(Produto.codigo).all() if re.fullmatch(r"\d{1,12}", p.codigo or "")]
        numeros = [int(c) for c in all_codigos]
        proximo = max(numeros) + 1 if numeros else 1
        return {"codigo": str(proximo), "plu": None, "ean_balanca": None}


@router.get("/")
def list_produtos(
    busca: Optional[str] = None,
    categoria_id: Optional[int] = None,
    estoque_baixo: Optional[bool] = None,
    is_active: Optional[bool] = True,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Produto)
    if is_active is not None:
        q = q.filter(Produto.is_active == is_active)
    if categoria_id:
        q = q.filter(Produto.categoria_id == categoria_id)
    if busca:
        like = f"%{busca}%"
        q = q.filter(
            (Produto.descricao.ilike(like)) |
            (Produto.codigo.ilike(like)) |
            (Produto.codigo_barras.ilike(like))
        )
    prods = q.order_by(Produto.descricao).all()
    if estoque_baixo:
        prods = [p for p in prods if p.estoque_atual <= p.estoque_minimo]
    return [_prod_dict(p, db) for p in prods]


@router.get("/stats")
def stats(db: Session = Depends(get_db), _=Depends(get_current_user)):
    prods = db.query(Produto).filter(Produto.is_active == True).all()
    return {
        "total": len(prods),
        "estoque_baixo": sum(1 for p in prods if p.estoque_atual <= p.estoque_minimo and p.estoque_minimo > 0),
        "valor_estoque": sum(p.estoque_atual * p.preco_custo for p in prods),
        "valor_estoque_venda": sum(p.estoque_atual * p.preco_venda for p in prods),
        "categorias": db.query(CategoriaProduto).filter(CategoriaProduto.is_active == True).count(),
    }


@router.get("/ean/{barcode}")
async def lookup_ean(barcode: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Busca dados do produto pelo EAN/barcode.
    1. Base interna.
    2. APIs externas configuradas (Cosmos Bluesoft, prioridade).
    3. Open Food Facts (fallback gratuito).
    """
    # 1 — Base interna
    p = db.query(Produto).filter(
        (Produto.codigo == barcode) | (Produto.codigo_barras == barcode)
    ).first()
    if p:
        return {
            "found": True, "source": "interno", "produto_id": p.id,
            "descricao": p.descricao, "ncm": p.ncm or "", "cest": "",
            "unidade": p.unidade, "marca": "",
            "preco_custo": p.preco_custo, "preco_venda": p.preco_venda,
            "categoria_id": p.categoria_id,
        }

    # 2 — Só busca externamente se tiver formato EAN válido
    if not re.fullmatch(r"\d{8}|\d{12}|\d{13}", barcode):
        return {"found": False}

    # 2 — APIs externas configuradas (ordenadas por prioridade)
    from routes.apis_externas import _consultar_cosmos
    apis = db.query(ApiExternaConfig).filter(ApiExternaConfig.ativo == True).order_by(ApiExternaConfig.prioridade).all()
    for api in apis:
        if api.tipo == "COSMOS":
            result = await _consultar_cosmos(api.api_key or "", barcode)
            if result:
                return result

    # 3 — Open Food Facts (fallback)
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            r = await client.get(
                f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json",
                headers={"User-Agent": "MaxxERP/2.0 (marcio@amorin.com.br)"},
            )
        data = r.json()
        if data.get("status") == 1:
            prod = data.get("product", {})
            nome = (
                prod.get("product_name_pt") or prod.get("product_name")
                or prod.get("generic_name_pt") or prod.get("generic_name") or ""
            ).strip()
            marca = prod.get("brands", "").split(",")[0].strip()
            if nome and marca and marca.lower() not in nome.lower():
                nome = f"{nome} — {marca}"
            img = (
                prod.get("image_front_url") or prod.get("image_url")
                or prod.get("image_front_small_url") or None
            )
            return {
                "found": True, "source": "openfoodfacts",
                "descricao": nome[:120], "ncm": "", "cest": "",
                "unidade": "UN", "marca": marca,
                "imagem_url": img, "produto_id": None,
            }
    except Exception:
        pass

    return {"found": False}


@router.get("/{prod_id}")
def get_produto(prod_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(Produto).filter(Produto.id == prod_id).first()
    if not p:
        raise HTTPException(404, "Produto não encontrado")
    return _prod_dict(p, db)


@router.post("/")
def create_produto(data: ProdutoCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db), _=Depends(get_current_user)):
    if db.query(Produto).filter(Produto.codigo == data.codigo).first():
        raise HTTPException(400, "Código já cadastrado")
    d = data.dict()
    if d.get("preco_custo") and not d.get("preco_venda") and d.get("margem"):
        custo = d["preco_custo"]
        margem = d["margem"] / 100
        d["preco_venda"] = round(custo / (1 - margem), 2) if margem < 1 else custo * (1 + margem)
    elif d.get("preco_custo") and d.get("preco_venda") and d["preco_venda"] > 0:
        custo = d["preco_custo"]
        venda = d["preco_venda"]
        d["margem"] = round(((venda - custo) / venda) * 100, 2)
    p = Produto(**d)
    db.add(p); db.commit(); db.refresh(p)
    # Busca imagem automaticamente em background se não tiver e tiver EAN
    if not p.imagem_url:
        barcode = p.codigo_barras or p.codigo
        if barcode and re.fullmatch(r"\d{8}|\d{12}|\d{13}", barcode):
            background_tasks.add_task(auto_buscar_imagem, p.id, barcode)
    return _prod_dict(p, db)


@router.put("/{prod_id}")
def update_produto(prod_id: int, data: ProdutoUpdate, background_tasks: BackgroundTasks, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(Produto).filter(Produto.id == prod_id).first()
    if not p:
        raise HTTPException(404, "Produto não encontrado")
    tinha_imagem = bool(p.imagem_url)
    d = data.dict(exclude_unset=True)
    for k, v in d.items():
        setattr(p, k, v)
    if p.preco_venda and p.preco_custo and p.preco_venda > 0:
        p.margem = round(((p.preco_venda - p.preco_custo) / p.preco_venda) * 100, 2)
    db.commit(); db.refresh(p)
    # Busca imagem se ainda não tem
    if not tinha_imagem and not p.imagem_url:
        barcode = p.codigo_barras or p.codigo
        if barcode and re.fullmatch(r"\d{8}|\d{12}|\d{13}", barcode):
            background_tasks.add_task(auto_buscar_imagem, p.id, barcode)
    return _prod_dict(p, db)


@router.put("/{prod_id}/preco")
def update_preco(prod_id: int, data: PrecoUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(Produto).filter(Produto.id == prod_id).first()
    if not p:
        raise HTTPException(404, "Produto não encontrado")
    if data.preco_custo is not None:
        p.preco_custo = data.preco_custo
    if data.margem is not None:
        p.margem = data.margem
    if data.preco_venda is not None and not data.recalcular_venda:
        p.preco_venda = data.preco_venda
    if data.recalcular_venda and p.preco_custo and p.margem:
        m = p.margem / 100
        p.preco_venda = round(p.preco_custo / (1 - m), 2) if m < 1 else p.preco_custo * (1 + m)
    if p.preco_venda and p.preco_custo and p.preco_venda > 0:
        p.margem = round(((p.preco_venda - p.preco_custo) / p.preco_venda) * 100, 2)
    db.commit(); db.refresh(p)
    return _prod_dict(p, db)


@router.delete("/{prod_id}")
def delete_produto(prod_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(Produto).filter(Produto.id == prod_id).first()
    if not p:
        raise HTTPException(404, "Produto não encontrado")
    p.is_active = False
    db.commit()
    return {"ok": True}


# ─── Fornecedores do Produto ─────────────────────────────────────────────────

@router.get("/{prod_id}/fornecedores")
def get_fornecedores_produto(prod_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    links = db.query(ProdutoFornecedor).filter(ProdutoFornecedor.produto_id == prod_id).all()
    return [
        {
            "fornecedor_id": l.fornecedor_id,
            "nome": l.fornecedor.fantasia or l.fornecedor.razao_social,
            "principal": l.principal,
        }
        for l in links
    ]


@router.post("/{prod_id}/fornecedores")
def add_fornecedor_produto(prod_id: int, data: FornecedorLink, db: Session = Depends(get_db), _=Depends(get_current_user)):
    forn = db.query(Fornecedor).filter(Fornecedor.id == data.fornecedor_id).first()
    if not forn:
        raise HTTPException(404, "Fornecedor não encontrado")
    if data.principal:
        for l in db.query(ProdutoFornecedor).filter(ProdutoFornecedor.produto_id == prod_id).all():
            l.principal = False
    existing = db.query(ProdutoFornecedor).filter(
        ProdutoFornecedor.produto_id == prod_id,
        ProdutoFornecedor.fornecedor_id == data.fornecedor_id,
    ).first()
    if existing:
        existing.principal = data.principal
    else:
        db.add(ProdutoFornecedor(produto_id=prod_id, fornecedor_id=data.fornecedor_id, principal=data.principal))
    db.commit()
    return {"ok": True}


@router.delete("/{prod_id}/fornecedores/{forn_id}")
def remove_fornecedor_produto(prod_id: int, forn_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    link = db.query(ProdutoFornecedor).filter(
        ProdutoFornecedor.produto_id == prod_id,
        ProdutoFornecedor.fornecedor_id == forn_id,
    ).first()
    if link:
        db.delete(link)
        db.commit()
    return {"ok": True}


@router.post("/{prod_id}/buscar-imagem")
async def buscar_imagem_produto(prod_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Busca imagem no OFF: tenta CDN direto primeiro, depois API, depois API BR."""
    p = db.query(Produto).filter(Produto.id == prod_id).first()
    if not p:
        raise HTTPException(404, "Produto não encontrado")

    barcode = p.codigo_barras or p.codigo
    if not re.fullmatch(r"\d{8}|\d{12}|\d{13}", barcode or ""):
        raise HTTPException(400, "Produto sem código EAN válido (8, 12 ou 13 dígitos)")

    _IMG_DIR.mkdir(parents=True, exist_ok=True)
    dest = _IMG_DIR / f"{prod_id}.jpg"

    # ── 1. Tenta CDN direto (mais rápido, sem depender da API)
    path = _ean_to_path(barcode)
    cdn_candidates = [
        f"https://images.openfoodfacts.org/images/products/{path}/front_pt.400.jpg",
        f"https://images.openfoodfacts.org/images/products/{path}/front.400.jpg",
        f"https://images.openfoodfacts.org/images/products/{path}/front_pt.200.jpg",
        f"https://images.openfoodfacts.org/images/products/{path}/front.200.jpg",
        f"https://images.openfoodfacts.org/images/products/{path}/1.400.jpg",
        f"https://images.openfoodfacts.org/images/products/{path}/1.200.jpg",
        f"https://images.openfoodfacts.org/images/products/{barcode}/front_pt.400.jpg",
        f"https://images.openfoodfacts.org/images/products/{barcode}/front.400.jpg",
    ]
    for url in cdn_candidates:
        if await _tentar_baixar(url, dest):
            local_url = f"/static/imagens/produtos/{prod_id}.jpg"
            p.imagem_url = local_url; db.commit()
            return {"ok": True, "imagem_url": local_url, "fonte": "CDN"}

    # ── 2. API OFF world
    for api_url in [
        f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json",
        f"https://br.openfoodfacts.org/api/v0/product/{barcode}.json",
    ]:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.get(api_url, headers={"User-Agent": "MaxxERP/2.0 (marcio@amorin.com.br)"})
            data = r.json()
            if data.get("status") == 1:
                prod_off = data.get("product", {})
                img_url = (
                    prod_off.get("image_front_url")
                    or prod_off.get("image_url")
                    or prod_off.get("image_front_small_url")
                    or prod_off.get("image_small_url")
                )
                if img_url and await _tentar_baixar(img_url, dest):
                    local_url = f"/static/imagens/produtos/{prod_id}.jpg"
                    p.imagem_url = local_url; db.commit()
                    return {"ok": True, "imagem_url": local_url, "fonte": "API OFF"}
        except Exception:
            pass

    raise HTTPException(404, f"Imagem não encontrada para EAN {barcode} no Open Food Facts")


@router.post("/{prod_id}/upload-imagem")
async def upload_imagem_produto(
    prod_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Upload manual de imagem para o produto."""
    p = db.query(Produto).filter(Produto.id == prod_id).first()
    if not p:
        raise HTTPException(404, "Produto não encontrado")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Arquivo deve ser uma imagem")

    ext_map = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}
    ext = ext_map.get(file.content_type, ".jpg")

    _IMG_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{prod_id}{ext}"
    filepath = _IMG_DIR / filename

    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)

    local_url = f"/static/imagens/produtos/{filename}"
    p.imagem_url = local_url
    db.commit()

    return {"ok": True, "imagem_url": local_url}


@router.delete("/{prod_id}/imagem")
def remover_imagem_produto(prod_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Remove a imagem do produto."""
    p = db.query(Produto).filter(Produto.id == prod_id).first()
    if not p:
        raise HTTPException(404, "Produto não encontrado")
    if p.imagem_url and p.imagem_url.startswith("/static/"):
        try:
            filepath = pathlib.Path(__file__).parent.parent / p.imagem_url.lstrip("/")
            if filepath.exists():
                filepath.unlink()
        except Exception:
            pass
    p.imagem_url = None
    db.commit()
    return {"ok": True}


@router.post("/{prod_id}/fornecedores/sync")
def sync_fornecedores_produto(prod_id: int, body: dict, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Recebe lista completa de fornecedores e sincroniza (delete + insert)."""
    links = body.get("fornecedores", [])
    db.query(ProdutoFornecedor).filter(ProdutoFornecedor.produto_id == prod_id).delete()
    for l in links:
        db.add(ProdutoFornecedor(produto_id=prod_id, fornecedor_id=l["fornecedor_id"], principal=l.get("principal", False)))
    db.commit()
    return {"ok": True}
