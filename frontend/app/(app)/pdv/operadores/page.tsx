'use client'
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { Plus, Edit2, X, Save, ShieldCheck, User } from 'lucide-react'

const PERFIS = [
  { key: 'OPERADOR',   label: 'Operador',   cor: '#3B82F6' },
  { key: 'SUPERVISOR', label: 'Supervisor', cor: '#F59E0B' },
]

const emptyForm = { numero: '', nome: '', senha: '', perfil: 'OPERADOR', _novo: true }

export default function OperadoresPDVPage() {
  const [lista,   setLista]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form,    setForm]    = useState<any>(null)
  const [saving,  setSaving]  = useState(false)

  async function load() {
    setLoading(true)
    const r = await api.get('/pdv/operadores')
    setLista(r.data); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function salvar() {
    if (!form.numero || !form.nome) { alert('Número e Nome são obrigatórios'); return }
    setSaving(true)
    try {
      if (form._novo) {
        await api.post('/pdv/operadores', { numero: Number(form.numero), nome: form.nome, senha: form.senha || undefined, perfil: form.perfil })
      } else {
        await api.put(`/pdv/operadores/${form.id}`, { numero: Number(form.numero), nome: form.nome, senha: form.senha || undefined, perfil: form.perfil })
      }
      await load(); setForm(null)
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro ao salvar') }
    setSaving(false)
  }

  async function remover(id: number) {
    if (!confirm('Remover operador?')) return
    await api.delete(`/pdv/operadores/${id}`)
    setLista(l => l.filter(o => o.id !== id))
  }

  const inp = 'w-full px-3 py-2.5 text-sm rounded-xl outline-none'

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white">Operadores PDV</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Cadastre operadores e supervisores do terminal de caixa</p>
        </div>
        <button onClick={() => setForm({ ...emptyForm })} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={14} /> Novo Operador
        </button>
      </div>

      <div className="card">
        {loading ? (
          <p className="text-center py-8 text-sm" style={{ color: 'var(--muted)' }}>Carregando...</p>
        ) : lista.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <User size={36} className="mx-auto" style={{ color: 'var(--muted)' }} />
            <p className="font-bold text-white">Nenhum operador cadastrado</p>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Clique em "Novo Operador" para cadastrar</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Nº', 'Nome', 'Perfil', 'Senha', ''].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs font-black" style={{ color: 'var(--muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map(op => {
                const p = PERFIS.find(x => x.key === op.perfil) || PERFIS[0]
                return (
                  <tr key={op.id} style={{ borderBottom: '1px solid var(--border)' }}
                    className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-3">
                      <span className="font-black text-xl" style={{ color: 'var(--muted)', fontFamily: 'monospace' }}>
                        {String(op.numero).padStart(3, '0')}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        {op.perfil === 'SUPERVISOR'
                          ? <ShieldCheck size={16} color="#F59E0B" />
                          : <User size={16} color="#3B82F6" />}
                        <span className="font-bold text-white">{op.nome}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-xs font-black px-2 py-1 rounded-lg"
                        style={{ background: p.cor + '22', color: p.cor }}>
                        {p.label}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>
                        {op.senha_hash ? '••••••' : '(sem senha)'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => setForm({ ...op, senha: '', _novo: false })}
                          className="w-8 h-8 rounded-xl flex items-center justify-center"
                          style={{ background: '#F59E0B22', color: '#F59E0B' }}>
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => remover(op.id)}
                          className="w-8 h-8 rounded-xl flex items-center justify-center"
                          style={{ background: '#EF444422', color: '#EF4444' }}>
                          <X size={13} />
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

      {/* Info */}
      <div className="card" style={{ background: '#0891b222', border: '1px solid #0891b244' }}>
        <p className="text-sm font-bold" style={{ color: '#7dd3fc' }}>Como funciona</p>
        <ul className="text-xs mt-1 space-y-1" style={{ color: '#93c5fd' }}>
          <li>• <strong>Operador</strong> — abre o caixa, processa vendas normais</li>
          <li>• <strong>Supervisor</strong> — autoriza cancelamentos, descontos especiais e outras funções restritas</li>
          <li>• O número do operador é digitado na abertura de caixa no PDV</li>
          <li>• A senha do supervisor é solicitada para funções sensíveis (se habilitado nos Parâmetros PDV)</li>
          <li>• Os dados são sincronizados automaticamente para o PDV na carga</li>
        </ul>
      </div>

      {/* Modal form */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <p className="font-black text-lg text-white">{form._novo ? 'Novo Operador' : 'Editar Operador'}</p>
              <button onClick={() => setForm(null)} style={{ color: 'var(--muted)' }}><X size={20} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-black mb-1.5" style={{ color: 'var(--muted)' }}>NÚMERO DO OPERADOR *</label>
                <input type="number" value={form.numero}
                  onChange={e => setForm((f: any) => ({ ...f, numero: e.target.value }))}
                  placeholder="001" className={inp} style={{ textAlign: 'center', fontSize: 28, fontFamily: 'monospace', fontWeight: 900 }} />
              </div>
              <div>
                <label className="block text-xs font-black mb-1.5" style={{ color: 'var(--muted)' }}>NOME *</label>
                <input type="text" value={form.nome}
                  onChange={e => setForm((f: any) => ({ ...f, nome: e.target.value }))}
                  placeholder="Nome completo do operador" className={inp} />
              </div>
              <div>
                <label className="block text-xs font-black mb-1.5" style={{ color: 'var(--muted)' }}>PERFIL</label>
                <div className="flex gap-2">
                  {PERFIS.map(p => (
                    <button key={p.key} onClick={() => setForm((f: any) => ({ ...f, perfil: p.key }))}
                      className="flex-1 py-2 rounded-xl text-sm font-black"
                      style={{ background: form.perfil === p.key ? p.cor : p.cor + '22',
                               color: form.perfil === p.key ? '#fff' : p.cor,
                               border: `2px solid ${form.perfil === p.key ? p.cor : p.cor + '44'}` }}>
                      {form.perfil === p.key && (p.key === 'SUPERVISOR' ? '🛡️ ' : '👤 ')}{p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-black mb-1.5" style={{ color: 'var(--muted)' }}>
                  SENHA {form._novo ? '' : '(deixe em branco para não alterar)'}
                </label>
                <input type="password" value={form.senha}
                  onChange={e => setForm((f: any) => ({ ...f, senha: e.target.value }))}
                  placeholder="••••••" className={inp} />
                {form.perfil === 'SUPERVISOR' && (
                  <p className="text-[10px] mt-1" style={{ color: '#F59E0B' }}>
                    Supervisor requer senha para autorizar funções restritas no PDV
                  </p>
                )}
              </div>
              <button onClick={salvar} disabled={saving}
                className="w-full py-3.5 rounded-2xl font-black text-white flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg,#F59E0B,#EA580C)' }}>
                <Save size={16} /> {saving ? 'Salvando...' : 'Salvar Operador'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
