from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, Date, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


# ─── Usuários ────────────────────────────────────────────────────────────────

class Usuario(Base):
    __tablename__ = "usuarios"

    id             = Column(Integer, primary_key=True, index=True)
    nome           = Column(String(100), nullable=False)
    email          = Column(String(150), unique=True, index=True, nullable=False)
    senha_hash     = Column(String(255), nullable=False)
    perfil         = Column(String(20), default="OPERADOR")  # ADMIN | GERENTE | OPERADOR | CAIXA
    permissoes     = Column(Text, nullable=True)            # JSON list
    is_active      = Column(Boolean, default=True)
    ultimo_acesso  = Column(DateTime(timezone=True), nullable=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())


# ─── Categorias de Produto ───────────────────────────────────────────────────

class CategoriaProduto(Base):
    __tablename__ = "categorias_produto"

    id            = Column(Integer, primary_key=True, index=True)
    nome          = Column(String(100), nullable=False)
    icone         = Column(String(10), default="📦")
    cor           = Column(String(7), default="#6366f1")
    margem_padrao = Column(Float, default=30.0)   # % de margem padrão da categoria
    is_active     = Column(Boolean, default=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    produtos = relationship("Produto", back_populates="categoria")


# ─── Produtos ────────────────────────────────────────────────────────────────

class Produto(Base):
    __tablename__ = "produtos"

    id               = Column(Integer, primary_key=True, index=True)
    codigo           = Column(String(50), unique=True, nullable=False, index=True)
    codigo_barras    = Column(String(50), nullable=True, index=True)
    descricao        = Column(String(200), nullable=False)
    unidade          = Column(String(10), default="UN")    # UN KG CX PC LT
    categoria_id     = Column(Integer, ForeignKey("categorias_produto.id"), nullable=True)
    ncm              = Column(String(10), nullable=True)
    preco_custo      = Column(Float, default=0.0)
    preco_venda      = Column(Float, default=0.0)
    margem           = Column(Float, default=30.0)         # % calculada ou definida
    estoque_atual    = Column(Float, default=0.0)
    estoque_minimo   = Column(Float, default=0.0)
    localizacao       = Column(String(50), nullable=True)
    observacoes       = Column(Text, nullable=True)
    is_active         = Column(Boolean, default=True)
    pesavel           = Column(Boolean, default=False)
    plu_codigo        = Column(Integer, nullable=True)
    enviar_balanca    = Column(Boolean, default=False)
    embalagem_codigo  = Column(String(30), nullable=True)
    embalagem_qtd     = Column(Integer, default=1)
    embalagem_desc    = Column(String(80), nullable=True)
    embalagem_tipo    = Column(String(5), default='CX')
    atacarejo          = Column(Boolean, default=False)
    atacarejo_qtd_min  = Column(Integer, default=3)
    atacarejo_preco    = Column(Float, default=0.0)
    controla_validade  = Column(Boolean, default=False)
    dias_validade_alerta = Column(Integer, default=30)
    insumo_producao    = Column(Boolean, default=False)
    imagem_url         = Column(String(500), nullable=True)
    created_at         = Column(DateTime(timezone=True), server_default=func.now())
    updated_at         = Column(DateTime(timezone=True), onupdate=func.now())

    categoria         = relationship("CategoriaProduto", back_populates="produtos")
    itens_nf          = relationship("ItemNFEntrada", back_populates="produto")
    movimentos        = relationship("MovimentoEstoque", back_populates="produto")
    itens_venda       = relationship("ItemVenda", back_populates="produto")
    fornecedores_link = relationship("ProdutoFornecedor", back_populates="produto", cascade="all, delete-orphan")


# ─── Fornecedores ────────────────────────────────────────────────────────────

class Fornecedor(Base):
    __tablename__ = "fornecedores"

    id            = Column(Integer, primary_key=True, index=True)
    razao_social  = Column(String(200), nullable=False)
    fantasia      = Column(String(200), nullable=True)
    cnpj_cpf      = Column(String(20), nullable=True, index=True)
    ie            = Column(String(30), nullable=True)
    email         = Column(String(150), nullable=True)
    telefone      = Column(String(20), nullable=True)
    celular       = Column(String(20), nullable=True)
    rua           = Column(String(200), nullable=True)
    numero        = Column(String(20), nullable=True)
    complemento   = Column(String(100), nullable=True)
    bairro        = Column(String(100), nullable=True)
    cidade        = Column(String(100), nullable=True)
    estado        = Column(String(2), nullable=True)
    cep           = Column(String(10), nullable=True)
    observacoes   = Column(Text, nullable=True)
    is_active     = Column(Boolean, default=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    prazo_pagamento   = Column(String(50),  nullable=True)

    notas_fiscais    = relationship("NotaFiscalEntrada", back_populates="fornecedor")
    contas_pagar     = relationship("ContaPagar", back_populates="fornecedor")
    representantes   = relationship("FornecedorRepresentante", back_populates="fornecedor", cascade="all, delete-orphan")


# ─── Representantes do Fornecedor ───────────────────────────────────────────

class FornecedorRepresentante(Base):
    __tablename__ = "fornecedor_representantes"

    id            = Column(Integer, primary_key=True, index=True)
    fornecedor_id = Column(Integer, ForeignKey("fornecedores.id"), nullable=False)
    nome          = Column(String(100), nullable=False)
    telefone      = Column(String(30),  nullable=True)
    email         = Column(String(150), nullable=True)
    divisao       = Column(String(100), nullable=True)
    principal     = Column(Boolean, default=False)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    fornecedor = relationship("Fornecedor", back_populates="representantes")


# ─── Produto × Fornecedor (N:N) ──────────────────────────────────────────────

class ProdutoFornecedor(Base):
    __tablename__ = "produto_fornecedores"

    id            = Column(Integer, primary_key=True, index=True)
    produto_id    = Column(Integer, ForeignKey("produtos.id"), nullable=False)
    fornecedor_id = Column(Integer, ForeignKey("fornecedores.id"), nullable=False)
    principal     = Column(Boolean, default=False)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    produto    = relationship("Produto",     back_populates="fornecedores_link")
    fornecedor = relationship("Fornecedor")


# ─── Clientes ────────────────────────────────────────────────────────────────

class Cliente(Base):
    __tablename__ = "clientes"

    id             = Column(Integer, primary_key=True, index=True)
    nome           = Column(String(200), nullable=False)
    tipo           = Column(String(5), default="PF")       # PF | PJ
    documento      = Column(String(20), nullable=True, index=True)   # CPF ou CNPJ
    ie             = Column(String(30), nullable=True)
    email          = Column(String(150), nullable=True)
    telefone       = Column(String(20), nullable=True)
    celular        = Column(String(20), nullable=True)
    rua            = Column(String(200), nullable=True)
    numero         = Column(String(20), nullable=True)
    complemento    = Column(String(100), nullable=True)
    bairro         = Column(String(100), nullable=True)
    cidade         = Column(String(100), nullable=True)
    estado         = Column(String(2), nullable=True)
    cep            = Column(String(10), nullable=True)
    limite_credito    = Column(Float, default=0.0)
    credito_rotativo  = Column(Float, default=0.0)   # limite crédito rotativo/convênio
    observacoes       = Column(Text, nullable=True)
    is_active         = Column(Boolean, default=True)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())

    vendas           = relationship("Venda", back_populates="cliente")
    contas_receber   = relationship("ContaReceber", back_populates="cliente")


# ─── Nota Fiscal de Entrada ──────────────────────────────────────────────────

class NotaFiscalEntrada(Base):
    __tablename__ = "nf_entrada"

    id                = Column(Integer, primary_key=True, index=True)
    numero            = Column(String(20), nullable=False)
    serie             = Column(String(5), default="1")
    fornecedor_id     = Column(Integer, ForeignKey("fornecedores.id"), nullable=False)
    data_emissao      = Column(Date, nullable=False)
    data_entrada      = Column(Date, nullable=False)
    chave_nfe         = Column(String(50), nullable=True)
    valor_produtos    = Column(Float, default=0.0)
    valor_frete       = Column(Float, default=0.0)
    valor_outros      = Column(Float, default=0.0)
    valor_desconto    = Column(Float, default=0.0)
    valor_total       = Column(Float, default=0.0)
    condicao_pagamento = Column(String(20), default="A_VISTA")  # A_VISTA | PRAZO
    prazo_dias        = Column(String(100), nullable=True)      # ex: "30,60,90"
    status            = Column(String(20), default="RECEBIDA")  # RECEBIDA | CANCELADA
    observacoes       = Column(Text, nullable=True)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())

    fornecedor  = relationship("Fornecedor", back_populates="notas_fiscais")
    itens       = relationship("ItemNFEntrada", back_populates="nf", cascade="all, delete-orphan")
    contas_pagar = relationship("ContaPagar", back_populates="nf")


class ItemNFEntrada(Base):
    __tablename__ = "itens_nf_entrada"

    id                    = Column(Integer, primary_key=True, index=True)
    nf_id                 = Column(Integer, ForeignKey("nf_entrada.id"), nullable=False)
    produto_id            = Column(Integer, ForeignKey("produtos.id"), nullable=False)
    quantidade            = Column(Float, nullable=False)
    preco_unitario        = Column(Float, nullable=False)   # custo de compra
    desconto              = Column(Float, default=0.0)
    valor_total           = Column(Float, nullable=False)
    margem_aplicada       = Column(Float, default=30.0)     # margem usada para calcular preço venda
    preco_venda_calculado = Column(Float, default=0.0)      # custo / (1 - margem/100)
    atualizar_preco       = Column(Boolean, default=True)   # atualiza preço de venda do produto

    nf      = relationship("NotaFiscalEntrada", back_populates="itens")
    produto = relationship("Produto", back_populates="itens_nf")


# ─── Movimentos de Estoque ───────────────────────────────────────────────────

class MovimentoEstoque(Base):
    __tablename__ = "movimentos_estoque"

    id              = Column(Integer, primary_key=True, index=True)
    produto_id      = Column(Integer, ForeignKey("produtos.id"), nullable=False)
    tipo            = Column(String(20), nullable=False)    # ENTRADA | SAIDA | AJUSTE
    quantidade      = Column(Float, nullable=False)
    custo_unitario  = Column(Float, default=0.0)
    valor_total     = Column(Float, default=0.0)
    data            = Column(Date, nullable=False)
    origem          = Column(String(20), nullable=True)     # NF_ENTRADA | VENDA | AJUSTE
    origem_id       = Column(Integer, nullable=True)        # id da NF ou Venda
    documento_ref   = Column(String(50), nullable=True)     # número da NF ou Venda
    observacao      = Column(Text, nullable=True)
    usuario_nome    = Column(String(100), nullable=True)
    centro_custo_id = Column(Integer, nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    produto = relationship("Produto", back_populates="movimentos")


# ─── Vendas / PDV ────────────────────────────────────────────────────────────

class Venda(Base):
    __tablename__ = "vendas"

    id               = Column(Integer, primary_key=True, index=True)
    numero           = Column(String(20), unique=True, nullable=False)   # VD-0001
    cliente_id       = Column(Integer, ForeignKey("clientes.id"), nullable=True)
    cliente_nome     = Column(String(200), nullable=True)    # venda sem cadastro
    data_venda       = Column(Date, nullable=False)
    subtotal         = Column(Float, default=0.0)
    desconto         = Column(Float, default=0.0)
    total            = Column(Float, default=0.0)
    forma_pagamento  = Column(String(30), default="DINHEIRO")
    # DINHEIRO | CARTAO_DEBITO | CARTAO_CREDITO | PIX | BOLETO | CREDIARIO | MISTO
    parcelas         = Column(Integer, default=1)
    troco            = Column(Float, default=0.0)
    status                  = Column(String(20), default="FINALIZADA")
    # ABERTA | FINALIZADA | CANCELADA
    operador                = Column(String(100), nullable=True)
    observacoes             = Column(Text, nullable=True)
    canal                   = Column(String(30), default="PDV")
    troco_solidario_valor   = Column(Float, default=0.0)
    troco_solidario_inst    = Column(String(200), nullable=True)
    cliente_cpf_fidelidade  = Column(String(20), nullable=True)
    credito_devolucao_usado = Column(Float, default=0.0)
    pdv_terminal            = Column(String(50), nullable=True)
    tipo_fiscal             = Column(String(20), default="CUPOM")   # CUPOM | NFCE | NFE
    created_at              = Column(DateTime(timezone=True), server_default=func.now())

    cliente          = relationship("Cliente", back_populates="vendas")
    itens            = relationship("ItemVenda", back_populates="venda", cascade="all, delete-orphan")
    contas_receber   = relationship("ContaReceber", back_populates="venda")


class ItemVenda(Base):
    __tablename__ = "itens_venda"

    id               = Column(Integer, primary_key=True, index=True)
    venda_id         = Column(Integer, ForeignKey("vendas.id"), nullable=False)
    produto_id       = Column(Integer, ForeignKey("produtos.id"), nullable=False)
    descricao_snap   = Column(String(200), nullable=True)   # snapshot
    quantidade       = Column(Float, nullable=False)
    preco_unitario   = Column(Float, nullable=False)
    desconto_item    = Column(Float, default=0.0)
    total_item       = Column(Float, nullable=False)
    custo_unitario   = Column(Float, default=0.0)           # snapshot do custo

    venda   = relationship("Venda", back_populates="itens")
    produto = relationship("Produto", back_populates="itens_venda")


# ─── Contas a Pagar ──────────────────────────────────────────────────────────

class ContaPagar(Base):
    __tablename__ = "contas_pagar"

    id               = Column(Integer, primary_key=True, index=True)
    fornecedor_id    = Column(Integer, ForeignKey("fornecedores.id"), nullable=True)
    nf_id            = Column(Integer, ForeignKey("nf_entrada.id"), nullable=True)
    descricao        = Column(String(255), nullable=False)
    valor            = Column(Float, nullable=False)
    vencimento       = Column(Date, nullable=False)
    status           = Column(String(20), default="PENDENTE")
    # PENDENTE | PAGO | VENCIDO | CANCELADO
    forma_pagamento  = Column(String(30), nullable=True)
    pago_em          = Column(Date, nullable=True)
    valor_pago       = Column(Float, nullable=True)
    parcela_num      = Column(Integer, default=1)
    total_parcelas   = Column(Integer, default=1)
    observacoes      = Column(Text, nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    fornecedor = relationship("Fornecedor", back_populates="contas_pagar")
    nf         = relationship("NotaFiscalEntrada", back_populates="contas_pagar")


# ─── Contas a Receber ────────────────────────────────────────────────────────

class ContaReceber(Base):
    __tablename__ = "contas_receber"

    id               = Column(Integer, primary_key=True, index=True)
    cliente_id       = Column(Integer, ForeignKey("clientes.id"), nullable=True)
    venda_id         = Column(Integer, ForeignKey("vendas.id"), nullable=True)
    descricao        = Column(String(255), nullable=False)
    valor            = Column(Float, nullable=False)
    vencimento       = Column(Date, nullable=False)
    status           = Column(String(20), default="PENDENTE")
    # PENDENTE | RECEBIDO | VENCIDO | CANCELADO
    forma_pagamento  = Column(String(30), nullable=True)
    recebido_em      = Column(Date, nullable=True)
    valor_recebido   = Column(Float, nullable=True)
    parcela_num      = Column(Integer, default=1)
    total_parcelas   = Column(Integer, default=1)
    observacoes      = Column(Text, nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    cliente = relationship("Cliente", back_populates="contas_receber")
    venda   = relationship("Venda", back_populates="contas_receber")


# ─── Módulo Compras ──────────────────────────────────────────────────────────

class PedidoCompra(Base):
    __tablename__ = "pedidos_compra"

    id             = Column(Integer, primary_key=True, index=True)
    numero         = Column(String(20), unique=True, nullable=False)   # PC-00001
    fornecedor_id  = Column(Integer, ForeignKey("fornecedores.id"), nullable=False)
    status         = Column(String(20), default="RASCUNHO")
    # RASCUNHO | ENVIADO | PARCIAL | RECEBIDO | CANCELADO
    origem         = Column(String(10), default="MANUAL")   # MANUAL | AUTO
    data_pedido    = Column(Date, nullable=False)
    prazo_entrega  = Column(Date, nullable=True)
    valor_total    = Column(Float, default=0.0)
    observacoes    = Column(Text, nullable=True)
    criado_por     = Column(String(100), nullable=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), onupdate=func.now())

    fornecedor   = relationship("Fornecedor")
    itens        = relationship("ItemPedidoCompra", back_populates="pedido", cascade="all, delete-orphan")
    solicitacoes = relationship("SolicitacaoCompra", back_populates="pedido")


class ItemPedidoCompra(Base):
    __tablename__ = "itens_pedido_compra"

    id              = Column(Integer, primary_key=True, index=True)
    pedido_id       = Column(Integer, ForeignKey("pedidos_compra.id"), nullable=False)
    produto_id      = Column(Integer, ForeignKey("produtos.id"), nullable=False)
    quantidade      = Column(Float, nullable=False)
    preco_unitario  = Column(Float, default=0.0)
    valor_total     = Column(Float, default=0.0)
    solicitacao_id  = Column(Integer, ForeignKey("solicitacoes_compra.id"), nullable=True)

    pedido  = relationship("PedidoCompra", back_populates="itens")
    produto = relationship("Produto")


class SolicitacaoCompra(Base):
    __tablename__ = "solicitacoes_compra"

    id                  = Column(Integer, primary_key=True, index=True)
    produto_id          = Column(Integer, ForeignKey("produtos.id"), nullable=False)
    quantidade_sugerida = Column(Float, nullable=False)
    estoque_momento     = Column(Float, default=0.0)   # snapshot do estoque ao lançar
    prioridade          = Column(String(20), default="NORMAL")   # NORMAL | URGENTE | CRITICA
    status              = Column(String(20), default="PENDENTE") # PENDENTE | EM_PEDIDO | CONCLUIDA | CANCELADA
    observacao          = Column(Text, nullable=True)
    criado_por          = Column(String(100), nullable=True)
    pedido_id           = Column(Integer, ForeignKey("pedidos_compra.id"), nullable=True)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())

    produto = relationship("Produto")
    pedido  = relationship("PedidoCompra", back_populates="solicitacoes")


# ─── PDV — Parâmetros e Troco Solidário ──────────────────────────────────────

class ParametroPDV(Base):
    __tablename__ = "parametros_pdv"
    id                        = Column(Integer, primary_key=True, index=True)
    terminal                  = Column(String(50), default="PDV-01")
    nome_loja                 = Column(String(200), default="NexusVarejo")
    cnpj_loja                 = Column(String(20), nullable=True)
    endereco_loja             = Column(String(300), nullable=True)
    operador_obrigatorio      = Column(Boolean, default=True)
    cliente_cpf_obrigatorio   = Column(Boolean, default=False)
    desconto_maximo_pct       = Column(Float, default=10.0)
    permite_venda_sem_estoque = Column(Boolean, default=True)
    troco_solidario_ativo     = Column(Boolean, default=True)
    impressao_cupom           = Column(Boolean, default=True)
    mensagem_cupom            = Column(Text, nullable=True)
    exige_senha_supervisor    = Column(Boolean, default=False)
    logo_url                  = Column(String(500), nullable=True)
    solicitar_cpf_inicio      = Column(Boolean, default=False)
    updated_at                = Column(DateTime(timezone=True), onupdate=func.now())


class OperadorPDV(Base):
    __tablename__ = "operadores_pdv"
    id          = Column(Integer, primary_key=True, index=True)
    numero      = Column(Integer, unique=True, nullable=False, index=True)
    nome        = Column(String(100), nullable=False)
    senha_hash  = Column(String(255), nullable=True)
    perfil      = Column(String(20), default="OPERADOR")   # OPERADOR | SUPERVISOR
    is_active   = Column(Boolean, default=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())


class CaixaAbertura(Base):
    __tablename__ = "caixa_aberturas"
    id           = Column(Integer, primary_key=True, index=True)
    terminal     = Column(String(50), nullable=False)
    operador_num = Column(Integer, nullable=False)
    fundo_caixa  = Column(Float, default=0.0)
    aberto_em    = Column(DateTime(timezone=True), server_default=func.now())
    fechado_em   = Column(DateTime(timezone=True), nullable=True)
    total_vendas = Column(Float, default=0.0)
    is_aberto    = Column(Boolean, default=True)


class MovimentoCaixa(Base):
    __tablename__ = "movimentos_caixa"
    id              = Column(Integer, primary_key=True, index=True)
    caixa_id        = Column(Integer, ForeignKey("caixa_aberturas.id"), nullable=False)
    tipo            = Column(String(20), nullable=False)  # SANGRIA | SUPRIMENTO | ABERTURA | FECHAMENTO
    valor           = Column(Float, nullable=False)
    observacao      = Column(String(200), nullable=True)
    operador        = Column(String(100), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    caixa = relationship("CaixaAbertura", backref="movimentos")


class InstituicaoTrocoSolidario(Base):
    __tablename__ = "instituicoes_troco_solidario"
    id               = Column(Integer, primary_key=True, index=True)
    nome             = Column(String(200), nullable=False)
    descricao        = Column(Text, nullable=True)
    cnpj             = Column(String(20), nullable=True)
    is_active        = Column(Boolean, default=True)
    total_arrecadado = Column(Float, default=0.0)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())


# ─── Centro de Custo ─────────────────────────────────────────────────────────

class CentroCusto(Base):
    __tablename__ = "centros_custo"
    id           = Column(Integer, primary_key=True, index=True)
    codigo       = Column(String(20), nullable=False, unique=True)
    nome         = Column(String(200), nullable=False)
    departamento = Column(String(100), nullable=True)
    descricao    = Column(Text, nullable=True)
    is_active    = Column(Boolean, default=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())


# ─── Inventário de Estoque ───────────────────────────────────────────────────

class InventarioEstoque(Base):
    __tablename__ = "inventarios_estoque"
    id           = Column(Integer, primary_key=True, index=True)
    numero       = Column(String(20), unique=True, nullable=False)
    descricao    = Column(String(200), nullable=True)
    tipo         = Column(String(20), default="TOTAL")    # TOTAL | PARCIAL
    status       = Column(String(20), default="ABERTO")   # ABERTO | FINALIZADO | CANCELADO
    data_inicio  = Column(Date, nullable=False)
    data_fim     = Column(Date, nullable=True)
    criado_por   = Column(String(100), nullable=True)
    observacoes  = Column(Text, nullable=True)
    total_itens  = Column(Integer, default=0)
    divergencias = Column(Integer, default=0)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    itens = relationship("ItemInventario", back_populates="inventario", cascade="all, delete-orphan")


class ItemInventario(Base):
    __tablename__ = "itens_inventario"
    id              = Column(Integer, primary_key=True, index=True)
    inventario_id   = Column(Integer, ForeignKey("inventarios_estoque.id"), nullable=False)
    produto_id      = Column(Integer, ForeignKey("produtos.id"), nullable=False)
    estoque_sistema = Column(Float, default=0.0)
    estoque_contado = Column(Float, nullable=True)
    diferenca       = Column(Float, default=0.0)
    ajustado        = Column(Boolean, default=False)
    validar         = Column(Boolean, default=False)
    recontar        = Column(Boolean, default=False)
    manter          = Column(Boolean, default=False)

    inventario = relationship("InventarioEstoque", back_populates="itens")
    produto    = relationship("Produto")


# ─── Devolução de Mercadoria ─────────────────────────────────────────────────

class DevolucaoMercadoria(Base):
    __tablename__ = "devolucoes_mercadoria"
    id                 = Column(Integer, primary_key=True, index=True)
    numero             = Column(String(20), unique=True, nullable=False)
    cliente_id         = Column(Integer, ForeignKey("clientes.id"), nullable=True)
    cliente_nome       = Column(String(200), nullable=True)
    cliente_cpf        = Column(String(20), nullable=True, index=True)
    venda_id           = Column(Integer, ForeignKey("vendas.id"), nullable=True)
    venda_numero       = Column(String(20), nullable=True)
    status             = Column(String(20), default="APROVADA")  # APROVADA | CANCELADA
    motivo             = Column(String(200), nullable=True)
    valor_total        = Column(Float, default=0.0)
    credito_gerado     = Column(Float, default=0.0)
    credito_disponivel = Column(Float, default=0.0)
    credito_usado      = Column(Float, default=0.0)
    data_devolucao     = Column(Date, nullable=False)
    operador           = Column(String(100), nullable=True)
    observacoes        = Column(Text, nullable=True)
    created_at         = Column(DateTime(timezone=True), server_default=func.now())

    itens   = relationship("ItemDevolucao", back_populates="devolucao", cascade="all, delete-orphan")
    cliente = relationship("Cliente")


class ItemDevolucao(Base):
    __tablename__ = "itens_devolucao"
    id             = Column(Integer, primary_key=True, index=True)
    devolucao_id   = Column(Integer, ForeignKey("devolucoes_mercadoria.id"), nullable=False)
    produto_id     = Column(Integer, ForeignKey("produtos.id"), nullable=False)
    quantidade     = Column(Float, nullable=False)
    preco_unitario = Column(Float, nullable=False)
    total_item     = Column(Float, nullable=False)

    devolucao = relationship("DevolucaoMercadoria", back_populates="itens")
    produto   = relationship("Produto")


# ─── Configuração da Empresa / Fiscal ────────────────────────────────────────

class ConfigEmpresa(Base):
    __tablename__ = "config_empresa"
    id                = Column(Integer, primary_key=True, index=True)
    razao_social      = Column(String(200), default="")
    nome_fantasia     = Column(String(200), default="")
    cnpj              = Column(String(20), default="")
    ie                = Column(String(30), default="")
    im                = Column(String(30), default="")
    endereco          = Column(String(300), default="")
    numero            = Column(String(20), default="")
    complemento       = Column(String(100), default="")
    bairro            = Column(String(100), default="")
    cidade            = Column(String(100), default="")
    estado            = Column(String(2), default="SC")
    cep               = Column(String(10), default="")
    telefone          = Column(String(20), default="")
    email             = Column(String(150), default="")
    cnae              = Column(String(10), default="")
    regime_tributario = Column(String(30), default="SIMPLES_NACIONAL")
    # SIMPLES_NACIONAL | LUCRO_PRESUMIDO | LUCRO_REAL
    aliquota_simples  = Column(Float, default=6.0)   # % DAS para Simples
    updated_at        = Column(DateTime(timezone=True), onupdate=func.now())


class TabelaImposto(Base):
    __tablename__ = "tabela_impostos"
    id              = Column(Integer, primary_key=True, index=True)
    regime          = Column(String(30), nullable=False)
    nome            = Column(String(100), nullable=False)
    icms_aliquota   = Column(Float, default=12.0)
    pis_aliquota    = Column(Float, default=0.0)
    cofins_aliquota = Column(Float, default=0.0)
    csll_aliquota   = Column(Float, default=0.0)
    irpj_aliquota   = Column(Float, default=0.0)
    cfop_padrao     = Column(String(10), default="5102")
    cst_icms        = Column(String(5), default="000")   # LP / LR
    csosn           = Column(String(5), default="400")   # Simples
    is_default      = Column(Boolean, default=False)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())


# ─── Gestão de Preços ────────────────────────────────────────────────────────

class ProgramacaoPreco(Base):
    __tablename__ = "programacoes_preco"
    id          = Column(Integer, primary_key=True, index=True)
    produto_id  = Column(Integer, ForeignKey("produtos.id"), nullable=False)
    preco_novo  = Column(Float, nullable=False)
    data_inicio = Column(Date, nullable=False)
    data_fim    = Column(Date, nullable=True)
    motivo      = Column(String(200), nullable=True)
    status      = Column(String(20), default="AGUARDANDO")  # AGUARDANDO | ATIVO | EXPIRADO | CANCELADO
    criado_por  = Column(String(100), nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    produto     = relationship("Produto")


class CampanhaPromocional(Base):
    __tablename__ = "campanhas_promocionais"
    id             = Column(Integer, primary_key=True, index=True)
    nome           = Column(String(200), nullable=False)
    descricao      = Column(Text, nullable=True)
    tipo_desconto  = Column(String(20), default="PERCENTUAL")  # PERCENTUAL | VALOR | PRECO_FIXO
    valor_desconto = Column(Float, default=0.0)
    data_inicio    = Column(Date, nullable=False)
    data_fim       = Column(Date, nullable=False)
    ativo          = Column(Boolean, default=True)
    criado_por     = Column(String(100), nullable=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    itens          = relationship("CampanhaItem", back_populates="campanha", cascade="all, delete-orphan")


class CampanhaItem(Base):
    __tablename__ = "campanha_itens"
    id           = Column(Integer, primary_key=True, index=True)
    campanha_id  = Column(Integer, ForeignKey("campanhas_promocionais.id"), nullable=False)
    produto_id   = Column(Integer, ForeignKey("produtos.id"), nullable=False)
    preco_oferta = Column(Float, nullable=True)
    campanha     = relationship("CampanhaPromocional", back_populates="itens")
    produto      = relationship("Produto")


class ConfigBalanca(Base):
    __tablename__ = "config_balanca"
    id                    = Column(Integer, primary_key=True, index=True)
    pasta_destino         = Column(String(500), nullable=True)
    nome_arquivo          = Column(String(100), default="PLU.TXT")
    formato               = Column(String(20), default="TOLEDO")  # TOLEDO | CSV | FILIZOLA
    separador             = Column(String(5), default="|")
    incluir_codigo_barras = Column(Boolean, default=True)
    incluir_validade      = Column(Boolean, default=False)
    validade_dias         = Column(Integer, default=30)
    apenas_ativos         = Column(Boolean, default=True)
    updated_at            = Column(DateTime(timezone=True), onupdate=func.now())


# ─── Marketplace ─────────────────────────────────────────────────────────────

class MarketplaceIntegracao(Base):
    __tablename__ = "marketplace_integracoes"
    id               = Column(Integer, primary_key=True, index=True)
    plataforma       = Column(String(30), unique=True, nullable=False)
    # MERCADOLIVRE | SHOPEE | ZEDELIVERY | IFOOD
    ativo            = Column(Boolean, default=False)
    client_id        = Column(String(300), nullable=True)
    client_secret    = Column(String(300), nullable=True)
    access_token     = Column(String(1000), nullable=True)
    store_id         = Column(String(200), nullable=True)
    status_conexao   = Column(String(20), default="DESCONECTADO")
    ultima_sync      = Column(DateTime(timezone=True), nullable=True)
    total_pedidos    = Column(Integer, default=0)
    pedidos_novos    = Column(Integer, default=0)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), onupdate=func.now())

    pedidos = relationship("PedidoMarketplace", back_populates="integracao")


class PedidoMarketplace(Base):
    __tablename__ = "pedidos_marketplace"
    id               = Column(Integer, primary_key=True, index=True)
    integracao_id    = Column(Integer, ForeignKey("marketplace_integracoes.id"), nullable=False)
    plataforma       = Column(String(30), nullable=False)
    numero_externo   = Column(String(100), nullable=False)
    cliente_nome     = Column(String(200), nullable=True)
    cliente_doc      = Column(String(30), nullable=True)
    cliente_telefone = Column(String(30), nullable=True)
    status           = Column(String(30), default="NOVO")
    # NOVO | EM_PREPARACAO | PRONTO | ENVIADO | ENTREGUE | CANCELADO
    total            = Column(Float, default=0.0)
    itens_json       = Column(Text, nullable=True)
    endereco_json    = Column(Text, nullable=True)
    forma_pagamento  = Column(String(50), nullable=True)
    observacoes      = Column(Text, nullable=True)
    criado_em        = Column(DateTime(timezone=True), nullable=True)
    updated_at       = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    integracao = relationship("MarketplaceIntegracao", back_populates="pedidos")


# ─── Agenda do Fornecedor ────────────────────────────────────────────────────

class AgendaFornecedor(Base):
    __tablename__ = "agenda_fornecedor"

    id                   = Column(Integer, primary_key=True, index=True)
    fornecedor_id        = Column(Integer, ForeignKey("fornecedores.id"), nullable=False, unique=True)
    frequencia_dias      = Column(Integer, default=7)      # a cada quantos dias visita
    proxima_visita       = Column(Date, nullable=True)
    dias_media_venda     = Column(Integer, default=15)     # período para calcular média de venda
    dias_entrega         = Column(Integer, default=2)      # prazo de entrega em dias
    ativo                = Column(Boolean, default=True)
    observacoes          = Column(Text, nullable=True)
    # ── Parâmetros de reposição (Logus-inspired) ──────────────────────────
    percentual_reposicao = Column(Float, default=0.0)  # % extra sobre qty base
    margem_seguranca_pct = Column(Float, default=0.0)  # % buffer de segurança
    reposicao_adicional  = Column(Float, default=0.0)  # qty fixa extra
    dias_venda_filtro    = Column(Integer, default=0)  # 0=usa dias_media_venda
    gerar_automatico     = Column(Boolean, default=True)  # participar da auto-geração D-2
    created_at           = Column(DateTime(timezone=True), server_default=func.now())

    fornecedor = relationship("Fornecedor")


# ─── Verba de Compras ────────────────────────────────────────────────────────

class VerbaCompras(Base):
    __tablename__ = "verba_compras"

    id                     = Column(Integer, primary_key=True, index=True)
    mes                    = Column(String(7), nullable=False, unique=True)   # YYYY-MM
    valor_definido         = Column(Float, default=0.0)
    percentual_faturamento = Column(Float, default=70.0)
    aprovado_por           = Column(String(100), nullable=True)
    observacoes            = Column(Text, nullable=True)
    created_at             = Column(DateTime(timezone=True), server_default=func.now())


# ─── NF-e de Saída ───────────────────────────────────────────────────────────

class NFSaida(Base):
    __tablename__ = "nf_saida"

    id             = Column(Integer, primary_key=True, index=True)
    numero         = Column(Integer, nullable=False)
    serie          = Column(String(5), default="1")
    cliente_id     = Column(Integer, ForeignKey("clientes.id"), nullable=True)
    cliente_nome   = Column(String(200), nullable=True)
    cliente_doc    = Column(String(20), nullable=True)
    data_emissao   = Column(Date, nullable=False)
    cfop           = Column(String(10), default="5102")
    valor_produtos = Column(Float, default=0.0)
    valor_frete    = Column(Float, default=0.0)
    valor_desconto = Column(Float, default=0.0)
    valor_total    = Column(Float, default=0.0)
    valor_tributos = Column(Float, default=0.0)
    chave_nfe      = Column(String(50), nullable=True)
    protocolo      = Column(String(50), nullable=True)
    status         = Column(String(20), default="RASCUNHO")  # RASCUNHO | AUTORIZADA | CANCELADA | REJEITADA
    observacoes    = Column(Text, nullable=True)
    venda_id       = Column(Integer, ForeignKey("vendas.id"), nullable=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())

    cliente = relationship("Cliente")
    itens   = relationship("ItemNFSaida", back_populates="nf", cascade="all, delete-orphan")


class ItemNFSaida(Base):
    __tablename__ = "itens_nf_saida"

    id              = Column(Integer, primary_key=True, index=True)
    nf_id           = Column(Integer, ForeignKey("nf_saida.id"), nullable=False)
    produto_id      = Column(Integer, ForeignKey("produtos.id"), nullable=True)
    descricao       = Column(String(200), nullable=False)
    ncm             = Column(String(10), nullable=True)
    cfop            = Column(String(10), default="5102")
    cst_icms        = Column(String(5), default="400")
    quantidade      = Column(Float, nullable=False)
    preco_unitario  = Column(Float, nullable=False)
    desconto        = Column(Float, default=0.0)
    valor_total     = Column(Float, default=0.0)
    icms_aliquota   = Column(Float, default=0.0)
    pis_aliquota    = Column(Float, default=0.0)
    cofins_aliquota = Column(Float, default=0.0)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    nf      = relationship("NFSaida", back_populates="itens")
    produto = relationship("Produto")


# ─── Trocas ──────────────────────────────────────────────────────────────────

class Troca(Base):
    __tablename__ = "trocas"

    id               = Column(Integer, primary_key=True, index=True)
    numero           = Column(String(20), unique=True, nullable=False)
    tipo             = Column(String(20), nullable=False)    # CLIENTE | FORNECEDOR
    status           = Column(String(20), default="PENDENTE")  # PENDENTE | APROVADA | CONCLUIDA | CANCELADA
    data_solicitacao = Column(Date, nullable=False)
    cliente_id       = Column(Integer, ForeignKey("clientes.id"), nullable=True)
    fornecedor_id    = Column(Integer, ForeignKey("fornecedores.id"), nullable=True)
    venda_id         = Column(Integer, ForeignKey("vendas.id"), nullable=True)
    nf_entrada_id    = Column(Integer, ForeignKey("nf_entrada.id"), nullable=True)
    motivo           = Column(String(50), nullable=False)  # DEFEITO | VENCIMENTO | AVARIA | INSATISFACAO | ERRO_PEDIDO
    resolucao        = Column(String(50), nullable=True)   # PRODUTO | CREDITO | REEMBOLSO | DESCONTO
    valor_total      = Column(Float, default=0.0)
    observacoes      = Column(Text, nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    cliente    = relationship("Cliente")
    fornecedor = relationship("Fornecedor")
    itens      = relationship("ItemTroca", back_populates="troca", cascade="all, delete-orphan")


class ItemTroca(Base):
    __tablename__ = "itens_troca"

    id          = Column(Integer, primary_key=True, index=True)
    troca_id    = Column(Integer, ForeignKey("trocas.id"), nullable=False)
    produto_id  = Column(Integer, ForeignKey("produtos.id"), nullable=True)
    descricao   = Column(String(200), nullable=False)
    quantidade  = Column(Float, nullable=False)
    valor_unit  = Column(Float, default=0.0)
    valor_total = Column(Float, default=0.0)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    troca   = relationship("Troca", back_populates="itens")


# ─── Agenda de Alteração de Preços por NF ────────────────────────────────────

class AgendaAlteracaoPreco(Base):
    __tablename__ = "agenda_alteracao_preco"

    id              = Column(Integer, primary_key=True, index=True)
    produto_id      = Column(Integer, ForeignKey("produtos.id"), nullable=False)
    nf_entrada_id   = Column(Integer, ForeignKey("nf_entrada.id"), nullable=True)
    custo_atual     = Column(Float, default=0.0)
    preco_atual     = Column(Float, default=0.0)
    custo_novo      = Column(Float, nullable=False)
    preco_novo      = Column(Float, nullable=False)
    margem_aplicada = Column(Float, default=0.0)
    data_aplicacao  = Column(Date, nullable=False)
    status          = Column(String(20), default="PENDENTE")  # PENDENTE | APLICADA | CANCELADA
    motivo          = Column(String(200), nullable=True)
    criado_por      = Column(String(100), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    produto    = relationship("Produto")
    nf_entrada = relationship("NotaFiscalEntrada")


# ─── Formas de Recebimento ────────────────────────────────────────────────────

class FormaRecebimento(Base):
    __tablename__ = "formas_recebimento"

    id           = Column(Integer, primary_key=True, index=True)
    nome         = Column(String(100), nullable=False)
    chave        = Column(String(50), unique=True, nullable=False)  # DINHEIRO, PIX, etc.
    icone        = Column(String(10), default="💳")
    cor          = Column(String(7), default="#6366f1")
    ativo               = Column(Boolean, default=True)
    ordem               = Column(Integer, default=0)
    aceita_troco        = Column(Boolean, default=False)
    is_sistema          = Column(Boolean, default=True)
    gera_conta_receber  = Column(Boolean, default=False)   # gera conta a receber automaticamente
    vencimento_dias     = Column(Integer, default=0)        # prazo de vencimento em dias
    created_at          = Column(DateTime(timezone=True), server_default=func.now())


# ─── Atacarejo / Campanha Atacarejo ─────────────────────────────────────────

class CampanhaAtacarejo(Base):
    __tablename__ = "campanhas_atacarejo"

    id          = Column(Integer, primary_key=True, index=True)
    nome        = Column(String(200), nullable=False)
    descricao   = Column(Text, nullable=True)
    ativo       = Column(Boolean, default=True)
    data_inicio = Column(Date, nullable=True)
    data_fim    = Column(Date, nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    itens = relationship("ItemCampanhaAtacarejo", back_populates="campanha", cascade="all, delete-orphan")


class ItemCampanhaAtacarejo(Base):
    __tablename__ = "itens_campanha_atacarejo"

    id              = Column(Integer, primary_key=True, index=True)
    campanha_id     = Column(Integer, ForeignKey("campanhas_atacarejo.id"), nullable=False)
    tipo            = Column(String(20), nullable=False)   # PRODUTO | CATEGORIA
    produto_id      = Column(Integer, ForeignKey("produtos.id"), nullable=True)
    categoria_id    = Column(Integer, ForeignKey("categorias_produto.id"), nullable=True)
    qtd_minima      = Column(Float, default=3.0)
    preco_atacarejo = Column(Float, nullable=True)   # preço fixo atacarejo
    pct_desconto    = Column(Float, nullable=True)   # ou % de desconto sobre preço normal
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    campanha   = relationship("CampanhaAtacarejo", back_populates="itens")
    produto    = relationship("Produto")
    categoria  = relationship("CategoriaProduto")


# ─── Clube de Promoção ───────────────────────────────────────────────────────

class CampanhaClube(Base):
    __tablename__ = "campanhas_clube"

    id             = Column(Integer, primary_key=True, index=True)
    nome           = Column(String(200), nullable=False)
    descricao      = Column(Text, nullable=True)
    ativo          = Column(Boolean, default=True)
    data_inicio    = Column(Date, nullable=True)
    data_fim       = Column(Date, nullable=True)
    tipo_desconto  = Column(String(20), default="PERCENTUAL")  # PERCENTUAL | VALOR | PRECO_FIXO
    valor_desconto = Column(Float, default=0.0)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())

    itens = relationship("ItemCampanhaClube", back_populates="campanha", cascade="all, delete-orphan")


class ItemCampanhaClube(Base):
    __tablename__ = "itens_campanha_clube"

    id          = Column(Integer, primary_key=True, index=True)
    campanha_id = Column(Integer, ForeignKey("campanhas_clube.id"), nullable=False)
    produto_id  = Column(Integer, ForeignKey("produtos.id"), nullable=False)
    preco_clube = Column(Float, nullable=True)   # preço especial clube
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    campanha = relationship("CampanhaClube", back_populates="itens")
    produto  = relationship("Produto")


# ─── Campanha por Forma de Pagamento ─────────────────────────────────────────

class CampanhaFormaPagamento(Base):
    __tablename__ = "campanhas_forma_pagamento"

    id                   = Column(Integer, primary_key=True, index=True)
    nome                 = Column(String(200), nullable=False)
    descricao            = Column(Text, nullable=True)
    ativo                = Column(Boolean, default=True)
    data_inicio          = Column(Date, nullable=True)
    data_fim             = Column(Date, nullable=True)
    forma_chave          = Column(String(50), nullable=False)   # chave da FormaRecebimento
    valor_minimo_compra  = Column(Float, default=0.0)
    pct_desconto         = Column(Float, default=0.0)
    created_at           = Column(DateTime(timezone=True), server_default=func.now())


# ─── Vendedores ───────────────────────────────────────────────────────────────

class Vendedor(Base):
    __tablename__ = "vendedores"

    id               = Column(Integer, primary_key=True, index=True)
    nome             = Column(String(100), nullable=False)
    codigo           = Column(String(20), unique=True, nullable=False)  # código de acesso
    comissao_pct     = Column(Float, default=0.0)       # % comissão por venda
    pode_desconto    = Column(Boolean, default=False)   # se pode aplicar desconto
    desconto_max_pct = Column(Float, default=0.0)       # % máx desconto permitido
    ativo            = Column(Boolean, default=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    pedidos = relationship("PedidoVenda", back_populates="vendedor")


# ─── Pedido de Venda ──────────────────────────────────────────────────────────

class PedidoVenda(Base):
    __tablename__ = "pedidos_venda"

    id                = Column(Integer, primary_key=True, index=True)
    numero            = Column(String(20), unique=True, nullable=False, index=True)  # PV20260001
    vendedor_id       = Column(Integer, ForeignKey("vendedores.id"), nullable=True)
    tipo_cliente      = Column(String(20), default="CONSUMIDOR_FINAL")  # CONSUMIDOR_FINAL | CADASTRADO
    cliente_id        = Column(Integer, ForeignKey("clientes.id"), nullable=True)
    cliente_nome      = Column(String(200), nullable=True)
    cliente_doc       = Column(String(30), nullable=True)
    cliente_telefone  = Column(String(30), nullable=True)
    data_entrega      = Column(Date, nullable=True)
    tipo_entrega      = Column(String(20), default="RETIRADA")     # RETIRADA | ENTREGA
    forma_recebimento = Column(String(50), nullable=True)
    tipo_fiscal       = Column(String(20), default="ORCAMENTO")    # ORCAMENTO | NFCE | NFE
    status            = Column(String(20), default="ABERTO")
    # ABERTO | AGUARDANDO_PDV | EM_SEPARACAO | PRONTO_NF | FATURADO | CANCELADO
    status_separacao  = Column(String(20), default="PENDENTE")
    # PENDENTE | EM_SEPARACAO | PRONTO
    subtotal          = Column(Float, default=0.0)
    desconto_total    = Column(Float, default=0.0)
    total             = Column(Float, default=0.0)
    observacoes       = Column(Text, nullable=True)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())
    updated_at        = Column(DateTime(timezone=True), onupdate=func.now())

    vendedor = relationship("Vendedor", back_populates="pedidos")
    cliente  = relationship("Cliente")
    itens    = relationship("ItemPedidoVenda", back_populates="pedido", cascade="all, delete-orphan")


class ItemPedidoVenda(Base):
    __tablename__ = "itens_pedido_venda"

    id             = Column(Integer, primary_key=True, index=True)
    pedido_id      = Column(Integer, ForeignKey("pedidos_venda.id"), nullable=False)
    produto_id     = Column(Integer, ForeignKey("produtos.id"), nullable=False)
    descricao      = Column(String(200), nullable=False)
    quantidade     = Column(Float, default=1.0)
    preco_unitario = Column(Float, default=0.0)
    desconto_pct   = Column(Float, default=0.0)
    preco_final    = Column(Float, default=0.0)
    total_item     = Column(Float, default=0.0)

    pedido  = relationship("PedidoVenda", back_populates="itens")
    produto = relationship("Produto")


# ─── Convênio Empresa ────────────────────────────────────────────────────────

class ConvenioEmpresa(Base):
    __tablename__ = "convenio_empresas"

    id               = Column(Integer, primary_key=True, index=True)
    cliente_id       = Column(Integer, ForeignKey("clientes.id"), nullable=False, unique=True)
    limite_mensal    = Column(Float, default=0.0)      # limite de compra/mês
    dia_fechamento   = Column(Integer, default=25)     # dia do mês para fechar
    desconto_pct     = Column(Float, default=0.0)      # desconto automático
    ativo            = Column(Boolean, default=True)
    responsavel      = Column(String(200), nullable=True)   # responsável na empresa
    observacoes      = Column(Text, nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    cliente    = relationship("Cliente")
    lancamentos = relationship("LancamentoConvenio", back_populates="convenio", cascade="all, delete-orphan")


class LancamentoConvenio(Base):
    __tablename__ = "lancamentos_convenio"

    id           = Column(Integer, primary_key=True, index=True)
    convenio_id  = Column(Integer, ForeignKey("convenio_empresas.id"), nullable=False)
    venda_id     = Column(Integer, ForeignKey("vendas.id"), nullable=True)
    descricao    = Column(String(255), nullable=False)
    valor        = Column(Float, nullable=False)
    tipo         = Column(String(10), default="DEBITO")   # DEBITO | CREDITO
    mes_ref      = Column(String(7), nullable=False)      # YYYY-MM
    status       = Column(String(20), default="ABERTO")   # ABERTO | PAGO | CANCELADO
    pago_em      = Column(Date, nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    convenio = relationship("ConvenioEmpresa", back_populates="lancamentos")
    venda    = relationship("Venda")


# ─── Campos Livres do Cliente ─────────────────────────────────────────────────

class CampoLivreCliente(Base):
    __tablename__ = "campos_livres_cliente"

    id          = Column(Integer, primary_key=True, index=True)
    cliente_id  = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    campo       = Column(String(100), nullable=False)   # nome do campo
    valor       = Column(Text, nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    cliente = relationship("Cliente")


# ─── Contas Correntes ────────────────────────────────────────────────────────

class ContaCorrente(Base):
    __tablename__ = "contas_correntes"

    id             = Column(Integer, primary_key=True, index=True)
    nome           = Column(String(100), nullable=False)   # ex: "Banco do Brasil Caixa"
    banco          = Column(String(100), nullable=True)    # nome do banco
    agencia        = Column(String(20), nullable=True)
    conta          = Column(String(30), nullable=True)
    tipo           = Column(String(20), default="CORRENTE")  # CORRENTE | POUPANCA | CAIXA | PIX
    saldo_inicial  = Column(Float, default=0.0)
    saldo_atual    = Column(Float, default=0.0)
    ativo          = Column(Boolean, default=True)
    cor            = Column(String(7), default="#6366f1")
    icone          = Column(String(10), default="🏦")
    observacoes    = Column(Text, nullable=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), onupdate=func.now())

    movimentos = relationship("MovimentoConta", back_populates="conta", cascade="all, delete-orphan")
    taxas_cartao = relationship("TaxaCartao", back_populates="conta")


class MovimentoConta(Base):
    __tablename__ = "movimentos_conta"

    id          = Column(Integer, primary_key=True, index=True)
    conta_id    = Column(Integer, ForeignKey("contas_correntes.id"), nullable=False)
    tipo        = Column(String(10), nullable=False)   # ENTRADA | SAIDA
    valor       = Column(Float, nullable=False)
    saldo_apos  = Column(Float, default=0.0)
    descricao   = Column(String(255), nullable=False)
    data        = Column(Date, nullable=False)
    origem      = Column(String(30), nullable=True)  # PDV | MANUAL | TRANSFERENCIA | CONTA_PAGAR | CONTA_RECEBER
    origem_id   = Column(Integer, nullable=True)
    usuario     = Column(String(100), nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    conta = relationship("ContaCorrente", back_populates="movimentos")


class TaxaCartao(Base):
    __tablename__ = "taxas_cartao"

    id                = Column(Integer, primary_key=True, index=True)
    nome              = Column(String(100), nullable=False)  # ex: "Cielo Débito"
    bandeira          = Column(String(50), nullable=True)    # VISA | MASTER | ELO | etc
    modalidade        = Column(String(30), nullable=False)   # DEBITO | CREDITO_1X | CREDITO_2A6 | CREDITO_7A12
    taxa_pct          = Column(Float, default=0.0)           # % taxa cobrada
    prazo_liquidacao  = Column(Integer, default=1)           # dias para liquidar (débito=1, crédito=30)
    conta_id          = Column(Integer, ForeignKey("contas_correntes.id"), nullable=True)  # conta destino
    ativo             = Column(Boolean, default=True)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())

    conta = relationship("ContaCorrente", back_populates="taxas_cartao")


# ─── Config Impressoras ───────────────────────────────────────────────────────

class ConfigImpressora(Base):
    __tablename__ = "config_impressoras"

    id                  = Column(Integer, primary_key=True, index=True)
    impressora_termica  = Column(String(200), nullable=True)   # PDV / cupom
    impressora_nfe      = Column(String(200), nullable=True)   # NF-e / relatórios
    impressora_etiqueta = Column(String(200), nullable=True)   # etiquetas marketplace
    largura_etiqueta_mm = Column(Integer, default=100)
    altura_etiqueta_mm  = Column(Integer, default=150)
    updated_at          = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ─── Compradores ──────────────────────────────────────────────────────────────

class ApiExternaConfig(Base):
    """APIs externas para consulta de dados de produtos (EAN, NCM, CEST, fiscal)."""
    __tablename__ = "api_externa_config"

    id          = Column(Integer, primary_key=True, index=True)
    nome        = Column(String(100), nullable=False)            # ex: "Cosmos Bluesoft"
    tipo        = Column(String(30),  default="COSMOS")          # COSMOS | SINTEGRA | CUSTOM
    api_key     = Column(String(500), nullable=True)
    url_custom  = Column(String(500), nullable=True)             # sobrescreve URL padrão
    ativo       = Column(Boolean, default=True)
    prioridade  = Column(Integer, default=1)                     # 1=mais alta
    created_at  = Column(DateTime(timezone=True), server_default=func.now())


class Comprador(Base):
    __tablename__ = "compradores"

    id                   = Column(Integer, primary_key=True, index=True)
    nome                 = Column(String(200), nullable=False, index=True)
    cpf                  = Column(String(20), nullable=True)
    email                = Column(String(150), nullable=True)
    telefone             = Column(String(20), nullable=True)
    celular              = Column(String(20), nullable=True)
    cargo                = Column(String(100), nullable=True)
    departamento         = Column(String(100), nullable=True)
    pin_hash             = Column(String(255), nullable=True)
    categorias_ids       = Column(Text, nullable=True)
    limite_compra_valor  = Column(Float, default=0.0)
    nivel_aprovacao      = Column(Integer, default=1)
    pode_aprovar_acima   = Column(Float, default=0.0)
    is_active            = Column(Boolean, default=True)
    observacoes          = Column(Text, nullable=True)
    ultimo_acesso        = Column(DateTime(timezone=True), nullable=True)
    created_at           = Column(DateTime(timezone=True), server_default=func.now())


# ─── MARKETING DE AFILIADOS ───────────────────────────────────────────────────

class AfiliadoConfig(Base):
    """Credenciais de cada plataforma afiliada + redes sociais"""
    __tablename__ = "afiliado_configs"

    id           = Column(Integer, primary_key=True, index=True)
    plataforma   = Column(String(40), unique=True, nullable=False)  # ML_AFILIADOS | SHOPEE | AMAZON | INSTAGRAM | FACEBOOK | TIKTOK
    ativo        = Column(Boolean, default=False)
    # Credenciais (armazenadas como texto — em prod usar criptografia)
    client_id    = Column(String(500), nullable=True)
    client_secret= Column(String(500), nullable=True)
    access_token = Column(String(2000), nullable=True)
    refresh_token= Column(String(2000), nullable=True)
    token_expiry = Column(DateTime(timezone=True), nullable=True)
    extra_json   = Column(Text, nullable=True)   # outros campos: affiliate_id, partner_tag, page_id...
    updated_at   = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())


class AfiliadoProduto(Base):
    """Catálogo de produtos afiliados salvos"""
    __tablename__ = "afiliado_produtos"

    id              = Column(Integer, primary_key=True, index=True)
    plataforma      = Column(String(40), nullable=False)    # ML_AFILIADOS | SHOPEE | AMAZON
    produto_ext_id  = Column(String(200), nullable=False)   # ID na plataforma externa
    titulo          = Column(String(500), nullable=False)
    descricao       = Column(Text, nullable=True)
    preco           = Column(Float, default=0)
    preco_original  = Column(Float, nullable=True)
    comissao_pct    = Column(Float, default=0)              # % de comissão
    comissao_valor  = Column(Float, default=0)              # valor estimado por venda
    categoria       = Column(String(200), nullable=True)
    imagem_url      = Column(String(1000), nullable=True)
    url_produto     = Column(String(1000), nullable=True)
    vendas_mes      = Column(Integer, default=0)            # estimativa de vendas/mês
    avaliacao       = Column(Float, default=0)
    total_avaliacoes= Column(Integer, default=0)
    ativo           = Column(Boolean, default=True)
    favorito        = Column(Boolean, default=False)
    notas           = Column(Text, nullable=True)
    gtin            = Column(String(20), nullable=True)     # código de barras (EAN/UPC) — exigido pelo ML em algumas categorias
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())


class AfiliadoLink(Base):
    """Links de afiliado gerados"""
    __tablename__ = "afiliado_links"

    id              = Column(Integer, primary_key=True, index=True)
    produto_id      = Column(Integer, ForeignKey("afiliado_produtos.id"), nullable=True)
    plataforma      = Column(String(40), nullable=False)
    titulo_produto  = Column(String(500), nullable=True)
    url_original    = Column(String(1000), nullable=True)
    url_afiliado    = Column(String(1000), nullable=False)
    url_curta       = Column(String(500), nullable=True)
    cliques         = Column(Integer, default=0)
    conversoes      = Column(Integer, default=0)
    comissao_gerada = Column(Float, default=0)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())


class AfiliadoMeta(Base):
    """Metas de renda por período"""
    __tablename__ = "afiliado_metas"

    id              = Column(Integer, primary_key=True, index=True)
    mes_ano         = Column(String(7), nullable=False)     # "2026-06"
    meta_renda      = Column(Float, nullable=False)         # R$ 20.000,00
    meta_vendas     = Column(Integer, default=0)            # qtd vendas necessárias
    meta_cliques    = Column(Integer, default=0)
    realizado_renda = Column(Float, default=0)
    realizado_vendas= Column(Integer, default=0)
    realizado_cliques= Column(Integer, default=0)
    estrategia_ia   = Column(Text, nullable=True)           # JSON com plano gerado por IA
    status          = Column(String(20), default="ATIVO")   # ATIVO | ATINGIDO | EXPIRADO
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())


class AfiliadoComissao(Base):
    """Comissões recebidas / a receber"""
    __tablename__ = "afiliado_comissoes"

    id              = Column(Integer, primary_key=True, index=True)
    plataforma      = Column(String(40), nullable=False)
    produto_id      = Column(Integer, ForeignKey("afiliado_produtos.id"), nullable=True)
    titulo_produto  = Column(String(500), nullable=True)
    data_venda      = Column(Date, nullable=True)
    data_prevista_pgto = Column(Date, nullable=True)
    data_pgto       = Column(Date, nullable=True)
    valor_venda     = Column(Float, default=0)
    comissao_pct    = Column(Float, default=0)
    comissao_valor  = Column(Float, default=0)
    status          = Column(String(20), default="PENDENTE")  # PENDENTE | APROVADO | PAGO | CANCELADO
    referencia_ext  = Column(String(200), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())


class AfiliadoConteudo(Base):
    """Conteúdo gerado por IA para redes sociais"""
    __tablename__ = "afiliado_conteudos"

    id              = Column(Integer, primary_key=True, index=True)
    produto_id      = Column(Integer, ForeignKey("afiliado_produtos.id"), nullable=True)
    titulo_produto  = Column(String(500), nullable=True)
    rede_social     = Column(String(30), nullable=False)    # INSTAGRAM | FACEBOOK | TIKTOK | TODOS
    tipo_conteudo   = Column(String(30), default="POST")    # POST | STORIES | REELS | VIDEO
    texto_post      = Column(Text, nullable=True)
    hashtags        = Column(Text, nullable=True)
    link_afiliado   = Column(String(1000), nullable=True)
    imagem_sugerida = Column(String(1000), nullable=True)
    status          = Column(String(20), default="RASCUNHO")  # RASCUNHO | APROVADO | PUBLICADO | AGENDADO
    publicado_em    = Column(DateTime(timezone=True), nullable=True)
    agendado_para   = Column(DateTime(timezone=True), nullable=True)
    resultado_post_id = Column(String(200), nullable=True)  # ID do post na plataforma
    alcance         = Column(Integer, default=0)
    engajamento     = Column(Integer, default=0)
    cliques_link    = Column(Integer, default=0)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())


# ─── MÓDULO VENDEDOR ──────────────────────────────────────────────────────────

class VendedorConfig(Base):
    """Credenciais das contas de vendedor em cada plataforma"""
    __tablename__ = "vendedor_configs"

    id            = Column(Integer, primary_key=True, index=True)
    plataforma    = Column(String(40), unique=True, nullable=False)  # ML_VENDEDOR | SHOPEE_VENDEDOR | TIKTOK_VENDEDOR
    ativo         = Column(Boolean, default=False)
    seller_id     = Column(String(200), nullable=True)   # ID do vendedor na plataforma
    client_id     = Column(String(500), nullable=True)
    client_secret = Column(String(500), nullable=True)
    access_token  = Column(String(2000), nullable=True)
    refresh_token = Column(String(2000), nullable=True)
    token_expiry  = Column(DateTime(timezone=True), nullable=True)
    extra_json    = Column(Text, nullable=True)
    updated_at    = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())


class VendedorAnuncio(Base):
    """Anúncios publicados nas contas de vendedor"""
    __tablename__ = "vendedor_anuncios"

    id                  = Column(Integer, primary_key=True, index=True)
    produto_afiliado_id = Column(Integer, ForeignKey("afiliado_produtos.id"), nullable=True)
    plataforma          = Column(String(40), nullable=False)   # ML_VENDEDOR | SHOPEE_VENDEDOR
    listing_id          = Column(String(200), nullable=True)   # ID na plataforma
    titulo              = Column(String(500), nullable=False)
    preco_custo         = Column(Float, default=0)   # preço afiliado (custo referência)
    preco_venda         = Column(Float, default=0)   # preço que você cobra
    margem_pct          = Column(Float, default=0)
    categoria_ml        = Column(String(200), nullable=True)
    imagem_url          = Column(String(1000), nullable=True)
    url_anuncio         = Column(String(1000), nullable=True)
    status              = Column(String(30), default="PENDENTE")  # PENDENTE | ATIVO | PAUSADO | VENDIDO | ERRO
    erro_msg            = Column(Text, nullable=True)
    vendas_count        = Column(Integer, default=0)
    faturamento         = Column(Float, default=0)
    link_afiliado       = Column(String(1000), nullable=True)  # link afiliado gerado junto
    publicado_em        = Column(DateTime(timezone=True), nullable=True)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())
    updated_at          = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())


class VendedorPedido(Base):
    """Pedidos recebidos na conta vendedor"""
    __tablename__ = "vendedor_pedidos"

    id              = Column(Integer, primary_key=True, index=True)
    anuncio_id      = Column(Integer, ForeignKey("vendedor_anuncios.id"), nullable=True)
    plataforma      = Column(String(40), nullable=False)
    pedido_ext_id   = Column(String(200), nullable=True)  # ID na plataforma
    titulo_produto  = Column(String(500), nullable=True)
    valor_venda     = Column(Float, default=0)
    lucro_estimado  = Column(Float, default=0)
    status          = Column(String(30), default="NOVO")  # NOVO | PAGO | ENVIADO | ENTREGUE | CANCELADO
    data_pedido     = Column(DateTime(timezone=True), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
