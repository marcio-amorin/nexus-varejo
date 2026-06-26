'use client'
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { Plus, Edit2, Trash2, X, GripVertical } from 'lucide-react'

const ICONES = ['💵','💳','📱','🔄','🤝','📄','↩️','🏪','🎫','💰','🏦','📲']
const CORES  = ['#34C759','#32ADE6','#5856D6','#00B37E','#FF9F0A','#AF52DE','#8E8E93','#FF3B30','#F59E0B','#EF4444']

const BLANK = { nome:'', chave:'', icone:'💳', cor:'#6366f1', ativo:true, ordem:0, aceita_troco:false, gera_conta_receber:false, vencimento_dias:0 }

export default function FormasRecebimentoPage() {
  const [lista, setLista]   = useState<any[]>([])
  const [show, setShow]     = useState(false)
  const [editando, setEdit] = useState<any>(null)
  const [form, setForm]     = useState<any>(BLANK)
  const [saving, setSaving] = useState(false)

  async function load() {
    const r = await api.get('/formas-recebimento/')
    setLista(r.data)
  }
  useEffect(() => { load() }, [])

  function abrir(f?: any) {
    setEdit(f || null)
    setForm(f ? { ...f } : { ...BLANK, ordem: lista.length + 1 })
    setShow(true)
  }

  async function salvar() {
    if (!form.nome || !form.chave) return
    setSaving(true)
    try {
      if (editando) await api.put(`/formas-recebimento/${editando.id}`, form)
      else          await api.post('/formas-recebimento/', form)
      setShow(false); load()
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro') }
    setSaving(false)
  }

  async function excluir(id: number) {
    if (!confirm('Excluir forma de recebimento?')) return
    try {
      await api.delete(`/formas-recebimento/${id}`)
      load()
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro') }
  }

  const inp = "w-full px-3 py-2.5 text-sm rounded-xl"
  const f   = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }))

  return (
    <div className="pg">
      <div className="pg-header flex items-center justify-between gap-2">
        <div>
          <h1 className="text-base font-black text-white">Formas de Recebimento</h1>
          <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
            Configure as formas disponíveis no PDV · as marcadas como sistema não podem ser excluídas
          </p>
        </div>
        <button onClick={() => abrir()} className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3">
          <Plus size={12} /> Nova Forma
        </button>
      </div>

      <div className="pg-body p-3">
        <div className="grid grid-cols-1 gap-2 max-w-2xl">
          {lista.map(f => (
            <div key={f.id} className="rounded-2xl p-4 flex items-center gap-4"
              style={{ background: 'var(--card2)', border: `1px solid ${f.ativo ? f.cor + '44' : 'var(--border)'}`, opacity: f.ativo ? 1 : 0.5 }}>
              {/* Ícone */}
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: f.cor + '22' }}>
                {f.icone}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-black text-white">{f.nome}</p>
                  {f.is_sistema && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: '#F59E0B22', color: '#F59E0B' }}>SISTEMA</span>
                  )}
                  {!f.ativo && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: '#6B728022', color: '#6B7280' }}>INATIVO</span>
                  )}
                  {f.aceita_troco && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: '#34C75922', color: '#34C759' }}>TROCO</span>
                  )}
                  {f.gera_conta_receber && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: '#F9731622', color: '#F97316' }}>
                      CR {f.vencimento_dias}d
                    </span>
                  )}
                </div>
                <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--muted)' }}>chave: {f.chave}</p>
              </div>
              {/* Cor preview */}
              <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: f.cor }} />
              {/* Ordem */}
              <span className="text-xs font-bold w-6 text-center" style={{ color: 'var(--muted)' }}>#{f.ordem}</span>
              {/* Ações */}
              <div className="flex gap-1">
                <button onClick={() => abrir(f)}
                  className="w-7 h-7 rounded-xl flex items-center justify-center"
                  style={{ background: '#32ADE622', color: '#32ADE6' }}>
                  <Edit2 size={11} />
                </button>
                {!f.is_sistema && (
                  <button onClick={() => excluir(f.id)}
                    className="w-7 h-7 rounded-xl flex items-center justify-center"
                    style={{ background: '#FF3B3022', color: '#FF3B30' }}>
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-md rounded-3xl flex flex-col" style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <p className="font-black text-lg text-white">{editando ? 'Editar Forma' : 'Nova Forma de Recebimento'}</p>
              <button onClick={() => setShow(false)} style={{ color: 'var(--muted)' }}><X size={20} /></button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>NOME *</label>
                <input value={form.nome} onChange={e => f('nome', e.target.value)}
                  className={inp} placeholder="Ex: Vale Alimentação" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>CHAVE (código único) *</label>
                <input value={form.chave} onChange={e => f('chave', e.target.value.toUpperCase().replace(/\s/g, '_'))}
                  disabled={!!editando?.is_sistema}
                  className={inp} placeholder="Ex: VALE_ALIMENTACAO"
                  style={{ opacity: editando?.is_sistema ? 0.5 : 1 }} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>ÍCONE</label>
                  <div className="flex flex-wrap gap-1">
                    {ICONES.map(ic => (
                      <button key={ic} onClick={() => f('icone', ic)}
                        className="w-8 h-8 rounded-lg text-lg flex items-center justify-center"
                        style={{ background: form.icone === ic ? form.cor + '33' : 'var(--card2)', border: form.icone === ic ? `2px solid ${form.cor}` : '2px solid transparent' }}>
                        {ic}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>COR</label>
                  <div className="flex flex-wrap gap-1.5">
                    {CORES.map(c => (
                      <button key={c} onClick={() => f('cor', c)}
                        className="w-7 h-7 rounded-full"
                        style={{ background: c, border: form.cor === c ? '3px solid white' : '3px solid transparent' }} />
                    ))}
                    <input type="color" value={form.cor} onChange={e => f('cor', e.target.value)}
                      className="w-7 h-7 rounded-full cursor-pointer" style={{ padding: 0, border: 'none', background: 'none' }} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>ORDEM NO PDV</label>
                  <input type="number" min="1" value={form.ordem} onChange={e => f('ordem', parseInt(e.target.value))}
                    className={inp} />
                </div>
                <div className="flex flex-col justify-end gap-2 pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div onClick={() => f('ativo', !form.ativo)}
                      className="w-10 h-5 rounded-full transition-all relative"
                      style={{ background: form.ativo ? '#34C759' : 'var(--card2)' }}>
                      <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                        style={{ left: form.ativo ? 22 : 2 }} />
                    </div>
                    <span className="text-xs text-white">Ativo</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div onClick={() => f('aceita_troco', !form.aceita_troco)}
                      className="w-10 h-5 rounded-full transition-all relative"
                      style={{ background: form.aceita_troco ? '#34C759' : 'var(--card2)' }}>
                      <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                        style={{ left: form.aceita_troco ? 22 : 2 }} />
                    </div>
                    <span className="text-xs text-white">Aceita troco</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div onClick={() => f('gera_conta_receber', !form.gera_conta_receber)}
                      className="w-10 h-5 rounded-full transition-all relative"
                      style={{ background: form.gera_conta_receber ? '#F97316' : 'var(--card2)' }}>
                      <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                        style={{ left: form.gera_conta_receber ? 22 : 2 }} />
                    </div>
                    <span className="text-xs text-white">Gera conta a receber</span>
                  </label>
                </div>
              </div>

              {form.gera_conta_receber && (
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>
                    VENCIMENTO (dias após a venda)
                  </label>
                  <input type="number" min="1" value={form.vencimento_dias}
                    onChange={e => f('vencimento_dias', parseInt(e.target.value) || 0)}
                    className={inp} placeholder="Ex: 30" />
                </div>
              )}
            </div>

            <div className="px-6 py-4" style={{ borderTop: '1px solid var(--border)' }}>
              <button onClick={salvar} disabled={saving || !form.nome || !form.chave}
                className="btn-primary w-full py-3">
                {saving ? 'Salvando...' : editando ? 'Salvar' : 'Criar Forma'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
