'use client'
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { Plus, Edit2, Trash2, X, Check, Users, Percent, Tag } from 'lucide-react'

const BLANK = { nome: '', codigo: '', comissao_pct: 0, pode_desconto: false, desconto_max_pct: 0, ativo: true }

export default function VendedoresPage() {
  const [lista,   setLista]   = useState<any[]>([])
  const [show,    setShow]    = useState(false)
  const [editando,setEdit]    = useState<any>(null)
  const [form,    setForm]    = useState<any>(BLANK)
  const [saving,  setSaving]  = useState(false)

  async function load() {
    try { const r = await api.get('/pedido-venda/vendedores'); setLista(r.data) } catch {}
  }
  useEffect(() => { load() }, [])

  function abrir(v?: any) {
    setEdit(v || null)
    setForm(v ? { ...v } : { ...BLANK })
    setShow(true)
  }

  async function salvar() {
    if (!form.nome || !form.codigo) return
    setSaving(true)
    try {
      if (editando) await api.put(`/pedido-venda/vendedores/${editando.id}`, form)
      else          await api.post('/pedido-venda/vendedores', form)
      setShow(false); load()
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro ao salvar') }
    setSaving(false)
  }

  async function excluir(id: number) {
    if (!confirm('Excluir vendedor?')) return
    try { await api.delete(`/pedido-venda/vendedores/${id}`); load() } catch (e: any) { alert(e.response?.data?.detail || 'Erro') }
  }

  const f = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }))
  const inp = "w-full px-3 py-2.5 text-sm rounded-xl"

  return (
    <div className="pg">
      <div className="pg-header flex items-center justify-between">
        <div>
          <h1 className="text-base font-black text-white flex items-center gap-2">
            <Users size={18} color="#F97316" /> Vendedores
          </h1>
          <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
            Cadastre vendedores com comissão e permissão de desconto
          </p>
        </div>
        <button onClick={() => abrir()} className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3">
          <Plus size={12} /> Novo Vendedor
        </button>
      </div>

      <div className="pg-body">
        <div className="grid grid-cols-1 gap-2 max-w-2xl">
          {lista.map(v => (
            <div key={v.id} className="rounded-2xl p-4 flex items-center gap-4"
              style={{ background: 'var(--card2)', border: '1px solid var(--border)', opacity: v.ativo ? 1 : 0.5 }}>
              {/* Avatar */}
              <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-lg flex-shrink-0"
                style={{ background: 'rgba(249,115,22,0.15)', color: '#F97316' }}>
                {v.nome.charAt(0).toUpperCase()}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-black text-white">{v.nome}</p>
                  {!v.ativo && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: '#6B728022', color: '#6B7280' }}>INATIVO</span>
                  )}
                </div>
                <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--muted)' }}>Código: {v.codigo}</p>
              </div>
              {/* Params */}
              <div className="flex gap-3 text-xs flex-shrink-0">
                <div className="text-center">
                  <p className="font-black" style={{ color: '#22C55E' }}>{v.comissao_pct}%</p>
                  <p style={{ color: 'var(--muted)' }}>Comissão</p>
                </div>
                {v.pode_desconto && (
                  <div className="text-center">
                    <p className="font-black" style={{ color: '#F59E0B' }}>{v.desconto_max_pct}%</p>
                    <p style={{ color: 'var(--muted)' }}>Desc. máx</p>
                  </div>
                )}
                {!v.pode_desconto && (
                  <div className="text-center">
                    <p className="text-[10px]" style={{ color: 'var(--muted)' }}>Sem</p>
                    <p style={{ color: 'var(--muted)' }}>desconto</p>
                  </div>
                )}
              </div>
              {/* Ações */}
              <div className="flex gap-1">
                <button onClick={() => abrir(v)}
                  className="w-7 h-7 rounded-xl flex items-center justify-center"
                  style={{ background: '#32ADE622', color: '#32ADE6' }}>
                  <Edit2 size={11} />
                </button>
                <button onClick={() => excluir(v.id)}
                  className="w-7 h-7 rounded-xl flex items-center justify-center"
                  style={{ background: '#FF3B3022', color: '#FF3B30' }}>
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
          {lista.length === 0 && (
            <div className="text-center py-16" style={{ color: 'var(--muted)' }}>
              <Users size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum vendedor cadastrado</p>
              <p className="text-xs mt-1">Clique em "Novo Vendedor" para começar</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-sm rounded-3xl flex flex-col" style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <p className="font-black text-lg text-white">{editando ? 'Editar Vendedor' : 'Novo Vendedor'}</p>
              <button onClick={() => setShow(false)} style={{ color: 'var(--muted)' }}><X size={20} /></button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>NOME *</label>
                <input value={form.nome} onChange={e => f('nome', e.target.value)}
                  className={inp} placeholder="Nome completo" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>CÓDIGO DE ACESSO *</label>
                <input value={form.codigo} onChange={e => f('codigo', e.target.value.toUpperCase())}
                  className={inp} placeholder="Ex: VD01 ou JOAO" />
                <p className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>
                  Usado para identificar o vendedor no pedido de venda
                </p>
              </div>

              {/* Comissão */}
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>COMISSÃO POR VENDA (%)</label>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" max="100" step="0.5" value={form.comissao_pct}
                    onChange={e => f('comissao_pct', parseFloat(e.target.value) || 0)}
                    className={inp} />
                  <Percent size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                </div>
              </div>

              {/* Pode desconto */}
              <div className="rounded-xl p-3" style={{ background: 'var(--card2)' }}>
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-sm font-bold text-white">Pode aplicar desconto</p>
                    <p className="text-[10px]" style={{ color: 'var(--muted)' }}>Permite ao vendedor conceder desconto nos pedidos</p>
                  </div>
                  <div onClick={() => f('pode_desconto', !form.pode_desconto)}
                    className="w-11 h-6 rounded-full relative transition-all flex-shrink-0"
                    style={{ background: form.pode_desconto ? '#34C759' : 'var(--border)' }}>
                    <div className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
                      style={{ left: form.pode_desconto ? 24 : 4 }} />
                  </div>
                </label>
                {form.pode_desconto && (
                  <div className="mt-3">
                    <label className="block text-xs font-bold mb-1" style={{ color: 'var(--muted)' }}>DESCONTO MÁXIMO (%)</label>
                    <input type="number" min="0" max="100" step="0.5" value={form.desconto_max_pct}
                      onChange={e => f('desconto_max_pct', parseFloat(e.target.value) || 0)}
                      className={inp} placeholder="Ex: 10" />
                  </div>
                )}
              </div>

              {/* Ativo */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div onClick={() => f('ativo', !form.ativo)}
                  className="w-11 h-6 rounded-full relative transition-all"
                  style={{ background: form.ativo ? '#34C759' : 'var(--border)' }}>
                  <div className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
                    style={{ left: form.ativo ? 24 : 4 }} />
                </div>
                <span className="text-sm text-white">Vendedor ativo</span>
              </label>
            </div>

            <div className="px-6 py-4" style={{ borderTop: '1px solid var(--border)' }}>
              <button onClick={salvar} disabled={saving || !form.nome || !form.codigo}
                className="btn-primary w-full py-3 flex items-center justify-center gap-2">
                <Check size={14} /> {saving ? 'Salvando...' : editando ? 'Salvar' : 'Criar Vendedor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
