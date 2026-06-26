'use client'
import { useEffect, useState } from 'react'
import api, { fmtData } from '@/lib/api'
import { AlertTriangle, Check, X, ShoppingBag } from 'lucide-react'

const PRIOR: Record<string, { bg: string; c: string }> = {
  NORMAL:  { bg: '#8E8E9322', c: '#8E8E93' },
  URGENTE: { bg: '#FF9F0A22', c: '#FF9F0A' },
  CRITICA: { bg: '#FF3B3022', c: '#FF3B30' },
}
const STATUS: Record<string, { bg: string; c: string }> = {
  PENDENTE:  { bg: '#F59E0B22', c: '#F59E0B' },
  EM_PEDIDO: { bg: '#32ADE622', c: '#32ADE6' },
  CONCLUIDA: { bg: '#34C75922', c: '#34C759' },
  CANCELADA: { bg: '#6B728022', c: '#6B7280' },
}

export default function SolicitacoesPage() {
  const [lista, setLista]         = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [statusFiltro, setStatus] = useState('PENDENTE')
  const [selecionadas, setSel]    = useState<number[]>([])
  const [showPedido, setShowPedido] = useState(false)
  const [fornecedores, setFornecedores] = useState<any[]>([])
  const [pedidoForm, setPedidoForm] = useState({ fornecedor_id: '', prazo_entrega: '', observacoes: '' })
  const [saving, setSaving]       = useState(false)

  async function load() {
    setLoading(true)
    const r = await api.get('/compras/solicitacoes', { params: { status: statusFiltro || undefined } })
    setLista(r.data); setLoading(false); setSel([])
  }
  useEffect(() => { load() }, [statusFiltro])
  useEffect(() => {
    api.get('/fornecedores/').then(r => setFornecedores(r.data))
  }, [])

  function toggleSel(id: number) {
    setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }
  function toggleAll() {
    const pendentes = lista.filter(s => s.status === 'PENDENTE').map(s => s.id)
    setSel(s => s.length === pendentes.length ? [] : pendentes)
  }

  async function cancelar(id: number) {
    await api.delete(`/compras/solicitacoes/${id}`)
    load()
  }

  async function gerarPedido() {
    if (!pedidoForm.fornecedor_id || selecionadas.length === 0) return
    setSaving(true)
    try {
      await api.post('/compras/pedidos/de-solicitacoes', {
        fornecedor_id: Number(pedidoForm.fornecedor_id),
        solicitacao_ids: selecionadas,
        prazo_entrega: pedidoForm.prazo_entrega || null,
        observacoes: pedidoForm.observacoes || null,
      })
      setShowPedido(false); load()
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro') }
    setSaving(false)
  }

  const pendentes = lista.filter(s => s.status === 'PENDENTE')
  const inp = "w-full px-3 py-2.5 text-sm rounded-xl"

  return (
    <div className="pg">
      <div className="pg-header space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-base font-black text-white">Solicitações do Repositor</h1>
            <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
              {pendentes.length} pendente(s) · {selecionadas.length} selecionada(s)
            </p>
          </div>
          {selecionadas.length > 0 && (
            <button onClick={() => setShowPedido(true)} className="btn-primary flex items-center gap-2 text-xs py-1.5 px-3">
              <ShoppingBag size={12} /> Gerar Pedido ({selecionadas.length})
            </button>
          )}
        </div>
        <div className="flex gap-1 flex-wrap">
          {['PENDENTE', 'EM_PEDIDO', 'CONCLUIDA', 'CANCELADA', ''].map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold"
              style={{
                background: statusFiltro === s ? '#F97316' : 'var(--card2)',
                color: statusFiltro === s ? 'white' : 'var(--muted)',
              }}>{s || 'Todas'}</button>
          ))}
        </div>
      </div>

      <div className="pg-body">
        <table className="tbl">
          <thead style={{ background: 'var(--card2)' }}>
            <tr>
              <th className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                {statusFiltro === 'PENDENTE' && (
                  <input type="checkbox" onChange={toggleAll}
                    checked={selecionadas.length === pendentes.length && pendentes.length > 0}
                    className="rounded" />
                )}
              </th>
              {['Produto', 'Estoque Atual', 'Qtde Sugerida', 'Enviado por', 'Data', 'Prioridade', 'Status', 'Ações'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold"
                  style={{ color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center py-8" style={{ color: 'var(--muted)' }}>Carregando...</td></tr>
            ) : lista.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-12" style={{ color: 'var(--muted)' }}>Nenhuma solicitação</td></tr>
            ) : lista.map(s => {
              const pc = PRIOR[s.prioridade] || PRIOR.NORMAL
              const sc = STATUS[s.status] || STATUS.PENDENTE
              const isCritica = s.estoque_atual <= 0
              return (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }} className="hover:bg-white/5">
                  <td className="px-4 py-3">
                    {s.status === 'PENDENTE' && (
                      <input type="checkbox" checked={selecionadas.includes(s.id)}
                        onChange={() => toggleSel(s.id)} className="rounded" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-white">{s.produto_descricao}</p>
                    <p className="text-xs font-mono" style={{ color: 'var(--muted)' }}>{s.produto_codigo}</p>
                  </td>
                  <td className="px-4 py-3 font-bold" style={{ color: isCritica ? '#FF3B30' : '#F59E0B' }}>
                    {isCritica && <AlertTriangle size={12} className="inline mr-1" />}
                    {s.estoque_atual} {s.produto_unidade}
                  </td>
                  <td className="px-4 py-3 font-bold text-white">{s.quantidade_sugerida} {s.produto_unidade}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{s.criado_por || '—'}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{fmtData(s.created_at?.slice(0,10))}</td>
                  <td className="px-4 py-3">
                    <span className="badge font-black text-[10px]" style={{ background: pc.bg, color: pc.c }}>{s.prioridade}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge" style={{ background: sc.bg, color: sc.c }}>{s.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    {s.status === 'PENDENTE' && (
                      <button onClick={() => cancelar(s.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: '#FF3B3022', color: '#FF3B30' }}>
                        <X size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showPedido && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-md rounded-3xl p-6 space-y-4" style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between">
              <p className="font-black text-lg text-white">Gerar Pedido de Compra</p>
              <button onClick={() => setShowPedido(false)} style={{ color: 'var(--muted)' }}><X size={20} /></button>
            </div>
            <div className="p-3 rounded-xl text-sm" style={{ background: 'var(--card2)' }}>
              <p className="text-white">{selecionadas.length} solicitaç{selecionadas.length === 1 ? 'ão' : 'ões'} selecionada{selecionadas.length !== 1 ? 's' : ''}</p>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>FORNECEDOR *</label>
              <select value={pedidoForm.fornecedor_id}
                onChange={e => setPedidoForm(f => ({ ...f, fornecedor_id: e.target.value }))} className={inp}>
                <option value="">Selecione...</option>
                {fornecedores.map(f => (
                  <option key={f.id} value={f.id}>{f.fantasia || f.razao_social}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>PRAZO DE ENTREGA</label>
              <input type="date" value={pedidoForm.prazo_entrega}
                onChange={e => setPedidoForm(f => ({ ...f, prazo_entrega: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>OBSERVAÇÕES</label>
              <input value={pedidoForm.observacoes}
                onChange={e => setPedidoForm(f => ({ ...f, observacoes: e.target.value }))} className={inp} />
            </div>
            <button onClick={gerarPedido} disabled={saving || !pedidoForm.fornecedor_id}
              className="btn-primary w-full py-3">
              {saving ? 'Gerando...' : 'Gerar Pedido de Compra'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
