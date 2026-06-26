'use client'
import { useEffect, useState } from 'react'
import api, { fmtMoeda, fmtData } from '@/lib/api'
import {
  Plus, X, Tag, Package, Percent, DollarSign, Edit2, Trash2,
  Star, ShoppingBag, CreditCard, Users, CheckSquare, Square,
} from 'lucide-react'

// ─── tipos de desconto ────────────────────────────────────────────────────────
const TIPOS_DESC = [
  { key: 'PERCENTUAL', label: '% Desconto', icon: Percent   },
  { key: 'VALOR',      label: '− R$ Valor', icon: DollarSign },
  { key: 'PRECO_FIXO', label: 'Preço Fixo', icon: Tag       },
]

function calcOferta(pv: number, tipo: string, val: number) {
  if (tipo === 'PERCENTUAL') return Math.max(pv * (1 - val / 100), 0)
  if (tipo === 'VALOR')      return Math.max(pv - val, 0)
  return val
}

function BadgeVigente({ vigente, ativo }: { vigente: boolean; ativo: boolean }) {
  if (!ativo) return <span className="badge text-[9px]" style={{ background:'#6B728022',color:'#6B7280' }}>PAUSADO</span>
  if (vigente) return <span className="badge text-[9px] font-black" style={{ background:'#F9731622',color:'#F97316' }}>ATIVO AGORA</span>
  return null
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA: CAMPANHA DE PREÇO
// ══════════════════════════════════════════════════════════════════════════════
function AbaPreco({ produtos }: { produtos: any[] }) {
  const [lista, setLista]   = useState<any[]>([])
  const [show, setShow]     = useState(false)
  const [editando, setEdit] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [detalhe, setDet]   = useState<any>(null)
  const [busca, setBusca]   = useState('')
  const [selProd, setSel]   = useState<number[]>([])
  const [form, setForm]     = useState({
    nome:'', descricao:'', tipo_desconto:'PERCENTUAL', valor_desconto:'',
    data_inicio:'', data_fim:'', ativo:true,
  })

  async function load() {
    const r = await api.get('/campanhas-v2/preco'); setLista(r.data)
  }
  useEffect(() => { load() }, [])

  function abrir(c?: any) {
    setEdit(c || null)
    setForm(c ? { ...c, valor_desconto: String(c.valor_desconto) } :
      { nome:'', descricao:'', tipo_desconto:'PERCENTUAL', valor_desconto:'', data_inicio:'', data_fim:'', ativo:true })
    setSel(c ? c.itens.map((i: any) => i.produto_id) : [])
    setShow(true)
  }
  async function salvar() {
    if (!form.nome || !form.data_inicio || !form.data_fim) return
    setSaving(true)
    try {
      const body = { ...form, valor_desconto: parseFloat(form.valor_desconto)||0, produto_ids: selProd }
      if (editando) await api.put(`/campanhas-v2/preco/${editando.id}`, body)
      else          await api.post('/campanhas-v2/preco', body)
      setShow(false); load()
    } catch (e: any) { alert(e.response?.data?.detail||'Erro') }
    setSaving(false)
  }
  async function excluir(id: number) {
    if (!confirm('Excluir campanha?')) return
    await api.delete(`/campanhas-v2/preco/${id}`); load()
  }

  const pf = produtos.filter(p => !busca || p.descricao.toLowerCase().includes(busca.toLowerCase()) || p.codigo.includes(busca))
  const inp = "w-full px-3 py-2.5 text-sm rounded-xl"

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 flex justify-end flex-shrink-0" style={{ borderBottom:'1px solid var(--border)' }}>
        <button onClick={() => abrir()} className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3">
          <Plus size={12}/> Nova Campanha de Preço
        </button>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {lista.length === 0 && <div className="flex flex-col items-center justify-center h-32" style={{ color:'var(--muted)' }}><Tag size={28} className="mb-2 opacity-30"/><p className="text-sm">Nenhuma campanha</p></div>}
        {lista.map(c => (
          <div key={c.id} className="rounded-2xl p-4 flex items-start gap-4"
            style={{ background:'var(--card2)', border:`1px solid ${c.vigente?'#F9731640':'var(--border)'}` }}>
            <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: c.vigente?'#F9731622':'var(--card)' }}>
              <Tag size={18} color={c.vigente?'#F97316':'var(--muted)'} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-black text-white">{c.nome}</p>
                <BadgeVigente vigente={c.vigente} ativo={c.ativo} />
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap text-xs">
                <span className="font-bold" style={{ color:'#F59E0B' }}>
                  {c.tipo_desconto==='PERCENTUAL' ? `${c.valor_desconto}% off` :
                   c.tipo_desconto==='VALOR' ? `−R$ ${c.valor_desconto.toFixed(2)}` :
                   `Preço fixo R$ ${c.valor_desconto.toFixed(2)}`}
                </span>
                <span style={{ color:'var(--muted)' }}>{fmtData(c.data_inicio)} → {fmtData(c.data_fim)}</span>
                <span style={{ color:'var(--muted)' }}>{c.total_produtos} produto(s)</span>
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setDet(detalhe?.id===c.id ? null : c)} className="px-2 py-1.5 rounded-xl text-[10px] font-bold" style={{ background:'#F59E0B22',color:'#F59E0B' }}>{detalhe?.id===c.id?'Fechar':'Itens'}</button>
              <button onClick={() => abrir(c)} className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background:'#32ADE622',color:'#32ADE6' }}><Edit2 size={11}/></button>
              <button onClick={() => excluir(c.id)} className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background:'#FF3B3022',color:'#FF3B30' }}><Trash2 size={11}/></button>
            </div>
          </div>
        ))}
        {detalhe && (
          <div className="rounded-2xl overflow-hidden" style={{ border:'1px solid var(--border)' }}>
            <table className="tbl"><thead><tr><th>Código</th><th>Produto</th><th>Preço Normal</th><th>Preço Oferta</th><th>Economia</th></tr></thead>
              <tbody>{detalhe.itens.map((i: any) => (
                <tr key={i.produto_id} style={{ borderTop:'1px solid var(--border)' }} className="hover:bg-white/5">
                  <td className="px-3 py-2 font-mono text-[10px]" style={{ color:'var(--muted)' }}>{i.produto_codigo}</td>
                  <td className="px-3 py-2 font-semibold text-white text-xs">{i.produto_descricao}</td>
                  <td className="px-3 py-2 font-bold" style={{ color:'#F59E0B' }}>{fmtMoeda(i.preco_atual)}</td>
                  <td className="px-3 py-2 font-bold" style={{ color:'#34C759' }}>{fmtMoeda(i.preco_oferta)}</td>
                  <td className="px-3 py-2 text-xs font-bold" style={{ color:'#FF9F0A' }}>{i.preco_atual>0?`${((1-i.preco_oferta/i.preco_atual)*100).toFixed(1)}%`:'—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>

      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.8)', backdropFilter:'blur(8px)' }}>
          <div className="w-full max-w-2xl rounded-3xl flex flex-col" style={{ background:'var(--card)', maxHeight:'92vh' }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom:'1px solid var(--border)' }}>
              <p className="font-black text-lg text-white">{editando?'Editar':'Nova'} Campanha de Preço</p>
              <button onClick={() => setShow(false)} style={{ color:'var(--muted)' }}><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <input value={form.nome} onChange={e => setForm(f=>({...f,nome:e.target.value}))} className={inp} placeholder="Nome da campanha *" />
              <input value={form.descricao} onChange={e => setForm(f=>({...f,descricao:e.target.value}))} className={inp} placeholder="Descrição (opcional)" />
              <div className="flex gap-1">
                {TIPOS_DESC.map(t => (
                  <button key={t.key} onClick={() => setForm(f=>({...f,tipo_desconto:t.key}))}
                    className="flex-1 py-2 rounded-xl text-[10px] font-bold"
                    style={{ background:form.tipo_desconto===t.key?'#F97316':'var(--card2)', color:form.tipo_desconto===t.key?'white':'var(--muted)' }}>
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <input type="number" step="0.01" min="0" value={form.valor_desconto} onChange={e => setForm(f=>({...f,valor_desconto:e.target.value}))} className={inp} placeholder="Valor" />
                <input type="date" value={form.data_inicio} onChange={e => setForm(f=>({...f,data_inicio:e.target.value}))} className={inp} />
                <input type="date" value={form.data_fim} onChange={e => setForm(f=>({...f,data_fim:e.target.value}))} className={inp} />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs font-bold" style={{ color:'var(--muted)' }}>PRODUTOS ({selProd.length})</label>
                  <button onClick={() => setSel(selProd.length===produtos.length?[]:produtos.map(p=>p.id))} className="text-[10px] font-bold" style={{ color:'#F97316' }}>{selProd.length===produtos.length?'Desmarcar todos':'Marcar todos'}</button>
                </div>
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar..." className="w-full px-3 py-2 text-xs rounded-xl mb-1" style={{ background:'var(--card2)',color:'white',border:'1px solid var(--border)' }}/>
                <div className="max-h-40 overflow-y-auto rounded-xl" style={{ border:'1px solid var(--border)' }}>
                  {pf.map(p => {
                    const sel = selProd.includes(p.id)
                    return (
                      <div key={p.id} onClick={() => setSel(s => sel?s.filter(x=>x!==p.id):[...s,p.id])}
                        className="flex items-center gap-2 px-3 py-2 cursor-pointer"
                        style={{ background:sel?'rgba(249,115,22,0.1)':'transparent', borderBottom:'1px solid var(--border)' }}>
                        <div className="w-4 h-4 rounded flex items-center justify-center" style={{ background:sel?'#F97316':'var(--card2)',border:sel?'none':'1px solid var(--border)' }}>
                          {sel && <span className="text-white text-[8px] font-black">✓</span>}
                        </div>
                        <p className="flex-1 text-xs text-white truncate">{p.descricao}</p>
                        <p className="text-xs font-bold" style={{ color:'#F59E0B' }}>{fmtMoeda(p.preco_venda)}</p>
                        {sel && form.valor_desconto && <p className="text-[9px] font-bold" style={{ color:'#34C759' }}>{fmtMoeda(calcOferta(p.preco_venda, form.tipo_desconto, parseFloat(form.valor_desconto)||0))}</p>}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="px-6 py-4" style={{ borderTop:'1px solid var(--border)' }}>
              <button onClick={salvar} disabled={saving||!form.nome||!form.data_inicio||!form.data_fim} className="btn-primary w-full py-3">
                {saving?'Salvando...':editando?'Salvar':'Criar Campanha'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA: CLUBE DE PROMOÇÃO
// ══════════════════════════════════════════════════════════════════════════════
function AbaClube({ produtos }: { produtos: any[] }) {
  const [lista, setLista]   = useState<any[]>([])
  const [show, setShow]     = useState(false)
  const [editando, setEdit] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [selProd, setSel]   = useState<number[]>([])
  const [busca, setBusca]   = useState('')
  const [form, setForm]     = useState({
    nome:'', descricao:'', tipo_desconto:'PERCENTUAL', valor_desconto:'',
    data_inicio:'', data_fim:'', ativo:true,
  })
  async function load() { const r = await api.get('/campanhas-v2/clube'); setLista(r.data) }
  useEffect(() => { load() }, [])
  function abrir(c?: any) {
    setEdit(c||null)
    setForm(c ? {...c, valor_desconto:String(c.valor_desconto), data_inicio:c.data_inicio||'', data_fim:c.data_fim||''} :
      { nome:'', descricao:'', tipo_desconto:'PERCENTUAL', valor_desconto:'', data_inicio:'', data_fim:'', ativo:true })
    setSel(c ? c.itens.map((i:any)=>i.produto_id) : [])
    setShow(true)
  }
  async function salvar() {
    if (!form.nome) return; setSaving(true)
    try {
      const body = { ...form, valor_desconto:parseFloat(form.valor_desconto)||0, produto_ids:selProd, data_inicio:form.data_inicio||null, data_fim:form.data_fim||null }
      if (editando) await api.put(`/campanhas-v2/clube/${editando.id}`, body)
      else          await api.post('/campanhas-v2/clube', body)
      setShow(false); load()
    } catch(e:any){alert(e.response?.data?.detail||'Erro')}
    setSaving(false)
  }
  const inp = "w-full px-3 py-2.5 text-sm rounded-xl"
  const pf  = produtos.filter(p => !busca || p.descricao.toLowerCase().includes(busca.toLowerCase()))
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 flex justify-end flex-shrink-0" style={{ borderBottom:'1px solid var(--border)' }}>
        <button onClick={() => abrir()} className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3">
          <Plus size={12}/> Novo Clube
        </button>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {lista.length === 0 && <div className="flex flex-col items-center justify-center h-32" style={{ color:'var(--muted)' }}><Star size={28} className="mb-2 opacity-30"/><p className="text-sm">Nenhum clube cadastrado</p></div>}
        {lista.map(c => (
          <div key={c.id} className="rounded-2xl p-4 flex items-center gap-4"
            style={{ background:'var(--card2)', border:`1px solid ${c.vigente?'#AF52DE40':'var(--border)'}` }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background:c.vigente?'#AF52DE22':'var(--card)' }}>
              <Star size={18} color={c.vigente?'#AF52DE':'var(--muted)'}/>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2"><p className="font-black text-white">{c.nome}</p><BadgeVigente vigente={c.vigente} ativo={c.ativo}/></div>
              <p className="text-xs mt-0.5" style={{ color:'var(--muted)' }}>{c.total_produtos} produto(s) · {c.tipo_desconto==='PERCENTUAL'?`${c.valor_desconto}% off`:c.tipo_desconto==='VALOR'?`−R$${c.valor_desconto.toFixed(2)}`:`Preço fixo`}</p>
            </div>
            <div className="flex gap-1">
              <button onClick={() => abrir(c)} className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background:'#32ADE622',color:'#32ADE6' }}><Edit2 size={11}/></button>
              <button onClick={async()=>{if(!confirm('Excluir?'))return;await api.delete(`/campanhas-v2/clube/${c.id}`);load()}} className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background:'#FF3B3022',color:'#FF3B30' }}><Trash2 size={11}/></button>
            </div>
          </div>
        ))}
      </div>
      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.8)',backdropFilter:'blur(8px)' }}>
          <div className="w-full max-w-2xl rounded-3xl flex flex-col" style={{ background:'var(--card)',maxHeight:'90vh' }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom:'1px solid var(--border)' }}>
              <p className="font-black text-lg text-white">{editando?'Editar':'Novo'} Clube de Promoção</p>
              <button onClick={()=>setShow(false)} style={{color:'var(--muted)'}}><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <input value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} className={inp} placeholder="Nome do clube *"/>
              <input value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))} className={inp} placeholder="Descrição"/>
              <div className="flex gap-1">{TIPOS_DESC.map(t=><button key={t.key} onClick={()=>setForm(f=>({...f,tipo_desconto:t.key}))} className="flex-1 py-2 rounded-xl text-[10px] font-bold" style={{background:form.tipo_desconto===t.key?'#AF52DE':'var(--card2)',color:form.tipo_desconto===t.key?'white':'var(--muted)'}}>{t.label}</button>)}</div>
              <div className="grid grid-cols-3 gap-3">
                <input type="number" value={form.valor_desconto} onChange={e=>setForm(f=>({...f,valor_desconto:e.target.value}))} className={inp} placeholder="Valor"/>
                <input type="date" value={form.data_inicio} onChange={e=>setForm(f=>({...f,data_inicio:e.target.value}))} className={inp}/>
                <input type="date" value={form.data_fim} onChange={e=>setForm(f=>({...f,data_fim:e.target.value}))} className={inp}/>
              </div>
              <div>
                <div className="flex justify-between mb-1"><label className="text-xs font-bold" style={{color:'var(--muted)'}}>PRODUTOS DO CLUBE ({selProd.length})</label><button onClick={()=>setSel(selProd.length===produtos.length?[]:produtos.map(p=>p.id))} className="text-[10px] font-bold" style={{color:'#AF52DE'}}>{selProd.length===produtos.length?'Desmarcar todos':'Marcar todos'}</button></div>
                <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar..." className="w-full px-3 py-2 text-xs rounded-xl mb-1" style={{background:'var(--card2)',color:'white',border:'1px solid var(--border)'}}/>
                <div className="max-h-36 overflow-y-auto rounded-xl" style={{border:'1px solid var(--border)'}}>
                  {pf.map(p=>{const sel=selProd.includes(p.id);return(
                    <div key={p.id} onClick={()=>setSel(s=>sel?s.filter(x=>x!==p.id):[...s,p.id])} className="flex items-center gap-2 px-3 py-2 cursor-pointer" style={{background:sel?'rgba(175,82,222,0.1)':'transparent',borderBottom:'1px solid var(--border)'}}>
                      <div className="w-4 h-4 rounded flex items-center justify-center" style={{background:sel?'#AF52DE':'var(--card2)',border:sel?'none':'1px solid var(--border)'}}>{sel&&<span className="text-white text-[8px] font-black">✓</span>}</div>
                      <p className="flex-1 text-xs text-white truncate">{p.descricao}</p>
                      <p className="text-xs font-bold" style={{color:'#F59E0B'}}>{fmtMoeda(p.preco_venda)}</p>
                    </div>
                  )})}
                </div>
              </div>
            </div>
            <div className="px-6 py-4" style={{borderTop:'1px solid var(--border)'}}>
              <button onClick={salvar} disabled={saving||!form.nome} className="btn-primary w-full py-3">{saving?'Salvando...':editando?'Salvar':'Criar Clube'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA: ATACAREJO
// ══════════════════════════════════════════════════════════════════════════════
function AbaAtacarejo({ produtos, categorias }: { produtos: any[]; categorias: any[] }) {
  const [lista, setLista]   = useState<any[]>([])
  const [show, setShow]     = useState(false)
  const [editando, setEdit] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm]     = useState({ nome:'', descricao:'', ativo:true, data_inicio:'', data_fim:'' })
  const [itens, setItens]   = useState<any[]>([])
  const [buscaProd, setBP]  = useState('')

  async function load() { const r = await api.get('/campanhas-v2/atacarejo'); setLista(r.data) }
  useEffect(() => { load() }, [])

  function abrir(c?: any) {
    setEdit(c||null)
    setForm(c ? { nome:c.nome, descricao:c.descricao||'', ativo:c.ativo, data_inicio:c.data_inicio||'', data_fim:c.data_fim||'' }
              : { nome:'', descricao:'', ativo:true, data_inicio:'', data_fim:'' })
    setItens(c ? c.itens.map((i:any) => ({ ...i, _id: Math.random() })) : [])
    setShow(true)
  }

  function addItemProd(p: any) {
    if (itens.find(i => i.tipo==='PRODUTO' && i.produto_id===p.id)) return
    setItens(s => [...s, { _id:Math.random(), tipo:'PRODUTO', produto_id:p.id, nome:p.descricao, codigo:p.codigo, preco_normal:p.preco_venda, qtd_minima:3, pct_desconto:10, preco_atacarejo:null }])
  }
  function addItemCat(cat: any) {
    if (itens.find(i => i.tipo==='CATEGORIA' && i.categoria_id===cat.id)) return
    setItens(s => [...s, { _id:Math.random(), tipo:'CATEGORIA', categoria_id:cat.id, nome:cat.nome, icone:cat.icone, qtd_minima:3, pct_desconto:10, preco_atacarejo:null }])
  }
  function remItem(id: any) { setItens(s => s.filter(i => i._id!==id)) }
  function updItem(id: any, k: string, v: any) { setItens(s => s.map(i => i._id===id ? {...i,[k]:v} : i)) }

  async function salvar() {
    if (!form.nome) return; setSaving(true)
    try {
      const body = {
        ...form, data_inicio:form.data_inicio||null, data_fim:form.data_fim||null,
        itens: itens.map(i => ({
          tipo:i.tipo, produto_id:i.produto_id||null, categoria_id:i.categoria_id||null,
          qtd_minima:i.qtd_minima, pct_desconto:i.pct_desconto||null, preco_atacarejo:i.preco_atacarejo||null,
        })),
      }
      if (editando) await api.put(`/campanhas-v2/atacarejo/${editando.id}`, body)
      else          await api.post('/campanhas-v2/atacarejo', body)
      setShow(false); load()
    } catch(e:any){alert(e.response?.data?.detail||'Erro')}
    setSaving(false)
  }

  const inp = "w-full px-3 py-2.5 text-sm rounded-xl"
  const pf  = produtos.filter(p => !buscaProd || p.descricao.toLowerCase().includes(buscaProd.toLowerCase()) || p.codigo.includes(buscaProd))

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 flex items-center justify-between flex-shrink-0" style={{ borderBottom:'1px solid var(--border)' }}>
        <p className="text-xs" style={{ color:'var(--muted)' }}>Regras de atacarejo por produto ou categoria — aplicadas automaticamente no PDV</p>
        <button onClick={() => abrir()} className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3">
          <Plus size={12}/> Nova Regra Atacarejo
        </button>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {lista.length===0 && <div className="flex flex-col items-center justify-center h-32" style={{color:'var(--muted)'}}><ShoppingBag size={28} className="mb-2 opacity-30"/><p className="text-sm">Nenhuma regra cadastrada</p></div>}
        {lista.map(c => (
          <div key={c.id} className="rounded-2xl p-4" style={{background:'var(--card2)',border:`1px solid ${c.vigente?'#F59E0B40':'var(--border)'}`}}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{background:'#F59E0B22'}}><ShoppingBag size={16} color="#F59E0B"/></div>
              <div className="flex-1"><div className="flex items-center gap-2"><p className="font-black text-white">{c.nome}</p><BadgeVigente vigente={c.vigente} ativo={c.ativo}/></div></div>
              <div className="flex gap-1">
                <button onClick={() => abrir(c)} className="w-7 h-7 rounded-xl flex items-center justify-center" style={{background:'#32ADE622',color:'#32ADE6'}}><Edit2 size={11}/></button>
                <button onClick={async()=>{if(!confirm('Excluir?'))return;await api.delete(`/campanhas-v2/atacarejo/${c.id}`);load()}} className="w-7 h-7 rounded-xl flex items-center justify-center" style={{background:'#FF3B3022',color:'#FF3B30'}}><Trash2 size={11}/></button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {c.itens.map((i: any) => (
                <div key={i.id} className="px-3 py-1.5 rounded-xl text-xs" style={{background:'var(--card)',border:'1px solid var(--border)'}}>
                  <span style={{color:'var(--muted)'}}>{i.tipo==='CATEGORIA'?'📁':'📦'} {i.nome}</span>
                  <span className="ml-2 font-bold" style={{color:'#F59E0B'}}>≥{i.qtd_minima} un</span>
                  {i.pct_desconto&&<span className="ml-1 font-bold" style={{color:'#34C759'}}>−{i.pct_desconto}%</span>}
                  {i.preco_atacarejo&&<span className="ml-1 font-bold" style={{color:'#32ADE6'}}>{fmtMoeda(i.preco_atacarejo)}</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.85)',backdropFilter:'blur(8px)'}}>
          <div className="w-full max-w-3xl rounded-3xl flex flex-col" style={{background:'var(--card)',maxHeight:'94vh'}}>
            <div className="flex items-center justify-between px-6 py-4" style={{borderBottom:'1px solid var(--border)'}}>
              <p className="font-black text-lg text-white">{editando?'Editar':'Nova'} Regra Atacarejo</p>
              <button onClick={()=>setShow(false)} style={{color:'var(--muted)'}}><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <input value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} className={inp} placeholder="Nome da regra *"/>
                <input value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))} className={inp} placeholder="Descrição"/>
                <input type="date" value={form.data_inicio} onChange={e=>setForm(f=>({...f,data_inicio:e.target.value}))} className={inp} placeholder="Início (opcional)"/>
                <input type="date" value={form.data_fim} onChange={e=>setForm(f=>({...f,data_fim:e.target.value}))} className={inp} placeholder="Fim (opcional)"/>
              </div>

              {/* Regras definidas */}
              {itens.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold" style={{color:'var(--muted)'}}>REGRAS DEFINIDAS ({itens.length})</p>
                  {itens.map(i => (
                    <div key={i._id} className="rounded-xl p-3 flex items-center gap-3" style={{background:'var(--card2)',border:'1px solid var(--border)'}}>
                      <span className="text-lg">{i.tipo==='CATEGORIA'?(i.icone||'📁'):'📦'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{i.nome}</p>
                        {i.tipo==='PRODUTO'&&<p className="text-[9px]" style={{color:'var(--muted)'}}>Preço normal: {fmtMoeda(i.preco_normal||0)}</p>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-1">
                            <span className="text-[9px]" style={{color:'var(--muted)'}}>Qtd mín:</span>
                            <input type="number" min="1" step="1" value={i.qtd_minima}
                              onChange={e=>updItem(i._id,'qtd_minima',parseFloat(e.target.value)||1)}
                              className="w-14 px-2 py-1 rounded-lg text-xs text-right font-bold"
                              style={{background:'var(--card)',color:'#F59E0B',border:'1px solid #F59E0B44'}}/>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[9px]" style={{color:'var(--muted)'}}>% Desc:</span>
                            <input type="number" min="0" max="99" step="0.5" value={i.pct_desconto||''}
                              onChange={e=>updItem(i._id,'pct_desconto',e.target.value?parseFloat(e.target.value):null)}
                              className="w-14 px-2 py-1 rounded-lg text-xs text-right font-bold"
                              style={{background:'var(--card)',color:'#34C759',border:'1px solid #34C75944'}}/>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[9px]" style={{color:'var(--muted)'}}>Preço ATK:</span>
                            <input type="number" min="0" step="0.01" value={i.preco_atacarejo||''}
                              onChange={e=>updItem(i._id,'preco_atacarejo',e.target.value?parseFloat(e.target.value):null)}
                              className="w-20 px-2 py-1 rounded-lg text-xs text-right font-bold"
                              style={{background:'var(--card)',color:'#32ADE6',border:'1px solid #32ADE644'}}/>
                          </div>
                        </div>
                        <button onClick={()=>remItem(i._id)} className="w-6 h-6 rounded flex items-center justify-center" style={{background:'#FF3B3022',color:'#FF3B30'}}><X size={10}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Adicionar por produto */}
              <div>
                <p className="text-xs font-bold mb-2" style={{color:'var(--muted)'}}>ADICIONAR PRODUTO</p>
                <input value={buscaProd} onChange={e=>setBP(e.target.value)} placeholder="Buscar produto..." className="w-full px-3 py-2 text-xs rounded-xl mb-1" style={{background:'var(--card2)',color:'white',border:'1px solid var(--border)'}}/>
                <div className="max-h-28 overflow-y-auto rounded-xl" style={{border:'1px solid var(--border)'}}>
                  {pf.slice(0,20).map(p=>(
                    <div key={p.id} onClick={()=>addItemProd(p)} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white/5" style={{borderBottom:'1px solid var(--border)'}}>
                      <span className="text-xs text-white flex-1 truncate">{p.descricao}</span>
                      <span className="text-xs font-mono" style={{color:'var(--muted)'}}>{p.codigo}</span>
                      <span className="text-xs font-bold" style={{color:'#F59E0B'}}>{fmtMoeda(p.preco_venda)}</span>
                      <Plus size={10} style={{color:'#34C759'}}/>
                    </div>
                  ))}
                </div>
              </div>

              {/* Adicionar por categoria */}
              <div>
                <p className="text-xs font-bold mb-2" style={{color:'var(--muted)'}}>ADICIONAR POR CATEGORIA</p>
                <div className="flex flex-wrap gap-2">
                  {categorias.map(cat=>(
                    <button key={cat.id} onClick={()=>addItemCat(cat)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                      style={{background:itens.find(i=>i.tipo==='CATEGORIA'&&i.categoria_id===cat.id)?cat.cor+'33':'var(--card2)', color:cat.cor, border:`1px solid ${cat.cor}44`}}>
                      {cat.icone} {cat.nome}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4" style={{borderTop:'1px solid var(--border)'}}>
              <button onClick={salvar} disabled={saving||!form.nome} className="btn-primary w-full py-3">{saving?'Salvando...':editando?'Salvar':'Criar Regra'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA: FORMA DE PAGAMENTO
// ══════════════════════════════════════════════════════════════════════════════
function AbaFormaPgto({ formas }: { formas: any[] }) {
  const [lista, setLista]   = useState<any[]>([])
  const [show, setShow]     = useState(false)
  const [editando, setEdit] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm]     = useState({ nome:'', descricao:'', ativo:true, data_inicio:'', data_fim:'', forma_chave:'', valor_minimo_compra:'0', pct_desconto:'0' })

  async function load() { const r = await api.get('/campanhas-v2/forma-pagamento'); setLista(r.data) }
  useEffect(()=>{load()},[])
  function abrir(c?: any) {
    setEdit(c||null)
    setForm(c ? {...c,valor_minimo_compra:String(c.valor_minimo_compra),pct_desconto:String(c.pct_desconto),data_inicio:c.data_inicio||'',data_fim:c.data_fim||''}
             : { nome:'',descricao:'',ativo:true,data_inicio:'',data_fim:'',forma_chave:formas[0]?.chave||'',valor_minimo_compra:'0',pct_desconto:'0' })
    setShow(true)
  }
  async function salvar() {
    if (!form.nome||!form.forma_chave) return; setSaving(true)
    try {
      const body = {...form, valor_minimo_compra:parseFloat(form.valor_minimo_compra)||0, pct_desconto:parseFloat(form.pct_desconto)||0, data_inicio:form.data_inicio||null, data_fim:form.data_fim||null}
      if (editando) await api.put(`/campanhas-v2/forma-pagamento/${editando.id}`,body)
      else          await api.post('/campanhas-v2/forma-pagamento',body)
      setShow(false); load()
    } catch(e:any){alert(e.response?.data?.detail||'Erro')}
    setSaving(false)
  }
  const inp = "w-full px-3 py-2.5 text-sm rounded-xl"
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 flex items-center justify-between flex-shrink-0" style={{borderBottom:'1px solid var(--border)'}}>
        <p className="text-xs" style={{color:'var(--muted)'}}>Desconto automático no PDV quando cliente paga com forma específica e atinge valor mínimo</p>
        <button onClick={()=>abrir()} className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3"><Plus size={12}/>Nova Campanha</button>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {lista.length===0&&<div className="flex flex-col items-center justify-center h-32" style={{color:'var(--muted)'}}><CreditCard size={28} className="mb-2 opacity-30"/><p className="text-sm">Nenhuma campanha</p></div>}
        {lista.map(c=>(
          <div key={c.id} className="rounded-2xl p-4 flex items-center gap-4" style={{background:'var(--card2)',border:`1px solid ${c.vigente?c.forma_cor+'40':'var(--border)'}`}}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{background:c.forma_cor+'22'}}>{c.forma_icone}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2"><p className="font-black text-white">{c.nome}</p><BadgeVigente vigente={c.vigente} ativo={c.ativo}/></div>
              <div className="flex gap-3 mt-0.5 text-xs" style={{color:'var(--muted)'}}>
                <span style={{color:c.forma_cor}}>{c.forma_nome}</span>
                {c.valor_minimo_compra>0&&<span>Mín: {fmtMoeda(c.valor_minimo_compra)}</span>}
                <span className="font-bold" style={{color:'#34C759'}}>−{c.pct_desconto}% desconto</span>
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={()=>abrir(c)} className="w-7 h-7 rounded-xl flex items-center justify-center" style={{background:'#32ADE622',color:'#32ADE6'}}><Edit2 size={11}/></button>
              <button onClick={async()=>{if(!confirm('Excluir?'))return;await api.delete(`/campanhas-v2/forma-pagamento/${c.id}`);load()}} className="w-7 h-7 rounded-xl flex items-center justify-center" style={{background:'#FF3B3022',color:'#FF3B30'}}><Trash2 size={11}/></button>
            </div>
          </div>
        ))}
      </div>
      {show&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.85)',backdropFilter:'blur(8px)'}}>
          <div className="w-full max-w-md rounded-3xl flex flex-col" style={{background:'var(--card)'}}>
            <div className="flex items-center justify-between px-6 py-4" style={{borderBottom:'1px solid var(--border)'}}>
              <p className="font-black text-lg text-white">{editando?'Editar':'Nova'} Campanha Forma Pgto</p>
              <button onClick={()=>setShow(false)} style={{color:'var(--muted)'}}><X size={20}/></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <input value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} className={inp} placeholder="Nome *"/>
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{color:'var(--muted)'}}>FORMA DE PAGAMENTO</label>
                <div className="grid grid-cols-2 gap-2">
                  {formas.map(f=>(
                    <button key={f.chave} onClick={()=>setForm(fm=>({...fm,forma_chave:f.chave}))}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold"
                      style={{background:form.forma_chave===f.chave?f.cor+'22':'var(--card2)',border:`1px solid ${form.forma_chave===f.chave?f.cor:'var(--border)'}`,color:form.forma_chave===f.chave?f.cor:'var(--muted)'}}>
                      <span>{f.icone}</span>{f.nome}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{color:'var(--muted)'}}>COMPRA MÍNIMA (R$)</label>
                  <input type="number" min="0" step="0.01" value={form.valor_minimo_compra} onChange={e=>setForm(f=>({...f,valor_minimo_compra:e.target.value}))} className={inp}/>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{color:'var(--muted)'}}>DESCONTO (%)</label>
                  <input type="number" min="0" max="100" step="0.5" value={form.pct_desconto} onChange={e=>setForm(f=>({...f,pct_desconto:e.target.value}))} className={inp}/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={form.data_inicio} onChange={e=>setForm(f=>({...f,data_inicio:e.target.value}))} className={inp} placeholder="Início"/>
                <input type="date" value={form.data_fim} onChange={e=>setForm(f=>({...f,data_fim:e.target.value}))} className={inp} placeholder="Fim"/>
              </div>
            </div>
            <div className="px-6 py-4" style={{borderTop:'1px solid var(--border)'}}>
              <button onClick={salvar} disabled={saving||!form.nome||!form.forma_chave} className="btn-primary w-full py-3">{saving?'Salvando...':editando?'Salvar':'Criar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
const ABAS = [
  { key:'preco',     label:'Campanha de Preço',    icon:'🏷️',  cor:'#F97316' },
  { key:'clube',     label:'Clube de Promoção',    icon:'⭐',  cor:'#AF52DE' },
  { key:'atacarejo', label:'Atacarejo',             icon:'🛒',  cor:'#F59E0B' },
  { key:'forma',     label:'Por Forma de Pgto',    icon:'💳',  cor:'#32ADE6' },
]

export default function CampanhasPage() {
  const [aba, setAba]           = useState('preco')
  const [produtos, setProdutos] = useState<any[]>([])
  const [categorias, setCats]   = useState<any[]>([])
  const [formas, setFormas]     = useState<any[]>([])

  useEffect(() => {
    Promise.all([
      api.get('/precos/produtos'),
      api.get('/produtos/categorias'),
      api.get('/formas-recebimento/'),
    ]).then(([rp, rc, rf]) => {
      setProdutos(rp.data); setCats(rc.data); setFormas(rf.data.filter((f:any) => f.ativo))
    })
  }, [])

  const abaAtual = ABAS.find(a => a.key === aba)

  return (
    <div className="pg">
      <div className="pg-header space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-black text-white">Campanhas Promocionais</h1>
            <p className="text-[10px]" style={{ color:'var(--muted)' }}>4 tipos de campanha: Preço · Clube · Atacarejo · Forma de Pagamento</p>
          </div>
        </div>
        <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background:'var(--card2)' }}>
          {ABAS.map(a => (
            <button key={a.key} onClick={() => setAba(a.key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{ background:aba===a.key?a.cor+'22':'transparent', color:aba===a.key?a.cor:'var(--muted)', border:aba===a.key?`1px solid ${a.cor}44`:'1px solid transparent' }}>
              <span>{a.icon}</span>{a.label}
            </button>
          ))}
        </div>
      </div>
      <div className="pg-body p-0">
        {aba==='preco'     && <AbaPreco     produtos={produtos} />}
        {aba==='clube'     && <AbaClube     produtos={produtos} />}
        {aba==='atacarejo' && <AbaAtacarejo produtos={produtos} categorias={categorias} />}
        {aba==='forma'     && <AbaFormaPgto formas={formas} />}
      </div>
    </div>
  )
}
