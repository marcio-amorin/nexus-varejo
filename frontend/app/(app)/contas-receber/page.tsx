'use client'
import { useEffect, useState } from 'react'
import api, { fmtMoeda, fmtData } from '@/lib/api'
import { Check, X, AlertTriangle, Plus } from 'lucide-react'

const SC: Record<string, { bg: string; color: string }> = {
  PENDENTE:  { bg:'#F59E0B22', color:'#F59E0B' },
  VENCIDO:   { bg:'#EF444422', color:'#EF4444' },
  RECEBIDO:  { bg:'#22C55E22', color:'#22C55E' },
  CANCELADO: { bg:'#6B728022', color:'#6B7280' },
}

export default function ContasReceberPage() {
  const [contas, setContas]   = useState<any[]>([])
  const [stats, setStats]     = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro]   = useState('')
  const [showBaixa, setShowBaixa] = useState<any>(null)
  const [showForm, setShowForm]   = useState(false)
  const [saving, setSaving]   = useState(false)
  const [clientes, setClientes]   = useState<any[]>([])
  const [baixa, setBaixa]     = useState({ recebido_em:new Date().toISOString().slice(0,10), valor_recebido:'', forma_pagamento:'DINHEIRO' })
  const [form, setForm]       = useState({ descricao:'', cliente_id:'', valor:'', vencimento:'', parcelas:'1' })

  async function load() {
    setLoading(true)
    const [rc, rs, rcl] = await Promise.all([
      api.get('/contas-receber/', { params: { status:filtro||undefined } }),
      api.get('/contas-receber/stats'),
      api.get('/clientes/'),
    ])
    setContas(rc.data); setStats(rs.data); setClientes(rcl.data); setLoading(false)
  }
  useEffect(() => { load() }, [filtro])

  async function darBaixa() {
    setSaving(true)
    try {
      await api.put(`/contas-receber/${showBaixa.id}/baixa`, {
        recebido_em: baixa.recebido_em, valor_recebido: Number(baixa.valor_recebido)||showBaixa.valor,
        forma_pagamento: baixa.forma_pagamento,
      })
      setShowBaixa(null); load()
    } catch (e: any) { alert(e.response?.data?.detail||'Erro') }
    setSaving(false)
  }

  const inp = "w-full px-2.5 py-2 text-xs rounded-lg"

  return (
    <div className="pg">
      <div className="pg-header flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-base font-black text-white">Contas a Receber</h1>
            {stats && <p className="text-[10px]" style={{ color:'var(--muted)' }}>Pendente: <span style={{ color:'#22C55E' }}>{fmtMoeda(stats.total_pendente)}</span></p>}
          </div>
          <div className="flex gap-1">
            {['','PENDENTE','VENCIDO','RECEBIDO'].map(s => (
              <button key={s} onClick={()=>setFiltro(s)}
                className="px-2.5 py-1 rounded-lg text-[10px] font-bold"
                style={{ background:filtro===s?'#22C55E':'var(--card2)', color:filtro===s?'white':'var(--muted)' }}>
                {s||'Todos'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {stats && (
            <div className="flex gap-2">
              {[{ l:'Vencidas',v:fmtMoeda(stats.vencidas),c:'#EF4444' },{ l:'Qtde',v:stats.quantidade,c:'var(--muted)' }].map(s=>(
                <div key={s.l} className="px-3 py-1.5 rounded-lg text-center" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
                  <p className="text-xs font-black" style={{ color:s.c }}>{s.v}</p>
                  <p className="text-[9px]" style={{ color:'var(--muted)' }}>{s.l}</p>
                </div>
              ))}
            </div>
          )}
          <button onClick={()=>setShowForm(true)} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
            <Plus size={11}/> Nova Conta
          </button>
        </div>
      </div>

      <div className="pg-body">
        <table className="tbl">
          <thead><tr>
            {['Descrição','Cliente','Vencimento','Valor','Parcela','Status',''].map(h=><th key={h}>{h}</th>)}
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8" style={{ color:'var(--muted)' }}>Carregando...</td></tr>
            ) : contas.length===0 ? (
              <tr><td colSpan={7} className="text-center py-10" style={{ color:'var(--muted)' }}>Nenhuma conta</td></tr>
            ) : contas.map(c => {
              const sc = SC[c.status]||SC.PENDENTE
              return (
                <tr key={c.id}>
                  <td className="font-semibold text-white max-w-[180px] truncate">{c.descricao}</td>
                  <td style={{ color:'var(--muted)' }}>{c.cliente_nome||'—'}</td>
                  <td style={{ color:c.vencida?'#EF4444':'var(--muted)' }}>
                    {c.vencida && <AlertTriangle size={10} className="inline mr-0.5"/>}
                    {fmtData(c.vencimento)}
                  </td>
                  <td className="font-bold" style={{ color:'#22C55E' }}>{fmtMoeda(c.valor)}</td>
                  <td className="text-center" style={{ color:'var(--muted)' }}>{c.parcela_num}/{c.total_parcelas}</td>
                  <td><span className="badge" style={{ background:sc.bg, color:sc.color }}>{c.status}</span></td>
                  <td>
                    {(c.status==='PENDENTE'||c.status==='VENCIDO') && (
                      <button onClick={()=>{ setShowBaixa(c); setBaixa({ recebido_em:new Date().toISOString().slice(0,10), valor_recebido:String(c.valor), forma_pagamento:'DINHEIRO' }) }}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold"
                        style={{ background:'#22C55E22', color:'#22C55E' }}>
                        <Check size={10}/> Receber
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.85)' }}>
          <div className="w-full max-w-sm rounded-2xl p-5 space-y-3" style={{ background:'var(--card)' }}>
            <div className="flex items-center justify-between">
              <p className="font-black text-white">Nova Conta a Receber</p>
              <button onClick={()=>{ setShowForm(false); setForm({ descricao:'', cliente_id:'', valor:'', vencimento:'', parcelas:'1' }) }} style={{ color:'var(--muted)' }}><X size={16}/></button>
            </div>
            <input value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))} placeholder="Descrição *" className={inp} style={{ background:'var(--input)', border:'1px solid var(--border)', color:'white', outline:'none' }} />
            <select value={form.cliente_id} onChange={e=>setForm(f=>({...f,cliente_id:e.target.value}))} className={inp} style={{ background:'var(--input)', border:'1px solid var(--border)', color:'white', outline:'none' }}>
              <option value="">Cliente (opcional)</option>
              {clientes.map((c:any)=><option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input value={form.valor} type="number" step="0.01" placeholder="Valor total *" onChange={e=>setForm(f=>({...f,valor:e.target.value}))} className={inp} style={{ background:'var(--input)', border:'1px solid var(--border)', color:'white', outline:'none' }} />
              <input value={form.vencimento} type="date" onChange={e=>setForm(f=>({...f,vencimento:e.target.value}))} className={inp} style={{ background:'var(--input)', border:'1px solid var(--border)', color:'white', outline:'none' }} />
            </div>
            <div>
              <label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>PARCELAS</label>
              <select value={form.parcelas} onChange={e=>setForm(f=>({...f,parcelas:e.target.value}))} className={inp} style={{ background:'var(--input)', border:'1px solid var(--border)', color:'white', outline:'none' }}>
                {[1,2,3,4,6,8,10,12].map(n=><option key={n} value={n}>{n}x</option>)}
              </select>
            </div>
            <button onClick={async()=>{
              if(!form.descricao||!form.valor||!form.vencimento) return
              setSaving(true)
              try {
                const parcelas = Number(form.parcelas)||1
                const valor = Number(form.valor)
                const venc = new Date(form.vencimento)
                for (let i=0; i<parcelas; i++) {
                  const vencParcela = new Date(venc)
                  vencParcela.setMonth(vencParcela.getMonth() + i)
                  await api.post('/contas-receber/', {
                    descricao: parcelas>1 ? `${form.descricao} — Parcela ${i+1}/${parcelas}` : form.descricao,
                    cliente_id: form.cliente_id ? Number(form.cliente_id) : null,
                    valor: Math.round(valor/parcelas*100)/100,
                    vencimento: vencParcela.toISOString().slice(0,10),
                    parcela_num: i+1,
                    total_parcelas: parcelas,
                  })
                }
                setShowForm(false)
                setForm({ descricao:'', cliente_id:'', valor:'', vencimento:'', parcelas:'1' })
                load()
              } catch (e:any) { alert(e.response?.data?.detail||'Erro') }
              setSaving(false)
            }} disabled={saving} className="btn-primary w-full py-2.5 text-sm">
              {saving?'Salvando...':'Cadastrar Conta'}
            </button>
          </div>
        </div>
      )}

      {showBaixa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.85)' }}>
          <div className="w-full max-w-xs rounded-2xl p-5 space-y-3" style={{ background:'var(--card)' }}>
            <div className="flex items-center justify-between">
              <p className="font-black text-white">Confirmar Recebimento</p>
              <button onClick={()=>setShowBaixa(null)} style={{ color:'var(--muted)' }}><X size={16}/></button>
            </div>
            <div className="p-2.5 rounded-xl" style={{ background:'var(--card2)' }}>
              <p className="font-semibold text-white text-xs">{showBaixa.descricao}</p>
              <p className="text-[10px]" style={{ color:'#22C55E' }}>{fmtMoeda(showBaixa.valor)}</p>
            </div>
            <input type="date" value={baixa.recebido_em} onChange={e=>setBaixa(b=>({...b,recebido_em:e.target.value}))} className={inp} />
            <input value={baixa.valor_recebido} type="number" placeholder="Valor recebido" onChange={e=>setBaixa(b=>({...b,valor_recebido:e.target.value}))} className={inp} />
            <select value={baixa.forma_pagamento} onChange={e=>setBaixa(b=>({...b,forma_pagamento:e.target.value}))} className={inp}>
              {['DINHEIRO','PIX','CARTAO_DEBITO','CARTAO_CREDITO','BOLETO','TRANSFERENCIA'].map(f=><option key={f}>{f}</option>)}
            </select>
            <button onClick={darBaixa} disabled={saving} className="btn-primary w-full py-2.5 text-sm">
              {saving?'Processando...':'Confirmar Recebimento'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
