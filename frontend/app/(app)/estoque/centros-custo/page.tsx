'use client'
import { useEffect, useState } from 'react'
import api, { fmtMoeda } from '@/lib/api'
import { Plus, Edit2, X, ArrowUpDown, Boxes } from 'lucide-react'

export default function CentrosCustoPage() {
  const [lista, setLista]     = useState<any[]>([])
  const [produtos, setProdutos] = useState<any[]>([])
  const [form, setForm]       = useState<any>(null)
  const [movForm, setMovForm] = useState<any>(null)
  const [saving, setSaving]   = useState(false)
  const [movSaving, setMovSaving] = useState(false)
  const [movs, setMovs]       = useState<Record<number, any[]>>({})

  async function load() {
    const [rc, rp] = await Promise.all([api.get('/centros-custo/'), api.get('/produtos/')])
    setLista(rc.data); setProdutos(rp.data)
  }
  useEffect(() => { load() }, [])

  async function salvar() {
    if (!form.codigo || !form.nome) return
    setSaving(true)
    try {
      if (form._novo) await api.post('/centros-custo/', form)
      else await api.put(`/centros-custo/${form.id}`, form)
      setForm(null); load()
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro') }
    setSaving(false)
  }

  async function registrarMov() {
    if (!movForm.produto_id || !movForm.quantidade || !movForm.centro_custo_id) return
    setMovSaving(true)
    try {
      const r = await api.post('/centros-custo/movimento-manual', movForm)
      alert(`Movimento registrado! Estoque atual: ${r.data.estoque_atual}`)
      setMovForm(null)
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro') }
    setMovSaving(false)
  }

  async function verMovs(id: number) {
    const r = await api.get(`/centros-custo/${id}/movimentos`)
    setMovs(m => ({ ...m, [id]: r.data }))
  }

  const inp = "w-full px-3 py-2.5 text-sm rounded-xl"

  return (
    <div className="h-full overflow-y-auto p-3 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-white">Centros de Custo</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Saída manual por departamento</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setMovForm({ produto_id: '', tipo: 'SAIDA', quantidade: '', centro_custo_id: '', observacao: '' })}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
            style={{ background: '#F59E0B22', color: '#F59E0B', border: '1px solid #F59E0B44' }}>
            <ArrowUpDown size={14} /> Movimentação Manual
          </button>
          <button onClick={() => setForm({ codigo: '', nome: '', departamento: '', descricao: '', _novo: true })}
            className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={14} /> Novo Centro
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {lista.map(c => (
          <div key={c.id} className="card space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs px-2 py-0.5 rounded-lg font-bold"
                    style={{ background: '#F59E0B22', color: '#F59E0B' }}>{c.codigo}</span>
                </div>
                <p className="font-bold text-white mt-1">{c.nome}</p>
                {c.departamento && <p className="text-xs" style={{ color: 'var(--muted)' }}>{c.departamento}</p>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => setForm({ ...c, _novo: false })}
                  className="w-7 h-7 rounded-xl flex items-center justify-center"
                  style={{ background: '#F59E0B22', color: '#F59E0B' }}>
                  <Edit2 size={12} />
                </button>
                <button onClick={() => api.delete(`/centros-custo/${c.id}`).then(load)}
                  className="w-7 h-7 rounded-xl flex items-center justify-center"
                  style={{ background: '#FF3B3022', color: '#FF3B30' }}>
                  <X size={12} />
                </button>
              </div>
            </div>
            <button onClick={() => verMovs(c.id)}
              className="w-full py-2 rounded-xl text-xs font-bold"
              style={{ background: 'var(--card2)', color: 'var(--muted)' }}>
              Ver Últimos Movimentos
            </button>
            {movs[c.id] && (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {movs[c.id].length === 0
                  ? <p className="text-xs text-center py-2" style={{ color: 'var(--muted)' }}>Sem movimentos</p>
                  : movs[c.id].map((m: any) => (
                    <div key={m.id} className="flex items-center gap-2 text-xs py-1"
                      style={{ borderBottom: '1px solid var(--border)' }}>
                      <span className="font-bold flex-shrink-0"
                        style={{ color: m.tipo === 'SAIDA' ? '#FF3B30' : '#34C759' }}>
                        {m.tipo === 'SAIDA' ? '↓' : '↑'} {m.quantidade}
                      </span>
                      <span className="flex-1 truncate text-white">{m.produto}</span>
                      <span style={{ color: 'var(--muted)' }}>{m.data}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        ))}
        {lista.length === 0 && (
          <div className="col-span-3 text-center py-12" style={{ color: 'var(--muted)' }}>
            <Boxes size={32} className="mx-auto mb-2 opacity-40" />
            Nenhum centro de custo cadastrado
          </div>
        )}
      </div>

      {/* Modal centro */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-md rounded-3xl p-6 space-y-4"
            style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between">
              <p className="font-black text-lg text-white">{form._novo ? 'Novo' : 'Editar'} Centro de Custo</p>
              <button onClick={() => setForm(null)} style={{ color: 'var(--muted)' }}><X size={20} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>CÓDIGO *</label>
                <input value={form.codigo} onChange={e => setForm((f: any) => ({ ...f, codigo: e.target.value.toUpperCase() }))} className={inp} placeholder="EX: DEP-01" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>NOME *</label>
                <input value={form.nome} onChange={e => setForm((f: any) => ({ ...f, nome: e.target.value }))} className={inp} placeholder="Estoque Interno" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>DEPARTAMENTO</label>
                <input value={form.departamento} onChange={e => setForm((f: any) => ({ ...f, departamento: e.target.value }))} className={inp} placeholder="Ex: Açougue, Padaria, Limpeza..." />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>DESCRIÇÃO</label>
                <input value={form.descricao} onChange={e => setForm((f: any) => ({ ...f, descricao: e.target.value }))} className={inp} />
              </div>
            </div>
            <button onClick={salvar} disabled={saving} className="btn-primary w-full py-3">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {/* Modal movimentação manual */}
      {movForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-md rounded-3xl p-6 space-y-4"
            style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between">
              <p className="font-black text-lg text-white">Movimentação Manual</p>
              <button onClick={() => setMovForm(null)} style={{ color: 'var(--muted)' }}><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>CENTRO DE CUSTO *</label>
                <select value={movForm.centro_custo_id}
                  onChange={e => setMovForm((f: any) => ({ ...f, centro_custo_id: Number(e.target.value) }))} className={inp}>
                  <option value="">Selecione...</option>
                  {lista.map(c => <option key={c.id} value={c.id}>{c.codigo} — {c.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>TIPO</label>
                <div className="flex gap-2">
                  {['SAIDA', 'ENTRADA'].map(t => (
                    <button key={t} onClick={() => setMovForm((f: any) => ({ ...f, tipo: t }))}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                      style={{
                        background: movForm.tipo === t ? (t === 'SAIDA' ? '#FF3B3022' : '#34C75922') : 'var(--card2)',
                        color: movForm.tipo === t ? (t === 'SAIDA' ? '#FF3B30' : '#34C759') : 'var(--muted)',
                      }}>{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>PRODUTO *</label>
                <select value={movForm.produto_id}
                  onChange={e => setMovForm((f: any) => ({ ...f, produto_id: Number(e.target.value) }))} className={inp}>
                  <option value="">Selecione...</option>
                  {produtos.map(p => <option key={p.id} value={p.id}>{p.descricao} (Estq: {p.estoque_atual})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>QUANTIDADE *</label>
                  <input type="number" step="0.001" min="0.001"
                    value={movForm.quantidade} onChange={e => setMovForm((f: any) => ({ ...f, quantidade: Number(e.target.value) }))} className={inp} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>CUSTO UNIT. (opcional)</label>
                  <input type="number" step="0.01"
                    value={movForm.custo_unitario || ''} onChange={e => setMovForm((f: any) => ({ ...f, custo_unitario: e.target.value ? Number(e.target.value) : null }))} className={inp} placeholder="Usa custo do produto" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>OBSERVAÇÃO</label>
                <input value={movForm.observacao} onChange={e => setMovForm((f: any) => ({ ...f, observacao: e.target.value }))} className={inp} placeholder="Motivo da movimentação..." />
              </div>
            </div>
            <button onClick={registrarMov} disabled={movSaving} className="btn-primary w-full py-3">
              {movSaving ? 'Registrando...' : 'Registrar Movimentação'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
