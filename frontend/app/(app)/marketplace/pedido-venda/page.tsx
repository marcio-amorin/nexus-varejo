'use client'
import { useEffect, useState, useRef } from 'react'
import api, { fmtMoeda } from '@/lib/api'
import {
  Search, Plus, Minus, Trash2, X, Check, Users,
  Truck, Home, ChevronRight, RefreshCw, Printer,
  ShoppingBag, Package,
} from 'lucide-react'

type Vendedor = { id: number; nome: string; codigo: string; comissao_pct: number; pode_desconto: boolean; desconto_max_pct: number }
type Produto  = { id: number; codigo: string; codigo_barras?: string; descricao: string; preco_venda: number; unidade: string; estoque_atual: number }
type CartItem = { uid: string; produto: Produto; quantidade: number; preco: number; desconto_pct: number }
type Cliente  = { id: number; nome: string; documento?: string; telefone?: string; celular?: string }

const TIPO_FISCAL = [
  { k: 'ORCAMENTO', l: 'Orçamento',           emoji: '📋', desc: 'Não envia ao SEFAZ. Baixa o estoque normalmente.', cor: '#6B7280' },
  { k: 'NFCE',      l: 'NFC-e (Cupom Fiscal)', emoji: '🧾', desc: 'Emite cupom fiscal eletrônico. Requer autorização SEFAZ.', cor: '#3B82F6' },
  { k: 'NFE',       l: 'NF-e (Nota Fiscal)',   emoji: '📄', desc: 'Emite Nota Fiscal Eletrônica completa. Requer autorização SEFAZ.', cor: '#8B5CF6' },
]

export default function PedidoVendaPage() {
  const [etapa,      setEtapa]    = useState<'vendedor'|'pedido'|'fiscal'|'sucesso'>('vendedor')
  const [vendedores, setVends]    = useState<Vendedor[]>([])
  const [vendedor,   setVendedor] = useState<Vendedor | null>(null)
  const [produtos,   setProdutos] = useState<Produto[]>([])
  const [clientes,   setClientes] = useState<Cliente[]>([])
  const [formas,     setFormas]   = useState<any[]>([])

  const [tipoCliente,  setTipoCliente]  = useState<'CONSUMIDOR_FINAL'|'CADASTRADO'>('CONSUMIDOR_FINAL')
  const [clienteSel,   setClienteSel]   = useState<Cliente | null>(null)
  const [clienteNome,  setClienteNome]  = useState('')
  const [clienteDoc,   setClienteDoc]   = useState('')
  const [clienteTel,   setClienteTel]   = useState('')
  const [buscaCliente, setBuscaCliente] = useState('')
  const [dataEntrega,  setDataEntrega]  = useState('')
  const [tipoEntrega,  setTipoEntrega]  = useState<'RETIRADA'|'ENTREGA'>('RETIRADA')
  const [formaRec,     setFormaRec]     = useState('')
  const [obs,          setObs]          = useState('')
  const [cart,         setCart]         = useState<CartItem[]>([])
  const [busca,        setBusca]        = useState('')
  const [tipoFiscal,   setTipoFiscal]   = useState('ORCAMENTO')
  const [saving,       setSaving]       = useState(false)
  const [numeroPedido, setNumero]       = useState('')
  const [totalFinal,   setTotalFinal]   = useState(0)

  const buscaRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([
      api.get('/pedido-venda/vendedores'),
      api.get('/pdv/carga'),
      api.get('/clientes/?limit=500'),
    ]).then(([rv, rc, rcl]) => {
      setVends(rv.data.filter((v: any) => v.ativo))
      setProdutos(rc.data.produtos || [])
      setFormas(rc.data.formas_recebimento || [])
      setClientes(rcl.data || [])
    }).catch(() => {})
  }, [])

  const prodFiltrados = busca.length >= 2
    ? produtos.filter(p =>
        p.descricao.toLowerCase().includes(busca.toLowerCase()) ||
        p.codigo.toLowerCase().includes(busca.toLowerCase()) ||
        (p.codigo_barras || '').includes(busca)
      ).slice(0, 20)
    : []

  const clientesFiltrados = buscaCliente.length >= 2
    ? clientes.filter(c =>
        c.nome.toLowerCase().includes(buscaCliente.toLowerCase()) ||
        (c.documento || '').includes(buscaCliente)
      ).slice(0, 8)
    : []

  function addItem(prod: Produto) {
    setBusca('')
    setCart(c => {
      const idx = c.findIndex(i => i.produto.id === prod.id)
      if (idx >= 0) {
        const u = [...c]; u[idx] = { ...u[idx], quantidade: u[idx].quantidade + 1 }; return u
      }
      return [...c, { uid: `${prod.id}_${Date.now()}`, produto: prod, quantidade: 1, preco: prod.preco_venda, desconto_pct: 0 }]
    })
    setTimeout(() => buscaRef.current?.focus(), 50)
  }

  function setQty(uid: string, q: number) {
    if (q <= 0) return setCart(c => c.filter(i => i.uid !== uid))
    setCart(c => c.map(i => i.uid === uid ? { ...i, quantidade: q } : i))
  }
  function setDesc(uid: string, d: number) {
    const max = vendedor?.pode_desconto ? vendedor.desconto_max_pct : 0
    setCart(c => c.map(i => i.uid === uid ? { ...i, desconto_pct: Math.min(d, max) } : i))
  }
  function setPreco(uid: string, p: number) {
    setCart(c => c.map(i => i.uid === uid ? { ...i, preco: p } : i))
  }

  const subtotal  = cart.reduce((s, i) => s + i.preco * i.quantidade, 0)
  const descTotal = cart.reduce((s, i) => s + i.preco * i.quantidade * i.desconto_pct / 100, 0)
  const total     = subtotal - descTotal

  async function finalizar() {
    if (!cart.length) return alert('Adicione produtos ao pedido')
    setSaving(true)
    try {
      const r = await api.post('/pedido-venda/pedidos', {
        vendedor_id:      vendedor?.id || null,
        tipo_cliente:     tipoCliente,
        cliente_id:       clienteSel?.id || null,
        cliente_nome:     tipoCliente === 'CONSUMIDOR_FINAL' ? (clienteNome || 'Consumidor Final') : clienteSel?.nome,
        cliente_doc:      tipoCliente === 'CONSUMIDOR_FINAL' ? clienteDoc : clienteSel?.documento,
        cliente_telefone: tipoCliente === 'CONSUMIDOR_FINAL' ? clienteTel : (clienteSel?.celular || clienteSel?.telefone),
        data_entrega:     dataEntrega || null,
        tipo_entrega:     tipoEntrega,
        forma_recebimento: formaRec || null,
        tipo_fiscal:      tipoFiscal,
        observacoes:      obs || null,
        itens: cart.map(i => ({
          produto_id:     i.produto.id,
          quantidade:     i.quantidade,
          preco_unitario: i.preco,
          desconto_pct:   i.desconto_pct,
        })),
      })
      setNumero(r.data.numero)
      setTotalFinal(r.data.total)
      setEtapa('sucesso')
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro ao criar pedido') }
    setSaving(false)
  }

  function novoPedido() {
    setEtapa('vendedor'); setVendedor(null); setCart([]); setClienteSel(null)
    setClienteNome(''); setClienteDoc(''); setClienteTel(''); setDataEntrega('')
    setObs(''); setFormaRec(''); setTipoCliente('CONSUMIDOR_FINAL')
    setTipoFiscal('ORCAMENTO'); setBusca(''); setNumero('')
  }

  function imprimirPedido() {
    const clienteDisplay = tipoCliente === 'CONSUMIDOR_FINAL'
      ? (clienteNome || 'Consumidor Final') : (clienteSel?.nome || 'Não informado')
    const w = window.open('', '_blank', 'width=700,height=600')
    if (!w) return
    const linhas = cart.map(i => {
      const tot = i.preco * i.quantidade * (1 - i.desconto_pct / 100)
      return `<tr><td>${i.produto.descricao}</td><td style="text-align:center">${i.quantidade} ${i.produto.unidade}</td>
        <td style="text-align:right">${fmtMoeda(i.preco)}</td>
        <td style="text-align:center">${i.desconto_pct || 0}%</td>
        <td style="text-align:right;font-weight:700">${fmtMoeda(tot)}</td></tr>`
    }).join('')
    w.document.write(`<html><head><title>Pedido ${numeroPedido}</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;color:#111;max-width:700px;margin:auto}
    h2{color:#F97316}table{width:100%;border-collapse:collapse;margin:16px 0}
    th,td{padding:8px;border:1px solid #ddd;font-size:12px}th{background:#f3f4f6}
    .tot{font-weight:900;font-size:15px}@media print{button{display:none}}</style></head><body>
    <h2>📦 Pedido de Venda — ${numeroPedido}</h2>
    <p>Data: <strong>${new Date().toLocaleString('pt-BR')}</strong></p>
    <p>Vendedor: <strong>${vendedor?.nome || '—'}</strong> · Fiscal: <strong>${TIPO_FISCAL.find(t=>t.k===tipoFiscal)?.l}</strong></p>
    <p>Cliente: <strong>${clienteDisplay}</strong></p>
    <p>Entrega: <strong>${tipoEntrega}</strong>${dataEntrega ? ' · ' + new Date(dataEntrega+'T12:00').toLocaleDateString('pt-BR') : ''}</p>
    ${formaRec ? `<p>Recebimento: <strong>${formaRec}</strong></p>` : ''}
    <table><thead><tr><th>Produto</th><th>Qtd</th><th>Preço Unit.</th><th>Desc.</th><th>Total</th></tr></thead>
    <tbody>${linhas}</tbody></table>
    <p class="tot">TOTAL: ${fmtMoeda(totalFinal || total)}</p>
    ${obs ? `<p>Obs: ${obs}</p>` : ''}
    <br><button onclick="window.print()">🖨️ Imprimir</button></body></html>`)
    w.document.close(); w.focus(); setTimeout(() => w.print(), 400)
  }

  // ── ETAPA 1: Seleção de Vendedor ───────────────────────────────────────────
  if (etapa === 'vendedor') return (
    <div className="pg">
      <div className="pg-header">
        <h1 className="text-base font-black text-white flex items-center gap-2">
          <ShoppingBag size={18} color="#F97316" /> Pedido de Venda
        </h1>
        <p className="text-[10px]" style={{ color: 'var(--muted)' }}>Selecione o vendedor para iniciar o pedido</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(249,115,22,0.12)', border: '2px solid rgba(249,115,22,0.3)' }}>
            <Users size={40} color="#F97316" />
          </div>
          <h2 className="text-2xl font-black text-white">Quem está vendendo?</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Selecione o vendedor para carregar seus parâmetros de comissão e desconto
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
          {vendedores.map(v => (
            <button key={v.id} onClick={() => { setVendedor(v); setEtapa('pedido') }}
              className="rounded-2xl p-5 text-left transition-all"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl mb-3"
                style={{ background: 'rgba(249,115,22,0.15)', color: '#F97316' }}>
                {v.nome.charAt(0).toUpperCase()}
              </div>
              <p className="font-black text-white">{v.nome}</p>
              <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--muted)' }}>{v.codigo}</p>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: '#22C55E22', color: '#22C55E' }}>
                  Comissão: {v.comissao_pct}%
                </span>
                {v.pode_desconto && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: '#F59E0B22', color: '#F59E0B' }}>
                    Desc máx: {v.desconto_max_pct}%
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        {vendedores.length === 0 && (
          <p className="text-sm text-center" style={{ color: 'var(--muted)' }}>
            Nenhum vendedor ativo. Vá em Configurações → Vendedores.
          </p>
        )}

        <div className="w-full max-w-lg pt-4" style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={() => { setVendedor(null); setEtapa('pedido') }}
            className="w-full py-2.5 rounded-xl text-sm font-bold"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
            Continuar sem vendedor
          </button>
        </div>
      </div>
    </div>
  )

  // ── ETAPA 2: Criação do Pedido ─────────────────────────────────────────────
  if (etapa === 'pedido') return (
    <div className="pg">
      <div className="pg-header flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button onClick={() => setEtapa('vendedor')}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
            style={{ background: 'var(--card2)', color: 'var(--muted)' }}>←</button>
          <div>
            <h1 className="text-sm font-black text-white">Novo Pedido de Venda</h1>
            {vendedor && (
              <p className="text-[10px]" style={{ color: '#F97316' }}>
                {vendedor.nome} · {vendedor.comissao_pct}% comissão
                {vendedor.pode_desconto ? ` · Desc. máx: ${vendedor.desconto_max_pct}%` : ''}
              </p>
            )}
          </div>
        </div>
        <button onClick={() => setEtapa('fiscal')} disabled={!cart.length}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl font-black text-xs"
          style={{ background: cart.length ? '#F97316' : 'var(--card2)', color: cart.length ? 'white' : 'var(--muted)' }}>
          {fmtMoeda(total)} · Finalizar <ChevronRight size={12} />
        </button>
      </div>

      <div className="flex gap-2 flex-1 overflow-hidden min-h-0">
        {/* ── Coluna esquerda ──────────────────────────────────────── */}
        <div className="w-60 flex-shrink-0 flex flex-col gap-1.5 overflow-y-auto pr-1">
          {/* Tipo cliente */}
          <div className="rounded-xl p-2" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <p className="text-[9px] font-bold mb-1" style={{ color: 'var(--muted)' }}>TIPO DE CLIENTE</p>
            <div className="flex rounded-lg overflow-hidden mb-1.5" style={{ border: '1px solid var(--border)' }}>
              <button onClick={() => { setTipoCliente('CONSUMIDOR_FINAL'); setClienteSel(null) }}
                className="flex-1 py-1.5 text-[10px] font-bold"
                style={{ background: tipoCliente==='CONSUMIDOR_FINAL'?'#F97316':'transparent', color: tipoCliente==='CONSUMIDOR_FINAL'?'white':'var(--muted)' }}>
                Consumidor
              </button>
              <button onClick={() => setTipoCliente('CADASTRADO')}
                className="flex-1 py-1.5 text-[10px] font-bold"
                style={{ background: tipoCliente==='CADASTRADO'?'#F97316':'transparent', color: tipoCliente==='CADASTRADO'?'white':'var(--muted)' }}>
                Cadastrado
              </button>
            </div>
            {tipoCliente === 'CONSUMIDOR_FINAL' && (
              <div className="space-y-1">
                <input value={clienteNome} onChange={e => setClienteNome(e.target.value)}
                  className="w-full px-2 py-1 text-[10px] rounded-lg" placeholder="Nome (opcional)" />
                <input value={clienteDoc} onChange={e => setClienteDoc(e.target.value)}
                  className="w-full px-2 py-1 text-[10px] rounded-lg" placeholder="CPF (opcional)" />
                <input value={clienteTel} onChange={e => setClienteTel(e.target.value)}
                  className="w-full px-2 py-1 text-[10px] rounded-lg" placeholder="Telefone (opcional)" />
              </div>
            )}
            {tipoCliente === 'CADASTRADO' && (
              <>
                {clienteSel ? (
                  <div className="flex items-center justify-between p-1.5 rounded-lg" style={{ background: 'var(--card2)' }}>
                    <div>
                      <p className="text-[10px] font-bold text-white">{clienteSel.nome}</p>
                      <p className="text-[9px]" style={{ color: 'var(--muted)' }}>{clienteSel.documento}</p>
                    </div>
                    <button onClick={() => setClienteSel(null)} style={{ color: 'var(--muted)' }}><X size={11} /></button>
                  </div>
                ) : (
                  <>
                    <input value={buscaCliente} onChange={e => setBuscaCliente(e.target.value)}
                      className="w-full px-2 py-1 text-[10px] rounded-lg" placeholder="Buscar por nome ou CPF..." />
                    {clientesFiltrados.length > 0 && (
                      <div className="mt-1 rounded-lg overflow-hidden max-h-28 overflow-y-auto"
                        style={{ border: '1px solid var(--border)' }}>
                        {clientesFiltrados.map(c => (
                          <button key={c.id} onClick={() => { setClienteSel(c); setBuscaCliente('') }}
                            className="w-full text-left px-2 py-1 text-[10px]"
                            style={{ background: 'var(--card2)', borderTop: '1px solid var(--border)', display: 'block' }}>
                            <span className="font-bold text-white">{c.nome}</span>
                            <span className="ml-1" style={{ color: 'var(--muted)' }}>{c.documento}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>

          {/* Entrega */}
          <div className="rounded-xl p-2" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <p className="text-[9px] font-bold mb-1" style={{ color: 'var(--muted)' }}>ENTREGA</p>
            <div className="flex rounded-lg overflow-hidden mb-1.5" style={{ border: '1px solid var(--border)' }}>
              {[{k:'RETIRADA',l:'Retirada',ic:Home},{k:'ENTREGA',l:'Entrega',ic:Truck}].map(t=>(
                <button key={t.k} onClick={() => setTipoEntrega(t.k as any)}
                  className="flex-1 py-1.5 text-[10px] font-bold flex items-center justify-center gap-1"
                  style={{ background: tipoEntrega===t.k?'#3B82F6':'transparent', color: tipoEntrega===t.k?'white':'var(--muted)' }}>
                  <t.ic size={9}/> {t.l}
                </button>
              ))}
            </div>
            <input type="date" value={dataEntrega} onChange={e => setDataEntrega(e.target.value)}
              className="w-full px-2 py-1 text-[10px] rounded-lg"
              style={{ background: 'var(--card2)', border: '1px solid var(--border)', color: 'white' }} />
          </div>

          {/* Forma recebimento */}
          <div className="rounded-xl p-2" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <p className="text-[9px] font-bold mb-1" style={{ color: 'var(--muted)' }}>FORMA DE RECEBIMENTO</p>
            <div className="grid grid-cols-2 gap-1">
              {formas.map((f: any) => (
                <button key={f.chave} onClick={() => setFormaRec(f.chave === formaRec ? '' : f.chave)}
                  className="flex items-center gap-1 px-1.5 py-1 rounded-lg text-[9px] font-bold"
                  style={{
                    background: formaRec===f.chave ? f.cor+'22' : 'var(--card2)',
                    border: `1px solid ${formaRec===f.chave ? f.cor : 'var(--border)'}`,
                    color: formaRec===f.chave ? f.cor : 'var(--muted)',
                  }}>
                  <span>{f.icone}</span> {f.nome.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Obs */}
          <div className="rounded-xl p-2" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <p className="text-[9px] font-bold mb-1" style={{ color: 'var(--muted)' }}>OBSERVAÇÕES</p>
            <textarea value={obs} onChange={e => setObs(e.target.value)}
              className="w-full px-2 py-1 text-[10px] rounded-lg resize-none"
              rows={2} placeholder="Instruções, prazo, etc..." />
          </div>
        </div>

        {/* ── Coluna direita: produtos ──────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          {/* Busca produto */}
          <div className="rounded-xl p-2" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl"
              style={{ background: 'var(--card2)', border: '1px solid var(--border)' }}>
              <Search size={12} style={{ color: 'var(--muted)', flexShrink: 0 }} />
              <input ref={buscaRef} value={busca} onChange={e => setBusca(e.target.value)}
                autoFocus className="flex-1 text-xs bg-transparent outline-none text-white"
                placeholder="Buscar produto por nome, código ou código de barras..." />
              {busca && <button onClick={() => setBusca('')} style={{ color: 'var(--muted)' }}><X size={11} /></button>}
            </div>
            {prodFiltrados.length > 0 && (
              <div className="mt-1.5 space-y-0.5 max-h-40 overflow-y-auto">
                {prodFiltrados.map(p => (
                  <button key={p.id} onClick={() => addItem(p)}
                    className="w-full text-left flex items-center justify-between px-3 py-1.5 rounded-lg text-[10px]"
                    style={{ background: 'var(--card2)' }}>
                    <div>
                      <span className="font-bold text-white">{p.descricao}</span>
                      <span className="ml-2 font-mono text-[9px]" style={{ color: 'var(--muted)' }}>{p.codigo}</span>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className="font-black text-xs" style={{ color: '#22C55E' }}>{fmtMoeda(p.preco_venda)}</span>
                      <span className="ml-1.5 text-[9px]" style={{ color: 'var(--muted)' }}>est:{p.estoque_atual}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {busca.length >= 2 && prodFiltrados.length === 0 && (
              <p className="text-[10px] text-center py-2" style={{ color: 'var(--muted)' }}>Nenhum produto encontrado</p>
            )}
          </div>

          {/* Cart */}
          <div className="rounded-xl flex-1 overflow-hidden flex flex-col"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
              <p className="font-black text-xs text-white flex items-center gap-1.5">
                <ShoppingBag size={12} color="#F97316" /> Itens do Pedido
                <span className="font-normal" style={{ color: 'var(--muted)' }}>({cart.length})</span>
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--muted)' }}>
                  <Package size={28} className="mb-1.5 opacity-30" />
                  <p className="text-xs">Nenhum produto adicionado</p>
                  <p className="text-[10px] mt-0.5">Use a busca acima ou leia o código de barras</p>
                </div>
              ) : (
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Produto</th><th>Qtd</th><th>Preço</th>
                      {vendedor?.pode_desconto && <th>Desc.%</th>}
                      <th>Total</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map(item => {
                      const tot = item.preco * item.quantidade * (1 - item.desconto_pct / 100)
                      return (
                        <tr key={item.uid}>
                          <td>
                            <p className="font-semibold text-white text-[10px] leading-tight">{item.produto.descricao}</p>
                            <p className="text-[9px] font-mono" style={{ color: 'var(--muted)' }}>{item.produto.codigo}</p>
                          </td>
                          <td>
                            <div className="flex items-center gap-0.5">
                              <button onClick={() => setQty(item.uid, item.quantidade - 1)}
                                className="w-4 h-4 rounded flex items-center justify-center"
                                style={{ background: 'var(--card2)', color: 'var(--muted)' }}><Minus size={8}/></button>
                              <input type="number" value={item.quantidade} min="0.001" step="1"
                                onChange={e => setQty(item.uid, parseFloat(e.target.value)||0)}
                                className="w-10 text-center text-[10px] font-bold text-white bg-transparent outline-none" />
                              <button onClick={() => setQty(item.uid, item.quantidade + 1)}
                                className="w-4 h-4 rounded flex items-center justify-center"
                                style={{ background: 'var(--card2)', color: 'var(--muted)' }}><Plus size={8}/></button>
                            </div>
                          </td>
                          <td>
                            <input type="number" value={item.preco} min="0" step="0.01"
                              onChange={e => setPreco(item.uid, parseFloat(e.target.value)||0)}
                              className="w-[72px] text-[10px] font-bold px-1 py-0.5 rounded text-center outline-none"
                              style={{ background: 'var(--card2)', color: '#22C55E', border: '1px solid var(--border)' }} />
                          </td>
                          {vendedor?.pode_desconto && (
                            <td>
                              <input type="number" value={item.desconto_pct} min="0" max={vendedor.desconto_max_pct} step="0.5"
                                onChange={e => setDesc(item.uid, parseFloat(e.target.value)||0)}
                                className="w-12 text-[10px] font-bold px-1 py-0.5 rounded text-center outline-none"
                                style={{ background: 'var(--card2)', color: '#F59E0B', border: '1px solid var(--border)' }} />
                            </td>
                          )}
                          <td className="font-black text-xs" style={{ color: '#22C55E' }}>{fmtMoeda(tot)}</td>
                          <td>
                            <button onClick={() => setCart(c => c.filter(i => i.uid !== item.uid))}
                              style={{ color: '#EF4444' }}><Trash2 size={10}/></button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
            {cart.length > 0 && (
              <div className="px-3 py-2 flex-shrink-0 space-y-0.5"
                style={{ borderTop: '1px solid var(--border)', background: 'var(--card2)' }}>
                <div className="flex justify-between text-[10px]" style={{ color: 'var(--muted)' }}>
                  <span>Subtotal</span><span>{fmtMoeda(subtotal)}</span>
                </div>
                {descTotal > 0 && (
                  <div className="flex justify-between text-[10px]" style={{ color: '#F59E0B' }}>
                    <span>Desconto</span><span>- {fmtMoeda(descTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-base">
                  <span className="text-white">TOTAL</span>
                  <span style={{ color: '#22C55E' }}>{fmtMoeda(total)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  // ── ETAPA 3: Tipo Fiscal ───────────────────────────────────────────────────
  if (etapa === 'fiscal') return (
    <div className="pg">
      <div className="pg-header flex items-center gap-3">
        <button onClick={() => setEtapa('pedido')}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold"
          style={{ background: 'var(--card2)', color: 'var(--muted)' }}>←</button>
        <div>
          <h1 className="text-base font-black text-white">Como finalizar o pedido?</h1>
          <p className="text-[10px]" style={{ color: 'var(--muted)' }}>Escolha o tipo fiscal — pode ser alterado no PDV</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-5 py-6">
        <div className="w-full max-w-md rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-bold mb-2" style={{ color: 'var(--muted)' }}>RESUMO DO PEDIDO</p>
          <div className="flex justify-between items-center">
            <span className="text-sm text-white">{cart.length} produto(s)</span>
            <span className="text-2xl font-black" style={{ color: '#22C55E' }}>{fmtMoeda(total)}</span>
          </div>
          {formaRec && <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Recebimento: {formaRec}</p>}
        </div>

        <div className="w-full max-w-md space-y-3">
          {TIPO_FISCAL.map(tf => (
            <button key={tf.k} onClick={() => setTipoFiscal(tf.k)}
              className="w-full rounded-2xl p-4 text-left transition-all"
              style={{
                background: tipoFiscal===tf.k ? tf.cor+'18' : 'var(--card)',
                border: `2px solid ${tipoFiscal===tf.k ? tf.cor : 'var(--border)'}`,
              }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{tf.emoji}</span>
                  <div>
                    <p className="font-black text-white">{tf.l}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>{tf.desc}</p>
                  </div>
                </div>
                <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                  style={{ borderColor: tipoFiscal===tf.k ? tf.cor : 'var(--border)', background: tipoFiscal===tf.k ? tf.cor : 'transparent' }}>
                  {tipoFiscal===tf.k && <Check size={11} color="white" />}
                </div>
              </div>
            </button>
          ))}
        </div>

        <button onClick={finalizar} disabled={saving}
          className="w-full max-w-md py-4 rounded-2xl font-black text-lg text-white flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)' }}>
          {saving ? <RefreshCw size={18} className="animate-spin" /> : <Check size={18} />}
          {saving ? 'Gerando pedido...' : 'Confirmar e Gerar Pedido'}
        </button>
      </div>
    </div>
  )

  // ── ETAPA 4: Sucesso ───────────────────────────────────────────────────────
  return (
    <div className="pg">
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8">
        <div className="w-24 h-24 rounded-full flex items-center justify-center"
          style={{ background: '#22C55E22', border: '3px solid #22C55E' }}>
          <Check size={48} color="#22C55E" />
        </div>

        <div className="text-center">
          <h2 className="text-3xl font-black text-white">Pedido Criado!</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Informe esse número no PDV para carregar os produtos</p>
          <div className="mt-4 px-10 py-5 rounded-2xl"
            style={{ background: 'rgba(249,115,22,0.1)', border: '2px solid rgba(249,115,22,0.4)' }}>
            <p className="text-5xl font-black tracking-widest" style={{ color: '#F97316' }}>{numeroPedido}</p>
          </div>
        </div>

        <div className="w-full max-w-md rounded-2xl p-4 space-y-2" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex justify-between text-sm">
            <span style={{ color: 'var(--muted)' }}>Total</span>
            <span className="font-black" style={{ color: '#22C55E' }}>{fmtMoeda(totalFinal)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span style={{ color: 'var(--muted)' }}>Tipo Fiscal</span>
            <span className="font-bold text-white">{TIPO_FISCAL.find(t=>t.k===tipoFiscal)?.emoji} {TIPO_FISCAL.find(t=>t.k===tipoFiscal)?.l}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span style={{ color: 'var(--muted)' }}>Entrega</span>
            <span className="font-bold text-white">{tipoEntrega}</span>
          </div>
          {dataEntrega && (
            <div className="flex justify-between text-xs">
              <span style={{ color: 'var(--muted)' }}>Data entrega</span>
              <span className="font-bold text-white">{new Date(dataEntrega+'T12:00').toLocaleDateString('pt-BR')}</span>
            </div>
          )}
        </div>

        <div className="w-full max-w-md p-4 rounded-2xl"
          style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <p className="text-sm font-bold text-white mb-1">📌 Como lançar no PDV</p>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
            No PDV, pressione o botão <strong className="text-white">PEDIDO</strong> (ou tecla <kbd className="px-1 py-0.5 rounded text-[10px]" style={{ background: 'var(--card)' }}>P</kbd>),
            informe o número <strong style={{ color: '#F97316' }}>{numeroPedido}</strong> e os produtos serão
            carregados automaticamente com os preços e descontos já aplicados.
          </p>
        </div>

        <div className="flex gap-3 w-full max-w-md">
          <button onClick={imprimirPedido}
            className="flex-1 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'white' }}>
            <Printer size={14} /> Imprimir Pedido
          </button>
          <button onClick={novoPedido}
            className="flex-1 py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)', color: 'white' }}>
            <Plus size={14} /> Novo Pedido
          </button>
        </div>
      </div>
    </div>
  )
}
