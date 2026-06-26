'use client'
import { useEffect, useState } from 'react'
import api, { fmtMoeda, fmtData } from '@/lib/api'
import { Plus, Check, X, AlertTriangle } from 'lucide-react'

const SC: Record<string, { bg: string; color: string }> = {
  PENDENTE:  { bg:'#F59E0B22', color:'#F59E0B' },
  VENCIDO:   { bg:'#EF444422', color:'#EF4444' },
  PAGO:      { bg:'#22C55E22', color:'#22C55E' },
  CANCELADO: { bg:'#6B728022', color:'#6B7280' },
}

export default function ContasPagarPage() {
  const [contas, setContas]   = useState<any[]>([])
  const [stats, setStats]     = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro]   = useState('')
  const [showBaixa, setShowBaixa] = useState<any>(null)
  const [showForm, setShowForm]   = useState(false)
  const [saving, setSaving]   = useState(false)
  const [fornecedores, setFornecedores] = useState<any[]>([])

  const [form, setForm] = useState({ descricao:'', fornecedor_id:'', valor:'', vencimento:'', parcelas:'1', observacoes:'' })
  const [baixa, setBaixa] = useState({ pago_em:new Date().toISOString().slice(0,10), valor_pago:'', forma_pagamento:'DINHEIRO' })

  async function load() {
    setLoading(true)
    const [rc, rs, rf] = await Promise.all([
      api.get('/contas-pagar/', { params: { status:filtro||undefined } }),
      api.get('/contas-pagar/stats'),
      api.get('/fornecedores/'),
    ])
    setContas(rc.data); setStats(rs.data); setFornecedores(rf.data); setLoading(false)
  }
  useEffect(() => { load() }, [filtro])

  async function darBaixa() {
    setSaving(true)
    try {
      await api.put(`/contas-pagar/${showBaixa.id}/baixa`, {
        pago_em: baixa.pago_em, valor_pago: Number(baixa.valor_pago)||showBaixa.valor,
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
            <h1 className="text-base font-black text-white">Contas a Pagar</h1>
            {stats && <p className="text-[10px]" style={{ color:'var(--muted)' }}>Pendente: <span style={{ color:'#F59E0B' }}>{fmtMoeda(stats.total_pendente)}</span></p>}
          </div>
          <div className="flex gap-1">
            {['','PENDENTE','VENCIDO','PAGO'].map(s => (
              <button key={s} onClick={()=>setFiltro(s)}
                className="px-2.5 py-1 rounded-lg text-[10px] font-bold"
                style={{ background:filtro===s?'#F97316':'var(--card2)', color:filtro===s?'white':'var(--muted)' }}>
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
            {['Descrição','Fornecedor','Vencimento','Valor','Parcela','Status',''].map(h=><th key={h}>{h}</th>)}
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
                  <td style={{ color:'var(--muted)' }}>{c.fornecedor_nome||'—'}</td>
                  <td style={{ color:c.vencida?'#EF4444':'var(--muted)' }}>
                    {c.vencida && <AlertTriangle size={10} className="inline mr-0.5"/>}
                    {fmtData(c.vencimento)}
                  </td>
                  <td className="font-bold" style={{ color:'#F97316' }}>{fmtMoeda(c.valor)}</td>
                  <td className="text-center" style={{ color:'var(--muted)' }}>{c.parcela_num}/{c.total_parcelas}</td>
                  <td><span className="badge" style={{ background:sc.bg, color:sc.color }}>{c.status}</span></td>
                  <td>
                    {(c.status==='PENDENTE'||c.status==='VENCIDO') && (
                      <button onClick={()=>{ setShowBaixa(c); setBaixa({ pago_em:new Date().toISOString().slice(0,10), valor_pago:String(c.valor), forma_pagamento:'DINHEIRO' }) }}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold"
                        style={{ background:'#22C55E22', color:'#22C55E' }}>
                        <Check size={10}/> Pagar
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showBaixa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.85)' }}>
          <div className="w-full max-w-xs rounded-2xl p-5 space-y-3" style={{ background:'var(--card)' }}>
            <div className="flex items-center justify-between">
              <p className="font-black text-white">Dar Baixa</p>
              <button onClick={()=>setShowBaixa(null)} style={{ color:'var(--muted)' }}><X size={16}/></button>
            </div>
            <div className="p-2.5 rounded-xl" style={{ background:'var(--card2)' }}>
              <p className="font-semibold text-white text-xs">{showBaixa.descricao}</p>
              <p className="text-[10px]" style={{ color:'#F97316' }}>{fmtMoeda(showBaixa.valor)}</p>
            </div>
            <input type="date" value={baixa.pago_em} onChange={e=>setBaixa(b=>({...b,pago_em:e.target.value}))} className={inp} />
            <input value={baixa.valor_pago} type="number" placeholder="Valor pago" onChange={e=>setBaixa(b=>({...b,valor_pago:e.target.value}))} className={inp} />
            <select value={baixa.forma_pagamento} onChange={e=>setBaixa(b=>({...b,forma_pagamento:e.target.value}))} className={inp}>
              {['DINHEIRO','PIX','CARTAO_DEBITO','CARTAO_CREDITO','BOLETO','TRANSFERENCIA'].map(f=><option key={f}>{f}</option>)}
            </select>
            <button onClick={darBaixa} disabled={saving} className="btn-primary w-full py-2.5 text-sm">
              {saving?'Processando...':'Confirmar Pagamento'}
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.85)' }}>
          <div className="w-full max-w-sm rounded-2xl p-5 space-y-3" style={{ background:'var(--card)' }}>
            <div className="flex items-center justify-between">
              <p className="font-black text-white">Nova Conta a Pagar</p>
              <button onClick={()=>{ setShowForm(false); setForm({ descricao:'', fornecedor_id:'', valor:'', vencimento:'', parcelas:'1', observacoes:'' }) }} style={{ color:'var(--muted)' }}><X size={16}/></button>
            </div>
            <input value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))} placeholder="Descrição *" className={inp} style={{ background:'var(--input)', border:'1px solid var(--border)', color:'white', outline:'none' }} />
            <select value={form.fornecedor_id} onChange={e=>setForm(f=>({...f,fornecedor_id:e.target.value}))} className={inp} style={{ background:'var(--input)', border:'1px solid var(--border)', color:'white', outline:'none' }}>
              <option value="">Fornecedor (opcional)</option>
              {fornecedores.map((f:any)=><option key={f.id} value={f.id}>{f.razao_social}</option>)}
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
                  await api.post('/contas-pagar/', {
                    descricao: parcelas>1 ? `${form.descricao} — Parcela ${i+1}/${parcelas}` : form.descricao,
                    fornecedor_id: form.fornecedor_id ? Number(form.fornecedor_id) : null,
                    valor: Math.round(valor/parcelas*100)/100,
                    vencimento: vencParcela.toISOString().slice(0,10),
                    parcela_num: i+1,
                    total_parcelas: parcelas,
                    observacoes: form.observacoes||null,
                  })
                }
                setShowForm(false)
                setForm({ descricao:'', fornecedor_id:'', valor:'', vencimento:'', parcelas:'1', observacoes:'' })
                load()
              } catch (e:any) { alert(e.response?.data?.detail||'Erro') }
              setSaving(false)
            }} disabled={saving} className="btn-primary w-full py-2.5 text-sm">
              {saving?'Salvando...':'Cadastrar Conta'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
