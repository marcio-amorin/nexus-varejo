'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import api, { fmtMoeda } from '@/lib/api'
import {
  Search, Trash2, User, X, ChevronRight,
  ShoppingCart, Banknote, CreditCard, Smartphone, Heart,
  Check, RotateCcw, RefreshCw, Settings, LogOut, Clock, Package,
  AlertCircle, Gift, Zap,
} from 'lucide-react'

type Produto  = { id: number; codigo: string; codigo_barras?: string; descricao: string; preco_venda: number; unidade: string; estoque_atual: number; categoria?: string; pesavel?: boolean; plu_codigo?: number | null; embalagem_codigo?: string | null; embalagem_qtd?: number; atacarejo?: boolean; atacarejo_qtd_min?: number; atacarejo_preco?: number; categoria_id?: number; imagem_url?: string }
type CartItem = { uid: string; produto: Produto; quantidade: number; preco: number; desconto: number; peso_kg?: number }
type Inst     = { id: number; nome: string; total_arrecadado: number }
type Params   = { desconto_maximo_pct: number; permite_venda_sem_estoque: boolean; troco_solidario_ativo: boolean; nome_loja: string; terminal: string; solicitar_cpf_inicio: boolean; logo_url?: string; cnpj_loja?: string; endereco_loja?: string; mensagem_cupom?: string; impressao_cupom?: boolean }
type FormaAPI = { id: number; chave: string; nome: string; icone: string; cor: string; aceita_troco: boolean; ordem: number }
type RegraAtk = { tipo: string; produto_id?: number; categoria_id?: number; qtd_minima: number; preco_atacarejo?: number; pct_desconto?: number }
type RegraFormaPgto = { forma_chave: string; nome: string; valor_minimo_compra: number; pct_desconto: number }

// Ícones fallback para formas de recebimento
function IconeForma({ icone, size = 20 }: { icone: string; size?: number }) {
  return <span style={{ fontSize: size }}>{icone}</span>
}

export default function PDVPage() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [user, setUser]   = useState<any>(null)
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Abertura de Caixa
  const [showAbertura,  setShowAbertura]  = useState(false)
  const [operadorNum,   setOperadorNum]   = useState('')
  const [fundoCaixa,    setFundoCaixa]    = useState('')
  const [aberturaOk,    setAberturaOk]    = useState(false)
  const [salvandoAb,    setSalvandoAb]    = useState(false)

  // Caixa — Sangria / Suprimento / Fechar
  const [showMovCaixa,  setShowMovCaixa]  = useState<'sangria'|'suprimento'|'fechar'|null>(null)
  const [movCaixaVal,   setMovCaixaVal]   = useState('')
  const [movCaixaObs,   setMovCaixaObs]   = useState('')
  const [movCaixaSaving, setMovCaixaSaving] = useState(false)

  const [produtos, setProdutos]     = useState<Produto[]>([])
  const [params, setParams]         = useState<Params | null>(null)
  const [insts, setInsts]           = useState<Inst[]>([])
  const [formasAPI, setFormasAPI]   = useState<FormaAPI[]>([])
  const [regrasAtk, setRegrasAtk]   = useState<RegraAtk[]>([])
  const [regrasForma, setRegrasForma] = useState<RegraFormaPgto[]>([])
  const [cart, setCart]             = useState<CartItem[]>([])
  const [busca, setBusca]         = useState('')
  const [catAtiva, setCat]        = useState('')
  const [desconto, setDesconto]   = useState(0)
  const [cliente, setCliente]     = useState<any>(null)
  const [clienteCpf, setCpf]      = useState('')
  const [cpfBusca, setCpfBusca]   = useState(false)
  const [consultaMode, setConsultaMode] = useState<'cliente'|'produto'>('cliente')

  const [clienteNomeBusca, setClienteNomeBusca] = useState('')
  const [clienteResultados, setClienteResultados] = useState<any[]>([])
  const [clienteBuscando, setClienteBuscando] = useState(false)
  const [creditoDev, setCreditoDev] = useState(0)
  const [usarCredito, setUsarCred] = useState(0)

  const [tela, setTela] = useState<'venda' | 'pagamento' | 'sucesso'>('venda')
  const [formasSel, setFormasSel] = useState<{ forma: string; valor: number }[]>([])
  const [valorDin, setValorDin]   = useState('')
  const [trocoSol, setTrocoSol]   = useState(0)
  const [instSel, setInstSel]     = useState<Inst | null>(null)
  const [saving, setSaving]       = useState(false)
  const [ultimaVenda, setUltimaVenda] = useState<any>(null)
  const [regimeFiscal, setRegimeFiscal] = useState<any>(null)

  const [showPedido,   setShowPedido]   = useState(false)
  const [numPedido,    setNumPedido]    = useState('')
  const [loadingPed,   setLoadingPed]   = useState(false)
  const [pedidoInfo,   setPedidoInfo]   = useState<any>(null)
  const [erroPedido,   setErroPedido]   = useState('')
  const [listaPedidos,  setListaPedidos]  = useState<any[]>([])
  const [listaMkt,      setListaMkt]      = useState<any[]>([])
  const [loadingLista,  setLoadingLista]  = useState(false)
  const [pedidoTab,     setPedidoTab]     = useState<'venda'|'marketplace'>('venda')
  const [pedidoListSel, setPedidoListSel] = useState(0)

  const [showFiscal,   setShowFiscal]   = useState(false)
  const [tipoFiscal,   setTipoFiscal]   = useState<'CUPOM'|'NFCE'|'NFE'>('CUPOM')
  const [nfeDraft,     setNfeDraft]     = useState<any>(null)

  const [lastScanned, setLastScanned] = useState<Produto | null>(null)
  const [lastQty,     setLastQty]     = useState(1)
  const [lastPrice,   setLastPrice]   = useState(0)

  const [erroScan,       setErroScan]       = useState('')
  const [buscaProdModal, setBuscaProdModal] = useState('')
  const [buscaProdSel,   setBuscaProdSel]   = useState(0)
  const [prodConsultado, setProdConsultado] = useState<any>(null)
  const buscaProdRef = useRef<HTMLInputElement>(null)
  const [pgtoAtivo,      setPgtoAtivo]      = useState(false)
  const [pgtoForma,      setPgtoForma]      = useState('DINHEIRO')
  const [pgtoValor,      setPgtoValor]      = useState('')
  const [pgtoDigits,     setPgtoDigits]     = useState('') // centavos raw digits para máscara
  const [pgtoNum,        setPgtoNum]        = useState('')
  const [countdown,      setCountdown]      = useState(0)
  const [showMenu,       setShowMenu]       = useState(false)
  const [menuSel,        setMenuSel]        = useState(0)
  const [nomeResultSel,  setNomeResultSel]  = useState(0)
  const [showFechamento, setShowFechamento] = useState(false)
  const [modoQtd,    setModoQtd]    = useState(false)
  const [inputQtd,   setInputQtd]   = useState('')
  const [qtdPendente, setQtdPendente] = useState(1)
  const [prodPesavel, setProdPesavel] = useState<Produto | null>(null)
  const [aguardandoTroco, setAguardandoTroco] = useState(false)
  const [showAlterarPreco, setShowAlterarPreco] = useState(false)
  const [altEtapa, setAltEtapa]   = useState<'supervisor'|'preco'>('supervisor')
  const [altSupNum,   setAltSupNum]   = useState('')
  const [altSupSenha, setAltSupSenha] = useState('')
  const [altCodigo,   setAltCodigo]   = useState('')
  const [altPreco,    setAltPreco]    = useState('')
  const [altSalvando, setAltSalvando] = useState(false)
  const [showScreensaver, setShowScreensaver] = useState(false)
  const [showCpfInicio,    setShowCpfInicio]    = useState(false)
  const [cpfInicioStep,    setCpfInicioStep]    = useState<'pergunta'|'input'|'tipo_nota'>('pergunta')
  const [cpfInicioSel,     setCpfInicioSel]     = useState<'sim'|'nao'>('sim')
  const [cpfInicioInput,   setCpfInicioInput]   = useState('')
  const [cpfInicioBusc,    setCpfInicioBusc]    = useState(false)
  const [cpfInicioTipoSel, setCpfInicioTipoSel] = useState<'NFCE'|'NFE'>('NFCE')
  const [tipoNota,         setTipoNota]         = useState<'NFCE'|'NFE'>('NFCE')
  const [pendingFirstItem, setPendingFirstItem] = useState<{prod: Produto, qty: number, peso_kg?: number} | null>(null)
  const cpfInicioFeitoRef = useRef(false)
  const lastActivityRef = useRef(Date.now())
  const telaRef = useRef<'venda'|'pagamento'|'sucesso'>('venda')
  const pgtoNumRef = useRef<HTMLInputElement>(null)
  const qtdRef     = useRef<HTMLInputElement>(null)
  const countdownTimerRef = useRef<any>(null)

  const buscaRef  = useRef<HTMLInputElement>(null)
  const pgtoRef   = useRef<HTMLInputElement>(null)
  const [hora, setHora] = useState(new Date().toLocaleTimeString('pt-BR'))

  const fmtQtd = (q: number) => q.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
  const fmtVal = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  useEffect(() => { telaRef.current = tela }, [tela])

  useEffect(() => {
    const t = localStorage.getItem('nexus_token')
    const u = localStorage.getItem('nexus_user')
    if (!t) { router.push('/'); return }
    setToken(t)
    if (u) setUser(JSON.parse(u))
    const iv = setInterval(() => setHora(new Date().toLocaleTimeString('pt-BR')), 1000)
    return () => clearInterval(iv)
  }, [])

  function carregarCarga() {
    if (!token) return
    api.get('/pdv/carga').then(r => {
      setProdutos(r.data.produtos)
      setParams(r.data.parametros)
      setInsts(r.data.instituicoes_troco || [])
      setFormasAPI(r.data.formas_recebimento || [])
      setRegrasAtk(r.data.regras_atacarejo || [])
      setRegrasForma(r.data.campanhas_forma_pgto || [])
    })
  }

  useEffect(() => {
    carregarCarga()
  }, [token])

  // Recarrega catálogo quando janela volta ao foco (ex: voltou do cadastro de produtos)
  useEffect(() => {
    function onFocus() { carregarCarga() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [token])

  async function abrirCaixa() {
    if (!operadorNum) { alert('Informe o número do operador'); return }
    setSalvandoAb(true)
    try {
      await api.post('/pdv/abertura', {
        operador_num: Number(operadorNum),
        fundo_caixa: Number(fundoCaixa) || 0,
        terminal: params?.terminal || 'PDV-01',
      })
      setAberturaOk(true)
      setShowAbertura(false)
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Erro ao registrar abertura')
    }
    setSalvandoAb(false)
  }

  function logout() {
    localStorage.removeItem('nexus_token'); localStorage.removeItem('nexus_user')
    setToken(''); setUser(null); setCart([])
  }

  // ── Decodifica código de barras de balança (Toledo format)
  // Formato: "20" + PLU(5) + PESO_GRAMAS(5) + check(1) = 13 dígitos
  function parsearBalanca(barcode: string): { plu: number; peso_kg: number } | null {
    if (barcode.length !== 13) return null
    // Prefixo interno: "20" + PLU(5) + peso(5) + check(1)
    if (barcode.startsWith('20')) {
      const plu    = parseInt(barcode.slice(2, 7), 10)
      const gramas = parseInt(barcode.slice(7, 12), 10)
      if (!isNaN(plu) && plu > 0 && !isNaN(gramas) && gramas > 0)
        return { plu, peso_kg: gramas / 1000 }
    }
    // Prefixo Toledo Prix 4U: "2x" (20-29) + PLU(5) + peso(5) + check(1)
    if (/^2\d/.test(barcode)) {
      const plu    = parseInt(barcode.slice(1, 6), 10)
      const gramas = parseInt(barcode.slice(6, 11), 10)
      if (!isNaN(plu) && plu > 0 && !isNaN(gramas) && gramas > 0)
        return { plu, peso_kg: gramas / 1000 }
    }
    return null
  }

  // Retorna o preço correto baseado na quantidade e regras de atacarejo
  function precoParaQtd(prod: Produto, qtd: number): number {
    // Regras dinâmicas de atacarejo (campanhas)
    for (const r of regrasAtk) {
      const match = (r.tipo === 'PRODUTO' && r.produto_id === prod.id) ||
                    (r.tipo === 'CATEGORIA' && r.categoria_id === (prod as any).categoria_id)
      if (match && qtd >= r.qtd_minima) {
        if (r.preco_atacarejo) return r.preco_atacarejo
        if (r.pct_desconto)    return prod.preco_venda * (1 - r.pct_desconto / 100)
      }
    }
    // Fallback: atacarejo legado no produto
    if (prod.atacarejo && prod.atacarejo_qtd_min && prod.atacarejo_preco && qtd >= prod.atacarejo_qtd_min) {
      return prod.atacarejo_preco
    }
    return prod.preco_venda
  }

  // Desconto por forma de pagamento (campanhas_forma_pgto)
  function descontoFormaPgto(formaChave: string, totalCompra: number): number {
    for (const r of regrasForma) {
      if (r.forma_chave === formaChave && totalCompra >= r.valor_minimo_compra) {
        return totalCompra * r.pct_desconto / 100
      }
    }
    return 0
  }

  const addItem = useCallback((prod: Produto, qty = 1, peso_kg?: number) => {
    // Se venda anterior ainda está finalizada (sucesso ou countdown ativo), limpa tudo antes de adicionar
    const vendaFinalizada = telaRef.current === 'sucesso' || countdownTimerRef.current !== null
    if (vendaFinalizada) {
      if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null }
      setCart([]); setDesconto(0); setCliente(null); setCpf(''); setCreditoDev(0); setUsarCred(0)
      setFormasSel([]); setValorDin(''); setTrocoSol(0); setInstSel(null)
      setTipoFiscal('CUPOM'); setNfeDraft(null)
      setPgtoAtivo(false); setPgtoForma('DINHEIRO'); setPgtoValor(''); setPgtoDigits(''); setCountdown(0)
      setAguardandoTroco(false); setShowFechamento(false); setTela('venda')
      cpfInicioFeitoRef.current = false
      telaRef.current = 'venda'
    }
    // Se é o primeiro item da venda e parâmetro ativo → pergunta CPF antes
    if (params?.solicitar_cpf_inicio && !cpfInicioFeitoRef.current) {
      cpfInicioFeitoRef.current = true
      setPendingFirstItem({ prod, qty, peso_kg })
      setCpfInicioInput(''); setCpfInicioStep('pergunta'); setCpfInicioSel('sim')
      setShowCpfInicio(true)
      return
    }
    const uid = `${prod.id}_${Date.now()}`
    const qtdEfetiva = peso_kg !== undefined ? peso_kg : qty
    setErroScan('')
    setLastScanned(prod)
    setLastQty(qtdEfetiva)
    setLastPrice(prod.preco_venda)
    // Se produto não tem imagem no cache, busca versão atualizada silenciosamente
    if (!prod.imagem_url) {
      api.get(`/produtos/${prod.id}`).then(r => {
        if (r.data?.imagem_url) {
          const atualizado = { ...prod, imagem_url: r.data.imagem_url }
          setProdutos((prev: Produto[]) => prev.map(p => p.id === prod.id ? atualizado : p))
          setLastScanned(atualizado)
        }
      }).catch(() => {})
    }
    setCart(c => {
      if (peso_kg !== undefined) {
        return [...c, { uid, produto: prod, quantidade: peso_kg, preco: prod.preco_venda, desconto: 0, peso_kg }]
      }
      const idx = c.findIndex(i => i.produto.id === prod.id && !i.peso_kg)
      if (idx >= 0) {
        const updated = [...c]
        const novaQtd = updated[idx].quantidade + qty
        const novoPreco = precoParaQtd(prod, novaQtd)
        updated[idx] = { ...updated[idx], quantidade: novaQtd, preco: novoPreco }
        return updated
      }
      return [...c, { uid, produto: prod, quantidade: qty, preco: precoParaQtd(prod, qty), desconto: 0 }]
    })
  }, [params])

  function removeItem(uid: string) { setCart(c => c.filter(i => i.uid !== uid)) }
  function setQty(uid: string, q: number) {
    if (q <= 0) return removeItem(uid)
    setCart(c => c.map(i => {
      if (i.uid !== uid) return i
      const novoPreco = precoParaQtd(i.produto, q)
      return { ...i, quantidade: q, preco: novoPreco }
    }))
  }
  function setPreco(uid: string, p: number) {
    setCart(c => c.map(i => i.uid === uid ? { ...i, preco: p } : i))
  }


  // Busca unificada: detecta CPF(11), CNPJ(14), código curto ou nome
  async function buscarClienteUnificado(v: string) {
    const digits = v.replace(/\D/g, '')
    setClienteNomeBusca(v)
    setNomeResultSel(0)
    if (!v.trim()) { setClienteResultados([]); return }
    setClienteBuscando(true)
    try {
      if (digits.length === 11 || digits.length === 14) {
        // CPF ou CNPJ — busca direta
        const r = await api.get(`/pdv/cliente/cpf/${v.trim()}`)
        setCliente(r.data); setCreditoDev(r.data.credito_devolucao || 0)
        setCpfBusca(false); setClienteBuscando(false); return
      } else if (/^\d{1,6}$/.test(v.trim())) {
        // Número curto → código interno
        const r = await api.get('/clientes/', { params: { codigo: v.trim(), limit: 8 } })
        setClienteResultados(r.data)
      } else if (v.trim().length >= 2) {
        // Nome
        const r = await api.get('/clientes/', { params: { busca: v.trim(), limit: 8 } })
        setClienteResultados(r.data)
      } else {
        setClienteResultados([])
      }
    } catch { setClienteResultados([]) }
    setClienteBuscando(false)
  }

  function selecionarCliente(c: any) {
    setCliente(c)
    setCpf(c.cpf || c.cnpj || c.documento || '')
    setCreditoDev(c.credito_devolucao || 0)
    setCpfBusca(false)
    setClienteNomeBusca('')
    setClienteResultados([])
  }

  function abrirModalCliente() {
    setClienteNomeBusca('')
    setClienteResultados([])
    setConsultaMode('cliente')
    setCpfBusca(true)
  }

  async function confirmarCpfInicio(cpf: string) {
    const digitos = cpf.replace(/\D/g, '')
    if (digitos.length >= 11) {
      setCpfInicioBusc(true)
      try {
        const r = await api.get(`/pdv/cliente/cpf/${cpf.trim()}`)
        setCliente(r.data); setCreditoDev(r.data.credito_devolucao || 0)
        setCpf(r.data.cpf || r.data.cnpj || r.data.documento || cpf.trim())
      } catch {
        setCpf(cpf.trim())
      }
      setCpfInicioBusc(false)
    } else if (digitos.length > 0) {
      setCpf(cpf.trim())
    }
    // Após CPF/CNPJ → perguntar tipo de nota
    const isCnpj = digitos.length === 14
    setCpfInicioTipoSel(isCnpj ? 'NFE' : 'NFCE')
    setCpfInicioStep('tipo_nota')
  }

  function confirmarTipoNota(tipo: 'NFCE' | 'NFE') {
    setTipoNota(tipo)
    setShowCpfInicio(false)
    _resolverPendingItem()
  }

  function pularCpfInicio() {
    setShowCpfInicio(false)
    setPendingFirstItem(null)
    setTimeout(() => buscaRef.current?.focus(), 100)
  }

  function _resolverPendingItem() {
    if (pendingFirstItem) {
      const { prod, qty, peso_kg } = pendingFirstItem
      setPendingFirstItem(null)
      if (prod.pesavel && peso_kg === undefined) {
        // Produto pesável: abre modal de peso após o fluxo de CPF
        setTimeout(() => {
          setProdPesavel(prod); setInputQtd(''); setModoQtd(true)
          setTimeout(() => qtdRef.current?.focus(), 80)
        }, 50)
      } else {
        setTimeout(() => addItem(prod, qty || 1, peso_kg), 50)
      }
    } else {
      setTimeout(() => buscaRef.current?.focus(), 100)
    }
  }

  function consultarProduto(p: any) {
    setProdConsultado(p)
  }

  function fecharConsultaProd() {
    setProdConsultado(null)
    setCpfBusca(false)
    setBuscaProdModal('')
    setBuscaProdSel(0)
    setTimeout(() => buscaRef.current?.focus(), 80)
  }

  const subtotal  = cart.reduce((s, i) => s + i.quantidade * i.preco - i.desconto, 0)
  const totalDesc = Math.min(desconto, (params?.desconto_maximo_pct ?? 10) / 100 * subtotal)
  const totalCred = Math.min(usarCredito, creditoDev)
  const total     = Math.max(0, subtotal - totalDesc - totalCred)

  const totalPago = formasSel.reduce((s, p) => s + p.valor, 0)
  const troco     = Math.max(0, totalPago - total - trocoSol)

  async function finalizar(tipo?: 'CUPOM'|'NFCE'|'NFE') {
    if (!cart.length) return
    const tf = tipo || tipoFiscal
    setSaving(true); setShowFiscal(false)
    try {
      const r = await api.post('/pdv/venda', {
        itens: cart.map(i => ({
          produto_id: i.produto.id,
          quantidade: i.quantidade,
          preco_unitario: i.preco,
          desconto_item: i.desconto,
        })),
        pagamentos: formasSel.length
          ? formasSel
          : [{ forma: 'DINHEIRO', valor: total }],
        desconto: totalDesc,
        cliente_cpf: clienteCpf || null,
        cliente_id: cliente?.id || null,
        troco_solidario_valor: trocoSol,
        troco_solidario_inst: instSel?.nome || null,
        credito_devolucao_usado: totalCred,
        canal: 'PDV',
        terminal: params?.terminal || 'PDV-01',
        operador: user?.nome,
        tipo_fiscal: tf,
      })
      setUltimaVenda({ ...r.data, tipo_fiscal: tf })
      if (tf === 'NFE') {
        try {
          const nfeR = await api.post(`/nf-saida/from-pdv/${r.data.id}`)
          setNfeDraft(nfeR.data)
        } catch {}
      }
      setTela('sucesso')
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro ao finalizar venda') }
    setSaving(false)
  }

  function novaVenda() {
    // Cancela countdown pendente ao iniciar nova venda manualmente
    if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null }
    setBusca('')
    setCart([]); setDesconto(0); setCliente(null); setCpf(''); setCreditoDev(0); setUsarCred(0)
    setFormasSel([]); setValorDin(''); setTrocoSol(0); setInstSel(null)
    setTipoFiscal('CUPOM'); setNfeDraft(null)
    setLastScanned(null); setLastQty(1); setLastPrice(0)
    setPgtoAtivo(false); setPgtoForma('DINHEIRO'); setPgtoValor(''); setPgtoDigits(''); setCountdown(0)
    setAguardandoTroco(false)
    setShowFechamento(false)
    setTela('venda')
    cpfInicioFeitoRef.current = false
    telaRef.current = 'venda'
    setTipoNota('NFCE')
    setPendingFirstItem(null)
    setTimeout(() => buscaRef.current?.focus(), 100)
  }

  async function finalizarRapido() {
    if (!cart.length || saving) return
    const formaInfo = formasAPI.find(f => f.chave === pgtoForma)
    const aceita = formaInfo?.aceita_troco ?? (pgtoForma === 'DINHEIRO')
    const valorRecebido = Number(pgtoValor) || 0
    if (aceita && valorRecebido < total) return
    setSaving(true)
    try {
      const vlPago = aceita ? valorRecebido : total
      await api.post('/pdv/venda', {
        itens: cart.map(i => ({
          produto_id: i.produto.id,
          quantidade: i.quantidade,
          preco_unitario: i.preco,
          desconto_item: i.desconto,
        })),
        pagamentos: [{ forma: pgtoForma, valor: vlPago }],
        desconto: totalDesc,
        cliente_cpf: clienteCpf || null,
        cliente_id: cliente?.id || null,
        credito_devolucao_usado: totalCred,
        canal: 'PDV',
        terminal: params?.terminal || 'PDV-01',
        operador: user?.nome,
        tipo_fiscal: 'CUPOM',
      })
      const isDinheiroComTroco = pgtoForma === 'DINHEIRO' && (Number(pgtoValor) || 0) > total
      if (isDinheiroComTroco) {
        // Dinheiro com troco: fica na tela esperando ação da operadora
        setAguardandoTroco(true)
      } else {
        // Demais formas: countdown automático e libera
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
        let c = 8
        setCountdown(c)
        countdownTimerRef.current = setInterval(() => {
          c -= 1
          setCountdown(c)
          if (c <= 0) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null; novaVenda() }
        }, 1000)
      }
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Erro ao finalizar venda')
    }
    setSaving(false)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      lastActivityRef.current = Date.now()
      if (showScreensaver) { e.preventDefault(); e.stopPropagation(); setShowScreensaver(false); return }

      // ── Modal CPF início da venda ──
      if (showCpfInicio) {
        if (cpfInicioStep === 'pergunta') {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); setCpfInicioSel(s => s === 'sim' ? 'nao' : 'sim'); return }
          if (e.key === 's' || e.key === 'S') { e.preventDefault(); setCpfInicioSel('sim'); setCpfInicioStep('input'); return }
          if (e.key === 'n' || e.key === 'N' || e.key === 'Escape') { e.preventDefault(); pularCpfInicio(); return }
          if (e.key === 'Enter') {
            e.preventDefault()
            if (cpfInicioSel === 'sim') { setCpfInicioStep('input') }
            else { pularCpfInicio() }
            return
          }
        }
        if (cpfInicioStep === 'input') {
          if (e.key === 'Escape') { e.preventDefault(); setCpfInicioStep('pergunta'); return }
        }
        if (cpfInicioStep === 'tipo_nota') {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); setCpfInicioTipoSel(s => s === 'NFCE' ? 'NFE' : 'NFCE'); return }
          if (e.key === '1') { e.preventDefault(); setCpfInicioTipoSel('NFCE'); return }
          if (e.key === '2') { e.preventDefault(); setCpfInicioTipoSel('NFE'); return }
          if (e.key === 'Enter') { e.preventDefault(); confirmarTipoNota(cpfInicioTipoSel); return }
          if (e.key === 'Escape') { e.preventDefault(); setCpfInicioStep('input'); return }
        }
        return
      }

      // Tela de sucesso: Enter = Nova Venda
      if (tela === 'sucesso') {
        if (e.key === 'Enter') { e.preventDefault(); novaVenda(); return }
        return
      }

      // Aguardando troco: Enter ou qualquer scan inicia nova venda
      if (aguardandoTroco) {
        if (e.key === 'Enter') { e.preventDefault(); novaVenda(); return }
        return
      }

      // Enter com erro de scan → limpa erro e volta ao normal
      if (e.key === 'Enter' && erroScan) {
        e.preventDefault()
        e.stopPropagation()
        setErroScan('')
        setTimeout(() => { buscaRef.current?.focus() }, 60)
        return
      }

      // ── Navegação no Menu de Funções ──
      if (showMenu) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setMenuSel(s => Math.min(s + 1, 9)); return }
        if (e.key === 'ArrowUp')   { e.preventDefault(); setMenuSel(s => Math.max(s - 1, 0)); return }
        if (e.key === 'Enter') { e.preventDefault(); document.getElementById(`menu-item-${menuSel}`)?.click(); return }
        const num = parseInt(e.key)
        if (!isNaN(num) && num >= 1 && num <= 9) {
          e.preventDefault()
          document.getElementById(`menu-item-${num - 1}`)?.click()
          return
        }
        if (e.key === 'Escape') { e.preventDefault(); setShowMenu(false); setMenuSel(0); return }
        return
      }

      // ── Navegação no Modal Consulta (cliente/produto) ──
      if (cpfBusca) {
        if (e.key === 'Escape') { e.preventDefault(); setCpfBusca(false); return }
        if (consultaMode === 'cliente') {
          // ↑ ↓ e Enter para navegar/selecionar resultados
          if (clienteResultados.length > 0) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setNomeResultSel(s => Math.min(s + 1, clienteResultados.length - 1)); return }
            if (e.key === 'ArrowUp')   { e.preventDefault(); setNomeResultSel(s => Math.max(s - 1, 0)); return }
            if (e.key === 'Enter') { e.preventDefault(); selecionarCliente(clienteResultados[nomeResultSel]); return }
          }
        }
        if (consultaMode === 'produto') {
          if (prodConsultado) {
            if (e.key === 'Enter')  { e.preventDefault(); addItem(prodConsultado); fecharConsultaProd(); return }
            if (e.key === 'Escape') { e.preventDefault(); fecharConsultaProd(); return }
            // Qualquer tecla alfanumérica volta para a busca
            if (e.key.length === 1) { e.preventDefault(); setProdConsultado(null); setBuscaProdModal(e.key); setTimeout(() => buscaProdRef.current?.focus(), 30); return }
            return
          }
          // setas para navegar na lista de produto (input cuida, mas captura aqui também)
          const q = buscaProdModal.trim().toLowerCase()
          const res = q.length > 0 ? produtos.filter(p =>
            p.descricao.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q) || (p.codigo_barras||'').includes(q)
          ).slice(0, 12) : []
          if (e.key === 'ArrowDown') { e.preventDefault(); const next = Math.min(buscaProdSel+1, res.length-1); setBuscaProdSel(next); document.getElementById(`busca-item-${next}`)?.scrollIntoView({block:'nearest'}); return }
          if (e.key === 'ArrowUp')   { e.preventDefault(); const prev = Math.max(buscaProdSel-1, 0); setBuscaProdSel(prev); document.getElementById(`busca-item-${prev}`)?.scrollIntoView({block:'nearest'}); return }
          if (e.key === 'Enter' && res.length > 0) { e.preventDefault(); consultarProduto(res[buscaProdSel] ?? res[0]); return }
        }
        return
      }

      // ── Modal Pedido: navegação por teclado ──
      if (showPedido) {
        if (e.key === 'Escape') { e.preventDefault(); setShowPedido(false); setPedidoInfo(null); setErroPedido(''); return }
        // Enter com erro (pedido faturado/inválido) → fecha modal
        if (erroPedido) { if (e.key === 'Enter') { e.preventDefault(); setShowPedido(false); setErroPedido(''); setPedidoInfo(null); } return }
        if (pedidoInfo) {
          if (e.key === 'Enter') { e.preventDefault(); confirmarPedido(); return }
          return
        }
        const lista = pedidoTab === 'venda' ? listaPedidos : listaMkt
        if (e.key === 'ArrowLeft')  { e.preventDefault(); setPedidoTab('venda'); setPedidoListSel(0); return }
        if (e.key === 'ArrowRight') { e.preventDefault(); setPedidoTab('marketplace'); setPedidoListSel(0); return }
        if (e.key === 'ArrowDown')  { e.preventDefault(); setPedidoListSel(s => Math.min(s + 1, lista.length - 1)); document.getElementById(`ped-item-${Math.min(pedidoListSel + 1, lista.length - 1)}`)?.scrollIntoView({ block: 'nearest' }); return }
        if (e.key === 'ArrowUp')    { e.preventDefault(); setPedidoListSel(s => Math.max(s - 1, 0)); document.getElementById(`ped-item-${Math.max(pedidoListSel - 1, 0)}`)?.scrollIntoView({ block: 'nearest' }); return }
        if (e.key === 'Enter' && lista.length > 0) { e.preventDefault(); carregarPedido(lista[pedidoListSel].numero); return }
        return
      }

      // ── Bloqueia todas as teclas quando alterar preço está aberto ──
      if (showAlterarPreco) {
        if (e.key === 'Escape') { e.preventDefault(); setShowAlterarPreco(false); }
        return
      }

      // Q → modo quantidade (digita qtd, Enter, depois escaneia produto)
      if ((e.key === 'q' || e.key === 'Q') && tela === 'venda' && !modoQtd && countdown === 0) {
        e.preventDefault()
        setInputQtd('')
        setModoQtd(true)
        setTimeout(() => qtdRef.current?.focus(), 80)
        return
      }
      if (modoQtd) {
        if (e.key === 'Escape') { e.preventDefault(); setModoQtd(false); setInputQtd(''); setQtdPendente(1); setTimeout(() => buscaRef.current?.focus(), 60); return }
        return
      }

      // M → abre/fecha menu de funções
      if ((e.key === 'm' || e.key === 'M') && tela === 'venda') {
        e.preventDefault()
        setShowMenu(v => !v)
        setMenuSel(0)
        return
      }
      // L → abre modal de consulta no modo produto
      if ((e.key === 'l' || e.key === 'L') && tela === 'venda' && !erroScan && !cpfBusca) {
        e.preventDefault()
        setBuscaProdModal(''); setBuscaProdSel(0); setProdConsultado(null)
        setConsultaMode('produto')
        setCpfBusca(true)
        setTimeout(() => buscaProdRef.current?.focus(), 80)
        return
      }
      // C → abre busca de cliente (CPF/convênio)
      if ((e.key === 'c' || e.key === 'C') && tela === 'venda') {
        e.preventDefault()
        setShowMenu(false)
        abrirModalCliente()
        return
      }
      // P → abre modal de pedidos (venda / marketplace)
      if ((e.key === 'p' || e.key === 'P') && tela === 'venda' && !cpfBusca) {
        e.preventDefault()
        setShowMenu(false)
        abrirModalPedido()
        return
      }
      // F → foca no campo de forma de pagamento
      if ((e.key === 'f' || e.key === 'F') && tela === 'venda' && cart.length > 0 && countdown === 0) {
        e.preventDefault()
        setShowMenu(false)
        setBusca('')
        setPgtoAtivo(false)
        setPgtoForma('')
        setPgtoNum('')
        setPgtoValor(''); setPgtoDigits('')
        setTimeout(() => pgtoNumRef.current?.focus(), 80)
        return
      }
      // ESC → fecha modais em cascata
      if (e.key === 'Escape') {
        e.preventDefault()
        if (showMenu) { setShowMenu(false); setMenuSel(0); return }
        if (showFechamento) { setShowFechamento(false); setTimeout(() => { buscaRef.current?.focus() }, 80); return }
        setPgtoAtivo(false)
        setPgtoValor(''); setPgtoDigits('')
        setTimeout(() => { buscaRef.current?.focus(); buscaRef.current?.select() }, 80)
        return
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [tela, cart.length, countdown, showMenu, menuSel, erroScan, showFechamento, cpfBusca, consultaMode, clienteResultados, nomeResultSel, modoQtd, aguardandoTroco, showAlterarPreco, buscaProdModal, buscaProdSel, prodConsultado, showPedido, pedidoInfo, pedidoTab, pedidoListSel, listaPedidos, listaMkt, showScreensaver, showCpfInicio, cpfInicioStep, cpfInicioSel, cpfInicioTipoSel, pendingFirstItem, erroPedido])


  // ── Screensaver: 10s de inatividade ──────────────────────────────────────
  useEffect(() => {
    const TIMEOUT = 10_000
    const iv = setInterval(() => {
      // Só ativa screensaver quando não há venda em andamento
      const pdvOcupado = cart.length > 0 || tela !== 'venda' || showCpfInicio || cpfBusca || !!prodPesavel || modoQtd
      if (!pdvOcupado && Date.now() - lastActivityRef.current >= TIMEOUT) setShowScreensaver(true)
    }, 1000)
    return () => clearInterval(iv)
  }, [cart.length, tela, showCpfInicio, cpfBusca, prodPesavel, modoQtd])

  function registrarAtividade() {
    lastActivityRef.current = Date.now()
    if (showScreensaver) setShowScreensaver(false)
  }

  async function carregarPedido(numero?: string) {
    const num = (numero || numPedido).trim().toUpperCase()
    if (!num) return
    setLoadingPed(true); setErroPedido('')
    try {
      const r = await api.get(`/pedido-venda/pdv/${num}`)
      setPedidoInfo(r.data)
    } catch (e: any) {
      setErroPedido(e.response?.data?.detail || `Pedido ${num} não encontrado`)
    }
    setLoadingPed(false)
  }

  async function abrirModalPedido() {
    setShowPedido(true); setNumPedido(''); setPedidoInfo(null); setErroPedido('')
    setPedidoTab('venda'); setPedidoListSel(0)
    setLoadingLista(true)
    try {
      const r = await api.get('/pedido-venda/pedidos', { params: { limit: 100 } })
      const ativos = r.data.filter((p: any) => !['FATURADO','CANCELADO'].includes(p.status))
      setListaPedidos(ativos.filter((p: any) => p.canal !== 'MARKETPLACE'))
      setListaMkt(ativos.filter((p: any) => p.canal === 'MARKETPLACE'))
    } catch {}
    setLoadingLista(false)
  }

  async function confirmarPedido() {
    if (!pedidoInfo) return
    const novosItens: CartItem[] = pedidoInfo.itens
      .map((it: any, idx: number) => {
        const prodCatalogo = produtos.find(p => p.id === it.produto_id)
        const prod: Produto = prodCatalogo ?? {
          id:             it.produto_id,
          codigo:         it.codigo || String(it.produto_id),
          codigo_barras:  '',
          descricao:      it.descricao,
          preco_venda:    it.preco_unitario,
          unidade:        it.unidade || 'UN',
          estoque_atual:  999,
          categoria:      '',
          pesavel:        false,
        }
        return {
          uid:        `pedido_${it.produto_id}_${idx}_${Date.now()}`,
          produto:    prod,
          quantidade: it.quantidade,
          preco:      it.preco_unitario,
          desconto:   0,
        }
      })

    // Fecha modal e atualiza cart para exibição
    setShowPedido(false)
    setNumPedido('')
    setCart(novosItens)

    // Finaliza a venda automaticamente com os dados do pedido
    setSaving(true)
    try {
      const pagamentos = pedidoInfo.forma_recebimento
        ? [{ forma: pedidoInfo.forma_recebimento, valor: pedidoInfo.total }]
        : [{ forma: 'DINHEIRO', valor: pedidoInfo.total }]

      const tipoFiscalPed = (['CUPOM','NFCE','NFE'].includes(pedidoInfo.tipo_fiscal)
        ? pedidoInfo.tipo_fiscal : 'CUPOM') as 'CUPOM'|'NFCE'|'NFE'

      const r = await api.post('/pdv/venda', {
        itens: novosItens.map(i => ({
          produto_id:     i.produto.id,
          quantidade:     i.quantidade,
          preco_unitario: i.preco,
          desconto_item:  0,
        })),
        pagamentos,
        desconto:                 0,
        cliente_id:               pedidoInfo.cliente_id || null,
        cliente_cpf:              pedidoInfo.cliente_cpf || null,
        troco_solidario_valor:    0,
        troco_solidario_inst:     null,
        credito_devolucao_usado:  0,
        canal:                    'PDV',
        terminal:                 params?.terminal || 'PDV-01',
        operador:                 user?.nome,
        tipo_fiscal:              tipoFiscalPed,
        pedido_venda_numero:      pedidoInfo.numero,
      })

      setUltimaVenda({ ...r.data, tipo_fiscal: tipoFiscalPed })
      if (tipoFiscalPed === 'NFE') {
        try {
          const nfeR = await api.post(`/nf-saida/from-pdv/${r.data.id}`)
          setNfeDraft(nfeR.data)
        } catch {}
      }
      setTela('sucesso')
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Erro ao registrar venda do pedido')
      setPedidoInfo(null)
      setTela('venda')
      setTimeout(() => buscaRef.current?.focus(), 100)
    }
    setSaving(false)
    setPedidoInfo(null)
  }

  const categorias = Array.from(new Set(produtos.map(p => p.categoria).filter(Boolean))) as string[]
  const prodFiltrados = produtos.filter(p =>
    (!catAtiva || p.categoria === catAtiva) &&
    (!busca || p.descricao.toLowerCase().includes(busca.toLowerCase()) ||
     p.codigo.toLowerCase().includes(busca.toLowerCase()) ||
     (p.codigo_barras || '').includes(busca))
  )

  // Aguarda token (redirect já acontece no useEffect)
  if (!token) return null

  // ── Tela de Sucesso — cupom continua visível à direita para o cliente ────────
  if (tela === 'sucesso') return (
    <div className="fixed inset-0 flex flex-col" style={{ background: '#0a0f1a', userSelect: 'none', fontFamily: 'Arial, sans-serif' }}>

      {/* TOP BAR igual ao PDV */}
      <div className="flex items-center gap-3 px-4 py-2.5 flex-shrink-0"
        style={{ background: 'rgba(0,0,0,0.5)', borderBottom: '2px solid #f59e0b' }}>
        <div className="flex items-center gap-2">
          <div className="h-10 rounded-xl flex items-center justify-center overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.9)', minWidth: 40, padding: params?.logo_url ? '2px 6px' : undefined }}>
            {params?.logo_url
              ? <img src={params.logo_url} alt={params.nome_loja} className="h-full object-contain" style={{ maxWidth: 120 }} />
              : <ShoppingCart size={22} color="#f97316" />}
          </div>
          <div>
            <p className="text-base font-black text-white">{params?.nome_loja || 'NexusVarejo'}</p>
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.6)' }}>{params?.terminal || 'PDV-01'}</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs font-bold" style={{ color: '#34C759' }}>✓ VENDA FINALIZADA</span>
          <span className="text-xs" style={{ color: '#71717A' }}>{ultimaVenda?.numero}</span>
        </div>
      </div>

      {/* CORPO: operador (esquerda) + cupom (direita) */}
      <div className="flex-1 flex min-h-0">

        {/* ─ ESQUERDA: confirmação + NOVA VENDA ─ */}
        <div className="flex flex-col items-center justify-center gap-5 p-8"
          style={{ width: '42%', borderRight: '3px solid rgba(255,255,255,0.1)', background: '#0a0f1a' }}>

          {ultimaVenda?.tipo_fiscal === 'NFE' ? (
            <>
              <div className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ background: '#3B82F622', border: '3px solid #3B82F6' }}>
                <span style={{ fontSize: 40 }}>📄</span>
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-black text-white">Venda Finalizada!</h2>
                <p className="text-sm mt-1" style={{ color: '#71717A' }}>{ultimaVenda?.numero}</p>
              </div>
              <div className="w-full rounded-2xl p-4 space-y-2"
                style={{ background: '#3B82F618', border: '2px solid #3B82F644' }}>
                <p className="text-sm font-black" style={{ color: '#3B82F6' }}>📄 Nota Fiscal Eletrônica (NF-e)</p>
                {nfeDraft && (
                  <div className="rounded-xl p-2" style={{ background: '#3B82F622' }}>
                    <p className="text-xs font-bold" style={{ color: '#71717A' }}>NF-e CRIADA</p>
                    <p className="font-black text-white text-sm">Nº {nfeDraft.numero}</p>
                    <p className="text-xs" style={{ color: '#3B82F6' }}>Aguardando SEFAZ</p>
                  </div>
                )}
                <div className="flex justify-between text-sm pt-1">
                  <span style={{ color: '#71717A' }}>Total</span>
                  <span className="font-black text-white">{fmtMoeda(ultimaVenda?.total)}</span>
                </div>
              </div>
              <p className="text-xs text-center p-2 rounded-xl" style={{ background: '#27272A', color: '#71717A' }}>
                ⚠ Não imprimir cupom térmico — aguardar NF-e autorizada
              </p>
            </>
          ) : (
            <>
              <div className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ background: '#34C75922', border: '3px solid #34C759' }}>
                <Check size={44} color="#34C759" />
              </div>
              <div className="text-center">
                <h2 className="text-3xl font-black text-white">Venda Finalizada!</h2>
                <p className="text-base mt-1" style={{ color: '#71717A' }}>{ultimaVenda?.numero}</p>
                {ultimaVenda?.tipo_fiscal === 'NFCE' && (
                  <p className="text-xs mt-1 font-bold" style={{ color: '#F59E0B' }}>🏪 NFC-e emitida</p>
                )}
              </div>
              <div className="w-full rounded-2xl p-5 space-y-3" style={{ background: '#18181B' }}>
                <div className="flex justify-between text-lg">
                  <span style={{ color: '#71717A' }}>Total pago</span>
                  <span className="font-black text-white">{fmtMoeda(ultimaVenda?.total)}</span>
                </div>
                {ultimaVenda?.troco > 0 && (
                  <div className="flex justify-between text-lg">
                    <span style={{ color: '#71717A' }}>Troco</span>
                    <span className="font-black" style={{ color: '#34C759' }}>{fmtMoeda(ultimaVenda.troco)}</span>
                  </div>
                )}
                {ultimaVenda?.troco_solidario_valor > 0 && (
                  <div className="flex justify-between text-sm">
                    <span style={{ color: '#FF9F0A' }}>Troco Solidário</span>
                    <span style={{ color: '#FF9F0A' }}>{fmtMoeda(ultimaVenda.troco_solidario_valor)}</span>
                  </div>
                )}
              </div>
            </>
          )}

          <button onClick={novaVenda}
            className="w-full py-5 rounded-2xl font-black text-xl text-white"
            style={{ background: 'linear-gradient(135deg,#F59E0B,#EA580C)' }}>
            NOVA VENDA
          </button>
        </div>

        {/* ─ DIREITA: CUPOM visível para o cliente ─ */}
        <div className="flex-1 flex flex-col" style={{ background: '#0c1929' }}>

          {/* Header cupom */}
          <div className="flex-shrink-0 px-4 py-2" style={{ background: '#1e3a5f' }}>
            <div className="flex justify-between text-[10px] mb-0.5">
              <span style={{ color: '#93c5fd' }}>
                {clienteCpf
                  ? `CPF: ${clienteCpf}${cliente?.nome ? ` · ${cliente.nome}` : ''}`
                  : cliente ? cliente.nome : 'Consumidor — CNPJ / CPF:'}
              </span>
              <span style={{ color: '#93c5fd' }}>Seg. 01</span>
            </div>
            <div className="text-center font-black tracking-[0.35em]" style={{ color: '#f59e0b', fontSize: 14 }}>
              C U P O M &nbsp; F I S C A L
            </div>
            <div className="flex justify-between text-[10px] mt-0.5">
              <span style={{ color: '#93c5fd' }}>{new Date().toLocaleDateString('pt-BR')} {hora}</span>
              <span style={{ color: '#93c5fd' }}>{params?.nome_loja || 'NexusVarejo'} · {params?.terminal || 'PDV-01'}</span>
            </div>
          </div>

          {/* Colunas */}
          <div className="flex-shrink-0 grid px-3 py-1 text-[10px] font-black"
            style={{ background: '#0f2236', borderBottom: '1px solid #1e3a5f', color: '#60a5fa',
              gridTemplateColumns: '28px 1fr 56px 56px 68px' }}>
            <span>N</span><span>Descrição</span>
            <span className="text-right">Qtd</span>
            <span className="text-right">Unit.</span>
            <span className="text-right">Total</span>
          </div>

          {/* Itens — NÃO editáveis, apenas leitura */}
          <div className="flex-1 overflow-y-auto" style={{ background: '#0c1929' }}>
            {cart.map((item, idx) => (
              <div key={item.uid} className="border-b"
                style={{ gridTemplateColumns: '28px 1fr 56px 56px 68px', borderColor: '#1e3a5f' }}>
                <div className="grid px-3 py-1.5 text-sm items-start"
                  style={{ gridTemplateColumns: '28px 1fr 56px 56px 68px' }}>
                  <span className="font-bold text-xs" style={{ color: '#60a5fa' }}>{String(idx + 1).padStart(2, '0')}</span>
                  <div className="min-w-0">
                    <p className="font-black leading-tight text-white" style={{ fontSize: 13, textTransform:'uppercase' }}>{item.produto.descricao}</p>
                    <p className="text-[9px] font-mono" style={{ color: '#475569' }}>{item.produto.codigo}</p>
                  </div>
                  <span className="text-right font-bold text-xs" style={{ color: '#94a3b8' }}>
                    {item.peso_kg ? `${item.peso_kg.toFixed(3)}kg` : fmtQtd(item.quantidade)}
                  </span>
                  <span className="text-right font-bold text-xs" style={{ color: '#94a3b8' }}>{fmtVal(item.preco)}</span>
                  <span className="text-right font-black" style={{ color: '#f59e0b', fontSize: 14 }}>{fmtVal(item.quantidade * item.preco)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3"
            style={{ background: '#0f2236', borderTop: '2px solid #1e3a5f' }}>
            <div>
              <span className="font-black" style={{ color: '#60a5fa', fontSize: 13 }}>SUBTOTAL R$</span>
              <span className="text-[10px] ml-2" style={{ color: '#475569' }}>{cart.length} item(s)</span>
            </div>
            <span className="font-black" style={{ color: '#f59e0b', fontFamily: 'monospace', fontSize: 28 }}>{fmtVal(subtotal)}</span>
          </div>
        </div>

      </div>
    </div>
  )

  // ── Tela de Pagamento ───────────────────────────────────────────────────────
  if (tela === 'pagamento') return (
    <div className="fixed inset-0 flex flex-col" style={{ background: '#0A0A0F' }}>
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 flex-shrink-0"
        style={{ background: '#18181B', borderBottom: '1px solid #27272A' }}>
        <button onClick={() => setTela('venda')}
          className="flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl"
          style={{ background: '#27272A', color: '#A1A1AA' }}>
          ← Voltar
        </button>
        <h1 className="text-xl font-black text-white">Pagamento</h1>
        <div className="ml-auto text-right">
          <p className="text-3xl font-black" style={{ color: '#F59E0B' }}>{fmtMoeda(total)}</p>
          <p className="text-xs" style={{ color: '#71717A' }}>{cart.length} item(s)</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full space-y-5">
        {/* Formas de pagamento */}
        <div>
          <p className="text-xs font-bold mb-3" style={{ color: '#71717A' }}>FORMA DE PAGAMENTO</p>
          <div className="grid grid-cols-4 gap-2">
            {formasAPI.filter(f => f.chave !== 'CREDITO_DEVOLUCAO' || creditoDev > 0).map(f => {
              const sel      = formasSel.find(x => x.forma === f.chave)
              const desconto = sel ? descontoFormaPgto(f.chave, total) : 0
              const campanha = regrasForma.find(r => r.forma_chave === f.chave && total >= r.valor_minimo_compra)
              return (
                <button key={f.chave}
                  onClick={() => {
                    if (sel) {
                      setFormasSel(fs => fs.filter(x => x.forma !== f.chave))
                    } else {
                      const restante = total - formasSel.reduce((s, x) => s + x.valor, 0)
                      const valor = f.chave === 'CREDITO_DEVOLUCAO' ? Math.min(creditoDev, restante) : Math.max(0, restante)
                      setFormasSel(fs => [...fs, { forma: f.chave, valor }])
                      if (f.aceita_troco) setValorDin(String(Math.max(0, restante)))
                    }
                  }}
                  className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl relative"
                  style={{
                    background: sel ? f.cor + '22' : '#18181B',
                    border: `2px solid ${sel ? f.cor : '#27272A'}`,
                    color: sel ? f.cor : '#71717A',
                  }}>
                  {campanha && (
                    <div className="absolute -top-1.5 -right-1.5 text-[8px] font-black px-1 rounded-full"
                      style={{ background: '#34C759', color: 'white' }}>−{campanha.pct_desconto}%</div>
                  )}
                  <span style={{ fontSize: 20 }}>{f.icone}</span>
                  <span className="text-[9px] font-bold text-center leading-tight">{f.nome}</span>
                  {sel && <span className="text-[9px] font-black">{fmtMoeda(sel.valor)}</span>}
                </button>
              )
            })}
          </div>
          {/* Desconto por forma de pagamento */}
          {formasSel.map(fs => {
            const desc = descontoFormaPgto(fs.forma, total)
            if (desc <= 0) return null
            const camp = regrasForma.find(r => r.forma_chave === fs.forma)
            return (
              <div key={fs.forma} className="mt-2 p-3 rounded-xl flex items-center justify-between"
                style={{ background: '#34C75918', border: '1px solid #34C75944' }}>
                <span className="text-xs" style={{ color: '#34C759' }}>🎉 Desconto {camp?.nome} ({camp?.pct_desconto}%)</span>
                <span className="font-black text-sm" style={{ color: '#34C759' }}>−{fmtMoeda(desc)}</span>
              </div>
            )
          })}
        </div>

        {/* Valor para formas que aceitam troco */}
        {formasSel.find(x => formasAPI.find(f => f.chave === x.forma && f.aceita_troco)) && (
          <div className="rounded-2xl p-4 space-y-3" style={{ background: '#18181B' }}>
            <p className="text-xs font-bold" style={{ color: '#71717A' }}>VALOR RECEBIDO (DINHEIRO)</p>
            <div className="grid grid-cols-4 gap-2">
              {[50, 100, 200, total].map(v => (
                <button key={v}
                  onClick={() => {
                    setValorDin(String(v))
                    setFormasSel(fs => fs.map(x => x.forma === 'DINHEIRO' ? { ...x, valor: v } : x))
                  }}
                  className="py-3 rounded-xl font-black text-sm"
                  style={{ background: '#27272A', color: '#F59E0B' }}>
                  {v === total ? 'Exato' : `R$${v}`}
                </button>
              ))}
            </div>
            <input type="number" value={valorDin}
              onChange={e => {
                setValorDin(e.target.value)
                setFormasSel(fs => fs.map(x => x.forma === 'DINHEIRO' ? { ...x, valor: Number(e.target.value) || 0 } : x))
              }}
              className="w-full px-4 py-3 rounded-xl text-white text-xl font-black text-center"
              style={{ background: '#27272A' }} placeholder="Valor recebido" />
            {troco > 0 && (
              <div className="flex justify-between items-center p-3 rounded-xl"
                style={{ background: '#34C75922' }}>
                <span className="font-bold" style={{ color: '#34C759' }}>Troco</span>
                <span className="text-xl font-black" style={{ color: '#34C759' }}>{fmtMoeda(troco)}</span>
              </div>
            )}
          </div>
        )}

        {/* Troco solidário */}
        {params?.troco_solidario_ativo && troco > 0 && insts.length > 0 && (
          <div className="rounded-2xl p-4 space-y-3" style={{ background: '#18181B', border: '1px solid #FF9F0A33' }}>
            <div className="flex items-center gap-2">
              <Heart size={16} color="#FF9F0A" />
              <p className="text-sm font-bold" style={{ color: '#FF9F0A' }}>Troco Solidário</p>
              <p className="text-xs ml-auto" style={{ color: '#71717A' }}>Troco disponível: {fmtMoeda(troco)}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {insts.map(i => (
                <button key={i.id} onClick={() => { setInstSel(instSel?.id === i.id ? null : i); setTrocoSol(instSel?.id === i.id ? 0 : troco + trocoSol) }}
                  className="p-3 rounded-xl text-left"
                  style={{
                    background: instSel?.id === i.id ? '#FF9F0A22' : '#27272A',
                    border: `1px solid ${instSel?.id === i.id ? '#FF9F0A' : 'transparent'}`,
                  }}>
                  <p className="text-xs font-bold text-white">{i.nome}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: '#71717A' }}>
                    Arrecadado: {fmtMoeda(i.total_arrecadado)}
                  </p>
                </button>
              ))}
            </div>
            {instSel && (
              <div className="flex items-center justify-between p-3 rounded-xl"
                style={{ background: '#FF9F0A18' }}>
                <span className="text-sm font-bold" style={{ color: '#FF9F0A' }}>
                  Doação para {instSel.nome}
                </span>
                <span className="font-black" style={{ color: '#FF9F0A' }}>{fmtMoeda(trocoSol)}</span>
              </div>
            )}
          </div>
        )}

        {/* Resumo final */}
        <div className="rounded-2xl p-5 space-y-3" style={{ background: '#18181B' }}>
          {[
            { l: 'Subtotal', v: subtotal },
            totalDesc > 0 && { l: 'Desconto', v: -totalDesc, c: '#FF3B30' },
            totalCred > 0 && { l: 'Crédito Devolução', v: -totalCred, c: '#FF9F0A' },
          ].filter(Boolean).map((r: any, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span style={{ color: '#71717A' }}>{r.l}</span>
              <span style={{ color: r.c || 'white', fontWeight: 700 }}>{fmtMoeda(Math.abs(r.v))}</span>
            </div>
          ))}
          <div className="flex justify-between text-xl pt-2" style={{ borderTop: '1px solid #27272A' }}>
            <span className="font-black text-white">TOTAL</span>
            <span className="font-black" style={{ color: '#F59E0B' }}>{fmtMoeda(total)}</span>
          </div>
          {totalPago > 0 && (
            <div className="flex justify-between text-sm">
              <span style={{ color: '#71717A' }}>Pago</span>
              <span style={{ color: totalPago >= total ? '#34C759' : '#FF9F0A', fontWeight: 700 }}>
                {fmtMoeda(totalPago)}
              </span>
            </div>
          )}
        </div>

        {/* Estimativa Fiscal */}
        {regimeFiscal && (regimeFiscal.icms_aliquota > 0 || regimeFiscal.pis_aliquota > 0 || regimeFiscal.cofins_aliquota > 0) && (
          <div className="rounded-2xl p-4 space-y-2" style={{ background: '#18181B', border: '1px solid #F59E0B22' }}>
            <p className="text-xs font-bold mb-1" style={{ color: '#F59E0B' }}>
              ESTIMATIVA FISCAL — {regimeFiscal.regime?.replace(/_/g,' ')}
            </p>
            {[
              regimeFiscal.icms_aliquota > 0 && { l:'ICMS', pct: regimeFiscal.icms_aliquota, cor:'#F59E0B' },
              regimeFiscal.pis_aliquota > 0  && { l:'PIS',  pct: regimeFiscal.pis_aliquota,  cor:'#32ADE6' },
              regimeFiscal.cofins_aliquota > 0 && { l:'COFINS', pct: regimeFiscal.cofins_aliquota, cor:'#32ADE6' },
            ].filter(Boolean).map((t: any) => (
              <div key={t.l} className="flex justify-between items-center">
                <span className="text-xs font-bold" style={{ color: t.cor }}>{t.l} ({t.pct.toFixed(2)}%)</span>
                <span className="text-xs font-bold" style={{ color: t.cor }}>{fmtMoeda(total * t.pct / 100)}</span>
              </div>
            ))}
            <p className="text-[10px] pt-1" style={{ color: '#52525B', borderTop: '1px solid #27272A' }}>
              Valores estimados com base no regime padrão · sujeito a variação por produto
            </p>
          </div>
        )}

        <button
          onClick={() => {
            if (clienteCpf && !saving) setShowFiscal(true)
            else finalizar('CUPOM')
          }}
          disabled={saving || !formasSel.length || totalPago < total}
          className="w-full py-5 rounded-2xl font-black text-xl text-white"
          style={{
            background: (!formasSel.length || totalPago < total || saving)
              ? '#27272A' : 'linear-gradient(135deg,#F59E0B,#EA580C)',
            color: (!formasSel.length || totalPago < total) ? '#71717A' : 'white',
          }}>
          {saving ? 'Finalizando...' : `CONFIRMAR VENDA ${fmtMoeda(total)}`}
        </button>
      </div>

      {/* Modal Fiscal */}
      {showFiscal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-sm rounded-3xl overflow-hidden"
            style={{ background: '#18181B', border: '1px solid #27272A' }}>
            <div className="px-6 py-5" style={{ borderBottom: '1px solid #27272A' }}>
              <p className="text-lg font-black text-white">Tipo de Documento Fiscal</p>
              <p className="text-xs mt-1" style={{ color: '#71717A' }}>CPF: {clienteCpf}</p>
            </div>
            <div className="p-4 space-y-2">
              {[
                { k: 'CUPOM' as const, icon: '🧾', label: 'Cupom Simples', desc: 'Sem documento fiscal — imprime cupom normal' },
                { k: 'NFCE'  as const, icon: '🏪', label: 'NFC-e', desc: 'Cupom Fiscal Eletrônico — imprime cupom com SEFAZ' },
                { k: 'NFE'   as const, icon: '📄', label: 'NF-e', desc: 'Nota Fiscal Eletrônica — não imprime cupom, gera NF' },
              ].map(op => (
                <button key={op.k} onClick={() => setTipoFiscal(op.k)}
                  className="w-full flex items-start gap-3 p-4 rounded-2xl text-left transition-all"
                  style={{
                    background: tipoFiscal === op.k ? '#F59E0B18' : '#27272A',
                    border: `2px solid ${tipoFiscal === op.k ? '#F59E0B' : 'transparent'}`,
                  }}>
                  <span className="text-2xl">{op.icon}</span>
                  <div>
                    <p className="font-black text-white">{op.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#71717A' }}>{op.desc}</p>
                  </div>
                  {tipoFiscal === op.k && (
                    <div className="ml-auto w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: '#F59E0B' }}>
                      <Check size={12} color="white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
            <div className="px-4 pb-4 flex gap-2">
              <button onClick={() => setShowFiscal(false)}
                className="flex-1 py-3 rounded-2xl font-bold text-sm"
                style={{ background: '#27272A', color: '#A1A1AA' }}>
                Cancelar
              </button>
              <button onClick={() => finalizar(tipoFiscal)}
                className="flex-[2] py-3 rounded-2xl font-black text-white text-sm"
                style={{ background: 'linear-gradient(135deg,#F59E0B,#EA580C)' }}>
                Confirmar — {fmtMoeda(total)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // ── Tela Principal PDV ──────────────────────────────────────────────────────
  // Máscara de moeda: digita centavos da direita para esquerda
  const fmtPgtoDisplay = () => {
    if (!pgtoDigits) return ''
    return (parseInt(pgtoDigits, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  const onPgtoDigitChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').replace(/^0+/, '') || ''
    setPgtoDigits(digits)
    setPgtoValor(digits ? (parseInt(digits, 10) / 100).toFixed(2) : '')
  }
  const setPgtoValorExterno = (val: string) => {
    setPgtoValor(val)
    if (val) { setPgtoDigits(String(Math.round(Number(val) * 100))) } else { setPgtoDigits('') }
  }
  const formasSorted = [...formasAPI].sort((a, b) => a.ordem - b.ordem).filter(f => f.chave !== 'CREDITO_DEVOLUCAO')
  const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'
  function imgSrc(url?: string | null) { return url ? (url.startsWith('/static') ? `${BASE_URL}${url}` : url) : '' }

  function selecionarForma(numStr: string) {
    setPgtoNum(numStr)
    const n = Number(numStr)
    if (!n || n < 1) return
    const f = formasSorted[n - 1]
    if (f) {
      setPgtoForma(f.chave)
      setPgtoAtivo(true)
      setPgtoValorExterno(String(total.toFixed(2)))
    }
  }

  return (
    <div className="fixed inset-0 flex flex-col" style={{
      background: 'linear-gradient(135deg, #ea580c 0%, #f97316 30%, #f59e0b 70%, #fbbf24 100%)',
      userSelect: 'none', fontFamily: 'Arial, sans-serif'
    }}
      onMouseMove={registrarAtividade}
      onClick={registrarAtividade}
    >

      {/* ══ MODAL CPF INÍCIO DA VENDA ══ */}
      {showCpfInicio && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.88)' }}>
          <div className="w-full max-w-sm rounded-3xl overflow-hidden"
            style={{ background: '#18181B', border: '1px solid #3F3F46' }}>

            {/* Header */}
            <div className="px-6 py-4 flex items-center gap-3"
              style={{ background: '#0f172a', borderBottom: '1px solid #27272A' }}>
              <span style={{ fontSize: 22 }}>🪪</span>
              <div>
                <p className="font-black text-white text-base">Identificar Cliente no Cupom</p>
                <p className="text-[10px]" style={{ color: '#52525B' }}>
                  {cpfInicioStep === 'pergunta' ? '← → selecionar · Enter confirmar · N = Não'
                    : cpfInicioStep === 'tipo_nota' ? '1 NFC-e · 2 NF-e · ← → · Enter confirmar'
                    : 'Esc = voltar · Enter confirmar'}
                </p>
              </div>
            </div>

            {/* ── ETAPA 1: SIM / NÃO ── */}
            {cpfInicioStep === 'pergunta' && (
              <div className="px-6 py-6 space-y-5">
                <p className="text-center text-white font-bold text-base">
                  Deseja informar CPF/CNPJ no cupom?
                </p>
                <div className="flex gap-3">
                  {([
                    { k: 'sim', l: 'S — SIM', cor: '#22c55e' },
                    { k: 'nao', l: 'N — NÃO', cor: '#ef4444' },
                  ] as const).map(op => {
                    const sel = cpfInicioSel === op.k
                    return (
                      <div key={op.k}
                        className="flex-1 py-4 rounded-2xl font-black text-lg flex items-center justify-center select-none"
                        style={{
                          background: sel ? op.cor + '22' : '#27272A',
                          color:      sel ? op.cor : '#52525B',
                          border:     `3px solid ${sel ? op.cor : '#3F3F46'}`,
                          transform:  sel ? 'scale(1.04)' : 'scale(1)',
                          transition: 'all 0.12s',
                          cursor: 'default',
                        }}>
                        {op.l}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── ETAPA 2: INPUT CPF ── */}
            {cpfInicioStep === 'input' && (
              <div className="px-6 py-5 space-y-4">
                <p className="text-xs text-center" style={{ color: '#71717A' }}>
                  CPF · CNPJ — se cadastrado vincula o cliente automaticamente
                </p>
                <input
                  type="text"
                  autoFocus
                  value={cpfInicioInput}
                  onChange={e => setCpfInicioInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') confirmarCpfInicio(cpfInicioInput)
                    if (e.key === 'Escape') setCpfInicioStep('pergunta')
                  }}
                  placeholder="000.000.000-00 ou 00.000.000/0001-00"
                  className="w-full px-4 py-4 rounded-2xl text-white font-black text-center"
                  style={{ background: '#27272A', fontSize: 20, letterSpacing: '0.06em',
                    outline: 'none', border: '2px solid #3F3F46' }}
                />
                {cpfInicioBusc && (
                  <p className="text-xs text-center" style={{ color: '#71717A' }}>Buscando cadastro...</p>
                )}
                <button
                  onClick={() => confirmarCpfInicio(cpfInicioInput)}
                  disabled={!cpfInicioInput.trim() || cpfInicioBusc}
                  className="w-full py-3.5 rounded-2xl font-black text-white text-base"
                  style={{
                    background: cpfInicioInput.trim() ? 'linear-gradient(135deg,#22c55e,#16a34a)' : '#27272A',
                    color: cpfInicioInput.trim() ? '#fff' : '#52525B',
                  }}>
                  Confirmar — Enter
                </button>
              </div>
            )}

            {/* ── ETAPA 3: TIPO DE NOTA ── */}
            {cpfInicioStep === 'tipo_nota' && (
              <div className="px-6 py-5 space-y-4">
                <p className="text-sm text-center font-bold text-white">
                  Tipo de documento fiscal
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { k: 'NFCE' as const, n: '1 — NFC-e', sub: 'Cupom Fiscal Eletrônico', cor: '#2563eb' },
                    { k: 'NFE'  as const, n: '2 — NF-e',  sub: 'Nota Fiscal Eletrônica',  cor: '#7c3aed' },
                  ]).map(op => {
                    const sel = cpfInicioTipoSel === op.k
                    return (
                      <div key={op.k}
                        onClick={() => setCpfInicioTipoSel(op.k)}
                        className="rounded-2xl p-4 text-center"
                        style={{
                          background: sel ? op.cor + '33' : '#27272A',
                          border: `2.5px solid ${sel ? op.cor : '#3F3F46'}`,
                          transform: sel ? 'scale(1.04)' : 'scale(1)',
                          transition: 'all 0.12s',
                          cursor: 'default',
                        }}>
                        <p className="font-black text-white text-base">{op.n}</p>
                        <p className="text-[11px] mt-1" style={{ color: sel ? 'rgba(255,255,255,0.7)' : '#52525B' }}>{op.sub}</p>
                      </div>
                    )
                  })}
                </div>
                <button
                  onClick={() => confirmarTipoNota(cpfInicioTipoSel)}
                  className="w-full py-3.5 rounded-2xl font-black text-white text-base"
                  style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)' }}>
                  Confirmar — Enter
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ══ SCREENSAVER ══ */}
      {showScreensaver && (
        <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center cursor-pointer"
          style={{ background: 'linear-gradient(135deg,#EA580C 0%,#F97316 40%,#C2410C 100%)' }}
          onClick={registrarAtividade}>
          {/* Grade sutil de fundo */}
          <div style={{ position: 'absolute', inset: 0,
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
            backgroundSize: '32px 32px', pointerEvents: 'none' }} />

          {/* Logo NexusVarejo */}
          <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
            {params?.logo_url ? (
              <img src={params.logo_url} alt={params.nome_loja}
                className="max-w-[320px] max-h-[200px] object-contain mb-6 drop-shadow-2xl" />
            ) : (
              <div style={{
                background: 'rgba(255,255,255,0.15)', borderRadius: 28,
                padding: '28px 48px', marginBottom: 24,
                boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                border: '2px solid rgba(255,255,255,0.25)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
                  <span style={{ fontSize: 52 }}>🛒</span>
                  <p style={{ color: 'white', fontWeight: 900, fontSize: 56, letterSpacing: -2, margin: 0, lineHeight: 1 }}>
                    {params?.nome_loja || 'NexusVarejo'}
                  </p>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 700, fontSize: 16, letterSpacing: 6, margin: 0, textAlign: 'center' }}>
                  GESTÃO COMERCIAL
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-center mt-2">
              {[0,1,2].map(i => (
                <div key={i} className="w-2.5 h-2.5 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.6)', opacity: 0.4 + i * 0.3,
                    animation: `pulse ${1 + i * 0.3}s ease-in-out infinite alternate` }} />
              ))}
            </div>
            <p className="text-sm mt-6 font-bold" style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: 5 }}>
              TOQUE PARA CONTINUAR
            </p>
          </div>
        </div>
      )}

      {/* ══ TOP BAR ══ */}
      <div className="flex items-center gap-3 px-4 py-2.5 flex-shrink-0"
        style={{ background: 'rgba(0,0,0,0.28)', borderBottom: '2px solid rgba(255,255,255,0.25)' }}>
        <div className="flex items-center gap-3 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#EA580C,#F97316)', borderRadius: 14, padding: '6px 16px 6px 10px', boxShadow: '0 4px 18px rgba(249,115,22,0.5)' }}>
          <div className="flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.2)', width: 38, height: 38 }}>
            {params?.logo_url
              ? <img src={params.logo_url} alt={params.nome_loja} className="h-full object-contain rounded-xl" style={{ maxWidth: 38 }} />
              : <ShoppingCart size={20} color="white" />}
          </div>
          <div className="leading-none">
            <p style={{ color: 'white', fontWeight: 900, fontSize: 18, letterSpacing: -0.5, margin: 0, lineHeight: 1.1 }}>
              {params?.nome_loja || 'NexusVarejo'}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: 600, letterSpacing: 2, margin: 0 }}>
              GESTÃO COMERCIAL · {params?.terminal || 'PDV-01'}
            </p>
          </div>
        </div>

        <div className="flex-1 relative" style={{ maxWidth: 560 }}>
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#f97316' }} />
          <input ref={buscaRef} value={busca} onChange={e => setBusca(e.target.value)} autoFocus
            placeholder="Código de barras ou nome do produto..."
            className="w-full pl-11 pr-4 outline-none"
            style={{ background: 'rgba(0,0,0,0.45)', border: '2px solid rgba(249,115,22,0.6)', borderRadius: 14,
              color: 'white', fontSize: 20, fontWeight: 800, padding: '11px 16px 11px 48px',
              letterSpacing: 1.5, boxShadow: '0 0 0 3px rgba(249,115,22,0.15)' }}
            onKeyDown={e => {
              if (e.key !== 'Enter') return
              // Se aguardando troco: qualquer scan inicia nova venda (sem continuar)
              if (aguardandoTroco) { novaVenda(); return }
              // Campo vazio: ignora — evita adicionar produto por Enter de navegação/autoFocus
              const cod = busca.trim()
              if (!cod) return
              const balanca = parsearBalanca(cod)
              if (balanca) {
                const prod = produtos.find(p => p.plu_codigo === balanca.plu && p.pesavel)
                if (prod) { addItem(prod, 1, balanca.peso_kg); setBusca(''); return }
              }
              const emb = produtos.find(p => p.embalagem_codigo && p.embalagem_codigo === cod)
              if (emb) { addItem(emb, emb.embalagem_qtd && emb.embalagem_qtd > 1 ? emb.embalagem_qtd : 1); setBusca(''); return }
              const exato = produtos.find(p => p.codigo === cod || p.codigo_barras === cod)
              if (exato) {
                if (exato.pesavel && qtdPendente === 1) {
                  setBusca('')
                  if (params?.solicitar_cpf_inicio && !cpfInicioFeitoRef.current) {
                    cpfInicioFeitoRef.current = true
                    setPendingFirstItem({ prod: exato, qty: 1, peso_kg: undefined })
                    setCpfInicioInput(''); setCpfInicioStep('pergunta'); setCpfInicioSel('sim')
                    setShowCpfInicio(true)
                  } else {
                    setProdPesavel(exato); setInputQtd(''); setModoQtd(true)
                    setTimeout(() => qtdRef.current?.focus(), 80)
                  }
                  return
                }
                addItem(exato, qtdPendente); setBusca(''); setQtdPendente(1); return
              }
              // PDV só aceita código exato cadastrado — código não encontrado
              setErroScan(cod)
              setBusca('')
            }}
          />
        </div>

        <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
          <button onClick={() => setShowMenu(v => !v)}
            className="px-2.5 py-1.5 rounded-xl text-[11px] font-black"
            style={{ background: showMenu ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}>
            [M] MENU
          </button>
          <button onClick={logout} className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(180,0,0,0.5)', color: 'white' }}>
            <LogOut size={14} />
          </button>
        </div>
      </div>

      {/* ══ CORPO: 2 colunas estilo Logus ══ */}
      <div className="flex-1 min-h-0 overflow-hidden" style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row' }}>

        {/* ─── COLUNA ESQUERDA: Operador ─── */}
        <div className="flex flex-col" style={{ width: isMobile ? '100%' : '42%', maxHeight: isMobile ? '35%' : undefined, borderRight: isMobile ? 'none' : '3px solid rgba(0,0,0,0.2)', borderBottom: isMobile ? '3px solid rgba(0,0,0,0.2)' : 'none', background: 'rgba(255,255,255,0.97)' }}>

          {/* ── TOPO: Logo da empresa | Foto do produto ── */}
          <div className="flex flex-1 min-h-0" style={{ borderBottom: '2px solid #e2e8f0' }}>

            {/* Quadro LOGO DA EMPRESA */}
            <div className="flex flex-col items-center justify-center gap-2 p-3"
              style={{ flex: 1, background: '#f0f4ff', borderRight: '2px solid #e2e8f0' }}>
              {params?.logo_url ? (
                <img src={params.logo_url} alt={params.nome_loja}
                  className="object-contain" style={{ maxHeight: 120, maxWidth: '92%' }} />
              ) : (
                <>
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{ background: '#1e3a5f' }}>
                    <ShoppingCart size={32} color="#f97316" />
                  </div>
                  <p className="text-xs font-black text-center leading-tight" style={{ color: '#1e3a5f' }}>
                    {params?.nome_loja || 'NexusVarejo'}
                  </p>
                </>
              )}
            </div>

            {/* Quadro FOTO DO PRODUTO */}
            <div className="relative overflow-hidden"
              style={{ flex: 1, background: '#0e1520' }}>
              {lastScanned ? (
                <>
                  {lastScanned.imagem_url ? (
                    <img src={imgSrc(lastScanned.imagem_url)} alt={lastScanned.descricao}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', padding: '10px', display: 'block' }} />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                      <Package size={40} color="#334155" />
                      <p className="text-[11px] font-black text-center px-2 leading-tight"
                        style={{ color: '#475569', textTransform: 'uppercase' }}>
                        {lastScanned.descricao}
                      </p>
                    </div>
                  )}
                </>
              ) : qtdPendente > 1 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <div className="px-4 py-2 rounded-2xl animate-pulse" style={{ background: '#f97316' }}>
                    <span className="text-xs font-black text-white tracking-widest">QTD </span>
                    <span className="font-black text-white" style={{ fontFamily: 'monospace', fontSize: 24 }}>{qtdPendente}</span>
                  </div>
                  <p className="text-[10px]" style={{ color: '#475569' }}>→ escaneie o produto</p>
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <Package size={32} color="#1e293b" />
                  <p className="text-[10px] font-black tracking-widest" style={{ color: '#1e293b' }}>PRODUTO</p>
                </div>
              )}
            </div>
          </div>

          {/* ── BLOCO UNIFICADO: Formas + Inputs ── */}
          <div className="flex-shrink-0 px-3 pt-2 pb-2"
            style={{ background: 'linear-gradient(135deg, #ea580c 0%, #f97316 40%, #f59e0b 80%, #fbbf24 100%)' }}>
            <p className="text-sm font-black mb-1.5" style={{ color: '#000', letterSpacing: '0.08em' }}>FORMAS DE RECEBIMENTO</p>

            {/* Grid de formas */}
            <div className="grid gap-1 mb-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {formasSorted.map((f, i) => {
                const sel = pgtoForma === f.chave && pgtoAtivo
                const coresPdv: Record<string, string> = {
                  DINHEIRO: '#16a34a', CREDITO: '#2563eb', DEBITO: '#7c3aed',
                  PIX: '#0891b2', BOLETO: '#d97706', CHEQUE: '#dc2626',
                }
                const cor = coresPdv[f.chave] || '#f97316'
                return (
                  <button key={f.chave}
                    onClick={() => { selecionarForma(String(i + 1)); setTimeout(() => pgtoRef.current?.focus(), 60) }}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-left"
                    style={{
                      background: sel ? cor : 'rgba(255,255,255,0.92)',
                      border: `2px solid ${sel ? cor : 'rgba(255,255,255,0.6)'}`,
                      boxShadow: sel ? `0 3px 10px ${cor}66` : '0 1px 4px rgba(0,0,0,0.12)',
                    }}>
                    <span className="w-5 h-5 rounded-md text-xs font-black flex items-center justify-center flex-shrink-0"
                      style={{ background: sel ? 'rgba(255,255,255,0.25)' : cor, color: 'white' }}>
                      {i + 1}
                    </span>
                    <span className="text-[11px] font-black truncate" style={{ color: sel ? 'white' : cor }}>
                      {f.chave === 'BOLETO' ? 'Nota Fiscal / Boleto' : f.nome}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Forma + Valor — imediatamente abaixo das formas */}
            <div className="flex gap-2 items-end">
              <div style={{ flex: '0 0 60px' }}>
                <p className="text-[9px] font-black mb-0.5" style={{ color: '#000' }}>Nº:</p>
                <input ref={pgtoNumRef} type="text" value={pgtoNum} maxLength={2}
                  onChange={e => selecionarForma(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === 'Tab') {
                      e.preventDefault()
                      const f = formasSorted[Number(pgtoNum) - 1]
                      if (f) {
                        setPgtoValorExterno(String(total.toFixed(2)))
                        if (f.aceita_troco) pgtoRef.current?.focus()
                        else setTimeout(finalizarRapido, 150)
                      }
                    }
                  }}
                  placeholder="N"
                  className="w-full text-center font-black rounded-xl py-2 outline-none"
                  style={{ background: '#fff', color: '#1e3a5f', fontFamily: 'monospace', fontSize: 22,
                    border: `2.5px solid ${pgtoAtivo ? '#f97316' : '#e5e7eb'}` }} />
              </div>
              <div className="flex-1">
                <p className="text-[9px] font-black mb-0.5" style={{ color: '#000' }}>VALOR RECEBIDO:</p>
                <input ref={pgtoRef} type="text" inputMode="numeric"
                  value={fmtPgtoDisplay()}
                  onChange={e => onPgtoDigitChange(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') finalizarRapido() }}
                  placeholder={fmtVal(total)}
                  className="w-full text-right font-black rounded-xl px-3 py-2 outline-none"
                  style={{ background: '#fff', fontFamily: 'monospace', fontSize: 22,
                    color: pgtoValor ? (Number(pgtoValor) >= total ? '#16a34a' : '#dc2626') : '#94a3b8',
                    border: `2.5px solid ${pgtoAtivo ? '#f97316' : '#e5e7eb'}` }} />
              </div>
            </div>
          </div>

          {/* Total a receber */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5"
            style={{ background: '#1e3a5f' }}>
            <div>
              <p className="text-[10px] font-black tracking-widest" style={{ color: '#93c5fd' }}>TOTAL A RECEBER</p>
              <p className="text-[10px]" style={{ color: '#60a5fa' }}>{cart.length} item(s)</p>
            </div>
            <div className="text-right">
              {countdown > 0 && (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl mr-2"
                  style={{ background: '#16a34a' }}>
                  <p className="text-xs font-black text-white">VENDA OK!</p>
                  <p className="text-xl font-black text-white" style={{ fontFamily: 'monospace' }}>{countdown}</p>
                </div>
              )}
              <span className="font-black text-white" style={{ fontFamily: 'monospace', fontSize: 30 }}>
                R$ {fmtVal(total)}
              </span>
            </div>
          </div>

          {/* Cliente identificado — só renderiza se houver cliente */}
          {cliente && (
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-2"
              style={{ background: '#0f2a4a', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-2 min-w-0">
                <User size={12} color="#93c5fd" className="flex-shrink-0" />
                {clienteCpf && <span className="text-[10px] font-mono flex-shrink-0" style={{ color: '#60a5fa' }}>{clienteCpf}</span>}
                {clienteCpf && cliente?.nome && <span className="text-[10px]" style={{ color: '#71717A' }}>·</span>}
                <span className="text-xs font-black truncate" style={{ color: '#fff' }}>{cliente?.nome || ' '}</span>
              </div>
              <button onClick={() => { setCliente(null); setCpf(''); setCreditoDev(0) }}
                className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center ml-2"
                style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
                <X size={10} />
              </button>
            </div>
          )}

          {/* Troco — só renderiza se houver troco */}
          {(() => {
            const temTroco = pgtoAtivo && pgtoForma === 'DINHEIRO' && Number(pgtoValor) > total
            return temTroco ? (
              <div className="flex-shrink-0 px-4 py-2 flex items-center justify-between"
                style={{
                  background: 'linear-gradient(135deg,#15803d,#16a34a)',
                  boxShadow: '0 -2px 10px rgba(22,163,74,0.3)',
                }}>
                <div>
                  <p className="text-[10px] font-black" style={{ color: 'rgba(255,255,255,0.7)', letterSpacing: '0.12em' }}>TROCO</p>
                  <p className="text-3xl font-black text-white" style={{ fontFamily: 'monospace', lineHeight: 1 }}>
                    R$ {fmtVal(Number(pgtoValor) - total)}
                  </p>
                </div>
                <span style={{ fontSize: 36, opacity: 0.3 }}>💵</span>
              </div>
            ) : null
          })()}

        </div>

        {/* ─── COLUNA DIREITA: Cupom para o cliente ─── */}
        <div className="flex-1 flex flex-col">

          {/* Header cupom estilo Logus */}
          <div className="flex-shrink-0 px-4 py-2" style={{ background: '#1e3a5f' }}>
            <div className="flex justify-between text-[10px] mb-0.5">
              <span style={{ color: '#93c5fd' }}>
                {clienteCpf
                  ? `CPF: ${clienteCpf}${cliente?.nome ? ` · ${cliente.nome}` : ''}`
                  : cliente ? cliente.nome : 'Consumidor — CNPJ / CPF:'}
              </span>
              <span style={{ color: '#93c5fd' }}>Seg. 01</span>
            </div>
            <div className="text-center font-black tracking-[0.35em]" style={{ color: '#f59e0b', fontSize: 14 }}>
              C U P O M &nbsp; F I S C A L
            </div>
            <div className="flex justify-between text-[10px] mt-0.5">
              <span style={{ color: '#93c5fd' }}>{new Date().toLocaleDateString('pt-BR')} {hora}</span>
              <span style={{ color: '#93c5fd' }}>COO {String(cart.length).padStart(7, '0')}</span>
            </div>
          </div>

          {/* Erro de scan */}
          {erroScan && (
            <div className="flex-shrink-0 px-3 py-2 flex items-center gap-3 animate-pulse"
              style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
              <span style={{ fontSize: 20 }}>🚫</span>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.7)' }}>Código: {erroScan}</p>
                <p className="text-base font-black text-white">PRODUTO SEM CADASTRO — pressione Enter</p>
              </div>
            </div>
          )}

          {/* Header colunas */}
          <div className="flex-shrink-0 grid px-3 py-1 text-[10px] font-black"
            style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', color: '#64748b',
              gridTemplateColumns: '28px 1fr 56px 56px 68px' }}>
            <span>N</span><span>Descrição</span>
            <span className="text-right">Qtd</span>
            <span className="text-right">Unit.</span>
            <span className="text-right">Total</span>
          </div>

          {/* Itens */}
          <div className="flex-1 overflow-y-auto relative"
            style={{ background: cart.length === 0 ? 'linear-gradient(135deg, #ea580c 0%, #f97316 40%, #f59e0b 80%, #fbbf24 100%)' : '#fff' }}>

            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
                <ShoppingCart size={40} />
                <p className="text-sm font-bold">Cupom vazio</p>
                <p className="text-xs">Escaneie ou digite o código do produto</p>
              </div>
            ) : cart.map((item, idx) => (
              <div key={item.uid} className="border-b" style={{ borderColor: '#f1f5f9' }}>
                <div className="grid px-3 py-1.5 text-sm items-start"
                  style={{ gridTemplateColumns: '28px 1fr 56px 56px 68px' }}>
                  <span className="font-bold text-xs" style={{ color: '#94a3b8' }}>{String(idx + 1).padStart(2, '0')}</span>
                  <div className="min-w-0">
                    <p className="font-black leading-tight" style={{ color: '#111', fontSize: 13, textTransform:'uppercase' }}>{item.produto.descricao}</p>
                    <p className="text-[9px] font-mono" style={{ color: '#94a3b8' }}>{item.produto.codigo}</p>
                  </div>
                  <span className="text-right font-bold text-xs" style={{ color: '#475569' }}>
                    {item.peso_kg ? `${item.peso_kg.toFixed(3)}kg` : fmtQtd(item.quantidade)}
                  </span>
                  <span className="text-right font-bold text-xs" style={{ color: '#475569' }}>{fmtVal(item.preco)}</span>
                  <span className="text-right font-black" style={{ color: '#f97316', fontSize: 14 }}>{fmtVal(item.quantidade * item.preco)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desconto/crédito — somente exibição, alteração via Menu [M] → Desconto na Venda */}
          {(totalDesc > 0 || totalCred > 0) && (
            <div className="flex-shrink-0 px-3 py-1 flex items-center gap-3"
              style={{ background: '#fef9c3', borderTop: '1px solid #fde047' }}>
              {totalDesc > 0 && (
                <>
                  <span className="text-[10px] font-bold" style={{ color: '#713f12' }}>Desconto</span>
                  <span className="text-[11px] font-black" style={{ color: '#dc2626' }}>-{fmtMoeda(totalDesc)}</span>
                </>
              )}
              {totalCred > 0 && (
                <>
                  <span className="text-[10px] font-bold ml-2" style={{ color: '#713f12' }}>Crédito Dev.</span>
                  <span className="text-[11px] font-black" style={{ color: '#f97316' }}>-{fmtMoeda(totalCred)}</span>
                </>
              )}
            </div>
          )}

          {/* Subtotal */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3"
            style={{ background: '#1e3a5f', borderTop: '3px solid #f97316' }}>
            <div className="flex items-baseline gap-2">
              <span className="font-black tracking-wider" style={{ color: '#93c5fd', fontSize: 16 }}>SUBTOTAL R$</span>
              <span className="font-bold" style={{ color: '#60a5fa', fontSize: 11 }}>{cart.length} item(s)</span>
            </div>
            <span className="font-black" style={{ color: 'white', fontFamily: 'monospace', fontSize: 32 }}>{fmtVal(subtotal)}</span>
          </div>

          {/* Banner FINALIZADO — abaixo do subtotal */}
          {(countdown > 0 || aguardandoTroco) && (
            <div className="flex-shrink-0 px-3 py-2 flex items-center justify-between"
              style={{ background: 'linear-gradient(135deg,#15803d,#16a34a)', boxShadow: '0 -2px 8px rgba(22,163,74,0.4)' }}>
              <div>
                <p className="text-[10px] font-black tracking-widest" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  ✓ VENDA FINALIZADA — {params?.nome_loja || 'NexusVarejo'}
                </p>
                {aguardandoTroco && Number(pgtoValor) > total && (
                  <p className="font-black text-white" style={{ fontFamily: 'monospace', fontSize: 20, lineHeight: 1.1 }}>
                    Troco: R$ {fmtVal(Number(pgtoValor) - total)}
                  </p>
                )}
                {aguardandoTroco && (
                  <p className="text-[10px] font-bold animate-pulse mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    Enter ou escaneie para próxima venda
                  </p>
                )}
              </div>
              {countdown > 0 && (
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.5)' }}>
                  <span className="font-black text-white" style={{ fontFamily: 'monospace', fontSize: 16 }}>{countdown}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ══ STATUS BAR ══ */}
      <div className="flex-shrink-0 flex items-center gap-4 px-4 py-1.5"
        style={{ background: 'linear-gradient(90deg,#1a0a00 0%,#2d1200 50%,#1a0a00 100%)', borderTop: '2px solid rgba(249,115,22,0.5)' }}>

        {/* Versão */}
        <span style={{ background: 'rgba(249,115,22,0.2)', border: '1px solid rgba(249,115,22,0.4)', borderRadius: 6, padding: '1px 7px', color: '#f97316', fontSize: 10, fontWeight: 700 }}>v1.0</span>

        {/* Operador */}
        <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
          Op: <strong style={{ color: '#fb923c', fontWeight: 800 }}>{user?.nome}</strong>
        </span>

        {/* Terminal */}
        <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
          Terminal: <strong style={{ color: 'white', fontWeight: 800 }}>{params?.terminal || 'PDV-01'}</strong>
        </span>

        {/* Atalho fechar venda */}
        {!pgtoAtivo && cart.length > 0 && countdown === 0 && (
          <span className="text-[11px] font-black animate-pulse"
            style={{ background: 'rgba(253,230,138,0.15)', border: '1px solid #fde68a', borderRadius: 6, padding: '1px 8px', color: '#fde68a' }}>
            [ F ] fechar venda
          </span>
        )}

        {/* Atalhos do teclado */}
        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {['[C] consultar','[L] produto','[Q] quantidade','[P] pedido','[M] menu'].map((k, i) => (
            <span key={i}>
              <span style={{ color: '#f97316', fontWeight: 700 }}>{k[0]}{k[1]}{k[2]}</span>
              <span>{k.slice(3)}</span>
              {i < 4 && <span style={{ color: 'rgba(255,255,255,0.2)' }}> · </span>}
            </span>
          ))}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <Clock size={11} style={{ color: 'rgba(255,255,255,0.65)' }} />
          <span className="text-[11px] font-black font-mono text-white">
            {new Date().toLocaleDateString('pt-BR')} {hora}
          </span>
        </div>
        <a href="/pdv/parametros" target="_blank"
          className="w-6 h-6 rounded flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}>
          <Settings size={11} />
        </a>
      </div>

      {/* ══ FECHAMENTO DE CUPOM (estilo Logus) ══ */}
      {showFechamento && (
        <div className="fixed inset-0 z-40 flex" style={{ background: '#0c1929' }}>

          {/* ─ ESQUERDA: Cupom para o cliente ─ */}
          <div className="flex flex-col" style={{ width: '55%', borderRight: '3px solid #1e3a5f' }}>

            {/* Header cupom */}
            <div className="flex-shrink-0 px-6 py-3" style={{ background: '#1e3a5f' }}>
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: '#93c5fd' }}>Consumidor {clienteCpf ? `CPF: ${clienteCpf}` : 'sem identificação'}</span>
                <span style={{ color: '#93c5fd' }}>{new Date().toLocaleString('pt-BR')}</span>
              </div>
              <div className="text-center font-black tracking-[0.4em]" style={{ color: '#f59e0b', fontSize: 16 }}>
                C U P O M &nbsp; F I S C A L
              </div>
              <div className="text-center text-xs mt-0.5" style={{ color: '#93c5fd' }}>
                {params?.nome_loja || 'NexusVarejo'} — {params?.terminal || 'PDV-01'}
              </div>
            </div>

            {/* Header colunas */}
            <div className="flex-shrink-0 grid px-4 py-1 text-xs font-black"
              style={{ background: '#0f2236', borderBottom: '1px solid #1e3a5f', color: '#60a5fa',
                gridTemplateColumns: '32px 1fr 56px 64px 72px' }}>
              <span>N</span><span>Descrição</span>
              <span className="text-right">Qtd</span>
              <span className="text-right">Unit.</span>
              <span className="text-right">Total</span>
            </div>

            {/* Itens */}
            <div className="flex-1 overflow-y-auto" style={{ background: '#0c1929' }}>
              {cart.map((item, idx) => (
                <div key={item.uid} className="grid px-4 py-2 text-sm border-b"
                  style={{ gridTemplateColumns: '32px 1fr 56px 64px 72px', borderColor: '#1e3a5f' }}>
                  <span className="font-bold" style={{ color: '#60a5fa' }}>{String(idx + 1).padStart(2, '0')}</span>
                  <div>
                    <p className="font-black text-white leading-tight" style={{ textTransform:'uppercase' }}>{item.produto.descricao}</p>
                    <p className="text-[10px] font-mono" style={{ color: '#475569' }}>{item.produto.codigo}</p>
                  </div>
                  <span className="text-right font-bold" style={{ color: '#94a3b8' }}>
                    {item.peso_kg ? `${item.peso_kg.toFixed(3)}` : fmtQtd(item.quantidade)}
                  </span>
                  <span className="text-right font-bold" style={{ color: '#94a3b8' }}>{fmtVal(item.preco)}</span>
                  <span className="text-right font-black" style={{ color: '#f59e0b', fontSize: 15 }}>{fmtVal(item.quantidade * item.preco)}</span>
                </div>
              ))}
            </div>

            {/* Subtotal */}
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-3"
              style={{ background: '#0f2236', borderTop: '2px solid #1e3a5f' }}>
              <span className="text-base font-black" style={{ color: '#60a5fa' }}>
                {cart.length} item(s)
              </span>
              <div className="text-right">
                {totalDesc > 0 && (
                  <p className="text-xs font-bold" style={{ color: '#ef4444' }}>Desconto: -{fmtMoeda(totalDesc)}</p>
                )}
                <p className="text-4xl font-black" style={{ color: '#f59e0b', fontFamily: 'monospace' }}>
                  R$ {fmtVal(total)}
                </p>
              </div>
            </div>
          </div>

          {/* ─ DIREITA: Operador — Formas de Recebimento ─ */}
          <div className="flex flex-col flex-1" style={{ background: '#0a1222' }}>

            {/* Header */}
            <div className="flex-shrink-0 px-6 py-4 flex items-center justify-between"
              style={{ background: '#1e3a5f', borderBottom: '3px solid #f59e0b' }}>
              <div>
                <p className="text-xl font-black tracking-widest" style={{ color: '#f59e0b' }}>
                  FECHAMENTO DE CUPOM
                </p>
                <p className="text-xs" style={{ color: '#93c5fd' }}>
                  Op: {user?.nome} — {new Date().toLocaleTimeString('pt-BR')}
                </p>
              </div>
              <button onClick={() => { setShowFechamento(false); setTimeout(() => buscaRef.current?.focus(), 80) }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-bold"
                style={{ background: 'rgba(255,255,255,0.1)', color: '#93c5fd' }}>
                ← [ESC]
              </button>
            </div>

            {/* Total a pagar */}
            <div className="flex-shrink-0 px-6 py-4 flex items-center justify-between"
              style={{ background: '#0f2236', borderBottom: '1px solid #1e3a5f' }}>
              <span className="text-sm font-bold" style={{ color: '#60a5fa' }}>TOTAL A RECEBER</span>
              <span className="text-5xl font-black" style={{ color: '#f59e0b', fontFamily: 'monospace' }}>
                R$ {fmtVal(total)}
              </span>
            </div>

            {/* Formas de recebimento numeradas */}
            <div className="flex-shrink-0 px-4 py-3" style={{ borderBottom: '1px solid #1e3a5f' }}>
              <p className="text-xs font-black mb-2" style={{ color: '#60a5fa' }}>FORMAS DE RECEBIMENTO</p>
              <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
                {formasSorted.map((f, i) => {
                  const sel = pgtoForma === f.chave && pgtoAtivo
                  const cores: Record<string, string> = {
                    DINHEIRO: '#16a34a', CREDITO: '#2563eb', DEBITO: '#7c3aed',
                    PIX: '#0891b2', BOLETO: '#d97706', CHEQUE: '#dc2626',
                  }
                  const cor = cores[f.chave] || '#f97316'
                  return (
                    <button key={f.chave}
                      onClick={() => { selecionarForma(String(i + 1)); setTimeout(() => pgtoRef.current?.focus(), 60) }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left"
                      style={{
                        background: sel ? cor : `${cor}22`,
                        border: `2px solid ${sel ? cor : `${cor}55`}`,
                        boxShadow: sel ? `0 4px 16px ${cor}55` : 'none',
                      }}>
                      <span className="w-7 h-7 rounded-lg text-sm font-black flex items-center justify-center flex-shrink-0"
                        style={{ background: sel ? 'rgba(255,255,255,0.3)' : cor, color: 'white' }}>
                        {i + 1}
                      </span>
                      <div>
                        <span className="text-sm font-black" style={{ color: sel ? 'white' : cor }}>
                          {f.nome}
                        </span>
                        {sel && <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.7)' }}>selecionado</p>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* TROCO — banner */}
            {Number(pgtoValor) > total && (
              <div className="flex-shrink-0 mx-4 my-2 px-5 py-3 rounded-2xl flex items-center justify-between"
                style={{
                  background: 'linear-gradient(135deg,#15803d,#16a34a)',
                  boxShadow: '0 6px 24px rgba(22,163,74,0.5)',
                }}>
                <div>
                  <p className="text-xs font-black" style={{ color: 'rgba(255,255,255,0.7)', letterSpacing: '0.15em' }}>TROCO</p>
                  <p className="text-5xl font-black text-white" style={{ fontFamily: 'monospace', lineHeight: 1.1 }}>
                    R$ {fmtVal(Number(pgtoValor) - total)}
                  </p>
                </div>
                <span style={{ fontSize: 52, opacity: 0.35 }}>💵</span>
              </div>
            )}

            {/* Campo entrada de valor */}
            <div className="flex-1 flex flex-col justify-end px-4 pb-4 gap-3">
              <div className="flex gap-3">
                <div style={{ flex: '0 0 90px' }}>
                  <p className="text-xs font-black mb-1" style={{ color: '#60a5fa' }}>FORMA:</p>
                  <input ref={pgtoNumRef} type="text" value={pgtoNum} maxLength={2}
                    onChange={e => selecionarForma(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === 'Tab') {
                        e.preventDefault()
                        const f = formasSorted[Number(pgtoNum) - 1]
                        if (f) {
                          setPgtoValorExterno(String(total.toFixed(2)))
                          if (f.aceita_troco) pgtoRef.current?.focus()
                          else setTimeout(finalizarRapido, 150)
                        }
                      }
                    }}
                    placeholder="N"
                    className="w-full text-center font-black rounded-xl py-3 outline-none"
                    style={{
                      background: '#0f2236',
                      color: '#f59e0b', fontFamily: 'monospace', fontSize: 32,
                      border: `3px solid ${pgtoAtivo ? '#f59e0b' : '#1e3a5f'}`
                    }} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-black mb-1" style={{ color: '#60a5fa' }}>VALOR RECEBIDO (R$):</p>
                  <input ref={pgtoRef} type="text" inputMode="numeric"
                    value={fmtPgtoDisplay()}
                    onChange={e => onPgtoDigitChange(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') finalizarRapido() }}
                    placeholder={fmtVal(total)}
                    className="w-full text-right font-black rounded-xl px-4 py-3 outline-none"
                    style={{
                      background: '#0f2236', fontFamily: 'monospace', fontSize: 32,
                      color: pgtoValor ? (Number(pgtoValor) >= total ? '#22c55e' : '#ef4444') : '#475569',
                      border: `3px solid ${pgtoAtivo ? '#f59e0b' : '#1e3a5f'}`
                    }} />
                </div>
              </div>

              {/* Botão OK */}
              <button onClick={finalizarRapido} disabled={saving || !cart.length || countdown > 0}
                className="w-full py-5 rounded-2xl font-black text-2xl text-white"
                style={{
                  background: cart.length && !saving && countdown === 0 && pgtoAtivo
                    ? 'linear-gradient(135deg,#f59e0b,#ea580c)'
                    : '#1e3a5f',
                  color: pgtoAtivo ? 'white' : '#475569',
                  letterSpacing: '0.1em',
                }}>
                {saving ? 'FINALIZANDO...' : countdown > 0 ? `OK — ${countdown}s` : '[ ENTER ] CONFIRMAR VENDA'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MENU [M] — estilo Logus, numerado, navegável por seta ══ */}
      {showMenu && (() => {
        const itens = [
          { n: 1, label: 'Identificar Cliente',  sub: 'CPF / CNPJ / Nome',             cor: '#3b82f6',
            action: () => { setShowMenu(false); setMenuSel(0); abrirModalCliente() } },
          { n: 2, label: 'Busca de Produto',      sub: 'Pesquisar código ou nome [L]',   cor: '#22c55e',
            action: () => { setShowMenu(false); setMenuSel(0); setBuscaProdModal(''); setBuscaProdSel(0); setConsultaMode('produto'); setCpfBusca(true); setTimeout(() => buscaProdRef.current?.focus(), 80) } },
          { n: 3, label: 'Fechar Cupom',          sub: 'Ir para pagamento [F]',          cor: '#f97316',
            action: () => { setShowMenu(false); setMenuSel(0); if (cart.length) { setPgtoAtivo(false); setPgtoForma(''); setPgtoNum(''); setPgtoValor(''); setPgtoDigits(''); setTimeout(() => pgtoNumRef.current?.focus(), 80) } } },
          { n: 4, label: 'Desconto na Venda',     sub: `Máximo ${params?.desconto_maximo_pct ?? 10}%`, cor: '#f59e0b',
            action: () => { setShowMenu(false); setMenuSel(0); const v = prompt('Desconto %:'); if (v !== null) setDesconto(Math.min(Number(v)||0, params?.desconto_maximo_pct ?? 10)) } },
          { n: 5, label: 'Cancelar Venda',        sub: 'Zerar o cupom atual',            cor: '#ef4444',
            action: () => { setShowMenu(false); setMenuSel(0); if (confirm('Cancelar a venda atual?')) { setCart([]); setPgtoAtivo(false); setPgtoValor(''); setPgtoDigits(''); setPgtoNum(''); setLastScanned(null) } } },
          { n: 6, label: 'Carregar Pedido',       sub: 'Importar pedido de venda',       cor: '#8b5cf6',
            action: () => { setShowMenu(false); setMenuSel(0); abrirModalPedido() } },
          { n: 7, label: 'Abertura de Caixa',      sub: 'Operador + fundo de caixa',       cor: '#0891b2',
            action: () => { setShowMenu(false); setMenuSel(0); setShowAbertura(true) } },
          { n: 8, label: 'Sangria',               sub: 'Retirada de dinheiro do caixa',  cor: '#ef4444',
            action: () => { setShowMenu(false); setMenuSel(0); setMovCaixaVal(''); setMovCaixaObs(''); setShowMovCaixa('sangria') } },
          { n: 9, label: 'Suprimento',            sub: 'Entrada de dinheiro no caixa',   cor: '#22c55e',
            action: () => { setShowMenu(false); setMenuSel(0); setMovCaixaVal(''); setMovCaixaObs(''); setShowMovCaixa('suprimento') } },
          { n: 10, label: 'Fechar Caixa',         sub: 'Encerrar o caixa do dia',        cor: '#f59e0b',
            action: () => { setShowMenu(false); setMenuSel(0); setMovCaixaVal(''); setShowMovCaixa('fechar') } },
          { n: 11, label: 'Parâmetros PDV',       sub: 'Configurações do terminal',      cor: '#64748b',
            action: () => { setShowMenu(false); setMenuSel(0); window.open('/pdv/parametros', '_blank') } },
          { n: 12, label: 'Sair / Logout',        sub: user?.nome || '',                 cor: '#dc2626',
            action: () => logout() },
          { n: 13, label: 'Alterar Preço',        sub: 'Requer senha supervisor',         cor: '#b45309',
            action: () => { setShowMenu(false); setMenuSel(0); setAltEtapa('supervisor'); setAltSupNum(''); setAltSupSenha(''); setAltCodigo(''); setAltPreco(''); setShowAlterarPreco(true) } },
        ]
        return (
          <div className="fixed inset-0 z-40 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.75)' }}
            onClick={() => { setShowMenu(false); setMenuSel(0) }}>
            <div className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl"
              style={{ background: '#fff', border: '3px solid #f97316' }}
              onClick={e => e.stopPropagation()}>

              {/* Header laranja */}
              <div className="px-6 py-4 flex items-center justify-between"
                style={{ background: 'linear-gradient(135deg,#ea580c,#f97316,#f59e0b)', borderBottom: '2px solid rgba(0,0,0,0.15)' }}>
                <p className="text-xl font-black tracking-wide" style={{ color: '#000' }}>Menu de Funções</p>
                <div className="flex items-center gap-4">
                  <span className="text-[11px] font-bold" style={{ color: 'rgba(0,0,0,0.6)' }}>
                    ↑↓ navegar · Enter selecionar · ESC fechar
                  </span>
                  <button onClick={() => { setShowMenu(false); setMenuSel(0) }} style={{ color: 'rgba(0,0,0,0.5)' }}>
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Duas colunas */}
              <div className="p-3 flex gap-2" style={{ background: '#f8fafc' }}>
                {[itens.slice(0, 5), itens.slice(5, 10)].map((col, ci) => (
                  <div key={ci} className="flex-1 flex flex-col gap-1.5">
                    {col.map((item) => {
                      const idx = item.n - 1
                      const sel = menuSel === idx
                      return (
                        <button key={item.n} id={`menu-item-${idx}`} onClick={item.action}
                          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-left w-full"
                          style={{
                            background: sel ? item.cor : '#fff',
                            border: `2px solid ${sel ? item.cor : item.cor + '55'}`,
                            boxShadow: sel ? `0 3px 12px ${item.cor}44` : '0 1px 3px rgba(0,0,0,0.06)',
                          }}
                          onMouseEnter={() => setMenuSel(idx)}>
                          <span className="w-7 h-7 rounded-lg text-sm font-black flex items-center justify-center flex-shrink-0"
                            style={{ background: sel ? 'rgba(255,255,255,0.25)' : item.cor, color: 'white' }}>
                            {item.n}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-black truncate" style={{ color: sel ? '#fff' : '#1e3a5f' }}>{item.label}</p>
                            <p className="text-[9px] truncate" style={{ color: sel ? 'rgba(255,255,255,0.7)' : '#94a3b8' }}>{item.sub}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="px-6 py-2 flex items-center gap-6" style={{ background: '#1e3a5f', borderTop: '2px solid #f97316' }}>
                <span className="text-[10px] font-bold" style={{ color: '#93c5fd' }}>Op: {user?.nome}</span>
                <span className="text-[10px] font-bold" style={{ color: '#93c5fd' }}>Terminal: {params?.terminal || 'PDV-01'}</span>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Modal Pedidos (Venda + Marketplace) ────────────────────────────── */}
      {showPedido && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm rounded-3xl overflow-hidden"
            style={{ background: '#fff', border: '3px solid #f97316' }}>

            {/* Header laranja */}
            <div className="flex items-center justify-between px-5 py-4"
              style={{ background: 'linear-gradient(135deg,#ea580c,#f97316,#f59e0b)', borderBottom: '2px solid rgba(0,0,0,0.1)' }}>
              <p className="font-black text-lg flex items-center gap-2" style={{ color: '#000' }}>
                <Package size={18} color="rgba(0,0,0,0.6)" />
                {pedidoInfo ? 'Detalhes do Pedido' : 'Carregar Pedido'}
              </p>
              <button onClick={() => { setShowPedido(false); setPedidoInfo(null) }}
                style={{ color: 'rgba(0,0,0,0.5)' }}><X size={20} /></button>
            </div>

            {!pedidoInfo ? (
            <div className="p-5 space-y-4" style={{ background: '#f8fafc' }}>
              {/* Tabs */}
              <div className="flex gap-2">
                {([
                  { k: 'venda',       l: '🧾 Pedido de Venda',  cor: '#f97316', cnt: listaPedidos.length },
                  { k: 'marketplace', l: '🛒 Marketplace',       cor: '#1e3a5f', cnt: listaMkt.length     },
                ] as const).map(t => (
                  <button key={t.k}
                    onClick={() => { setPedidoTab(t.k); setPedidoListSel(0) }}
                    className="flex-1 py-2.5 rounded-2xl font-black text-sm flex items-center justify-center gap-1.5"
                    style={{
                      background: pedidoTab === t.k ? t.cor : '#fff',
                      color:      pedidoTab === t.k ? '#fff' : '#94a3b8',
                      border:     `2px solid ${pedidoTab === t.k ? t.cor : '#e2e8f0'}`,
                    }}>
                    {t.l}
                    {t.cnt > 0 && (
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                        style={{ background: pedidoTab === t.k ? 'rgba(255,255,255,0.3)' : t.cor, color: '#fff' }}>{t.cnt}</span>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-center font-bold" style={{ color: '#94a3b8' }}>← → trocar aba · ↑↓ navegar · Enter carregar</p>

              {/* Busca por número */}
              <div className="flex gap-2">
                <input type="text" value={numPedido}
                  onChange={e => setNumPedido(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && carregarPedido()}
                  placeholder="Número do pedido..."
                  className="flex-1 px-3 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: '#fff', border: '2px solid #f97316', color: '#1e3a5f', outline: 'none' }} />
                <button onClick={() => carregarPedido()} disabled={loadingPed || !numPedido.trim()}
                  className="px-4 py-2.5 rounded-xl font-black text-white text-sm"
                  style={{ background: numPedido.trim() ? '#1e3a5f' : '#e2e8f0', color: numPedido.trim() ? '#fff' : '#94a3b8' }}>
                  {loadingPed ? <RefreshCw size={14} className="animate-spin" /> : 'Buscar'}
                </button>
              </div>

              {/* Erro inline do pedido */}
              {erroPedido && (
                <div className="rounded-xl px-4 py-3 flex items-center gap-3"
                  style={{ background: '#fef2f2', border: '2px solid #fca5a5' }}>
                  <AlertCircle size={18} color="#ef4444" />
                  <div className="flex-1">
                    <p className="text-sm font-black" style={{ color: '#dc2626' }}>{erroPedido}</p>
                    <p className="text-xs font-bold mt-0.5" style={{ color: '#ef4444' }}>Pressione Enter para voltar</p>
                  </div>
                </div>
              )}

              {/* Lista */}
              {!erroPedido && (() => {
                const lista = pedidoTab === 'venda' ? listaPedidos : listaMkt
                const cor   = pedidoTab === 'venda' ? '#f97316' : '#1e3a5f'
                return (
                  <div>
                    <p className="text-xs font-black mb-2" style={{ color: '#94a3b8' }}>
                      {pedidoTab === 'venda' ? 'PEDIDOS DE VENDA' : 'PEDIDOS MARKETPLACE'}
                      {lista.length > 0 && ` (${lista.length})`}
                    </p>
                    {loadingLista ? (
                      <p className="text-center text-xs py-4 font-bold" style={{ color: '#94a3b8' }}>Carregando...</p>
                    ) : lista.length === 0 ? (
                      <p className="text-center text-xs py-4 font-bold" style={{ color: '#94a3b8' }}>Nenhum pedido pendente</p>
                    ) : (
                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                        {lista.map((p, idx) => {
                          const sel = idx === pedidoListSel
                          return (
                          <button id={`ped-item-${idx}`} key={p.id}
                            onClick={() => carregarPedido(p.numero)}
                            disabled={loadingPed}
                            onMouseEnter={() => setPedidoListSel(idx)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left"
                            style={{
                              background: sel ? '#fff7ed' : '#fff',
                              border: `2px solid ${sel ? cor : '#e2e8f0'}`,
                              boxShadow: sel ? `0 2px 8px ${cor}22` : 'none',
                            }}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black" style={{ color: cor }}>{p.numero}</span>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                                  style={{ background: '#f1f5f9', color: '#64748b' }}>
                                  {p.status === 'AGUARDANDO_PDV' ? 'ABERTO' : p.status}
                                </span>
                              </div>
                              <p className="text-[10px] mt-0.5 truncate font-bold" style={{ color: '#64748b' }}>
                                {p.cliente_nome || 'Consumidor Final'}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm font-black" style={{ color: '#f97316' }}>{fmtMoeda(p.total)}</p>
                              <p className="text-[9px] font-bold" style={{ color: '#94a3b8' }}>{p.itens?.length || 0} item(s)</p>
                            </div>
                            <ChevronRight size={14} style={{ color: sel ? cor : '#cbd5e1', flexShrink: 0 }} />
                          </button>
                        )})}
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
            ) : (
            <div className="p-5 space-y-4" style={{ background: '#f8fafc' }}>
              <div className="rounded-2xl p-4 space-y-2" style={{ background: '#fff', border: '2px solid #e2e8f0' }}>

                <div className="flex justify-between items-center">
                  <p className="font-black text-lg" style={{ color: '#f97316' }}>{pedidoInfo.numero}</p>
                  <p className="font-black text-xl" style={{ color: '#1e3a5f' }}>{fmtMoeda(pedidoInfo.total)}</p>
                </div>
                <p className="text-xs" style={{ color: '#64748b' }}>
                  Cliente: <strong style={{ color: '#1e3a5f' }}>{pedidoInfo.cliente_nome || 'Consumidor Final'}</strong>
                </p>
                <p className="text-xs" style={{ color: '#64748b' }}>
                  Fiscal: <strong style={{ color: '#1e3a5f' }}>{pedidoInfo.tipo_fiscal}</strong>
                  {' · '}Forma: <strong style={{ color: '#1e3a5f' }}>{pedidoInfo.forma_recebimento || '—'}</strong>
                </p>
                <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                  {pedidoInfo.itens.map((it: any, i: number) => (
                    <div key={i} className="flex justify-between text-xs" style={{ color: '#64748b' }}>
                      <span style={{ color: '#1e3a5f' }}>{it.quantidade}× {it.descricao}</span>
                      <span style={{ color: '#f97316' }}>{fmtMoeda(it.preco_unitario * it.quantidade)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={confirmarPedido}
                className="w-full py-3.5 rounded-2xl font-black flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg,#ea580c,#f97316,#f59e0b)', color: '#000' }}>
                <Check size={16} /> CARREGAR NO PDV — Enter
              </button>
              <button onClick={() => { setPedidoInfo(null); setNumPedido('') }}
                className="w-full py-2 rounded-xl text-sm font-bold"
                style={{ color: '#94a3b8' }}>
                ← Voltar para lista
              </button>
            </div>
            )}

          </div>
        </div>
      )}

      {/* ══ MODAL ALTERAR PREÇO (supervisor) ══ */}
      {showAlterarPreco && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.88)' }}>
          <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
            style={{ background: '#1e293b', border: '2px solid #b45309' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4"
              style={{ background: '#0f172a', borderBottom: '2px solid #b45309' }}>
              <div>
                <p className="text-xs font-black tracking-widest" style={{ color: '#fbbf24' }}>ALTERAR PREÇO DE PRODUTO</p>
                <p className="text-[11px] mt-0.5" style={{ color: '#64748b' }}>
                  {altEtapa === 'supervisor' ? 'Etapa 1 — Autorização do Supervisor' : 'Etapa 2 — Produto e Novo Preço'}
                </p>
              </div>
              <button onClick={() => setShowAlterarPreco(false)} style={{ color: '#475569' }}><X size={18} /></button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {altEtapa === 'supervisor' ? (
                <>
                  <div>
                    <label className="text-[10px] font-black tracking-widest block mb-1.5" style={{ color: '#fbbf24' }}>NÚMERO DO SUPERVISOR</label>
                    <input type="number" value={altSupNum} onChange={e => setAltSupNum(e.target.value)}
                      placeholder="001" autoFocus
                      className="w-full text-center font-black rounded-2xl py-3 outline-none"
                      style={{ background: '#0f172a', color: '#fbbf24', fontFamily: 'monospace', fontSize: 32, border: '2px solid #b45309' }} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black tracking-widest block mb-1.5" style={{ color: '#fbbf24' }}>SENHA DO SUPERVISOR</label>
                    <input type="password" value={altSupSenha} onChange={e => setAltSupSenha(e.target.value)}
                      placeholder="••••••"
                      onKeyDown={async e => {
                        if (e.key !== 'Enter') return
                        if (!altSupNum || !altSupSenha) return
                        setAltSalvando(true)
                        try {
                          await api.post('/pdv/supervisor/validar', { numero: Number(altSupNum), senha: altSupSenha })
                          setAltEtapa('preco')
                        } catch { alert('Supervisor inválido ou senha incorreta') }
                        setAltSalvando(false)
                      }}
                      className="w-full text-center font-black rounded-2xl py-3 outline-none"
                      style={{ background: '#0f172a', color: '#fbbf24', fontFamily: 'monospace', fontSize: 24, border: '2px solid #b45309', letterSpacing: 8 }} />
                  </div>
                  <button disabled={altSalvando || !altSupNum || !altSupSenha}
                    onClick={async () => {
                      setAltSalvando(true)
                      try {
                        await api.post('/pdv/supervisor/validar', { numero: Number(altSupNum), senha: altSupSenha })
                        setAltEtapa('preco')
                      } catch { alert('Supervisor inválido ou senha incorreta') }
                      setAltSalvando(false)
                    }}
                    className="w-full py-3.5 rounded-2xl font-black text-white"
                    style={{ background: altSalvando ? '#334155' : 'linear-gradient(135deg,#b45309,#92400e)' }}>
                    {altSalvando ? 'Validando...' : '→ VALIDAR SUPERVISOR'}
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-[10px] font-black tracking-widest block mb-1.5" style={{ color: '#fbbf24' }}>CÓDIGO DO PRODUTO</label>
                    <input type="text" value={altCodigo} onChange={e => setAltCodigo(e.target.value)}
                      placeholder="Código ou código de barras" autoFocus
                      className="w-full px-4 font-black rounded-2xl py-3 outline-none"
                      style={{ background: '#0f172a', color: '#fff', fontFamily: 'monospace', fontSize: 18, border: '2px solid #b45309' }} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black tracking-widest block mb-1.5" style={{ color: '#fbbf24' }}>NOVO PREÇO R$</label>
                    <input type="number" min="0.01" step="0.01" value={altPreco} onChange={e => setAltPreco(e.target.value)}
                      placeholder="0,00"
                      onKeyDown={e => { if (e.key === 'Enter') document.getElementById('btn-alt-preco')?.click() }}
                      className="w-full text-right font-black rounded-2xl px-4 py-3 outline-none"
                      style={{ background: '#0f172a', color: '#22c55e', fontFamily: 'monospace', fontSize: 32, border: '2px solid #b45309' }} />
                  </div>
                  <button id="btn-alt-preco" disabled={altSalvando || !altCodigo || !altPreco}
                    onClick={async () => {
                      const p = Number(altPreco)
                      if (!altCodigo || p <= 0) return
                      setAltSalvando(true)
                      try {
                        await api.post('/pdv/alterar-preco', {
                          supervisor_num: Number(altSupNum),
                          supervisor_senha: altSupSenha,
                          codigo: altCodigo.trim(),
                          novo_preco: p,
                        })
                        // Atualiza o produto na lista local
                        setProdutos(ps => ps.map(pr =>
                          (pr.codigo === altCodigo.trim() || pr.codigo_barras === altCodigo.trim())
                            ? { ...pr, preco_venda: p }
                            : pr
                        ))
                        alert(`Preço alterado com sucesso! R$ ${fmtVal(p)}`)
                        setShowAlterarPreco(false)
                      } catch (err: any) { alert(err.response?.data?.detail || 'Erro ao alterar preço') }
                      setAltSalvando(false)
                    }}
                    className="w-full py-3.5 rounded-2xl font-black text-white"
                    style={{ background: altSalvando ? '#334155' : 'linear-gradient(135deg,#16a34a,#15803d)' }}>
                    {altSalvando ? 'Salvando...' : '✓ ALTERAR PREÇO'}
                  </button>
                </>
              )}
              <p className="text-center text-[10px]" style={{ color: '#334155' }}>ESC para cancelar</p>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL QUANTIDADE [Q] / PESO pesável ══ */}
      {modoQtd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.82)' }}>
          <div className="w-full max-w-xs rounded-3xl overflow-hidden shadow-2xl"
            style={{ background: '#1e293b', border: `2px solid ${prodPesavel ? '#22c55e' : '#f97316'}` }}>
            <div className="px-6 py-4" style={{ background: '#0f172a', borderBottom: `2px solid ${prodPesavel ? '#22c55e' : '#f97316'}` }}>
              <p className="text-xs font-black tracking-widest" style={{ color: prodPesavel ? '#22c55e' : '#f97316' }}>
                {prodPesavel ? 'PESO (kg)' : 'QUANTIDADE'}
              </p>
              {prodPesavel
                ? <p className="text-sm font-bold mt-0.5 text-white" style={{ textTransform:'uppercase' }}>{prodPesavel.descricao}</p>
                : <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>Digite a quantidade e pressione Enter</p>}
            </div>
            <div className="px-6 py-5 space-y-4">
              <input
                ref={qtdRef}
                type="number" min="0.001" step="0.001"
                value={inputQtd}
                onChange={e => setInputQtd(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const q = parseFloat(inputQtd.replace(',', '.'))
                    if (q > 0) {
                      if (prodPesavel) {
                        addItem(prodPesavel, 1, q)
                        setProdPesavel(null)
                      } else {
                        setQtdPendente(q)
                      }
                      setModoQtd(false); setInputQtd('')
                      setTimeout(() => buscaRef.current?.focus(), 60)
                    }
                  }
                  if (e.key === 'Escape') {
                    setModoQtd(false); setInputQtd(''); setQtdPendente(1); setProdPesavel(null)
                    setTimeout(() => buscaRef.current?.focus(), 60)
                  }
                }}
                placeholder={prodPesavel ? '0,000' : '0'}
                className="w-full text-center font-black rounded-2xl py-4 outline-none"
                style={{ background: '#0f172a', color: prodPesavel ? '#22c55e' : '#f97316',
                  fontFamily: 'monospace', fontSize: 52,
                  border: `3px solid ${prodPesavel ? '#22c55e' : '#f97316'}`, letterSpacing: 2 }}
              />
              <button
                onClick={() => {
                  const q = parseFloat(inputQtd.replace(',', '.'))
                  if (q > 0) {
                    if (prodPesavel) { addItem(prodPesavel, 1, q); setProdPesavel(null) }
                    else { setQtdPendente(q) }
                    setModoQtd(false); setInputQtd('')
                    setTimeout(() => buscaRef.current?.focus(), 60)
                  }
                }}
                className="w-full py-3.5 rounded-2xl font-black text-white"
                style={{ background: prodPesavel ? 'linear-gradient(135deg,#16a34a,#15803d)' : 'linear-gradient(135deg,#f97316,#ea580c)' }}>
                {prodPesavel ? '✓ CONFIRMAR PESO' : '✓ CONFIRMAR QUANTIDADE'}
              </button>
              <p className="text-center text-xs" style={{ color: '#475569' }}>ESC para cancelar</p>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL ABERTURA DE CAIXA ══ */}
      {showAbertura && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.88)' }}>
          <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
            style={{ background: '#18181B', border: '2px solid #0891b2' }}>
            <div className="flex items-center justify-between px-6 py-4"
              style={{ background: '#0c4a6e', borderBottom: '2px solid #0891b2' }}>
              <div>
                <p className="font-black text-lg text-white">Abertura de Caixa</p>
                <p className="text-[11px]" style={{ color: '#7dd3fc' }}>{params?.terminal || 'PDV-01'} — {new Date().toLocaleDateString('pt-BR')} {hora}</p>
              </div>
              <button onClick={() => setShowAbertura(false)} style={{ color: '#71717A' }}><X size={20} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <p className="text-xs font-black mb-1.5" style={{ color: '#71717A' }}>NÚMERO DO OPERADOR</p>
                <input type="number" value={operadorNum}
                  onChange={e => setOperadorNum(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && document.getElementById('ab-fundo')?.focus()}
                  placeholder="0" autoFocus
                  className="w-full px-4 py-4 rounded-2xl text-white text-center font-black"
                  style={{ background: '#27272A', fontSize: 32, border: '2px solid #0891b2' }} />
              </div>
              <div>
                <p className="text-xs font-black mb-1.5" style={{ color: '#71717A' }}>FUNDO DE CAIXA R$</p>
                <input id="ab-fundo" type="number" step="0.01" min="0" value={fundoCaixa}
                  onChange={e => setFundoCaixa(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && abrirCaixa()}
                  placeholder="0,00"
                  className="w-full px-4 py-4 rounded-2xl text-white text-center font-black"
                  style={{ background: '#27272A', fontSize: 32, fontFamily: 'monospace', border: '2px solid #0891b2' }} />
              </div>
              <button onClick={abrirCaixa} disabled={!operadorNum || salvandoAb}
                className="w-full py-4 rounded-2xl font-black text-white text-lg"
                style={{ background: operadorNum ? 'linear-gradient(135deg,#0891b2,#0e7490)' : '#27272A',
                  color: operadorNum ? 'white' : '#52525B' }}>
                {salvandoAb ? 'REGISTRANDO...' : '✓ ABRIR CAIXA'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL SANGRIA / SUPRIMENTO / FECHAR CAIXA ══ */}
      {showMovCaixa && (() => {
        const cfg = {
          sangria:    { title: 'Sangria de Caixa',   sub: 'Retirada de dinheiro',  cor: '#ef4444', bg: '#450a0a', icon: '💸', endpoint: '/caixa/sangria',    btnLabel: '✓ REGISTRAR SANGRIA' },
          suprimento: { title: 'Suprimento de Caixa', sub: 'Entrada de dinheiro',   cor: '#22c55e', bg: '#052e16', icon: '💰', endpoint: '/caixa/suprimento', btnLabel: '✓ REGISTRAR SUPRIMENTO' },
          fechar:     { title: 'Fechar Caixa',         sub: 'Encerrar o caixa do dia', cor: '#f59e0b', bg: '#451a03', icon: '🔒', endpoint: '/caixa/fechar',    btnLabel: '✓ FECHAR CAIXA' },
        }[showMovCaixa]
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.88)' }}>
            <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
              style={{ background: '#18181B', border: `2px solid ${cfg.cor}` }}>
              <div className="flex items-center justify-between px-6 py-4"
                style={{ background: cfg.bg, borderBottom: `2px solid ${cfg.cor}` }}>
                <div>
                  <p className="font-black text-lg text-white flex items-center gap-2">
                    <span>{cfg.icon}</span> {cfg.title}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {params?.terminal || 'PDV-01'} — {new Date().toLocaleDateString('pt-BR')} {hora}
                  </p>
                </div>
                <button onClick={() => setShowMovCaixa(null)} style={{ color: '#71717A' }}><X size={20} /></button>
              </div>
              <div className="px-6 py-5 space-y-4">
                {showMovCaixa !== 'fechar' && (
                  <>
                    <div>
                      <p className="text-xs font-black mb-1.5" style={{ color: '#71717A' }}>VALOR R$</p>
                      <input type="number" min="0.01" step="0.01" value={movCaixaVal}
                        onChange={e => setMovCaixaVal(e.target.value)}
                        autoFocus
                        placeholder="0,00"
                        className="w-full px-4 py-4 rounded-2xl text-white text-center font-black"
                        style={{ background: '#27272A', fontSize: 36, fontFamily: 'monospace', border: `2px solid ${cfg.cor}`, outline: 'none' }} />
                    </div>
                    <div>
                      <p className="text-xs font-black mb-1.5" style={{ color: '#71717A' }}>OBSERVAÇÃO (opcional)</p>
                      <input type="text" value={movCaixaObs}
                        onChange={e => setMovCaixaObs(e.target.value)}
                        placeholder="Motivo ou descrição..."
                        className="w-full px-4 py-3 rounded-2xl text-white font-bold"
                        style={{ background: '#27272A', border: '1px solid #3F3F46', outline: 'none' }} />
                    </div>
                  </>
                )}
                {showMovCaixa === 'fechar' && (
                  <div>
                    <p className="text-xs font-black mb-1.5" style={{ color: '#71717A' }}>TOTAL CONTADO R$ (opcional)</p>
                    <input type="number" min="0" step="0.01" value={movCaixaVal}
                      onChange={e => setMovCaixaVal(e.target.value)}
                      autoFocus
                      placeholder="0,00"
                      className="w-full px-4 py-4 rounded-2xl text-white text-center font-black"
                      style={{ background: '#27272A', fontSize: 36, fontFamily: 'monospace', border: `2px solid ${cfg.cor}`, outline: 'none' }} />
                    <p className="text-[10px] mt-2 text-center" style={{ color: '#52525B' }}>
                      Deixe em branco se não quiser informar o total contado
                    </p>
                  </div>
                )}
                <button
                  disabled={movCaixaSaving || (showMovCaixa !== 'fechar' && !movCaixaVal)}
                  onClick={async () => {
                    setMovCaixaSaving(true)
                    try {
                      const body: any = {}
                      if (showMovCaixa !== 'fechar') {
                        body.valor = Number(movCaixaVal)
                        body.observacao = movCaixaObs || undefined
                      } else {
                        if (movCaixaVal) body.total_contado = Number(movCaixaVal)
                      }
                      await api.post(cfg.endpoint, body)
                      alert(`${cfg.title} registrado(a) com sucesso!`)
                      setShowMovCaixa(null)
                    } catch (e: any) {
                      alert(e.response?.data?.detail || 'Erro ao registrar')
                    }
                    setMovCaixaSaving(false)
                  }}
                  className="w-full py-4 rounded-2xl font-black text-white text-base"
                  style={{
                    background: (movCaixaSaving || (showMovCaixa !== 'fechar' && !movCaixaVal))
                      ? '#27272A' : `linear-gradient(135deg,${cfg.cor},${cfg.cor}cc)`,
                    color: (showMovCaixa !== 'fechar' && !movCaixaVal) ? '#52525B' : 'white',
                  }}>
                  {movCaixaSaving ? 'Registrando...' : cfg.btnLabel}
                </button>
                <p className="text-center text-[10px]" style={{ color: '#334155' }}>ESC para cancelar</p>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ══ MODAL UNIFICADO CONSULTA [C] / [L] ══ */}
      {cpfBusca && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="w-full max-w-lg rounded-3xl overflow-hidden"
            style={{ background: '#fff', border: '3px solid #f97316', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>

            {/* Header laranja */}
            <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#ea580c,#f97316,#f59e0b)', borderBottom: '2px solid rgba(0,0,0,0.15)' }}>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 22 }}>{consultaMode === 'cliente' ? '👤' : '🔍'}</span>
                <div>
                  <p className="font-black text-lg" style={{ color: '#000' }}>
                    {consultaMode === 'cliente' ? 'Consultar Cliente' : 'Consultar Produto'}
                  </p>
                  <p className="text-[10px] font-bold" style={{ color: 'rgba(0,0,0,0.55)' }}>↑↓ navegar · Enter confirmar · Esc fechar</p>
                </div>
              </div>
              <button onClick={() => setCpfBusca(false)} style={{ color: 'rgba(0,0,0,0.5)' }}><X size={20} /></button>
            </div>

            {/* ── MODO CLIENTE ── */}
            {consultaMode === 'cliente' && (
            <div className="px-5 py-4 space-y-3" style={{ background: '#f8fafc' }}>
              <p className="text-xs font-bold" style={{ color: '#64748b' }}>
                CPF · CNPJ · código do cliente · ou nome — detectado automaticamente
              </p>
              <input
                type="text"
                value={clienteNomeBusca}
                autoFocus
                onChange={e => buscarClienteUnificado(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (clienteResultados.length > 0) {
                      selecionarCliente(clienteResultados[nomeResultSel])
                    } else if (clienteNomeBusca.trim()) {
                      buscarClienteUnificado(clienteNomeBusca)
                    }
                  }
                }}
                placeholder="000.000.000-00 / CNPJ / código / nome..."
                className="w-full px-4 py-3.5 rounded-2xl font-bold"
                style={{ background: '#fff', border: '2px solid #f97316', fontSize: 17, outline: 'none', color: '#1e3a5f' }}
              />
              {clienteBuscando && (
                <p className="text-xs text-center font-bold" style={{ color: '#94a3b8' }}>Buscando...</p>
              )}
              {clienteResultados.length > 0 && (
                <div className="rounded-2xl overflow-hidden" style={{ border: '2px solid #e2e8f0' }}>
                  {clienteResultados.map((c: any, idx: number) => (
                    <button key={c.id} onClick={() => selecionarCliente(c)}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left"
                      style={{
                        borderBottom: '1px solid #e2e8f0',
                        background: nomeResultSel === idx ? '#fff7ed' : '#fff',
                        borderLeft: nomeResultSel === idx ? '4px solid #f97316' : '4px solid transparent',
                      }}
                      onMouseEnter={() => setNomeResultSel(idx)}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-black"
                        style={{ background: '#f9731622', color: '#f97316' }}>
                        {(c.nome || c.razao_social || '?')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate" style={{ color: '#1e3a5f' }}>{c.nome || c.razao_social}</p>
                        <p className="text-xs" style={{ color: '#94a3b8' }}>
                          {`#${c.id} · `}{c.cpf || c.cnpj || c.documento || '—'}
                          {c.credito_devolucao > 0 && (
                            <span style={{ color: '#f97316' }}> · crédito R$ {Number(c.credito_devolucao).toFixed(2)}</span>
                          )}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {clienteNomeBusca.length >= 2 && !clienteBuscando && clienteResultados.length === 0 && (
                <p className="text-xs text-center py-2 font-bold" style={{ color: '#94a3b8' }}>Nenhum cliente encontrado</p>
              )}
            </div>
            )}

            {/* ── MODO PRODUTO ── */}
            {consultaMode === 'produto' && (<>
            {/* Campo de busca produto — oculto quando produto consultado está exibido */}
            {!prodConsultado && (
            <div className="px-5 pt-3 flex-shrink-0">
              <input ref={buscaProdRef} type="text" value={buscaProdModal} autoFocus
                onChange={e => {
                  const val = e.target.value
                  setBuscaProdModal(val); setBuscaProdSel(0)
                  // Auto-detecta código de barras exato
                  const q = val.trim()
                  if (q.length >= 6) {
                    const exato = produtos.find(p => p.codigo_barras === q || p.codigo === q)
                    if (exato) { consultarProduto(exato); return }
                  }
                }}
                placeholder="Código, código de barras ou nome..."
                className="w-full px-4 py-3 rounded-2xl font-bold text-base"
                style={{ background: '#fff', border: '2px solid #f97316', outline: 'none', color: '#1e3a5f' }}
                onKeyDown={e => {
                  const q = buscaProdModal.trim().toLowerCase()
                  const res = q.length > 0 ? produtos.filter(p =>
                    p.descricao.toLowerCase().includes(q) ||
                    p.codigo.toLowerCase().includes(q) ||
                    (p.codigo_barras || '').includes(q)
                  ).slice(0, 12) : []
                  if (e.key === 'Escape') { e.preventDefault(); setCpfBusca(false); return }
                  if (e.key === 'ArrowDown') { e.preventDefault(); const next = Math.min(buscaProdSel+1, res.length-1); setBuscaProdSel(next); document.getElementById(`busca-item-${next}`)?.scrollIntoView({block:'nearest'}); return }
                  if (e.key === 'ArrowUp')   { e.preventDefault(); const prev = Math.max(buscaProdSel-1, 0); setBuscaProdSel(prev); document.getElementById(`busca-item-${prev}`)?.scrollIntoView({block:'nearest'}); return }
                  if (e.key === 'Enter' && res.length > 0) { e.preventDefault(); consultarProduto(res[buscaProdSel] ?? res[0]) }
                }}
              />
            </div>
            )}

            {/* ── CARD DE PREÇO — exibido após selecionar produto ── */}
            {prodConsultado ? (
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-4 gap-4"
              style={{ background: '#f8fafc' }}>
              {/* Imagem */}
              {prodConsultado.imagem_url ? (
                <div className="rounded-2xl overflow-hidden flex items-center justify-center"
                  style={{ background: '#fff', width: 130, height: 130, border: '2px solid #e2e8f0' }}>
                  <img src={imgSrc(prodConsultado.imagem_url)} alt={prodConsultado.descricao}
                    className="object-contain" style={{ maxWidth: 120, maxHeight: 120 }} />
                </div>
              ) : (
                <div className="rounded-2xl flex items-center justify-center"
                  style={{ background: '#f1f5f9', width: 80, height: 80, border: '2px solid #e2e8f0' }}>
                  <Package size={36} color="#94a3b8" />
                </div>
              )}
              {/* Descrição */}
              <div className="text-center space-y-1">
                <p className="font-black text-xl leading-tight" style={{ color: '#1e3a5f', textTransform:'uppercase' }}>{prodConsultado.descricao}</p>
                <p className="text-xs font-mono" style={{ color: '#94a3b8' }}>
                  Cód: {prodConsultado.codigo}
                  {prodConsultado.codigo_barras && prodConsultado.codigo_barras !== prodConsultado.codigo
                    ? ` · ${prodConsultado.codigo_barras}` : ''}
                </p>
              </div>
              {/* Preço em destaque */}
              <div className="w-full rounded-3xl py-5 text-center"
                style={{ background: 'linear-gradient(135deg,#ea580c,#f97316,#f59e0b)', border: '2px solid rgba(0,0,0,0.1)' }}>
                <p className="text-xs font-black mb-1" style={{ color: 'rgba(0,0,0,0.6)' }}>PREÇO DE VENDA</p>
                <p className="font-black" style={{ fontSize: 44, lineHeight: 1, color: '#000' }}>
                  R$ {prodConsultado.preco_venda.toFixed(2).replace('.', ',')}
                </p>
                <p className="text-xs mt-2 font-bold" style={{ color: prodConsultado.estoque_atual > 0 ? 'rgba(0,0,0,0.7)' : '#dc2626' }}>
                  {prodConsultado.estoque_atual > 0
                    ? `Estoque: ${prodConsultado.estoque_atual} ${prodConsultado.unidade}`
                    : 'Sem estoque'}
                </p>
              </div>
              {/* Botões de ação */}
              <div className="w-full flex gap-2">
                <button onClick={() => { addItem(prodConsultado); fecharConsultaProd() }}
                  className="flex-1 py-3 rounded-2xl font-black text-sm"
                  style={{ background: '#1e3a5f', color: '#fff' }}>
                  Enter — Registrar no PDV
                </button>
                <button onClick={fecharConsultaProd}
                  className="py-3 px-5 rounded-2xl font-black text-sm"
                  style={{ background: '#e2e8f0', color: '#64748b', border: '1px solid #cbd5e1' }}>
                  Esc
                </button>
              </div>
            </div>
            ) : (
            /* ── LISTA DE RESULTADOS ── */
            <div className="flex-1 overflow-y-auto p-3">
              {(() => {
                const q = buscaProdModal.trim().toLowerCase()
                const filtrados = q.length === 0 ? [] : produtos.filter(p =>
                  p.descricao.toLowerCase().includes(q) ||
                  p.codigo.toLowerCase().includes(q) ||
                  (p.codigo_barras || '').includes(q)
                ).slice(0, 12)
                if (q.length === 0) return (
                  <p className="text-center py-8 text-sm" style={{ color: '#52525B' }}>
                    Digite ou escaneie o código do produto
                  </p>
                )
                if (filtrados.length === 0) return (
                  <p className="text-center py-8 text-sm" style={{ color: '#52525B' }}>
                    Nenhum produto encontrado para "{buscaProdModal}"
                  </p>
                )
                return filtrados.map((p, idx) => {
                  const sel = idx === buscaProdSel
                  return (
                  <button id={`busca-item-${idx}`} key={p.id}
                    onClick={() => consultarProduto(p)}
                    onMouseEnter={() => setBuscaProdSel(idx)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl mb-1.5 text-left"
                    style={{ background: sel ? '#3d3d42' : '#27272A', border: `1px solid ${sel ? '#22c55e' : '#3F3F46'}` }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                      style={{ background: '#1e293b' }}>
                      {p.imagem_url
                        ? <img src={imgSrc(p.imagem_url)} alt={p.descricao} className="w-full h-full object-contain p-0.5"/>
                        : <Package size={18} style={{ color: '#22c55e' }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-white text-sm truncate" style={{ textTransform:'uppercase' }}>{p.descricao}</p>
                      <p className="text-[10px] font-mono" style={{ color: '#71717A' }}>
                        {p.codigo}{p.codigo_barras && p.codigo_barras !== p.codigo ? ` · ${p.codigo_barras}` : ''}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-black text-sm" style={{ color: '#22c55e' }}>
                        R$ {p.preco_venda.toFixed(2).replace('.', ',')}
                      </p>
                      <p className="text-[10px]" style={{ color: p.estoque_atual > 0 ? '#22c55e' : '#ef4444' }}>
                        {p.estoque_atual > 0 ? `${p.estoque_atual} ${p.unidade}` : 'Sem estoque'}
                      </p>
                    </div>
                  </button>
                )})
              })()}
            </div>
            )}
            </>)}

          </div>
        </div>
      )}
    </div>
  )
}
