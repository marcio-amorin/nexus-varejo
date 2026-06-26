'use client'
import { useEffect, useState, useCallback } from 'react'
import api, { fmtMoeda } from '@/lib/api'
import {
  DollarSign, TrendingDown, TrendingUp, X, Plus,
  Lock, Unlock, AlertTriangle, CheckCircle, RefreshCw,
  CreditCard, Banknote, Smartphone,
} from 'lucide-react'

export default function CaixaPage() {
  const [status, setStatus]   = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  // Modais
  const [showAbrir, setShowAbrir]   = useState(false)
  const [showFechar, setShowFechar] = useState(false)
  const [showSangria, setSangria]   = useState(false)
  const [showSuprim, setSuprim]     = useState(false)

  // Forms
  const [fundo, setFundo]             = useState('')
  const [terminal, setTerminal]       = useState('CAIXA-01')
  const [totalContado, setContado]    = useState('')
  const [movValor, setMovValor]       = useState('')
  const [movObs, setMovObs]           = useState('')

  const load = useCallback(async () => {
    try {
      const r = await api.get('/caixa/status')
      setStatus(r.data)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function abrir() {
    setSaving(true)
    try {
      await api.post('/caixa/abrir', { terminal, fundo_caixa: Number(fundo) || 0 })
      setShowAbrir(false); setFundo(''); load()
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro') }
    setSaving(false)
  }

  async function fechar() {
    setSaving(true)
    try {
      await api.post('/caixa/fechar', { total_contado: totalContado ? Number(totalContado) : null })
      setShowFechar(false); setContado(''); load()
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro') }
    setSaving(false)
  }

  async function registrarMov(tipo: 'sangria' | 'suprimento') {
    if (!movValor || Number(movValor) <= 0) return
    setSaving(true)
    try {
      await api.post(`/caixa/${tipo}`, { valor: Number(movValor), observacao: movObs })
      setSangria(false); setSuprim(false); setMovValor(''); setMovObs(''); load()
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro') }
    setSaving(false)
  }

  const inp = 'w-full px-3 py-2.5 text-sm rounded-xl outline-none'
  const inpStyle = { background: 'var(--input)', border: '1px solid var(--border)', color: 'white' }
  const caixa = status?.caixa

  if (loading) return (
    <div className="flex items-center justify-center h-full" style={{ color: 'var(--muted)' }}>
      <RefreshCw size={20} className="animate-spin" />
    </div>
  )

  return (
    <div className="pg">
      {/* Header */}
      <div className="pg-header flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-base font-black text-white">Fechamento de Caixa</h1>
          <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
            Abertura, sangria, suprimento e fechamento
          </p>
        </div>
        <button onClick={load} className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--card2)', color: 'var(--muted)' }}>
          <RefreshCw size={13} />
        </button>
      </div>

      <div className="pg-body flex flex-col gap-4">

        {/* ── Status do Caixa ─────────────────────────────────────────────── */}
        <div className="rounded-2xl p-5" style={{
          background: status?.aberto ? 'var(--card)' : 'var(--card)',
          border: `2px solid ${status?.aberto ? '#22c55e40' : '#ef444440'}`
        }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: status?.aberto ? '#22c55e20' : '#ef444420' }}>
                {status?.aberto ? <Unlock size={18} color="#22c55e" /> : <Lock size={18} color="#ef4444" />}
              </div>
              <div>
                <p className="font-black text-white">
                  {status?.aberto ? `Caixa Aberto — ${caixa?.terminal}` : 'Caixa Fechado'}
                </p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  {status?.aberto
                    ? `Aberto às ${new Date(caixa?.aberto_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                    : 'Nenhum caixa aberto no momento'}
                </p>
              </div>
            </div>
            {!status?.aberto ? (
              <button onClick={() => setShowAbrir(true)}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-black"
                style={{ background: '#22c55e', color: 'white' }}>
                <Unlock size={14} /> Abrir Caixa
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setSangria(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold"
                  style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444430' }}>
                  <TrendingDown size={12} /> Sangria
                </button>
                <button onClick={() => setSuprim(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold"
                  style={{ background: '#22c55e20', color: '#22c55e', border: '1px solid #22c55e30' }}>
                  <TrendingUp size={12} /> Suprimento
                </button>
                <button onClick={() => setShowFechar(true)}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-black"
                  style={{ background: '#ef4444', color: 'white' }}>
                  <Lock size={14} /> Fechar Caixa
                </button>
              </div>
            )}
          </div>

          {/* Métricas do caixa aberto */}
          {status?.aberto && caixa && (
            <div className="grid grid-cols-4 gap-3 mt-2">
              {[
                { l: 'Total Vendas', v: caixa.total_vendas, c: '#22c55e', sub: `${caixa.qtd_vendas} vendas` },
                { l: 'Fundo de Caixa', v: caixa.fundo_caixa, c: '#f59e0b', sub: 'abertura' },
                { l: 'Sangria', v: caixa.total_sangria, c: '#ef4444', sub: 'retiradas' },
                { l: 'Saldo Dinheiro', v: caixa.saldo_teorico_dinheiro, c: '#3b82f6', sub: 'teórico' },
              ].map(({ l, v, c, sub }) => (
                <div key={l} className="p-3 rounded-xl" style={{ background: 'var(--card2)', border: `1px solid ${c}20` }}>
                  <p className="text-[9px] font-bold uppercase mb-1" style={{ color: 'var(--muted)' }}>{l}</p>
                  <p className="text-base font-black" style={{ color: c }}>{fmtMoeda(v)}</p>
                  <p className="text-[9px]" style={{ color: 'var(--muted)' }}>{sub}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Formas de Pagamento ─────────────────────────────────────────── */}
        {status?.aberto && caixa && Object.keys(caixa.por_forma).length > 0 && (
          <div className="rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <p className="font-bold text-white text-xs mb-3">Vendas por Forma de Pagamento</p>
            <div className="grid grid-cols-5 gap-2">
              {Object.entries(caixa.por_forma).map(([forma, valor]: any) => {
                const icons: Record<string, any> = {
                  DINHEIRO: Banknote, PIX: Smartphone, CREDITO: CreditCard, DEBITO: CreditCard,
                }
                const colors: Record<string, string> = {
                  DINHEIRO: '#22c55e', PIX: '#06b6d4', CREDITO: '#3b82f6', DEBITO: '#8b5cf6',
                }
                const Icon = icons[forma] || DollarSign
                const cor  = colors[forma] || '#f59e0b'
                return (
                  <div key={forma} className="p-3 rounded-xl text-center"
                    style={{ background: cor + '12', border: `1px solid ${cor}25` }}>
                    <Icon size={16} color={cor} className="mx-auto mb-1" />
                    <p className="text-[9px] font-bold uppercase" style={{ color: cor }}>{forma.replace('_', ' ')}</p>
                    <p className="text-sm font-black" style={{ color: cor }}>{fmtMoeda(valor)}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Movimentos do Caixa ─────────────────────────────────────────── */}
        {status?.aberto && caixa?.movimentos?.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <div className="px-4 py-2" style={{ background: 'var(--card2)' }}>
              <p className="text-[10px] font-black" style={{ color: 'var(--muted)' }}>MOVIMENTOS DO CAIXA</p>
            </div>
            {caixa.movimentos.map((m: any, i: number) => {
              const isSangria = m.tipo === 'SANGRIA'
              const isAbertura = m.tipo === 'ABERTURA'
              return (
                <div key={i} className="flex items-center justify-between px-4 py-2.5"
                  style={{ borderTop: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center"
                      style={{ background: isSangria ? '#ef444420' : '#22c55e20' }}>
                      {isSangria ? <TrendingDown size={12} color="#ef4444" /> : <TrendingUp size={12} color="#22c55e" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">{m.tipo}</p>
                      <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{m.observacao}</p>
                    </div>
                  </div>
                  <p className="text-sm font-black"
                    style={{ color: isSangria ? '#ef4444' : '#22c55e' }}>
                    {isSangria ? '-' : '+'}{fmtMoeda(m.valor)}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Modal Abrir Caixa ──────────────────────────────────────────────── */}
      {showAbrir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between">
              <p className="font-black text-white text-lg">Abrir Caixa</p>
              <button onClick={() => setShowAbrir(false)} style={{ color: 'var(--muted)' }}><X size={18} /></button>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>TERMINAL</label>
              <input value={terminal} onChange={e => setTerminal(e.target.value)} className={inp} style={inpStyle} placeholder="CAIXA-01" />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>FUNDO DE CAIXA (R$)</label>
              <input type="number" step="0.01" value={fundo} onChange={e => setFundo(e.target.value)}
                className={inp} style={inpStyle} placeholder="0,00" />
              <p className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>Valor em dinheiro contado antes de iniciar as vendas</p>
            </div>
            <button onClick={abrir} disabled={saving}
              className="w-full py-3 rounded-xl text-sm font-black"
              style={{ background: '#22c55e', color: 'white' }}>
              {saving ? 'Abrindo...' : '✓ Confirmar Abertura'}
            </button>
          </div>
        </div>
      )}

      {/* ── Modal Fechar Caixa ─────────────────────────────────────────────── */}
      {showFechar && caixa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between">
              <p className="font-black text-white text-lg">Fechar Caixa</p>
              <button onClick={() => setShowFechar(false)} style={{ color: 'var(--muted)' }}><X size={18} /></button>
            </div>
            <div className="p-3 rounded-xl space-y-1.5" style={{ background: 'var(--card2)' }}>
              <div className="flex justify-between">
                <span className="text-xs" style={{ color: 'var(--muted)' }}>Total em vendas</span>
                <span className="text-xs font-bold text-white">{fmtMoeda(caixa.total_vendas)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs" style={{ color: 'var(--muted)' }}>Saldo teórico (dinheiro)</span>
                <span className="text-xs font-bold" style={{ color: '#22c55e' }}>{fmtMoeda(caixa.saldo_teorico_dinheiro)}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>TOTAL CONTADO (R$) — opcional</label>
              <input type="number" step="0.01" value={totalContado} onChange={e => setContado(e.target.value)}
                className={inp} style={inpStyle} placeholder={String(caixa.saldo_teorico_dinheiro)} />
              {totalContado && (
                <p className="text-[10px] mt-1 font-bold"
                  style={{ color: Number(totalContado) - caixa.saldo_teorico_dinheiro >= 0 ? '#22c55e' : '#ef4444' }}>
                  Diferença: {fmtMoeda(Number(totalContado) - caixa.saldo_teorico_dinheiro)}
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

      {/* ── Modal Sangria / Suprimento ─────────────────────────────────────── */}
      {(showSangria || showSuprim) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="w-full max-w-xs rounded-2xl p-6 space-y-4" style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between">
              <p className="font-black text-white text-lg">{showSangria ? 'Sangria' : 'Suprimento'}</p>
              <button onClick={() => { setSangria(false); setSuprim(false) }} style={{ color: 'var(--muted)' }}><X size={18} /></button>
            </div>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {showSangria ? 'Retirada de dinheiro do caixa' : 'Adição de dinheiro ao caixa'}
            </p>
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>VALOR (R$)</label>
              <input type="number" step="0.01" value={movValor} onChange={e => setMovValor(e.target.value)}
                className={inp} style={inpStyle} placeholder="0,00" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>OBSERVAÇÃO</label>
              <input value={movObs} onChange={e => setMovObs(e.target.value)}
                className={inp} style={inpStyle} placeholder="Motivo..." />
            </div>
            <button
              onClick={() => registrarMov(showSangria ? 'sangria' : 'suprimento')}
              disabled={saving || !movValor}
              className="w-full py-3 rounded-xl text-sm font-black"
              style={{ background: showSangria ? '#ef4444' : '#22c55e', color: 'white' }}>
              {saving ? 'Salvando...' : `Confirmar ${showSangria ? 'Sangria' : 'Suprimento'}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
