from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
import os

from database import get_db
from models import (
    Produto, ProgramacaoPreco, CampanhaPromocional,
    CampanhaItem, ConfigBalanca,
)

router = APIRouter(prefix="/precos", tags=["gestao_precos"])


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _get_or_create_config(db: Session) -> ConfigBalanca:
    cfg = db.query(ConfigBalanca).first()
    if not cfg:
        cfg = ConfigBalanca()
        db.add(cfg); db.commit(); db.refresh(cfg)
    return cfg


# ─── Schemas ─────────────────────────────────────────────────────────────────

class AlteracaoItem(BaseModel):
    produto_id:      int
    preco_venda:     float
    margem:          Optional[float] = None
    atacarejo_preco: Optional[float] = None

class AlteracaoLote(BaseModel):
    itens: List[AlteracaoItem]

class ProgSchema(BaseModel):
    produto_id:  int
    preco_novo:  float
    data_inicio: date
    data_fim:    Optional[date] = None
    motivo:      Optional[str]  = None

class CampanhaSchema(BaseModel):
    nome:           str
    descricao:      Optional[str]  = None
    tipo_desconto:  str            = "PERCENTUAL"
    valor_desconto: float          = 0.0
    data_inicio:    date
    data_fim:       date
    ativo:          bool           = True
    produto_ids:    List[int]      = []

class ConfigBalancaSchema(BaseModel):
    pasta_destino:         Optional[str]  = None
    nome_arquivo:          str            = "PLU.TXT"
    formato:               str            = "TOLEDO"
    separador:             str            = "|"
    incluir_codigo_barras: bool           = True
    incluir_validade:      bool           = False
    validade_dias:         int            = 30
    apenas_ativos:         bool           = True


# ═══════════════════════════════════════════════════════════════════════════════
# ALTERAÇÃO DE PREÇOS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/produtos")
def listar_produtos_precos(
    busca:       str = "",
    categoria_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Produto).filter(Produto.is_active == True)
    if busca:
        q = q.filter(
            Produto.descricao.ilike(f"%{busca}%") |
            Produto.codigo.ilike(f"%{busca}%")
        )
    if categoria_id:
        q = q.filter(Produto.categoria_id == categoria_id)
    prods = q.order_by(Produto.descricao).all()
    return [
        {
            "id":                p.id,
            "codigo":            p.codigo,
            "descricao":         p.descricao,
            "unidade":           p.unidade,
            "preco_custo":       p.preco_custo,
            "preco_venda":       p.preco_venda,
            "margem":            p.margem,
            "estoque_atual":     p.estoque_atual,
            "categoria_id":      p.categoria_id,
            "atacarejo":         getattr(p, "atacarejo", False) or False,
            "atacarejo_qtd_min": getattr(p, "atacarejo_qtd_min", 3) or 3,
            "atacarejo_preco":   getattr(p, "atacarejo_preco", 0) or 0,
        }
        for p in prods
    ]


@router.post("/alteracao-lote")
def alterar_precos_em_lote(body: AlteracaoLote, db: Session = Depends(get_db)):
    alterados = 0
    for item in body.itens:
        p = db.query(Produto).filter(Produto.id == item.produto_id).first()
        if not p:
            continue
        p.preco_venda = round(item.preco_venda, 2)
        if item.margem is not None:
            p.margem = round(item.margem, 2)
        elif p.preco_custo and p.preco_custo > 0:
            p.margem = round((p.preco_venda - p.preco_custo) / p.preco_venda * 100, 2)
        if item.atacarejo_preco is not None:
            try: setattr(p, "atacarejo_preco", round(item.atacarejo_preco, 2))
            except: pass
        alterados += 1
    db.commit()
    return {"ok": True, "alterados": alterados}


# ═══════════════════════════════════════════════════════════════════════════════
# PROGRAMAÇÃO DE PREÇOS / OFERTAS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/programacoes")
def listar_programacoes(
    status: str = "",
    db: Session = Depends(get_db),
):
    # Atualiza status automaticamente
    hoje = date.today()
    for prog in db.query(ProgramacaoPreco).filter(ProgramacaoPreco.status == "AGUARDANDO").all():
        if prog.data_inicio <= hoje:
            prog.status = "ATIVO"
            prog.produto.preco_venda = prog.preco_novo
    for prog in db.query(ProgramacaoPreco).filter(ProgramacaoPreco.status == "ATIVO").all():
        if prog.data_fim and prog.data_fim < hoje:
            prog.status = "EXPIRADO"
    db.commit()

    q = db.query(ProgramacaoPreco)
    if status:
        q = q.filter(ProgramacaoPreco.status == status)
    progs = q.order_by(ProgramacaoPreco.data_inicio.desc()).all()
    return [
        {
            "id":               p.id,
            "produto_id":       p.produto_id,
            "produto_descricao": p.produto.descricao,
            "produto_codigo":   p.produto.codigo,
            "preco_atual":      p.produto.preco_venda,
            "preco_novo":       p.preco_novo,
            "data_inicio":      p.data_inicio.isoformat(),
            "data_fim":         p.data_fim.isoformat() if p.data_fim else None,
            "motivo":           p.motivo,
            "status":           p.status,
            "criado_por":       p.criado_por,
            "created_at":       p.created_at.isoformat() if p.created_at else None,
        }
        for p in progs
    ]


@router.post("/programacoes")
def criar_programacao(body: ProgSchema, db: Session = Depends(get_db)):
    prod = db.query(Produto).filter(Produto.id == body.produto_id).first()
    if not prod:
        raise HTTPException(404, "Produto não encontrado")
    hoje = date.today()
    status = "ATIVO" if body.data_inicio <= hoje else "AGUARDANDO"
    prog = ProgramacaoPreco(
        produto_id  = body.produto_id,
        preco_novo  = body.preco_novo,
        data_inicio = body.data_inicio,
        data_fim    = body.data_fim,
        motivo      = body.motivo,
        status      = status,
    )
    if status == "ATIVO":
        prod.preco_venda = body.preco_novo
    db.add(prog); db.commit(); db.refresh(prog)
    return {"id": prog.id, "status": prog.status}


@router.delete("/programacoes/{pid}")
def cancelar_programacao(pid: int, db: Session = Depends(get_db)):
    p = db.query(ProgramacaoPreco).filter(ProgramacaoPreco.id == pid).first()
    if not p:
        raise HTTPException(404)
    p.status = "CANCELADO"
    db.commit()
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════════════════════
# CAMPANHAS PROMOCIONAIS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/campanhas")
def listar_campanhas(db: Session = Depends(get_db)):
    hoje = date.today()
    campanhas = db.query(CampanhaPromocional).order_by(CampanhaPromocional.data_inicio.desc()).all()
    result = []
    for c in campanhas:
        vigente = c.ativo and c.data_inicio <= hoje <= c.data_fim
        result.append({
            "id":             c.id,
            "nome":           c.nome,
            "descricao":      c.descricao,
            "tipo_desconto":  c.tipo_desconto,
            "valor_desconto": c.valor_desconto,
            "data_inicio":    c.data_inicio.isoformat(),
            "data_fim":       c.data_fim.isoformat(),
            "ativo":          c.ativo,
            "vigente":        vigente,
            "total_produtos": len(c.itens),
            "criado_por":     c.criado_por,
            "created_at":     c.created_at.isoformat() if c.created_at else None,
            "itens": [
                {
                    "produto_id":       i.produto_id,
                    "produto_descricao": i.produto.descricao,
                    "produto_codigo":    i.produto.codigo,
                    "preco_atual":       i.produto.preco_venda,
                    "preco_oferta":      i.preco_oferta,
                }
                for i in c.itens
            ],
        })
    return result


@router.post("/campanhas")
def criar_campanha(body: CampanhaSchema, db: Session = Depends(get_db)):
    camp = CampanhaPromocional(
        nome           = body.nome,
        descricao      = body.descricao,
        tipo_desconto  = body.tipo_desconto,
        valor_desconto = body.valor_desconto,
        data_inicio    = body.data_inicio,
        data_fim       = body.data_fim,
        ativo          = body.ativo,
    )
    db.add(camp); db.flush()
    for pid in body.produto_ids:
        prod = db.query(Produto).filter(Produto.id == pid).first()
        if not prod:
            continue
        if body.tipo_desconto == "PERCENTUAL":
            preco_oferta = round(prod.preco_venda * (1 - body.valor_desconto / 100), 2)
        elif body.tipo_desconto == "VALOR":
            preco_oferta = round(prod.preco_venda - body.valor_desconto, 2)
        else:
            preco_oferta = body.valor_desconto
        db.add(CampanhaItem(campanha_id=camp.id, produto_id=pid, preco_oferta=max(preco_oferta, 0)))
    db.commit(); db.refresh(camp)
    return {"id": camp.id}


@router.put("/campanhas/{cid}")
def atualizar_campanha(cid: int, body: CampanhaSchema, db: Session = Depends(get_db)):
    camp = db.query(CampanhaPromocional).filter(CampanhaPromocional.id == cid).first()
    if not camp:
        raise HTTPException(404)
    camp.nome           = body.nome
    camp.descricao      = body.descricao
    camp.tipo_desconto  = body.tipo_desconto
    camp.valor_desconto = body.valor_desconto
    camp.data_inicio    = body.data_inicio
    camp.data_fim       = body.data_fim
    camp.ativo          = body.ativo
    # Reprocessar itens
    for i in camp.itens:
        db.delete(i)
    db.flush()
    for pid in body.produto_ids:
        prod = db.query(Produto).filter(Produto.id == pid).first()
        if not prod:
            continue
        if body.tipo_desconto == "PERCENTUAL":
            preco_oferta = round(prod.preco_venda * (1 - body.valor_desconto / 100), 2)
        elif body.tipo_desconto == "VALOR":
            preco_oferta = round(prod.preco_venda - body.valor_desconto, 2)
        else:
            preco_oferta = body.valor_desconto
        db.add(CampanhaItem(campanha_id=camp.id, produto_id=pid, preco_oferta=max(preco_oferta, 0)))
    db.commit()
    return {"ok": True}


@router.delete("/campanhas/{cid}")
def excluir_campanha(cid: int, db: Session = Depends(get_db)):
    camp = db.query(CampanhaPromocional).filter(CampanhaPromocional.id == cid).first()
    if not camp:
        raise HTTPException(404)
    db.delete(camp); db.commit()
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════════════════════
# CARGA BALANÇAS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/balanca/config")
def get_config_balanca(db: Session = Depends(get_db)):
    cfg = _get_or_create_config(db)
    return {
        "pasta_destino":         cfg.pasta_destino,
        "nome_arquivo":          cfg.nome_arquivo,
        "formato":               cfg.formato,
        "separador":             cfg.separador,
        "incluir_codigo_barras": cfg.incluir_codigo_barras,
        "incluir_validade":      cfg.incluir_validade,
        "validade_dias":         cfg.validade_dias,
        "apenas_ativos":         cfg.apenas_ativos,
    }


@router.put("/balanca/config")
def salvar_config_balanca(body: ConfigBalancaSchema, db: Session = Depends(get_db)):
    cfg = _get_or_create_config(db)
    cfg.pasta_destino         = body.pasta_destino
    cfg.nome_arquivo          = body.nome_arquivo
    cfg.formato               = body.formato
    cfg.separador             = body.separador
    cfg.incluir_codigo_barras = body.incluir_codigo_barras
    cfg.incluir_validade      = body.incluir_validade
    cfg.validade_dias         = body.validade_dias
    cfg.apenas_ativos         = body.apenas_ativos
    db.commit()
    return {"ok": True}


@router.post("/balanca/gerar")
def gerar_arquivo_balanca(
    produto_ids: Optional[List[int]] = None,
    db: Session = Depends(get_db),
):
    cfg = _get_or_create_config(db)

    q = db.query(Produto)
    if cfg.apenas_ativos:
        q = q.filter(Produto.is_active == True)
    if produto_ids:
        q = q.filter(Produto.id.in_(produto_ids))
    else:
        # Sem filtro manual → só produtos marcados para enviar à balança
        q = q.filter(getattr(Produto, "enviar_balanca", None) == True)
    produtos = q.order_by(Produto.codigo).all()

    linhas = []
    for idx, p in enumerate(produtos, start=1):
        # PLU: usa plu_codigo do produto se disponível, senão usa índice sequencial
        plu_raw = getattr(p, "plu_codigo", None) or idx
        plu   = str(plu_raw).zfill(4)
        desc  = p.descricao[:28].upper().ljust(28)
        preco = f"{p.preco_venda:.2f}".replace(".", ",")
        cb    = p.codigo_barras or p.codigo

        if cfg.formato == "TOLEDO":
            # Formato Toledo Prix padrão: plu|descricao|preco|validade|tara|secao
            val = str(cfg.validade_dias) if cfg.incluir_validade else "0"
            linha = f"{plu}|{desc}|{preco}|{val}|0000|01"
        elif cfg.formato == "FILIZOLA":
            # Formato Filizola: codigo;descricao;preco;validade
            val = str(cfg.validade_dias) if cfg.incluir_validade else "0"
            codigo = p.codigo_barras if cfg.incluir_codigo_barras and p.codigo_barras else p.codigo
            linha = f"{codigo};{desc.strip()};{preco};{val}"
        else:
            # CSV genérico
            sep = cfg.separador
            parts = [plu, desc.strip(), preco]
            if cfg.incluir_codigo_barras:
                parts.insert(1, cb)
            if cfg.incluir_validade:
                parts.append(str(cfg.validade_dias))
            linha = sep.join(parts)

        linhas.append(linha)

    conteudo = "\r\n".join(linhas) + "\r\n"

    # Salvar no disco se pasta configurada
    caminho_arquivo = None
    erro_disco = None
    if cfg.pasta_destino:
        try:
            os.makedirs(cfg.pasta_destino, exist_ok=True)
            caminho_arquivo = os.path.join(cfg.pasta_destino, cfg.nome_arquivo)
            with open(caminho_arquivo, "w", encoding="latin-1") as f:
                f.write(conteudo)
        except Exception as e:
            erro_disco = str(e)

    return {
        "ok":              True,
        "total_produtos":  len(produtos),
        "caminho_arquivo": caminho_arquivo,
        "erro_disco":      erro_disco,
        "preview":         linhas[:5],  # primeiras 5 linhas para preview
        "conteudo":        conteudo,    # conteúdo completo para download no browser
    }
