'use client'
import { useEffect, useState } from 'react'
import api, { fmtMoeda } from '@/lib/api'
import { Plus, Edit2, Trash2, RefreshCw, ChevronRight, FileText, Check, Building2, Users } from 'lucide-react'

type Convenio = {
  id:number; cliente_id:number; cliente_nome:string; limite_mensal:number
  dia_fechamento:number; desconto_pct:number; ativo:boolean; responsavel:string; observacoes:string
}
type Lancamento = {
  id:number; descricao:string; valor:number; tipo:string; mes_ref:string; status:string; pago_em:string|null
}
type Fechamento = {
  cliente_nome:string; responsavel:string; mes_ref:string; limite_mensal:number
  total_debito:number; total_credito:number; saldo_devedor:number; total_pago:number; a_pagar:number
  lancamentos:Lancamento[]
}
type Cliente = { id:number; nome:string }

const BLANK = { cliente_id:0, limite_mensal:0, dia_fechamento:25, desconto_pct:0, ativo:true, responsavel:'', observacoes:'' }

export default function ConvenioPage() {
  const [convenios, setConvenios] = useState<Convenio[]>([])
  const [clientes, setClientes]   = useState<Cliente[]>([])
  const [loading, setLoading]     = useState(false)
  const [selected, setSelected]   = useState<Convenio|null>(null)
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [fechamento, setFechamento]   = useState<Fechamento|null>(null)
  const [mesRef, setMesRef] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  })

  // modais
  const [modalConv,  setModalConv]  = useState(false)
  const [modalLanc,  setModalLanc]  = useState(false)
  const [editConv,   setEditConv]   = useState<Partial<typeof BLANK>>(BLANK)
  const [formLanc,   setFormLanc]   = useState({ descricao:'', valor:0, tipo:'DEBITO', mes_ref:mesRef })
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [c, cl] = await Promise.all([
        api.get('/convenio'), api.get('/clientes?limit=500')
      ])
      setConvenios(c.data); setClientes(cl.data)
    } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function abrirConvenio(conv: Convenio) {
    setSelected(conv)
    const [l, f] = await Promise.all([
      api.get(`/convenio/${conv.id}/lancamentos?mes_ref=${mesRef}`),
      api.get(`/convenio/${conv.id}/fechamento/${mesRef}`)
    ])
    setLancamentos(l.data); setFechamento(f.data)
  }

  async function salvarConv() {
    setSaving(true)
    try {
      if ((editConv as any).id) await api.put(`/convenio/${(editConv as any).id}`, editConv)
      else                       await api.post('/convenio', editConv)
      setModalConv(false); load()
    } catch(e:any){ alert(e.response?.data?.detail||'Erro') }
    setSaving(false)
  }

  async function excluirConv(id:number) {
    if (!confirm('Excluir convênio?')) return
    await api.delete(`/convenio/${id}`); load()
    if (selected?.id === id) setSelected(null)
  }

  async function salvarLanc() {
    setSaving(true)
    try {
      await api.post('/convenio/lancamentos', { ...formLanc, convenio_id: selected!.id })
      setModalLanc(false)
      if (selected) abrirConvenio(selected)
    } catch(e:any){ alert(e.response?.data?.detail||'Erro') }
    setSaving(false)
  }

  async function pagarLanc(id:number) {
    await api.put(`/convenio/lancamentos/${id}/pagar`)
    if (selected) abrirConvenio(selected)
  }

  async function mudarMes(mes:string) {
    setMesRef(mes)
    if (selected) {
      const [l, f] = await Promise.all([
        api.get(`/convenio/${selected.id}/lancamentos?mes_ref=${mes}`),
        api.get(`/convenio/${selected.id}/fechamento/${mes}`)
      ])
      setLancamentos(l.data); setFechamento(f.data)
    }
  }

  if (selected && fechamento) return (
    <div className="pg">
      <div className="pg-header flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelected(null)} style={{ color:'var(--muted)' }}>
            <ChevronRight size={18} style={{ transform:'rotate(180deg)' }} />
          </button>
          <div>
            <h1 className="text-base font-black text-white">{fechamento.cliente_nome}</h1>
            <p className="text-[10px]" style={{ color:'var(--muted)' }}>
              {fechamento.responsavel || 'Convênio'} · Limite: {fmtMoeda(fechamento.limite_mensal)}
            </p>
          </div>
        </div>
        <button onClick={() => { setFormLanc({ descricao:'', valor:0, tipo:'DEBITO', mes_ref:mesRef }); setModalLanc(true) }}
          className="btn-primary text-xs flex items-center gap-1">
          <Plus size={12} /> Lançar
        </button>
      </div>

      {/* Seletor de mês */}
      <div className="px-4 py-2">
        <input type="month" value={mesRef} onChange={e => mudarMes(e.target.value)}
          className="field-input w-40 text-sm" />
      </div>

      {/* Resumo */}
      <div className="px-4 pb-2 grid grid-cols-3 gap-2">
        {[
          { l:'Compras', v: fechamento.total_debito, c:'#EF4444' },
          { l:'Créditos', v: fechamento.total_credito, c:'#34C759' },
          { l:'A Pagar', v: fechamento.a_pagar, c: fechamento.a_pagar > 0 ? '#FF9F0A' : '#34C759' },
        ].map(r => (
          <div key={r.l} className="rounded-xl p-3" style={{ background:'var(--card)' }}>
            <p className="text-[10px]" style={{ color:'var(--muted)' }}>{r.l}</p>
            <p className="font-black text-sm mt-0.5" style={{ color:r.c }}>{fmtMoeda(r.v)}</p>
          </div>
        ))}
      </div>

      {/* Lançamentos */}
      <div className="pg-body space-y-1">
        {lancamentos.length === 0 && (
          <p className="text-center py-8 text-xs" style={{ color:'var(--muted)' }}>Nenhum lançamento neste mês</p>
        )}
        {lancamentos.map(l => (
          <div key={l.id} className="rounded-xl p-3 flex items-center gap-3"
            style={{ background:'var(--card)', border:'1px solid var(--border)', opacity: l.status==='CANCELADO' ? 0.5 : 1 }}>
            <div className="flex-1">
              <p className="text-sm font-bold text-white">{l.descricao}</p>
              <p className="text-[10px]" style={{ color:'var(--muted)' }}>
                {l.mes_ref} · {l.tipo} ·
                <span className="font-bold ml-1" style={{ color: l.status==='PAGO' ? '#34C759' : 'var(--muted)' }}>
                  {l.status}
                </span>
              </p>
            </div>
            <p className="font-black" style={{ color: l.tipo==='DEBITO' ? '#EF4444' : '#34C759' }}>
              {l.tipo==='DEBITO' ? '-' : '+'}{fmtMoeda(l.valor)}
            </p>
            {l.status === 'ABERTO' && l.tipo === 'DEBITO' && (
              <button onClick={() => pagarLanc(l.id)}
                className="ml-2 px-2 py-1 rounded-lg text-xs font-bold"
                style={{ background:'#34C75922', color:'#34C759' }}>
                <Check size={11} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Modal lançamento */}
      {modalLanc && (
        <div className="modal-overlay" onClick={() => setModalLanc(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Novo Lançamento</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <label className="field-label">Descrição *</label>
                  <input className="field-input" value={formLanc.descricao} onChange={e => setFormLanc(f=>({...f,descricao:e.target.value}))} />
                </div>
                <div>
                  <label className="field-label">Tipo</label>
                  <select className="field-input" value={formLanc.tipo} onChange={e => setFormLanc(f=>({...f,tipo:e.target.value}))}>
                    <option value="DEBITO">Débito</option>
                    <option value="CREDITO">Crédito</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Valor (R$)</label>
                  <input type="number" step="0.01" className="field-input" value={formLanc.valor||''} onChange={e => setFormLanc(f=>({...f,valor:Number(e.target.value)}))} />
                </div>
                <div>
                  <label className="field-label">Mês Ref.</label>
                  <input type="month" className="field-input" value={formLanc.mes_ref} onChange={e => setFormLanc(f=>({...f,mes_ref:e.target.value}))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setModalLanc(false)} className="btn-secondary text-xs">Cancelar</button>
              <button onClick={salvarLanc} disabled={saving||!formLanc.descricao||!formLanc.valor} className="btn-primary text-xs">
                {saving ? 'Salvando...' : 'Lançar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="pg">
      <div className="pg-header flex items-center justify-between">
        <div>
          <h1 className="text-base font-black text-white">Convênio com Empresas</h1>
          <p className="text-[10px]" style={{ color:'var(--muted)' }}>Crédito convênio por cliente/empresa</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} style={{ color:'var(--muted)' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => { setEditConv({...BLANK}); setModalConv(true) }}
            className="btn-primary text-xs flex items-center gap-1">
            <Plus size={12} /> Novo
          </button>
        </div>
      </div>

      <div className="pg-body space-y-2">
        {convenios.length === 0 && !loading && (
          <div className="text-center py-12" style={{ color:'var(--muted)' }}>
            <Building2 size={40} className="mx-auto mb-3 opacity-30" />
            <p>Nenhum convênio cadastrado</p>
          </div>
        )}
        {convenios.map(c => (
          <div key={c.id} className="rounded-2xl p-4"
            style={{ background:'var(--card)', border:`1px solid ${c.ativo ? 'var(--border)' : '#EF444433'}` }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background:'#AF52DE22' }}>
                <Building2 size={16} color="#AF52DE" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-black text-white">{c.cliente_nome}</p>
                  {!c.ativo && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background:'#EF444422', color:'#EF4444' }}>INATIVO</span>}
                </div>
                <p className="text-xs" style={{ color:'var(--muted)' }}>
                  {c.responsavel && `${c.responsavel} · `}Limite: {fmtMoeda(c.limite_mensal)}/mês
                  {c.desconto_pct > 0 && ` · ${c.desconto_pct}% desconto`}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => abrirConvenio(c)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1"
                  style={{ background:'#AF52DE22', color:'#AF52DE' }}>
                  <FileText size={11} /> Extrato
                </button>
                <button onClick={() => { setEditConv({...c} as any); setModalConv(true) }}
                  className="px-3 py-1.5 rounded-xl text-xs" style={{ background:'var(--card2)', color:'var(--muted)' }}>
                  <Edit2 size={11} />
                </button>
                <button onClick={() => excluirConv(c.id)}
                  className="px-2 py-1.5 rounded-xl text-xs" style={{ background:'#EF444422', color:'#EF4444' }}>
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal convênio */}
      {modalConv && (
        <div className="modal-overlay" onClick={() => setModalConv(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{(editConv as any).id ? 'Editar Convênio' : 'Novo Convênio'}</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <label className="field-label">Cliente *</label>
                  <select className="field-input" value={editConv.cliente_id||0} onChange={e => setEditConv(f=>({...f,cliente_id:Number(e.target.value)}))}>
                    <option value={0}>— Selecione —</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Limite Mensal (R$)</label>
                  <input type="number" step="0.01" className="field-input" value={editConv.limite_mensal||0} onChange={e => setEditConv(f=>({...f,limite_mensal:Number(e.target.value)}))} />
                </div>
                <div>
                  <label className="field-label">Desconto (%)</label>
                  <input type="number" step="0.1" className="field-input" value={editConv.desconto_pct||0} onChange={e => setEditConv(f=>({...f,desconto_pct:Number(e.target.value)}))} />
                </div>
                <div>
                  <label className="field-label">Dia Fechamento</label>
                  <input type="number" min="1" max="28" className="field-input" value={editConv.dia_fechamento||25} onChange={e => setEditConv(f=>({...f,dia_fechamento:Number(e.target.value)}))} />
                </div>
                <div>
                  <label className="field-label">Responsável</label>
                  <input className="field-input" value={editConv.responsavel||''} onChange={e => setEditConv(f=>({...f,responsavel:e.target.value}))} />
                </div>
                <div className="col-span-2">
                  <label className="field-label">Observações</label>
                  <textarea className="field-input h-16 resize-none" value={editConv.observacoes||''} onChange={e => setEditConv(f=>({...f,observacoes:e.target.value}))} />
                </div>
                <div className="flex items-center gap-2 col-span-2">
                  <input type="checkbox" id="conv-ativo" checked={editConv.ativo !== false} onChange={e => setEditConv(f=>({...f,ativo:e.target.checked}))} />
                  <label htmlFor="conv-ativo" className="text-xs" style={{ color:'var(--muted)' }}>Convênio ativo</label>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setModalConv(false)} className="btn-secondary text-xs">Cancelar</button>
              <button onClick={salvarConv} disabled={saving||!editConv.cliente_id} className="btn-primary text-xs">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
