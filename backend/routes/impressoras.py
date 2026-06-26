from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import ConfigImpressora
from utils.security import get_current_user

router = APIRouter(prefix="/config/impressoras", tags=["impressoras"])


def _serialize(cfg: ConfigImpressora) -> dict:
    return {
        "id":                  cfg.id,
        "impressora_termica":  cfg.impressora_termica,
        "impressora_nfe":      cfg.impressora_nfe,
        "impressora_etiqueta": cfg.impressora_etiqueta,
        "largura_etiqueta_mm": cfg.largura_etiqueta_mm,
        "altura_etiqueta_mm":  cfg.altura_etiqueta_mm,
    }


@router.get("/")
def get_config(db: Session = Depends(get_db), _=Depends(get_current_user)):
    cfg = db.query(ConfigImpressora).first()
    if not cfg:
        cfg = ConfigImpressora()
        db.add(cfg); db.commit(); db.refresh(cfg)
    return _serialize(cfg)


@router.put("/")
def update_config(body: dict, db: Session = Depends(get_db), _=Depends(get_current_user)):
    cfg = db.query(ConfigImpressora).first()
    if not cfg:
        cfg = ConfigImpressora()
        db.add(cfg)
    campos = ["impressora_termica", "impressora_nfe", "impressora_etiqueta",
              "largura_etiqueta_mm", "altura_etiqueta_mm"]
    for k in campos:
        if k in body:
            setattr(cfg, k, body[k])
    db.commit(); db.refresh(cfg)
    return _serialize(cfg)
