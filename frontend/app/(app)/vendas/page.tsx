'use client'
import { useEffect, useState } from 'react'
import api, { fmtMoeda, fmtData } from '@/lib/api'
import { Search, Eye, X, AlertTriangle } from 'lucide-react'

const SC: Record<string, { bg: string; color: string }> = {
  FINALIZADA: { bg: '#22C55E22', color: '#22C55E' },
  ABERTA:     { bg: '#F59E0B22', color: '#F59E0B' },
  CANCELADA:  { bg: '#EF444422', color: '#EF4444' },
}
const FORMAS: Record<string, string> = {
  DINHEIRO:'Dinheiro', PIX:'PIX', CARTAO_DEBITO:'Débito', CARTAO_CREDITO:'Crédito', CREDIARIO:'Crediário', BOLETO:'Boleto',
}

export default function VendasPage() {
  const [vendas, setVendas]     = useState<any[]>([])
  const [stats, setStats]       = useState<any>(null)
  const [loading, setLoading]   = useState(true)
  const [busca, setBusca]       = useState('')
  const [detalhe, setDetalhe]   = useState<any>(null)
  const [dataIni, setDataIni]   = useState(new Date().toISOString().slice(0,8)+'01')
  const [dataFim, setDataFim]   = useState(new Date().toISOString().slice(0,10))
  const [cancelando, setCancelando] = useState(false)

  async function load() {
    setLoading(true)
    const [rv, rs] = await Promise.all([
      api.get('/vendas/', { params: { data_ini:dataIni, data_fim:dataFim, busca:busca||undefined } }),
      api.get('/vendas/stats', { params: { data_ini:dataIni, data_fim:dataFim } }),
    ])
    setVendas(rv.data); setStats(rs.data); setLoading(false)
  }
  useEffect(() => { load() }, [dataIni, dataFim])

  async function cancelar(id: number) {
    if (!confirm('Cancelar venda? O estoque será reposto.')) return
    setCancelando(true)
    try { await api.delete(`/vendas/${id}`); setDetalhe(null); load() }
    catch (e: any) { alert(e.response?.data?.detail||'Erro') }
    setCancelando(false)
  }

  return (
    <div className="pg">
      {/* Header */}
      <div className="pg-header flex items-center justify-between gap-3">
        <h1 className="text-base font-black text-white">Histórico de Vendas</h1>
        <div className="flex items-center gap-2">
          <input type="date" value={dataIni} onChange={e=>setDataIni(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg"
            style={{ background:'var(--card2)', border:'1px solid var(--border)', color:'white' }} />
          <span className="text-xs" style={{ color:'var(--muted)' }}>até</span>
          <input type="date" value={dataFim} onChange={e=>setDataFim(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg"
            style={{ background:'var(--card2)', border:'1px solid var(--border)', color:'white' }} />
          <div className="relative">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color:'var(--muted)' }} />
            <input value={busca} onChange={e=>setBusca(e.target.value)} onKeyDown={e=>e.key==='Enter'&&load()}
              placeholder="Nº, cliente..." className="pl-7 pr-3 py-1.5 text-xs rounded-lg w-36"
              style={{ background:'var(--card2)', border:'1px solid var(--border)', color:'white' }} />
          </div>
          <button onClick={load} className="btn-primary text-xs py-1.5 px-3">Filtrar</button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="pg-stats grid grid-cols-5 gap-2">
          {[
            { l:'Vendas',  v:stats.total_vendas,              c:'#F97316' },
            { l:'Faturado',v:fmtMoeda(stats.total_faturado), c:'#EA580C' },
            { l:'Custo',   v:fmtMoeda(stats.total_custo),    c:'#EF4444' },
            { l:'Lucro',   v:fmtMoeda(stats.lucro_bruto),    c:'#22C55E' },
            { l:'Margem',  v:`${stats.margem_media?.toFixed(1)}%`, c:'#3B82F6' },
          ].map(s => (
            <div key={s.l} className="p-2.5 rounded-xl" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
              <p className="text-sm font-black" style={{ color:s.c }}>{s.v}</p>
              <p className="text-[10px]" style={{ color:'var(--muted)' }}>{s.l}</p>
            </div>
          ))}
        </div>
      )}

      <div className="pg-body">
        <table className="tbl">
          <thead><tr>
            {['Número','Data/Hora','Cliente','Forma','Total','Lucro','Status',''].map(h=><th key={h}>{h}</th>)}
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-8" style={{ color:'var(--muted)' }}>Carregando...</td></tr>
            ) : vendas.length===0 ? (
              <tr><td colSpan={8} className="text-center py-10" style={{ color:'var(--muted)' }}>Nenhuma venda encontrada</td></tr>
            ) : vendas.map(v => {
              const sc = SC[v.status]||SC.ABERTA
              return (
                <tr key={v.id}>
                  <td className="font-mono font-bold" style={{ color:'#F97316' }}>{v.numero}</td>
                  <td style={{ color:'var(--muted)' }}>
                    {fmtData(v.data_venda)}
                    {v.hora && <span className="block text-[10px]">{v.hora}</span>}
                  </td>
                  <td className="text-white">{v.cliente_nome||'Consumidor'}</td>
                  <td style={{ color:'var(--muted)' }}>
                    {FORMAS[v.forma_pagamento]||v.forma_pagamento}
                    {v.parcelas>1 && <span className="block text-[10px]">{v.parcelas}x</span>}
                  </td>
                  <td className="font-bold" style={{ color:'#F97316' }}>{fmtMoeda(v.total)}</td>
                  <td className="font-semibold" style={{ color:'#22C55E' }}>{v.lucro!=null?fmtMoeda(v.lucro):'—'}</td>
                  <td><span className="badge" style={{ background:sc.bg, color:sc.color }}>{v.status}</span></td>
                  <td>
                    <button onClick={async()=>{ const r=await api.get(`/vendas/${v.id}`); setDetalhe(r.data) }}
                      className="w-6 h-6 rounded flex items-center justify-center"
                      style={{ background:'#F97316'+'22', color:'#F97316' }}><Eye size={11}/></button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {detalhe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.85)' }}>
          <div className="w-full max-w-lg rounded-2xl flex flex-col" style={{ background:'var(--card)', maxHeight:'88vh' }}>
            <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom:'1px solid var(--border)' }}>
              <div>
                <p className="font-black text-white">{detalhe.numero}</p>
                <p className="text-[10px]" style={{ color:'var(--muted)' }}>{fmtData(detalhe.data_venda)}</p>
              </div>
              <div className="flex items-center gap-2">
                {detalhe.status==='FINALIZADA' && (
                  <button onClick={()=>cancelar(detalhe.id)} disabled={cancelando}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold"
                    style={{ background:'#EF444422', color:'#EF4444' }}>
                    <AlertTriangle size={11}/> {cancelando?'Cancelando...':'Cancelar'}
                  </button>
                )}
                <button onClick={()=>setDetalhe(null)} style={{ color:'var(--muted)' }}><X size={16}/></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[['CLIENTE',detalhe.cliente_nome||'Consumidor'],['OPERADOR',detalhe.operador||'—'],
                  ['PAGAMENTO',FORMAS[detalhe.forma_pagamento]||detalhe.forma_pagamento],
                  ['STATUS',detalhe.status]].map(([k,v],i)=>(
                  <div key={i}>
                    <p className="font-bold mb-0.5" style={{ color:'var(--muted)' }}>{k}</p>
                    <p className="text-white">{v}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl overflow-hidden" style={{ border:'1px solid var(--border)' }}>
                <table className="tbl">
                  <thead><tr>{['Produto','Qtde','Unit.','Total'].map(h=><th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {detalhe.itens?.map((it:any,i:number)=>(
                      <tr key={i}>
                        <td className="text-white">{it.descricao||it.produto_nome}</td>
                        <td style={{ color:'var(--muted)' }}>{it.quantidade}</td>
                        <td style={{ color:'var(--muted)' }}>{fmtMoeda(it.preco_unitario)}</td>
                        <td className="font-bold" style={{ color:'#F97316' }}>{fmtMoeda(it.total_item)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between text-sm pt-1">
                {detalhe.desconto>0 && <>
                  <span style={{ color:'var(--muted)' }}>Desconto</span>
                  <span style={{ color:'#EF4444' }}>- {fmtMoeda(detalhe.desconto)}</span>
                </>}
              </div>
              <div className="flex justify-between font-black">
                <span className="text-white">TOTAL</span>
                <span style={{ color:'#F97316' }}>{fmtMoeda(detalhe.total)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
