'use client'
import { useEffect, useState, useRef } from 'react'
import api, { fmtMoeda } from '@/lib/api'
import { RefreshCw, Search, Check, Package, ChevronRight, X, Scan } from 'lucide-react'

const SEP_COR: Record<string, { bg: string; c: string }> = {
  PENDENTE:     { bg: '#F59E0B22', c: '#F59E0B' },
  EM_SEPARACAO: { bg: '#32ADE622', c: '#32ADE6' },
  PRONTO:       { bg: '#34C75922', c: '#34C759' },
}

// Extrai info de embalagem da descrição: "PRODUTO [2CX×12UN]" → { qtd: 2, unidade: 'CX', qtdPorEmb: 12 }
function parseEmbalagem(descricao: string) {
  const m = descricao.match(/\[(\d+(?:\.\d+)?)(\w+)×(\d+)UN\]/)
  if (m) return { qtd: parseFloat(m[1]), unidade: m[2], qtdPorEmb: parseInt(m[3]) }
  return null
}

// Retorna { qtdSeparar, unidSeparar } — a unidade que o separador trabalha (CAIXAS quando possível)
function infoSeparacao(it: ItemSep) {
  // Prioridade 1: campos de embalagem do produto (direto do banco)
  if (it.embalagem_qtd && it.embalagem_qtd > 1) {
    return {
      qtdSeparar:  it.quantidade / it.embalagem_qtd,
      unidSeparar: it.embalagem_tipo || 'CX',
    }
  }
  // Prioridade 2: parsing do formato "[2CX×72UN]" na descrição (legado)
  const emb = parseEmbalagem(it.descricao)
  if (emb) return { qtdSeparar: emb.qtd, unidSeparar: emb.unidade }
  // Fallback: unidade base
  return { qtdSeparar: it.quantidade, unidSeparar: it.unidade }
}

type ItemSep = {
  id: number; produto_id: number; descricao: string; codigo: string
  codigo_barras?: string; quantidade: number; unidade: string
  embalagem_qtd?: number; embalagem_tipo?: string
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
  const [faltantes, setFaltantes] = useState<Record<number, boolean>>({})
  const [motivos,   setMotivos]   = useState<Record<number, string>>({})
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
    setFaltantes({})
    setMotivos({})
    setScanInput('')
    setScanMsg(null)
    setTimeout(() => scanRef.current?.focus(), 100)
  }

  function handleScan(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    const cod = scanInput.trim()
    if (!cod || !selected) { setScanInput(''); return }
    const item = selected.itens.find(it =>
      it.codigo === cod || it.codigo_barras === cod
    )
    if (!item) {
      setScanMsg({ ok: false, text: `Produto "${cod}" não encontrado no pedido` })
      setTimeout(() => setScanMsg(null), 3000)
    } else {
      const { qtdSeparar } = infoSeparacao(item)
      setColetados(c => {
        const atual = c[item.id] || 0
        return { ...c, [item.id]: Math.min(atual + 1, qtdSeparar) }
      })
      // Ao escanear, remove faltante se estava marcado
      setFaltantes(f => ({ ...f, [item.id]: false }))
      setScanMsg({ ok: true, text: `✓ ${item.descricao}` })
      setTimeout(() => setScanMsg(null), 1500)
    }
    setScanInput('')
  }

  function toggleFaltante(itemId: number) {
    setFaltantes(f => {
      const novoEstado = !f[itemId]
      if (novoEstado) setColetados(c => ({ ...c, [itemId]: 0 }))
      return { ...f, [itemId]: novoEstado }
    })
  }

  // Todos os itens estão resolvidos (coletados OU marcados como faltante)
  const todosResolvidos = selected ? selected.itens.every(it => {
    if (faltantes[it.id]) return motivos[it.id]?.trim().length > 0 // faltante precisa de motivo
    const { qtdSeparar } = infoSeparacao(it)
    return (coletados[it.id] || 0) >= qtdSeparar
  }) : false

  const temFaltante = selected ? selected.itens.some(it => faltantes[it.id]) : false

  // Para a barra de progresso: conta itens resolvidos
  const totalItens    = selected?.itens.length || 0
  const itensOk       = selected ? selected.itens.filter(it => {
    if (faltantes[it.id]) return motivos[it.id]?.trim().length > 0
    const { qtdSeparar } = infoSeparacao(it)
    return (coletados[it.id] || 0) >= qtdSeparar
  }).length : 0
  const pctGeral = totalItens > 0 ? Math.round(itensOk / totalItens * 100) : 0

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
              {selected.cliente_nome} · {itensOk}/{totalItens} itens resolvidos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--card2)', width: 100 }}>
            <div className="h-full rounded-full transition-all"
              style={{ width: `${pctGeral}%`, background: todosResolvidos ? '#34C759' : '#8B5CF6' }} />
          </div>
          <span className="text-xs font-black" style={{ color: todosResolvidos ? '#34C759' : '#8B5CF6' }}>
            {pctGeral}%
          </span>
        </div>
      </div>

      {/* Scan input */}
      <div className="px-4 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: 'var(--card)', border: '1px solid #8B5CF644' }}>
          <Scan size={14} color="#8B5CF6" />
          <input ref={scanRef} value={scanInput}
            onChange={e => setScanInput(e.target.value)}
            onKeyDown={handleScan}
            placeholder="Escanear código de barras..."
            className="flex-1 text-sm bg-transparent text-white outline-none" />
        </div>
        {scanMsg && (
          <div className="mt-1 px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: scanMsg.ok ? '#34C75922' : '#EF444422', color: scanMsg.ok ? '#34C759' : '#EF4444' }}>
            {scanMsg.text}
          </div>
        )}
      </div>

      {/* Itens — layout confronto PV vs Separando */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {selected.itens.map((it, idx) => {
          const { qtdSeparar, unidSeparar } = infoSeparacao(it)
          const col      = coletados[it.id] || 0
          const faltante = faltantes[it.id] || false
          const motivo   = motivos[it.id] || ''
          const ok       = !faltante && col >= qtdSeparar

          const borderColor = faltante
            ? (motivo.trim() ? '#EF444433' : '#F59E0B44')
            : ok ? '#34C75933' : 'var(--border)'

          function confirmarItemEnter(e: React.KeyboardEvent<HTMLInputElement>) {
            if (e.key !== 'Enter') return
            // Se qty < pedido → auto-faltante
            if (col < qtdSeparar) {
              setFaltantes(f => ({ ...f, [it.id]: true }))
            }
            // Foca no próximo input de separação
            const inputs = document.querySelectorAll<HTMLInputElement>('.sep-qty-input')
            const i = Array.from(inputs).indexOf(e.currentTarget)
            if (i >= 0 && i < inputs.length - 1) inputs[i + 1].focus()
          }

          return (
            <div key={it.id} className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--card)', border: `1px solid ${borderColor}` }}>

              {/* Cabeçalho do item */}
              <div className="flex items-center gap-2 px-3 py-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: faltante ? '#EF444422' : ok ? '#34C75922' : 'var(--card2)' }}>
                  {faltante ? <X size={12} color="#EF4444" /> : ok ? <Check size={12} color="#34C759" /> : <Package size={12} color="var(--muted)" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white leading-tight truncate">{it.descricao}</p>
                  <p className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>{it.codigo}</p>
                </div>
                <span className="text-[9px] font-black px-2 py-0.5 rounded-lg flex-shrink-0"
                  style={{
                    background: faltante ? '#EF444422' : ok ? '#34C75922' : '#8B5CF622',
                    color:      faltante ? '#EF4444'   : ok ? '#34C759'   : '#8B5CF6',
                  }}>
                  {faltante ? 'FALTANTE' : ok ? '✓ OK' : 'PENDENTE'}
                </span>
              </div>

              {/* Linha divisória */}
              <div style={{ height: 1, background: 'var(--border)' }} />

              {/* Confronto PEDIDO | SEPARANDO ou campo faltante */}
              {!faltante ? (
                <div className="flex">
                  {/* PEDIDO — quantidade do PV */}
                  <div className="flex flex-col items-center justify-center gap-0.5 py-3 px-4"
                    style={{ borderRight: '1px solid var(--border)', background: '#ffffff05', minWidth: 90 }}>
                    <span className="text-[9px] font-black tracking-widest" style={{ color: 'var(--muted)' }}>PEDIDO</span>
                    <span className="text-xl font-black text-white">{qtdSeparar}</span>
                    <span className="text-[10px] font-bold" style={{ color: '#8B5CF6' }}>{unidSeparar}</span>
                  </div>

                  {/* SEPARANDO — input */}
                  <div className="flex-1 flex flex-col items-center justify-center gap-0.5 py-3 px-4">
                    <span className="text-[9px] font-black tracking-widest" style={{ color: 'var(--muted)' }}>SEPARANDO</span>
                    <input
                      type="number" min={0} max={qtdSeparar}
                      value={col === 0 ? '' : col}
                      onChange={e => {
                        const v = parseFloat(e.target.value) || 0
                        setColetados(c => ({ ...c, [it.id]: Math.min(Math.max(0, v), qtdSeparar) }))
                      }}
                      onKeyDown={confirmarItemEnter}
                      placeholder="0"
                      className="sep-qty-input w-24 px-2 py-1.5 rounded-xl text-xl font-black text-white text-center outline-none"
                      style={{ background: 'var(--card2)', border: `1px solid ${ok ? '#34C75966' : 'var(--border)'}` }}
                    />
                    <span className="text-[10px] font-bold" style={{ color: ok ? '#34C759' : '#8B5CF6' }}>{unidSeparar}</span>
                  </div>
                </div>
              ) : (
                /* Faltante — campo de observação */
                <div className="px-3 py-2 space-y-1.5">
                  <p className="text-[9px] font-black" style={{ color: '#EF4444' }}>
                    QUANTIDADE FALTANTE — INFORME O MOTIVO:
                  </p>
                  <textarea
                    autoFocus
                    value={motivo}
                    onChange={e => setMotivos(m => ({ ...m, [it.id]: e.target.value.toUpperCase() }))}
                    placeholder="EX: SEM ESTOQUE, PRODUTO AVARIADO..."
                    rows={2}
                    className="w-full px-2 py-1.5 rounded-lg text-xs text-white outline-none resize-none"
                    style={{
                      background: '#EF444411',
                      border: `1px solid ${motivo.trim() ? '#EF444444' : '#F59E0B88'}`,
                      textTransform: 'uppercase',
                    }}
                  />
                  <button
                    onClick={() => {
                      setFaltantes(f => ({ ...f, [it.id]: false }))
                      setColetados(c => ({ ...c, [it.id]: 0 }))
                      setMotivos(m => ({ ...m, [it.id]: '' }))
                    }}
                    className="text-[10px] font-bold px-3 py-1 rounded-lg"
                    style={{ background: 'var(--card2)', color: 'var(--muted)' }}>
                    ↩ Corrigir quantidade
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
        {temFaltante && (
          <p className="text-[10px] text-center font-bold mb-2" style={{ color: '#F59E0B' }}>
            ⚠️ Pedido com faltante — será registrado com observação
          </p>
        )}
        <button onClick={concluirSeparacao} disabled={saving || !todosResolvidos}
          className="w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2"
          style={{
            background: todosResolvidos
              ? temFaltante
                ? 'linear-gradient(135deg,#F59E0B,#D97706)'
                : 'linear-gradient(135deg,#34C759,#16A34A)'
              : 'var(--card2)',
            color: todosResolvidos ? 'white' : 'var(--muted)',
          }}>
          {saving ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
          {!todosResolvidos
            ? `Resolva todos os itens (${totalItens - itensOk} pendentes)`
            : temFaltante
              ? 'CONCLUIR COM FALTANTE'
              : 'CONCLUIR SEPARAÇÃO — PRONTO'}
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
