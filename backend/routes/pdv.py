from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc
from database import get_db
from models import (
    Produto, Cliente, Venda, ItemVenda, MovimentoEstoque, ContaReceber,
    ParametroPDV, InstituicaoTrocoSolidario, DevolucaoMercadoria,
    FormaRecebimento, CampanhaAtacarejo, ItemCampanhaAtacarejo,
    CampanhaFormaPagamento, OperadorPDV, CaixaAbertura, PedidoVenda,
)
from datetime import date as _date, timedelta
from utils.security import get_current_user
from pydantic import BaseModel
from typing import Optional, List
from datetime import date
import json

router = APIRouter(prefix="/pdv", tags=["pdv"])


# ─── Schemas ────────────────────────────────────────────────────────────────

class ItemVendaPDV(BaseModel):
    produto_id: int
    quantidade: float
    preco_unitario: float
    desconto_item: Optional[float] = 0.0

class PagamentoPDV(BaseModel):
    forma: str          # DINHEIRO | CARTAO_DEBITO | CARTAO_CREDITO | PIX | MISTO | CREDITO_DEVOLUCAO
    valor: float

class VendaPDVCreate(BaseModel):
    itens: List[ItemVendaPDV]
    pagamentos: List[PagamentoPDV]
    desconto: Optional[float] = 0.0
    cliente_cpf: Optional[str] = None
    cliente_id: Optional[int] = None
    troco_solidario_valor: Optional[float] = 0.0
    troco_solidario_inst: Optional[str] = None
    credito_devolucao_usado: Optional[float] = 0.0
    canal: Optional[str] = "PDV"
    terminal: Optional[str] = "PDV-01"
    operador: Optional[str] = None
    observacoes: Optional[str] = None
    tipo_fiscal: Optional[str] = "CUPOM"
    pedido_venda_numero: Optional[str] = None

class ParametroUpdate(BaseModel):
    terminal: Optional[str] = None
    nome_loja: Optional[str] = None
    cnpj_loja: Optional[str] = None
    endereco_loja: Optional[str] = None
    operador_obrigatorio: Optional[bool] = None
    cliente_cpf_obrigatorio: Optional[bool] = None
    desconto_maximo_pct: Optional[float] = None
    permite_venda_sem_estoque: Optional[bool] = None
    troco_solidario_ativo: Optional[bool] = None
    impressao_cupom: Optional[bool] = None
    mensagem_cupom: Optional[str] = None
    exige_senha_supervisor: Optional[bool] = None
    logo_url: Optional[str] = None
    solicitar_cpf_inicio: Optional[bool] = None

class InstituicaoCreate(BaseModel):
    nome: str
    descricao: Optional[str] = None
    cnpj: Optional[str] = None

class OperadorCreate(BaseModel):
    numero: int
    nome: str
    senha: Optional[str] = None
    perfil: Optional[str] = "OPERADOR"

class AberturaCreate(BaseModel):
    operador_num: int
    fundo_caixa: Optional[float] = 0.0
    terminal: Optional[str] = "PDV-01"

# ─── Carga PDV (todos os dados necessários para o terminal) ─────────────────

@router.get("/carga")
def carga_pdv(db: Session = Depends(get_db), _=Depends(get_current_user)):
    produtos = db.query(Produto).filter(
        Produto.is_active == True,
        (Produto.insumo_producao == False) | (Produto.insumo_producao == None)
    ).order_by(Produto.descricao).all()
    params   = db.query(ParametroPDV).first()
    insts    = db.query(InstituicaoTrocoSolidario).filter(InstituicaoTrocoSolidario.is_active == True).all()
    return {
        "produtos": [{
            "id": p.id, "codigo": p.codigo, "codigo_barras": p.codigo_barras,
            "descricao": p.descricao, "preco_venda": p.preco_venda,
            "preco_custo": p.preco_custo, "unidade": p.unidade,
            "estoque_atual": p.estoque_atual, "estoque_minimo": p.estoque_minimo,
            "categoria": p.categoria.nome if p.categoria else None,
            "pesavel": getattr(p, "pesavel", False) or False,
            "plu_codigo": getattr(p, "plu_codigo", None),
            "embalagem_codigo": getattr(p, "embalagem_codigo", None),
            "embalagem_qtd": getattr(p, "embalagem_qtd", 1) or 1,
            "atacarejo": getattr(p, "atacarejo", False) or False,
            "atacarejo_qtd_min": getattr(p, "atacarejo_qtd_min", 3) or 3,
            "atacarejo_preco": getattr(p, "atacarejo_preco", 0) or 0,
            "imagem_url": getattr(p, "imagem_url", None),
        } for p in produtos],
        "parametros": _param_dict(params) if params else _param_default(),
        "instituicoes_troco": [{"id": i.id, "nome": i.nome, "total_arrecadado": i.total_arrecadado} for i in insts],
        "formas_recebimento": [
            {"id": f.id, "nome": f.nome, "chave": f.chave, "icone": f.icone,
             "cor": f.cor, "aceita_troco": f.aceita_troco, "ordem": f.ordem}
            for f in db.query(FormaRecebimento)
                       .filter(FormaRecebimento.ativo == True)
                       .order_by(FormaRecebimento.ordem, FormaRecebimento.id)
                       .all()
        ],
        "regras_atacarejo": _regras_atacarejo(db),
        "campanhas_forma_pgto": _campanhas_forma_pgto(db),
        "operadores": [
            {"id": o.id, "numero": o.numero, "nome": o.nome, "perfil": o.perfil,
             "senha_hash": o.senha_hash}
            for o in db.query(OperadorPDV).filter(OperadorPDV.is_active == True).order_by(OperadorPDV.numero).all()
        ],
    }


def _vigente(c: any) -> bool:
    h = _date.today()
    if not getattr(c, 'ativo', True): return False
    ini = getattr(c, 'data_inicio', None)
    fim = getattr(c, 'data_fim', None)
    if ini and h < ini: return False
    if fim and h > fim: return False
    return True


def _regras_atacarejo(db: Session) -> list:
    regras = []
    for c in db.query(CampanhaAtacarejo).filter(CampanhaAtacarejo.ativo == True).all():
        if not _vigente(c): continue
        for i in c.itens:
            regras.append({
                "tipo": i.tipo, "qtd_minima": i.qtd_minima,
                "preco_atacarejo": i.preco_atacarejo, "pct_desconto": i.pct_desconto,
                "produto_id": i.produto_id, "categoria_id": i.categoria_id,
            })
    return regras


def _campanhas_forma_pgto(db: Session) -> list:
    result = []
    for c in db.query(CampanhaFormaPagamento).filter(CampanhaFormaPagamento.ativo == True).all():
        if not _vigente(c): continue
        result.append({
            "forma_chave": c.forma_chave, "nome": c.nome,
            "valor_minimo_compra": c.valor_minimo_compra,
            "pct_desconto": c.pct_desconto,
        })
    return result

# ─── Busca produto por código de barras / código / texto ────────────────────

@router.get("/produto")
def busca_produto(q: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = (
        db.query(Produto).filter(
            Produto.is_active == True,
            (Produto.codigo_barras == q) | (Produto.codigo == q.upper())
        ).first()
        or db.query(Produto).filter(
            Produto.is_active == True,
            Produto.descricao.ilike(f"%{q}%")
        ).first()
    )
    if not p: raise HTTPException(404, "Produto não encontrado")
    return {"id": p.id, "codigo": p.codigo, "descricao": p.descricao,
            "preco_venda": p.preco_venda, "unidade": p.unidade, "estoque_atual": p.estoque_atual}

# ─── Cliente por CPF (fidelidade) ───────────────────────────────────────────

@router.get("/cliente/cpf/{cpf}")
def cliente_por_cpf(cpf: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    cpf_clean = cpf.replace(".", "").replace("-", "").replace("/", "").strip()
    c = db.query(Cliente).filter(Cliente.documento.contains(cpf_clean), Cliente.is_active == True).first()
    if not c: raise HTTPException(404, "Cliente não encontrado")
    total_vendas = db.query(sqlfunc.count(Venda.id)).filter(Venda.cliente_id == c.id).scalar()
    total_gasto  = db.query(sqlfunc.sum(Venda.total)).filter(Venda.cliente_id == c.id).scalar() or 0
    # crédito de devolução disponível
    credito = db.query(sqlfunc.sum(DevolucaoMercadoria.credito_disponivel))\
        .filter(DevolucaoMercadoria.cliente_cpf == cpf_clean).scalar() or 0
    return {
        "id": c.id, "nome": c.nome, "documento": c.documento,
        "email": c.email, "telefone": c.celular or c.telefone,
        "total_compras": total_vendas, "total_gasto": round(total_gasto, 2),
        "credito_devolucao": round(credito, 2),
    }

# ─── Finalizar Venda PDV ─────────────────────────────────────────────────────

@router.post("/venda")
def finalizar_venda(data: VendaPDVCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if not data.itens: raise HTTPException(400, "Venda sem itens")

    # Calcula subtotal
    subtotal = sum(round(i.quantidade * i.preco_unitario - (i.desconto_item or 0), 2) for i in data.itens)
    total    = round(subtotal - (data.desconto or 0) - (data.credito_devolucao_usado or 0), 2)
    if total < 0: total = 0

    # Número da venda
    last = db.query(Venda).order_by(Venda.id.desc()).first()
    num  = f"VD-{(last.id + 1) if last else 1:05d}"

    # Forma de pagamento principal
    forma_principal = data.pagamentos[0].forma if data.pagamentos else "DINHEIRO"
    valor_recebido  = sum(p.valor for p in data.pagamentos)
    troco           = round(max(0, valor_recebido - total - (data.troco_solidario_valor or 0)), 2)

    # Cliente
    cliente_nome = None
    if data.cliente_id:
        c = db.query(Cliente).filter(Cliente.id == data.cliente_id).first()
        if c: cliente_nome = c.nome
    elif data.cliente_cpf:
        c = db.query(Cliente).filter(Cliente.documento.contains(data.cliente_cpf.replace(".","").replace("-",""))).first()
        if c: cliente_nome = c.nome; data.cliente_id = c.id

    venda = Venda(
        numero=num,
        cliente_id=data.cliente_id,
        cliente_nome=cliente_nome,
        data_venda=date.today(),
        subtotal=subtotal,
        desconto=(data.desconto or 0),
        total=total,
        forma_pagamento=forma_principal if len(data.pagamentos) == 1 else "MISTO",
        parcelas=1,
        troco=troco,
        status="FINALIZADA",
        operador=data.operador or user.nome,
        observacoes=data.observacoes,
        canal=data.canal or "PDV",
        troco_solidario_valor=data.troco_solidario_valor or 0,
        troco_solidario_inst=data.troco_solidario_inst,
        cliente_cpf_fidelidade=data.cliente_cpf,
        credito_devolucao_usado=data.credito_devolucao_usado or 0,
        pdv_terminal=data.terminal,
        tipo_fiscal=data.tipo_fiscal or "CUPOM",
    )
    db.add(venda); db.flush()

    for item_data in data.itens:
        prod = db.query(Produto).filter(Produto.id == item_data.produto_id).first()
        if not prod: raise HTTPException(404, f"Produto {item_data.produto_id} não encontrado")
        vt = round(item_data.quantidade * item_data.preco_unitario - (item_data.desconto_item or 0), 2)
        item = ItemVenda(
            venda_id=venda.id,
            produto_id=prod.id,
            descricao_snap=prod.descricao,
            quantidade=item_data.quantidade,
            preco_unitario=item_data.preco_unitario,
            desconto_item=item_data.desconto_item or 0,
            total_item=vt,
            custo_unitario=prod.preco_custo,
        )
        db.add(item)
        prod.estoque_atual = round(prod.estoque_atual - item_data.quantidade, 4)
        db.add(MovimentoEstoque(
            produto_id=prod.id, tipo="SAIDA", quantidade=item_data.quantidade,
            custo_unitario=prod.preco_custo, valor_total=round(item_data.quantidade * prod.preco_custo, 2),
            data=date.today(), origem="VENDA", origem_id=venda.id, documento_ref=num,
        ))

    # Troco solidário: incrementa total da instituição
    if data.troco_solidario_valor and data.troco_solidario_inst:
        inst = db.query(InstituicaoTrocoSolidario).filter(
            InstituicaoTrocoSolidario.nome == data.troco_solidario_inst).first()
        if inst: inst.total_arrecadado = round(inst.total_arrecadado + data.troco_solidario_valor, 2)

    # Débita crédito de devolução
    if data.credito_devolucao_usado and data.cliente_cpf:
        cpf_c = data.cliente_cpf.replace(".","").replace("-","")
        devs = db.query(DevolucaoMercadoria).filter(
            DevolucaoMercadoria.cliente_cpf == cpf_c,
            DevolucaoMercadoria.credito_disponivel > 0,
        ).order_by(DevolucaoMercadoria.id).all()
        resto = data.credito_devolucao_usado
        for dev in devs:
            if resto <= 0: break
            usar = min(dev.credito_disponivel, resto)
            dev.credito_usado = round(dev.credito_usado + usar, 2)
            dev.credito_disponivel = round(dev.credito_disponivel - usar, 2)
            resto = round(resto - usar, 2)

    # Marca pedido de venda como FATURADO se veio de um pedido
    if data.pedido_venda_numero:
        pv = db.query(PedidoVenda).filter(
            PedidoVenda.numero == data.pedido_venda_numero.upper()
        ).first()
        if pv:
            pv.status = "FATURADO"

    db.commit(); db.refresh(venda)

    # Auto-criar contas a receber para formas configuradas com vencimento
    try:
        formas_db = {f.chave: f for f in db.query(FormaRecebimento).filter(
            FormaRecebimento.gera_conta_receber == True,
            FormaRecebimento.vencimento_dias > 0,
        ).all()}
        for pgto in data.pagamentos:
            forma = formas_db.get(pgto.forma)
            if forma:
                venc = date.today() + timedelta(days=forma.vencimento_dias)
                cr = ContaReceber(
                    cliente_id=data.cliente_id,
                    venda_id=venda.id,
                    descricao=f"Venda {venda.numero} — {forma.nome}",
                    valor=round(pgto.valor, 2),
                    vencimento=venc,
                    status="PENDENTE",
                    forma_pagamento=pgto.forma,
                )
                db.add(cr)
        db.commit()
    except Exception:
        pass

    return {
        "id": venda.id, "numero": venda.numero, "total": venda.total,
        "troco": venda.troco, "status": venda.status,
        "troco_solidario_valor": venda.troco_solidario_valor,
    }

# ─── Histórico PDV ──────────────────────────────────────────────────────────

@router.get("/historico")
def historico(limit: int = 20, db: Session = Depends(get_db), _=Depends(get_current_user)):
    vendas = db.query(Venda).filter(Venda.canal == "PDV")\
        .order_by(Venda.id.desc()).limit(limit).all()
    return [{
        "id": v.id, "numero": v.numero, "total": v.total,
        "forma_pagamento": v.forma_pagamento, "cliente_nome": v.cliente_nome,
        "status": v.status, "created_at": v.created_at.isoformat() if v.created_at else None,
    } for v in vendas]

# ─── Parâmetros PDV ──────────────────────────────────────────────────────────

def _param_default():
    return {"terminal": "PDV-01", "nome_loja": "NexusVarejo", "cnpj_loja": None,
            "endereco_loja": None, "operador_obrigatorio": True,
            "cliente_cpf_obrigatorio": False, "desconto_maximo_pct": 10.0,
            "permite_venda_sem_estoque": True, "troco_solidario_ativo": True,
            "impressao_cupom": True, "mensagem_cupom": None,
            "exige_senha_supervisor": False, "logo_url": None, "solicitar_cpf_inicio": False}

def _param_dict(p: ParametroPDV):
    return {"id": p.id, "terminal": p.terminal, "nome_loja": p.nome_loja,
            "cnpj_loja": p.cnpj_loja, "endereco_loja": p.endereco_loja,
            "operador_obrigatorio": p.operador_obrigatorio,
            "cliente_cpf_obrigatorio": p.cliente_cpf_obrigatorio,
            "desconto_maximo_pct": p.desconto_maximo_pct,
            "permite_venda_sem_estoque": p.permite_venda_sem_estoque,
            "troco_solidario_ativo": p.troco_solidario_ativo,
            "impressao_cupom": p.impressao_cupom,
            "mensagem_cupom": p.mensagem_cupom,
            "exige_senha_supervisor": getattr(p, "exige_senha_supervisor", False) or False,
            "logo_url": getattr(p, "logo_url", None),
            "solicitar_cpf_inicio": getattr(p, "solicitar_cpf_inicio", False) or False}

@router.get("/parametros")
def get_parametros(db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(ParametroPDV).first()
    return _param_dict(p) if p else _param_default()

@router.put("/parametros")
def update_parametros(data: ParametroUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(ParametroPDV).first()
    if not p:
        p = ParametroPDV(); db.add(p); db.flush()
    for field, val in data.model_dump(exclude_none=True).items():
        setattr(p, field, val)
    db.commit(); db.refresh(p)
    return _param_dict(p)

# ─── Instituições de Troco Solidário ────────────────────────────────────────

@router.get("/troco-solidario")
def list_inst(db: Session = Depends(get_db), _=Depends(get_current_user)):
    insts = db.query(InstituicaoTrocoSolidario).order_by(InstituicaoTrocoSolidario.nome).all()
    return [{"id": i.id, "nome": i.nome, "descricao": i.descricao, "cnpj": i.cnpj,
             "is_active": i.is_active, "total_arrecadado": i.total_arrecadado} for i in insts]

@router.post("/troco-solidario")
def create_inst(data: InstituicaoCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    i = InstituicaoTrocoSolidario(nome=data.nome, descricao=data.descricao, cnpj=data.cnpj)
    db.add(i); db.commit(); db.refresh(i)
    return {"id": i.id, "nome": i.nome}

@router.put("/troco-solidario/{iid}")
def update_inst(iid: int, data: InstituicaoCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    i = db.query(InstituicaoTrocoSolidario).filter(InstituicaoTrocoSolidario.id == iid).first()
    if not i: raise HTTPException(404, "Instituição não encontrada")
    i.nome = data.nome; i.descricao = data.descricao; i.cnpj = data.cnpj
    db.commit()
    return {"ok": True}

@router.delete("/troco-solidario/{iid}")
def delete_inst(iid: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    i = db.query(InstituicaoTrocoSolidario).filter(InstituicaoTrocoSolidario.id == iid).first()
    if not i: raise HTTPException(404)
    i.is_active = False; db.commit()
    return {"ok": True}

@router.get("/troco-solidario/relatorio")
def relatorio_troco(db: Session = Depends(get_db), _=Depends(get_current_user)):
    insts = db.query(InstituicaoTrocoSolidario).all()
    total = sum(i.total_arrecadado for i in insts)
    return {"total_arrecadado": round(total, 2),
            "instituicoes": [{"nome": i.nome, "total": i.total_arrecadado} for i in insts]}


# ─── Operadores PDV ──────────────────────────────────────────────────────────

import bcrypt as _bcrypt_mod

class _pwd:
    @staticmethod
    def hash(password: str) -> str:
        return _bcrypt_mod.hashpw(password.encode('utf-8'), _bcrypt_mod.gensalt()).decode('utf-8')
    @staticmethod
    def verify(plain: str, hashed: str) -> bool:
        try:
            return _bcrypt_mod.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))
        except Exception:
            return False

@router.get("/operadores")
def list_operadores(db: Session = Depends(get_db), _=Depends(get_current_user)):
    ops = db.query(OperadorPDV).filter(OperadorPDV.is_active == True).order_by(OperadorPDV.numero).all()
    return [{"id": o.id, "numero": o.numero, "nome": o.nome, "perfil": o.perfil} for o in ops]

@router.post("/operadores")
def create_operador(data: OperadorCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    if db.query(OperadorPDV).filter(OperadorPDV.numero == data.numero).first():
        raise HTTPException(400, "Número de operador já cadastrado")
    op = OperadorPDV(
        numero=data.numero, nome=data.nome, perfil=data.perfil,
        senha_hash=_pwd.hash(data.senha) if data.senha else None,
    )
    db.add(op); db.commit(); db.refresh(op)
    return {"id": op.id, "numero": op.numero, "nome": op.nome}

@router.put("/operadores/{op_id}")
def update_operador(op_id: int, data: OperadorCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    op = db.query(OperadorPDV).filter(OperadorPDV.id == op_id).first()
    if not op: raise HTTPException(404, "Operador não encontrado")
    op.nome = data.nome; op.perfil = data.perfil
    if data.senha: op.senha_hash = _pwd.hash(data.senha)
    db.commit()
    return {"ok": True}

@router.delete("/operadores/{op_id}")
def delete_operador(op_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    op = db.query(OperadorPDV).filter(OperadorPDV.id == op_id).first()
    if not op: raise HTTPException(404)
    op.is_active = False; db.commit()
    return {"ok": True}


# ─── Abertura / Fechamento de Caixa ─────────────────────────────────────────

@router.post("/abertura")
def registrar_abertura(data: AberturaCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    # Fecha abertura anterior do mesmo terminal se ainda aberta
    ant = db.query(CaixaAbertura).filter(
        CaixaAbertura.terminal == data.terminal,
        CaixaAbertura.is_aberto == True
    ).first()
    if ant:
        from datetime import datetime, timezone
        ant.is_aberto = False
        ant.fechado_em = datetime.now(timezone.utc)
    ab = CaixaAbertura(
        terminal=data.terminal,
        operador_num=data.operador_num,
        fundo_caixa=data.fundo_caixa,
    )
    db.add(ab); db.commit(); db.refresh(ab)
    return {"id": ab.id, "aberto_em": ab.aberto_em.isoformat(), "fundo_caixa": ab.fundo_caixa}

@router.get("/abertura/status")
def status_abertura(terminal: str = "PDV-01", db: Session = Depends(get_db), _=Depends(get_current_user)):
    ab = db.query(CaixaAbertura).filter(
        CaixaAbertura.terminal == terminal,
        CaixaAbertura.is_aberto == True
    ).first()
    if not ab:
        return {"aberto": False}
    return {
        "aberto": True,
        "id": ab.id,
        "operador_num": ab.operador_num,
        "fundo_caixa": ab.fundo_caixa,
        "aberto_em": ab.aberto_em.isoformat(),
    }

@router.get("/aberturas")
def list_aberturas(db: Session = Depends(get_db), _=Depends(get_current_user)):
    abs_ = db.query(CaixaAbertura).order_by(CaixaAbertura.aberto_em.desc()).limit(50).all()
    return [{
        "id": a.id, "terminal": a.terminal, "operador_num": a.operador_num,
        "fundo_caixa": a.fundo_caixa, "total_vendas": a.total_vendas,
        "aberto_em": a.aberto_em.isoformat() if a.aberto_em else None,
        "fechado_em": a.fechado_em.isoformat() if a.fechado_em else None,
        "is_aberto": a.is_aberto,
    } for a in abs_]


# ─── Validação Supervisor ────────────────────────────────────────────────────

class SupervisorValidar(BaseModel):
    numero: int
    senha: str

@router.post("/supervisor/validar")
def validar_supervisor(data: SupervisorValidar, db: Session = Depends(get_db), _=Depends(get_current_user)):
    op = db.query(OperadorPDV).filter(
        OperadorPDV.numero == data.numero,
        OperadorPDV.perfil == "SUPERVISOR",
        OperadorPDV.is_active == True,
    ).first()
    if not op:
        raise HTTPException(403, "Supervisor não encontrado")
    if not op.senha_hash or not _pwd.verify(data.senha, op.senha_hash):
        raise HTTPException(403, "Senha inválida")
    return {"ok": True, "nome": op.nome}


# ─── Alterar Preço via PDV (requer supervisor) ──────────────────────────────

class AlterarPrecoRequest(BaseModel):
    supervisor_num: int
    supervisor_senha: str
    codigo: str
    novo_preco: float

@router.post("/alterar-preco")
def alterar_preco_pdv(data: AlterarPrecoRequest, db: Session = Depends(get_db), _=Depends(get_current_user)):
    # Valida supervisor
    op = db.query(OperadorPDV).filter(
        OperadorPDV.numero == data.supervisor_num,
        OperadorPDV.perfil == "SUPERVISOR",
        OperadorPDV.is_active == True,
    ).first()
    if not op:
        raise HTTPException(403, "Supervisor não encontrado")
    if not op.senha_hash or not _pwd.verify(data.supervisor_senha, op.senha_hash):
        raise HTTPException(403, "Senha do supervisor inválida")
    if data.novo_preco <= 0:
        raise HTTPException(400, "Preço deve ser maior que zero")
    # Busca produto por código ou código de barras
    prod = db.query(Produto).filter(
        (Produto.codigo == data.codigo) | (Produto.codigo_barras == data.codigo)
    ).first()
    if not prod:
        raise HTTPException(404, f"Produto '{data.codigo}' não encontrado")
    preco_anterior = prod.preco_venda
    prod.preco_venda = data.novo_preco
    db.commit()
    return {
        "ok": True,
        "produto_id": prod.id,
        "descricao": prod.descricao,
        "preco_anterior": preco_anterior,
        "preco_novo": data.novo_preco,
        "supervisor": op.nome,
    }
