'use client'
import { useState } from 'react'
import api, { fmtMoeda, fmtData } from '@/lib/api'
import { BarChart2, TrendingUp, Package, FileText, DollarSign } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const HOJE = new Date().toISOString().slice(0,10)
const MES_INI = new Date().toISOString().slice(0,8)+'01'
const CORES = ['#F97316','#EA580C','#22C55E','#3B82F6','#8B5CF6','#EF4444','#F59E0B','#2563EB']

const RELS = [
  { key:'vendas-periodo',          label:'Vendas por Período',       icon:TrendingUp,  desc:'Resumo e lista de vendas' },
  { key:'vendas-por-produto',      label:'Por Produto',              icon:Package,     desc:'Ranking de produtos' },
  { key:'vendas-por-categoria',    label:'Por Categoria',            icon:BarChart2,   desc:'Performance por categoria' },
  { key:'vendas-por-forma-pagamento', label:'Formas de Pagamento',   icon:DollarSign,  desc:'Distribuição por forma' },
  { key:'curva-abc',               label:'Curva ABC',                icon:BarChart2,   desc:'Classificação A/B/C' },
  { key:'margem-produtos',         label:'Margem por Produto',       icon:TrendingUp,  desc:'Análise de margem' },
  { key:'estoque-atual',           label:'Estoque Atual',            icon:Package,     desc:'Posição de estoque' },
  { key:'dre-simplificado',        label:'DRE Simplificado',         icon:FileText,    desc:'Demonstração de resultado' },
]

export default function RelatoriosPage() {
  const [ativo, setAtivo]     = useState<string|null>(null)
  const [dataIni, setDataIni] = useState(MES_INI)
  const [dataFim, setDataFim] = useState(HOJE)
  const [dados, setDados]     = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const needsDates = !['margem-produtos','estoque-atual'].includes(ativo||'')

  async function gerar() {
    if (!ativo) return
    setLoading(true)
    try {
      const params: any = {}
      if (needsDates) { params.data_ini=dataIni; params.data_fim=dataFim }
      const r = await api.get(`/relatorios/${ativo}`, { params })
      setDados(r.data)
    } catch { setDados(null) }
    setLoading(false)
  }

  return (
    <div className="pg">
      {/* Header */}
      <div className="pg-header flex items-center justify-between">
        <h1 className="text-base font-black text-white">Relatórios</h1>
        {ativo && (
          <div className="flex items-center gap-2">
            {needsDates && (
              <>
                <input type="date" value={dataIni} onChange={e=>setDataIni(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-lg"
                  style={{ background:'var(--card2)', border:'1px solid var(--border)', color:'white' }} />
                <span className="text-xs" style={{ color:'var(--muted)' }}>até</span>
                <input type="date" value={dataFim} onChange={e=>setDataFim(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-lg"
                  style={{ background:'var(--card2)', border:'1px solid var(--border)', color:'white' }} />
              </>
            )}
            <button onClick={gerar} disabled={loading} className="btn-primary text-xs py-1.5 px-4">
              {loading?'Gerando...':'Gerar'}
            </button>
          </div>
        )}
      </div>

      {/* Seleção */}
      <div className="pg-stats grid grid-cols-4 gap-2">
        {RELS.map(r => (
          <button key={r.key} onClick={()=>{ setAtivo(r.key); setDados(null) }}
            className="text-left p-2.5 rounded-xl transition-all"
            style={{ background:ativo===r.key?'rgba(249,115,22,0.12)':'var(--card)', border:`1.5px solid ${ativo===r.key?'#F97316':'var(--border)'}` }}>
            <r.icon size={14} color={ativo===r.key?'#F97316':'#94A3B8'} className="mb-1" />
            <p className="text-xs font-bold" style={{ color:ativo===r.key?'#F97316':'white' }}>{r.label}</p>
            <p className="text-[9px]" style={{ color:'var(--muted)' }}>{r.desc}</p>
          </button>
        ))}
      </div>

      {/* Resultado */}
      <div className="pg-body">
        {!ativo ? (
          <div className="flex items-center justify-center h-full" style={{ color:'var(--muted)' }}>
            <p className="text-xs">Selecione um relatório acima para gerar</p>
          </div>
        ) : !dados ? (
          <div className="flex items-center justify-center h-full" style={{ color:'var(--muted)' }}>
            <p className="text-xs">{loading?'Gerando relatório...':'Clique em "Gerar" para carregar os dados'}</p>
          </div>
        ) : (
          <div className="overflow-auto h-full">
            {/* DRE */}
            {ativo==='dre-simplificado' && (
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
            {ativo==='vendas-periodo' && dados.resumo && (
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

            {/* Vendas por Produto */}
            {ativo==='vendas-por-produto' && Array.isArray(dados) && (
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

            {/* Curva ABC */}
            {ativo==='curva-abc' && Array.isArray(dados) && (
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
            {ativo==='estoque-atual' && Array.isArray(dados) && (
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

            {/* Margem Produtos */}
            {ativo==='margem-produtos' && Array.isArray(dados) && (
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

            {/* Formas de Pagamento */}
            {ativo==='vendas-por-forma-pagamento' && Array.isArray(dados) && (
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
