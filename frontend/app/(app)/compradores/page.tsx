'use client'
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import {
  Plus, Search, Edit3, Trash2, X, ShieldCheck,
  Phone, Mail, Tag, DollarSign, KeyRound, Eye, EyeOff,
  CheckCircle, XCircle, Star, UserCircle2,
} from 'lucide-react'

type Categoria = { id: number; nome: string; icone: string; cor: string }
type Comprador = {
  id: number; nome: string; cpf: string; email: string
  telefone: string; celular: string; cargo: string; departamento: string
  tem_pin: boolean; categorias_ids: number[]; categorias_nomes: string[]
  limite_compra_valor: number; nivel_aprovacao: number
  pode_aprovar_acima: number; is_active: boolean; observacoes: string
  ultimo_acesso: string | null; created_at: string
}

const NIVEIS = [
  { v: 1, label: 'Operacional', desc: 'Cria pedidos para aprovação', icon: '🧑‍💼' },
  { v: 2, label: 'Tático',      desc: 'Aprova dentro do limite',     icon: '📋' },
  { v: 3, label: 'Estratégico', desc: 'Aprovação irrestrita',        icon: '🏆' },
]
const NIV_COR = ['', '#16a34a', '#2563eb', '#9333ea']
const NIV_BG  = ['', '#f0fdf4', '#eff6ff', '#faf5ff']
const NIV_BOR = ['', '#86efac', '#93c5fd', '#d8b4fe']

const emptyForm = {
  nome: '', cpf: '', email: '', telefone: '', celular: '',
  cargo: '', departamento: '', pin: '', pin_confirm: '',
  categorias_ids: [] as number[],
  limite_compra_valor: '',
  nivel_aprovacao: 1,
  pode_aprovar_acima: '',
  observacoes: '',
}

// ── Componentes de campo reutilizáveis ──────────────────────────────────────

function Field({ label, children, span2 = false }: { label: string; children: React.ReactNode; span2?: boolean }) {
  return (
    <div className={span2 ? 'col-span-2' : ''}>
      <label style={{
        display: 'block', fontSize: 10, fontWeight: 800,
        letterSpacing: '0.08em', color: '#9ca3af',
        marginBottom: 5, textTransform: 'uppercase',
      }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  borderRadius: 10, fontSize: 13, fontWeight: 600,
  background: '#f8fafc', color: '#1e293b',
  border: '1.5px solid #e2e8f0',
  outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.15s',
}

function Inp(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props}
      style={{ ...inputStyle, ...props.style }}
      onFocus={e => (e.currentTarget.style.borderColor = '#f97316')}
      onBlur={e => (e.currentTarget.style.borderColor = '#e2e8f0')}
    />
  )
}

// ── Página principal ────────────────────────────────────────────────────────

export default function CompradoresPage() {
  const [lista, setLista]           = useState<Comprador[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [busca, setBusca]           = useState('')
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [editando, setEditando]     = useState<Comprador | null>(null)
  const [form, setForm]             = useState({ ...emptyForm })
  const [saving, setSaving]         = useState(false)
  const [showPin, setShowPin]       = useState(false)
  const [pinErr, setPinErr]         = useState('')
  const [showInativo, setShowInativo] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [rc, rcat] = await Promise.all([
        api.get('/compradores/', { params: { busca: busca || undefined, ativo: showInativo ? undefined : true } }),
        api.get('/compradores/categorias'),
      ])
      setLista(rc.data); setCategorias(rcat.data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [busca, showInativo])

  function openForm(c?: Comprador) {
    if (c) {
      setEditando(c)
      setForm({
        nome: c.nome, cpf: c.cpf || '', email: c.email || '',
        telefone: c.telefone || '', celular: c.celular || '',
        cargo: c.cargo || '', departamento: c.departamento || '',
        pin: '', pin_confirm: '',
        categorias_ids: c.categorias_ids || [],
        limite_compra_valor: c.limite_compra_valor > 0 ? String(c.limite_compra_valor) : '',
        nivel_aprovacao: c.nivel_aprovacao || 1,
        pode_aprovar_acima: c.pode_aprovar_acima > 0 ? String(c.pode_aprovar_acima) : '',
        observacoes: c.observacoes || '',
      })
    } else {
      setEditando(null)
      setForm({ ...emptyForm })
    }
    setPinErr(''); setShowPin(false); setShowForm(true)
  }

  function toggleCategoria(id: number) {
    setForm(f => ({
      ...f,
      categorias_ids: f.categorias_ids.includes(id)
        ? f.categorias_ids.filter(x => x !== id)
        : [...f.categorias_ids, id],
    }))
  }

  async function salvar() {
    if (!form.nome.trim()) return
    if (form.pin && form.pin !== form.pin_confirm) { setPinErr('PINs não conferem'); return }
    if (form.pin && form.pin.length < 4) { setPinErr('PIN deve ter no mínimo 4 dígitos'); return }
    if (!editando && !form.pin) { setPinErr('PIN obrigatório para novo comprador'); return }
    setSaving(true)
    try {
      const payload: any = {
        nome: form.nome, cpf: form.cpf || null, email: form.email || null,
        telefone: form.telefone || null, celular: form.celular || null,
        cargo: form.cargo || null, departamento: form.departamento || null,
        categorias_ids: form.categorias_ids,
        limite_compra_valor: Number(form.limite_compra_valor) || 0,
        nivel_aprovacao: form.nivel_aprovacao,
        pode_aprovar_acima: Number(form.pode_aprovar_acima) || 0,
        observacoes: form.observacoes || null,
      }
      if (form.pin) payload.pin = form.pin
      if (editando) await api.put(`/compradores/${editando.id}`, payload)
      else          await api.post('/compradores/', payload)
      setShowForm(false); load()
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro ao salvar') }
    setSaving(false)
  }

  async function remover(c: Comprador) {
    if (!confirm(`Desativar comprador "${c.nome}"?`)) return
    await api.delete(`/compradores/${c.id}`)
    load()
  }

  const fmtMoeda = (v: number) =>
    v > 0 ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Sem limite'

  return (
    <div className="pg">
      {/* ── Header ── */}
      <div className="pg-header">
        <div>
          <h1 className="text-[15px] font-black" style={{ color: 'var(--fg)' }}>Compradores</h1>
          <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
            Cadastro, categorias autorizadas e PIN de acesso
          </p>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <label className="flex items-center gap-1.5 text-[11px] cursor-pointer" style={{ color: 'var(--muted)' }}>
            <input type="checkbox" checked={showInativo} onChange={e => setShowInativo(e.target.checked)} className="w-3.5 h-3.5 rounded" />
            Ver inativos
          </label>
          <div className="relative">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar comprador..."
              className="pl-7 pr-3 py-1.5 rounded-lg text-[11px] border"
              style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--fg)', width: 200 }} />
          </div>
          <button onClick={() => openForm()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black text-white"
            style={{ background: '#f97316' }}>
            <Plus size={11} /> Novo Comprador
          </button>
        </div>
      </div>

      {/* ── Tabela ── */}
      <div className="pg-body">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-[12px]" style={{ color: 'var(--muted)' }}>Carregando...</p>
          </div>
        ) : lista.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <UserCircle2 size={32} style={{ color: 'var(--muted)', opacity: 0.4 }} />
            <p className="text-[13px] font-bold" style={{ color: 'var(--muted)' }}>Nenhum comprador cadastrado</p>
            <button onClick={() => openForm()}
              className="text-[11px] font-black px-3 py-1.5 rounded-lg text-white"
              style={{ background: '#f97316' }}>
              + Cadastrar primeiro comprador
            </button>
          </div>
        ) : (
          <table className="tbl w-full">
            <thead>
              <tr>
                {['Nome / Cargo', 'Contato', 'Categorias', 'Limite', 'Nível', 'PIN', ''].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[10px] font-black uppercase"
                    style={{ color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map(c => {
                const niv = NIVEIS.find(n => n.v === c.nivel_aprovacao)
                return (
                  <tr key={c.id} className="hover:bg-[var(--card2)] transition-colors">
                    <td className="px-3 py-2.5">
                      <p className="text-[12px] font-black" style={{ color: 'var(--fg)' }}>{c.nome}</p>
                      {c.cargo && <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{c.cargo}{c.departamento ? ` · ${c.departamento}` : ''}</p>}
                    </td>
                    <td className="px-3 py-2.5">
                      {c.email && <div className="flex items-center gap-1"><Mail size={9} style={{ color: 'var(--muted)' }} /><span className="text-[10px]" style={{ color: 'var(--muted)' }}>{c.email}</span></div>}
                      {(c.telefone || c.celular) && <div className="flex items-center gap-1"><Phone size={9} style={{ color: 'var(--muted)' }} /><span className="text-[10px]" style={{ color: 'var(--muted)' }}>{c.celular || c.telefone}</span></div>}
                    </td>
                    <td className="px-3 py-2.5">
                      {c.categorias_ids.length === 0 ? (
                        <span className="text-[10px]" style={{ color: 'var(--muted)' }}>Todas</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {c.categorias_nomes.slice(0, 3).map((n, i) => (
                            <span key={i} className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                              style={{ background: '#fff7ed', color: '#f97316', border: '1px solid #fed7aa' }}>{n}</span>
                          ))}
                          {c.categorias_ids.length > 3 && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full"
                              style={{ background: '#f3f4f6', color: '#6b7280' }}>+{c.categorias_ids.length - 3}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[11px] font-bold"
                        style={{ color: c.limite_compra_valor > 0 ? '#16a34a' : 'var(--muted)' }}>
                        {fmtMoeda(c.limite_compra_valor)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {niv && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                          style={{ background: NIV_BG[niv.v], color: NIV_COR[niv.v], border: `1px solid ${NIV_BOR[niv.v]}` }}>
                          {niv.icon} {niv.label}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {c.tem_pin
                        ? <span className="flex items-center gap-1 text-[10px] font-black" style={{ color: '#16a34a' }}><ShieldCheck size={11} /> Ativo</span>
                        : <span className="flex items-center gap-1 text-[10px]" style={{ color: '#ef4444' }}><KeyRound size={11} /> Sem PIN</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openForm(c)} className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors">
                          <Edit3 size={12} style={{ color: '#2563eb' }} />
                        </button>
                        <button onClick={() => remover(c)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                          <Trash2 size={12} style={{ color: '#ef4444' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-6 overflow-y-auto"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}>
          <div style={{
            width: '100%', maxWidth: 640,
            borderRadius: 20, overflow: 'hidden',
            background: '#ffffff',
            boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
          }}>
            {/* Header modal */}
            <div style={{
              padding: '18px 24px 16px',
              borderBottom: '1px solid #f1f5f9',
              background: 'linear-gradient(135deg,#fff7ed,#fff)',
            }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: '#fff7ed', border: '2px solid #fed7aa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <UserCircle2 size={20} style={{ color: '#f97316' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 900, color: '#1e293b' }}>
                      {editando ? 'Editar Comprador' : 'Novo Comprador'}
                    </p>
                    <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                      Dados pessoais, PIN de acesso e categorias autorizadas
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowForm(false)}
                  style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={14} style={{ color: '#94a3b8' }} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* ─ Seção: Dados Pessoais ─ */}
              <Section title="Dados Pessoais" color="#f97316">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <Field label="Nome *">
                      <Inp value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome completo do comprador" />
                    </Field>
                  </div>
                  <Field label="CPF">
                    <Inp value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} placeholder="000.000.000-00" />
                  </Field>
                  <Field label="E-mail">
                    <Inp type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@empresa.com" />
                  </Field>
                  <Field label="Telefone">
                    <Inp value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(47) 3333-3333" />
                  </Field>
                  <Field label="Celular / WhatsApp">
                    <Inp value={form.celular} onChange={e => setForm(f => ({ ...f, celular: e.target.value }))} placeholder="(47) 9 9999-9999" />
                  </Field>
                  <Field label="Cargo">
                    <Inp value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} placeholder="Ex: Comprador Sênior" />
                  </Field>
                  <Field label="Departamento">
                    <Inp value={form.departamento} onChange={e => setForm(f => ({ ...f, departamento: e.target.value }))} placeholder="Ex: Compras, Suprimentos" />
                  </Field>
                </div>
              </Section>

              {/* ─ Seção: PIN ─ */}
              <div style={{ background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: 14, padding: '14px 16px' }}>
                <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
                  <ShieldCheck size={14} style={{ color: '#f97316' }} />
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#f97316', letterSpacing: '0.08em', textTransform: 'uppercase' }}>PIN de Acesso</span>
                  <span style={{ fontSize: 10, background: '#fff', color: '#f97316', border: '1px solid #fed7aa', borderRadius: 20, padding: '1px 8px' }}>
                    Para logar no Pedido de Compra
                  </span>
                  {editando && <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 'auto' }}>Deixe vazio para manter o PIN atual</span>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label={editando ? 'Novo PIN (opcional)' : 'PIN — 4 a 6 dígitos *'}>
                    <div style={{ position: 'relative' }}>
                      <Inp type={showPin ? 'text' : 'password'} value={form.pin} maxLength={6}
                        style={{ paddingRight: 36 }}
                        onChange={e => { setForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '') })); setPinErr('') }}
                        placeholder="••••••" />
                      <button type="button" onClick={() => setShowPin(v => !v)}
                        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer' }}>
                        {showPin ? <EyeOff size={13} style={{ color: '#94a3b8' }} /> : <Eye size={13} style={{ color: '#94a3b8' }} />}
                      </button>
                    </div>
                  </Field>
                  <Field label="Confirmar PIN">
                    <Inp type={showPin ? 'text' : 'password'} value={form.pin_confirm} maxLength={6}
                      onChange={e => { setForm(f => ({ ...f, pin_confirm: e.target.value.replace(/\D/g, '') })); setPinErr('') }}
                      placeholder="••••••" />
                  </Field>
                </div>
                {pinErr && <p style={{ fontSize: 11, color: '#ef4444', marginTop: 6, fontWeight: 700 }}>⚠ {pinErr}</p>}
              </div>

              {/* ─ Seção: Nível de Aprovação ─ */}
              <Section title="Nível de Aprovação" color="#f97316">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                  {NIVEIS.map(n => (
                    <button key={n.v} type="button"
                      onClick={() => setForm(f => ({ ...f, nivel_aprovacao: n.v }))}
                      style={{
                        padding: '14px 12px', borderRadius: 12, cursor: 'pointer',
                        border: `2px solid ${form.nivel_aprovacao === n.v ? NIV_COR[n.v] : '#e2e8f0'}`,
                        background: form.nivel_aprovacao === n.v ? NIV_BG[n.v] : '#f8fafc',
                        textAlign: 'center', transition: 'all 0.15s',
                      }}>
                      <div style={{ fontSize: 22, marginBottom: 4 }}>{n.icon}</div>
                      <p style={{ fontSize: 12, fontWeight: 800, color: form.nivel_aprovacao === n.v ? NIV_COR[n.v] : '#374151', marginBottom: 2 }}>{n.label}</p>
                      <p style={{ fontSize: 10, color: '#94a3b8' }}>{n.desc}</p>
                    </button>
                  ))}
                </div>
              </Section>

              {/* ─ Seção: Limites Financeiros ─ */}
              <Section title="Limites Financeiros" color="#f97316">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Limite por pedido (vazio = sem limite)">
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#94a3b8', fontWeight: 700 }}>R$</span>
                      <Inp type="number" step="0.01" min="0" style={{ paddingLeft: 32 }}
                        value={form.limite_compra_valor}
                        onChange={e => setForm(f => ({ ...f, limite_compra_valor: e.target.value }))}
                        placeholder="0,00" />
                    </div>
                  </Field>
                  <Field label="Pode aprovar pedidos até (vazio = não aprova)">
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#94a3b8', fontWeight: 700 }}>R$</span>
                      <Inp type="number" step="0.01" min="0" style={{ paddingLeft: 32 }}
                        value={form.pode_aprovar_acima}
                        onChange={e => setForm(f => ({ ...f, pode_aprovar_acima: e.target.value }))}
                        placeholder="0,00" />
                    </div>
                  </Field>
                </div>
              </Section>

              {/* ─ Seção: Categorias Autorizadas ─ */}
              <Section title="Categorias Autorizadas" color="#f97316"
                badge={form.categorias_ids.length === 0 ? 'nenhuma = todas liberadas' : `${form.categorias_ids.length} selecionada(s)`}>
                {categorias.length === 0 ? (
                  <p style={{ fontSize: 12, color: '#94a3b8' }}>Carregando categorias...</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                    {categorias.map(cat => {
                      const sel = form.categorias_ids.includes(cat.id)
                      return (
                        <button key={cat.id} type="button" onClick={() => toggleCategoria(cat.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
                            border: `2px solid ${sel ? cat.cor : '#e2e8f0'}`,
                            background: sel ? `${cat.cor}18` : '#f8fafc',
                            transition: 'all 0.15s', textAlign: 'left',
                          }}>
                          <span style={{ fontSize: 16 }}>{cat.icone}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: sel ? cat.cor : '#374151', flex: 1 }}>{cat.nome}</span>
                          {sel && <CheckCircle size={12} style={{ color: cat.cor, flexShrink: 0 }} />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </Section>

              {/* ─ Observações ─ */}
              <Field label="Observações">
                <textarea value={form.observacoes}
                  onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                  placeholder="Anotações sobre o comprador..."
                  rows={2}
                  style={{ ...inputStyle, resize: 'none' }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#f97316')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#e2e8f0')} />
              </Field>

            </div>

            {/* Footer */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10,
              padding: '14px 24px', borderTop: '1px solid #f1f5f9', background: '#f8fafc',
            }}>
              <button onClick={() => setShowForm(false)} style={{
                padding: '9px 20px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', cursor: 'pointer',
              }}>Cancelar</button>
              <button onClick={salvar} disabled={saving || !form.nome.trim()} style={{
                padding: '9px 24px', borderRadius: 10, fontSize: 12, fontWeight: 900,
                background: saving || !form.nome.trim() ? '#e2e8f0' : 'linear-gradient(135deg,#f97316,#ea580c)',
                color: saving || !form.nome.trim() ? '#94a3b8' : '#fff',
                border: 'none', cursor: saving || !form.nome.trim() ? 'not-allowed' : 'pointer',
                boxShadow: saving || !form.nome.trim() ? 'none' : '0 4px 12px rgba(249,115,22,0.35)',
              }}>
                {saving ? 'Salvando...' : editando ? '✓  Salvar Alterações' : '+ Cadastrar Comprador'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Componente de seção ──────────────────────────────────────────────────────

function Section({ title, color, badge, children }: { title: string; color: string; badge?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
        <div style={{ width: 3, height: 14, borderRadius: 2, background: color }} />
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: '#374151', textTransform: 'uppercase' }}>{title}</span>
        {badge && <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 4 }}>{badge}</span>}
      </div>
      {children}
    </div>
  )
}
