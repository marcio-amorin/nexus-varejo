'use client'
import { useEffect, useState, useRef } from 'react'
import api, { fmtMoeda } from '@/lib/api'
import { RefreshCw, Search, Check, Package, ChevronRight, X, Scan } from 'lucide-react'

const SEP_COR: Record<string, { bg: string; c: string }> = {
  PENDENTE:     { bg: '#F59E0B22', c: '#F59E0B' },
  EM_SEPARACAO: { bg: '#32ADE622', c: '#32ADE6' },
  PRONTO:       { bg: '#34C75922', c: '#34C759' },
}

type ItemSep = {
  id: number; produto_id: number; descricao: string; codigo: string
  codigo_barras?: string; quantidade: number; unidade: string
}
type Pedido = {
  id: number; numero: string; cliente_nome: string; status: string
  status_separacao: string; total: number; created_at: string
  total_itens: number; itens: ItemSep[]
}

export default function SeparacaoPage() {
  const [pedidos, setPedidos]   = useState<Pedido[]>([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<Pedido | null>(null)
  const [coletados, setColetados] = useState<Record<number, number>>({})
  const [scanInput, setScanInput] = useState('')
  const [scanMsg, setScanMsg]   = useState<{ok: boolean; text: string} | null>(null)
  const [saving, setSaving]     = useState(false)
  const [filtro, setFiltro]     = useState<'todos'|'pendente'|'separacao'>('todos')
  const scanRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    try {
      const r = await api.get('/pedido-venda/separacao')
      setPedidos(r.data)
    } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function abrirPedido(p: Pedido) {
    setSelected(p)
    const init: Record<number, number> = {}
    p.itens.forEach(it => { init[it.id] = 0 })
    setColetados(init)
    setScanInput('')
    setScanMsg(null)
    setTimeout(() => scanRef.current?.focus(), 100)
  }

  function handleScan(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    const cod = scanInput.trim()
    if (!cod || !selected) { setScanInput(''); return }
    const item = selected.itens.find(it =>
      it.codigo === cod || it.codigo_barras === cod ||
      it.descricao.toLowerCase().includes(cod.toLowerCase())
    )
    if (!item) {
      setScanMsg({ ok: false, text: `Produto "${cod}" não encontrado no pedido` })
      setTimeout(() => setScanMsg(null), 3000)
    } else {
      setColetados(c => {
        const atual = c[item.id] || 0
        const novo  = Math.min(atual + 1, item.quantidade)
        return { ...c, [item.id]: novo }
      })
      setScanMsg({ ok: true, text: `✓ ${item.descricao}` })
      setTimeout(() => setScanMsg(null), 1500)
    }
    setScanInput('')
  }

  function setQtyColetado(itemId: number, qty: number) {
    setColetados(c => ({ ...c, [itemId]: Math.max(0, qty) }))
  }

  const totalColetado = selected ? selected.itens.reduce((s, it) => s + (coletados[it.id] || 0), 0) : 0
  const totalPedido   = selected ? selected.itens.reduce((s, it) => s + it.quantidade, 0) : 0
  const isCompleto    = totalColetado >= totalPedido && totalPedido > 0

  async function concluirSeparacao() {
    if (!selected) return
    setSaving(true)
    try {
      await api.put(`/pedido-venda/pedidos/${selected.id}/separacao`, { status_separacao: 'PRONTO' })
      setScanMsg({ ok: true, text: 'Separação concluída! Pedido marcado como PRONTO PARA NF.' })
      setTimeout(() => { setSelected(null); load() }, 2000)
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro') }
    setSaving(false)
  }

  async function iniciarSeparacao(pedidoId: number) {
    try {
      await api.put(`/pedido-venda/pedidos/${pedidoId}/separacao`, { status_separacao: 'EM_SEPARACAO' })
      load()
    } catch {}
  }

  const pedidosFiltrados = pedidos.filter(p => {
    if (filtro === 'pendente')   return p.status_separacao === 'PENDENTE'
    if (filtro === 'separacao')  return p.status_separacao === 'EM_SEPARACAO'
    return true
  })

  if (selected) return (
    <div className="pg" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="pg-header flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelected(null)} style={{ color: 'var(--muted)' }}>
            <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <div>
            <h1 className="text-base font-black text-white flex items-center gap-2">
              <Package size={16} color="#8B5CF6" /> {selected.numero}
            </h1>
            <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
              {selected.cliente_nome} · {totalColetado}/{totalPedido} itens coletados
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 flex-1 min-w-[100px] rounded-full overflow-hidden" style={{ background: 'var(--card2)', width: 120 }}>
            <div className="h-full rounded-full transition-all" style={{
              width: `${totalPedido > 0 ? (totalColetado / totalPedido * 100) : 0}%`,
              background: isCompleto ? '#34C759' : '#8B5CF6'
            }} />
          </div>
          <span className="text-xs font-black" style={{ color: isCompleto ? '#34C759' : '#8B5CF6' }}>
            {totalPedido > 0 ? Math.round(totalColetado / totalPedido * 100) : 0}%
          </span>
        </div>
      </div>

      {/* Scan input */}
      <div className="px-4 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'var(--card)', border: '1px solid #8B5CF644' }}>
          <Scan size={14} color="#8B5CF6" />
          <input ref={scanRef} value={scanInput}
            onChange={e => setScanInput(e.target.value)}
            onKeyDown={handleScan}
            placeholder="Escanear código de barras ou digitar código..."
            className="flex-1 text-sm bg-transparent text-white outline-none" />
        </div>
        {scanMsg && (
          <div className="mt-1 px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: scanMsg.ok ? '#34C75922' : '#EF444422', color: scanMsg.ok ? '#34C759' : '#EF4444' }}>
            {scanMsg.text}
          </div>
        )}
      </div>

      {/* Itens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {selected.itens.map(it => {
          const col  = coletados[it.id] || 0
          const ok   = col >= it.quantidade
          const pct  = it.quantidade > 0 ? Math.min(col / it.quantidade, 1) : 0
          return (
            <div key={it.id} className="rounded-2xl p-3"
              style={{ background: 'var(--card)', border: `1px solid ${ok ? '#34C75944' : 'var(--border)'}` }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: ok ? '#34C75922' : 'var(--card2)' }}>
                  {ok ? <Check size={14} color="#34C759" /> : <Package size={14} color="var(--muted)" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{it.descricao}</p>
                  <p className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>{it.codigo}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>
                    <span className="font-black text-white">{col}</span>/{it.quantidade} {it.unidade}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => setQtyColetado(it.id, col + 1)}
                      className="w-6 h-5 rounded flex items-center justify-center text-xs font-black"
                      style={{ background: '#8B5CF622', color: '#8B5CF6' }}>+</button>
                    <button onClick={() => setQtyColetado(it.id, col - 1)} disabled={col === 0}
                      className="w-6 h-5 rounded flex items-center justify-center text-xs font-black"
                      style={{ background: col > 0 ? '#EF444422' : 'var(--card2)', color: col > 0 ? '#EF4444' : 'var(--muted)' }}>−</button>
                  </div>
                </div>
              </div>
              {/* Barra de progresso */}
              <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: 'var(--card2)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${pct * 100}%`, background: ok ? '#34C759' : '#8B5CF6' }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
        <button onClick={concluirSeparacao} disabled={saving || !isCompleto}
          className="w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2"
          style={{
            background: isCompleto ? 'linear-gradient(135deg,#34C759,#16A34A)' : 'var(--card2)',
            color: isCompleto ? 'white' : 'var(--muted)',
          }}>
          {saving ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
          {isCompleto ? 'CONCLUIR SEPARAÇÃO — PRONTO PARA NF' : `Faltam ${totalPedido - totalColetado} item(s)`}
        </button>
      </div>
    </div>
  )

  return (
    <div className="pg">
      <div className="pg-header flex items-center justify-between">
        <div>
          <h1 className="text-base font-black text-white">Separação de Pedidos</h1>
          <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
            Colete os itens com scanner ou manualmente
          </p>
        </div>
        <button onClick={load} style={{ color: 'var(--muted)' }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Filtro */}
      <div className="flex gap-1 px-1">
        {[
          { k: 'todos',     l: 'Todos',        count: pedidos.length },
          { k: 'pendente',  l: 'Pendentes',    count: pedidos.filter(p => p.status_separacao === 'PENDENTE').length },
          { k: 'separacao', l: 'Em Separação', count: pedidos.filter(p => p.status_separacao === 'EM_SEPARACAO').length },
        ].map(t => (
          <button key={t.k} onClick={() => setFiltro(t.k as any)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
            style={{ background: filtro === t.k ? '#8B5CF6' : 'var(--card2)', color: filtro === t.k ? 'white' : 'var(--muted)' }}>
            {t.l}
            {t.count > 0 && <span className="w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-black"
              style={{ background: filtro === t.k ? 'rgba(255,255,255,0.3)' : '#8B5CF622', color: filtro === t.k ? 'white' : '#8B5CF6' }}>
              {t.count}
            </span>}
          </button>
        ))}
      </div>

      <div className="pg-body space-y-2">
        {loading ? (
          <div className="text-center py-12" style={{ color: 'var(--muted)' }}>Carregando...</div>
        ) : pedidosFiltrados.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--muted)' }}>
            <Package size={40} className="mx-auto mb-3 opacity-30" />
            <p>Nenhum pedido para separar</p>
          </div>
        ) : pedidosFiltrados.map(p => {
          const sc = SEP_COR[p.status_separacao] || SEP_COR.PENDENTE
          return (
            <div key={p.id} className="rounded-2xl p-4 flex items-center gap-4"
              style={{ background: 'var(--card)', border: `1px solid var(--border)` }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-black text-white">{p.numero}</p>
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded"
                    style={{ background: sc.bg, color: sc.c }}>
                    {p.status_separacao}
                  </span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  {p.cliente_nome} · {p.total_itens} item(s) · {fmtMoeda(p.total)}
                </p>
              </div>
              <div className="flex gap-2">
                {p.status_separacao === 'PENDENTE' && (
                  <button onClick={() => iniciarSeparacao(p.id)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold"
                    style={{ background: '#8B5CF622', color: '#8B5CF6' }}>
                    Iniciar
                  </button>
                )}
                <button onClick={() => abrirPedido(p)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1"
                  style={{ background: p.status_separacao === 'EM_SEPARACAO' ? '#8B5CF6' : 'var(--card2)',
                           color: p.status_separacao === 'EM_SEPARACAO' ? 'white' : 'var(--muted)' }}>
                  {p.status_separacao === 'EM_SEPARACAO' ? 'Continuar' : 'Coletar'} <ChevronRight size={12} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
