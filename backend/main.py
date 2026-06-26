from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import sys, os, pathlib

# Garante que a pasta de imagens existe
_IMG_DIR = pathlib.Path(__file__).parent / "static" / "imagens" / "produtos"
_IMG_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="NexusVarejo API", version="2.0.0", description="Sistema de Gestão Comercial")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Servir imagens de produtos estáticos
app.mount("/static", StaticFiles(directory=str(pathlib.Path(__file__).parent / "static")), name="static")

# ─── Banco de Dados ───────────────────────────────────────────────────────────
try:
    from database import engine, Base, SessionLocal, DATABASE_URL
    from models import Usuario
    from utils.security import get_password_hash
    from sqlalchemy import text

    IS_SQLITE = "sqlite" in DATABASE_URL

    Base.metadata.create_all(bind=engine)

    def _add_col(conn, table: str, col: str, typ: str):
        try:
            if IS_SQLITE:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {typ}"))
            else:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {typ}"))
        except Exception:
            pass

    # ── Migrações de colunas ────────────────────────────────────────────────
    with engine.connect() as conn:
        _add_col(conn, "vendas", "canal",                   "VARCHAR(30) DEFAULT 'PDV'")
        _add_col(conn, "vendas", "troco_solidario_valor",   "FLOAT DEFAULT 0")
        _add_col(conn, "vendas", "troco_solidario_inst",    "VARCHAR(200)")
        _add_col(conn, "vendas", "cliente_cpf_fidelidade",  "VARCHAR(20)")
        _add_col(conn, "vendas", "credito_devolucao_usado", "FLOAT DEFAULT 0")
        _add_col(conn, "vendas", "pdv_terminal",            "VARCHAR(50)")
        _add_col(conn, "movimentos_estoque", "usuario_nome",    "VARCHAR(100)")
        _add_col(conn, "movimentos_estoque", "centro_custo_id", "INTEGER")
        _add_col(conn, "usuarios", "permissoes",    "TEXT")
        _add_col(conn, "usuarios", "ultimo_acesso", "DATETIME")
        conn.commit()

    # ── Cria tabelas novas (gestão preços + fiscal) ──────────────────────────
    try:
        from models import (
            ProgramacaoPreco, CampanhaPromocional, CampanhaItem, ConfigBalanca,
            ConfigEmpresa, TabelaImposto,
        )
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"[WARN] Tabelas novas: {e}", file=sys.stderr)

    # ── Migrações colunas fiscais em produtos ────────────────────────────────
    with engine.connect() as conn:
        _add_col(conn, "produtos", "cfop_saida",      "VARCHAR(10) DEFAULT '5102'")
        _add_col(conn, "produtos", "cst_icms",        "VARCHAR(5)  DEFAULT '000'")
        _add_col(conn, "produtos", "csosn",           "VARCHAR(5)  DEFAULT '400'")
        _add_col(conn, "produtos", "icms_aliquota",   "FLOAT DEFAULT 0.0")
        _add_col(conn, "produtos", "pis_aliquota",    "FLOAT DEFAULT 0.0")
        _add_col(conn, "produtos", "cofins_aliquota", "FLOAT DEFAULT 0.0")
        _add_col(conn, "produtos", "cest",            "VARCHAR(10)")
        _add_col(conn, "produtos", "pesavel",          "BOOLEAN DEFAULT 0")
        _add_col(conn, "produtos", "plu_codigo",       "INTEGER")
        _add_col(conn, "produtos", "enviar_balanca",   "BOOLEAN DEFAULT 0")
        _add_col(conn, "produtos", "embalagem_codigo", "VARCHAR(30)")
        _add_col(conn, "produtos", "embalagem_qtd",    "INTEGER DEFAULT 1")
        _add_col(conn, "produtos", "embalagem_desc",   "VARCHAR(80)")
        _add_col(conn, "produtos", "embalagem_tipo",    "VARCHAR(5) DEFAULT 'CX'")
        _add_col(conn, "produtos",      "atacarejo",          "BOOLEAN DEFAULT 0")
        _add_col(conn, "produtos",      "atacarejo_qtd_min",  "INTEGER DEFAULT 3")
        _add_col(conn, "produtos",      "atacarejo_preco",    "FLOAT DEFAULT 0")
        _add_col(conn, "fornecedores",  "vendedor_nome",      "VARCHAR(100)")
        _add_col(conn, "fornecedores",  "vendedor_telefone",  "VARCHAR(30)")
        _add_col(conn, "fornecedores",  "prazo_pagamento",    "VARCHAR(50)")
        conn.commit()

    # ── Cria tabelas de relacionamento ────────────────────────────────────────
    try:
        from models import ProdutoFornecedor, FornecedorRepresentante
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"[WARN] tabelas relacionamento: {e}", file=sys.stderr)

    # ── Cria tabelas novos módulos ─────────────────────────────────────────────
    try:
        from models import (
            AgendaFornecedor, VerbaCompras, NFSaida, ItemNFSaida, Troca, ItemTroca,
            AgendaAlteracaoPreco, FormaRecebimento,
            CampanhaAtacarejo, ItemCampanhaAtacarejo,
            CampanhaClube, ItemCampanhaClube,
            CampanhaFormaPagamento,
            Vendedor, PedidoVenda, ItemPedidoVenda,
            ConfigImpressora, Comprador,
        )
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"[WARN] tabelas novos módulos: {e}", file=sys.stderr)

    # ── Cria tabela movimentos_caixa ──────────────────────────────────────────
    try:
        from models import MovimentoCaixa
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"[WARN] tabela movimentos_caixa: {e}", file=sys.stderr)

    # ── Migrações fiscal/impressoras ────────────────────────────────────────
    with engine.connect() as conn:
        _add_col(conn, "vendas",    "tipo_fiscal",            "VARCHAR(20) DEFAULT 'CUPOM'")
        _add_col(conn, "nf_saida",  "pedido_marketplace_id",  "INTEGER")
        # Agenda fornecedor — parâmetros de reposição
        _add_col(conn, "agenda_fornecedor", "percentual_reposicao", "FLOAT DEFAULT 0")
        _add_col(conn, "agenda_fornecedor", "margem_seguranca_pct", "FLOAT DEFAULT 0")
        _add_col(conn, "agenda_fornecedor", "reposicao_adicional",  "FLOAT DEFAULT 0")
        _add_col(conn, "agenda_fornecedor", "dias_venda_filtro",    "INTEGER DEFAULT 0")
        _add_col(conn, "agenda_fornecedor", "gerar_automatico",     "BOOLEAN DEFAULT 1")
        # Pedido de compra — origem
        _add_col(conn, "pedidos_compra",    "origem",               "VARCHAR(10) DEFAULT 'MANUAL'")
        # Produtos — controle de validade
        _add_col(conn, "produtos", "controla_validade",     "BOOLEAN DEFAULT 0")
        _add_col(conn, "produtos", "dias_validade_alerta",  "INTEGER DEFAULT 30")
        _add_col(conn, "produtos", "insumo_producao",        "BOOLEAN DEFAULT 0")
        _add_col(conn, "produtos", "imagem_url",             "VARCHAR(500)")
        # Pedido de Venda — separação
        _add_col(conn, "pedidos_venda", "status_separacao", "VARCHAR(20) DEFAULT 'PENDENTE'")
        # Clientes — crédito rotativo
        _add_col(conn, "clientes",          "credito_rotativo",     "FLOAT DEFAULT 0")
        # Formas de recebimento — conta a receber automática
        _add_col(conn, "formas_recebimento", "gera_conta_receber",  "BOOLEAN DEFAULT 0")
        _add_col(conn, "formas_recebimento", "vencimento_dias",     "INTEGER DEFAULT 0")
        # Contas Correntes
        _add_col(conn, "contas_correntes", "cor",        "VARCHAR(7) DEFAULT '#6366f1'")
        _add_col(conn, "contas_correntes", "icone",      "VARCHAR(10) DEFAULT '🏦'")
        _add_col(conn, "contas_correntes", "observacoes","TEXT")
        conn.commit()

    # ── Seed formas de recebimento ────────────────────────────────────────────
    try:
        from models import FormaRecebimento
        db = SessionLocal()
        FORMAS_SEED = [
            {"nome":"Dinheiro",         "chave":"DINHEIRO",         "icone":"💵","cor":"#34C759","ordem":1,"aceita_troco":True},
            {"nome":"Cartão de Débito", "chave":"CARTAO_DEBITO",    "icone":"💳","cor":"#32ADE6","ordem":2,"aceita_troco":False},
            {"nome":"Cartão de Crédito","chave":"CARTAO_CREDITO",   "icone":"💳","cor":"#5856D6","ordem":3,"aceita_troco":False},
            {"nome":"Pix",              "chave":"PIX",              "icone":"📱","cor":"#00B37E","ordem":4,"aceita_troco":False},
            {"nome":"Crédito Rotativo", "chave":"CREDITO_ROTATIVO", "icone":"🔄","cor":"#FF9F0A","ordem":5,"aceita_troco":False},
            {"nome":"Convênio",         "chave":"CONVENIO",         "icone":"🤝","cor":"#AF52DE","ordem":6,"aceita_troco":False},
            {"nome":"Boleto",           "chave":"BOLETO",           "icone":"📄","cor":"#8E8E93","ordem":7,"aceita_troco":False},
            {"nome":"Crédito Devolução","chave":"CREDITO_DEVOLUCAO","icone":"↩️","cor":"#FF9F0A","ordem":8,"aceita_troco":False},
        ]
        for fs in FORMAS_SEED:
            if not db.query(FormaRecebimento).filter(FormaRecebimento.chave == fs["chave"]).first():
                db.add(FormaRecebimento(**fs, ativo=True, is_sistema=True))
        db.commit(); db.close()
    except Exception as e:
        print(f"[WARN] Seed formas recebimento: {e}", file=sys.stderr)

    # ── Seed empresa padrão ──────────────────────────────────────────────────
    try:
        from models import ConfigEmpresa
        db = SessionLocal()
        if not db.query(ConfigEmpresa).first():
            db.add(ConfigEmpresa(
                razao_social="Minha Empresa Ltda", nome_fantasia="Minha Empresa",
                regime_tributario="SIMPLES_NACIONAL", aliquota_simples=6.0,
                estado="SC",
            ))
            db.commit()
        db.close()
    except Exception as e:
        print(f"[WARN] Seed empresa: {e}", file=sys.stderr)

    # ── Seed tabela impostos padrão ──────────────────────────────────────────
    try:
        from models import TabelaImposto
        db = SessionLocal()
        if not db.query(TabelaImposto).first():
            SEEDS = [
                TabelaImposto(regime="SIMPLES_NACIONAL", nome="Simples Nacional — Padrão",
                    icms_aliquota=0, pis_aliquota=0, cofins_aliquota=0,
                    csll_aliquota=0, irpj_aliquota=0,
                    cfop_padrao="5102", cst_icms="400", csosn="400", is_default=True),
                TabelaImposto(regime="LUCRO_PRESUMIDO", nome="Lucro Presumido — Padrão",
                    icms_aliquota=12.0, pis_aliquota=0.65, cofins_aliquota=3.0,
                    csll_aliquota=9.0, irpj_aliquota=15.0,
                    cfop_padrao="5102", cst_icms="000", csosn="400", is_default=True),
                TabelaImposto(regime="LUCRO_REAL", nome="Lucro Real — Padrão",
                    icms_aliquota=12.0, pis_aliquota=1.65, cofins_aliquota=7.6,
                    csll_aliquota=9.0, irpj_aliquota=15.0,
                    cfop_padrao="5102", cst_icms="000", csosn="400", is_default=True),
            ]
            for s in SEEDS:
                db.add(s)
            db.commit()
        db.close()
    except Exception as e:
        print(f"[WARN] Seed impostos: {e}", file=sys.stderr)

    # ── Seed usuários ────────────────────────────────────────────────────────
    try:
        import json
        db = SessionLocal()
        ADMPERMS = json.dumps(["pdv","vendas","compras","estoque","financeiro","relatorios","usuarios","configuracoes"])
        OPPERMS  = json.dumps(["pdv","vendas","estoque"])
        for uname, uemail, uperfil, uperms, usenha in [
            ("marcio",   "marcio@amorin.com.br",    "ADMIN",    ADMPERMS, "amorin"),
            ("karla",    "karla@nexusvarejo.com",   "ADMIN",    ADMPERMS, "amorin"),
            ("operador", "operador@maxxvendas.com", "OPERADOR", OPPERMS,  "maxx123"),
        ]:
            u = db.query(Usuario).filter(Usuario.email == uemail).first()
            if not u:
                db.add(Usuario(
                    nome=uname, email=uemail,
                    senha_hash=get_password_hash(usenha),
                    perfil=uperfil, is_active=True, permissoes=uperms,
                ))
            else:
                u.senha_hash = get_password_hash(usenha)
                u.permissoes = uperms
                u.is_active = True
        db.commit(); db.close()
    except Exception as e:
        print(f"[WARN] Seed usuários: {e}", file=sys.stderr)

    # ── Seed categorias ──────────────────────────────────────────────────────
    try:
        from models import CategoriaProduto
        db = SessionLocal()
        CATS = [
            {"nome": "Alimentos",   "icone": "🍎", "cor": "#16A34A", "margem_padrao": 25.0},
            {"nome": "Bebidas",     "icone": "🥤", "cor": "#2563EB", "margem_padrao": 30.0},
            {"nome": "Limpeza",     "icone": "🧹", "cor": "#7C3AED", "margem_padrao": 35.0},
            {"nome": "Higiene",     "icone": "🧴", "cor": "#0891B2", "margem_padrao": 40.0},
            {"nome": "Eletrônicos", "icone": "📱", "cor": "#EA580C", "margem_padrao": 20.0},
            {"nome": "Vestuário",   "icone": "👕", "cor": "#BE185D", "margem_padrao": 60.0},
            {"nome": "Ferramentas", "icone": "🔧", "cor": "#92400E", "margem_padrao": 30.0},
            {"nome": "Outros",      "icone": "📦", "cor": "#6B7280", "margem_padrao": 30.0},
        ]
        for c in CATS:
            if not db.query(CategoriaProduto).filter(CategoriaProduto.nome == c["nome"]).first():
                db.add(CategoriaProduto(**c))
        db.commit(); db.close()
    except Exception as e:
        print(f"[WARN] Seed categorias: {e}", file=sys.stderr)

    # ── Seed parâmetros PDV ──────────────────────────────────────────────────
    try:
        from models import ParametroPDV
        db = SessionLocal()
        if not db.query(ParametroPDV).first():
            db.add(ParametroPDV(
                terminal="PDV-01", nome_loja="NexusVarejo",
                desconto_maximo_pct=10.0, permite_venda_sem_estoque=True,
                troco_solidario_ativo=True, impressao_cupom=True,
            ))
            db.commit()
        db.close()
    except Exception as e:
        print(f"[WARN] Seed PDV: {e}", file=sys.stderr)

    print("[OK] Banco iniciado com sucesso", file=sys.stderr)

except Exception as e:
    print(f"[CRITICAL] DB setup error: {e}", file=sys.stderr)

# ─── Rotas ────────────────────────────────────────────────────────────────────
from routes import (
    auth, produtos, fornecedores, clientes, nf_entrada, estoque,
    vendas, contas_pagar, contas_receber, dashboard, relatorios,
    compras, usuarios, pdv, centros_custo, inventario, devolucoes,
    marketplace, gestao_precos, fiscal,
    agenda_compras, verba_compras, nf_saida, trocas, precos_nf,
    formas_recebimento, campanhas_v2, pedido_venda, impressoras,
    contas_correntes, convenio, compradores, apis_externas, caixa,
    afiliados,
)

app.include_router(auth.router)
app.include_router(usuarios.router)
app.include_router(produtos.router)
app.include_router(fornecedores.router)
app.include_router(clientes.router)
app.include_router(nf_entrada.router)
app.include_router(estoque.router)
app.include_router(vendas.router)
app.include_router(contas_pagar.router)
app.include_router(contas_receber.router)
app.include_router(dashboard.router)
app.include_router(relatorios.router)
app.include_router(compras.router)
app.include_router(pdv.router)
app.include_router(centros_custo.router)
app.include_router(inventario.router)
app.include_router(devolucoes.router)
app.include_router(marketplace.router)
app.include_router(gestao_precos.router)
app.include_router(fiscal.router)
app.include_router(agenda_compras.router)
app.include_router(verba_compras.router)
app.include_router(nf_saida.router)
app.include_router(trocas.router)
app.include_router(precos_nf.router)
app.include_router(formas_recebimento.router)
app.include_router(campanhas_v2.router)
app.include_router(pedido_venda.router)
app.include_router(impressoras.router)
app.include_router(contas_correntes.router)
app.include_router(convenio.router)
app.include_router(compradores.router)
app.include_router(apis_externas.router)
app.include_router(caixa.router)
app.include_router(afiliados.router)


@app.get("/")
def root():
    return {"status": "NexusVarejo API online", "version": "2.0.0"}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/debug")
def debug():
    import sys
    from database import SessionLocal
    from models import Usuario
    from utils.security import get_password_hash, verify_password
    resultado = {"python": sys.version, "usuarios": [], "hash_ok": False, "erro": None}
    try:
        h = get_password_hash("teste123")
        resultado["hash_ok"] = verify_password("teste123", h)
    except Exception as e:
        resultado["erro"] = str(e)
    try:
        db = SessionLocal()
        users = db.query(Usuario).all()
        resultado["usuarios"] = [{"id": u.id, "nome": u.nome, "email": u.email, "ativo": u.is_active} for u in users]
        db.close()
    except Exception as e:
        resultado["erro"] = str(e)
    return resultado

@app.get("/admin/seed-usuarios")
def seed_usuarios():
    import json
    from database import SessionLocal
    from models import Usuario
    from utils.security import get_password_hash
    db = SessionLocal()
    criados = []
    ADMPERMS = json.dumps(["pdv","vendas","compras","estoque","financeiro","relatorios","usuarios","configuracoes"])
    for nome, email, senha in [("marcio","marcio@amorin.com.br","amorin"),("karla","karla@nexusvarejo.com","amorin")]:
        u = db.query(Usuario).filter(Usuario.email == email).first()
        if not u:
            db.add(Usuario(nome=nome, email=email, senha_hash=get_password_hash(senha), perfil="ADMIN", is_active=True, permissoes=ADMPERMS))
            criados.append(f"criado: {nome}")
        else:
            u.senha_hash = get_password_hash(senha)
            u.is_active = True
            criados.append(f"atualizado: {nome}")
    db.commit(); db.close()
    return {"ok": True, "resultado": criados}

@app.get("/admin/reset-senha")
def reset_senha(email: str = "marcio@amorin.com.br", senha: str = "amorin"):
    from database import SessionLocal
    from models import Usuario
    from utils.security import get_password_hash
    db = SessionLocal()
    u = db.query(Usuario).filter(Usuario.email == email).first()
    if not u:
        return {"erro": "Usuário não encontrado"}
    u.senha_hash = get_password_hash(senha)
    u.is_active = True
    db.commit(); db.close()
    return {"ok": True, "mensagem": f"Senha de '{u.nome}' resetada"}
