'use client'
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { Plus, Search, Edit3, Trash2, X, Loader2, Zap } from 'lucide-react'

export default function FornecedoresPage() {
  const [lista, setLista]       = useState<any[]>([])
  const [busca, setBusca]       = useState('')
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [saving, setSaving]     = useState(false)
  const [cnpjLoading, setCnpjLoading] = useState(false)
  const [cnpjInfo, setCnpjInfo] = useState<{ok:boolean; msg:string} | null>(null)
  const [reps, setReps] = useState<Rep[]>([])
  const [addRep, setAddRep] = useState(false)
  const [novoRep, setNovoRep] = useState<Rep>({ nome:'', telefone:'', email:'', divisao:'', principal:false })

  type Rep = { nome:string; telefone:string; email:string; divisao:string; principal:boolean }
  const emptyRep: Rep = { nome:'', telefone:'', email:'', divisao:'', principal:false }

  const emptyForm = {
    razao_social:'', fantasia:'', cnpj_cpf:'', ie:'',
    email:'', telefone:'', celular:'',
    rua:'', numero:'', complemento:'', bairro:'', cidade:'', estado:'', cep:'',
    observacoes:'', prazo_pagamento:'',
  }
  const [form, setForm] = useState(emptyForm)

  async function load() {
    setLoading(true)
    const r = await api.get('/fornecedores/', { params: { busca:busca||undefined } })
    setLista(r.data); setLoading(false)
  }
  useEffect(() => { load() }, [busca])

  async function openForm(f?: any) {
    setCnpjInfo(null); setReps([]); setAddRep(false); setNovoRep({ nome:'', telefone:'', email:'', divisao:'', principal:false })
    if (f) {
      setEditando(f)
      try { const r = await api.get(`/fornecedores/${f.id}/representantes`); setReps(r.data) } catch {}
      setForm({
        razao_social: f.razao_social, fantasia: f.fantasia||'', cnpj_cpf: f.cnpj_cpf||'',
        ie: f.ie||'', email: f.email||'', telefone: f.telefone||'', celular: f.celular||'',
        rua: f.rua||'', numero: f.numero||'', complemento: f.complemento||'',
        bairro: f.bairro||'', cidade: f.cidade||'', estado: f.estado||'', cep: f.cep||'',
        observacoes: f.observacoes||'',
        prazo_pagamento: f.prazo_pagamento||'',
      })
    } else {
      setEditando(null)
      setForm(emptyForm)
    }
    setShowForm(true)
  }

  function fmtCNPJ(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 14)
    if (d.length <= 2) return d
    if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`
    if (d.length <= 8) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`
    if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`
    return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
  }

  async function buscarCNPJ(cnpj: string) {
    const digits = cnpj.replace(/\D/g, '')
    if (digits.length !== 14) return
    setCnpjLoading(true); setCnpjInfo(null)
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`)
      if (!r.ok) throw new Error('Não encontrado')
      const d = await r.json()
      setForm(f => ({
        ...f,
        razao_social: d.razao_social || f.razao_social,
        fantasia:     d.nome_fantasia || f.fantasia,
        email:        d.email || f.email,
        telefone:     d.ddd_telefone_1 ? `(${d.ddd_telefone_1.slice(0,2)}) ${d.ddd_telefone_1.slice(2)}` : f.telefone,
        rua:          d.logradouro || f.rua,
        numero:       d.numero || f.numero,
        complemento:  d.complemento || f.complemento,
        bairro:       d.bairro || f.bairro,
        cidade:       d.municipio || f.cidade,
        estado:       d.uf || f.estado,
        cep:          d.cep?.replace(/\D/g,'').replace(/(\d{5})(\d{3})/,'$1-$2') || f.cep,
      }))
      setCnpjInfo({ ok:true, msg: `✓ ${d.razao_social}` })
    } catch {
      setCnpjInfo({ ok:false, msg: 'CNPJ não encontrado na Receita Federal' })
    }
    setCnpjLoading(false)
  }

  async function salvar() {
    setSaving(true)
    try {
      let fid: number
      if (editando) { await api.put(`/fornecedores/${editando.id}`, form); fid = editando.id }
      else          { const r = await api.post('/fornecedores/', form); fid = r.data.id }
      try { await api.post(`/fornecedores/${fid}/representantes/sync`, { representantes: reps }) } catch {}
      setShowForm(false); load()
    } catch (e: any) { alert(e.response?.data?.detail||'Erro ao salvar') }
    setSaving(false)
  }

  const inp = "w-full px-2.5 py-1.5 text-xs rounded-lg"
  const s = { background:'var(--card2)', border:'1px solid var(--border)', color:'white' }

  return (
    <div className="pg">
      <div className="pg-header flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-base font-black text-white">Fornecedores</h1>
            <p className="text-[10px]" style={{ color:'var(--muted)' }}>{lista.length} cadastrado(s)</p>
          </div>
          <div className="relative">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color:'var(--muted)' }} />
            <input value={busca} onChange={e=>setBusca(e.target.value)}
              placeholder="Buscar fornecedor..." className="pl-7 pr-3 py-1.5 text-xs rounded-lg w-48"
              style={s} />
          </div>
        </div>
        <button onClick={()=>openForm()} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
          <Plus size={11}/> Novo Fornecedor
        </button>
      </div>

      <div className="pg-body">
        <table className="tbl">
          <thead><tr>
            {['Razão Social / Fantasia','CNPJ/CPF','Contato','Vendedor','Prazo','Cidade/UF',''].map(h=><th key={h}>{h}</th>)}
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8" style={{ color:'var(--muted)' }}>Carregando...</td></tr>
            ) : lista.length===0 ? (
              <tr><td colSpan={6} className="text-center py-10" style={{ color:'var(--muted)' }}>Nenhum fornecedor cadastrado</td></tr>
            ) : lista.map(f => (
              <tr key={f.id}>
                <td>
                  <p className="font-bold text-white">{f.razao_social}</p>
                  {f.fantasia && <p className="text-[10px]" style={{ color:'var(--muted)' }}>{f.fantasia}</p>}
                </td>
                <td className="font-mono text-xs" style={{ color:'var(--muted)' }}>{f.cnpj_cpf||'—'}</td>
                <td style={{ color:'var(--muted)' }}>
                  <p className="text-xs">{f.telefone||f.celular||'—'}</p>
                  {f.email && <p className="text-[10px]">{f.email}</p>}
                </td>
                <td style={{ color:'var(--muted)' }}>
                  {f.vendedor_nome
                    ? <><p className="text-xs text-white">{f.vendedor_nome}</p>{f.vendedor_telefone&&<p className="text-[10px]">{f.vendedor_telefone}</p>}</>
                    : <span>—</span>}
                </td>
                <td>
                  {f.prazo_pagamento
                    ? <span className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{background:'#F9731622',color:'#F97316'}}>{f.prazo_pagamento}</span>
                    : <span style={{color:'var(--muted)'}}>—</span>}
                </td>
                <td style={{ color:'var(--muted)' }}>{[f.cidade,f.estado].filter(Boolean).join('/')||'—'}</td>
                <td>
                  <div className="flex gap-1">
                    <button onClick={()=>openForm(f)} className="w-6 h-6 rounded flex items-center justify-center"
                      style={{ background:'#F9731622', color:'#F97316' }}><Edit3 size={11}/></button>
                    <button onClick={async()=>{ if(confirm('Remover?')){ await api.delete(`/fornecedores/${f.id}`); load() } }}
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
          <div className="w-full max-w-lg rounded-2xl flex flex-col" style={{ background:'var(--card)', maxHeight:'92vh' }}>
            <div className="flex items-center justify-between px-5 py-2.5 flex-shrink-0" style={{ borderBottom:'1px solid var(--border)' }}>
              <p className="font-black text-white">{editando?'Editar Fornecedor':'Novo Fornecedor'}</p>
              <button onClick={()=>setShowForm(false)} style={{ color:'var(--muted)' }}><X size={16}/></button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">

              {/* CNPJ — com busca automática */}
              <div>
                <label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>CNPJ / CPF</label>
                <div className="flex gap-1.5">
                  <input value={form.cnpj_cpf}
                    onChange={e => {
                      const v = fmtCNPJ(e.target.value)
                      setForm(f=>({...f,cnpj_cpf:v}))
                      setCnpjInfo(null)
                      if (v.replace(/\D/g,'').length === 14) buscarCNPJ(v)
                    }}
                    placeholder="00.000.000/0000-00"
                    className={inp+' flex-1'} style={s} />
                  {cnpjLoading && <Loader2 size={14} className="self-center animate-spin flex-shrink-0" style={{color:'#F97316'}}/>}
                </div>
                {cnpjInfo && (
                  <p className="text-[10px] mt-0.5 font-bold" style={{color: cnpjInfo.ok ? '#34C759' : '#EF4444'}}>
                    {cnpjInfo.ok ? <><Zap size={9} className="inline mr-0.5"/>{cnpjInfo.msg}</> : cnpjInfo.msg}
                  </p>
                )}
              </div>

              {/* Razão Social + Fantasia */}
              <div>
                <label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>RAZÃO SOCIAL *</label>
                <input value={form.razao_social} onChange={e=>setForm(f=>({...f,razao_social:e.target.value}))} className={inp} style={s} />
              </div>
              <div>
                <label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>NOME FANTASIA</label>
                <input value={form.fantasia} onChange={e=>setForm(f=>({...f,fantasia:e.target.value.toUpperCase()}))} className={inp} style={s} />
              </div>

              {/* Contato */}
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>TELEFONE</label>
                  <input value={form.telefone} onChange={e=>setForm(f=>({...f,telefone:e.target.value}))} className={inp} style={s} /></div>
                <div><label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>CELULAR</label>
                  <input value={form.celular} onChange={e=>setForm(f=>({...f,celular:e.target.value}))} className={inp} style={s} /></div>
              </div>
              <div>
                <label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>E-MAIL</label>
                <input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} type="email" className={inp} style={s} />
              </div>

              {/* Representantes */}
              <div className="rounded-xl overflow-hidden" style={{border:'1px solid var(--border)'}}>
                <div className="flex items-center justify-between px-3 py-1.5" style={{background:'var(--card2)'}}>
                  <span className="text-[10px] font-bold" style={{color:'#F97316'}}>👤 REPRESENTANTES / VENDEDORES</span>
                  <button type="button" onClick={()=>setAddRep(v=>!v)}
                    className="text-[9px] font-black px-2 py-0.5 rounded-md"
                    style={{background:'#34C75922',color:'#34C759',border:'1px solid #34C75933'}}>
                    {addRep ? '✕ Cancelar' : '+ Representante'}
                  </button>
                </div>

                {/* Form adicionar novo */}
                {addRep && (
                  <div className="px-3 py-2 space-y-1.5" style={{borderBottom:'1px solid var(--border)',background:'#34C75908'}}>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div><label className="block text-[9px] font-bold mb-0.5" style={{color:'var(--muted)'}}>NOME *</label>
                        <input value={novoRep.nome} onChange={e=>setNovoRep(v=>({...v,nome:e.target.value}))} className={inp} style={s} placeholder="Nome do representante" /></div>
                      <div><label className="block text-[9px] font-bold mb-0.5" style={{color:'var(--muted)'}}>DIVISÃO / LINHA</label>
                        <input value={novoRep.divisao} onChange={e=>setNovoRep(v=>({...v,divisao:e.target.value.toUpperCase()}))} className={inp} style={s} placeholder="Ex: SADIA, FRIOS, GRÃOS" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div><label className="block text-[9px] font-bold mb-0.5" style={{color:'var(--muted)'}}>TELEFONE/WHATSAPP</label>
                        <input value={novoRep.telefone} onChange={e=>setNovoRep(v=>({...v,telefone:e.target.value}))} className={inp} style={s} placeholder="(47) 9 9999-9999" /></div>
                      <div><label className="block text-[9px] font-bold mb-0.5" style={{color:'var(--muted)'}}>E-MAIL</label>
                        <input value={novoRep.email} onChange={e=>setNovoRep(v=>({...v,email:e.target.value}))} className={inp} style={s} placeholder="email@fornecedor.com" /></div>
                    </div>
                    <button type="button" disabled={!novoRep.nome}
                      onClick={() => {
                        const isPrincipal = reps.length === 0
                        setReps(prev => [...prev, {...novoRep, principal: isPrincipal}])
                        setNovoRep({ nome:'', telefone:'', email:'', divisao:'', principal:false })
                        setAddRep(false)
                      }}
                      className="w-full py-1 rounded-lg text-[10px] font-black"
                      style={{background:'#34C759',color:'white',opacity:novoRep.nome?1:0.4}}>
                      + Adicionar Representante
                    </button>
                  </div>
                )}

                {/* Lista */}
                {reps.length === 0 && !addRep && (
                  <p className="text-[9px] text-center py-2" style={{color:'var(--border)'}}>Nenhum representante vinculado</p>
                )}
                {reps.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 px-3 py-2" style={{borderTop:'1px solid var(--border)'}}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-white">{r.nome}</span>
                        {r.divisao && <span className="text-[8px] font-black px-1 py-0.5 rounded" style={{background:'#3B82F622',color:'#3B82F6'}}>{r.divisao}</span>}
                        {r.principal && <span className="text-[8px] font-black px-1 py-0.5 rounded" style={{background:'#F9731622',color:'#F97316'}}>⭐ Principal</span>}
                      </div>
                      {r.telefone && <p className="text-[9px]" style={{color:'var(--muted)'}}>{r.telefone}{r.email ? ` · ${r.email}` : ''}</p>}
                    </div>
                    {!r.principal && (
                      <button type="button" onClick={()=>setReps(prev=>prev.map((x,j)=>({...x,principal:j===i})))}
                        className="text-[8px] flex-shrink-0" style={{color:'var(--muted)'}}>⭐</button>
                    )}
                    <button type="button" onClick={()=>setReps(prev=>{
                      const f2=prev.filter((_,j)=>j!==i)
                      if(r.principal&&f2.length>0) f2[0]={...f2[0],principal:true}
                      return f2
                    })} className="text-[10px] flex-shrink-0" style={{color:'#EF4444'}}>✕</button>
                  </div>
                ))}
              </div>

              {/* Prazo de pagamento */}
              <div>
                <label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>PRAZO DE PAGAMENTO PADRÃO</label>
                <div className="flex gap-2">
                  <select value={form.prazo_pagamento} onChange={e=>setForm(f=>({...f,prazo_pagamento:e.target.value}))}
                    className={inp+' flex-1'} style={s}>
                    <option value="">— Selecione —</option>
                    <option value="À Vista">À Vista</option>
                    <option value="7 dias">7 dias</option>
                    <option value="14 dias">14 dias</option>
                    <option value="15 dias">15 dias</option>
                    <option value="28 dias">28 dias</option>
                    <option value="30 dias">30 dias</option>
                    <option value="30/60">30/60 dias</option>
                    <option value="30/60/90">30/60/90 dias</option>
                    <option value="30/60/90/120">30/60/90/120 dias</option>
                    <option value="60 dias">60 dias</option>
                    <option value="60/90">60/90 dias</option>
                  </select>
                  {form.prazo_pagamento && (
                    <span className="self-center text-[10px] font-black px-2 py-1 rounded-lg flex-shrink-0"
                      style={{background:'#F9731622',color:'#F97316'}}>
                      {form.prazo_pagamento}
                    </span>
                  )}
                </div>
              </div>

              {/* Endereço */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2"><label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>RUA</label>
                  <input value={form.rua} onChange={e=>setForm(f=>({...f,rua:e.target.value}))} className={inp} style={s} /></div>
                <div><label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>NÚMERO</label>
                  <input value={form.numero} onChange={e=>setForm(f=>({...f,numero:e.target.value}))} className={inp} style={s} /></div>
              </div>
              <div>
                <label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>BAIRRO</label>
                <input value={form.bairro} onChange={e=>setForm(f=>({...f,bairro:e.target.value}))} className={inp} style={s} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>CIDADE</label>
                  <input value={form.cidade} onChange={e=>setForm(f=>({...f,cidade:e.target.value}))} className={inp} style={s} /></div>
                <div><label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>UF</label>
                  <input value={form.estado} maxLength={2} onChange={e=>setForm(f=>({...f,estado:e.target.value.toUpperCase()}))} className={inp} style={s} /></div>
                <div><label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>CEP</label>
                  <input value={form.cep} onChange={e=>setForm(f=>({...f,cep:e.target.value}))} className={inp} style={s} /></div>
              </div>
            </div>

            <div className="px-5 py-3 flex-shrink-0" style={{ borderTop:'1px solid var(--border)' }}>
              <button onClick={salvar} disabled={saving||!form.razao_social} className="btn-primary w-full py-2.5 text-sm">
                {saving?'Salvando...':editando?'Salvar Fornecedor':'Cadastrar Fornecedor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
