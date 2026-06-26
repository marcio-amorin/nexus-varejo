'use client'
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { Plus, Search, Edit3, Trash2, X } from 'lucide-react'

export default function ClientesPage() {
  const [lista, setLista]       = useState<any[]>([])
  const [busca, setBusca]       = useState('')
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [saving, setSaving]     = useState(false)
  const [camposLivres, setCamposLivres] = useState<{id:number;campo:string;valor:string}[]>([])
  const [novoCampo, setNovoCampo] = useState({ campo:'', valor:'' })

  const [form, setForm] = useState({
    nome:'', tipo:'PF', documento:'', ie:'', email:'', telefone:'', celular:'',
    rua:'', numero:'', bairro:'', cidade:'', estado:'', cep:'',
    limite_credito:'0', credito_rotativo:'0', observacoes:'',
  })

  async function load() {
    setLoading(true)
    const r = await api.get('/clientes/', { params: { busca: busca||undefined } })
    setLista(r.data); setLoading(false)
  }
  useEffect(() => { load() }, [busca])

  async function openForm(c?: any) {
    if (c) {
      setEditando(c)
      setForm({ nome:c.nome, tipo:c.tipo, documento:c.documento||'', ie:c.ie||'',
        email:c.email||'', telefone:c.telefone||'', celular:c.celular||'',
        rua:c.rua||'', numero:c.numero||'', bairro:c.bairro||'',
        cidade:c.cidade||'', estado:c.estado||'', cep:c.cep||'',
        limite_credito:String(c.limite_credito||0),
        credito_rotativo:String(c.credito_rotativo||0), observacoes:c.observacoes||'' })
      try { setCamposLivres((await api.get(`/convenio/campos-livres/${c.id}`)).data) } catch { setCamposLivres([]) }
    } else {
      setEditando(null)
      setCamposLivres([])
      setForm({ nome:'', tipo:'PF', documento:'', ie:'', email:'', telefone:'', celular:'',
        rua:'', numero:'', bairro:'', cidade:'', estado:'', cep:'',
        limite_credito:'0', credito_rotativo:'0', observacoes:'' })
    }
    setShowForm(true)
  }

  async function adicionarCampo() {
    if (!novoCampo.campo || !editando) return
    await api.post('/convenio/campos-livres', { cliente_id: editando.id, campo: novoCampo.campo, valor: novoCampo.valor })
    setNovoCampo({ campo:'', valor:'' })
    setCamposLivres((await api.get(`/convenio/campos-livres/${editando.id}`)).data)
  }

  async function excluirCampo(id: number) {
    await api.delete(`/convenio/campos-livres/${id}`)
    if (editando) setCamposLivres((await api.get(`/convenio/campos-livres/${editando.id}`)).data)
  }

  async function salvar() {
    setSaving(true)
    try {
      const payload = { ...form, limite_credito: Number(form.limite_credito)||0, credito_rotativo: Number(form.credito_rotativo)||0 }
      if (editando) await api.put(`/clientes/${editando.id}`, payload)
      else          await api.post('/clientes/', payload)
      setShowForm(false); load()
    } catch (e: any) { alert(e.response?.data?.detail||'Erro ao salvar') }
    setSaving(false)
  }

  const inp = "w-full px-2.5 py-2 text-xs rounded-lg"

  return (
    <div className="pg">
      <div className="pg-header flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-base font-black text-white">Clientes</h1>
            <p className="text-[10px]" style={{ color:'var(--muted)' }}>{lista.length} cadastrado(s)</p>
          </div>
          <div className="relative">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color:'var(--muted)' }} />
            <input value={busca} onChange={e=>setBusca(e.target.value)}
              placeholder="Buscar cliente..." className="pl-7 pr-3 py-1.5 text-xs rounded-lg w-48"
              style={{ background:'var(--card2)', border:'1px solid var(--border)', color:'white' }} />
          </div>
        </div>
        <button onClick={()=>openForm()} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
          <Plus size={11}/> Novo Cliente
        </button>
      </div>

      <div className="pg-body">
        <table className="tbl">
          <thead><tr>
            {['Nome','Tipo','Documento','Contato','Cidade/UF',''].map(h=><th key={h}>{h}</th>)}
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8" style={{ color:'var(--muted)' }}>Carregando...</td></tr>
            ) : lista.length===0 ? (
              <tr><td colSpan={6} className="text-center py-10" style={{ color:'var(--muted)' }}>Nenhum cliente cadastrado</td></tr>
            ) : lista.map(c => (
              <tr key={c.id}>
                <td className="font-bold text-white">{c.nome}</td>
                <td><span className="badge" style={{ background:c.tipo==='PJ'?'#3B82F622':'#22C55E22', color:c.tipo==='PJ'?'#3B82F6':'#22C55E' }}>{c.tipo}</span></td>
                <td className="font-mono" style={{ color:'var(--muted)' }}>{c.documento||'—'}</td>
                <td style={{ color:'var(--muted)' }}>{c.telefone||c.celular||'—'}</td>
                <td style={{ color:'var(--muted)' }}>{[c.cidade,c.estado].filter(Boolean).join('/')||'—'}</td>
                <td>
                  <div className="flex gap-1">
                    <button onClick={()=>openForm(c)} className="w-6 h-6 rounded flex items-center justify-center"
                      style={{ background:'#F97316'+'22', color:'#F97316' }}><Edit3 size={11}/></button>
                    <button onClick={async()=>{ if(confirm('Remover?')){ await api.delete(`/clientes/${c.id}`); load() } }}
                      className="w-6 h-6 rounded flex items-center justify-center"
                      style={{ background:'#EF444422', color:'#EF4444' }}><Trash2 size={11}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.85)' }}>
          <div className="w-full max-w-lg rounded-2xl flex flex-col" style={{ background:'var(--card)', maxHeight:'90vh' }}>
            <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom:'1px solid var(--border)' }}>
              <p className="font-black text-white">{editando?'Editar Cliente':'Novo Cliente'}</p>
              <button onClick={()=>setShowForm(false)} style={{ color:'var(--muted)' }}><X size={16}/></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2.5">
              <div><label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>NOME *</label>
                <input value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} className={inp} /></div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>TIPO</label>
                  <select value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))} className={inp}>
                    <option value="PF">Pessoa Física</option>
                    <option value="PJ">Pessoa Jurídica</option>
                  </select></div>
                <div className="col-span-2"><label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>CPF / CNPJ</label>
                  <input value={form.documento} onChange={e=>setForm(f=>({...f,documento:e.target.value}))} className={inp} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>TELEFONE</label>
                  <input value={form.telefone} onChange={e=>setForm(f=>({...f,telefone:e.target.value}))} className={inp} /></div>
                <div><label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>CELULAR</label>
                  <input value={form.celular} onChange={e=>setForm(f=>({...f,celular:e.target.value}))} className={inp} /></div>
              </div>
              <div><label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>E-MAIL</label>
                <input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} type="email" className={inp} /></div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2"><label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>CIDADE</label>
                  <input value={form.cidade} onChange={e=>setForm(f=>({...f,cidade:e.target.value}))} className={inp} /></div>
                <div><label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>UF</label>
                  <input value={form.estado} maxLength={2} onChange={e=>setForm(f=>({...f,estado:e.target.value}))} className={inp} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>LIMITE CRÉDITO (R$)</label>
                  <input type="number" min="0" step="0.01" value={form.limite_credito}
                    onChange={e=>setForm(f=>({...f,limite_credito:e.target.value}))} className={inp} /></div>
                <div><label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>CRÉDITO ROTATIVO (R$)</label>
                  <input type="number" min="0" step="0.01" value={form.credito_rotativo}
                    onChange={e=>setForm(f=>({...f,credito_rotativo:e.target.value}))} className={inp} /></div>
              </div>
              {/* Campos livres — só quando editando */}
              {editando && (
                <div className="pt-1">
                  <p className="text-[10px] font-bold mb-2" style={{ color:'var(--muted)' }}>CAMPOS LIVRES</p>
                  {camposLivres.map(cf => (
                    <div key={cf.id} className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-white w-28 truncate">{cf.campo}</span>
                      <span className="text-xs flex-1" style={{ color:'var(--muted)' }}>{cf.valor}</span>
                      <button onClick={() => excluirCampo(cf.id)} className="text-[10px] px-1 py-0.5 rounded" style={{ background:'#EF444422', color:'#EF4444' }}>✕</button>
                    </div>
                  ))}
                  <div className="flex gap-1 mt-2">
                    <input placeholder="Campo" value={novoCampo.campo} onChange={e => setNovoCampo(f=>({...f,campo:e.target.value}))}
                      className={inp + " flex-1"} />
                    <input placeholder="Valor" value={novoCampo.valor} onChange={e => setNovoCampo(f=>({...f,valor:e.target.value}))}
                      className={inp + " flex-1"} />
                    <button onClick={adicionarCampo} disabled={!novoCampo.campo}
                      className="px-2.5 rounded-lg text-xs font-black" style={{ background:'#6366f1', color:'white' }}>+</button>
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 py-3" style={{ borderTop:'1px solid var(--border)' }}>
              <button onClick={salvar} disabled={saving||!form.nome} className="btn-primary w-full py-2.5 text-sm">
                {saving?'Salvando...':editando?'Salvar':'Cadastrar Cliente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
