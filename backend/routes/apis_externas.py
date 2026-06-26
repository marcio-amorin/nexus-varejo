from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import ApiExternaConfig
from utils.security import get_current_user
from pydantic import BaseModel
from typing import Optional
import httpx

router = APIRouter(prefix="/apis-externas", tags=["apis_externas"])

TIPOS_SUPORTADOS = {
    "COSMOS":    {"nome": "Cosmos Bluesoft",       "url": "https://api.cosmos.bluesoft.com.br"},
    "SINTEGRA":  {"nome": "Sintegra / SEFAZ",      "url": "https://api.sintegra.com"},
    "CUSTOM":    {"nome": "API Customizada",        "url": ""},
}

class ApiCreate(BaseModel):
    nome:       str
    tipo:       str = "COSMOS"
    api_key:    Optional[str] = None
    url_custom: Optional[str] = None
    ativo:      bool = True
    prioridade: int = 1

class ApiUpdate(BaseModel):
    nome:       Optional[str] = None
    tipo:       Optional[str] = None
    api_key:    Optional[str] = None
    url_custom: Optional[str] = None
    ativo:      Optional[bool] = None
    prioridade: Optional[int] = None


def _to_dict(a: ApiExternaConfig) -> dict:
    key = a.api_key or ""
    # mascara a chave — exibe só os últimos 6 caracteres
    masked = ("*" * max(0, len(key) - 6)) + key[-6:] if len(key) > 6 else "***"
    return {
        "id": a.id, "nome": a.nome, "tipo": a.tipo,
        "api_key_masked": masked,
        "url_custom": a.url_custom,
        "ativo": a.ativo,
        "prioridade": a.prioridade,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "tipo_info": TIPOS_SUPORTADOS.get(a.tipo, {}),
    }


@router.get("/tipos")
def get_tipos(_=Depends(get_current_user)):
    return TIPOS_SUPORTADOS


@router.get("/")
def list_apis(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return [_to_dict(a) for a in db.query(ApiExternaConfig).order_by(ApiExternaConfig.prioridade).all()]


@router.post("/")
def create_api(body: ApiCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    obj = ApiExternaConfig(**body.dict())
    db.add(obj); db.commit(); db.refresh(obj)
    return _to_dict(obj)


@router.put("/{api_id}")
def update_api(api_id: int, body: ApiUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    obj = db.query(ApiExternaConfig).filter(ApiExternaConfig.id == api_id).first()
    if not obj: raise HTTPException(404)
    for k, v in body.dict(exclude_none=True).items():
        setattr(obj, k, v)
    db.commit(); db.refresh(obj)
    return _to_dict(obj)


@router.delete("/{api_id}")
def delete_api(api_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    obj = db.query(ApiExternaConfig).filter(ApiExternaConfig.id == api_id).first()
    if not obj: raise HTTPException(404)
    db.delete(obj); db.commit()
    return {"ok": True}


@router.post("/{api_id}/testar")
async def testar_api(api_id: int, ean: str = "7891910000197",
                     db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Testa a conexão com um EAN de exemplo."""
    obj = db.query(ApiExternaConfig).filter(ApiExternaConfig.id == api_id).first()
    if not obj: raise HTTPException(404)

    result = await _consultar_cosmos(obj.api_key or "", ean)
    if result:
        return {"ok": True, "dados": result}
    return {"ok": False, "erro": "Produto não encontrado ou API com erro"}


# ─── Helper reutilizado pelo route de produtos ───────────────────────────────

async def _consultar_cosmos(api_key: str, ean: str) -> Optional[dict]:
    """Consulta Cosmos Bluesoft. Retorna dict com dados ou None."""
    if not api_key:
        return None
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            r = await client.get(
                f"https://api.cosmos.bluesoft.com.br/gtins/{ean}",
                headers={
                    "X-Cosmos-Token": api_key,
                    "User-Agent": "MaxxERP/2.0",
                    "Content-Type": "application/json",
                },
            )
        if r.status_code == 404:
            return None
        if r.status_code != 200:
            return None
        d = r.json()
        ncm_code = ""
        if isinstance(d.get("ncm"), dict):
            ncm_code = d["ncm"].get("code", "") or d["ncm"].get("ex", "") or ""
        elif isinstance(d.get("ncm"), str):
            ncm_code = d["ncm"]

        cest = ""
        if isinstance(d.get("cest"), dict):
            cest = d["cest"].get("code", "") or ""

        brand = ""
        if isinstance(d.get("brand"), dict):
            brand = d["brand"].get("name", "") or ""
        elif isinstance(d.get("brand"), str):
            brand = d["brand"]

        descricao = (d.get("description") or d.get("name") or "").strip()
        if descricao and brand and brand.lower() not in descricao.lower():
            descricao = f"{descricao} — {brand}"

        return {
            "found": True,
            "source": "cosmos",
            "descricao": descricao[:150],
            "ncm": ncm_code,
            "cest": cest,
            "marca": brand,
            "avg_price": d.get("avg_price"),
            "imagem_url": d.get("thumbnail") or d.get("image") or None,
            "produto_id": None,
            "raw": d,
        }
    except Exception:
        return None
