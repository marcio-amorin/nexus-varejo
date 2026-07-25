'use client'
import { useEffect, useState, useCallback } from 'react'
import api, { fmtMoeda } from '@/lib/api'
import {
  DollarSign, TrendingDown, TrendingUp, X, Lock, Unlock,
  RefreshCw, CreditCard, Banknote, Smartphone, AlertTriangle,
  CheckCircle, Clock, User,
} from 'lucide-react'

const hoje   = () => new Date().toISOString().slice(0, 10)
const ontem  = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10) }
const semana = () => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10) }
const mes    = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

const FORMA_ICONE: Record<string, string> = {
  DINHEIRO: '💵', PIX: '📱', CREDITO: '💳', DEBITO: '💳', CHEQUE: '📝', CONVENIO: '🤝',
}
const FORMA_COR: Record<string, string> = {
  DINHEIRO: '#22c55e', PIX: '#06b6d4', CREDITO: '#3b82f6', DEBITO: '#8b5cf6',
  CHEQUE: '#f59e0b', CONVENIO: '#ec4899',
}

function fmtHora(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
function fmtDtHr(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function CaixaPage() {
  const [aba, setAba]           = useState<'atual' | 'fechamentos'>('atual')
  const [status, setStatus]     = useState<any>(null)
  const [loadingAt, setLoadAt]  = useState(true)

  // Fechamentos
  const [fechamentos, setFech]  = useState<any[]>([])
  const [loadingFech, setLoadF] = useState(false)
  const [dtIni, setDtIni]       = useState(ontem())
  const [dtFim, setDtFim]       = useState(hoje())
  const [expanded, setExpanded]       = useState<number | null>(null)
  const [expandedDate, setExpandedDate] = useState<string | null>(null)

  // Modal cupons por forma
  const [formaModal, setFormaModal] = useState<{ caixaId: number; forma: string; cupons: any[]; loading: boolean } | null>(null)

  // Modais caixa atual
  const [showAbrir,  setShowAbrir]  = useState(false)
  const [showFechar, setShowFechar] = useState(false)
  const [showSangria, setSangria]   = useState(false)
  const [showSuprim,  setSuprim]    = useState(false)
  const [saving, setSaving]         = useState(false)
  const [fundo,    setFundo]     = useState('')
  const [terminal, setTerminal]  = useState('CAIXA-01')
  const [contado,  setContado]   = useState('')
  const [movVal,   setMovVal]    = useState('')
  const [movObs,   setMovObs]    = useState('')

  const inp  = 'w-full px-3 py-2.5 text-sm rounded-xl outline-none'
  const inpS = { background: 'var(--input)', border: '1px solid var(--border)', color: 'white' }

  const loadStatus = useCallback(async () => {
    setLoadAt(true)
    try { const r = await api.get('/caixa/status'); setStatus(r.data) } catch {}
    setLoadAt(false)
  }, [])

  const loadFechamentos = useCallback(async (ini = dtIni, fim = dtFim) => {
    setLoadF(true)
    try {
      const r = await api.get('/caixa/fechamentos', { params: { data_ini: ini, data_fim: fim } })
      setFech(r.data)
    } catch { setFech([]) }
    setLoadF(false)
  }, [dtIni, dtFim])

  useEffect(() => { loadStatus() }, [loadStatus])
  useEffect(() => { if (aba === 'fechamentos') loadFechamentos() }, [aba])

  async function abrir() {
    setSaving(true)
    try {
      await api.post('/caixa/abrir', { terminal, fundo_caixa: Number(fundo) || 0 })
      setShowAbrir(false); setFundo(''); loadStatus()
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro') }
    setSaving(false)
  }
  async function fechar() {
    setSaving(true)
    try {
      await api.post('/caixa/fechar', { dinheiro_contado: contado ? Number(contado) : null })
      setShowFechar(false); setContado(''); loadStatus()
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro') }
    setSaving(false)
  }
  async function registrarMov(tipo: 'sangria' | 'suprimento') {
    if (!movVal || Number(movVal) <= 0) return
    setSaving(true)
    try {
      await api.post(`/caixa/${tipo}`, { valor: Number(movVal), observacao: movObs })
      setSangria(false); setSuprim(false); setMovVal(''); setMovObs(''); loadStatus()
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro') }
    setSaving(false)
  }

  const caixa = status?.caixa

  // ─── Totais dos fechamentos ───────────────────────────────────────────────
  const totalVendasFech  = fechamentos.reduce((a, f) => a + f.total_vendas, 0)
  const totalFaltou      = fechamentos.reduce((a, f) => a + (f.diferenca < 0 ? Math.abs(f.diferenca) : 0), 0)
  const totalSobrou      = fechamentos.reduce((a, f) => a + (f.diferenca > 0 ? f.diferenca : 0), 0)
  const formasTotais: Record<string, number> = {}
  fechamentos.forEach(f => {
    Object.entries(f.por_forma || {}).forEach(([k, v]: any) => {
      formasTotais[k] = (formasTotais[k] || 0) + v
    })
  })

  return (
    <div className="pg">
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="pg-header flex items-center justify-between gap-3 flex-shrink-0">
        <div>
          <h1 className="text-base font-black text-white flex items-center gap-2">
            💰 Caixa — Painel
          </h1>
          <p className="text-[10px]" style={{ color: 'var(--muted)' }}>Controle de abertura, fechamentos e histórico por operador</p>
        </div>
        {/* Abas */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--card2)' }}>
          {(['atual', 'fechamentos'] as const).map(a => (
            <button key={a} onClick={() => setAba(a)}
              className="px-4 py-1.5 rounded-lg text-xs font-black transition-all"
              style={{
                background: aba === a ? '#f97316' : 'transparent',
                color: aba === a ? 'white' : 'var(--muted)',
              }}>
              {a === 'atual' ? '📊 Caixa Atual' : '📋 Fechamentos'}
            </button>
          ))}
        </div>
      </div>

      <div className="pg-body space-y-4">

        {/* ══════════════════════ ABA ATUAL ══════════════════════ */}
        {aba === 'atual' && (
          <>
            {loadingAt ? (
              <div className="flex items-center justify-center py-16" style={{ color: 'var(--muted)' }}>
                <RefreshCw size={20} className="animate-spin" />
              </div>
            ) : (
              <>
                {/* Status */}
                <div className="rounded-2xl p-5"
                  style={{ background: 'var(--card)', border: `2px solid ${status?.aberto ? '#22c55e40' : '#ef444440'}` }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                        style={{ background: status?.aberto ? '#22c55e20' : '#ef444420' }}>
                        {status?.aberto ? <Unlock size={20} color="#22c55e" /> : <Lock size={20} color="#ef4444" />}
                      </div>
                      <div>
                        <p className="font-black text-white text-base">
                          {status?.aberto ? `Caixa Aberto — ${caixa?.terminal}` : 'Caixa Fechado'}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>
                          {status?.aberto
                            ? `Aberto às ${fmtHora(caixa?.aberto_em)}`
                            : 'Nenhum caixa aberto no momento'}
                        </p>
                      </div>
                    </div>
                    {/* Painel de visualização — operações de caixa são feitas no PDV */}
                  </div>

                  {status?.aberto && caixa && (
                    <>
                      <div className="grid grid-cols-4 gap-3">
                        {[
                          { l: 'Total Vendas', v: caixa.total_vendas, c: '#22c55e', sub: `${caixa.qtd_vendas} vendas` },
                          { l: 'Fundo de Caixa', v: caixa.fundo_caixa, c: '#f59e0b', sub: 'abertura' },
                          { l: 'Sangrias', v: caixa.sangrias_dinheiro || 0, c: '#ef4444', sub: 'retiradas dinheiro' },
                          { l: 'Saldo Dinheiro', v: caixa.saldo_teorico_dinheiro, c: '#3b82f6', sub: 'teórico' },
                        ].map(({ l, v, c, sub }) => (
                          <div key={l} className="p-3 rounded-xl" style={{ background: 'var(--card2)', border: `1px solid ${c}20` }}>
                            <p className="text-[9px] font-bold uppercase mb-1" style={{ color: 'var(--muted)' }}>{l}</p>
                            <p className="text-base font-black" style={{ color: c }}>{fmtMoeda(v)}</p>
                            <p className="text-[9px]" style={{ color: 'var(--muted)' }}>{sub}</p>
                          </div>
                        ))}
                      </div>

                      {Object.keys(caixa.por_forma || {}).length > 0 && (
                        <div className="mt-4">
                          <p className="text-[10px] font-black mb-2 uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Vendas por Forma</p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(caixa.por_forma).map(([forma, valor]: any) => {
                              const cor = FORMA_COR[forma] || '#f59e0b'
                              return (
                                <div key={forma} className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                                  style={{ background: cor + '15', border: `1px solid ${cor}30` }}>
                                  <span>{FORMA_ICONE[forma] || '🔄'}</span>
                                  <span className="text-xs font-bold text-white">{forma}</span>
                                  <span className="text-sm font-black" style={{ color: cor }}>{fmtMoeda(valor)}</span>
                                  <span className="text-[10px]" style={{ color: 'var(--muted)' }}>({caixa.qtd_por_forma?.[forma] || 0}x)</span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Movimentos */}
                {status?.aberto && caixa?.movimentos?.length > 0 && (
                  <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                    <div className="px-4 py-2.5" style={{ background: 'var(--card2)' }}>
                      <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Movimentos</p>
                    </div>
                    {caixa.movimentos.map((m: any, i: number) => (
                      <div key={i} className="flex items-center justify-between px-4 py-2.5"
                        style={{ borderTop: '1px solid var(--border)' }}>
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center"
                            style={{ background: m.tipo === 'SANGRIA' ? '#ef444420' : '#22c55e20' }}>
                            {m.tipo === 'SANGRIA' ? <TrendingDown size={12} color="#ef4444" /> : <TrendingUp size={12} color="#22c55e" />}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white">{m.tipo}</p>
                            <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{m.observacao}</p>
                          </div>
                        </div>
                        <p className="text-sm font-black"
                          style={{ color: m.tipo === 'SANGRIA' ? '#ef4444' : '#22c55e' }}>
                          {m.tipo === 'SANGRIA' ? '-' : '+'}{fmtMoeda(m.valor)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ══════════════════════ ABA FECHAMENTOS ══════════════════════ */}
        {aba === 'fechamentos' && (
          <>
            {/* Filtros */}
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { l: 'Hoje',   ini: hoje(),   fim: hoje() },
                { l: 'Ontem',  ini: ontem(),  fim: ontem() },
                { l: 'Semana', ini: semana(), fim: hoje() },
                { l: 'Mês',    ini: mes(),    fim: hoje() },
              ].map(a => (
                <button key={a.l} onClick={() => { setDtIni(a.ini); setDtFim(a.fim); loadFechamentos(a.ini, a.fim) }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold"
                  style={{
                    background: dtIni === a.ini && dtFim === a.fim ? '#f97316' : 'var(--card2)',
                    color:      dtIni === a.ini && dtFim === a.fim ? 'white'   : 'var(--muted)',
                  }}>
                  {a.l}
                </button>
              ))}
              <input type="date" value={dtIni} onChange={e => setDtIni(e.target.value)}
                className="text-xs px-2 py-1.5 rounded-lg"
                style={{ background: 'var(--input)', border: '1px solid var(--border)', color: 'white' }} />
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>até</span>
              <input type="date" value={dtFim} onChange={e => setDtFim(e.target.value)}
                className="text-xs px-2 py-1.5 rounded-lg"
                style={{ background: 'var(--input)', border: '1px solid var(--border)', color: 'white' }} />
              <button onClick={() => loadFechamentos()} disabled={loadingFech}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold"
                style={{ background: '#f97316', color: 'white' }}>
                <RefreshCw size={11} className={loadingFech ? 'animate-spin' : ''} />
                {loadingFech ? 'Buscando...' : 'Buscar'}
              </button>
            </div>

            {loadingFech ? (
              <div className="flex items-center justify-center py-20" style={{ color: 'var(--muted)' }}>
                <RefreshCw size={20} className="animate-spin mr-2" /> Carregando...
              </div>
            ) : fechamentos.length === 0 ? (
              <div className="text-center py-20" style={{ color: 'var(--muted)' }}>
                <p className="text-4xl mb-3">🗂️</p>
                <p className="font-bold text-white">Nenhum fechamento no período</p>
                <p className="text-xs mt-1">Use os filtros acima para buscar em outro período</p>
              </div>
            ) : (() => {
              // Agrupar por data
              const porData: Record<string, any[]> = {}
              fechamentos.forEach((f: any) => {
                const dt = f.fechado_em
                  ? new Date(f.fechado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                  : '—'
                if (!porData[dt]) porData[dt] = []
                porData[dt].push(f)
              })
              const datasOrdenadas = Object.keys(porData)

              const labelData = (dtStr: string) => {
                const hj = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                const ont = new Date(Date.now() - 86400000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                if (dtStr === hj)  return { txt: 'Hoje',   cor: '#22c55e' }
                if (dtStr === ont) return { txt: 'Ontem',  cor: '#f59e0b' }
                return { txt: '', cor: '#94a3b8' }
              }

              return (
                <>
                  {/* Totalizadores do período */}
                  <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))' }}>
                    <div className="rounded-xl p-3" style={{ background: 'var(--card)', border: '1px solid #22c55e25' }}>
                      <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#22c55e' }}>Total Período</p>
                      <p className="text-xl font-black text-white mt-1">{fmtMoeda(totalVendasFech)}</p>
                      <p className="text-[9px] mt-0.5" style={{ color: 'var(--muted)' }}>{fechamentos.length} fechamento{fechamentos.length !== 1 ? 's' : ''} • {datasOrdenadas.length} dia{datasOrdenadas.length !== 1 ? 's' : ''}</p>
                    </div>
                    {Object.entries(formasTotais).map(([forma, valor]) => {
                      const cor = FORMA_COR[forma] || '#f59e0b'
                      return (
                        <div key={forma} className="rounded-xl p-3" style={{ background: 'var(--card)', border: `1px solid ${cor}25` }}>
                          <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: cor }}>{FORMA_ICONE[forma] || '🔄'} {forma}</p>
                          <p className="text-xl font-black text-white mt-1">{fmtMoeda(valor)}</p>
                        </div>
                      )
                    })}
                    {totalFaltou > 0 && (
                      <div className="rounded-xl p-3" style={{ background: 'var(--card)', border: '1px solid #ef444425' }}>
                        <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#ef4444' }}>⚠ Total Faltou</p>
                        <p className="text-xl font-black mt-1" style={{ color: '#ef4444' }}>{fmtMoeda(totalFaltou)}</p>
                      </div>
                    )}
                    {totalSobrou > 0 && (
                      <div className="rounded-xl p-3" style={{ background: 'var(--card)', border: '1px solid #fbbf2425' }}>
                        <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#fbbf24' }}>Sobrou</p>
                        <p className="text-xl font-black mt-1" style={{ color: '#fbbf24' }}>{fmtMoeda(totalSobrou)}</p>
                      </div>
                    )}
                  </div>

                  {/* ── Lista agrupada por data ── */}
                  <div className="space-y-3">
                    {datasOrdenadas.map(dt => {
                      const fechsDia = porData[dt]
                      const totalDia = fechsDia.reduce((s: number, f: any) => s + (f.total_vendas || 0), 0)
                      const qtdVendasDia = fechsDia.reduce((s: number, f: any) => s + (f.qtd_vendas || 0), 0)
                      const isDateExp = expandedDate === dt
                      const lbl = labelData(dt)

                      // Formas consolidadas do dia
                      const formasDia: Record<string, number> = {}
                      fechsDia.forEach((f: any) => {
                        Object.entries(f.por_forma || {}).forEach(([k, v]: any) => {
                          formasDia[k] = (formasDia[k] || 0) + v
                        })
                      })

                      return (
                        <div key={dt}>
                          {/* ── Header da data ── */}
                          <button
                            onClick={() => { setExpandedDate(isDateExp ? null : dt); setExpanded(null) }}
                            className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-left transition-all"
                            style={{
                              background: isDateExp ? 'var(--card)' : 'var(--card2)',
                              border: `2px solid ${isDateExp ? '#f9731650' : 'transparent'}`,
                            }}>
                            {/* Ícone data */}
                            <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
                              style={{ background: isDateExp ? '#f9731620' : 'rgba(255,255,255,0.06)' }}>
                              <span className="text-[9px] font-black uppercase" style={{ color: isDateExp ? '#f97316' : 'var(--muted)' }}>
                                {dt.slice(3, 5)}/{dt.slice(6, 10).slice(2)}
                              </span>
                              <span className="text-xl font-black leading-none" style={{ color: isDateExp ? '#f97316' : 'white' }}>
                                {dt.slice(0, 2)}
                              </span>
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-black text-white text-base">{dt}</p>
                                {lbl.txt && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-black"
                                    style={{ background: lbl.cor + '20', color: lbl.cor }}>
                                    {lbl.txt}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                                {fechsDia.length} fechamento{fechsDia.length !== 1 ? 's' : ''} · {qtdVendasDia} venda{qtdVendasDia !== 1 ? 's' : ''}
                              </p>
                            </div>

                            {/* Formas do dia */}
                            <div className="flex gap-1.5 flex-wrap justify-end">
                              {Object.entries(formasDia).map(([forma, valor]: any) => {
                                const cor = FORMA_COR[forma] || '#f59e0b'
                                return (
                                  <div key={forma} className="flex items-center gap-1 px-2 py-1 rounded-lg"
                                    style={{ background: cor + '15', border: `1px solid ${cor}30` }}>
                                    <span style={{ fontSize: 11 }}>{FORMA_ICONE[forma] || '🔄'}</span>
                                    <span className="text-xs font-black" style={{ color: cor }}>{fmtMoeda(valor)}</span>
                                  </div>
                                )
                              })}
                            </div>

                            {/* Total */}
                            <div className="text-right flex-shrink-0 ml-2">
                              <p className="text-xl font-black text-white">{fmtMoeda(totalDia)}</p>
                            </div>

                            <span style={{
                              color: 'var(--muted)', fontSize: 18, marginLeft: 4, flexShrink: 0,
                              transform: isDateExp ? 'rotate(180deg)' : 'none',
                              transition: 'transform 0.25s', display: 'block'
                            }}>▾</span>
                          </button>

                          {/* ── Fechamentos do dia (expandido) ── */}
                          {isDateExp && (
                            <div className="mt-2 ml-4 space-y-2">
                              {fechsDia.map((f: any) => {
                                const isExp = expanded === f.id
                                const dif = f.diferenca
                                const difCor = dif === null ? '#94a3b8' : dif === 0 ? '#22c55e' : dif > 0 ? '#fbbf24' : '#ef4444'
                                const difTxt = dif === null ? '—' : dif === 0 ? 'Conferido ✓' : dif > 0 ? `+${fmtMoeda(dif)} sobrou` : `${fmtMoeda(dif)} faltou`

                                return (
                                  <div key={f.id} className="rounded-2xl overflow-hidden"
                                    style={{ background: 'var(--card)', border: `1.5px solid ${difCor}30` }}>

                                    <button className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                                      onClick={() => setExpanded(isExp ? null : f.id)}>
                                      {/* Avatar */}
                                      <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-base flex-shrink-0"
                                        style={{ background: '#f9731618', color: '#f97316' }}>
                                        {(f.operador_nome || '?')[0].toUpperCase()}
                                      </div>
                                      {/* Info */}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <p className="font-black text-white text-sm">{f.operador_nome}</p>
                                          <span className="text-[9px] px-1.5 py-0.5 rounded-full"
                                            style={{ background: 'var(--card2)', color: 'var(--muted)' }}>
                                            {f.terminal}
                                          </span>
                                        </div>
                                        <p className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>
                                          {fmtHora(f.aberto_em)} → {fmtHora(f.fechado_em)}
                                          {' · '}{f.qtd_vendas} venda{f.qtd_vendas !== 1 ? 's' : ''}
                                        </p>
                                      </div>
                                      {/* Formas */}
                                      <div className="flex gap-1.5 flex-wrap justify-end">
                                        {Object.entries(f.por_forma || {}).map(([forma, valor]: any) => {
                                          const cor = FORMA_COR[forma] || '#f59e0b'
                                          const qtd = f.qtd_por_forma?.[forma] || 0
                                          return (
                                            <div key={forma} className="flex items-center gap-1 px-2 py-1 rounded-lg"
                                              style={{ background: cor + '12', border: `1px solid ${cor}25` }}>
                                              <span style={{ fontSize: 11 }}>{FORMA_ICONE[forma] || '🔄'}</span>
                                              <span className="text-xs font-black" style={{ color: cor }}>{fmtMoeda(valor)}</span>
                                              <span className="text-[9px]" style={{ color: 'var(--muted)' }}>{qtd}x</span>
                                            </div>
                                          )
                                        })}
                                      </div>
                                      {/* Total + diff */}
                                      <div className="text-right flex-shrink-0 ml-2">
                                        <p className="font-black text-white">{fmtMoeda(f.total_vendas)}</p>
                                        <p className="text-[10px] font-black" style={{ color: difCor }}>{difTxt}</p>
                                      </div>
                                      <span style={{ color: 'var(--muted)', fontSize: 16, flexShrink: 0,
                                        transform: isExp ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'block' }}>▾</span>
                                    </button>

                                    {/* Detalhe expandido do fechamento */}
                                    {isExp && (
                                      <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
                                        <div className="pt-3 grid grid-cols-2 gap-4">
                                          {/* Balanço */}
                                          <div className="space-y-2">
                                            <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Balanço do Turno</p>
                                            {[
                                              { l: 'Fundo de Caixa', v: f.fundo_caixa, c: '#f59e0b' },
                                              { l: '+ Vendas Dinheiro', v: f.total_dinheiro, c: '#22c55e' },
                                              { l: '- Sangrias', v: -(f.sangrias_dinheiro || 0), c: '#ef4444' },
                                              { l: 'Saldo Esperado', v: f.saldo_teorico_dinheiro, c: '#3b82f6', bold: true },
                                              { l: 'Contado', v: f.dinheiro_contado, c: '#fbbf24', bold: true },
                                              { l: 'Diferença', v: dif, c: difCor, bold: true },
                                            ].filter(x => x.v !== null && x.v !== undefined).map(({ l, v, c, bold }) => (
                                              <div key={l} className="flex justify-between">
                                                <span className="text-xs" style={{ color: bold ? 'white' : 'var(--muted)', fontWeight: bold ? 700 : 400 }}>{l}</span>
                                                <span className="font-black text-xs" style={{ color: c }}>{fmtMoeda(v ?? 0)}</span>
                                              </div>
                                            ))}
                                          </div>
                                          {/* Formas detalhadas — clicável */}
                                          <div className="space-y-1.5">
                                            <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>Vendas por Forma <span className="normal-case font-normal">(clique para ver vendas)</span></p>
                                            {Object.entries(f.por_forma || {}).map(([forma, valor]: any) => {
                                              const cor = FORMA_COR[forma] || '#f59e0b'
                                              const qtd = f.qtd_por_forma?.[forma] || 0
                                              return (
                                                <button key={forma}
                                                  onClick={async () => {
                                                    setFormaModal({ caixaId: f.id, forma, cupons: [], loading: true })
                                                    try {
                                                      const r = await api.get(`/caixa/${f.id}/cupons`, { params: { forma } })
                                                      setFormaModal({ caixaId: f.id, forma, cupons: r.data, loading: false })
                                                    } catch {
                                                      setFormaModal({ caixaId: f.id, forma, cupons: [], loading: false })
                                                    }
                                                  }}
                                                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all"
                                                  style={{ background: cor + '10', border: `1px solid ${cor}25` }}
                                                  onMouseEnter={e => (e.currentTarget.style.background = cor + '22')}
                                                  onMouseLeave={e => (e.currentTarget.style.background = cor + '10')}>
                                                  <div className="flex items-center gap-1.5">
                                                    <span>{FORMA_ICONE[forma] || '🔄'}</span>
                                                    <span className="text-xs font-bold text-white">{forma}</span>
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--card2)', color: 'var(--muted)' }}>{qtd}x</span>
                                                  </div>
                                                  <div className="flex items-center gap-2">
                                                    <span className="font-black text-xs" style={{ color: cor }}>{fmtMoeda(valor)}</span>
                                                    <span style={{ color: 'var(--muted)', fontSize: 11 }}>›</span>
                                                  </div>
                                                </button>
                                              )
                                            })}
                                            {(f.auto_sangrias || []).length > 0 && (
                                              <div className="pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                                                <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--muted)' }}>Auto-Sangrias</p>
                                                {f.auto_sangrias.map((s: any, i: number) => (
                                                  <div key={i} className="flex justify-between text-xs">
                                                    <span style={{ color: 'var(--muted)' }}>{s.forma}</span>
                                                    <span className="font-black" style={{ color: '#60a5fa' }}>{fmtMoeda(s.valor)}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        <div className="rounded-xl p-2.5 flex items-center justify-between"
                                          style={{ background: difCor + '10', border: `1px solid ${difCor}25` }}>
                                          <span className="font-black text-sm text-white">
                                            {dif === null ? 'Dinheiro não informado' : dif === 0 ? '✅ Caixa conferido' : dif > 0 ? '💛 Sobrou' : '⚠️ Faltou'}
                                          </span>
                                          {dif !== null && dif !== 0 && (
                                            <span className="font-black text-lg" style={{ color: difCor }}>
                                              {dif > 0 ? '+' : ''}{fmtMoeda(dif)}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              )
            })()}
          </>
        )}
      </div>

      {/* ── Modal Abrir ──────────────────────────────────────────────────────── */}
      {showAbrir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between">
              <p className="font-black text-white text-lg">Abrir Caixa</p>
              <button onClick={() => setShowAbrir(false)} style={{ color: 'var(--muted)' }}><X size={18} /></button>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>TERMINAL</label>
              <input value={terminal} onChange={e => setTerminal(e.target.value)} className={inp} style={inpS} placeholder="CAIXA-01" />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>FUNDO DE CAIXA (R$)</label>
              <input type="number" step="0.01" value={fundo} onChange={e => setFundo(e.target.value)} className={inp} style={inpS} placeholder="0,00" />
            </div>
            <button onClick={abrir} disabled={saving}
              className="w-full py-3 rounded-xl text-sm font-black"
              style={{ background: '#22c55e', color: 'white' }}>
              {saving ? 'Abrindo...' : '✓ Confirmar Abertura'}
            </button>
          </div>
        </div>
      )}

      {/* ── Modal Fechar ─────────────────────────────────────────────────────── */}
      {showFechar && caixa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between">
              <p className="font-black text-white text-lg">🔒 Fechar Caixa</p>
              <button onClick={() => setShowFechar(false)} style={{ color: 'var(--muted)' }}><X size={18} /></button>
            </div>
            <div className="p-3 rounded-xl space-y-2" style={{ background: 'var(--card2)' }}>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--muted)' }}>Total em vendas</span>
                <span className="font-bold text-white">{fmtMoeda(caixa.total_vendas)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--muted)' }}>Saldo teórico (dinheiro)</span>
                <span className="font-bold" style={{ color: '#22c55e' }}>{fmtMoeda(caixa.saldo_teorico_dinheiro)}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>DINHEIRO CONTADO (R$)</label>
              <input type="number" step="0.01" value={contado} onChange={e => setContado(e.target.value)}
                className={inp} style={inpS} placeholder={String(caixa.saldo_teorico_dinheiro)} autoFocus />
              {contado && (
                <p className="text-xs mt-1 font-bold"
                  style={{ color: Number(contado) - caixa.saldo_teorico_dinheiro >= 0 ? '#22c55e' : '#ef4444' }}>
                  {Number(contado) - caixa.saldo_teorico_dinheiro >= 0 ? 'Sobrou: ' : 'Faltou: '}
                  {fmtMoeda(Math.abs(Number(contado) - caixa.saldo_teorico_dinheiro))}
                </p>
              )}
            </div>
            <button onClick={fechar} disabled={saving}
              className="w-full py-3 rounded-xl text-sm font-black"
              style={{ background: '#ef4444', color: 'white' }}>
              {saving ? 'Fechando...' : '🔒 Confirmar Fechamento'}
            </button>
          </div>
        </div>
      )}

      {/* ── Modal Sangria / Suprimento ──────────────────────────────────────── */}
      {(showSangria || showSuprim) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="w-full max-w-xs rounded-2xl p-6 space-y-4" style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between">
              <p className="font-black text-white text-lg">{showSangria ? 'Sangria' : 'Suprimento'}</p>
              <button onClick={() => { setSangria(false); setSuprim(false) }} style={{ color: 'var(--muted)' }}><X size={18} /></button>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>VALOR (R$)</label>
              <input type="number" step="0.01" value={movVal} onChange={e => setMovVal(e.target.value)}
                className={inp} style={inpS} placeholder="0,00" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>OBSERVAÇÃO</label>
              <input value={movObs} onChange={e => setMovObs(e.target.value)} className={inp} style={inpS} placeholder="Motivo..." />
            </div>
            <button onClick={() => registrarMov(showSangria ? 'sangria' : 'suprimento')}
              disabled={saving || !movVal}
              className="w-full py-3 rounded-xl text-sm font-black"
              style={{ background: showSangria ? '#ef4444' : '#22c55e', color: 'white' }}>
              {saving ? 'Salvando...' : `Confirmar ${showSangria ? 'Sangria' : 'Suprimento'}`}
            </button>
          </div>
        </div>
      )}

      {/* ── Modal Cupons por Forma ──────────────────────────────────────────── */}
      {formaModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.88)' }}
          onClick={e => { if (e.target === e.currentTarget) setFormaModal(null) }}>
          <div className="w-full max-w-lg rounded-3xl flex flex-col overflow-hidden"
            style={{ background: 'var(--card)', maxHeight: '85vh' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                  style={{ background: (FORMA_COR[formaModal.forma] || '#f59e0b') + '20' }}>
                  {FORMA_ICONE[formaModal.forma] || '🔄'}
                </div>
                <div>
                  <p className="font-black text-white text-base">{formaModal.forma}</p>
                  <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
                    {formaModal.loading ? 'Carregando...' : `${formaModal.cupons.length} venda${formaModal.cupons.length !== 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>
              <button onClick={() => setFormaModal(null)} style={{ color: 'var(--muted)' }}><X size={20} /></button>
            </div>

            {/* Lista de cupons */}
            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              {formaModal.loading ? (
                <div className="flex items-center justify-center py-12" style={{ color: 'var(--muted)' }}>
                  <RefreshCw size={18} className="animate-spin mr-2" /> Carregando vendas...
                </div>
              ) : formaModal.cupons.length === 0 ? (
                <div className="text-center py-12" style={{ color: 'var(--muted)' }}>
                  <p className="text-3xl mb-2">🗂️</p>
                  <p className="font-bold text-white">Nenhuma venda encontrada</p>
                </div>
              ) : formaModal.cupons.map((c: any, idx: number) => (
                <div key={c.id || idx} className="rounded-xl p-3.5"
                  style={{ background: 'var(--card2)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black px-2 py-0.5 rounded-lg"
                        style={{ background: (FORMA_COR[formaModal.forma] || '#f59e0b') + '20', color: FORMA_COR[formaModal.forma] || '#f59e0b' }}>
                        #{c.numero}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>{c.hora}</span>
                      {c.cliente && <span className="text-xs font-bold text-white">{c.cliente}</span>}
                    </div>
                    <span className="font-black text-sm" style={{ color: FORMA_COR[formaModal.forma] || '#f59e0b' }}>
                      {fmtMoeda(c.total)}
                    </span>
                  </div>
                  {/* Itens */}
                  {(c.itens || []).length > 0 && (
                    <div className="mt-2 pt-2 space-y-1" style={{ borderTop: '1px solid var(--border)' }}>
                      {c.itens.map((it: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs" style={{ color: 'var(--muted)' }}>
                          <span>{it.quantidade}x {it.descricao}</span>
                          <span>{fmtMoeda(it.total_item)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer total */}
            {!formaModal.loading && formaModal.cupons.length > 0 && (
              <div className="px-6 py-3 flex justify-between items-center"
                style={{ borderTop: '1px solid var(--border)', background: 'var(--card2)' }}>
                <span className="text-xs font-bold" style={{ color: 'var(--muted)' }}>
                  {formaModal.cupons.length} venda{formaModal.cupons.length !== 1 ? 's' : ''}
                </span>
                <span className="font-black text-base" style={{ color: FORMA_COR[formaModal.forma] || '#f59e0b' }}>
                  {fmtMoeda(formaModal.cupons.reduce((s: number, c: any) => s + (c.total || 0), 0))}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
