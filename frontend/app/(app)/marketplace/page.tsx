'use client'
import { useEffect, useState } from 'react'
import api, { fmtMoeda } from '@/lib/api'
import { BarChart2, Package, TrendingUp, Calendar, RefreshCw, FileText, Printer } from 'lucide-react'

const PLATS = [
  { key: 'MERCADOLIVRE', nome: 'Mercado Livre', cor: '#FFE600', ct: '#333', emoji: '🛒' },
  { key: 'SHOPEE',       nome: 'Shopee',         cor: '#EE4D2D', ct: '#FFF', emoji: '🛍️' },
  { key: 'ZEDELIVERY',   nome: 'Zé Delivery',    cor: '#FFB800', ct: '#333', emoji: '🍺' },
  { key: 'IFOOD',        nome: 'iFood Mercado',   cor: '#EA1D2C', ct: '#FFF', emoji: '🍔' },
]

const PERIODOS = [
  { k: 'DIA',     label: 'Hoje' },
  { k: 'MES',     label: 'Este Mês' },
  { k: 'ANO',     label: 'Este Ano' },
  { k: 'PERIODO', label: 'Período' },
]

const STATUS_LABEL: Record<string, string> = {
  NOVO: 'Novo', EM_PREPARACAO: 'Separação', PRONTO: 'Pronto',
  ENVIADO: 'Enviado', ENTREGUE: 'Entregue', CANCELADO: 'Cancelado',
}
const STATUS_COR: Record<string, string> = {
  NOVO: '#3B82F6', EM_PREPARACAO: '#F59E0B', PRONTO: '#22C55E',
  ENVIADO: '#8B5CF6', ENTREGUE: '#22C55E', CANCELADO: '#EF4444',
}

export default function PainelMarketplacePage() {
  const [periodo,    setPeriodo]    = useState('MES')
  const [dtIni,      setDtIni]      = useState('')
  const [dtFim,      setDtFim]      = useState('')
  const [painel,     setPainel]     = useState<any>(null)
  const [relatorio,  setRelatorio]  = useState<any>(null)
  const [loading,    setLoading]    = useState(true)
  const [abaRel,     setAbaRel]     = useState<'plataforma'|'dia'>('plataforma')
  const [showRel,    setShowRel]    = useState(false)

  async function load() {
    setLoading(true)
    try {
      const params: any = { periodo }
      if (periodo === 'PERIODO' && dtIni && dtFim) {
        params.data_inicio = dtIni; params.data_fim = dtFim
      }
      const [rp, rr] = await Promise.all([
        api.get('/marketplace/painel',    { params }),
        api.get('/marketplace/relatorio', { params }),
      ])
      setPainel(rp.data); setRelatorio(rr.data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [periodo])

  function imprimirRelatorio() {
    const w = window.open('', '_blank', 'width=900,height=700')
    if (!w || !relatorio) return
    const linhas = relatorio.por_dia.map((d: any) =>
      `<tr><td>${new Date(d.data+'T12:00').toLocaleDateString('pt-BR')}</td>
       <td style="text-align:center">${d.pedidos}</td>
       <td style="text-align:right">${fmtMoeda(d.valor)}</td></tr>`
    ).join('')
    const plats = relatorio.por_plataforma.map((p: any) =>
      `<tr><td>${p.nome}</td><td style="text-align:center">${p.pedidos}</td>
       <td style="text-align:right">${fmtMoeda(p.valor)}</td></tr>`
    ).join('')
    w.document.write(`<html><head><title>Relatório Marketplace</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;color:#111}
    h2{color:#F97316}table{width:100%;border-collapse:collapse;margin:16px 0}
    th,td{padding:8px 12px;border:1px solid #ddd;font-size:13px}
    th{background:#f3f4f6;font-weight:700}
    .total{font-weight:700;background:#FFF7ED;color:#F97316}
    @media print{button{display:none}}</style></head><body>
    <h2>📊 Relatório Marketplace</h2>
    <p>Período: <strong>${relatorio.periodo?.inicio}</strong> a <strong>${relatorio.periodo?.fim}</strong></p>
    <p>Total de pedidos: <strong>${relatorio.total_pedidos}</strong> ·
       Total faturado: <strong>${fmtMoeda(relatorio.total_valor)}</strong></p>
    <h3>Por Plataforma</h3>
    <table><thead><tr><th>Plataforma</th><th>Pedidos</th><th>Faturamento</th></tr></thead>
    <tbody>${plats}</tbody></table>
    <h3>Por Dia</h3>
    <table><thead><tr><th>Data</th><th>Pedidos</th><th>Faturamento</th></tr></thead>
    <tbody>${linhas}</tbody>
    <tr class="total"><td>TOTAL</td><td style="text-align:center">${relatorio.total_pedidos}</td>
    <td style="text-align:right">${fmtMoeda(relatorio.total_valor)}</td></tr>
    </table>
    <button onclick="window.print()">🖨️ Imprimir</button>
    </body></html>`)
    w.document.close(); w.focus()
    setTimeout(() => w.print(), 400)
  }

  const totalPedidos = painel?.total_pedidos || 0
  const totalValor   = painel?.total_valor   || 0

  return (
    <div className="pg">
      <div className="pg-header flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-base font-black text-white flex items-center gap-2">
            <BarChart2 size={18} color="#F97316" /> Painel Marketplace
          </h1>
          <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
            Visão consolidada de vendas por plataforma
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Seletor período */}
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {PERIODOS.map(p => (
              <button key={p.k} onClick={() => setPeriodo(p.k)}
                className="px-3 py-1.5 text-xs font-bold"
                style={{ background: periodo === p.k ? '#F97316' : 'var(--card)', color: periodo === p.k ? 'white' : 'var(--muted)' }}>
                {p.label}
              </button>
            ))}
          </div>
          {periodo === 'PERIODO' && (
            <div className="flex items-center gap-1">
              <input type="date" value={dtIni} onChange={e => setDtIni(e.target.value)}
                className="px-2 py-1.5 text-xs rounded-lg" style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'white' }} />
              <span className="text-xs" style={{ color: 'var(--muted)' }}>até</span>
              <input type="date" value={dtFim} onChange={e => setDtFim(e.target.value)}
                className="px-2 py-1.5 text-xs rounded-lg" style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'white' }} />
            </div>
          )}
          <button onClick={load}
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={imprimirRelatorio}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
            style={{ background: 'rgba(249,115,22,0.15)', color: '#F97316', border: '1px solid rgba(249,115,22,0.3)' }}>
            <Printer size={12} /> Relatório
          </button>
        </div>
      </div>

      {/* KPIs topo */}
      <div className="pg-stats grid grid-cols-2 gap-2">
        <div className="rounded-xl p-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="text-[10px] font-bold mb-0.5" style={{ color: 'var(--muted)' }}>TOTAL PEDIDOS</p>
          <p className="text-2xl font-black" style={{ color: '#F97316' }}>{totalPedidos}</p>
          <p className="text-[10px]" style={{ color: 'var(--muted)' }}>no período selecionado</p>
        </div>
        <div className="rounded-xl p-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="text-[10px] font-bold mb-0.5" style={{ color: 'var(--muted)' }}>TOTAL FATURADO</p>
          <p className="text-2xl font-black" style={{ color: '#22C55E' }}>{fmtMoeda(totalValor)}</p>
          <p className="text-[10px]" style={{ color: 'var(--muted)' }}>todas as plataformas</p>
        </div>
      </div>

      {/* Cards por plataforma */}
      <div className="grid grid-cols-4 gap-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl p-3 animate-pulse" style={{ background: 'var(--card)', height: 120 }} />
          ))
        ) : (
          (painel?.plataformas || PLATS.map(p => ({ plataforma: p.key, nome: p.nome, cor: p.cor, total_pedidos: 0, total_valor: 0, por_status: {} }))).map((pl: any) => {
            const info = PLATS.find(p => p.key === pl.plataforma)
            return (
              <div key={pl.plataforma} className="rounded-xl p-3 flex flex-col gap-1.5"
                style={{ background: 'var(--card)', border: `1.5px solid ${pl.cor}33` }}>
                <div className="flex items-center justify-between">
                  <span className="text-xl">{info?.emoji}</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: pl.cor + '22', color: pl.cor }}>{pl.nome}</span>
                </div>
                <div>
                  <p className="text-xl font-black text-white">{pl.total_pedidos}</p>
                  <p className="text-[9px]" style={{ color: 'var(--muted)' }}>pedidos · {fmtMoeda(pl.total_valor)}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(pl.por_status || {}).map(([st, qt]) => (
                    <span key={st} className="text-[8px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: (STATUS_COR[st] || '#888') + '22', color: STATUS_COR[st] || '#888' }}>
                      {STATUS_LABEL[st] || st}: {qt as number}
                    </span>
                  ))}
                  {Object.keys(pl.por_status || {}).length === 0 && (
                    <span className="text-[8px]" style={{ color: 'var(--muted)' }}>Sem pedidos</span>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Relatório detalhado */}
      <div className="rounded-xl flex-1 min-h-0 overflow-hidden flex flex-col" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <p className="font-black text-white flex items-center gap-2"><FileText size={14} /> Relatório Detalhado</p>
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {[{ k:'plataforma', l:'Por Plataforma' }, { k:'dia', l:'Por Dia' }].map(a => (
              <button key={a.k} onClick={() => setAbaRel(a.k as any)}
                className="px-3 py-1.5 text-[11px] font-bold"
                style={{ background: abaRel === a.k ? '#F97316' : 'transparent', color: abaRel === a.k ? 'white' : 'var(--muted)' }}>
                {a.l}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
        <table className="tbl">
          <thead>
            {abaRel === 'plataforma' ? (
              <tr><th>Plataforma</th><th>Pedidos</th><th>Faturamento</th><th>Ticket Médio</th></tr>
            ) : (
              <tr><th>Data</th><th>Pedidos</th><th>Faturamento</th><th>Média/Pedido</th></tr>
            )}
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="text-center py-6" style={{ color: 'var(--muted)' }}>Carregando...</td></tr>
            ) : abaRel === 'plataforma' ? (
              relatorio?.por_plataforma?.length ? relatorio.por_plataforma.map((p: any) => (
                <tr key={p.plataforma}>
                  <td className="font-bold text-white">
                    {PLATS.find(x => x.key === p.plataforma)?.emoji} {p.nome}
                  </td>
                  <td className="text-center font-bold" style={{ color: '#F97316' }}>{p.pedidos}</td>
                  <td className="font-bold" style={{ color: '#22C55E' }}>{fmtMoeda(p.valor)}</td>
                  <td style={{ color: 'var(--muted)' }}>{fmtMoeda(p.pedidos ? p.valor / p.pedidos : 0)}</td>
                </tr>
              )) : (
                <tr><td colSpan={4} className="text-center py-8" style={{ color: 'var(--muted)' }}>Nenhum dado no período</td></tr>
              )
            ) : (
              relatorio?.por_dia?.length ? relatorio.por_dia.map((d: any) => (
                <tr key={d.data}>
                  <td className="font-bold text-white">
                    {new Date(d.data + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                  </td>
                  <td className="text-center font-bold" style={{ color: '#F97316' }}>{d.pedidos}</td>
                  <td className="font-bold" style={{ color: '#22C55E' }}>{fmtMoeda(d.valor)}</td>
                  <td style={{ color: 'var(--muted)' }}>{fmtMoeda(d.pedidos ? d.valor / d.pedidos : 0)}</td>
                </tr>
              )) : (
                <tr><td colSpan={4} className="text-center py-8" style={{ color: 'var(--muted)' }}>Nenhum dado no período</td></tr>
              )
            )}
            {/* Total */}
            {!loading && relatorio && (
              <tr style={{ background: 'rgba(249,115,22,0.08)', fontWeight: 700 }}>
                <td className="font-black text-white">TOTAL</td>
                <td className="text-center font-black" style={{ color: '#F97316' }}>{relatorio.total_pedidos}</td>
                <td className="font-black" style={{ color: '#22C55E' }}>{fmtMoeda(relatorio.total_valor)}</td>
                <td style={{ color: 'var(--muted)' }}>
                  {fmtMoeda(relatorio.total_pedidos ? relatorio.total_valor / relatorio.total_pedidos : 0)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
