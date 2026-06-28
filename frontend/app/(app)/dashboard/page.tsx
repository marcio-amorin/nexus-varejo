'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import api, { fmtMoeda } from '@/lib/api'
import {
  ShoppingCart, TrendingUp, TrendingDown, DollarSign,
  AlertTriangle, BarChart2, Star, RefreshCw, Package,
  CreditCard, ArrowUpRight, ArrowDownRight, Zap,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts'

interface DashData {
  hoje: { vendas: number; total: number; ticket_medio: number; pct_vs_ontem: number }
  mes: { vendas: number; total: number; lucro: number; margem: number }
  semana: { total: number; pct_vs_anterior: number }
  financeiro: {
    contas_pagar: number; contas_pagar_vencidas: number; contas_pagar_7dias: number
    contas_receber: number; contas_receber_vencidas: number
  }
  estoque: { total_produtos: number; abaixo_minimo: number; zerado: number }
  alertas: { tipo: string; icone: string; titulo: string; descricao: string; acao: string }[]
  grafico_vendas: { data: string; total: number }[]
  top_produtos: { produto: string; quantidade: number; total: number }[]
  formas_pagamento: { forma: string; total: number }[]
}

const FORMA_LABEL: Record<string, string> = {
  DINHEIRO: 'Dinheiro', CREDITO: 'Crédito', DEBITO: 'Débito',
  PIX: 'Pix', VOUCHER: 'Voucher', CREDIARIO: 'Crediário', CONVENIO: 'Convênio',
}

const FORMA_COLOR: Record<string, string> = {
  DINHEIRO: '#22c55e', CREDITO: '#3b82f6', DEBITO: '#8b5cf6',
  PIX: '#06b6d4', VOUCHER: '#f59e0b', CREDIARIO: '#f97316', CONVENIO: '#ec4899',
}

function Trend({ pct }: { pct: number }) {
  if (pct === 0) return <span className="text-[10px]" style={{ color: 'var(--muted)' }}>— igual</span>
  const up = pct > 0
  return (
    <span className="flex items-center gap-0.5 text-[10px] font-bold"
      style={{ color: up ? '#22c55e' : '#ef4444' }}>
      {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const r = await api.get('/dashboard/')
      setData(r.data)
      setLastUpdate(new Date())
    } catch {}
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(() => load(true), 60_000)
    return () => clearInterval(id)
  }, [load])

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: 'var(--muted)' }}>
      <Zap size={28} color="#f59e0b" className="animate-pulse" />
      <p className="text-sm">Carregando NexusVarejo...</p>
    </div>
  )
  if (!data) return (
    <div className="flex items-center justify-center h-full">
      <p className="text-sm" style={{ color: 'var(--muted)' }}>Sem dados disponíveis</p>
    </div>
  )

  const kpis = [
    {
      label: 'Vendas Hoje',
      value: fmtMoeda(data.hoje.total),
      sub: `${data.hoje.vendas} transações`,
      trend: <Trend pct={data.hoje.pct_vs_ontem} />,
      color: '#f59e0b',
      icon: ShoppingCart,
    },
    {
      label: 'Ticket Médio',
      value: fmtMoeda(data.hoje.ticket_medio),
      sub: 'por venda hoje',
      trend: null,
      color: '#ea580c',
      icon: TrendingUp,
    },
    {
      label: 'Vendas do Mês',
      value: fmtMoeda(data.mes.total),
      sub: `${data.mes.vendas} vendas`,
      trend: null,
      color: '#3b82f6',
      icon: BarChart2,
    },
    {
      label: 'Lucro do Mês',
      value: fmtMoeda(data.mes.lucro),
      sub: `Margem ${data.mes.margem.toFixed(1)}%`,
      trend: null,
      color: '#22c55e',
      icon: DollarSign,
    },
    {
      label: 'A Pagar',
      value: fmtMoeda(data.financeiro.contas_pagar),
      sub: data.financeiro.contas_pagar_vencidas > 0
        ? `⚠️ R$ ${(data.financeiro.contas_pagar_vencidas/1000).toFixed(1)}k vencido`
        : 'Em dia',
      trend: null,
      color: data.financeiro.contas_pagar_vencidas > 0 ? '#ef4444' : '#22c55e',
      icon: CreditCard,
    },
    {
      label: 'Estoque Crítico',
      value: String(data.estoque.zerado + data.estoque.abaixo_minimo),
      sub: `${data.estoque.zerado} zerado · ${data.estoque.abaixo_minimo} baixo`,
      trend: null,
      color: (data.estoque.zerado > 0) ? '#ef4444' : (data.estoque.abaixo_minimo > 0 ? '#f59e0b' : '#22c55e'),
      icon: Package,
    },
  ]

  const alertColor: Record<string, string> = {
    danger: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
  }

  const totalFormas = data.formas_pagamento.reduce((s, f) => s + f.total, 0)

  return (
    <div className="pg" style={{ gap: 10 }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="pg-header flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-base font-black text-white flex items-center gap-2">
            <Zap size={16} color="#f59e0b" />
            Dashboard Executivo
          </h1>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
              Atualizado {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button onClick={() => load(true)} disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity"
            style={{ background: '#1e2d40', color: 'var(--muted)', border: '1px solid var(--border)' }}>
            <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-6 gap-2 flex-shrink-0">
        {kpis.map(({ label, value, sub, trend, color, icon: Icon }) => (
          <div key={label} className="flex flex-col gap-1.5 p-3 rounded-xl relative overflow-hidden"
            style={{ background: 'var(--card)', border: `1px solid ${color}30` }}>
            <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-5"
              style={{ background: color, transform: 'translate(30%, -30%)' }} />
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>{label}</p>
              <div className="w-5 h-5 rounded-lg flex items-center justify-center" style={{ background: color + '20' }}>
                <Icon size={10} color={color} />
              </div>
            </div>
            <p className="text-lg font-black text-white leading-none">{value}</p>
            <div className="flex items-center justify-between">
              <p className="text-[10px]" style={{ color }}>{sub}</p>
              {trend}
            </div>
          </div>
        ))}
      </div>

      {/* ── Corpo Principal ────────────────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-12 gap-2 min-h-0">

        {/* Gráfico 30 dias — 8 cols */}
        <div className="col-span-8 rounded-xl flex flex-col p-3 min-h-0"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <BarChart2 size={13} color="#f59e0b" />
              <p className="font-bold text-white text-xs">Vendas — Últimos 30 dias</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: data.semana.pct_vs_anterior >= 0 ? '#22c55e20' : '#ef444420',
                  color: data.semana.pct_vs_anterior >= 0 ? '#22c55e' : '#ef4444' }}>
                Semana {data.semana.pct_vs_anterior >= 0 ? '+' : ''}{data.semana.pct_vs_anterior.toFixed(1)}% vs ant.
              </div>
              <span className="text-[10px] font-bold" style={{ color: '#f59e0b' }}>
                {fmtMoeda(data.semana.total)}
              </span>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            {data.grafico_vendas.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.grafico_vendas} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="data" tick={{ fill: '#64748b', fontSize: 8 }}
                    tickFormatter={d => d.slice(8)} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 8 }}
                    tickFormatter={v => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#0d1117', border: '1px solid #1e2d40', borderRadius: 8, fontSize: 11 }}
                    formatter={(v: any) => [fmtMoeda(v), 'Vendas']}
                    labelFormatter={l => `Dia ${l.slice(8)}`}
                  />
                  <Area type="monotone" dataKey="total" stroke="#f59e0b" strokeWidth={2} fill="url(#gv)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-2" style={{ color: 'var(--muted)' }}>
                <BarChart2 size={32} strokeWidth={1} />
                <p className="text-xs">Sem vendas nos últimos 30 dias</p>
              </div>
            )}
          </div>
        </div>

        {/* Alertas — 4 cols */}
        <div className="col-span-4 rounded-xl flex flex-col p-3 min-h-0"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-3 flex-shrink-0">
            <AlertTriangle size={13} color="#f59e0b" />
            <p className="font-bold text-white text-xs">Alertas</p>
            {data.alertas.length > 0 && (
              <span className="ml-auto w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black"
                style={{ background: '#ef4444', color: '#fff' }}>
                {data.alertas.length}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-auto space-y-2">
            {data.alertas.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-2" style={{ color: 'var(--muted)' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#22c55e20' }}>
                  <span className="text-lg">✓</span>
                </div>
                <p className="text-xs text-center">Tudo em ordem!</p>
                <p className="text-[10px] text-center">Nenhum alerta no momento</p>
              </div>
            ) : data.alertas.map((a, i) => (
              <button key={i} onClick={() => router.push(a.acao)}
                className="w-full text-left flex items-start gap-2.5 p-2.5 rounded-xl transition-opacity hover:opacity-80"
                style={{ background: alertColor[a.tipo] + '12', border: `1px solid ${alertColor[a.tipo]}30` }}>
                <span className="text-base leading-none mt-0.5">{a.icone}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{a.titulo}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: alertColor[a.tipo] }}>{a.descricao}</p>
                </div>
                <ArrowUpRight size={12} style={{ color: 'var(--muted)', flexShrink: 0, marginTop: 2 }} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Linha inferior ─────────────────────────────────────────────────── */}
      <div className="dash-bottom-row grid grid-cols-12 gap-2 flex-shrink-0" style={{ height: 160 }}>

        {/* Top Produtos — 5 cols */}
        <div className="col-span-5 rounded-xl p-3 overflow-hidden"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Star size={12} color="#f59e0b" />
            <p className="font-bold text-white text-xs">Top Produtos — Mês</p>
          </div>
          {data.top_produtos.length === 0 ? (
            <p className="text-xs text-center py-3" style={{ color: 'var(--muted)' }}>Sem dados</p>
          ) : (
            <div className="space-y-1.5">
              {data.top_produtos.slice(0, 4).map((p, i) => {
                const colors = ['#f59e0b', '#94a3b8', '#ea580c', '#64748b']
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs font-black w-4 text-center" style={{ color: colors[i] }}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{p.produto}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
                        {p.quantidade.toFixed(0)} un
                      </span>
                      <span className="text-xs font-bold" style={{ color: '#f59e0b' }}>
                        {fmtMoeda(p.total)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Formas de Pagamento — 4 cols */}
        <div className="col-span-4 rounded-xl p-3 overflow-hidden"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="font-bold text-white text-xs mb-2">Pagamentos do Mês</p>
          {data.formas_pagamento.length === 0 ? (
            <p className="text-xs text-center py-3" style={{ color: 'var(--muted)' }}>Sem dados</p>
          ) : (
            <div className="space-y-1.5">
              {data.formas_pagamento.slice(0, 4).map((f) => {
                const pct = totalFormas > 0 ? (f.total / totalFormas) * 100 : 0
                const cor = FORMA_COLOR[f.forma] || '#6366f1'
                return (
                  <div key={f.forma}>
                    <div className="flex justify-between items-center mb-0.5">
                      <p className="text-[10px] font-semibold" style={{ color: cor }}>
                        {FORMA_LABEL[f.forma] || f.forma}
                      </p>
                      <p className="text-[10px] font-bold text-white">{fmtMoeda(f.total)}</p>
                    </div>
                    <div className="h-1 rounded-full" style={{ background: 'var(--border)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: cor }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Resumo financeiro — 3 cols */}
        <div className="col-span-3 rounded-xl p-3"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="font-bold text-white text-xs mb-2">Posição Financeira</p>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-[10px]" style={{ color: 'var(--muted)' }}>A Receber</p>
              <p className="text-xs font-bold" style={{ color: '#22c55e' }}>
                {fmtMoeda(data.financeiro.contas_receber)}
              </p>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-[10px]" style={{ color: 'var(--muted)' }}>A Pagar</p>
              <p className="text-xs font-bold" style={{ color: '#ef4444' }}>
                {fmtMoeda(data.financeiro.contas_pagar)}
              </p>
            </div>
            <div className="h-px" style={{ background: 'var(--border)' }} />
            <div className="flex justify-between items-center">
              <p className="text-[10px] font-bold" style={{ color: 'var(--muted)' }}>Saldo</p>
              <p className="text-xs font-black"
                style={{ color: data.financeiro.contas_receber - data.financeiro.contas_pagar >= 0 ? '#22c55e' : '#ef4444' }}>
                {fmtMoeda(data.financeiro.contas_receber - data.financeiro.contas_pagar)}
              </p>
            </div>
            {data.financeiro.contas_pagar_7dias > 0 && (
              <p className="text-[9px]" style={{ color: '#f59e0b' }}>
                ⚡ {fmtMoeda(data.financeiro.contas_pagar_7dias)} vence em 7 dias
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
