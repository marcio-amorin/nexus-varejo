'use client'
import { useEffect, useState } from 'react'
import api from '@/lib/api'

type Agenda = {
  id?: number; fornecedor_id: number; fornecedor_nome: string; fornecedor_cnpj?: string
  frequencia_dias: number; proxima_visita: string | null; dias_restantes: number | null
  alerta_d2: boolean; dias_media_venda: number; dias_entrega: number; observacoes?: string
  percentual_reposicao: number; margem_seguranca_pct: number; reposicao_adicional: number
  dias_venda_filtro: number; gerar_automatico: boolean
}
type SugestaoItem = {
  produto_id: number; codigo: string; descricao: string; unidade: string
  estoque_atual: number; estoque_minimo: number; media_diaria: number
  dias_cobrir: number; qty_necessaria: number; qty_sugerida: number
  preco_custo: number; valor_total: number; principal: boolean
}
type Sugestao = { itens: SugestaoItem[]; total_itens: number; valor_total: number; dias_media: number; dias_cobrir: number }
type Forn = { id: number; razao_social: string; fantasia?: string }

const inp  = 'w-full rounded-lg px-2.5 py-1.5 text-xs outline-none'
const s    = { background:'var(--input)', border:'1px solid var(--border)', color:'var(--text)' }
const R    = (v: number) => v.toLocaleString('pt-BR', { style:'currency', currency:'BRL' })
const N    = (v: number, d=2) => v.toLocaleString('pt-BR', { minimumFractionDigits:d, maximumFractionDigits:d })

const FREQ_OPTS = [
  { label: 'Semanal (7 dias)',    dias: 7  },
  { label: 'Quinzenal (15 dias)', dias: 15 },
  { label: 'Mensal (30 dias)',    dias: 30 },
  { label: '2x semana (3 dias)',  dias: 3  },
  { label: '2x mês (14 dias)',    dias: 14 },
]

export default function AgendaComprasPage() {
  const [agendas, setAgendas]   = useState<Agenda[]>([])
  const [fornList, setFornList] = useState<Forn[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState({
    fornecedor_id: 0, frequencia_dias: 7, dias_media_venda: 15, dias_entrega: 2,
    observacoes: '', percentual_reposicao: 0, margem_seguranca_pct: 0,
    reposicao_adicional: 0, dias_venda_filtro: 0, gerar_automatico: true,
  })
  const [gerandoAuto, setGerandoAuto] = useState(false)
  const [sugestao, setSugestao] = useState<Sugestao | null>(null)
  const [sugestaoForn, setSugestaoForn] = useState<Agenda | null>(null)
  const [qtys, setQtys]         = useState<Record<number, number>>({})
  const [gerando, setGerando]   = useState(false)
  const [obs, setObs]           = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [ag, fn] = await Promise.all([api.get('/agenda-compras/'), api.get('/fornecedores/')])
      setAgendas(ag.data)
      setFornList(fn.data)
    } finally { setLoading(false) }
  }

  async function salvarAgenda() {
    if (!form.fornecedor_id) return
    const hoje = new Date()
    const proxima = new Date(hoje.getTime() + form.frequencia_dias * 86400000)
    const proxStr = proxima.toISOString().slice(0, 10)
    await api.post('/agenda-compras/', { ...form, proxima_visita: proxStr })
    setShowForm(false); load()
  }

  async function abrirSugestao(a: Agenda) {
    setSugestaoForn(a); setSugestao(null); setObs('')
    const r = await api.get(`/agenda-compras/${a.fornecedor_id}/sugestao`)
    const data: Sugestao = r.data
    setSugestao(data)
    const q: Record<number, number> = {}
    data.itens.forEach(i => { q[i.produto_id] = i.qty_sugerida })
    setQtys(q)
  }

  async function gerarPedido() {
    if (!sugestaoForn || !sugestao) return
    setGerando(true)
    try {
      const itens = sugestao.itens.map(i => ({
        ...i,
        qty_sugerida: qtys[i.produto_id] ?? i.qty_sugerida,
      })).filter(i => (qtys[i.produto_id] ?? i.qty_sugerida) > 0)
      const r = await api.post(`/agenda-compras/${sugestaoForn.fornecedor_id}/gerar-pedido`, { itens, observacoes: obs })
      alert(`Pedido ${r.data.numero} gerado com sucesso! Total: ${R(r.data.valor_total)}`)
      setSugestao(null); setSugestaoForn(null); load()
    } finally { setGerando(false) }
  }

  async function gerarTodosAuto() {
    setGerandoAuto(true)
    try {
      const r = await api.post('/agenda-compras/auto/gerar-todos')
      const gerados = r.data.gerados as any[]
      if (gerados.length === 0) {
        alert('Nenhum pedido automático necessário no momento (nenhum fornecedor com visita em ≤ 2 dias).')
      } else {
        const lista = gerados.map((g: any) => `• ${g.fornecedor_nome}: ${g.numero} — ${R(g.valor_total)}`).join('\n')
        alert(`${gerados.length} pedido(s) automático(s) gerado(s):\n\n${lista}`)
        load()
      }
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro ao gerar pedidos automáticos') }
    setGerandoAuto(false)
  }

  function whatsapp(a: Agenda) {
    const tel = fornList.find(f => f.id === a.fornecedor_id)
    const msg = encodeURIComponent(`Olá! Confirmo visita em ${a.proxima_visita}. Pedido de compra preparado.`)
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  const totalSugestao = sugestao ? sugestao.itens.reduce((s, i) => s + (qtys[i.produto_id] ?? i.qty_sugerida) * i.preco_custo, 0) : 0

  return (
    <div className="h-full overflow-auto p-3 space-y-3" style={{ background:'var(--bg)' }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-sm font-black" style={{ color:'var(--text)' }}>📅 AGENDA DE FORNECEDORES</h1>
          <p className="text-[10px]" style={{ color:'var(--muted)' }}>Visitas programadas · Pré-pedido automático D-2</p>
        </div>
        <div className="flex gap-2">
          <button onClick={gerarTodosAuto} disabled={gerandoAuto}
            className="px-3 py-1.5 rounded-lg text-[11px] font-black flex items-center gap-1"
            style={{ background:'rgba(249,115,22,0.15)', color:'#F97316', border:'1px solid rgba(249,115,22,0.35)' }}>
            ⚡ {gerandoAuto ? 'Gerando...' : 'Gerar Auto D-2'}
          </button>
          <button onClick={() => setShowForm(true)}
            className="px-3 py-1.5 rounded-lg text-[11px] font-black"
            style={{ background:'#F97316', color:'white' }}>
            + Agendar Fornecedor
          </button>
        </div>
      </div>

      {/* Cards */}
      {loading ? (
        <p className="text-center text-xs py-8" style={{ color:'var(--muted)' }}>Carregando...</p>
      ) : agendas.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
          <p className="text-2xl mb-2">📅</p>
          <p className="text-xs font-bold" style={{ color:'var(--muted)' }}>Nenhuma agenda configurada</p>
          <p className="text-[10px] mt-1" style={{ color:'var(--muted)' }}>Clique em "+ Agendar Fornecedor" para começar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {agendas.map(a => {
            const urgente = a.dias_restantes !== null && a.dias_restantes <= 0
            const alerta  = a.alerta_d2
            const cor     = urgente ? '#EF4444' : alerta ? '#F97316' : '#34C759'
            const bgCor   = urgente ? '#EF444422' : alerta ? '#F9731622' : '#34C75922'
            return (
              <div key={a.fornecedor_id} className="rounded-xl overflow-hidden"
                style={{ background:'var(--card)', border:`1px solid ${urgente ? '#EF4444' : alerta ? '#F97316' : 'var(--border)'}` }}>
                <div className="px-3 py-2 flex items-center justify-between" style={{ background:'var(--card2)' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black truncate" style={{ color:'var(--text)' }}>{a.fornecedor_nome}</p>
                    <p className="text-[9px]" style={{ color:'var(--muted)' }}>
                      A cada {a.frequencia_dias} dias · Entrega em {a.dias_entrega}d
                    </p>
                  </div>
                  {(urgente || alerta) && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0 ml-2"
                      style={{ background:bgCor, color:cor }}>
                      {urgente ? '⚠️ VISITA HOJE' : '🔔 D-2'}
                    </span>
                  )}
                </div>
                <div className="px-3 py-2 space-y-1.5">
                  <div className="flex justify-between text-[10px]">
                    <span style={{ color:'var(--muted)' }}>Próxima visita:</span>
                    <span className="font-bold" style={{ color: cor }}>
                      {a.proxima_visita
                        ? new Date(a.proxima_visita + 'T12:00:00').toLocaleDateString('pt-BR')
                        : 'Não definida'}
                      {a.dias_restantes !== null && ` (${a.dias_restantes > 0 ? `em ${a.dias_restantes}d` : 'hoje'})`}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span style={{ color:'var(--muted)' }}>Média de venda:</span>
                    <span style={{ color:'var(--text)' }}>últimos {a.dias_venda_filtro || a.dias_media_venda} dias</span>
                  </div>
                  {(a.margem_seguranca_pct > 0 || a.percentual_reposicao > 0 || a.reposicao_adicional > 0) && (
                    <div className="flex gap-2 flex-wrap">
                      {a.margem_seguranca_pct > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                          style={{ background:'rgba(139,92,246,0.15)', color:'#8B5CF6' }}>
                          🛡 {a.margem_seguranca_pct}% seg.
                        </span>
                      )}
                      {a.percentual_reposicao > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                          style={{ background:'rgba(59,130,246,0.15)', color:'#3B82F6' }}>
                          📈 +{a.percentual_reposicao}% repos.
                        </span>
                      )}
                      {a.reposicao_adicional > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                          style={{ background:'rgba(34,197,94,0.15)', color:'#22C55E' }}>
                          +{a.reposicao_adicional} un. extra
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex gap-1.5 mt-2">
                    <button onClick={() => abrirSugestao(a)}
                      className="flex-1 py-1.5 rounded-lg text-[10px] font-black"
                      style={{ background:'#F97316', color:'white' }}>
                      📋 Gerar Pré-Pedido
                    </button>
                    <button onClick={() => whatsapp(a)}
                      className="px-2 py-1.5 rounded-lg text-[10px] font-bold"
                      style={{ background:'#25D36622', color:'#25D366', border:'1px solid #25D36633' }}>
                      WhatsApp
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Form Agenda */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
            <div className="px-4 py-3 flex justify-between items-center" style={{ background:'var(--card2)', borderBottom:'1px solid var(--border)' }}>
              <h2 className="text-sm font-black" style={{ color:'var(--text)' }}>📅 Agendar Fornecedor</h2>
              <button onClick={() => setShowForm(false)} style={{ color:'var(--muted)' }}>✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>FORNECEDOR *</label>
                <select value={form.fornecedor_id} onChange={e => setForm(f => ({ ...f, fornecedor_id: +e.target.value }))}
                  className={inp} style={s}>
                  <option value={0}>Selecione...</option>
                  {fornList.map(f => (
                    <option key={f.id} value={f.id}>{f.fantasia || f.razao_social}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>FREQUÊNCIA DE VISITA</label>
                <select value={form.frequencia_dias} onChange={e => setForm(f => ({ ...f, frequencia_dias: +e.target.value }))}
                  className={inp} style={s}>
                  {FREQ_OPTS.map(o => <option key={o.dias} value={o.dias}>{o.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>PERÍODO MÉDIA (dias)</label>
                  <input type="number" value={form.dias_media_venda} onChange={e => setForm(f => ({ ...f, dias_media_venda: +e.target.value }))}
                    className={inp} style={s} min={1} max={90} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>PRAZO ENTREGA (dias)</label>
                  <input type="number" value={form.dias_entrega} onChange={e => setForm(f => ({ ...f, dias_entrega: +e.target.value }))}
                    className={inp} style={s} min={0} max={30} />
                </div>
              </div>
              {/* Parâmetros de Reposição */}
              <div className="rounded-xl p-3 space-y-2" style={{ background:'var(--card2)', border:'1px solid var(--border)' }}>
                <p className="text-[10px] font-black" style={{ color:'var(--muted)' }}>⚙️ PARÂMETROS DE REPOSIÇÃO (Máximos e Mínimos)</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] font-bold mb-0.5" style={{ color:'var(--muted)' }}>MARGEM DE SEGURANÇA (%)</label>
                    <input type="number" min={0} max={100} step={5} value={form.margem_seguranca_pct}
                      onChange={e => setForm(f => ({ ...f, margem_seguranca_pct: +e.target.value }))}
                      className={inp} style={s} placeholder="Ex: 15" />
                    <p className="text-[9px] mt-0.5" style={{ color:'var(--muted)' }}>Buffer extra de estoque</p>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold mb-0.5" style={{ color:'var(--muted)' }}>PERCENTUAL DE REPOSIÇÃO (%)</label>
                    <input type="number" min={0} max={200} step={5} value={form.percentual_reposicao}
                      onChange={e => setForm(f => ({ ...f, percentual_reposicao: +e.target.value }))}
                      className={inp} style={s} placeholder="Ex: 10" />
                    <p className="text-[9px] mt-0.5" style={{ color:'var(--muted)' }}>% sobre quantidade calculada</p>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold mb-0.5" style={{ color:'var(--muted)' }}>REPOSIÇÃO ADICIONAL (un.)</label>
                    <input type="number" min={0} step={1} value={form.reposicao_adicional}
                      onChange={e => setForm(f => ({ ...f, reposicao_adicional: +e.target.value }))}
                      className={inp} style={s} placeholder="Ex: 5" />
                    <p className="text-[9px] mt-0.5" style={{ color:'var(--muted)' }}>Unidades fixas extras</p>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold mb-0.5" style={{ color:'var(--muted)' }}>FILTRO DIAS VENDA (0=usa período)</label>
                    <input type="number" min={0} max={365} step={1} value={form.dias_venda_filtro}
                      onChange={e => setForm(f => ({ ...f, dias_venda_filtro: +e.target.value }))}
                      className={inp} style={s} placeholder="Ex: 90" />
                    <p className="text-[9px] mt-0.5" style={{ color:'var(--muted)' }}>Override do período de média</p>
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer mt-1">
                  <div onClick={() => setForm(f => ({ ...f, gerar_automatico: !f.gerar_automatico }))}
                    className="w-8 h-4 rounded-full relative"
                    style={{ background: form.gerar_automatico ? '#34C759' : 'var(--border)', flexShrink: 0 }}>
                    <div className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all"
                      style={{ left: form.gerar_automatico ? 18 : 2 }} />
                  </div>
                  <span className="text-[10px] font-bold" style={{ color:'var(--text)' }}>Participar da geração automática D-2</span>
                </label>
              </div>

              <div>
                <label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>OBSERVAÇÕES</label>
                <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                  className={inp} style={s} rows={2} />
              </div>
              <button disabled={!form.fornecedor_id} onClick={salvarAgenda}
                className="w-full py-2 rounded-xl text-xs font-black"
                style={{ background:'#F97316', color:'white', opacity: form.fornecedor_id ? 1 : 0.4 }}>
                Salvar Agenda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Sugestão */}
      {sugestaoForn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2" style={{ background:'rgba(0,0,0,0.8)' }}>
          <div className="w-full max-w-3xl max-h-[95vh] flex flex-col rounded-2xl overflow-hidden"
            style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
            <div className="px-4 py-3 flex justify-between items-center flex-shrink-0" style={{ background:'var(--card2)', borderBottom:'1px solid var(--border)' }}>
              <div>
                <h2 className="text-sm font-black" style={{ color:'var(--text)' }}>
                  📋 Pré-Pedido — {sugestaoForn.fornecedor_nome}
                </h2>
                {sugestao && (
                  <p className="text-[10px]" style={{ color:'var(--muted)' }}>
                    Média {sugestao.dias_media} dias · Cobrir {sugestao.dias_cobrir} dias ·
                    {sugestao.total_itens} produtos
                  </p>
                )}
              </div>
              <button onClick={() => { setSugestao(null); setSugestaoForn(null) }} style={{ color:'var(--muted)' }}>✕</button>
            </div>

            {!sugestao ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-xs" style={{ color:'var(--muted)' }}>Calculando sugestão...</p>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-[10px]">
                    <thead style={{ background:'var(--card2)', position:'sticky', top:0 }}>
                      <tr>
                        {['Código','Produto','Estoque','Média/dia','Necessário','Pedir','Custo','Total'].map(h => (
                          <th key={h} className="px-2 py-1.5 text-left font-bold" style={{ color:'var(--muted)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sugestao.itens.map((item, idx) => {
                        const qty = qtys[item.produto_id] ?? item.qty_sugerida
                        const total = qty * item.preco_custo
                        return (
                          <tr key={item.produto_id} style={{ borderTop:'1px solid var(--border)', background: idx%2===0 ? 'transparent' : 'var(--card2)' }}>
                            <td className="px-2 py-1" style={{ color:'var(--muted)' }}>{item.codigo}</td>
                            <td className="px-2 py-1 max-w-[180px]">
                              <p className="font-bold truncate" style={{ color:'var(--text)' }}>{item.descricao}</p>
                              <p style={{ color:'var(--muted)' }}>{item.unidade}</p>
                            </td>
                            <td className="px-2 py-1 text-right" style={{ color: item.estoque_atual <= item.estoque_minimo ? '#EF4444' : '#34C759' }}>
                              {N(item.estoque_atual, 0)}
                            </td>
                            <td className="px-2 py-1 text-right" style={{ color:'var(--muted)' }}>{N(item.media_diaria, 2)}</td>
                            <td className="px-2 py-1 text-right" style={{ color:'var(--text)' }}>{N(item.qty_necessaria, 0)}</td>
                            <td className="px-2 py-1">
                              <input type="number" min={0} value={qty}
                                onChange={e => setQtys(q => ({ ...q, [item.produto_id]: +e.target.value }))}
                                className="w-16 rounded px-1.5 py-0.5 text-center text-xs font-bold"
                                style={{ background:'var(--input)', border:'1px solid var(--border)', color:'var(--text)' }} />
                            </td>
                            <td className="px-2 py-1 text-right" style={{ color:'var(--muted)' }}>{R(item.preco_custo)}</td>
                            <td className="px-2 py-1 text-right font-bold" style={{ color:'var(--text)' }}>{R(total)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex-shrink-0 p-3 space-y-2" style={{ borderTop:'1px solid var(--border)', background:'var(--card2)' }}>
                  <div className="flex items-center gap-3">
                    <input value={obs} onChange={e => setObs(e.target.value)}
                      className={`flex-1 ${inp}`} style={s} placeholder="Observações do pedido..." />
                    <div className="text-right flex-shrink-0">
                      <p className="text-[9px]" style={{ color:'var(--muted)' }}>TOTAL ESTIMADO</p>
                      <p className="text-base font-black" style={{ color:'#F97316' }}>{R(totalSugestao)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => window.print()} className="px-3 py-1.5 rounded-lg text-[10px] font-bold"
                      style={{ background:'var(--card)', border:'1px solid var(--border)', color:'var(--text)' }}>
                      🖨️ Imprimir
                    </button>
                    <button disabled={gerando} onClick={gerarPedido}
                      className="flex-1 py-1.5 rounded-lg text-[10px] font-black"
                      style={{ background:'#F97316', color:'white', opacity: gerando ? 0.5 : 1 }}>
                      {gerando ? 'Gerando...' : '✅ Confirmar e Gerar Pedido'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
