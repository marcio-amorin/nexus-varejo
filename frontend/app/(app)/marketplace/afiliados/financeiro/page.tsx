'use client'
import { useEffect, useState } from 'react'
import { DollarSign, TrendingUp, Clock, BarChart2, Plus, RefreshCw } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'
const GRAD = 'linear-gradient(135deg,#ea580c 0%,#f97316 40%,#f59e0b 80%,#fbbf24 100%)'

function fmtR(v:number) { return v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) }
function hdr() { return { 'Content-Type':'application/json', Authorization:`Bearer ${localStorage.getItem('token')}` } }

const STATUS_COR: Record<string,{bg:string;cor:string}> = {
  PENDENTE: { bg:'rgba(245,158,11,0.2)', cor:'#f59e0b' },
  APROVADO: { bg:'rgba(59,130,246,0.2)', cor:'#3b82f6' },
  PAGO:     { bg:'rgba(34,197,94,0.2)', cor:'#22c55e' },
  CANCELADO:{ bg:'rgba(239,68,68,0.2)', cor:'#ef4444' },
}

const hoje = new Date()
const FORM_INIT = { plataforma:'ML_AFILIADOS', titulo_produto:'', data_venda:hoje.toISOString().slice(0,10), valor_venda:'', comissao_pct:'', comissao_valor:'', status:'PENDENTE' }

export default function FinanceiroAfiliados() {
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`
  const [projecao, setProjecao]   = useState<any>(null)
  const [comissoes, setCom]       = useState<any[]>([])
  const [filtroSt, setFiltroSt]   = useState('')
  const [filtroMes, setFiltroMes] = useState(mesAtual)
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState(FORM_INIT)

  useEffect(() => { carregar(); carregarPr() }, [filtroSt, filtroMes])

  async function carregar() {
    const p = new URLSearchParams()
    if (filtroSt) p.set('status',filtroSt)
    if (filtroMes) p.set('mes_ano',filtroMes)
    const r = await fetch(`${API}/afiliados/comissoes?${p}`, { headers:hdr() })
    setCom(await r.json())
  }

  async function carregarPr() {
    const r = await fetch(`${API}/afiliados/financeiro/projecao`, { headers:hdr() })
    setProjecao(await r.json())
  }

  async function registrar(e:any) {
    e.preventDefault()
    await fetch(`${API}/afiliados/comissoes`, { method:'POST', headers:hdr(), body:JSON.stringify({ ...form, valor_venda:parseFloat(form.valor_venda)||0, comissao_pct:parseFloat(form.comissao_pct)||0, comissao_valor:parseFloat(form.comissao_valor)||0 }) })
    setShowForm(false); setForm(FORM_INIT); carregar()
  }

  async function atualizarStatus(id:number, status:string) {
    await fetch(`${API}/afiliados/comissoes/${id}/status?status=${status}`, { method:'PATCH', headers:hdr() })
    carregar()
  }

  const totalFiltro = comissoes.reduce((s,c) => s+(c.comissao_valor||0),0)

  return (
    <div className="pg">
      {/* Header */}
      <div className="pg-header rounded-xl overflow-hidden" style={{ background:GRAD }}>
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-black text-white flex items-center gap-2"><DollarSign size={16}/> Financeiro — Comissões</h1>
            <p className="text-xs text-white/75 mt-0.5">Acompanhe seus ganhos com marketing de afiliados</p>
          </div>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background:'rgba(255,255,255,0.2)', color:'#fff', border:'1px solid rgba(255,255,255,0.35)' }}>
            <Plus size={13}/> Registrar
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="pg-stats grid grid-cols-4 gap-2">
        {[
          { label:'A Receber',       value:fmtR(projecao?.a_receber||0),     cor:'#f59e0b', icon:Clock },
          { label:'Projeção Próx. Mês', value:fmtR(projecao?.projecao_mes||0), cor:'#3b82f6', icon:TrendingUp },
          { label:'Total Filtrado',  value:fmtR(totalFiltro),                cor:'#22c55e', icon:DollarSign },
          { label:'Registros',       value:String(comissoes.length),         cor:'#8b5cf6', icon:BarChart2 },
        ].map((k,i) => (
          <div key={i} className="rounded-xl p-3" style={{ background:'var(--card)', border:`1px solid ${k.cor}30` }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-2" style={{ background:k.cor+'20' }}>
              <k.icon size={14} color={k.cor}/>
            </div>
            <p className="text-lg font-black" style={{ color:k.cor }}>{k.value}</p>
            <p className="text-[10px] mt-0.5" style={{ color:'var(--muted)' }}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* Gráfico histórico */}
      {projecao?.historico && (
        <div className="pg-stats rounded-xl p-3" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
          <p className="text-[10px] font-black tracking-widest mb-2" style={{ color:'var(--muted)' }}>EVOLUÇÃO 6 MESES</p>
          <div className="flex items-end gap-1.5 h-16">
            {projecao.historico.map((h:any, i:number) => {
              const max = Math.max(...projecao.historico.map((x:any)=>x.valor),1)
              const pct = h.valor/max*100
              const isLast = i===projecao.historico.length-1
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-t" style={{ height:`${Math.max(pct,3)}%`, background:isLast?GRAD:'var(--card2)' }}/>
                  <p className="text-[9px]" style={{ color:'var(--muted)' }}>{h.mes.slice(5)}</p>
                  <p className="text-[9px] font-black" style={{ color:isLast?'#f97316':'#3b82f6' }}>{fmtR(h.valor)}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="pg-stats flex gap-2 items-center flex-wrap">
        <input type="month" value={filtroMes} onChange={e => setFiltroMes(e.target.value)} className="px-2 py-1.5 rounded-lg text-xs"/>
        {['','PENDENTE','APROVADO','PAGO'].map(s => (
          <button key={s} onClick={() => setFiltroSt(s)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background:filtroSt===s?(s?STATUS_COR[s]?.bg:'#f97316'):'var(--card2)', color:filtroSt===s?(s?STATUS_COR[s]?.cor:'#fff'):'var(--muted)', border:filtroSt===s?'none':'1px solid var(--border)' }}>
            {s||'Todos'}
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div className="pg-body">
        {comissoes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color:'var(--muted)' }}>
            <DollarSign size={32}/><p className="text-xs">Nenhuma comissão registrada</p>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr><th>Produto</th><th>Plataforma</th><th>Data</th><th>Vl. Venda</th><th>Comissão</th><th>Status</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {comissoes.map((c:any, i:number) => {
                const sc = STATUS_COR[c.status]||STATUS_COR.PENDENTE
                return (
                  <tr key={i}>
                    <td className="font-medium text-white" style={{ maxWidth:160 }}><p className="truncate">{c.titulo_produto||'—'}</p></td>
                    <td style={{ color:'var(--muted)' }}>{c.plataforma}</td>
                    <td style={{ color:'var(--muted)' }}>{c.data_venda||'—'}</td>
                    <td style={{ color:'var(--text)' }}>{fmtR(c.valor_venda)}</td>
                    <td className="font-black" style={{ color:'#22c55e' }}>{fmtR(c.comissao_valor)}</td>
                    <td><span className="badge" style={{ background:sc.bg, color:sc.cor }}>{c.status}</span></td>
                    <td>
                      <div className="flex gap-1">
                        {c.status==='PENDENTE' && <button onClick={()=>atualizarStatus(c.id,'APROVADO')} className="text-[10px] px-2 py-1 rounded-lg font-bold" style={{ background:'rgba(59,130,246,0.2)', color:'#3b82f6' }}>Aprovar</button>}
                        {c.status==='APROVADO' && <button onClick={()=>atualizarStatus(c.id,'PAGO')} className="text-[10px] px-2 py-1 rounded-lg font-bold" style={{ background:'rgba(34,197,94,0.2)', color:'#22c55e' }}>Pago</button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background:'rgba(0,0,0,0.7)' }}>
          <form onSubmit={registrar} className="rounded-2xl overflow-hidden w-full max-w-md mx-4" style={{ background:'var(--card)', border:'1px solid #f97316' }}>
            <div className="px-5 py-3" style={{ background:GRAD }}>
              <p className="font-black text-white text-sm">Registrar Comissão</p>
            </div>
            <div className="p-4 space-y-2.5">
              {[
                { label:'Plataforma', key:'plataforma', type:'select', opts:['ML_AFILIADOS','SHOPEE','AMAZON'] },
                { label:'Produto', key:'titulo_produto', type:'text', ph:'Nome do produto' },
                { label:'Data da Venda', key:'data_venda', type:'date' },
                { label:'Valor da Venda (R$)', key:'valor_venda', type:'number', ph:'0.00' },
                { label:'Comissão %', key:'comissao_pct', type:'number', ph:'0' },
                { label:'Comissão R$', key:'comissao_valor', type:'number', ph:'0.00' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-[10px] font-bold block mb-1" style={{ color:'var(--muted)' }}>{f.label}</label>
                  {f.type==='select'
                    ? <select value={(form as any)[f.key]} onChange={e => setForm({...form,[f.key]:e.target.value})} className="w-full px-2 py-2 rounded-lg text-xs">
                        {f.opts?.map(o=><option key={o}>{o}</option>)}
                      </select>
                    : <input type={f.type} value={(form as any)[f.key]} placeholder={f.ph} onChange={e => setForm({...form,[f.key]:e.target.value})} className="w-full px-2 py-2 rounded-lg text-xs"/>
                  }
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-xl text-xs font-bold" style={{ background:'var(--card2)', color:'var(--muted)', border:'1px solid var(--border)' }}>Cancelar</button>
                <button type="submit" className="btn-primary flex-1 py-2 text-xs">Registrar</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
