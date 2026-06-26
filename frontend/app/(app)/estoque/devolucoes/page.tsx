'use client'
import { useEffect, useState } from 'react'
import api, { fmtMoeda, fmtData } from '@/lib/api'
import { Plus, X, Search, Gift, RotateCcw } from 'lucide-react'

export default function DevolucoesPage() {
  const [lista, setLista]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [produtos, setProdutos] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]   = useState(false)

  const [form, setForm] = useState({
    cliente_nome: '', cliente_cpf: '', venda_numero: '', motivo: '', observacoes: '',
  })
  const [itens, setItens] = useState([{ produto_id: '', quantidade: '', preco_unitario: '' }])

  const [cpfConsulta, setCpfConsulta] = useState('')
  const [creditoInfo, setCreditoInfo] = useState<any>(null)

  async function load() {
    setLoading(true)
    const [rd, rp] = await Promise.all([api.get('/devolucoes/'), api.get('/produtos/')])
    setLista(rd.data); setProdutos(rp.data); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function buscarCredito() {
    if (!cpfConsulta) return
    try {
      const r = await api.get(`/devolucoes/credito/${cpfConsulta}`)
      setCreditoInfo(r.data)
    } catch { setCreditoInfo({ credito_total: 0, cliente_nome: null, devolucoes: [] }) }
  }

  async function salvar() {
    const itensFiltrados = itens.filter(i => i.produto_id && i.quantidade && i.preco_unitario)
    if (!itensFiltrados.length) return alert('Adicione ao menos um produto')
    setSaving(true)
    try {
      await api.post('/devolucoes/', {
        ...form,
        itens: itensFiltrados.map(i => ({
          produto_id: Number(i.produto_id),
          quantidade: Number(i.quantidade),
          preco_unitario: Number(i.preco_unitario),
        })),
      })
      setShowForm(false)
      setForm({ cliente_nome: '', cliente_cpf: '', venda_numero: '', motivo: '', observacoes: '' })
      setItens([{ produto_id: '', quantidade: '', preco_unitario: '' }])
      load()
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro') }
    setSaving(false)
  }

  async function cancelar(id: number) {
    if (!confirm('Cancelar esta devolução? O estoque será revertido.')) return
    try { await api.delete(`/devolucoes/${id}`); load() }
    catch (e: any) { alert(e.response?.data?.detail || 'Erro') }
  }

  const inp = "w-full px-3 py-2.5 text-sm rounded-xl"
  const total = itens.reduce((s, i) => s + (Number(i.quantidade) * Number(i.preco_unitario) || 0), 0)

  return (
    <div className="pg">
      <div className="pg-header flex items-center justify-between gap-2">
        <div>
          <h1 className="text-base font-black text-white">Devoluções / Trocas</h1>
          <p className="text-[10px]" style={{ color: 'var(--muted)' }}>Crédito para uso no PDV</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 text-xs py-1.5 px-3">
          <Plus size={12} /> Nova Devolução
        </button>
      </div>

      {/* Consulta de crédito */}
      <div className="pg-stats card space-y-2">
        <div className="flex items-center gap-2">
          <Gift size={16} color="#FF9F0A" />
          <h2 className="font-bold text-white text-sm">Consultar Crédito por CPF</h2>
        </div>
        <div className="flex gap-2">
          <input value={cpfConsulta} onChange={e => setCpfConsulta(e.target.value)}
            placeholder="CPF do cliente" className="flex-1 px-3 py-2.5 text-sm rounded-xl"
            style={{ background: 'var(--card2)', color: 'white', border: '1px solid var(--border)' }} />
          <button onClick={buscarCredito} className="btn-primary px-4 py-2.5 text-sm flex items-center gap-1">
            <Search size={14} /> Consultar
          </button>
        </div>
        {creditoInfo && (
          <div className="p-4 rounded-2xl" style={{ background: '#FF9F0A18', border: '1px solid #FF9F0A33' }}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-bold text-white">{creditoInfo.cliente_nome || 'Consumidor Final'}</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>CPF: {cpfConsulta}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black" style={{ color: '#FF9F0A' }}>{fmtMoeda(creditoInfo.credito_total)}</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>crédito disponível</p>
              </div>
            </div>
            {creditoInfo.devolucoes?.map((d: any, i: number) => (
              <div key={i} className="flex justify-between text-xs py-1" style={{ borderTop: '1px solid #FF9F0A22' }}>
                <span style={{ color: 'var(--muted)' }}>{d.numero} — {fmtData(d.data)}</span>
                <span className="font-bold" style={{ color: '#FF9F0A' }}>{fmtMoeda(d.credito_disponivel)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="pg-body">
        <table className="tbl">
          <thead style={{ background: 'var(--card2)' }}>
            <tr>
              {['Número', 'Cliente', 'CPF', 'Venda Orig.', 'Valor', 'Crédito Disp.', 'Data', 'Status', 'Ações'].map(h => (
                <th key={h} className="px-3 py-3 text-left text-xs font-bold"
                  style={{ color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center py-8" style={{ color: 'var(--muted)' }}>Carregando...</td></tr>
            ) : lista.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-10" style={{ color: 'var(--muted)' }}>
                <RotateCcw size={28} className="mx-auto mb-2 opacity-40" />Nenhuma devolução
              </td></tr>
            ) : lista.map(d => (
              <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }} className="hover:bg-white/5">
                <td className="px-3 py-2.5 font-mono text-xs font-bold" style={{ color: '#F59E0B' }}>{d.numero}</td>
                <td className="px-3 py-2.5 text-white">{d.cliente_nome || '—'}</td>
                <td className="px-3 py-2.5 font-mono text-xs" style={{ color: 'var(--muted)' }}>{d.cliente_cpf || '—'}</td>
                <td className="px-3 py-2.5" style={{ color: 'var(--muted)' }}>{d.venda_numero || '—'}</td>
                <td className="px-3 py-2.5 font-bold" style={{ color: '#F59E0B' }}>{fmtMoeda(d.valor_total)}</td>
                <td className="px-3 py-2.5 font-bold" style={{ color: d.credito_disponivel > 0 ? '#FF9F0A' : 'var(--muted)' }}>
                  {fmtMoeda(d.credito_disponivel)}
                </td>
                <td className="px-3 py-2.5" style={{ color: 'var(--muted)' }}>{fmtData(d.data_devolucao)}</td>
                <td className="px-3 py-2.5">
                  <span className="badge text-[10px]" style={{
                    background: d.status === 'APROVADA' ? '#34C75922' : '#FF3B3022',
                    color: d.status === 'APROVADA' ? '#34C759' : '#FF3B30',
                  }}>{d.status}</span>
                </td>
                <td className="px-3 py-2.5">
                  {d.status === 'APROVADA' && d.credito_usado === 0 && (
                    <button onClick={() => cancelar(d.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: '#FF3B3022', color: '#FF3B30' }}>
                      <X size={12} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal nova devolução */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-xl rounded-3xl flex flex-col"
            style={{ background: 'var(--card)', maxHeight: '92vh' }}>
            <div className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <p className="font-black text-lg text-white">Nova Devolução / Troca</p>
              <button onClick={() => setShowForm(false)} style={{ color: 'var(--muted)' }}><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>NOME DO CLIENTE</label>
                  <input value={form.cliente_nome} onChange={e => setForm(f => ({ ...f, cliente_nome: e.target.value }))} className={inp} placeholder="Nome ou Consumidor Final" />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>CPF (para crédito no PDV)</label>
                  <input value={form.cliente_cpf} onChange={e => setForm(f => ({ ...f, cliente_cpf: e.target.value }))} className={inp} placeholder="000.000.000-00" />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>NOTA / VENDA ORIGINAL</label>
                  <input value={form.venda_numero} onChange={e => setForm(f => ({ ...f, venda_numero: e.target.value }))} className={inp} placeholder="VD-00001" />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>MOTIVO</label>
                  <input value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))} className={inp} placeholder="Produto com defeito..." />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold" style={{ color: 'var(--muted)' }}>PRODUTOS A DEVOLVER</label>
                  <button onClick={() => setItens(ii => [...ii, { produto_id: '', quantidade: '', preco_unitario: '' }])}
                    className="text-xs font-bold" style={{ color: '#F59E0B' }}>+ Adicionar</button>
                </div>
                {itens.map((it, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 mb-2 items-center">
                    <div className="col-span-6">
                      <select value={it.produto_id}
                        onChange={e => {
                          const p = produtos.find(x => x.id === Number(e.target.value))
                          setItens(ii => ii.map((x, j) => j === i ? { ...x, produto_id: e.target.value, preco_unitario: p ? String(p.preco_venda) : '' } : x))
                        }} className={inp}>
                        <option value="">Produto...</option>
                        {produtos.map(p => <option key={p.id} value={p.id}>{p.descricao}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <input type="number" min="0.001" step="0.001" placeholder="Qtde"
                        value={it.quantidade} onChange={e => setItens(ii => ii.map((x, j) => j === i ? { ...x, quantidade: e.target.value } : x))} className={inp} />
                    </div>
                    <div className="col-span-3">
                      <input type="number" min="0" step="0.01" placeholder="Preço"
                        value={it.preco_unitario} onChange={e => setItens(ii => ii.map((x, j) => j === i ? { ...x, preco_unitario: e.target.value } : x))} className={inp} />
                    </div>
                    <div className="col-span-1">
                      {itens.length > 1 && (
                        <button onClick={() => setItens(ii => ii.filter((_, j) => j !== i))}
                          className="w-full h-10 rounded-xl flex items-center justify-center"
                          style={{ background: '#FF3B3022', color: '#FF3B30' }}><X size={12} /></button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex justify-end">
                  <p className="text-base font-black" style={{ color: '#FF9F0A' }}>
                    Crédito gerado: {fmtMoeda(total)}
                  </p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                O crédito ficará vinculado ao CPF do cliente e poderá ser usado como forma de pagamento no PDV.
              </p>
              <button onClick={salvar} disabled={saving} className="btn-primary w-full py-3">
                {saving ? 'Salvando...' : 'Registrar Devolução e Gerar Crédito'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
