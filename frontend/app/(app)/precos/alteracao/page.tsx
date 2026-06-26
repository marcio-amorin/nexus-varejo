'use client'
import { useEffect, useState } from 'react'
import api, { fmtMoeda } from '@/lib/api'
import {
  Search, Save, RefreshCw, FileText, CheckSquare, Square,
  Calendar, Clock, Trash2, Play, ChevronRight
} from 'lucide-react'

// ─── Aba 1: Alteração Manual ─────────────────────────────────────────────────

type Prod = {
  id: number; codigo: string; descricao: string; unidade: string
  preco_custo: number; preco_venda: number; margem: number
  estoque_atual?: number; atacarejo?: boolean
  atacarejo_qtd_min?: number; atacarejo_preco?: number
}

function AbaManual() {
  const [lista, setLista]       = useState<Prod[]>([])
  const [editados, setEditados] = useState<Record<number, { preco: string; margem: string; atk?: string }>>({})
  const [busca, setBusca]       = useState('')
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [modoAjuste, setModo]   = useState<'manual' | 'pct' | 'valor'>('manual')
  const [ajusteVal, setAjuste]  = useState('')
  const [saved, setSaved]       = useState(false)

  async function load() {
    setLoading(true)
    const r = await api.get('/precos/produtos', { params: { busca } })
    setLista(r.data); setEditados({}); setLoading(false)
  }
  useEffect(() => { load() }, [])

  function getPreco(p: Prod) { return editados[p.id]?.preco ?? String(p.preco_venda) }
  function getMargem(p: Prod) { return editados[p.id]?.margem ?? String(p.margem) }
  function setPreco(p: Prod, val: string) {
    const n = parseFloat(val) || 0
    const m = p.preco_custo > 0 && n > 0 ? ((n - p.preco_custo) / n * 100).toFixed(2) : (editados[p.id]?.margem ?? String(p.margem))
    setEditados(e => ({ ...e, [p.id]: { preco: val, margem: m } }))
  }
  function setMargem2(p: Prod, val: string) {
    const m = parseFloat(val) || 0
    const pr = p.preco_custo > 0 && m < 100 ? (p.preco_custo / (1 - m / 100)).toFixed(2) : (editados[p.id]?.preco ?? String(p.preco_venda))
    setEditados(e => ({ ...e, [p.id]: { preco: pr, margem: val } }))
  }
  function aplicarAjuste() {
    const val = parseFloat(ajusteVal); if (!val) return
    const novos: typeof editados = {}
    lista.forEach(p => {
      let preco = p.preco_venda
      if (modoAjuste === 'pct')   preco = p.preco_venda * (1 + val / 100)
      if (modoAjuste === 'valor') preco = p.preco_venda + val
      preco = Math.max(preco, 0)
      const margem = p.preco_custo > 0 && preco > 0 ? ((preco - p.preco_custo) / preco * 100).toFixed(2) : String(p.margem)
      novos[p.id] = { preco: preco.toFixed(2), margem }
    })
    setEditados(novos)
  }
  async function salvar() {
    const itens = Object.entries(editados).filter(([, v]) => v.preco !== '').map(([id, v]) => ({
      produto_id: Number(id), preco_venda: parseFloat(v.preco), margem: parseFloat(v.margem) || undefined,
      atacarejo_preco: v.atk !== undefined && v.atk !== '' ? parseFloat(v.atk) : undefined,
    }))
    if (!itens.length) return
    setSaving(true)
    try {
      await api.post('/precos/alteracao-lote', { itens })
      setSaved(true); setTimeout(() => setSaved(false), 3000); load()
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro') }
    setSaving(false)
  }
  const alteradosCount = Object.keys(editados).length
  const listaBusca = lista.filter(p => !busca || p.descricao.toLowerCase().includes(busca.toLowerCase()) || p.codigo.includes(busca))

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 flex gap-2 flex-wrap items-center flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="relative flex-1 min-w-40">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar produto..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl"
            style={{ background: 'var(--card2)', color: 'white', border: '1px solid var(--border)' }} />
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--card2)' }}>
          {([['manual','Manual'],['pct','% Markup'],['valor','+ / − R$']] as [string,string][]).map(([k,l]) => (
            <button key={k} onClick={() => setModo(k as any)} className="px-2 py-1 rounded-lg text-[10px] font-bold transition-all"
              style={{ background: modoAjuste === k ? '#F97316' : 'transparent', color: modoAjuste === k ? 'white' : 'var(--muted)' }}>
              {l}
            </button>
          ))}
        </div>
        {modoAjuste !== 'manual' && (
          <div className="flex items-center gap-1">
            <input type="number" step="0.1" value={ajusteVal} onChange={e => setAjuste(e.target.value)}
              placeholder={modoAjuste === 'pct' ? '% ex: 10' : 'R$ ex: 5'}
              className="w-24 px-2 py-1.5 text-xs rounded-xl"
              style={{ background: 'var(--card2)', color: 'white', border: '1px solid var(--border)' }} />
            <button onClick={aplicarAjuste} className="px-3 py-1.5 rounded-xl text-[10px] font-bold"
              style={{ background: '#F97316', color: 'white' }}>Aplicar a todos</button>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          {saved && <span className="text-[11px] font-bold px-2 py-1 rounded-lg" style={{ background: '#34C75922', color: '#34C759' }}>✓ Salvo!</span>}
          <button onClick={load} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--card2)', color: 'var(--muted)' }}>
            <RefreshCw size={12} />
          </button>
          <button onClick={salvar} disabled={saving || !alteradosCount} className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3">
            <Save size={12} /> {saving ? 'Salvando...' : `Salvar (${alteradosCount})`}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="tbl">
          <thead>
            <tr>{['Código','Produto','Un','Estoque','Custo','Varejo Atual','Margem %','Novo Preço','Nova Margem %','🏪 ATK'].map(h => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={10} className="text-center py-8" style={{ color: 'var(--muted)' }}>Carregando...</td></tr>
            : listaBusca.map(p => {
              const alt = !!editados[p.id]
              const np  = parseFloat(getPreco(p)) || p.preco_venda
              const vp  = ((np - p.preco_venda) / p.preco_venda * 100)
              const atk = editados[p.id]?.atk ?? (p.atacarejo_preco ? String(p.atacarejo_preco) : '')
              return (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }} className={alt ? 'bg-orange-500/5' : 'hover:bg-white/5'}>
                  <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--muted)' }}>{p.codigo}</td>
                  <td className="px-3 py-2 font-semibold text-white text-xs">{p.descricao}</td>
                  <td className="px-3 py-2 text-center text-xs" style={{ color: 'var(--muted)' }}>{p.unidade}</td>
                  <td className="px-3 py-2 text-center text-xs font-bold" style={{ color: (p.estoque_atual ?? 0) <= 0 ? '#EF4444' : '#22C55E' }}>{p.estoque_atual ?? 0}</td>
                  <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--muted)' }}>{fmtMoeda(p.preco_custo)}</td>
                  <td className="px-3 py-2 font-bold text-xs" style={{ color: '#F59E0B' }}>{fmtMoeda(p.preco_venda)}</td>
                  <td className="px-3 py-2 text-center text-xs" style={{ color: p.margem >= 20 ? '#34C759' : '#FF9F0A' }}>{p.margem.toFixed(1)}%</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <input type="number" step="0.01" min="0" value={getPreco(p)} onChange={e => setPreco(p, e.target.value)}
                        className="w-24 px-2 py-1 rounded-lg text-xs font-bold text-right"
                        style={{ background: alt ? 'rgba(249,115,22,0.12)' : 'var(--card2)', color: alt ? '#F97316' : 'white', border: `1px solid ${alt ? '#F97316' : 'var(--border)'}` }} />
                      {alt && vp !== 0 && <span className="text-[9px] font-black" style={{ color: vp > 0 ? '#34C759' : '#FF3B30' }}>{vp > 0 ? '+' : ''}{vp.toFixed(1)}%</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" step="0.1" min="0" max="99" value={getMargem(p)} onChange={e => setMargem2(p, e.target.value)}
                      className="w-20 px-2 py-1 rounded-lg text-xs font-bold text-right"
                      style={{ background: alt ? 'rgba(249,115,22,0.12)' : 'var(--card2)', color: alt ? '#F97316' : 'white', border: `1px solid ${alt ? '#F97316' : 'var(--border)'}` }} />
                  </td>
                  <td className="px-3 py-2">
                    {p.atacarejo ? (
                      <input type="number" step="0.01" min="0" value={atk} placeholder="R$ ATK"
                        onChange={e => setEditados(ed => ({ ...ed, [p.id]: { ...(ed[p.id] || { preco: String(p.preco_venda), margem: String(p.margem) }), atk: e.target.value }}))}
                        className="w-24 px-2 py-1 rounded-lg text-xs font-bold text-right"
                        style={{ background: atk ? '#FF9F0A12' : 'var(--card2)', color: '#FF9F0A', border: '1px solid #FF9F0A44' }} />
                    ) : <span className="text-[10px]" style={{ color: 'var(--border)' }}>—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}


// ─── Aba 2: Por NF ─────────────────────────────────────────────────────────--

type NFItem = {
  produto_id: number; codigo: string; descricao: string; unidade: string; ncm: string
  custo_atual: number; custo_nf: number; custo_variacao: number
  preco_atual: number; margem_atual: number
  icms_saida: number; pis_saida: number; cofins_saida: number; simples_pct: number; regime: string
  margem_sugerida: number; preco_sugerido: number; preco_variacao: number
  nf_quantidade: number
}

function AbaPorNF() {
  const [nfs, setNfs]               = useState<any[]>([])
  const [nfSel, setNfSel]           = useState<any>(null)
  const [itens, setItens]           = useState<NFItem[]>([])
  const [regime, setRegime]         = useState('')
  const [loading, setLoading]       = useState(false)
  const [loadingNF, setLoadingNF]   = useState(false)
  const [selecionados, setSel]       = useState<Set<number>>(new Set())
  const [margens, setMargens]       = useState<Record<number, string>>({})
  const [applying, setApplying]     = useState(false)
  const [subTab, setSubTab]         = useState<'nf' | 'agenda'>('nf')
  const [agenda, setAgenda]         = useState<any[]>([])
  const [executando, setExec]       = useState(false)
  const [busca, setBusca]           = useState('')

  useEffect(() => { loadNFs(); loadAgenda() }, [])

  async function loadNFs() {
    setLoading(true)
    try { const r = await api.get('/precos-nf/nfs'); setNfs(r.data) } catch {}
    setLoading(false)
  }
  async function loadAgenda() {
    try { const r = await api.get('/precos-nf/agenda'); setAgenda(r.data) } catch {}
  }
  async function selecionarNF(nf: any) {
    setNfSel(nf); setLoadingNF(true); setSel(new Set()); setMargens({})
    try {
      const r = await api.get(`/precos-nf/nf/${nf.id}/preview`)
      setItens(r.data.itens)
      setRegime(r.data.regime)
      setSel(new Set(r.data.itens.map((i: NFItem) => i.produto_id)))
    } catch { alert('Erro ao carregar NF') }
    setLoadingNF(false)
  }

  function getMargem(i: NFItem) { return margens[i.produto_id] ?? String(i.margem_sugerida) }
  function getPrecoSugerido(i: NFItem) {
    const m   = parseFloat(getMargem(i)) || i.margem_sugerida
    const div = 1 - (i.icms_saida + i.pis_saida + i.cofins_saida + i.simples_pct + m) / 100
    if (div <= 0) return i.custo_nf * (1 + m / 100)
    return Math.round((i.custo_nf / div) * 100) / 100
  }
  function toggleSel(id: number) {
    setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleTodos() {
    setSel(s => s.size === itens.length ? new Set() : new Set(itens.map(i => i.produto_id)))
  }

  function buildPayload() {
    return itens.filter(i => selecionados.has(i.produto_id)).map(i => ({
      produto_id:      i.produto_id,
      custo_novo:      i.custo_nf,
      preco_novo:      getPrecoSugerido(i),
      margem_aplicada: parseFloat(getMargem(i)) || i.margem_sugerida,
    }))
  }

  async function aplicarAgora() {
    const itensPayload = buildPayload()
    if (!itensPayload.length) return
    if (!confirm(`Aplicar preço de ${itensPayload.length} produto(s) agora?`)) return
    setApplying(true)
    try {
      const r = await api.post('/precos-nf/aplicar', { nf_id: nfSel?.id, itens: itensPayload })
      alert(`✅ ${r.data.produtos_atualizados} produto(s) atualizado(s) com sucesso!`)
      selecionarNF(nfSel)
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro') }
    setApplying(false)
  }

  async function agendarAmanha() {
    const itensPayload = buildPayload()
    if (!itensPayload.length) return
    const amanha = new Date(); amanha.setDate(amanha.getDate() + 1)
    const dataStr = amanha.toISOString().split('T')[0]
    if (!confirm(`Agendar ${itensPayload.length} produto(s) para ${amanha.toLocaleDateString('pt-BR')}?`)) return
    setApplying(true)
    try {
      const r = await api.post('/precos-nf/agendar', { nf_id: nfSel?.id, itens: itensPayload, data_aplicacao: dataStr })
      alert(`📅 ${r.data.agendados} produto(s) agendado(s) para ${amanha.toLocaleDateString('pt-BR')}`)
      loadAgenda()
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro') }
    setApplying(false)
  }

  async function executarAgenda() {
    if (!confirm('Executar TODAS as alterações com data de aplicação até hoje?')) return
    setExec(true)
    try {
      const r = await api.post('/precos-nf/executar-agenda')
      alert(`✅ ${r.data.aplicados} produto(s) atualizado(s) pela agenda!`)
      loadAgenda()
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro') }
    setExec(false)
  }
  async function cancelarAgenda(id: number) {
    await api.delete(`/precos-nf/agenda/${id}`)
    loadAgenda()
  }

  const itensFiltrados = itens.filter(i =>
    !busca || i.descricao.toLowerCase().includes(busca.toLowerCase()) || i.codigo.includes(busca))

  const pendentesHoje = agenda.filter(a => a.vencido && a.status === 'PENDENTE').length

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tabs */}
      <div className="flex gap-1 px-4 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => setSubTab('nf')}
          className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
          style={{ background: subTab === 'nf' ? '#F9731622' : 'transparent', color: subTab === 'nf' ? '#F97316' : 'var(--muted)', border: subTab === 'nf' ? '1px solid #F9731644' : '1px solid transparent' }}>
          <FileText size={11} className="inline mr-1" />Por Nota Fiscal
        </button>
        <button onClick={() => setSubTab('agenda')}
          className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all relative"
          style={{ background: subTab === 'agenda' ? '#8B5CF622' : 'transparent', color: subTab === 'agenda' ? '#8B5CF6' : 'var(--muted)', border: subTab === 'agenda' ? '1px solid #8B5CF644' : '1px solid transparent' }}>
          <Calendar size={11} className="inline mr-1" />Agenda Pendente
          {agenda.filter(a => a.status === 'PENDENTE').length > 0 && (
            <span className="ml-1.5 text-[9px] font-black px-1 py-0.5 rounded-full" style={{ background: '#8B5CF6', color: 'white' }}>
              {agenda.filter(a => a.status === 'PENDENTE').length}
            </span>
          )}
        </button>
      </div>

      {/* ── Sub-tab NF ── */}
      {subTab === 'nf' && (
        <div className="flex flex-1 min-h-0">
          {/* Lista NFs */}
          <div className="w-64 flex-shrink-0 flex flex-col" style={{ borderRight: '1px solid var(--border)' }}>
            <div className="px-3 py-2 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="text-[10px] font-black" style={{ color: 'var(--muted)' }}>NFS RECEBIDAS</span>
              <button onClick={loadNFs} className="w-5 h-5 flex items-center justify-center rounded" style={{ color: 'var(--muted)' }}>
                <RefreshCw size={10} />
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              {loading ? (
                <p className="text-center py-6 text-xs" style={{ color: 'var(--muted)' }}>Carregando...</p>
              ) : nfs.length === 0 ? (
                <p className="text-center py-6 text-xs" style={{ color: 'var(--muted)' }}>Nenhuma NF recebida</p>
              ) : nfs.map(nf => (
                <button key={nf.id} onClick={() => selecionarNF(nf)}
                  className="w-full text-left px-3 py-2.5 flex items-start gap-2 hover:bg-white/5 transition-all"
                  style={{
                    background: nfSel?.id === nf.id ? '#F9731610' : 'transparent',
                    borderLeft: nfSel?.id === nf.id ? '2px solid #F97316' : '2px solid transparent',
                    borderBottom: '1px solid var(--border)'
                  }}>
                  <FileText size={13} style={{ color: '#F97316', flexShrink: 0, marginTop: 1 }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">NF {nf.numero}/{nf.serie}</p>
                    <p className="text-[10px] truncate" style={{ color: 'var(--muted)' }}>{nf.fornecedor}</p>
                    <div className="flex justify-between mt-0.5">
                      <span className="text-[9px]" style={{ color: 'var(--muted)' }}>{new Date(nf.data_entrada + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                      <span className="text-[9px] font-bold" style={{ color: '#F97316' }}>{nf.qtd_itens} itens</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Painel de itens */}
          <div className="flex-1 flex flex-col min-w-0">
            {!nfSel ? (
              <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--muted)' }}>
                <div className="text-center space-y-2">
                  <FileText size={36} className="mx-auto opacity-20" />
                  <p className="text-sm">Selecione uma NF para ver os preços sugeridos</p>
                </div>
              </div>
            ) : loadingNF ? (
              <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--muted)' }}>
                <p className="text-sm">Calculando preços...</p>
              </div>
            ) : (
              <>
                {/* Header painel */}
                <div className="px-4 py-2 flex-shrink-0 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="flex-1">
                    <p className="text-xs font-black text-white">NF {nfSel.numero}/{nfSel.serie} — {nfSel.fornecedor}</p>
                    <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
                      {selecionados.size} de {itens.length} produto(s) selecionado(s) · Regime: <strong style={{ color: '#F59E0B' }}>{regime}</strong>
                    </p>
                  </div>
                  <div className="relative">
                    <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
                    <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Filtrar..."
                      className="pl-8 pr-3 py-1.5 text-xs rounded-xl w-36"
                      style={{ background: 'var(--card2)', color: 'white', border: '1px solid var(--border)' }} />
                  </div>
                  <button onClick={() => aplicarAgora()} disabled={applying || !selecionados.size}
                    className="flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-xl font-bold"
                    style={{ background: '#34C75922', color: '#34C759', border: '1px solid #34C75944', opacity: (applying || !selecionados.size) ? 0.4 : 1 }}>
                    <Play size={11} /> Aplicar Agora
                  </button>
                  <button onClick={() => agendarAmanha()} disabled={applying || !selecionados.size}
                    className="flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-xl font-bold"
                    style={{ background: '#8B5CF622', color: '#8B5CF6', border: '1px solid #8B5CF644', opacity: (applying || !selecionados.size) ? 0.4 : 1 }}>
                    <Clock size={11} /> Aplicar Amanhã
                  </button>
                </div>

                {/* Tabela de itens */}
                <div className="flex-1 overflow-auto">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th className="px-3 py-2 w-8">
                          <button onClick={toggleTodos}>
                            {selecionados.size === itens.length
                              ? <CheckSquare size={13} style={{ color: '#F97316' }} />
                              : <Square size={13} style={{ color: 'var(--muted)' }} />}
                          </button>
                        </th>
                        {['Produto','Qtd NF','Custo Atual','Custo NF','Δ Custo','Impostos Saída','Margem %','Preço Atual','Preço Sugerido','Δ Preço'].map(h => <th key={h}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {itensFiltrados.map(i => {
                        const sel    = selecionados.has(i.produto_id)
                        const pvSug  = getPrecoSugerido(i)
                        const dvPv   = ((pvSug - i.preco_atual) / Math.max(i.preco_atual, 0.01) * 100)
                        const impTot = i.icms_saida + i.pis_saida + i.cofins_saida + i.simples_pct
                        return (
                          <tr key={i.produto_id}
                            style={{ borderBottom: '1px solid var(--border)', opacity: sel ? 1 : 0.4 }}
                            className={sel ? 'hover:bg-white/5' : ''}>
                            <td className="px-3 py-2">
                              <button onClick={() => toggleSel(i.produto_id)}>
                                {sel ? <CheckSquare size={13} style={{ color: '#F97316' }} /> : <Square size={13} style={{ color: 'var(--muted)' }} />}
                              </button>
                            </td>
                            <td className="px-3 py-2">
                              <p className="text-xs font-bold text-white">{i.descricao}</p>
                              <p className="text-[9px]" style={{ color: 'var(--muted)' }}>{i.codigo} · {i.unidade} {i.ncm && `· NCM ${i.ncm}`}</p>
                            </td>
                            <td className="px-3 py-2 text-center text-xs font-bold" style={{ color: '#32ADE6' }}>{i.nf_quantidade}</td>
                            <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--muted)' }}>{fmtMoeda(i.custo_atual)}</td>
                            <td className="px-3 py-2 font-mono text-xs font-bold" style={{ color: '#F97316' }}>{fmtMoeda(i.custo_nf)}</td>
                            <td className="px-3 py-2 text-center">
                              <span className="text-[10px] font-black" style={{ color: i.custo_variacao > 0 ? '#EF4444' : i.custo_variacao < 0 ? '#34C759' : 'var(--muted)' }}>
                                {i.custo_variacao > 0 ? '+' : ''}{i.custo_variacao.toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <div className="text-[9px] space-y-0.5" style={{ color: 'var(--muted)' }}>
                                {i.regime === 'SIMPLES_NACIONAL'
                                  ? <p><span style={{ color: '#F59E0B' }}>DAS {i.simples_pct}%</span></p>
                                  : <>
                                    {i.icms_saida > 0 && <p>ICMS {i.icms_saida}%</p>}
                                    {i.pis_saida  > 0 && <p>PIS {i.pis_saida}%</p>}
                                    {i.cofins_saida > 0 && <p>COF {i.cofins_saida}%</p>}
                                  </>}
                                <p className="font-bold" style={{ color: '#F59E0B' }}>= {impTot.toFixed(2)}%</p>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" step="0.1" min="0" max="99"
                                value={getMargem(i)}
                                onChange={e => setMargens(m => ({ ...m, [i.produto_id]: e.target.value }))}
                                className="w-16 px-2 py-1 rounded-lg text-xs font-bold text-right"
                                style={{ background: 'var(--card2)', color: '#32ADE6', border: '1px solid #32ADE644' }} />
                              <span className="text-[9px] ml-0.5" style={{ color: 'var(--muted)' }}>%</span>
                            </td>
                            <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--muted)' }}>{fmtMoeda(i.preco_atual)}</td>
                            <td className="px-3 py-2 font-mono text-xs font-bold" style={{ color: '#34C759' }}>{fmtMoeda(pvSug)}</td>
                            <td className="px-3 py-2 text-center">
                              <span className="text-[10px] font-black" style={{ color: dvPv > 0 ? '#34C759' : dvPv < 0 ? '#EF4444' : 'var(--muted)' }}>
                                {dvPv > 0 ? '+' : ''}{dvPv.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Sub-tab Agenda ── */}
      {subTab === 'agenda' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-4 py-2 flex items-center gap-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="text-xs font-bold text-white">Alterações Agendadas</span>
            {pendentesHoje > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-black"
                style={{ background: '#EF444422', color: '#EF4444' }}>
                {pendentesHoje} vencida(s) hoje
              </span>
            )}
            <div className="ml-auto flex gap-2">
              <button onClick={loadAgenda} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--card2)', color: 'var(--muted)' }}>
                <RefreshCw size={12} />
              </button>
              {pendentesHoje > 0 && (
                <button onClick={executarAgenda} disabled={executando}
                  className="flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-xl font-bold"
                  style={{ background: '#34C75922', color: '#34C759', border: '1px solid #34C75944' }}>
                  <Play size={11} /> {executando ? 'Executando...' : `Executar ${pendentesHoje} vencida(s)`}
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            {agenda.length === 0 ? (
              <div className="flex items-center justify-center h-40" style={{ color: 'var(--muted)' }}>
                <p className="text-sm">Nenhuma alteração agendada</p>
              </div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>{['Produto','Código','Custo Atual → Novo','Preço Atual → Novo','Margem','Data Aplicação','Status',''].map(h => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {agenda.map(a => {
                    const cor = a.status === 'APLICADA' ? '#34C759' : a.vencido ? '#EF4444' : '#8B5CF6'
                    return (
                      <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }} className="hover:bg-white/5">
                        <td className="px-3 py-2 text-xs font-bold text-white">{a.produto}</td>
                        <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--muted)' }}>{a.codigo}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1 text-xs">
                            <span style={{ color: 'var(--muted)' }}>{fmtMoeda(a.custo_atual)}</span>
                            <ChevronRight size={10} style={{ color: 'var(--muted)' }} />
                            <span className="font-bold" style={{ color: '#F97316' }}>{fmtMoeda(a.custo_novo)}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1 text-xs">
                            <span style={{ color: 'var(--muted)' }}>{fmtMoeda(a.preco_atual)}</span>
                            <ChevronRight size={10} style={{ color: 'var(--muted)' }} />
                            <span className="font-bold" style={{ color: '#34C759' }}>{fmtMoeda(a.preco_novo)}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center text-xs font-bold" style={{ color: '#32ADE6' }}>{a.margem_aplicada.toFixed(1)}%</td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Calendar size={10} style={{ color: a.vencido && a.status === 'PENDENTE' ? '#EF4444' : 'var(--muted)' }} />
                            <span className="text-xs font-bold" style={{ color: a.vencido && a.status === 'PENDENTE' ? '#EF4444' : 'var(--muted)' }}>
                              {new Date(a.data_aplicacao + 'T12:00:00').toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                            style={{ background: cor + '22', color: cor }}>
                            {a.status === 'PENDENTE' && a.vencido ? 'VENCIDA' : a.status}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {a.status === 'PENDENTE' && (
                            <button onClick={() => cancelarAgenda(a.id)}
                              className="w-6 h-6 rounded flex items-center justify-center"
                              style={{ background: '#EF444422', color: '#EF4444' }}>
                              <Trash2 size={10} />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


// ─── Página principal ─────────────────────────────────────────────────────────

export default function AlteracaoPrecoPage() {
  const [aba, setAba] = useState<'manual' | 'nf'>('nf')

  return (
    <div className="pg">
      <div className="pg-header">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-base font-black text-white">Alteração de Preços</h1>
            <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
              Atualização manual ou automática via Nota Fiscal de Entrada com formação de preço inteligente
            </p>
          </div>
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--card2)' }}>
            <button onClick={() => setAba('nf')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{ background: aba === 'nf' ? '#F9731622' : 'transparent', color: aba === 'nf' ? '#F97316' : 'var(--muted)', border: aba === 'nf' ? '1px solid #F9731644' : '1px solid transparent' }}>
              <FileText size={11} /> Por Nota Fiscal
            </button>
            <button onClick={() => setAba('manual')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{ background: aba === 'manual' ? '#32ADE622' : 'transparent', color: aba === 'manual' ? '#32ADE6' : 'var(--muted)', border: aba === 'manual' ? '1px solid #32ADE644' : '1px solid transparent' }}>
              <Search size={11} /> Manual
            </button>
          </div>
        </div>
      </div>

      <div className="pg-body p-0">
        {aba === 'nf'     ? <AbaPorNF />   : null}
        {aba === 'manual' ? <AbaManual /> : null}
      </div>
    </div>
  )
}
