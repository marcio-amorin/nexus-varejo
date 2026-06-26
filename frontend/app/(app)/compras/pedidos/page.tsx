'use client'
import { useEffect, useState } from 'react'
import api, { fmtMoeda, fmtData } from '@/lib/api'
import { Plus, Eye, X, Check, Truck, Zap, RefreshCw, ChevronRight } from 'lucide-react'

const STATUS_C: Record<string, { bg: string; c: string }> = {
  RASCUNHO:  { bg: '#8E8E9322', c: '#8E8E93' },
  ENVIADO:   { bg: '#32ADE622', c: '#32ADE6' },
  PARCIAL:   { bg: '#FF9F0A22', c: '#FF9F0A' },
  RECEBIDO:  { bg: '#34C75922', c: '#34C759' },
  CANCELADO: { bg: '#FF3B3022', c: '#FF3B30' },
}

export default function PedidosCompraPage() {
  const [aba,          setAba]       = useState<'pedidos'|'automatico'>('pedidos')
  const [pedidos,      setPedidos]   = useState<any[]>([])
  const [fornecedores, setForn]      = useState<any[]>([])
  const [produtos,     setProdutos]  = useState<any[]>([])
  const [loading,      setLoading]   = useState(true)
  const [statusFiltro, setStatus]    = useState('')
  const [detalhe,      setDetalhe]   = useState<any>(null)
  const [showForm,     setShowForm]  = useState(false)
  const [saving,       setSaving]    = useState(false)
  const [pendentes,    setPendentes] = useState<any[]>([])
  const [gerandoAuto,  setGerandoAuto] = useState(false)
  const [gerandoId,    setGerandoId] = useState<number|null>(null)

  const [form, setForm] = useState({
    fornecedor_id: '', prazo_entrega: '', observacoes: '',
  })
  const [itens, setItens] = useState<{ produto_id: string; quantidade: string; preco_unitario: string }[]>([
    { produto_id: '', quantidade: '', preco_unitario: '' },
  ])

  async function load() {
    setLoading(true)
    const [rp, rf, rprod] = await Promise.all([
      api.get('/compras/pedidos', { params: { status: statusFiltro || undefined } }),
      api.get('/fornecedores/'),
      api.get('/produtos/'),
    ])
    setPedidos(rp.data); setForn(rf.data); setProdutos(rprod.data)
    setLoading(false)
  }
  async function loadPendentes() {
    try {
      const r = await api.get('/agenda-compras/auto/pendentes')
      setPendentes(r.data)
    } catch {}
  }
  useEffect(() => { load() }, [statusFiltro])
  useEffect(() => { if (aba === 'automatico') { loadPendentes(); load() } }, [aba])

  async function gerarAutoTodos() {
    setGerandoAuto(true)
    try {
      const r = await api.post('/agenda-compras/auto/gerar-todos')
      const g = r.data.gerados as any[]
      if (g.length === 0) alert('Nenhum pedido necessário agora (nenhum fornecedor com visita em ≤ 2 dias).')
      else alert(`${g.length} pedido(s) gerado(s): ${g.map((x:any) => x.numero).join(', ')}`)
      loadPendentes(); load()
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro') }
    setGerandoAuto(false)
  }

  async function gerarAutoUm(fornId: number) {
    setGerandoId(fornId)
    try {
      const r = await api.post(`/agenda-compras/${fornId}/auto-gerar`)
      if (r.data.ok) alert(`Pedido ${r.data.numero} gerado! ${fmtMoeda(r.data.valor_total)}`)
      else alert(r.data.mensagem)
      loadPendentes(); load()
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro') }
    setGerandoId(null)
  }

  async function verDetalhe(id: number) {
    const r = await api.get(`/compras/pedidos/${id}`)
    setDetalhe(r.data)
  }

  async function mudarStatus(id: number, status: string) {
    await api.put(`/compras/pedidos/${id}`, { status })
    setDetalhe(null); load()
  }

  async function salvar() {
    if (!form.fornecedor_id) return
    const itensFiltrados = itens.filter(i => i.produto_id && i.quantidade)
    if (!itensFiltrados.length) return alert('Adicione ao menos um produto')
    setSaving(true)
    try {
      await api.post('/compras/pedidos', {
        fornecedor_id: Number(form.fornecedor_id),
        prazo_entrega: form.prazo_entrega || null,
        observacoes: form.observacoes || null,
        itens: itensFiltrados.map(i => ({
          produto_id: Number(i.produto_id),
          quantidade: Number(i.quantidade),
          preco_unitario: Number(i.preco_unitario) || 0,
        })),
      })
      setShowForm(false)
      setForm({ fornecedor_id: '', prazo_entrega: '', observacoes: '' })
      setItens([{ produto_id: '', quantidade: '', preco_unitario: '' }])
      load()
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro') }
    setSaving(false)
  }

  function addItem() { setItens(ii => [...ii, { produto_id: '', quantidade: '', preco_unitario: '' }]) }
  function remItem(i: number) { setItens(ii => ii.filter((_, j) => j !== i)) }
  function upItem(i: number, f: string, v: string) {
    setItens(ii => ii.map((it, j) => j === i ? { ...it, [f]: v } : it))
  }

  const inp = "w-full px-3 py-2.5 text-sm rounded-xl"

  const pedidosAuto = pedidos.filter(p => p.origem === 'AUTO')

  return (
    <div className="pg">
      <div className="pg-header flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-base font-black text-white">Pedidos de Compra</h1>
            <p className="text-[10px]" style={{ color:'var(--muted)' }}>{pedidos.length} pedido(s)</p>
          </div>
        </div>
        <button onClick={()=>setShowForm(true)} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
          <Plus size={11}/> Novo Pedido
        </button>
      </div>

      {/* Abas */}
      <div className="flex gap-1 px-1">
        {[
          { k: 'pedidos',    l: '📋 Pedidos',    count: pedidos.length },
          { k: 'automatico', l: '⚡ Automático',  count: pendentes.filter(p => !p.pedido_auto_id).length },
        ].map(t => (
          <button key={t.k} onClick={() => setAba(t.k as any)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all"
            style={{
              background: aba === t.k ? '#F97316' : 'var(--card)',
              color: aba === t.k ? 'white' : 'var(--muted)',
              border: `1px solid ${aba === t.k ? '#F97316' : 'var(--border)'}`,
            }}>
            {t.l}
            {t.count > 0 && (
              <span className="w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center"
                style={{ background: aba === t.k ? 'rgba(255,255,255,0.3)' : 'rgba(249,115,22,0.2)', color: aba === t.k ? 'white' : '#F97316' }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── ABA AUTOMÁTICO ── */}
      {aba === 'automatico' && (
        <div className="pg-body space-y-4">
          {/* Header automático */}
          <div className="rounded-2xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-black text-white flex items-center gap-2"><Zap size={16} color="#F97316" /> Geração Automática D-2</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Gera pedidos de compra 2 dias antes da visita do fornecedor, usando média de vendas + parâmetros configurados</p>
              </div>
              <div className="flex gap-2">
                <button onClick={loadPendentes}
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: 'var(--card2)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                  <RefreshCw size={12} />
                </button>
                <button onClick={gerarAutoTodos} disabled={gerandoAuto}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black"
                  style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)', color: 'white' }}>
                  <Zap size={12} /> {gerandoAuto ? 'Gerando...' : 'Gerar Todos D-2'}
                </button>
              </div>
            </div>

            {/* Fórmula */}
            <div className="rounded-xl p-3 text-[10px]" style={{ background: 'var(--card2)', color: 'var(--muted)' }}>
              <span className="font-bold" style={{ color: 'var(--text)' }}>Fórmula: </span>
              Qtd sugerida = (média_diária × dias_a_cobrir) × (1 + margem_seg%) × (1 + pct_repos%) + repos_adicional − estoque_atual
            </div>
          </div>

          {/* Fornecedores pendentes */}
          <div>
            <p className="text-xs font-bold mb-2" style={{ color: 'var(--muted)' }}>FORNECEDORES COM VISITA EM ≤ 2 DIAS</p>
            {pendentes.length === 0 ? (
              <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <Zap size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm" style={{ color: 'var(--muted)' }}>Nenhum fornecedor com visita agendada nos próximos 2 dias</p>
                <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Configure a agenda em Compras → Agenda Fornecedores</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendentes.map(p => (
                  <div key={p.fornecedor_id} className="rounded-2xl p-4 flex items-center gap-4"
                    style={{ background: 'var(--card)', border: `1px solid ${p.dias_restantes <= 0 ? '#EF4444' : '#F97316'}` }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black flex-shrink-0"
                      style={{ background: p.dias_restantes <= 0 ? '#EF444422' : '#F9731622', color: p.dias_restantes <= 0 ? '#EF4444' : '#F97316' }}>
                      {p.dias_restantes <= 0 ? '!' : p.dias_restantes}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-white">{p.fornecedor_nome}</p>
                      <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
                        Visita: {p.proxima_visita ? new Date(p.proxima_visita + 'T12:00').toLocaleDateString('pt-BR') : '—'}
                        {' · '}{p.dias_restantes > 0 ? `em ${p.dias_restantes} dia(s)` : 'HOJE'}
                        {' · '}freq. {p.frequencia_dias}d · entrega {p.dias_entrega}d
                      </p>
                      {p.pedido_auto_numero && (
                        <p className="text-[10px] mt-0.5 font-bold" style={{ color: '#34C759' }}>
                          ✓ Pedido gerado: {p.pedido_auto_numero}
                        </p>
                      )}
                    </div>
                    <div>
                      {p.pedido_auto_id ? (
                        <span className="text-[10px] font-bold px-2 py-1 rounded-lg"
                          style={{ background: '#34C75922', color: '#34C759' }}>
                          ✓ Gerado
                        </span>
                      ) : (
                        <button onClick={() => gerarAutoUm(p.fornecedor_id)} disabled={gerandoId === p.fornecedor_id}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black"
                          style={{ background: 'rgba(249,115,22,0.15)', color: '#F97316', border: '1px solid rgba(249,115,22,0.35)' }}>
                          <Zap size={11} /> {gerandoId === p.fornecedor_id ? 'Gerando...' : 'Gerar Pedido'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pedidos AUTO gerados */}
          {pedidosAuto.length > 0 && (
            <div>
              <p className="text-xs font-bold mb-2" style={{ color: 'var(--muted)' }}>PEDIDOS AUTOMÁTICOS GERADOS</p>
              <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <table className="tbl">
                  <thead><tr>
                    <th>Número</th><th>Fornecedor</th><th>Data</th><th>Prazo</th><th>Total</th><th>Status</th><th></th>
                  </tr></thead>
                  <tbody>
                    {pedidosAuto.map(p => {
                      const sc = STATUS_C[p.status] || STATUS_C.RASCUNHO
                      return (
                        <tr key={p.id}>
                          <td className="font-mono font-black text-xs" style={{ color: '#F59E0B' }}>
                            <span style={{ marginRight: 4 }}>⚡</span>{p.numero}
                          </td>
                          <td className="text-white">{p.fornecedor_nome}</td>
                          <td style={{ color: 'var(--muted)' }}>{fmtData(p.data_pedido)}</td>
                          <td style={{ color: p.prazo_entrega ? '#FF9F0A' : 'var(--muted)' }}>
                            {p.prazo_entrega ? fmtData(p.prazo_entrega) : '—'}
                          </td>
                          <td className="font-bold" style={{ color: '#F59E0B' }}>{fmtMoeda(p.valor_total)}</td>
                          <td><span className="badge" style={{ background: sc.bg, color: sc.c }}>{p.status}</span></td>
                          <td>
                            <button onClick={() => verDetalhe(p.id)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center"
                              style={{ background: '#F59E0B22', color: '#F59E0B' }}>
                              <Eye size={12} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ABA PEDIDOS ── */}
      {aba === 'pedidos' && <>
      {/* Filtros status */}
      <div className="flex gap-1 flex-wrap">
        {['','RASCUNHO','ENVIADO','PARCIAL','RECEBIDO','CANCELADO'].map(s=>(
          <button key={s} onClick={()=>setStatus(s)}
            className="px-2.5 py-1 rounded-lg text-[10px] font-bold"
            style={{ background:statusFiltro===s?'#F97316':'var(--card2)', color:statusFiltro===s?'white':'var(--muted)' }}>
            {s||'Todos'}
          </button>
        ))}
      </div>
      <div className="pg-body">
        <table className="tbl">
          <thead>
            <tr>
              {['Número','Fornecedor','Data','Prazo','Itens','Total','Status',''].map(h=>(
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-8" style={{ color: 'var(--muted)' }}>Carregando...</td></tr>
            ) : pedidos.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12" style={{ color: 'var(--muted)' }}>
                <Truck size={32} className="mx-auto mb-2" />
                Nenhum pedido encontrado
              </td></tr>
            ) : pedidos.map(p => {
              const sc = STATUS_C[p.status] || STATUS_C.RASCUNHO
              return (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }} className="hover:bg-white/5">
                  <td className="px-4 py-3 font-mono text-xs font-bold" style={{ color: '#F59E0B' }}>{p.numero}</td>
                  <td className="px-4 py-3 text-white">{p.fornecedor_nome}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{fmtData(p.data_pedido)}</td>
                  <td className="px-4 py-3" style={{ color: p.prazo_entrega ? '#FF9F0A' : 'var(--muted)' }}>
                    {p.prazo_entrega ? fmtData(p.prazo_entrega) : '—'}
                  </td>
                  <td className="px-4 py-3 text-center" style={{ color: 'var(--muted)' }}>{p.total_itens}</td>
                  <td className="px-4 py-3 font-bold" style={{ color: '#F59E0B' }}>{fmtMoeda(p.valor_total)}</td>
                  <td className="px-4 py-3">
                    <span className="badge" style={{ background: sc.bg, color: sc.c }}>{p.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => verDetalhe(p.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: '#F59E0B22', color: '#F59E0B' }}>
                      <Eye size={12} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal Detalhe */}
      {detalhe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-lg rounded-3xl flex flex-col"
            style={{ background: 'var(--card)', maxHeight: '90vh' }}>
            <div className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <div>
                <p className="font-black text-lg text-white">{detalhe.numero}</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>{detalhe.fornecedor_nome}</p>
              </div>
              <div className="flex items-center gap-2">
                {detalhe.status === 'RASCUNHO' && (
                  <button onClick={() => mudarStatus(detalhe.id, 'ENVIADO')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
                    style={{ background: '#32ADE622', color: '#32ADE6' }}>
                    <Truck size={12} /> Enviar ao Fornecedor
                  </button>
                )}
                {detalhe.status === 'ENVIADO' && (
                  <button onClick={() => mudarStatus(detalhe.id, 'RECEBIDO')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
                    style={{ background: '#34C75922', color: '#34C759' }}>
                    <Check size={12} /> Confirmar Recebimento
                  </button>
                )}
                {!['RECEBIDO', 'CANCELADO'].includes(detalhe.status) && (
                  <button onClick={() => mudarStatus(detalhe.id, 'CANCELADO')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
                    style={{ background: '#FF3B3022', color: '#FF3B30' }}>
                    <X size={12} /> Cancelar
                  </button>
                )}
                <button onClick={() => setDetalhe(null)} style={{ color: 'var(--muted)' }}><X size={20} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                <table className="w-full text-xs">
                  <thead style={{ background: 'var(--card2)' }}>
                    <tr>
                      {['Produto', 'Qtde', 'Preço Unit.', 'Total'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left font-bold" style={{ color: 'var(--muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detalhe.itens?.map((it: any, i: number) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                        <td className="px-3 py-2.5">
                          <p className="font-semibold text-white">{it.produto_descricao}</p>
                          <p className="font-mono" style={{ color: 'var(--muted)' }}>{it.produto_codigo}</p>
                        </td>
                        <td className="px-3 py-2.5 text-white">{it.quantidade} {it.produto_unidade}</td>
                        <td className="px-3 py-2.5" style={{ color: 'var(--muted)' }}>{fmtMoeda(it.preco_unitario)}</td>
                        <td className="px-3 py-2.5 font-bold" style={{ color: '#F59E0B' }}>{fmtMoeda(it.valor_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-sm" style={{ color: 'var(--muted)' }}>Total do Pedido</span>
                <span className="text-xl font-black" style={{ color: '#F59E0B' }}>{fmtMoeda(detalhe.valor_total)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Pedido */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-2xl rounded-3xl flex flex-col"
            style={{ background: 'var(--card)', maxHeight: '92vh' }}>
            <div className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <p className="font-black text-lg text-white">Novo Pedido de Compra</p>
              <button onClick={() => setShowForm(false)} style={{ color: 'var(--muted)' }}><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>FORNECEDOR *</label>
                  <select value={form.fornecedor_id}
                    onChange={e => setForm(f => ({ ...f, fornecedor_id: e.target.value }))} className={inp}>
                    <option value="">Selecione...</option>
                    {fornecedores.map(f => <option key={f.id} value={f.id}>{f.fantasia || f.razao_social}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>PRAZO ENTREGA</label>
                  <input type="date" value={form.prazo_entrega}
                    onChange={e => setForm(f => ({ ...f, prazo_entrega: e.target.value }))} className={inp} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>OBSERVAÇÕES</label>
                  <input value={form.observacoes}
                    onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} className={inp} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold" style={{ color: 'var(--muted)' }}>ITENS DO PEDIDO</label>
                  <button onClick={addItem} className="text-xs font-bold" style={{ color: '#F59E0B' }}>+ Adicionar Item</button>
                </div>
                <div className="space-y-2">
                  {itens.map((it, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-6">
                        <select value={it.produto_id} onChange={e => upItem(i, 'produto_id', e.target.value)} className={inp}>
                          <option value="">Produto...</option>
                          {produtos.map(p => <option key={p.id} value={p.id}>{p.descricao}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <input type="number" step="0.001" placeholder="Qtde"
                          value={it.quantidade} onChange={e => upItem(i, 'quantidade', e.target.value)} className={inp} />
                      </div>
                      <div className="col-span-3">
                        <input type="number" step="0.01" placeholder="R$ Custo"
                          value={it.preco_unitario} onChange={e => upItem(i, 'preco_unitario', e.target.value)} className={inp} />
                      </div>
                      <div className="col-span-1">
                        {itens.length > 1 && (
                          <button onClick={() => remItem(i)}
                            className="w-full h-10 rounded-xl flex items-center justify-center"
                            style={{ background: '#FF3B3022', color: '#FF3B30' }}>
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4" style={{ borderTop: '1px solid var(--border)' }}>
              <button onClick={salvar} disabled={saving || !form.fornecedor_id} className="btn-primary w-full py-3">
                {saving ? 'Salvando...' : 'Criar Pedido de Compra'}
              </button>
            </div>
          </div>
        </div>
      )}
      </>}

    </div>
  )
}
