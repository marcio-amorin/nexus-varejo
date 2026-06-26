'use client'
import { useEffect, useState } from 'react'
import api, { fmtMoeda } from '@/lib/api'
import { ClipboardList, RefreshCw, FileText, Printer, Users } from 'lucide-react'

const PERIODOS = [
  { k: 'DIA',     label: 'Hoje'      },
  { k: 'MES',     label: 'Este Mês'  },
  { k: 'ANO',     label: 'Este Ano'  },
  { k: 'PERIODO', label: 'Período'   },
]

const STATUS_CFG: Record<string, { label: string; cor: string; bg: string }> = {
  ABERTO:         { label: 'Aberto',       cor: '#3B82F6', bg: '#3B82F622' },
  AGUARDANDO_PDV: { label: 'Aguard. PDV',  cor: '#F59E0B', bg: '#F59E0B22' },
  EM_SEPARACAO:   { label: 'Em Separação', cor: '#8B5CF6', bg: '#8B5CF622' },
  PRONTO_NF:      { label: 'Pronto / NF',  cor: '#06B6D4', bg: '#06B6D422' },
  FATURADO:       { label: 'Faturado',     cor: '#22C55E', bg: '#22C55E22' },
  CANCELADO:      { label: 'Cancelado',    cor: '#EF4444', bg: '#EF444422' },
}

export default function PainelPedidoVendaPage() {
  const [periodo,  setPeriodo] = useState('MES')
  const [dtIni,    setDtIni]   = useState('')
  const [dtFim,    setDtFim]   = useState('')
  const [painel,   setPainel]  = useState<any>(null)
  const [loading,  setLoading] = useState(true)
  const [abaRel,   setAbaRel]  = useState<'dia'|'vendedor'>('dia')

  async function load() {
    setLoading(true)
    try {
      const params: any = { periodo }
      if (periodo === 'PERIODO' && dtIni && dtFim) {
        params.data_inicio = dtIni; params.data_fim = dtFim
      }
      setPainel((await api.get('/pedido-venda/painel', { params })).data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [periodo])

  function imprimir() {
    if (!painel) return
    const w = window.open('', '_blank', 'width=900,height=700')
    if (!w) return
    const stRows = (painel.por_status || []).map((s: any) => {
      const cfg = STATUS_CFG[s.status] || { label: s.status, cor: '#888' }
      return `<tr><td><span style="background:${cfg.cor}22;color:${cfg.cor};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700">${cfg.label}</span></td>
        <td align="center">${s.qtd}</td><td align="right">${fmtMoeda(s.valor)}</td></tr>`
    }).join('')
    const vRows = (painel.por_vendedor || []).map((v: any) =>
      `<tr><td>${v.nome}</td><td align="center">${v.qtd}</td>
       <td align="right">${fmtMoeda(v.valor)}</td><td align="right">${fmtMoeda(v.qtd ? v.valor/v.qtd : 0)}</td></tr>`
    ).join('')
    const dRows = (painel.por_dia || []).map((d: any) =>
      `<tr><td>${new Date(d.data+'T12:00').toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'})}</td>
       <td align="center">${d.qtd}</td><td align="right">${fmtMoeda(d.valor)}</td>
       <td align="right">${fmtMoeda(d.qtd ? d.valor/d.qtd : 0)}</td></tr>`
    ).join('')
    w.document.write(`<html><head><title>Painel Pedido de Venda</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;color:#111}h2{color:#8B5CF6}h3{color:#555;margin-top:20px}
    table{width:100%;border-collapse:collapse;margin:10px 0}th,td{padding:8px 12px;border:1px solid #ddd;font-size:13px}
    th{background:#f3f4f6;font-weight:700}.kpi{display:inline-block;margin:0 12px 12px 0;padding:10px 20px;border-radius:8px;background:#f9fafb;border:1px solid #e5e7eb}
    .kv{font-size:26px;font-weight:900;color:#8B5CF6}.kl{font-size:11px;color:#6b7280;margin-top:2px}
    @media print{button{display:none}}</style></head><body>
    <h2>📋 Painel Pedido de Venda</h2>
    <p>Período: <b>${painel.periodo?.inicio}</b> até <b>${painel.periodo?.fim}</b></p>
    <div><div class="kpi"><div class="kv">${painel.total_pedidos}</div><div class="kl">Total Pedidos</div></div>
    <div class="kpi"><div class="kv" style="color:#22C55E">${fmtMoeda(painel.total_valor)}</div><div class="kl">Faturamento</div></div>
    <div class="kpi"><div class="kv" style="color:#F59E0B">${fmtMoeda(painel.ticket_medio)}</div><div class="kl">Ticket Médio</div></div></div>
    <h3>Por Status</h3><table><thead><tr><th>Status</th><th>Qtd</th><th>Valor</th></tr></thead><tbody>${stRows}</tbody></table>
    <h3>Por Vendedor</h3><table><thead><tr><th>Vendedor</th><th>Pedidos</th><th>Faturamento</th><th>Ticket Médio</th></tr></thead><tbody>${vRows}</tbody></table>
    <h3>Por Dia</h3><table><thead><tr><th>Data</th><th>Pedidos</th><th>Faturamento</th><th>Ticket Médio</th></tr></thead><tbody>${dRows}</tbody></table>
    <button onclick="window.print()" style="margin-top:20px;padding:10px 24px;background:#8B5CF6;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px">🖨️ Imprimir</button>
    </body></html>`)
    w.document.close(); w.focus(); setTimeout(() => w.print(), 400)
  }

  return (
    <div className="pg">
      {/* Header */}
      <div className="pg-header flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-base font-black text-white flex items-center gap-2">
            <ClipboardList size={18} color="#8B5CF6" /> Painel Pedido de Venda
          </h1>
          <p className="text-[10px]" style={{ color: 'var(--muted)' }}>Visão consolidada dos pedidos de venda</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {PERIODOS.map(p => (
              <button key={p.k} onClick={() => setPeriodo(p.k)}
                className="px-3 py-1.5 text-xs font-bold"
                style={{ background: periodo === p.k ? '#8B5CF6' : 'var(--card)', color: periodo === p.k ? 'white' : 'var(--muted)' }}>
                {p.label}
              </button>
            ))}
          </div>
          {periodo === 'PERIODO' && (
            <div className="flex items-center gap-1">
              <input type="date" value={dtIni} onChange={e => setDtIni(e.target.value)}
                className="px-2 py-1.5 text-xs rounded-lg" style={{ background:'var(--card)', border:'1px solid var(--border)', color:'white' }} />
              <span className="text-xs" style={{ color:'var(--muted)' }}>até</span>
              <input type="date" value={dtFim} onChange={e => setDtFim(e.target.value)}
                className="px-2 py-1.5 text-xs rounded-lg" style={{ background:'var(--card)', border:'1px solid var(--border)', color:'white' }} />
              <button onClick={load} className="px-3 py-1.5 rounded-lg text-xs font-bold"
                style={{ background:'#8B5CF6', color:'white' }}>Buscar</button>
            </div>
          )}
          <button onClick={load} className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background:'var(--card)', border:'1px solid var(--border)', color:'var(--muted)' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={imprimir}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
            style={{ background:'rgba(139,92,246,0.15)', color:'#8B5CF6', border:'1px solid rgba(139,92,246,0.3)' }}>
            <Printer size={12} /> Relatório
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="pg-stats grid grid-cols-4 gap-2">
        {[
          { label:'TOTAL PEDIDOS', value: painel?.total_pedidos || 0, fmt:false, cor:'#8B5CF6' },
          { label:'FATURAMENTO',   value: painel?.total_valor   || 0, fmt:true,  cor:'#22C55E' },
          { label:'TICKET MÉDIO',  value: painel?.ticket_medio  || 0, fmt:true,  cor:'#F59E0B' },
          { label:'FATURADOS',     value: painel?.por_status?.find((s:any)=>s.status==='FATURADO')?.qtd || 0, fmt:false, cor:'#22C55E' },
        ].map(k => (
          <div key={k.label} className="rounded-xl p-3" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
            <p className="text-[10px] font-bold mb-0.5" style={{ color:'var(--muted)' }}>{k.label}</p>
            <p className="text-xl font-black" style={{ color:k.cor }}>
              {k.fmt ? fmtMoeda(k.value as number) : k.value}
            </p>
          </div>
        ))}
      </div>

      {/* Cards por Status */}
      <div>
        <p className="text-[10px] font-black px-1 mb-1.5" style={{ color:'var(--muted)' }}>STATUS DOS PEDIDOS</p>
        <div className="grid grid-cols-6 gap-2">
          {loading ? Array.from({length:6}).map((_,i) => (
            <div key={i} className="rounded-xl p-3 animate-pulse" style={{ background:'var(--card)', height:72 }} />
          )) : Object.entries(STATUS_CFG).map(([key, cfg]) => {
            const st = painel?.por_status?.find((s:any) => s.status === key)
            return (
              <div key={key} className="rounded-xl p-2.5" style={{ background:'var(--card)', border:`1.5px solid ${cfg.cor}33` }}>
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                  style={{ background:cfg.bg, color:cfg.cor }}>{cfg.label}</span>
                <p className="text-xl font-black text-white mt-1">{st?.qtd || 0}</p>
                <p className="text-[10px] font-bold" style={{ color:'#22C55E' }}>{fmtMoeda(st?.valor || 0)}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Relatório detalhado */}
      <div className="rounded-xl flex-1 min-h-0 overflow-hidden flex flex-col" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0" style={{ borderBottom:'1px solid var(--border)' }}>
          <p className="font-black text-white flex items-center gap-2"><FileText size={14} /> Relatório Detalhado</p>
          <div className="flex rounded-lg overflow-hidden" style={{ border:'1px solid var(--border)' }}>
            {[{k:'dia',l:'Por Dia'},{k:'vendedor',l:'Por Vendedor'}].map(a => (
              <button key={a.k} onClick={() => setAbaRel(a.k as any)}
                className="px-3 py-1.5 text-[11px] font-bold"
                style={{ background: abaRel===a.k ? '#8B5CF6' : 'transparent', color: abaRel===a.k ? 'white' : 'var(--muted)' }}>
                {a.l}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>{abaRel === 'dia' ? 'Data' : 'Vendedor'}</th>
              <th>Pedidos</th><th>Faturamento</th><th>Ticket Médio</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="text-center py-6" style={{ color:'var(--muted)' }}>Carregando...</td></tr>
            ) : abaRel === 'dia' ? (
              painel?.por_dia?.length ? painel.por_dia.map((d: any) => (
                <tr key={d.data}>
                  <td className="font-bold text-white">
                    {new Date(d.data+'T12:00').toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'})}
                  </td>
                  <td className="text-center font-bold" style={{ color:'#8B5CF6' }}>{d.qtd}</td>
                  <td className="font-bold" style={{ color:'#22C55E' }}>{fmtMoeda(d.valor)}</td>
                  <td style={{ color:'var(--muted)' }}>{fmtMoeda(d.qtd ? d.valor/d.qtd : 0)}</td>
                </tr>
              )) : <tr><td colSpan={4} className="text-center py-8" style={{ color:'var(--muted)' }}>Nenhum pedido no período</td></tr>
            ) : (
              painel?.por_vendedor?.length ? painel.por_vendedor.map((v: any) => (
                <tr key={v.id}>
                  <td className="font-bold text-white">
                    <span className="flex items-center gap-2"><Users size={12} color="var(--muted)" />{v.nome}</span>
                  </td>
                  <td className="text-center font-bold" style={{ color:'#8B5CF6' }}>{v.qtd}</td>
                  <td className="font-bold" style={{ color:'#22C55E' }}>{fmtMoeda(v.valor)}</td>
                  <td style={{ color:'var(--muted)' }}>{fmtMoeda(v.qtd ? v.valor/v.qtd : 0)}</td>
                </tr>
              )) : <tr><td colSpan={4} className="text-center py-8" style={{ color:'var(--muted)' }}>Nenhum pedido no período</td></tr>
            )}
            {!loading && painel && (
              <tr style={{ background:'rgba(139,92,246,0.08)' }}>
                <td className="font-black text-white">TOTAL</td>
                <td className="text-center font-black" style={{ color:'#8B5CF6' }}>{painel.total_pedidos}</td>
                <td className="font-black" style={{ color:'#22C55E' }}>{fmtMoeda(painel.total_valor)}</td>
                <td style={{ color:'var(--muted)' }}>{fmtMoeda(painel.ticket_medio)}</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
