from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from database import get_db
from models import ConfigEmpresa, TabelaImposto, Produto

router = APIRouter(prefix="/fiscal", tags=["fiscal"])

# ─── Alíquotas padrão por regime ─────────────────────────────────────────────
DEFAULTS = {
    "SIMPLES_NACIONAL": {
        "icms_aliquota": 0.0, "pis_aliquota": 0.0, "cofins_aliquota": 0.0,
        "csll_aliquota": 0.0, "irpj_aliquota": 0.0,
        "cfop_padrao": "5102", "cst_icms": "400", "csosn": "400",
        "nome": "Simples Nacional — Padrão",
    },
    "LUCRO_PRESUMIDO": {
        "icms_aliquota": 12.0, "pis_aliquota": 0.65, "cofins_aliquota": 3.0,
        "csll_aliquota": 9.0, "irpj_aliquota": 15.0,
        "cfop_padrao": "5102", "cst_icms": "000", "csosn": "400",
        "nome": "Lucro Presumido — Padrão",
    },
    "LUCRO_REAL": {
        "icms_aliquota": 12.0, "pis_aliquota": 1.65, "cofins_aliquota": 7.6,
        "csll_aliquota": 9.0, "irpj_aliquota": 15.0,
        "cfop_padrao": "5102", "cst_icms": "000", "csosn": "400",
        "nome": "Lucro Real — Padrão",
    },
}

CFOPS_SAIDA = [
    {"codigo": "5102", "desc": "Venda merc. adquirida 3°s — Estado"},
    {"codigo": "5405", "desc": "Venda merc. ST — Estado"},
    {"codigo": "5903", "desc": "Retorno de mercadoria"},
    {"codigo": "6102", "desc": "Venda merc. adquirida 3°s — Interestadual"},
    {"codigo": "6404", "desc": "Venda merc. ST — Interestadual"},
]
CST_ICMS = [
    {"cst": "000", "desc": "Tributada integralmente"},
    {"cst": "010", "desc": "Tributada com cobrança ST"},
    {"cst": "020", "desc": "Com redução de base de cálculo"},
    {"cst": "040", "desc": "Isenta"},
    {"cst": "041", "desc": "Não tributada"},
    {"cst": "060", "desc": "ICMS cobrado anteriormente por ST"},
    {"cst": "070", "desc": "Com redução BC e cobrança ST"},
    {"cst": "090", "desc": "Outras"},
]
CSOSN = [
    {"csosn": "101", "desc": "Tributada pelo SN com crédito"},
    {"csosn": "102", "desc": "Tributada pelo SN sem crédito"},
    {"csosn": "300", "desc": "Imune"},
    {"csosn": "400", "desc": "Não tributada pelo SN"},
    {"csosn": "500", "desc": "ICMS cobrado anteriormente por ST"},
    {"csosn": "900", "desc": "Outros"},
]


# ─── Schemas ─────────────────────────────────────────────────────────────────

class EmpresaSchema(BaseModel):
    razao_social:      str            = ""
    nome_fantasia:     str            = ""
    cnpj:              str            = ""
    ie:                str            = ""
    im:                str            = ""
    endereco:          str            = ""
    numero:            str            = ""
    complemento:       str            = ""
    bairro:            str            = ""
    cidade:            str            = ""
    estado:            str            = "SC"
    cep:               str            = ""
    telefone:          str            = ""
    email:             str            = ""
    cnae:              str            = ""
    regime_tributario: str            = "SIMPLES_NACIONAL"
    aliquota_simples:  float          = 6.0


class ImpostoSchema(BaseModel):
    regime:          str
    nome:            str
    icms_aliquota:   float = 0.0
    pis_aliquota:    float = 0.0
    cofins_aliquota: float = 0.0
    csll_aliquota:   float = 0.0
    irpj_aliquota:   float = 0.0
    cfop_padrao:     str   = "5102"
    cst_icms:        str   = "000"
    csosn:           str   = "400"
    is_default:      bool  = False


class ProdutoFiscalSchema(BaseModel):
    ncm:             Optional[str]   = None
    cest:            Optional[str]   = None
    cfop_saida:      Optional[str]   = "5102"
    cst_icms:        Optional[str]   = "000"
    csosn:           Optional[str]   = "400"
    icms_aliquota:   Optional[float] = 0.0
    pis_aliquota:    Optional[float] = 0.0
    cofins_aliquota: Optional[float] = 0.0


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _get_empresa(db: Session) -> ConfigEmpresa:
    emp = db.query(ConfigEmpresa).first()
    if not emp:
        emp = ConfigEmpresa()
        db.add(emp); db.commit(); db.refresh(emp)
    return emp


def _empresa_dict(e: ConfigEmpresa) -> dict:
    return {
        "id": e.id, "razao_social": e.razao_social, "nome_fantasia": e.nome_fantasia,
        "cnpj": e.cnpj, "ie": e.ie, "im": e.im,
        "endereco": e.endereco, "numero": e.numero, "complemento": e.complemento,
        "bairro": e.bairro, "cidade": e.cidade, "estado": e.estado, "cep": e.cep,
        "telefone": e.telefone, "email": e.email, "cnae": e.cnae,
        "regime_tributario": e.regime_tributario, "aliquota_simples": e.aliquota_simples,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# EMPRESA
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/empresa")
def get_empresa(db: Session = Depends(get_db)):
    return _empresa_dict(_get_empresa(db))


# ═══════════════════════════════════════════════════════════════════════════════
# TABELA DE IMPOSTOS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/impostos")
def listar_impostos(regime: str = "", db: Session = Depends(get_db)):
    q = db.query(TabelaImposto)
    if regime:
        q = q.filter(TabelaImposto.regime == regime)
    return [_imp_dict(i) for i in q.order_by(TabelaImposto.regime, TabelaImposto.nome).all()]


@router.post("/impostos")
def criar_imposto(body: ImpostoSchema, db: Session = Depends(get_db)):
    if body.is_default:
        db.query(TabelaImposto).filter(TabelaImposto.regime == body.regime).update({"is_default": False})
    imp = TabelaImposto(**body.dict())
    db.add(imp); db.commit(); db.refresh(imp)
    return _imp_dict(imp)


@router.put("/impostos/{iid}")
def atualizar_imposto(iid: int, body: ImpostoSchema, db: Session = Depends(get_db)):
    imp = db.query(TabelaImposto).filter(TabelaImposto.id == iid).first()
    if not imp:
        raise HTTPException(404)
    if body.is_default:
        db.query(TabelaImposto).filter(TabelaImposto.regime == body.regime, TabelaImposto.id != iid).update({"is_default": False})
    for k, v in body.dict().items():
        setattr(imp, k, v)
    db.commit()
    return _imp_dict(imp)


@router.delete("/impostos/{iid}")
def excluir_imposto(iid: int, db: Session = Depends(get_db)):
    imp = db.query(TabelaImposto).filter(TabelaImposto.id == iid).first()
    if not imp:
        raise HTTPException(404)
    db.delete(imp); db.commit()
    return {"ok": True}


@router.get("/regime-padrao")
def regime_padrao(db: Session = Depends(get_db)):
    """Retorna alíquotas padrão do regime atual da empresa."""
    emp = _get_empresa(db)
    regime = emp.regime_tributario
    # Tenta buscar configuração customizada padrão
    imp = db.query(TabelaImposto).filter(
        TabelaImposto.regime == regime,
        TabelaImposto.is_default == True,
    ).first()
    if imp:
        data = _imp_dict(imp)
    else:
        data = {**DEFAULTS.get(regime, DEFAULTS["SIMPLES_NACIONAL"]), "id": None}
    data["regime"] = regime
    data["aliquota_simples"] = emp.aliquota_simples
    data["cfops"] = CFOPS_SAIDA
    data["csts_icms"] = CST_ICMS
    data["csosns"] = CSOSN
    return data


# ═══════════════════════════════════════════════════════════════════════════════
# PRODUTO — DADOS FISCAIS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/produto/{pid}")
def get_produto_fiscal(pid: int, db: Session = Depends(get_db)):
    p = db.query(Produto).filter(Produto.id == pid).first()
    if not p:
        raise HTTPException(404)
    return {
        "produto_id":      p.id,
        "ncm":             p.ncm,
        "cest":            getattr(p, "cest", None),
        "cfop_saida":      getattr(p, "cfop_saida", "5102"),
        "cst_icms":        getattr(p, "cst_icms", "000"),
        "csosn":           getattr(p, "csosn", "400"),
        "icms_aliquota":   getattr(p, "icms_aliquota", 0.0),
        "pis_aliquota":    getattr(p, "pis_aliquota", 0.0),
        "cofins_aliquota": getattr(p, "cofins_aliquota", 0.0),
    }


@router.put("/produto/{pid}")
def salvar_produto_fiscal(pid: int, body: ProdutoFiscalSchema, db: Session = Depends(get_db)):
    p = db.query(Produto).filter(Produto.id == pid).first()
    if not p:
        raise HTTPException(404)
    if body.ncm is not None:
        p.ncm = body.ncm
    for field in ["cest", "cfop_saida", "cst_icms", "csosn", "icms_aliquota", "pis_aliquota", "cofins_aliquota"]:
        val = getattr(body, field, None)
        if val is not None:
            try:
                setattr(p, field, val)
            except Exception:
                pass
    db.commit()
    return {"ok": True}


def _imp_dict(i: TabelaImposto) -> dict:
    return {
        "id": i.id, "regime": i.regime, "nome": i.nome,
        "icms_aliquota": i.icms_aliquota, "pis_aliquota": i.pis_aliquota,
        "cofins_aliquota": i.cofins_aliquota, "csll_aliquota": i.csll_aliquota,
        "irpj_aliquota": i.irpj_aliquota, "cfop_padrao": i.cfop_padrao,
        "cst_icms": i.cst_icms, "csosn": i.csosn, "is_default": i.is_default,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# APLICAR REGIME / IMPOSTO EM MASSA NOS PRODUTOS
# ═══════════════════════════════════════════════════════════════════════════════

def _aplicar_tabela_produtos(db: Session, tabela: dict, apenas_sem_ncm: bool = False) -> int:
    """Aplica alíquotas de uma tabela de impostos em todos os produtos ativos."""
    q = db.query(Produto).filter(Produto.is_active == True)
    if apenas_sem_ncm:
        q = q.filter((Produto.ncm == None) | (Produto.ncm == ""))
    produtos = q.all()
    for p in produtos:
        p.cfop_saida      = tabela.get("cfop_padrao", "5102")
        p.cst_icms        = tabela.get("cst_icms", "000")
        p.csosn           = tabela.get("csosn", "400")
        p.icms_aliquota   = tabela.get("icms_aliquota", 0.0)
        p.pis_aliquota    = tabela.get("pis_aliquota", 0.0)
        p.cofins_aliquota = tabela.get("cofins_aliquota", 0.0)
    db.commit()
    return len(produtos)


@router.post("/aplicar-regime")
def aplicar_regime_produtos(body: dict = {}, db: Session = Depends(get_db)):
    """Aplica a tabela padrão do regime atual da empresa em todos os produtos."""
    emp    = _get_empresa(db)
    regime = body.get("regime") or emp.regime_tributario

    # Busca a tabela padrão do regime (customizada ou defaults embutidos)
    imp = db.query(TabelaImposto).filter(
        TabelaImposto.regime == regime,
        TabelaImposto.is_default == True,
    ).first()
    tabela = _imp_dict(imp) if imp else {**DEFAULTS.get(regime, DEFAULTS["SIMPLES_NACIONAL"])}

    apenas_sem_ncm = body.get("apenas_sem_ncm", False)
    total = _aplicar_tabela_produtos(db, tabela, apenas_sem_ncm)
    return {"ok": True, "regime": regime, "produtos_atualizados": total, "tabela": tabela}


@router.post("/aplicar-imposto/{iid}")
def aplicar_imposto_produtos(iid: int, body: dict = {}, db: Session = Depends(get_db)):
    """Aplica uma tabela de imposto específica em todos os produtos ativos."""
    imp = db.query(TabelaImposto).filter(TabelaImposto.id == iid).first()
    if not imp:
        raise HTTPException(404, "Tabela não encontrada")
    apenas_sem_ncm = body.get("apenas_sem_ncm", False)
    total = _aplicar_tabela_produtos(db, _imp_dict(imp), apenas_sem_ncm)
    return {"ok": True, "tabela": imp.nome, "produtos_atualizados": total}


@router.put("/empresa")
def salvar_empresa_com_regime(body: EmpresaSchema, db: Session = Depends(get_db)):
    emp = _get_empresa(db)
    regime_anterior = emp.regime_tributario
    for k, v in body.dict().items():
        setattr(emp, k, v)
    db.commit()

    regime_novo = emp.regime_tributario
    produtos_atualizados = 0
    if regime_novo != regime_anterior:
        # Regime mudou → aplica novo padrão em todos os produtos automaticamente
        imp = db.query(TabelaImposto).filter(
            TabelaImposto.regime == regime_novo,
            TabelaImposto.is_default == True,
        ).first()
        tabela = _imp_dict(imp) if imp else {**DEFAULTS.get(regime_novo, DEFAULTS["SIMPLES_NACIONAL"])}
        produtos_atualizados = _aplicar_tabela_produtos(db, tabela)

    return {**_empresa_dict(emp), "regime_anterior": regime_anterior, "produtos_atualizados": produtos_atualizados}


@router.get("/ncm/{ncm}")
def buscar_ncm(ncm: str, db: Session = Depends(get_db)):
    """Busca descrição do NCM via BrasilAPI e retorna alíquotas sugeridas pelo regime atual."""
    import urllib.request, json as _json
    ncm_digits = ncm.replace(".", "").replace("-", "").strip()
    result = {"ncm": ncm_digits, "descricao": None, "ibpt": None, "erro": None}
    try:
        url = f"https://brasilapi.com.br/api/ncm/v1/{ncm_digits}"
        req = urllib.request.Request(url, headers={"User-Agent": "MaxxERP/1.0"})
        with urllib.request.urlopen(req, timeout=5) as r:
            data = _json.loads(r.read())
            result["descricao"]    = data.get("descricao")
            result["tipo"]         = data.get("tipo")
            result["data_inicio"]  = data.get("data_inicio")
            result["data_fim"]     = data.get("data_fim")
    except Exception as e:
        result["erro"] = f"NCM não encontrado ou serviço indisponível: {str(e)[:60]}"

    # Alíquotas sugeridas pelo regime da empresa
    emp    = _get_empresa(db)
    regime = emp.regime_tributario
    imp    = db.query(TabelaImposto).filter(
        TabelaImposto.regime == regime, TabelaImposto.is_default == True
    ).first()
    tabela = _imp_dict(imp) if imp else DEFAULTS.get(regime, DEFAULTS["SIMPLES_NACIONAL"])
    result["aliquotas_sugeridas"] = {
        "regime":          regime,
        "cfop_saida":      tabela.get("cfop_padrao", "5102"),
        "cst_icms":        tabela.get("cst_icms", "000"),
        "csosn":           tabela.get("csosn", "400"),
        "icms_aliquota":   tabela.get("icms_aliquota", 0.0),
        "pis_aliquota":    tabela.get("pis_aliquota", 0.0),
        "cofins_aliquota": tabela.get("cofins_aliquota", 0.0),
    }
    return result
