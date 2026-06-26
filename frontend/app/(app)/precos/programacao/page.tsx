'use client'
import { useEffect, useState } from 'react'
import api, { fmtMoeda, fmtData } from '@/lib/api'
import { Plus, X, Calendar, Clock, CheckCircle, XCircle } from 'lucide-react'

const STATUS_C: Record<string, { bg: string; c: string; label: string }> = {
  AGUARDANDO: { bg: '#F59E0B22', c: '#F59E0B', label: 'Aguardando' },
  ATIVO:      { bg: '#34C75922', c: '#34C759', label: 'Ativo'      },
  EXPIRADO:   { bg: '#8E8E9322', c: '#8E8E93', label: 'Expirado'   },
  CANCELADO:  { bg: '#FF3B3022', c: '#FF3B30', label: 'Cancelado'  },
}

export default function ProgramacaoPrecoPage() {
  const [lista, setLista]       = useState<any[]>([])
  const [produtos, setProdutos] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [statusF, setStatus]    = useState('')
  const [showForm, setShow]     = useState(false)
  const [saving, setSaving]     = useState(false)
  const [busca, setBusca]       = useState('')

  const [form, setForm] = useState({
    produto_id: '', preco_novo: '', data_inicio: '', data_fim: '', motivo: '',
  })

  async function load() {
    setLoading(true)
    const [rl, rp] = await Promise.all([
      api.get('/precos/programacoes', { params: { status: statusF || undefined } }),
      api.get('/precos/produtos'),
    ])
    setLista(rl.data); setProdutos(rp.data); setLoading(false)
  }
  useEffect(() => { load() }, [statusF])

  const prodSel = produtos.find(p => p.id === Number(form.produto_id))

  async function salvar() {
    if (!form.produto_id || !form.preco_novo || !form.data_inicio) return
    setSaving(true)
    try {
      await api.post('/precos/programacoes', {
        produto_id:  Number(form.produto_id),
        preco_novo:  parseFloat(form.preco_novo),
        data_inicio: form.data_inicio,
        data_fim:    form.data_fim || null,
        motivo:      form.motivo || null,
      })
      setShow(false)
      setForm({ produto_id: '', preco_novo: '', data_inicio: '', data_fim: '', motivo: '' })
      load()
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro') }
    setSaving(false)
  }

  async function cancelar(id: number) {
    await api.delete(`/precos/programacoes/${id}`)
    load()
  }

  const listaBusca = lista.filter(p =>
    !busca || p.produto_descricao?.toLowerCase().includes(busca.toLowerCase()) || p.produto_codigo?.includes(busca)
  )

  const inp = "w-full px-3 py-2.5 text-sm rounded-xl"

  return (
    <div className="pg">
      <div className="pg-header space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-base font-black text-white">Programação de Preços / Ofertas</h1>
            <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
              Agende alterações de preço por período
            </p>
          </div>
          <button onClick={() => setShow(true)} className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3">
            <Plus size={12} /> Nova Programação
          </button>
        </div>
        <div className="flex gap-1 flex-wrap items-center">
          {['', 'AGUARDANDO', 'ATIVO', 'EXPIRADO', 'CANCELADO'].map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold"
              style={{ background: statusF === s ? '#F97316' : 'var(--card2)', color: statusF === s ? 'white' : 'var(--muted)' }}>
              {s ? STATUS_C[s]?.label : 'Todos'}
            </button>
          ))}
          <div className="ml-auto flex-1 max-w-xs relative">
            <input value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar produto..."
              className="w-full px-3 py-1.5 text-xs rounded-xl"
              style={{ background: 'var(--card2)', color: 'white', border: '1px solid var(--border)' }} />
          </div>
        </div>
      </div>

      <div className="pg-body">
        <table className="tbl">
          <thead>
            <tr>
              {['Produto','Preço Atual','Novo Preço','Diferença','Início','Fim','Status',''].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-8" style={{ color: 'var(--muted)' }}>Carregando...</td></tr>
            ) : listaBusca.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12" style={{ color: 'var(--muted)' }}>
                <Calendar size={32} className="mx-auto mb-2 opacity-40" />
                Nenhuma programação encontrada
              </td></tr>
            ) : listaBusca.map(p => {
              const sc = STATUS_C[p.status] || STATUS_C.AGUARDANDO
              const dif = p.preco_novo - p.preco_atual
              const pct = p.preco_atual > 0 ? (dif / p.preco_atual * 100) : 0
              return (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }} className="hover:bg-white/5">
                  <td className="px-3 py-2">
                    <p className="font-semibold text-white text-xs">{p.produto_descricao}</p>
                    <p className="font-mono text-[10px]" style={{ color: 'var(--muted)' }}>{p.produto_codigo}</p>
                  </td>
                  <td className="px-3 py-2 font-bold" style={{ color: '#F59E0B' }}>{fmtMoeda(p.preco_atual)}</td>
                  <td className="px-3 py-2 font-bold text-white">{fmtMoeda(p.preco_novo)}</td>
                  <td className="px-3 py-2">
                    <span className="text-xs font-bold"
                      style={{ color: dif > 0 ? '#34C759' : dif < 0 ? '#FF3B30' : 'var(--muted)' }}>
                      {dif > 0 ? '+' : ''}{fmtMoeda(dif)} ({pct > 0 ? '+' : ''}{pct.toFixed(1)}%)
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs" style={{ color: 'var(--muted)' }}>{fmtData(p.data_inicio)}</td>
                  <td className="px-3 py-2 text-xs" style={{ color: p.data_fim ? '#FF9F0A' : 'var(--muted)' }}>
                    {p.data_fim ? fmtData(p.data_fim) : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span className="badge" style={{ background: sc.bg, color: sc.c }}>{sc.label}</span>
                  </td>
                  <td className="px-3 py-2">
                    {!['EXPIRADO', 'CANCELADO'].includes(p.status) && (
                      <button onClick={() => cancelar(p.id)}
                        className="w-6 h-6 rounded-lg flex items-center justify-center"
                        style={{ background: '#FF3B3022', color: '#FF3B30' }}>
                        <X size={10} />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-md rounded-3xl p-6 space-y-4"
            style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between">
              <p className="font-black text-lg text-white">Nova Programação</p>
              <button onClick={() => setShow(false)} style={{ color: 'var(--muted)' }}><X size={20} /></button>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>PRODUTO *</label>
              <select value={form.produto_id}
                onChange={e => setForm(f => ({ ...f, produto_id: e.target.value }))} className={inp}>
                <option value="">Selecione...</option>
                {produtos.map(p => <option key={p.id} value={p.id}>{p.descricao} — {fmtMoeda(p.preco_venda)}</option>)}
              </select>
            </div>

            {prodSel && (
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--card2)' }}>
                <div className="flex-1">
                  <p className="text-xs font-bold text-white">{prodSel.descricao}</p>
                  <p className="text-[10px]" style={{ color: 'var(--muted)' }}>Custo: {fmtMoeda(prodSel.preco_custo)} · Margem: {prodSel.margem.toFixed(1)}%</p>
                </div>
                <div className="text-right">
                  <p className="text-base font-black" style={{ color: '#F59E0B' }}>{fmtMoeda(prodSel.preco_venda)}</p>
                  <p className="text-[10px]" style={{ color: 'var(--muted)' }}>atual</p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>NOVO PREÇO *</label>
              <input type="number" step="0.01" min="0" value={form.preco_novo}
                onChange={e => setForm(f => ({ ...f, preco_novo: e.target.value }))}
                className={inp} placeholder="R$ 0,00" />
              {prodSel && form.preco_novo && (
                <p className="text-xs mt-1" style={{ color: parseFloat(form.preco_novo) < prodSel.preco_venda ? '#FF9F0A' : '#34C759' }}>
                  {parseFloat(form.preco_novo) < prodSel.preco_venda ? '▼ Redução de ' : '▲ Aumento de '}
                  {Math.abs(((parseFloat(form.preco_novo) - prodSel.preco_venda) / prodSel.preco_venda * 100)).toFixed(1)}%
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>INÍCIO *</label>
                <input type="date" value={form.data_inicio}
                  onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>FIM (opcional)</label>
                <input type="date" value={form.data_fim}
                  onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))} className={inp} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>MOTIVO</label>
              <input value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))}
                className={inp} placeholder="Ex: Oferta de fim de semana" />
            </div>

            <button onClick={salvar} disabled={saving || !form.produto_id || !form.preco_novo || !form.data_inicio}
              className="btn-primary w-full py-3">
              {saving ? 'Salvando...' : 'Programar Alteração'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
