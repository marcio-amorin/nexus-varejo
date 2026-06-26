'use client'
import { useState, useCallback } from 'react'
import api, { fmtMoeda } from '@/lib/api'
import {
  TrendingUp, TrendingDown, DollarSign, BarChart2,
  FileText, RefreshCw, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'

type Aba = 'fluxo' | 'dre'

const HOJE = new Date().toISOString().slice(0, 10)
const MES_INI = new Date().toISOString().slice(0, 8) + '01'

export default function FinanceiroPage() {
  const [aba, setAba]         = useState<Aba>('fluxo')
  const [dataIni, setIni]     = useState(MES_INI)
  const [dataFim, setFim]     = useState(HOJE)
  const [dados, setDados]     = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const gerar = useCallback(async () => {
    setLoading(true)
    try {
      const endpoint = aba === 'fluxo' ? '/relatorios/fluxo-caixa' : '/relatorios/dre-simplificado'
      const r = await api.get(endpoint, { params: { data_ini: dataIni, data_fim: dataFim } })
      setDados(r.data)
    } catch { setDados(null) }
    setLoading(false)
  }, [aba, dataIni, dataFim])

  const inp = 'px-3 py-1.5 text-xs rounded-lg outline-none'
  const inpStyle = { background: 'var(--input)', border: '1px solid var(--border)', color: 'white' }

  return (
    <div className="pg">
      {/* Header */}
      <div className="pg-header flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-base font-black text-white">Financeiro</h1>
            <p className="text-[10px]" style={{ color: 'var(--muted)' }}>Fluxo de Caixa e DRE</p>
          </div>
          <div className="flex gap-1 ml-2">
            {([['fluxo', '📊 Fluxo de Caixa'], ['dre', '📋 DRE']] as [Aba, string][]).map(([k, l]) => (
              <button key={k} onClick={() => { setAba(k); setDados(null) }}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold"
                style={{ background: aba === k ? '#f97316' : 'var(--card2)', color: aba === k ? 'white' : 'var(--muted)' }}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px]" style={{ color: 'var(--muted)' }}>De</span>
            <input type="date" value={dataIni} onChange={e => setIni(e.target.value)} className={inp} style={inpStyle} />
            <span className="text-[10px]" style={{ color: 'var(--muted)' }}>Até</span>
            <input type="date" value={dataFim} onChange={e => setFim(e.target.value)} className={inp} style={inpStyle} />
          </div>
          <button onClick={gerar} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: '#f97316', color: 'white' }}>
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Gerando...' : 'Gerar'}
          </button>
        </div>
      </div>

      <div className="pg-body flex flex-col gap-4">
        {!dados && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: 'var(--muted)' }}>
            <BarChart2 size={40} strokeWidth={1} />
            <p className="text-sm">Selecione o período e clique em Gerar</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center h-full" style={{ color: 'var(--muted)' }}>
            <RefreshCw size={20} className="animate-spin" />
          </div>
        )}

        {/* ── FLUXO DE CAIXA ──────────────────────────────────────────────── */}
        {dados && aba === 'fluxo' && (
          <div className="space-y-4">
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { l: 'Total Entradas', v: dados.total_entradas, c: '#22c55e', Icon: ArrowUpRight },
                { l: 'Total Saídas',   v: dados.total_saidas,   c: '#ef4444', Icon: ArrowDownRight },
                { l: 'Saldo do Período', v: dados.saldo_periodo, c: dados.saldo_periodo >= 0 ? '#22c55e' : '#ef4444', Icon: DollarSign },
              ].map(({ l, v, c, Icon }) => (
                <div key={l} className="p-4 rounded-xl" style={{ background: 'var(--card)', border: `1px solid ${c}30` }}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-bold uppercase" style={{ color: 'var(--muted)' }}>{l}</p>
                    <Icon size={14} color={c} />
                  </div>
                  <p className="text-xl font-black" style={{ color: c }}>{fmtMoeda(v)}</p>
                </div>
              ))}
            </div>

            {/* Gráfico */}
            <div className="p-4 rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <p className="font-bold text-white text-xs mb-3">Entradas × Saídas por Dia</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dados.fluxo} margin={{ left: 0, right: 0 }}>
                  <XAxis dataKey="data" tick={{ fill: '#64748b', fontSize: 8 }} tickFormatter={d => d.slice(8)} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 8 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#0d1117', border: '1px solid #1e2d40', borderRadius: 8, fontSize: 11 }}
                    formatter={(v: any, name: string) => [fmtMoeda(v), name === 'entradas' ? 'Entradas' : 'Saídas']}
                    labelFormatter={l => `Dia ${l.slice(8)}`}
                  />
                  <Bar dataKey="entradas" fill="#22c55e" opacity={0.8} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="saidas"   fill="#ef4444" opacity={0.8} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Saldo acumulado */}
            <div className="p-4 rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <p className="font-bold text-white text-xs mb-3">Saldo Acumulado</p>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={dados.fluxo}>
                  <defs>
                    <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="data" tick={{ fill: '#64748b', fontSize: 8 }} tickFormatter={d => d.slice(8)} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 8 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                  <ReferenceLine y={0} stroke="#ef444460" strokeDasharray="4 2" />
                  <Tooltip
                    contentStyle={{ background: '#0d1117', border: '1px solid #1e2d40', borderRadius: 8, fontSize: 11 }}
                    formatter={(v: any) => [fmtMoeda(v), 'Saldo']}
                    labelFormatter={l => `Dia ${l.slice(8)}`}
                  />
                  <Area type="monotone" dataKey="saldo_acumulado" stroke="#22c55e" strokeWidth={2} fill="url(#sg)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Tabela diária */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    {['Data', 'Entradas', 'Saídas', 'Saldo Dia', 'Saldo Acumulado'].map(h => <th key={h}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {dados.fluxo.filter((f: any) => f.entradas > 0 || f.saidas > 0).map((f: any) => (
                    <tr key={f.data}>
                      <td className="font-mono text-xs" style={{ color: 'var(--muted)' }}>{f.data.split('-').reverse().join('/')}</td>
                      <td className="font-bold" style={{ color: '#22c55e' }}>{fmtMoeda(f.entradas)}</td>
                      <td className="font-bold" style={{ color: '#ef4444' }}>{fmtMoeda(f.saidas)}</td>
                      <td className="font-bold" style={{ color: f.saldo_dia >= 0 ? '#22c55e' : '#ef4444' }}>{fmtMoeda(f.saldo_dia)}</td>
                      <td className="font-black" style={{ color: f.saldo_acumulado >= 0 ? '#22c55e' : '#ef4444' }}>{fmtMoeda(f.saldo_acumulado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── DRE ─────────────────────────────────────────────────────────── */}
        {dados && aba === 'dre' && (
          <div className="max-w-2xl mx-auto w-full space-y-2">
            {/* Cabeçalho */}
            <div className="p-4 rounded-xl text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <p className="text-sm font-black text-white">DRE — Demonstração do Resultado</p>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                {dados.periodo.ini.split('-').reverse().join('/')} até {dados.periodo.fim.split('-').reverse().join('/')}
              </p>
              <div className="flex justify-center gap-6 mt-2">
                <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{dados.total_vendas} vendas</span>
                <span className="text-[10px]" style={{ color: 'var(--muted)' }}>Ticket médio: {fmtMoeda(dados.ticket_medio)}</span>
              </div>
            </div>

            {/* Linhas do DRE */}
            {[
              { label: 'Receita Bruta de Vendas',         value: dados.receita_bruta,          color: '#22c55e', indent: 0, bold: true },
              { label: '(-) Descontos Concedidos',        value: -dados.descontos,              color: '#ef4444', indent: 1, bold: false },
              { label: '(=) Receita Líquida',             value: dados.receita_liquida,         color: '#3b82f6', indent: 0, bold: true, sep: true },
              { label: '(-) Custo das Mercadorias (CMV)', value: -dados.custo_mercadorias,      color: '#ef4444', indent: 1, bold: false },
              { label: '(=) Lucro Bruto',                 value: dados.lucro_bruto,             color: '#22c55e', indent: 0, bold: true, sep: true,
                pct: dados.margem_bruta },
              { label: '(-) Despesas Operacionais',       value: -dados.despesas_operacionais,  color: '#ef4444', indent: 1, bold: false },
              { label: '(=) Lucro Operacional (LAJIR)',   value: dados.lucro_operacional,       color: dados.lucro_operacional >= 0 ? '#22c55e' : '#ef4444', indent: 0, bold: true, sep: true,
                pct: dados.margem_operacional },
            ].map((row, i) => (
              <div key={i}>
                {row.sep && <div className="h-px my-1" style={{ background: 'var(--border)' }} />}
                <div className="flex items-center justify-between px-4 py-2 rounded-xl"
                  style={{ background: row.bold ? 'var(--card)' : 'transparent', border: row.bold ? '1px solid var(--border)' : 'none' }}>
                  <p className={`text-xs ${row.bold ? 'font-black text-white' : 'font-medium'}`}
                    style={{ paddingLeft: row.indent * 16, color: row.bold ? 'white' : 'var(--muted)' }}>
                    {row.label}
                  </p>
                  <div className="flex items-center gap-3">
                    {row.pct !== undefined && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: row.color + '20', color: row.color }}>
                        {row.pct.toFixed(1)}%
                      </span>
                    )}
                    <p className={`text-sm ${row.bold ? 'font-black' : 'font-semibold'}`} style={{ color: row.color }}>
                      {fmtMoeda(Math.abs(row.value))}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {/* Margem visual */}
            <div className="p-4 rounded-xl mt-2" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-bold text-white mb-3">Composição da Receita</p>
              <div className="space-y-2">
                {[
                  { l: 'CMV', v: dados.custo_mercadorias, t: dados.receita_liquida, c: '#ef4444' },
                  { l: 'Despesas', v: dados.despesas_operacionais, t: dados.receita_liquida, c: '#f97316' },
                  { l: 'Lucro', v: dados.lucro_operacional, t: dados.receita_liquida, c: '#22c55e' },
                ].map(({ l, v, t, c }) => {
                  const pct = t > 0 ? Math.max(0, (v / t) * 100) : 0
                  return (
                    <div key={l}>
                      <div className="flex justify-between mb-0.5">
                        <p className="text-[10px] font-bold" style={{ color: c }}>{l}</p>
                        <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{pct.toFixed(1)}%</p>
                      </div>
                      <div className="h-2 rounded-full" style={{ background: 'var(--border)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
