'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import api, { fmtMoeda, fmtData } from '@/lib/api'
import { BarChart2, TrendingUp, Package, FileText, DollarSign, RefreshCw, Link2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const HOJE   = new Date().toISOString().slice(0,10)
const MES_INI = new Date().toISOString().slice(0,8)+'01'
const CORES  = ['#F97316','#EA580C','#22C55E','#3B82F6','#8B5CF6','#EF4444','#F59E0B','#2563EB']

const RELS: Record<string,{ label:string; icon:any; needsDates:boolean }> = {
  'vendas-periodo':             { label:'Vendas por Período',    icon:TrendingUp, needsDates:true  },
  'vendas-por-produto':         { label:'Por Produto',           icon:Package,    needsDates:true  },
  'vendas-por-categoria':       { label:'Por Categoria',         icon:BarChart2,  needsDates:true  },
  'vendas-por-forma-pagamento': { label:'Formas de Pagamento',   icon:DollarSign, needsDates:true  },
  'curva-abc':                  { label:'Curva ABC',             icon:BarChart2,  needsDates:true  },
  'margem-produtos':            { label:'Margem por Produto',    icon:TrendingUp, needsDates:false },
  'estoque-atual':              { label:'Estoque Atual',         icon:Package,    needsDates:false },
  'dre-simplificado':              { label:'DRE Simplificado',        icon:FileText,   needsDates:true  },
  'rentabilidade-analitico':      { label:'Rentabilidade Analítico', icon:BarChart2,  needsDates:true  },
  'rentabilidade-sintetico':      { label:'Rentabilidade Sintético', icon:BarChart2,  needsDates:true  },
  'vendas-conjugadas':            { label:'Vendas Conjugadas',       icon:Link2,      needsDates:true  },
  'vendas-por-horario':           { label:'Vendas por Horário',      icon:BarChart2,  needsDates:true  },
}

function RelatoriosContent() {
  const searchParams = useSearchParams()
  const relParam = searchParams.get('rel') || ''

  const [dataIni, setDataIni] = useState(MES_INI)
  const [dataFim, setDataFim] = useState(HOJE)
  const [dados,   setDados]   = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const meta = RELS[relParam]

  // Ao trocar de relatório via menu, zera os dados
  useEffect(() => { setDados(null) }, [relParam])

  async function gerar() {
    if (!relParam) return
    setLoading(true)
    try {
      const params: any = {}
      if (meta?.needsDates) { params.data_ini = dataIni; params.data_fim = dataFim }
      const r = await api.get(`/relatorios/${relParam}`, { params })
      setDados(r.data)
    } catch { setDados(null) }
    setLoading(false)
  }

  if (!relParam || !meta) {
    return (
      <div className="pg">
        <div className="pg-header">
          <h1 className="text-base font-black text-white">Relatórios</h1>
        </div>
        <div className="pg-body flex items-center justify-center">
          <p className="text-xs" style={{ color:'var(--muted)' }}>
            Selecione um relatório no menu lateral
          </p>
        </div>
      </div>
    )
  }

  const Icon = meta.icon

  return (
    <div className="pg">
      {/* Header */}
      <div className="pg-header flex items-center justify-between">
        <h1 className="text-base font-black text-white flex items-center gap-2">
          <Icon size={15} color="#F97316" />
          {meta.label}
        </h1>
        <div className="flex items-center gap-2">
          {meta.needsDates && (
            <>
              <input type="date" value={dataIni} onChange={e => setDataIni(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg"
                style={{ background:'var(--card2)', border:'1px solid var(--border)', color:'white' }} />
              <span className="text-xs" style={{ color:'var(--muted)' }}>até</span>
              <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg"
                style={{ background:'var(--card2)', border:'1px solid var(--border)', color:'white' }} />
            </>
          )}
          <button onClick={gerar} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-black"
            style={{ background:'#F97316', color:'white' }}>
            {loading ? <RefreshCw size={11} className="animate-spin" /> : null}
            {loading ? 'Gerando...' : 'Gerar'}
          </button>
        </div>
      </div>

      {/* Resultado */}
      <div className="pg-body">
        {!dados ? (
          <div className="flex items-center justify-center h-full" style={{ color:'var(--muted)' }}>
            <p className="text-xs">
              {loading ? 'Gerando relatório...' : 'Clique em "Gerar" para carregar os dados'}
            </p>
          </div>
        ) : (
          <div className="overflow-auto h-full">

            {/* DRE */}
            {relParam === 'dre-simplificado' && (
              <div className="p-4 space-y-3">
                <p className="font-black text-white text-sm">DRE — {fmtData(dados.periodo?.ini)} a {fmtData(dados.periodo?.fim)}</p>
                <div className="space-y-2">
                  {[['(+) Receita Bruta',dados.receita_bruta,'#F97316'],['(-) Descontos',-dados.descontos,'#EF4444'],
                    ['(=) Receita Líquida',dados.receita_liquida,'#F97316'],['(-) CMV',-dados.custo_mercadorias,'#F59E0B'],
                    ['(=) Lucro Bruto',dados.lucro_bruto,'#22C55E']].map(([l,v,c])=>(
                    <div key={String(l)} className="flex justify-between py-1.5" style={{ borderBottom:'1px solid var(--border)' }}>
                      <span className="text-xs" style={{ color:'var(--muted)' }}>{l}</span>
                      <span className="text-xs font-black" style={{ color:String(c) }}>{fmtMoeda(Number(v))}</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[['Total Vendas',dados.total_vendas,'#F97316'],['Ticket Médio',fmtMoeda(dados.ticket_medio),'#EA580C'],
                    ['Margem Bruta',`${dados.margem_bruta?.toFixed(1)}%`,'#22C55E']].map(([l,v,c])=>(
                    <div key={String(l)} className="text-center p-2.5 rounded-xl" style={{ background:'var(--card2)' }}>
                      <p className="text-sm font-black" style={{ color:String(c) }}>{v}</p>
                      <p className="text-[9px]" style={{ color:'var(--muted)' }}>{l}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vendas por Período */}
            {relParam === 'vendas-periodo' && dados.resumo && (
              <div className="flex flex-col h-full">
                <div className="flex gap-3 p-3 flex-shrink-0">
                  {[['Vendas',dados.resumo.total_vendas,'#F97316'],['Faturado',fmtMoeda(dados.resumo.total_vendido),'#EA580C'],
                    ['Custo',fmtMoeda(dados.resumo.total_custo),'#EF4444'],['Lucro',fmtMoeda(dados.resumo.lucro_bruto),'#22C55E'],
                    ['Margem',`${dados.resumo.margem_media?.toFixed(1)}%`,'#3B82F6']].map(([l,v,c])=>(
                    <div key={String(l)} className="flex-1 text-center p-2 rounded-xl" style={{ background:'var(--card2)' }}>
                      <p className="text-xs font-black" style={{ color:String(c) }}>{v}</p>
                      <p className="text-[9px]" style={{ color:'var(--muted)' }}>{l}</p>
                    </div>
                  ))}
                </div>
                <div className="flex-1 overflow-auto">
                  <table className="tbl">
                    <thead><tr>{['Número','Data','Cliente','Forma','Total'].map(h=><th key={h}>{h}</th>)}</tr></thead>
                    <tbody>
                      {dados.vendas.map((v:any)=>(
                        <tr key={v.id}>
                          <td className="font-mono" style={{ color:'#F97316' }}>{v.numero}</td>
                          <td style={{ color:'var(--muted)' }}>{fmtData(v.data)}</td>
                          <td className="text-white">{v.cliente}</td>
                          <td style={{ color:'var(--muted)' }}>{v.forma_pagamento}</td>
                          <td className="font-bold" style={{ color:'#F97316' }}>{fmtMoeda(v.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Por Produto */}
            {relParam === 'vendas-por-produto' && Array.isArray(dados) && (
              <div className="flex flex-col h-full">
                <div className="h-40 flex-shrink-0 p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dados.slice(0,10)}>
                      <XAxis dataKey="descricao" tick={{ fill:'#94A3B8', fontSize:9 }} tickFormatter={d=>d.slice(0,10)} />
                      <YAxis tick={{ fill:'#94A3B8', fontSize:9 }} tickFormatter={v=>`${(v/1000).toFixed(0)}k`} />
                      <Tooltip contentStyle={{ background:'#1E293B', border:'1px solid #475569', borderRadius:8, fontSize:11 }} formatter={(v:any)=>[fmtMoeda(v),'Vendido']} />
                      <Bar dataKey="total_vendido" fill="#F97316" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 overflow-auto">
                  <table className="tbl">
                    <thead><tr>{['#','Produto','Qtde','Vendido','Lucro','Margem'].map(h=><th key={h}>{h}</th>)}</tr></thead>
                    <tbody>
                      {dados.map((p:any,i:number)=>(
                        <tr key={p.produto_id}>
                          <td className="font-bold" style={{ color:i<3?'#F97316':'var(--muted)' }}>{i+1}</td>
                          <td>
                            <p className="font-semibold text-white">{p.descricao}</p>
                            <p className="font-mono text-[10px]" style={{ color:'var(--muted)' }}>{p.codigo}</p>
                          </td>
                          <td style={{ color:'var(--muted)' }}>{p.quantidade?.toFixed(1)} {p.unidade}</td>
                          <td className="font-bold" style={{ color:'#F97316' }}>{fmtMoeda(p.total_vendido)}</td>
                          <td style={{ color:'#22C55E' }}>{fmtMoeda(p.lucro)}</td>
                          <td><span className="badge" style={{ background:'#22C55E22', color:'#22C55E' }}>{p.margem?.toFixed(1)}%</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Por Categoria */}
            {relParam === 'vendas-por-categoria' && Array.isArray(dados) && (
              <table className="tbl">
                <thead><tr>{['Categoria','Vendas','Faturado','Lucro','Margem'].map(h=><th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {dados.map((c:any,i:number)=>(
                    <tr key={i}>
                      <td className="font-semibold text-white">{c.categoria}</td>
                      <td style={{ color:'var(--muted)' }}>{c.total_vendas}</td>
                      <td className="font-bold" style={{ color:'#F97316' }}>{fmtMoeda(c.total_vendido)}</td>
                      <td style={{ color:'#22C55E' }}>{fmtMoeda(c.lucro)}</td>
                      <td><span className="badge" style={{ background:'#22C55E22', color:'#22C55E' }}>{c.margem?.toFixed(1)}%</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Curva ABC */}
            {relParam === 'curva-abc' && Array.isArray(dados) && (
              <table className="tbl">
                <thead><tr>{['#','Produto','Total','%','Acum.%','Curva'].map(h=><th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {dados.map((p:any,i:number)=>{
                    const cc = p.curva==='A'?'#22C55E':p.curva==='B'?'#F59E0B':'#94A3B8'
                    return (
                      <tr key={i}>
                        <td style={{ color:'var(--muted)' }}>{i+1}</td>
                        <td>
                          <p className="font-semibold text-white">{p.produto}</p>
                          <p className="font-mono text-[10px]" style={{ color:'var(--muted)' }}>{p.codigo}</p>
                        </td>
                        <td className="font-bold" style={{ color:'#F97316' }}>{fmtMoeda(p.total)}</td>
                        <td style={{ color:'var(--muted)' }}>{p.percentual?.toFixed(1)}%</td>
                        <td style={{ color:'var(--muted)' }}>{p.acumulado?.toFixed(1)}%</td>
                        <td><span className="badge font-black" style={{ background:cc+'22', color:cc }}>{p.curva}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}

            {/* Estoque Atual */}
            {relParam === 'estoque-atual' && Array.isArray(dados) && (
              <table className="tbl">
                <thead><tr>{['Código','Produto','Estoque','Mínimo','Custo','Venda','Val.Custo','Status'].map(h=><th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {dados.map((p:any)=>{
                    const sc = p.status==='OK'?'#22C55E':p.status==='BAIXO'?'#F59E0B':'#EF4444'
                    return (
                      <tr key={p.codigo}>
                        <td className="font-mono" style={{ color:'#F97316' }}>{p.codigo}</td>
                        <td className="font-semibold text-white">{p.descricao}</td>
                        <td className="text-white">{p.estoque_atual} {p.unidade}</td>
                        <td style={{ color:'var(--muted)' }}>{p.estoque_minimo}</td>
                        <td style={{ color:'var(--muted)' }}>{fmtMoeda(p.preco_custo)}</td>
                        <td style={{ color:'#F97316' }}>{fmtMoeda(p.preco_venda)}</td>
                        <td style={{ color:'#EA580C' }}>{fmtMoeda(p.valor_custo)}</td>
                        <td><span className="badge" style={{ background:sc+'22', color:sc }}>{p.status}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}

            {/* Margem por Produto */}
            {relParam === 'margem-produtos' && Array.isArray(dados) && (
              <table className="tbl">
                <thead><tr>{['Código','Produto','Custo','Venda','Margem','Markup','Estoque','Val.Est.'].map(h=><th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {dados.map((p:any)=>(
                    <tr key={p.id}>
                      <td className="font-mono" style={{ color:'#F97316' }}>{p.codigo}</td>
                      <td className="font-semibold text-white">{p.descricao}</td>
                      <td style={{ color:'var(--muted)' }}>{fmtMoeda(p.preco_custo)}</td>
                      <td className="font-bold" style={{ color:'#F97316' }}>{fmtMoeda(p.preco_venda)}</td>
                      <td><span className="badge" style={{ background:'#22C55E22', color:'#22C55E' }}>{p.margem?.toFixed(1)}%</span></td>
                      <td style={{ color:'var(--muted)' }}>{p.markup?.toFixed(1)}%</td>
                      <td style={{ color:'var(--muted)' }}>{p.estoque_atual}</td>
                      <td style={{ color:'#EA580C' }}>{fmtMoeda(p.valor_estoque)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Rentabilidade Analítico */}
            {relParam === 'rentabilidade-analitico' && dados?.categorias && (
              <div className="p-3 space-y-4">
                <p className="text-xs font-black text-white">
                  Total Geral: <span style={{ color:'#F97316' }}>{fmtMoeda(dados.total_geral)}</span>
                  <span className="ml-3 font-normal" style={{ color:'var(--muted)' }}>
                    {fmtData(dados.periodo?.ini)} a {fmtData(dados.periodo?.fim)}
                  </span>
                </p>
                {dados.categorias.map((cat: any) => (
                  <div key={cat.cat_id} className="rounded-xl overflow-hidden" style={{ border:'1px solid var(--border)' }}>
                    {/* header categoria */}
                    <div className="flex items-center justify-between px-3 py-2" style={{ background:'#F97316', color:'white' }}>
                      <span className="text-xs font-black uppercase tracking-wide">{cat.cat_nome}</span>
                      <div className="flex gap-4 text-[10px] font-semibold">
                        <span>Fat. {fmtMoeda(cat.fat_bruto)}</span>
                        <span>Custo {fmtMoeda(cat.custo_merc)}</span>
                        <span>Margem {fmtMoeda(cat.marg_contrib)} ({cat.perc_marg?.toFixed(1)}%)</span>
                        <span>Partic. {cat.perc_partic?.toFixed(1)}%</span>
                      </div>
                    </div>
                    {/* produtos */}
                    <table className="tbl">
                      <thead>
                        <tr>
                          {['Código','Produto','Qtde Venda','Fat. Bruto','% Partic.','Custo Merc.','Marg. Contrib.','% Marg.'].map(h=><th key={h}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {cat.itens.map((it: any) => (
                          <tr key={it.produto_id}>
                            <td className="font-mono text-[10px]" style={{ color:'var(--muted)' }}>{it.codigo}</td>
                            <td className="font-semibold text-white">{it.descricao}</td>
                            <td style={{ color:'var(--muted)' }}>{it.qty_venda?.toFixed(1)}</td>
                            <td className="font-bold" style={{ color:'#F97316' }}>{fmtMoeda(it.fat_bruto)}</td>
                            <td style={{ color:'var(--muted)' }}>{it.perc_partic?.toFixed(1)}%</td>
                            <td style={{ color:'#F59E0B' }}>{fmtMoeda(it.custo_merc)}</td>
                            <td style={{ color: it.marg_contrib >= 0 ? '#22C55E' : '#EF4444' }}>{fmtMoeda(it.marg_contrib)}</td>
                            <td>
                              <span className="badge" style={{ background: it.perc_marg >= 0 ? '#22C55E22' : '#EF444422', color: it.perc_marg >= 0 ? '#22C55E' : '#EF4444' }}>
                                {it.perc_marg?.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}

            {/* Rentabilidade Sintético */}
            {relParam === 'rentabilidade-sintetico' && dados?.categorias && (
              <div className="p-3 space-y-3">
                <p className="text-xs font-black text-white">
                  Total Geral: <span style={{ color:'#F97316' }}>{fmtMoeda(dados.total_geral)}</span>
                  <span className="ml-3 font-normal" style={{ color:'var(--muted)' }}>
                    {fmtData(dados.periodo?.ini)} a {fmtData(dados.periodo?.fim)}
                  </span>
                </p>
                <table className="tbl">
                  <thead>
                    <tr>
                      {['Categoria','Qtde Venda','Fat. Bruto','% Partic.','Custo Merc.','Marg. Contrib.','% Margem'].map(h=><th key={h}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {dados.categorias.map((cat: any) => (
                      <tr key={cat.cat_id}>
                        <td className="font-semibold text-white">{cat.cat_nome}</td>
                        <td style={{ color:'var(--muted)' }}>{cat.qty_venda?.toFixed(1)}</td>
                        <td className="font-bold" style={{ color:'#F97316' }}>{fmtMoeda(cat.fat_bruto)}</td>
                        <td style={{ color:'var(--muted)' }}>{cat.perc_partic?.toFixed(1)}%</td>
                        <td style={{ color:'#F59E0B' }}>{fmtMoeda(cat.custo_merc)}</td>
                        <td style={{ color: cat.marg_contrib >= 0 ? '#22C55E' : '#EF4444' }}>{fmtMoeda(cat.marg_contrib)}</td>
                        <td>
                          <span className="badge" style={{ background: cat.perc_marg >= 0 ? '#22C55E22' : '#EF444422', color: cat.perc_marg >= 0 ? '#22C55E' : '#EF4444' }}>
                            {cat.perc_marg?.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop:'2px solid #F97316' }}>
                      <td className="font-black text-white">TOTAL</td>
                      <td style={{ color:'var(--muted)' }}>
                        {dados.categorias.reduce((s:number,c:any)=>s+c.qty_venda,0).toFixed(1)}
                      </td>
                      <td className="font-black" style={{ color:'#F97316' }}>{fmtMoeda(dados.total_geral)}</td>
                      <td style={{ color:'var(--muted)' }}>100%</td>
                      <td className="font-bold" style={{ color:'#F59E0B' }}>
                        {fmtMoeda(dados.categorias.reduce((s:number,c:any)=>s+c.custo_merc,0))}
                      </td>
                      <td className="font-bold" style={{ color:'#22C55E' }}>
                        {fmtMoeda(dados.categorias.reduce((s:number,c:any)=>s+c.marg_contrib,0))}
                      </td>
                      <td style={{ color:'var(--muted)' }}>—</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Vendas Conjugadas */}
            {relParam === 'vendas-conjugadas' && Array.isArray(dados) && (
              <div className="p-3">
                {dados.length === 0 ? (
                  <p className="text-xs text-center py-8" style={{ color:'var(--muted)' }}>
                    Nenhum par de produtos vendidos juntos com frequência no período selecionado.
                  </p>
                ) : (
                  <table className="tbl">
                    <thead>
                      <tr>
                        {['#','Produto 1','Produto 2','Ocorrências','Fat. Conjunto'].map(h=><th key={h}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {dados.map((par: any, i: number) => (
                        <tr key={i}>
                          <td className="font-bold" style={{ color: i < 3 ? '#F97316' : 'var(--muted)' }}>{i+1}</td>
                          <td className="font-semibold text-white">{par.produto_1}</td>
                          <td className="font-semibold text-white">{par.produto_2}</td>
                          <td>
                            <span className="badge font-black" style={{ background:'#F9731622', color:'#F97316' }}>
                              {par.ocorrencias}×
                            </span>
                          </td>
                          <td className="font-bold" style={{ color:'#22C55E' }}>{fmtMoeda(par.fat_conjunto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Vendas por Horário */}
            {relParam === 'vendas-por-horario' && dados?.horarios && (
              <div className="flex flex-col h-full">
                {/* KPIs */}
                {(() => {
                  const pico = dados.horarios.reduce((best: any, h: any) => h.faturamento > (best?.faturamento ?? 0) ? h : best, null)
                  return (
                    <div className="flex gap-3 p-3 flex-shrink-0">
                      {[
                        ['Total Vendas', dados.total_vendas, '#F97316'],
                        ['Faturamento Total', fmtMoeda(dados.total_geral), '#EA580C'],
                        ['Ticket Médio', fmtMoeda(dados.total_vendas > 0 ? dados.total_geral / dados.total_vendas : 0), '#22C55E'],
                      ].map(([l, v, c]) => (
                        <div key={String(l)} className="flex-1 text-center p-2 rounded-xl" style={{ background:'var(--card2)' }}>
                          <p className="text-xs font-black" style={{ color: String(c) }}>{v}</p>
                          <p className="text-[9px]" style={{ color:'var(--muted)' }}>{l}</p>
                        </div>
                      ))}
                      {/* Card de Pico destacado */}
                      <div className="flex-1 text-center p-2 rounded-xl" style={{ background:'#F9731620', border:'1px solid #F97316' }}>
                        <p className="text-[9px] font-black uppercase tracking-wide" style={{ color:'#F97316' }}>Hora de Pico</p>
                        <p className="text-xs font-black text-white mt-0.5">{pico?.faixa ?? '—'}</p>
                        <p className="text-xs font-black mt-0.5" style={{ color:'#F97316' }}>{pico ? fmtMoeda(pico.faturamento) : '—'}</p>
                        <p className="text-[9px]" style={{ color:'var(--muted)' }}>{pico ? `${pico.total_vendas} vendas` : ''}</p>
                      </div>
                    </div>
                  )
                })()}
                {/* Gráfico */}
                <div className="px-3 flex-shrink-0" style={{ height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dados.horarios} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <XAxis dataKey="hora" tick={{ fill:'#94A3B8', fontSize:9 }}
                        tickFormatter={(h: number) => `${String(h).padStart(2,'0')}h`} />
                      <YAxis tick={{ fill:'#94A3B8', fontSize:9 }} tickFormatter={(v:any) => v > 0 ? `${(v/1000).toFixed(0)}k` : '0'} />
                      <Tooltip contentStyle={{ background:'#1E293B', border:'1px solid #475569', borderRadius:8, fontSize:11 }}
                        labelFormatter={(h: number) => `${String(h).padStart(2,'0')}:00 / ${String(h).padStart(2,'0')}:59`}
                        formatter={(v:any, name:string) => [name === 'faturamento' ? fmtMoeda(v) : v, name === 'faturamento' ? 'Faturamento' : 'Vendas']} />
                      <Bar dataKey="faturamento" radius={[3,3,0,0]}>
                        {dados.horarios.map((h: any, i: number) => (
                          <Cell key={i} fill={h.pico ? '#F97316' : h.total_vendas > 0 ? '#EA580C88' : '#334155'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Tabela — todas as 24 horas */}
                <div className="flex-1 overflow-auto px-3 pb-3">
                  <table className="tbl">
                    <thead>
                      <tr>{['Faixa de Horário', 'Nº Vendas', 'Faturamento', '% Partic.', 'Ticket Médio', ''].map(h => <th key={h}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {dados.horarios.map((h: any) => (
                        <tr key={h.hora} style={{ opacity: h.total_vendas === 0 ? 0.4 : 1 }}>
                          <td className="font-mono font-semibold" style={{ color: h.total_vendas > 0 ? 'white' : 'var(--muted)' }}>{h.faixa}</td>
                          <td style={{ color: h.total_vendas > 0 ? 'white' : 'var(--muted)' }}>{h.total_vendas}</td>
                          <td className="font-bold" style={{ color: h.faturamento > 0 ? '#F97316' : 'var(--muted)' }}>{h.faturamento > 0 ? fmtMoeda(h.faturamento) : '—'}</td>
                          <td style={{ color:'var(--muted)' }}>{h.perc_partic > 0 ? `${h.perc_partic?.toFixed(1)}%` : '—'}</td>
                          <td style={{ color: h.ticket_medio > 0 ? '#22C55E' : 'var(--muted)' }}>{h.ticket_medio > 0 ? fmtMoeda(h.ticket_medio) : '—'}</td>
                          <td>
                            {h.pico && (
                              <span className="badge font-black" style={{ background:'#F9731622', color:'#F97316' }}>PICO</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Formas de Pagamento */}
            {relParam === 'vendas-por-forma-pagamento' && Array.isArray(dados) && (
              <div className="flex gap-4 p-4 h-full">
                <div className="flex-1">
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={dados} dataKey="total" nameKey="forma" cx="50%" cy="50%" outerRadius={90}
                        label={({forma,percentual})=>`${forma} ${percentual}%`}>
                        {dados.map((_:any,i:number)=><Cell key={i} fill={CORES[i%CORES.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v:any)=>fmtMoeda(v)} contentStyle={{ background:'#1E293B', border:'1px solid #475569', borderRadius:8, fontSize:11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2 overflow-auto">
                  {dados.map((f:any,i:number)=>(
                    <div key={f.forma} className="flex items-center gap-2 py-2" style={{ borderBottom:'1px solid var(--border)' }}>
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background:CORES[i%CORES.length] }} />
                      <span className="flex-1 text-xs text-white">{f.forma.replace('_',' ')}</span>
                      <span className="text-xs font-bold" style={{ color:CORES[i%CORES.length] }}>{fmtMoeda(f.total)}</span>
                      <span className="text-[10px]" style={{ color:'var(--muted)' }}>{f.percentual}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}

export default function RelatoriosPage() {
  return (
    <Suspense fallback={<div className="pg"><div className="pg-body flex items-center justify-center"><p className="text-xs" style={{ color:'var(--muted)' }}>Carregando...</p></div></div>}>
      <RelatoriosContent />
    </Suspense>
  )
}
