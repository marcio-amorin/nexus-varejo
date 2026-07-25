'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import api, { fmtMoeda } from '@/lib/api'
import {
  RefreshCw, ChevronRight, Package, CheckCircle2, AlertTriangle,
  Scan, Eye, EyeOff, Search, RotateCcw, ArrowLeft,
} from 'lucide-react'

type ItemConf = {
  id: number; produto_id: number; descricao: string; codigo: string
  codigo_barras?: string; quantidade: number; qty_separada: number; unidade: string
  embalagem_qtd?: number; embalagem_tipo?: string
}

function infoConf(it: ItemConf) {
  const embQtd = (it.embalagem_qtd && it.embalagem_qtd > 1) ? it.embalagem_qtd : 1
  const embTipo = embQtd > 1 ? (it.embalagem_tipo || 'CX') : it.unidade
  return { embQtd, embTipo, qtdConferir: it.qty_separada / embQtd }
}
type Pedido = {
  id: number; numero: string; cliente_nome: string; status_separacao: string
  total: number; total_itens: number; tem_faltante: boolean; itens: ItemConf[]
}

// fase: 'contagem' = primeira contagem cega
//       'recontagem' = produtos divergentes p/ recontar (sem ver qtd separada)
//       'divergencia_final' = ainda diverge após recontagem → registra
type Fase = 'contagem' | 'recontagem' | 'divergencia_final'

export default function ConferenciaPage() {
  const router = useRouter()
  const [pedidos,  setPedidos]  = useState<Pedido[]>([])
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState<Pedido | null>(null)
  const [contados, setContados] = useState<Record<number, number>>({})
  const [recontados, setRecontados] = useState<Record<number, number>>({})
  const [scanInput,setScanInput]= useState('')
  const [scanMsg,  setScanMsg]  = useState<{ ok: boolean; text: string } | null>(null)
  const [saving,   setSaving]   = useState(false)
  const [fase,     setFase]     = useState<Fase>('contagem')
  const [itensDivergentes, setItensDivergentes] = useState<ItemConf[]>([])
  const [busca,    setBusca]    = useState('')
  const scanRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    try { const r = await api.get('/pedido-venda/conferencia'); setPedidos(r.data) } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function abrirPedido(p: Pedido) {
    setSelected(p)
    const init: Record<number, number> = {}
    p.itens.forEach(it => { init[it.id] = 0 })
    setContados(init)
    setRecontados({})
    setScanInput(''); setScanMsg(null); setFase('contagem')
    setItensDivergentes([])
    setTimeout(() => scanRef.current?.focus(), 100)
  }

  function handleScan(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    const cod = scanInput.trim()
    if (!cod || !selected) { setScanInput(''); return }

    if (fase === 'contagem') {
      const item = selected.itens.find(it => it.codigo === cod || it.codigo_barras === cod)
      if (!item) {
        setScanMsg({ ok: false, text: `"${cod}" não encontrado no pedido` })
        setTimeout(() => setScanMsg(null), 2500)
      } else {
        setContados(c => ({ ...c, [item.id]: (c[item.id] || 0) + 1 }))
        setScanMsg({ ok: true, text: `✓ ${item.descricao}` })
        setTimeout(() => setScanMsg(null), 1200)
      }
    } else if (fase === 'recontagem') {
      const item = itensDivergentes.find(it => it.codigo === cod || it.codigo_barras === cod)
      if (!item) {
        setScanMsg({ ok: false, text: `"${cod}" não está na lista de recontagem` })
        setTimeout(() => setScanMsg(null), 2500)
      } else {
        setRecontados(c => ({ ...c, [item.id]: (c[item.id] || 0) + 1 }))
        setScanMsg({ ok: true, text: `↺ Recontado: ${item.descricao}` })
        setTimeout(() => setScanMsg(null), 1200)
      }
    }
    setScanInput('')
  }

  function setQty(itemId: number, val: string, isRecontagem = false) {
    const n = parseFloat(val) || 0
    if (isRecontagem) {
      setRecontados(c => ({ ...c, [itemId]: Math.max(0, n) }))
    } else {
      setContados(c => ({ ...c, [itemId]: Math.max(0, n) }))
    }
  }

  // Pré-finalizar: detecta divergências sem revelar qtd separada
  function preFinalizar() {
    if (!selected) return
    const divs = selected.itens.filter(it => {
      const { qtdConferir } = infoConf(it)
      return Math.abs(qtdConferir - (contados[it.id] || 0)) > 0.001
    })
    if (divs.length === 0) {
      // Sem divergência → finaliza direto
      finalizarConferencia(contados, false)
    } else {
      // Tem divergência → fase de recontagem (sem revelar qtd separada)
      const initRec: Record<number, number> = {}
      divs.forEach(it => { initRec[it.id] = 0 })
      setRecontados(initRec)
      setItensDivergentes(divs)
      setFase('recontagem')
      setScanInput('')
      setTimeout(() => scanRef.current?.focus(), 100)
    }
  }

  // Confirmar recontagem → compara novamente
  function confirmarRecontagem() {
    if (!selected) return
    // Verifica se ainda há divergência após recontagem (em caixas)
    const aindaDivergente = itensDivergentes.filter(it => {
      const { qtdConferir } = infoConf(it)
      return Math.abs(qtdConferir - (recontados[it.id] || 0)) > 0.001
    })

    // Mescla contagens: usa recontagem para os itens divergentes
    const contadosFinal: Record<number, number> = { ...contados }
    itensDivergentes.forEach(it => {
      contadosFinal[it.id] = recontados[it.id] || 0
    })

    if (aindaDivergente.length === 0) {
      // Segunda contagem bateu → OK
      finalizarConferencia(contadosFinal, false)
    } else {
      // Ainda diverge após recontagem → registra como divergência oficial
      setContados(contadosFinal)
      setFase('divergencia_final')
    }
  }

  async function finalizarConferencia(contsFinal: Record<number, number>, comDivergencia: boolean) {
    if (!selected) return
    setSaving(true)
    try {
      const itensPayload = selected.itens.map(it => {
        const { embQtd } = infoConf(it)
        return {
          produto_id:    it.produto_id,
          descricao:     it.descricao,
          qty_separada:  it.qty_separada,                           // em unidades
          qty_conferida: (contsFinal[it.id] || 0) * embQtd,        // caixas → unidades
        }
      })
      await api.post(`/pedido-venda/pedidos/${selected.id}/conferencia-finalizar`, {
        itens: itensPayload,
      })
      const msg = comDivergencia
        ? '⚠️ Divergência registrada. Supervisor será notificado.'
        : '✅ Conferência OK! Pronto para NF.'
      setScanMsg({ ok: !comDivergencia, text: msg })
      setTimeout(() => { setSelected(null); setFase('contagem'); load() }, 2000)
    } catch (e: any) {
      setScanMsg({ ok: false, text: e.response?.data?.detail || 'Erro ao finalizar' })
    }
    setSaving(false)
  }

  const totalContado = selected ? selected.itens.reduce((s, it) => s + (contados[it.id] || 0), 0) : 0
  const totalSep     = selected ? selected.itens.reduce((s, it) => s + infoConf(it).qtdConferir, 0) : 0
  const pct = totalSep > 0 ? Math.min(100, Math.round(totalContado / totalSep * 100)) : 0

  const filtrados = pedidos.filter(p =>
    !busca || p.numero.includes(busca) || p.cliente_nome.toLowerCase().includes(busca.toLowerCase())
  )

  // ── FASE: DIVERGÊNCIA FINAL (registrar) ────────────────────────────────────
  if (fase === 'divergencia_final' && selected) {
    // Produtos que ainda divergem após recontagem
    const divFinais = itensDivergentes.filter(it =>
      Math.abs(it.qty_separada - (contados[it.id] || 0)) > 0.001
    )
    return (
      <div className="pg" style={{ background: 'var(--bg)' }}>
        <div className="pg-header">
          <h1 className="text-base font-black text-white flex items-center gap-2">
            <AlertTriangle size={16} color="#EF4444" /> Divergência Confirmada
          </h1>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>
            {selected.numero} · Recontagem ainda apresenta divergência
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="rounded-2xl p-3" style={{ background: '#EF444411', border: '1px solid #EF444433' }}>
            <p className="text-xs font-bold" style={{ color: '#EF4444' }}>
              ⚠️ Os produtos abaixo divergiram mesmo após recontagem. A divergência será registrada para análise do supervisor.
            </p>
          </div>
          {divFinais.map((it, i) => {
            const { embTipo } = infoConf(it)
            return (
              <div key={i} className="rounded-2xl p-3" style={{ background: 'var(--card)', border: '1px solid #EF444433' }}>
                <p className="text-sm font-bold text-white">{it.descricao}</p>
                <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--muted)' }}>{it.codigo}</p>
                <div className="flex items-center gap-3 mt-2">
                  <div className="rounded-lg px-2 py-1 text-xs font-black"
                    style={{ background: '#EF444422', color: '#EF4444' }}>
                    Contagem 1: {contados[it.id] || 0} {embTipo}
                  </div>
                  <div className="rounded-lg px-2 py-1 text-xs font-black"
                    style={{ background: '#EF444422', color: '#EF4444' }}>
                    Recontagem: {recontados[it.id] || 0} {embTipo}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <div className="px-4 py-3 space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
          {scanMsg && (
            <div className="px-3 py-2 rounded-xl text-xs font-bold"
              style={{ background: scanMsg.ok ? '#34C75922' : '#EF444422', color: scanMsg.ok ? '#34C759' : '#EF4444' }}>
              {scanMsg.text}
            </div>
          )}
          <button
            onClick={() => finalizarConferencia(contados, true)}
            disabled={saving}
            className="w-full py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg,#EF4444,#B91C1C)', color: 'white' }}>
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
            Registrar Divergência
          </button>
          <button onClick={() => { setFase('recontagem'); setScanInput('') }}
            className="w-full py-2 rounded-xl text-xs font-bold"
            style={{ color: 'var(--muted)' }}>
            ← Voltar à recontagem
          </button>
        </div>
      </div>
    )
  }

  // ── FASE: RECONTAGEM (itens divergentes, sem revelar qtd separada) ─────────
  if (fase === 'recontagem' && selected) {
    const totalRec = itensDivergentes.reduce((s, it) => s + (recontados[it.id] || 0), 0)
    return (
      <div className="pg" style={{ background: 'var(--bg)' }}>
        <div className="pg-header flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => { setFase('contagem'); setScanInput('') }} style={{ color: 'var(--muted)' }}>
              <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} />
            </button>
            <div>
              <h1 className="text-base font-black text-white flex items-center gap-2">
                <RotateCcw size={14} color="#F59E0B" /> Recontagem · {selected.numero}
              </h1>
              <p className="text-[10px]" style={{ color: '#F59E0B' }}>
                {itensDivergentes.length} produto(s) com divergência — reconte sem ver a separação
              </p>
            </div>
          </div>
        </div>

        <div className="mx-4 mt-0 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2"
          style={{ background: '#F59E0B11', border: '1px solid #F59E0B44', color: '#F59E0B' }}>
          <AlertTriangle size={12} />
          Atenção: houve divergência na contagem inicial. Reconte apenas estes produtos.
        </div>

        {/* Scan */}
        <div className="px-4 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: 'var(--card)', border: '1px solid #F59E0B44' }}>
            <Scan size={14} color="#F59E0B" />
            <input ref={scanRef} value={scanInput}
              onChange={e => setScanInput(e.target.value)}
              onKeyDown={handleScan}
              placeholder="Escanear para recontar..."
              className="flex-1 text-sm bg-transparent text-white outline-none" />
          </div>
          {scanMsg && (
            <div className="mt-1 px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ background: scanMsg.ok ? '#34C75922' : '#EF444422', color: scanMsg.ok ? '#34C759' : '#EF4444' }}>
              {scanMsg.text}
            </div>
          )}
        </div>

        {/* Itens divergentes para recontar */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <p className="text-[10px] text-center font-bold px-4 mb-1" style={{ color: 'var(--muted)' }}>
            <EyeOff size={10} className="inline mr-1" />
            Recontagem cega — conte do zero, sem ver a separação anterior
          </p>
          {itensDivergentes.map(it => {
            const { embTipo } = infoConf(it)
            const rec = recontados[it.id] || 0
            return (
              <div key={it.id} className="rounded-2xl p-3"
                style={{ background: 'var(--card)', border: '1px solid #F59E0B44' }}>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: '#F59E0B22' }}>
                    <RotateCcw size={13} color="#F59E0B" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white">{it.descricao}</p>
                    <p className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>{it.codigo}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs" style={{ color: '#F59E0B' }}>Recontagem:</span>
                      <input
                        type="number" min={0}
                        value={rec === 0 ? '' : rec}
                        onChange={e => setQty(it.id, e.target.value, true)}
                        placeholder="0"
                        className="w-20 px-2 py-1 rounded-lg text-sm font-black text-white text-center outline-none"
                        style={{ background: 'var(--card2)', border: '1px solid #F59E0B66' }}
                      />
                      <span className="text-xs font-bold" style={{ color: 'var(--muted)' }}>{embTipo}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={confirmarRecontagem}
            disabled={saving}
            className="w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg,#F59E0B,#D97706)', color: 'white' }}>
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Confirmar Recontagem
          </button>
        </div>
      </div>
    )
  }

  // ── FASE: CONTAGEM (primeira, cega) ─────────────────────────────────────
  if (selected) return (
    <div className="pg" style={{ background: 'var(--bg)' }}>
      <div className="pg-header flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelected(null)} style={{ color: 'var(--muted)' }}>
            <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <div>
            <h1 className="text-base font-black text-white flex items-center gap-2">
              <EyeOff size={14} color="#32ADE6" /> Conferência Cega · {selected.numero}
            </h1>
            <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
              {selected.cliente_nome} · Conte sem ver a separação
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-full overflow-hidden" style={{ background: 'var(--card2)', width: 80, height: 7 }}>
            <div className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: '#32ADE6' }} />
          </div>
          <span className="text-xs font-black" style={{ color: '#32ADE6' }}>{pct}%</span>
        </div>
      </div>

      {selected.tem_faltante && (
        <div className="mx-4 mt-0 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2"
          style={{ background: '#F5940011', border: '1px solid #F5940044', color: '#F59400' }}>
          <AlertTriangle size={12} /> Este pedido foi separado com faltante
        </div>
      )}

      {/* Scan */}
      <div className="px-4 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: 'var(--card)', border: '1px solid #32ADE644' }}>
          <Scan size={14} color="#32ADE6" />
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

      {/* Itens */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <p className="text-[10px] text-center font-bold px-4 mb-1" style={{ color: 'var(--muted)' }}>
          <EyeOff size={10} className="inline mr-1" />
          Conferência cega — as quantidades da separação ficam ocultas
        </p>
        {selected.itens.map(it => {
          const { embTipo } = infoConf(it)
          const cnt = contados[it.id] || 0
          const ok  = cnt > 0
          return (
            <div key={it.id} className="rounded-2xl p-3"
              style={{ background: 'var(--card)', border: `1px solid ${ok ? '#34C75944' : 'var(--border)'}` }}>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: ok ? '#34C75922' : 'var(--card2)' }}>
                  {ok ? <CheckCircle2 size={13} color="#34C759" /> : <Package size={13} color="var(--muted)" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">{it.descricao}</p>
                  <p className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>{it.codigo}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>Contado:</span>
                    <input
                      type="number" min={0}
                      value={cnt === 0 ? '' : cnt}
                      onChange={e => setQty(it.id, e.target.value)}
                      placeholder="0"
                      className="w-20 px-2 py-1 rounded-lg text-sm font-black text-white text-center outline-none"
                      style={{ background: 'var(--card2)', border: '1px solid var(--border)' }}
                    />
                    <span className="text-xs font-bold" style={{ color: 'var(--muted)' }}>{embTipo}</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
        <button onClick={preFinalizar} disabled={saving}
          className="w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg,#32ADE6,#0369a1)', color: 'white' }}>
          {saving ? <RefreshCw size={14} className="animate-spin" /> : <Eye size={14} />}
          Finalizar Conferência
        </button>
      </div>
    </div>
  )

  // ── LISTA ─────────────────────────────────────────────────────────────────
  return (
    <div className="pg">
      <div className="pg-header flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/expedicao')} style={{ color: 'var(--muted)' }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-base font-black text-white">Conferência de Pedidos</h1>
            <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
              Conferência cega — conte sem ver a separação
            </p>
          </div>
        </div>
        <button onClick={load} style={{ color: 'var(--muted)' }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="px-4 pb-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <Search size={13} color="var(--muted)" />
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar pedido..."
            className="flex-1 text-xs bg-transparent text-white outline-none" />
        </div>
      </div>

      <div className="pg-body space-y-2">
        {loading ? (
          <div className="text-center py-12" style={{ color: 'var(--muted)' }}>Carregando...</div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--muted)' }}>
            <CheckCircle2 size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum pedido aguardando conferência</p>
          </div>
        ) : filtrados.map(p => (
          <div key={p.id} className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background: 'var(--card)', border: `1px solid ${p.tem_faltante ? '#F5940033' : 'var(--border)'}` }}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-black text-white">{p.numero}</p>
                {p.tem_faltante && (
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5"
                    style={{ background: '#F5940022', color: '#F59400' }}>
                    <AlertTriangle size={8} /> Com faltante
                  </span>
                )}
                {p.status_separacao === 'DIVERGENCIA' && (
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded"
                    style={{ background: '#EF444422', color: '#EF4444' }}>
                    Divergência anterior
                  </span>
                )}
              </div>
              <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted)' }}>
                {p.cliente_nome} · {p.total_itens} item(s) · {fmtMoeda(p.total)}
              </p>
            </div>
            <button onClick={() => abrirPedido(p)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 flex-shrink-0"
              style={{ background: '#32ADE6', color: 'white' }}>
              Conferir <ChevronRight size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
