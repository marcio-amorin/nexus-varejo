import sys, os, pathlib, threading, importlib, traceback as _tb
print("[BOOT] main.py loading...", file=sys.stderr)
sys.stderr.flush()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Pasta de imagens estáticas
try:
    _IMG_DIR = pathlib.Path(__file__).parent / "static" / "imagens" / "produtos"
    _IMG_DIR.mkdir(parents=True, exist_ok=True)
except Exception as _e:
    print(f"[WARN] mkdir static: {_e}", file=sys.stderr)

app = FastAPI(title="NexusVarejo API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    from fastapi.staticfiles import StaticFiles
    app.mount("/static", StaticFiles(directory=str(pathlib.Path(__file__).parent / "static")), name="static")
except Exception as _e:
    print(f"[WARN] static mount: {_e}", file=sys.stderr)

# ─── Endpoints básicos (disponíveis imediatamente) ────────────────────────────

@app.get("/")
def root():
    return {"status": "NexusVarejo API online", "version": "2.0.0"}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/debug")
def debug():
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

@app.get("/debug-ml")
async def debug_ml():
    import httpx, time
    t0 = time.time()
    resultados = {}

    # Pega o access_token do ML salvo no banco
    token = None
    try:
        from database import SessionLocal
        from models import AfiliadoConfig
        db = SessionLocal()
        cfg = db.query(AfiliadoConfig).filter_by(plataforma="ML_AFILIADOS").first()
        if cfg:
            token = cfg.access_token
        db.close()
    except Exception as e:
        resultados["db_erro"] = str(e)

    resultados["token_disponivel"] = bool(token)

    # Teste 1: sem token
    t1 = time.time()
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                "https://api.mercadolibre.com/sites/MLB/search",
                params={"q": "smartphone", "limit": 3},
                headers={"User-Agent": "Mozilla/5.0"}
            )
        data = r.json()
        resultados["sem_token"] = {"status": r.status_code, "total": data.get("paging", {}).get("total", 0), "tempo": round(time.time()-t1,2)}
    except Exception as e:
        resultados["sem_token"] = {"erro": str(e)}

    # Teste 2: com token (se disponível)
    if token:
        t2 = time.time()
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r2 = await client.get(
                    "https://api.mercadolibre.com/sites/MLB/search",
                    params={"q": "smartphone", "limit": 3},
                    headers={"Authorization": f"Bearer {token}", "User-Agent": "Mozilla/5.0"}
                )
            data2 = r2.json()
            itens = [{"titulo": p["title"][:50], "preco": p.get("price")} for p in data2.get("results", [])[:3]]
            resultados["com_token"] = {"status": r2.status_code, "total": data2.get("paging", {}).get("total", 0), "tempo": round(time.time()-t2,2), "itens": itens}
        except Exception as e:
            resultados["com_token"] = {"erro": str(e)}

    resultados["tempo_total"] = round(time.time()-t0, 2)
    return resultados

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


# ─── Init em background (não bloqueia abertura da porta) ─────────────────────

_ROUTES = [
    "auth", "usuarios", "produtos", "fornecedores", "clientes",
    "nf_entrada", "estoque", "vendas", "contas_pagar", "contas_receber",
    "dashboard", "relatorios", "compras", "pdv", "centros_custo",
    "inventario", "devolucoes", "marketplace", "gestao_precos", "fiscal",
    "agenda_compras", "verba_compras", "nf_saida", "trocas", "precos_nf",
    "formas_recebimento", "campanhas_v2", "pedido_venda", "impressoras",
    "contas_correntes", "convenio", "compradores", "apis_externas", "caixa",
    "afiliados", "vendedor",
]

def _background_init():
    print("[BG] Iniciando setup em background...", file=sys.stderr)
    sys.stderr.flush()

    # ── DB setup ────────────────────────────────────────────────────────────
    try:
        from database import engine, Base, SessionLocal, DATABASE_URL
        from models import Usuario
        from utils.security import get_password_hash
        from sqlalchemy import text

        IS_SQLITE = "sqlite" in DATABASE_URL
        print(f"[BG] DB: {'sqlite' if IS_SQLITE else 'postgresql'}", file=sys.stderr)
        sys.stderr.flush()

        with engine.connect() as _c:
            _c.execute(text("SELECT 1"))
        print("[BG] DB conectado OK", file=sys.stderr)
        sys.stderr.flush()

        def _add_col(conn, table, col, typ):
            try:
                if IS_SQLITE:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {typ}"))
                else:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {typ}"))
            except Exception:
                pass

        print("[BG] Criando tabelas...", file=sys.stderr); sys.stderr.flush()
        Base.metadata.create_all(bind=engine)

        print("[BG] Migrando colunas...", file=sys.stderr); sys.stderr.flush()
        with engine.connect() as conn:
            for table, col, typ in [
                ("vendas","canal","VARCHAR(30) DEFAULT 'PDV'"),
                ("vendas","troco_solidario_valor","FLOAT DEFAULT 0"),
                ("vendas","troco_solidario_inst","VARCHAR(200)"),
                ("vendas","cliente_cpf_fidelidade","VARCHAR(20)"),
                ("vendas","credito_devolucao_usado","FLOAT DEFAULT 0"),
                ("vendas","pdv_terminal","VARCHAR(50)"),
                ("vendas","tipo_fiscal","VARCHAR(20) DEFAULT 'CUPOM'"),
                ("movimentos_estoque","usuario_nome","VARCHAR(100)"),
                ("movimentos_estoque","centro_custo_id","INTEGER"),
                ("usuarios","permissoes","TEXT"),
                ("usuarios","ultimo_acesso","DATETIME"),
                ("produtos","cfop_saida","VARCHAR(10) DEFAULT '5102'"),
                ("produtos","cst_icms","VARCHAR(5) DEFAULT '000'"),
                ("produtos","csosn","VARCHAR(5) DEFAULT '400'"),
                ("produtos","icms_aliquota","FLOAT DEFAULT 0.0"),
                ("produtos","pis_aliquota","FLOAT DEFAULT 0.0"),
                ("produtos","cofins_aliquota","FLOAT DEFAULT 0.0"),
                ("produtos","cest","VARCHAR(10)"),
                ("produtos","pesavel","BOOLEAN DEFAULT 0"),
                ("produtos","plu_codigo","INTEGER"),
                ("produtos","enviar_balanca","BOOLEAN DEFAULT 0"),
                ("produtos","embalagem_codigo","VARCHAR(30)"),
                ("produtos","embalagem_qtd","INTEGER DEFAULT 1"),
                ("produtos","embalagem_desc","VARCHAR(80)"),
                ("produtos","embalagem_tipo","VARCHAR(5) DEFAULT 'CX'"),
                ("produtos","atacarejo","BOOLEAN DEFAULT 0"),
                ("produtos","atacarejo_qtd_min","INTEGER DEFAULT 3"),
                ("produtos","atacarejo_preco","FLOAT DEFAULT 0"),
                ("produtos","controla_validade","BOOLEAN DEFAULT 0"),
                ("produtos","dias_validade_alerta","INTEGER DEFAULT 30"),
                ("produtos","insumo_producao","BOOLEAN DEFAULT 0"),
                ("produtos","imagem_url","VARCHAR(500)"),
                ("fornecedores","vendedor_nome","VARCHAR(100)"),
                ("fornecedores","vendedor_telefone","VARCHAR(30)"),
                ("fornecedores","prazo_pagamento","VARCHAR(50)"),
                ("nf_saida","pedido_marketplace_id","INTEGER"),
                ("agenda_fornecedor","percentual_reposicao","FLOAT DEFAULT 0"),
                ("agenda_fornecedor","margem_seguranca_pct","FLOAT DEFAULT 0"),
                ("agenda_fornecedor","reposicao_adicional","FLOAT DEFAULT 0"),
                ("agenda_fornecedor","dias_venda_filtro","INTEGER DEFAULT 0"),
                ("agenda_fornecedor","gerar_automatico","BOOLEAN DEFAULT 1"),
                ("pedidos_compra","origem","VARCHAR(10) DEFAULT 'MANUAL'"),
                ("pedidos_venda","status_separacao","VARCHAR(20) DEFAULT 'PENDENTE'"),
                ("clientes","credito_rotativo","FLOAT DEFAULT 0"),
                ("formas_recebimento","gera_conta_receber","BOOLEAN DEFAULT 0"),
                ("formas_recebimento","vencimento_dias","INTEGER DEFAULT 0"),
                ("contas_correntes","cor","VARCHAR(7) DEFAULT '#6366f1'"),
                ("contas_correntes","icone","VARCHAR(10) DEFAULT '🏦'"),
                ("contas_correntes","observacoes","TEXT"),
            ]:
                _add_col(conn, table, col, typ)
            conn.commit()

        print("[BG] Seeds...", file=sys.stderr); sys.stderr.flush()
        try:
            from models import FormaRecebimento
            db = SessionLocal()
            for fs in [
                {"nome":"Dinheiro","chave":"DINHEIRO","icone":"💵","cor":"#34C759","ordem":1,"aceita_troco":True},
                {"nome":"Cartão de Débito","chave":"CARTAO_DEBITO","icone":"💳","cor":"#32ADE6","ordem":2,"aceita_troco":False},
                {"nome":"Cartão de Crédito","chave":"CARTAO_CREDITO","icone":"💳","cor":"#5856D6","ordem":3,"aceita_troco":False},
                {"nome":"Pix","chave":"PIX","icone":"📱","cor":"#00B37E","ordem":4,"aceita_troco":False},
                {"nome":"Crédito Rotativo","chave":"CREDITO_ROTATIVO","icone":"🔄","cor":"#FF9F0A","ordem":5,"aceita_troco":False},
                {"nome":"Convênio","chave":"CONVENIO","icone":"🤝","cor":"#AF52DE","ordem":6,"aceita_troco":False},
                {"nome":"Boleto","chave":"BOLETO","icone":"📄","cor":"#8E8E93","ordem":7,"aceita_troco":False},
                {"nome":"Crédito Devolução","chave":"CREDITO_DEVOLUCAO","icone":"↩️","cor":"#FF9F0A","ordem":8,"aceita_troco":False},
            ]:
                if not db.query(FormaRecebimento).filter(FormaRecebimento.chave == fs["chave"]).first():
                    db.add(FormaRecebimento(**fs, ativo=True, is_sistema=True))
            db.commit(); db.close()
        except Exception as e:
            print(f"[WARN] seed formas: {e}", file=sys.stderr)

        try:
            from models import ConfigEmpresa
            db = SessionLocal()
            if not db.query(ConfigEmpresa).first():
                db.add(ConfigEmpresa(razao_social="Minha Empresa Ltda", nome_fantasia="Minha Empresa",
                    regime_tributario="SIMPLES_NACIONAL", aliquota_simples=6.0, estado="SC"))
                db.commit()
            db.close()
        except Exception as e:
            print(f"[WARN] seed empresa: {e}", file=sys.stderr)

        try:
            from models import TabelaImposto
            db = SessionLocal()
            if not db.query(TabelaImposto).first():
                for s in [
                    TabelaImposto(regime="SIMPLES_NACIONAL", nome="Simples Nacional — Padrão",
                        icms_aliquota=0, pis_aliquota=0, cofins_aliquota=0, csll_aliquota=0, irpj_aliquota=0,
                        cfop_padrao="5102", cst_icms="400", csosn="400", is_default=True),
                    TabelaImposto(regime="LUCRO_PRESUMIDO", nome="Lucro Presumido — Padrão",
                        icms_aliquota=12.0, pis_aliquota=0.65, cofins_aliquota=3.0, csll_aliquota=9.0, irpj_aliquota=15.0,
                        cfop_padrao="5102", cst_icms="000", csosn="400", is_default=True),
                    TabelaImposto(regime="LUCRO_REAL", nome="Lucro Real — Padrão",
                        icms_aliquota=12.0, pis_aliquota=1.65, cofins_aliquota=7.6, csll_aliquota=9.0, irpj_aliquota=15.0,
                        cfop_padrao="5102", cst_icms="000", csosn="400", is_default=True),
                ]:
                    db.add(s)
                db.commit()
            db.close()
        except Exception as e:
            print(f"[WARN] seed impostos: {e}", file=sys.stderr)

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
                    db.add(Usuario(nome=uname, email=uemail, senha_hash=get_password_hash(usenha),
                        perfil=uperfil, is_active=True, permissoes=uperms))
                else:
                    u.senha_hash = get_password_hash(usenha); u.permissoes = uperms; u.is_active = True
            db.commit(); db.close()
        except Exception as e:
            print(f"[WARN] seed users: {e}", file=sys.stderr)

        try:
            from models import CategoriaProduto
            db = SessionLocal()
            for c in [
                {"nome":"Alimentos","icone":"🍎","cor":"#16A34A","margem_padrao":25.0},
                {"nome":"Bebidas","icone":"🥤","cor":"#2563EB","margem_padrao":30.0},
                {"nome":"Limpeza","icone":"🧹","cor":"#7C3AED","margem_padrao":35.0},
                {"nome":"Higiene","icone":"🧴","cor":"#0891B2","margem_padrao":40.0},
                {"nome":"Eletrônicos","icone":"📱","cor":"#EA580C","margem_padrao":20.0},
                {"nome":"Vestuário","icone":"👕","cor":"#BE185D","margem_padrao":60.0},
                {"nome":"Ferramentas","icone":"🔧","cor":"#92400E","margem_padrao":30.0},
                {"nome":"Outros","icone":"📦","cor":"#6B7280","margem_padrao":30.0},
            ]:
                if not db.query(CategoriaProduto).filter(CategoriaProduto.nome == c["nome"]).first():
                    db.add(CategoriaProduto(**c))
            db.commit(); db.close()
        except Exception as e:
            print(f"[WARN] seed cats: {e}", file=sys.stderr)

        try:
            from models import ParametroPDV
            db = SessionLocal()
            if not db.query(ParametroPDV).first():
                db.add(ParametroPDV(terminal="PDV-01", nome_loja="NexusVarejo",
                    desconto_maximo_pct=10.0, permite_venda_sem_estoque=True,
                    troco_solidario_ativo=True, impressao_cupom=True))
                db.commit()
            db.close()
        except Exception as e:
            print(f"[WARN] seed pdv: {e}", file=sys.stderr)

        print("[BG] DB setup concluído", file=sys.stderr); sys.stderr.flush()

    except Exception as e:
        print(f"[BG] DB erro: {e}", file=sys.stderr); sys.stderr.flush()

    # ── Carrega rotas ────────────────────────────────────────────────────────
    print("[BG] Carregando rotas...", file=sys.stderr); sys.stderr.flush()
    _failed = []
    for name in _ROUTES:
        try:
            mod = importlib.import_module(f"routes.{name}")
            app.include_router(mod.router)
        except Exception as e:
            _failed.append(name)
            print(f"[BG][ERROR] route '{name}': {e}\n{_tb.format_exc()}", file=sys.stderr)
        sys.stderr.flush()

    if _failed:
        print(f"[BG] Routes com erro: {_failed}", file=sys.stderr)
    else:
        print("[BG] Todas as rotas carregadas OK", file=sys.stderr)
    sys.stderr.flush()
    print("[BG] Init completo!", file=sys.stderr); sys.stderr.flush()


@app.on_event("startup")
async def _startup():
    threading.Thread(target=_background_init, daemon=True).start()

print("[BOOT] App criado. Aguardando uvicorn vincular porta...", file=sys.stderr)
sys.stderr.flush()
