'use client'
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { Plus, Edit2, X, Check } from 'lucide-react'

const PERFIS = [
  { key:'ADMIN',    label:'Admin',    cor:'#EF4444' },
  { key:'GERENTE',  label:'Gerente',  cor:'#F59E0B' },
  { key:'OPERADOR', label:'Operador', cor:'#3B82F6' },
  { key:'CAIXA',    label:'Caixa',    cor:'#22C55E' },
]
const PERMS = [
  { key:'pdv',           label:'PDV Caixa' },
  { key:'vendas',        label:'Vendas' },
  { key:'compras',       label:'Compras' },
  { key:'estoque',       label:'Estoque' },
  { key:'financeiro',    label:'Financeiro' },
  { key:'relatorios',    label:'Relatórios' },
  { key:'usuarios',      label:'Usuários' },
  { key:'configuracoes', label:'Config.' },
]

export default function UsuariosPage() {
  const [lista, setLista]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm]       = useState<any>(null)
  const [saving, setSaving]   = useState(false)

  async function load() {
    setLoading(true)
    const r = await api.get('/usuarios/')
    setLista(r.data); setLoading(false)
  }
  useEffect(() => { load() }, [])

  function abrirNovo() {
    setForm({ nome:'', email:'', senha:'', perfil:'OPERADOR', permissoes:['pdv','vendas','estoque'], is_active:true, _novo:true })
  }
  function togglePerm(perm: string) {
    setForm((f: any) => ({ ...f, permissoes: f.permissoes.includes(perm) ? f.permissoes.filter((p:string)=>p!==perm) : [...f.permissoes, perm] }))
  }
  function aplicarPerfil(perfil: string) {
    const d: Record<string, string[]> = {
      ADMIN:['pdv','vendas','compras','estoque','financeiro','relatorios','usuarios','configuracoes'],
      GERENTE:['pdv','vendas','compras','estoque','financeiro','relatorios'],
      OPERADOR:['pdv','vendas','estoque'], CAIXA:['pdv'],
    }
    setForm((f: any) => ({ ...f, perfil, permissoes:d[perfil]||[] }))
  }

  async function salvar() {
    if (!form.nome||!form.email) return
    if (form._novo&&!form.senha) return alert('Informe a senha')
    setSaving(true)
    try {
      if (form._novo) {
        await api.post('/usuarios/', { nome:form.nome, email:form.email, senha:form.senha, perfil:form.perfil, permissoes:form.permissoes })
      } else {
        const body: any = { nome:form.nome, email:form.email, perfil:form.perfil, permissoes:form.permissoes, is_active:form.is_active }
        if (form.senha) body.senha = form.senha
        await api.put(`/usuarios/${form.id}`, body)
      }
      setForm(null); load()
    } catch (e: any) { alert(e.response?.data?.detail||'Erro') }
    setSaving(false)
  }

  const inp = "w-full px-2.5 py-2 text-xs rounded-lg"

  return (
    <div className="pg">
      <div className="pg-header flex items-center justify-between">
        <div>
          <h1 className="text-base font-black text-white">Usuários do Sistema</h1>
          <p className="text-[10px]" style={{ color:'var(--muted)' }}>{lista.length} usuário(s)</p>
        </div>
        <button onClick={abrirNovo} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
          <Plus size={11}/> Novo Usuário
        </button>
      </div>

      <div className="pg-body">
        <table className="tbl">
          <thead><tr>
            {['Usuário','Perfil','Permissões','Status',''].map(h=><th key={h}>{h}</th>)}
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8" style={{ color:'var(--muted)' }}>Carregando...</td></tr>
            ) : lista.map(u => {
              const pc = PERFIS.find(p=>p.key===u.perfil)
              return (
                <tr key={u.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs flex-shrink-0"
                        style={{ background:(pc?.cor||'#6B7280')+'22', color:pc?.cor||'#6B7280' }}>
                        {u.nome[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-white text-xs">{u.nome}</p>
                        <p className="text-[10px]" style={{ color:'var(--muted)' }}>{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="badge" style={{ background:(pc?.cor||'#6B7280')+'22', color:pc?.cor||'#6B7280' }}>
                      {pc?.label||u.perfil}
                    </span>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {(u.permissoes||[]).slice(0,4).map((p:string)=>(
                        <span key={p} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background:'var(--card2)', color:'var(--muted)' }}>{p}</span>
                      ))}
                      {(u.permissoes||[]).length>4 && <span className="text-[9px]" style={{ color:'var(--muted)' }}>+{(u.permissoes||[]).length-4}</span>}
                    </div>
                  </td>
                  <td>
                    <span className="badge" style={{ background:u.is_active?'#22C55E22':'#EF444422', color:u.is_active?'#22C55E':'#EF4444' }}>
                      {u.is_active?'ATIVO':'INATIVO'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={()=>setForm({ ...u, senha:'', _novo:false })}
                        className="w-6 h-6 rounded flex items-center justify-center"
                        style={{ background:'#F97316'+'22', color:'#F97316' }}><Edit2 size={11}/></button>
                      {u.is_active && (
                        <button onClick={async()=>{ await api.delete(`/usuarios/${u.id}`); load() }}
                          className="w-6 h-6 rounded flex items-center justify-center"
                          style={{ background:'#EF444422', color:'#EF4444' }}><X size={11}/></button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.85)' }}>
          <div className="w-full max-w-md rounded-2xl flex flex-col" style={{ background:'var(--card)', maxHeight:'88vh' }}>
            <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom:'1px solid var(--border)' }}>
              <p className="font-black text-white text-sm">{form._novo?'Novo Usuário':`Editar: ${form.nome}`}</p>
              <button onClick={()=>setForm(null)} style={{ color:'var(--muted)' }}><X size={16}/></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>NOME *</label>
                  <input value={form.nome} onChange={e=>setForm((f:any)=>({...f,nome:e.target.value}))} className={inp} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>E-MAIL *</label>
                  <input type="email" value={form.email} onChange={e=>setForm((f:any)=>({...f,email:e.target.value}))} className={inp} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>SENHA {form._novo?'*':'(nova)'}</label>
                  <input type="password" value={form.senha} onChange={e=>setForm((f:any)=>({...f,senha:e.target.value}))} className={inp} placeholder="••••••" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold mb-1.5" style={{ color:'var(--muted)' }}>PERFIL</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {PERFIS.map(p=>(
                    <button key={p.key} onClick={()=>aplicarPerfil(p.key)}
                      className="py-1.5 px-2 rounded-lg text-[10px] font-bold"
                      style={{ background:form.perfil===p.key?p.cor+'22':'var(--card2)', color:form.perfil===p.key?p.cor:'var(--muted)', border:`1px solid ${form.perfil===p.key?p.cor+'55':'transparent'}` }}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold mb-1.5" style={{ color:'var(--muted)' }}>PERMISSÕES</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {PERMS.map(p=>{
                    const tem = form.permissoes.includes(p.key)
                    return (
                      <button key={p.key} onClick={()=>togglePerm(p.key)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold"
                        style={{ background:tem?'#F97316'+'22':'var(--card2)', color:tem?'#F97316':'var(--muted)', border:`1px solid ${tem?'#F97316'+'44':'transparent'}` }}>
                        <div className="w-3 h-3 rounded flex items-center justify-center flex-shrink-0" style={{ background:tem?'#F97316':'var(--border)' }}>
                          {tem && <Check size={8} color="black"/>}
                        </div>
                        {p.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              {!form._novo && (
                <div className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background:'var(--card2)' }}>
                  <span className="text-xs font-bold text-white flex-1">Usuário Ativo</span>
                  <button onClick={()=>setForm((f:any)=>({...f,is_active:!f.is_active}))}
                    className="w-10 h-5 rounded-full relative"
                    style={{ background:form.is_active?'#22C55E':'#475569' }}>
                    <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                      style={{ left:form.is_active?'22px':'2px' }} />
                  </button>
                </div>
              )}
            </div>
            <div className="px-5 py-3" style={{ borderTop:'1px solid var(--border)' }}>
              <button onClick={salvar} disabled={saving} className="btn-primary w-full py-2.5 text-sm">
                {saving?'Salvando...':'Salvar Usuário'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
