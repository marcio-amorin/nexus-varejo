"""Rota unificada para todas as campanhas: Preço, Clube, Atacarejo, Forma de Pagamento."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import date
from database import get_db
from models import (
    CampanhaPromocional, CampanhaItem,
    CampanhaClube, ItemCampanhaClube,
    CampanhaAtacarejo, ItemCampanhaAtacarejo,
    CampanhaFormaPagamento,
    Produto, CategoriaProduto, FormaRecebimento,
)

router = APIRouter(prefix="/campanhas-v2", tags=["campanhas-v2"])

hoje = lambda: date.today()


# ─── helpers ─────────────────────────────────────────────────────────────────

def _vigente(c: any) -> bool:
    if not getattr(c, 'ativo', True):
        return False
    h = hoje()
    ini = getattr(c, 'data_inicio', None)
    fim = getattr(c, 'data_fim', None)
    if ini and h < ini:
        return False
    if fim and h > fim:
        return False
    return True


# ══════════════════════════════════════════════════════════════════════════════
# CAMPANHAS DE PREÇO (existente)
# ══════════════════════════════════════════════════════════════════════════════

class PrecoBody(BaseModel):
    nome:          str
    descricao:     str  = ""
    tipo_desconto: str  = "PERCENTUAL"
    valor_desconto: float = 0.0
    data_inicio:   date
    data_fim:      date
    ativo:         bool = True
    produto_ids:   List[int] = []


@router.get("/preco")
def listar_preco(db: Session = Depends(get_db)):
    campanhas = db.query(CampanhaPromocional).order_by(CampanhaPromocional.id.desc()).all()
    resultado = []
    for c in campanhas:
        itens = []
        for i in c.itens:
            p = i.produto
            if not p:
                continue
            po = i.preco_oferta or _calc_oferta(p.preco_venda, c.tipo_desconto, c.valor_desconto)
            itens.append({
                "produto_id": p.id, "produto_codigo": p.codigo,
                "produto_descricao": p.descricao,
                "preco_atual": p.preco_venda, "preco_oferta": po,
            })
        resultado.append({
            "id": c.id, "nome": c.nome, "descricao": c.descricao,
            "tipo_desconto": c.tipo_desconto, "valor_desconto": c.valor_desconto,
            "data_inicio": str(c.data_inicio), "data_fim": str(c.data_fim),
            "ativo": c.ativo, "vigente": _vigente(c),
            "total_produtos": len(itens), "itens": itens,
        })
    return resultado


def _calc_oferta(pv: float, tipo: str, val: float) -> float:
    if tipo == "PERCENTUAL":  return max(pv * (1 - val / 100), 0)
    if tipo == "VALOR":       return max(pv - val, 0)
    return val


@router.post("/preco")
def criar_preco(body: PrecoBody, db: Session = Depends(get_db)):
    c = CampanhaPromocional(
        nome=body.nome, descricao=body.descricao,
        tipo_desconto=body.tipo_desconto, valor_desconto=body.valor_desconto,
        data_inicio=body.data_inicio, data_fim=body.data_fim, ativo=body.ativo,
    )
    db.add(c); db.flush()
    for pid in body.produto_ids:
        p = db.query(Produto).filter(Produto.id == pid).first()
        if p:
            po = _calc_oferta(p.preco_venda, body.tipo_desconto, body.valor_desconto)
            db.add(CampanhaItem(campanha_id=c.id, produto_id=pid, preco_oferta=po))
    db.commit(); db.refresh(c)
    return {"ok": True, "id": c.id}


@router.put("/preco/{cid}")
def atualizar_preco(cid: int, body: PrecoBody, db: Session = Depends(get_db)):
    c = db.query(CampanhaPromocional).filter(CampanhaPromocional.id == cid).first()
    if not c:
        raise HTTPException(404, "Não encontrada")
    c.nome = body.nome; c.descricao = body.descricao
    c.tipo_desconto = body.tipo_desconto; c.valor_desconto = body.valor_desconto
    c.data_inicio = body.data_inicio; c.data_fim = body.data_fim; c.ativo = body.ativo
    db.query(CampanhaItem).filter(CampanhaItem.campanha_id == cid).delete()
    for pid in body.produto_ids:
        p = db.query(Produto).filter(Produto.id == pid).first()
        if p:
            po = _calc_oferta(p.preco_venda, body.tipo_desconto, body.valor_desconto)
            db.add(CampanhaItem(campanha_id=cid, produto_id=pid, preco_oferta=po))
    db.commit()
    return {"ok": True}


@router.delete("/preco/{cid}")
def excluir_preco(cid: int, db: Session = Depends(get_db)):
    c = db.query(CampanhaPromocional).filter(CampanhaPromocional.id == cid).first()
    if not c:
        raise HTTPException(404, "Não encontrada")
    db.delete(c); db.commit()
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════════════════
# CLUBE DE PROMOÇÃO
# ══════════════════════════════════════════════════════════════════════════════

class ClubeBody(BaseModel):
    nome:          str
    descricao:     str   = ""
    tipo_desconto: str   = "PERCENTUAL"
    valor_desconto: float = 0.0
    data_inicio:   Optional[date] = None
    data_fim:      Optional[date] = None
    ativo:         bool  = True
    produto_ids:   List[int] = []


@router.get("/clube")
def listar_clube(db: Session = Depends(get_db)):
    campanhas = db.query(CampanhaClube).order_by(CampanhaClube.id.desc()).all()
    resultado = []
    for c in campanhas:
        itens = []
        for i in c.itens:
            p = i.produto
            if not p:
                continue
            po = i.preco_clube or _calc_oferta(p.preco_venda, c.tipo_desconto, c.valor_desconto)
            itens.append({
                "produto_id": p.id, "produto_codigo": p.codigo,
                "produto_descricao": p.descricao,
                "preco_normal": p.preco_venda, "preco_clube": po,
            })
        resultado.append({
            "id": c.id, "nome": c.nome, "descricao": c.descricao,
            "tipo_desconto": c.tipo_desconto, "valor_desconto": c.valor_desconto,
            "data_inicio": str(c.data_inicio) if c.data_inicio else None,
            "data_fim": str(c.data_fim) if c.data_fim else None,
            "ativo": c.ativo, "vigente": _vigente(c),
            "total_produtos": len(itens), "itens": itens,
        })
    return resultado


@router.post("/clube")
def criar_clube(body: ClubeBody, db: Session = Depends(get_db)):
    c = CampanhaClube(
        nome=body.nome, descricao=body.descricao,
        tipo_desconto=body.tipo_desconto, valor_desconto=body.valor_desconto,
        data_inicio=body.data_inicio, data_fim=body.data_fim, ativo=body.ativo,
    )
    db.add(c); db.flush()
    for pid in body.produto_ids:
        p = db.query(Produto).filter(Produto.id == pid).first()
        if p:
            po = _calc_oferta(p.preco_venda, body.tipo_desconto, body.valor_desconto)
            db.add(ItemCampanhaClube(campanha_id=c.id, produto_id=pid, preco_clube=po))
    db.commit(); db.refresh(c)
    return {"ok": True, "id": c.id}


@router.put("/clube/{cid}")
def atualizar_clube(cid: int, body: ClubeBody, db: Session = Depends(get_db)):
    c = db.query(CampanhaClube).filter(CampanhaClube.id == cid).first()
    if not c:
        raise HTTPException(404, "Não encontrada")
    c.nome = body.nome; c.descricao = body.descricao
    c.tipo_desconto = body.tipo_desconto; c.valor_desconto = body.valor_desconto
    c.data_inicio = body.data_inicio; c.data_fim = body.data_fim; c.ativo = body.ativo
    db.query(ItemCampanhaClube).filter(ItemCampanhaClube.campanha_id == cid).delete()
    for pid in body.produto_ids:
        p = db.query(Produto).filter(Produto.id == pid).first()
        if p:
            po = _calc_oferta(p.preco_venda, body.tipo_desconto, body.valor_desconto)
            db.add(ItemCampanhaClube(campanha_id=cid, produto_id=pid, preco_clube=po))
    db.commit()
    return {"ok": True}


@router.delete("/clube/{cid}")
def excluir_clube(cid: int, db: Session = Depends(get_db)):
    c = db.query(CampanhaClube).filter(CampanhaClube.id == cid).first()
    if not c:
        raise HTTPException(404, "Não encontrada")
    db.delete(c); db.commit()
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════════════════
# CAMPANHA ATACAREJO
# ══════════════════════════════════════════════════════════════════════════════

class ItemAtacBody(BaseModel):
    tipo:            str           # PRODUTO | CATEGORIA
    produto_id:      Optional[int] = None
    categoria_id:    Optional[int] = None
    qtd_minima:      float         = 3.0
    preco_atacarejo: Optional[float] = None
    pct_desconto:    Optional[float] = None


class AtacarejoBody(BaseModel):
    nome:        str
    descricao:   str  = ""
    ativo:       bool = True
    data_inicio: Optional[date] = None
    data_fim:    Optional[date] = None
    itens:       List[ItemAtacBody] = []


@router.get("/atacarejo")
def listar_atacarejo(db: Session = Depends(get_db)):
    campanhas = db.query(CampanhaAtacarejo).order_by(CampanhaAtacarejo.id.desc()).all()
    resultado = []
    for c in campanhas:
        itens = []
        for i in c.itens:
            entry: dict = {
                "id": i.id, "tipo": i.tipo,
                "qtd_minima": i.qtd_minima,
                "preco_atacarejo": i.preco_atacarejo,
                "pct_desconto": i.pct_desconto,
            }
            if i.tipo == "PRODUTO" and i.produto:
                entry.update({
                    "produto_id": i.produto_id,
                    "nome": i.produto.descricao,
                    "codigo": i.produto.codigo,
                    "preco_normal": i.produto.preco_venda,
                    "preco_atk_efetivo": i.preco_atacarejo or (
                        i.produto.preco_venda * (1 - (i.pct_desconto or 0) / 100)
                    ),
                })
            elif i.tipo == "CATEGORIA" and i.categoria:
                entry.update({
                    "categoria_id": i.categoria_id,
                    "nome": i.categoria.nome,
                    "icone": i.categoria.icone,
                })
            itens.append(entry)
        resultado.append({
            "id": c.id, "nome": c.nome, "descricao": c.descricao,
            "ativo": c.ativo, "vigente": _vigente(c),
            "data_inicio": str(c.data_inicio) if c.data_inicio else None,
            "data_fim": str(c.data_fim) if c.data_fim else None,
            "itens": itens,
        })
    return resultado


@router.post("/atacarejo")
def criar_atacarejo(body: AtacarejoBody, db: Session = Depends(get_db)):
    c = CampanhaAtacarejo(
        nome=body.nome, descricao=body.descricao,
        ativo=body.ativo, data_inicio=body.data_inicio, data_fim=body.data_fim,
    )
    db.add(c); db.flush()
    for it in body.itens:
        db.add(ItemCampanhaAtacarejo(
            campanha_id=c.id, tipo=it.tipo,
            produto_id=it.produto_id, categoria_id=it.categoria_id,
            qtd_minima=it.qtd_minima,
            preco_atacarejo=it.preco_atacarejo, pct_desconto=it.pct_desconto,
        ))
    db.commit(); db.refresh(c)
    return {"ok": True, "id": c.id}


@router.put("/atacarejo/{cid}")
def atualizar_atacarejo(cid: int, body: AtacarejoBody, db: Session = Depends(get_db)):
    c = db.query(CampanhaAtacarejo).filter(CampanhaAtacarejo.id == cid).first()
    if not c:
        raise HTTPException(404, "Não encontrada")
    c.nome = body.nome; c.descricao = body.descricao
    c.ativo = body.ativo; c.data_inicio = body.data_inicio; c.data_fim = body.data_fim
    db.query(ItemCampanhaAtacarejo).filter(ItemCampanhaAtacarejo.campanha_id == cid).delete()
    for it in body.itens:
        db.add(ItemCampanhaAtacarejo(
            campanha_id=cid, tipo=it.tipo,
            produto_id=it.produto_id, categoria_id=it.categoria_id,
            qtd_minima=it.qtd_minima,
            preco_atacarejo=it.preco_atacarejo, pct_desconto=it.pct_desconto,
        ))
    db.commit()
    return {"ok": True}


@router.delete("/atacarejo/{cid}")
def excluir_atacarejo(cid: int, db: Session = Depends(get_db)):
    c = db.query(CampanhaAtacarejo).filter(CampanhaAtacarejo.id == cid).first()
    if not c:
        raise HTTPException(404, "Não encontrada")
    db.delete(c); db.commit()
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════════════════
# CAMPANHA POR FORMA DE PAGAMENTO
# ══════════════════════════════════════════════════════════════════════════════

class FormaPgtoBody(BaseModel):
    nome:               str
    descricao:          str   = ""
    ativo:              bool  = True
    data_inicio:        Optional[date] = None
    data_fim:           Optional[date] = None
    forma_chave:        str
    valor_minimo_compra: float = 0.0
    pct_desconto:       float = 0.0


@router.get("/forma-pagamento")
def listar_forma_pgto(db: Session = Depends(get_db)):
    campanhas = db.query(CampanhaFormaPagamento).order_by(CampanhaFormaPagamento.id.desc()).all()
    formas_db = {f.chave: f for f in db.query(FormaRecebimento).all()}
    resultado = []
    for c in campanhas:
        forma_info = formas_db.get(c.forma_chave)
        resultado.append({
            "id": c.id, "nome": c.nome, "descricao": c.descricao,
            "ativo": c.ativo, "vigente": _vigente(c),
            "data_inicio": str(c.data_inicio) if c.data_inicio else None,
            "data_fim": str(c.data_fim) if c.data_fim else None,
            "forma_chave": c.forma_chave,
            "forma_nome": forma_info.nome if forma_info else c.forma_chave,
            "forma_cor": forma_info.cor if forma_info else "#6366f1",
            "forma_icone": forma_info.icone if forma_info else "💳",
            "valor_minimo_compra": c.valor_minimo_compra,
            "pct_desconto": c.pct_desconto,
        })
    return resultado


@router.post("/forma-pagamento")
def criar_forma_pgto(body: FormaPgtoBody, db: Session = Depends(get_db)):
    c = CampanhaFormaPagamento(**body.model_dump())
    db.add(c); db.commit(); db.refresh(c)
    return {"ok": True, "id": c.id}


@router.put("/forma-pagamento/{cid}")
def atualizar_forma_pgto(cid: int, body: FormaPgtoBody, db: Session = Depends(get_db)):
    c = db.query(CampanhaFormaPagamento).filter(CampanhaFormaPagamento.id == cid).first()
    if not c:
        raise HTTPException(404, "Não encontrada")
    for k, v in body.model_dump().items():
        setattr(c, k, v)
    db.commit()
    return {"ok": True}


@router.delete("/forma-pagamento/{cid}")
def excluir_forma_pgto(cid: int, db: Session = Depends(get_db)):
    c = db.query(CampanhaFormaPagamento).filter(CampanhaFormaPagamento.id == cid).first()
    if not c:
        raise HTTPException(404, "Não encontrada")
    db.delete(c); db.commit()
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINT PDV — regras ativas (atacarejo + forma pgto)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/pdv/regras")
def regras_pdv(db: Session = Depends(get_db)):
    """Retorna todas as regras ativas para o PDV usar em tempo real."""
    h = date.today()

    # Regras atacarejo vigentes
    atk_camps = db.query(CampanhaAtacarejo).filter(CampanhaAtacarejo.ativo == True).all()
    regras_atk = []
    for c in atk_camps:
        if not _vigente(c):
            continue
        for i in c.itens:
            entry = {
                "tipo": i.tipo, "qtd_minima": i.qtd_minima,
                "preco_atacarejo": i.preco_atacarejo, "pct_desconto": i.pct_desconto,
                "produto_id": i.produto_id, "categoria_id": i.categoria_id,
            }
            regras_atk.append(entry)

    # Campanhas por forma de pagamento vigentes
    camp_formas = db.query(CampanhaFormaPagamento).filter(CampanhaFormaPagamento.ativo == True).all()
    regras_forma = []
    for c in camp_formas:
        if not _vigente(c):
            continue
        regras_forma.append({
            "forma_chave": c.forma_chave, "nome": c.nome,
            "valor_minimo_compra": c.valor_minimo_compra,
            "pct_desconto": c.pct_desconto,
        })

    return {"atacarejo": regras_atk, "forma_pagamento": regras_forma}
