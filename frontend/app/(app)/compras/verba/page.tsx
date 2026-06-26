'use client'
import { useEffect, useState } from 'react'
import api from '@/lib/api'

type Verba = {
  id?: number; mes: string; valor_definido: number; percentual_faturamento: number
  aprovado_por?: string; observacoes?: string; gasto_mes: number; saldo: number
  pct_utilizado: number; faturamento_mes: number; status: string
}

const inp = 'w-full rounded-lg px-2.5 py-1.5 text-xs outline-none'
const s   = { background:'var(--input)', border:'1px solid var(--border)', color:'var(--text)' }
const R   = (v: number) => v.toLocaleString('pt-BR', { style:'currency', currency:'BRL' })

export default function VerbaComprasPage() {
  const [atual, setAtual]   = useState<Verba | null>(null)
  const [lista, setLista]   = useState<Verba[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ mes: '', valor_definido: 0, percentual_faturamento: 70, aprovado_por: '', observacoes: '' })
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [a, l] = await Promise.all([api.get('/verba-compras/atual'), api.get('/verba-compras/')])
      setAtual(a.data); setLista(l.data)
    } finally { setLoading(false) }
  }

  function novaVerba() {
    const hoje = new Date()
    const mes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
    setForm({ mes, valor_definido: 0, percentual_faturamento: 70, aprovado_por: '', observacoes: '' })
    setShowForm(true)
  }

  async function salvar() {
    await api.post('/verba-compras/', form)
    setShowForm(false); load()
  }

  function statusCor(s: string) {
    if (s === 'ESTOURADO') return '#EF4444'
    if (s === 'ALERTA') return '#F97316'
    if (s === 'SEM_VERBA') return '#6B7280'
    return '#34C759'
  }

  function barCor(pct: number) {
    if (pct > 100) return '#EF4444'
    if (pct > 80) return '#F97316'
    return '#34C759'
  }

  const nomeMes = (mes: string) => {
    const [y, m] = mes.split('-')
    return new Date(+y, +m - 1, 1).toLocaleDateString('pt-BR', { month:'long', year:'numeric' })
  }

  return (
    <div className="h-full overflow-auto p-3 space-y-3" style={{ background:'var(--bg)' }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-black" style={{ color:'var(--text)' }}>💰 VERBA DE COMPRAS</h1>
          <p className="text-[10px]" style={{ color:'var(--muted)' }}>Controle de orçamento mensal de compras</p>
        </div>
        <button onClick={novaVerba}
          className="px-3 py-1.5 rounded-lg text-[11px] font-black"
          style={{ background:'#F97316', color:'white' }}>
          + Definir Verba
        </button>
      </div>

      {/* Card Mês Atual */}
      {atual && (
        <div className="rounded-xl overflow-hidden" style={{ background:'var(--card)', border:`2px solid ${statusCor(atual.status)}` }}>
          <div className="px-4 py-2.5 flex items-center justify-between" style={{ background:'var(--card2)' }}>
            <div>
              <p className="text-[10px] font-bold" style={{ color:'var(--muted)' }}>MÊS ATUAL — {nomeMes(atual.mes).toUpperCase()}</p>
              <p className="text-xs font-black" style={{ color:'var(--text)' }}>Verba Mensal de Compras</p>
            </div>
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
              style={{ background: statusCor(atual.status) + '22', color: statusCor(atual.status) }}>
              {atual.status}
            </span>
          </div>
          <div className="p-4 space-y-3">
            {/* Barra de progresso */}
            <div>
              <div className="flex justify-between text-[10px] mb-1">
                <span style={{ color:'var(--muted)' }}>Utilizado: {R(atual.gasto_mes)} de {R(atual.valor_definido)}</span>
                <span className="font-bold" style={{ color: barCor(atual.pct_utilizado) }}>{atual.pct_utilizado}%</span>
              </div>
              <div className="h-2 rounded-full" style={{ background:'var(--border)' }}>
                <div className="h-2 rounded-full transition-all" style={{
                  width: `${Math.min(100, atual.pct_utilizado)}%`,
                  background: barCor(atual.pct_utilizado)
                }} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl p-2.5 text-center" style={{ background:'var(--card2)' }}>
                <p className="text-[9px]" style={{ color:'var(--muted)' }}>VERBA DEFINIDA</p>
                <p className="text-sm font-black" style={{ color:'var(--text)' }}>{R(atual.valor_definido)}</p>
              </div>
              <div className="rounded-xl p-2.5 text-center" style={{ background:'var(--card2)' }}>
                <p className="text-[9px]" style={{ color:'var(--muted)' }}>GASTO NO MÊS</p>
                <p className="text-sm font-black" style={{ color:'#F97316' }}>{R(atual.gasto_mes)}</p>
              </div>
              <div className="rounded-xl p-2.5 text-center" style={{ background:'var(--card2)' }}>
                <p className="text-[9px]" style={{ color:'var(--muted)' }}>SALDO DISPONÍVEL</p>
                <p className="text-sm font-black" style={{ color: atual.saldo >= 0 ? '#34C759' : '#EF4444' }}>
                  {R(atual.saldo)}
                </p>
              </div>
            </div>
            <div className="flex justify-between text-[10px] px-1">
              <span style={{ color:'var(--muted)' }}>Faturamento do mês: <span style={{ color:'var(--text)', fontWeight:700 }}>{R(atual.faturamento_mes)}</span></span>
              <span style={{ color:'var(--muted)' }}>{atual.percentual_faturamento}% do faturamento</span>
            </div>
          </div>
        </div>
      )}

      {/* Histórico */}
      {lista.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
          <div className="px-3 py-2" style={{ background:'var(--card2)' }}>
            <p className="text-[10px] font-black" style={{ color:'var(--muted)' }}>HISTÓRICO DE VERBAS</p>
          </div>
          <table className="w-full text-[10px]">
            <thead>
              <tr style={{ background:'var(--card2)' }}>
                {['Mês','Verba Definida','Gasto','Saldo','% Utilizado','Status'].map(h => (
                  <th key={h} className="px-3 py-1.5 text-left font-bold" style={{ color:'var(--muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((v, i) => (
                <tr key={v.id} style={{ borderTop:'1px solid var(--border)', background: i%2===0 ? 'transparent' : 'var(--card2)' }}>
                  <td className="px-3 py-2 font-bold" style={{ color:'var(--text)' }}>{nomeMes(v.mes)}</td>
                  <td className="px-3 py-2" style={{ color:'var(--text)' }}>{R(v.valor_definido)}</td>
                  <td className="px-3 py-2" style={{ color:'#F97316' }}>{R(v.gasto_mes)}</td>
                  <td className="px-3 py-2 font-bold" style={{ color: v.saldo >= 0 ? '#34C759' : '#EF4444' }}>{R(v.saldo)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1.5 rounded-full" style={{ background:'var(--border)' }}>
                        <div className="h-1.5 rounded-full" style={{ width:`${Math.min(100,v.pct_utilizado)}%`, background: barCor(v.pct_utilizado) }} />
                      </div>
                      <span style={{ color: barCor(v.pct_utilizado) }}>{v.pct_utilizado}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                      style={{ background: statusCor(v.status) + '22', color: statusCor(v.status) }}>
                      {v.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
            <div className="px-4 py-3 flex justify-between items-center" style={{ background:'var(--card2)', borderBottom:'1px solid var(--border)' }}>
              <h2 className="text-sm font-black" style={{ color:'var(--text)' }}>💰 Definir Verba de Compras</h2>
              <button onClick={() => setShowForm(false)} style={{ color:'var(--muted)' }}>✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>MÊS DE REFERÊNCIA</label>
                <input type="month" value={form.mes} onChange={e => setForm(f => ({ ...f, mes: e.target.value }))}
                  className={inp} style={s} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>VALOR DA VERBA (R$)</label>
                  <input type="number" value={form.valor_definido} onChange={e => setForm(f => ({ ...f, valor_definido: +e.target.value }))}
                    className={inp} style={s} min={0} step={100} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>% DO FATURAMENTO</label>
                  <input type="number" value={form.percentual_faturamento} onChange={e => setForm(f => ({ ...f, percentual_faturamento: +e.target.value }))}
                    className={inp} style={s} min={0} max={100} step={5} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>APROVADO POR</label>
                <input value={form.aprovado_por} onChange={e => setForm(f => ({ ...f, aprovado_por: e.target.value }))}
                  className={inp} style={s} placeholder="Nome do responsável" />
              </div>
              <div>
                <label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>OBSERVAÇÕES</label>
                <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                  className={inp} style={s} rows={2} />
              </div>
              <button onClick={salvar} className="w-full py-2 rounded-xl text-xs font-black"
                style={{ background:'#F97316', color:'white' }}>
                Salvar Verba
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
