'use client'
import { useEffect, useState, useRef } from 'react'
import api from '@/lib/api'
import { Plus, Save, CheckCircle, X, RefreshCw, Printer, Search } from 'lucide-react'

type Inv = {
  id: number; numero: string; descricao: string; tipo: string
  status: string; data_inicio: string; data_fim: string | null
  criado_por: string; total_itens: number; divergencias: number
}
type Item = {
  id: number; produto_id: number; produto_codigo: string
  produto_descricao: string; produto_unidade: string
  estoque_sistema: number; estoque_contado: number | null
  diferenca: number; div_custo: number; div_preco: number
  ajustado: boolean; validar: boolean; recontar: boolean; manter: boolean
}

export default function InventarioPage() {
  const [lista,    setLista]    = useState<Inv[]>([])
  const [aberto,   setAberto]   = useState<(Inv & { itens: Item[] }) | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [criando,  setCriando]  = useState(false)
  const [contagens, setCont]    = useState<Record<number, string>>({})
  const [busca,    setBusca]    = useState('')
  const [showNovo, setShowNovo] = useState(false)
  const [novoDesc, setNovoDesc] = useState('')
  const [novoTipo, setNovoTipo] = useState<'TOTAL'|'PARCIAL'>('TOTAL')
  const buscaRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    try { const r = await api.get('/inventario/'); setLista(r.data) }
    catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function criar() {
    setCriando(true)
    try {
      const r = await api.post('/inventario/', { descricao: novoDesc || undefined, tipo: novoTipo })
      const inv = r.data
      const c: Record<number, string> = {}
      inv.itens?.forEach((i: Item) => { c[i.produto_id] = i.estoque_contado != null ? String(i.estoque_contado) : '' })
      setCont(c); setAberto(inv); setShowNovo(false); setNovoDesc('')
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro') }
    setCriando(false)
  }

  async function abrir(id: number) {
    setLoading(true)
    try {
      const r = await api.get(`/inventario/${id}`)
      const c: Record<number, string> = {}
      r.data.itens?.forEach((i: Item) => { c[i.produto_id] = i.estoque_contado != null ? String(i.estoque_contado) : '' })
      setCont(c); setAberto(r.data)
    } catch {}
    setLoading(false)
  }

  async function salvar() {
    if (!aberto) return
    setSalvando(true)
    const itens = Object.entries(contagens)
      .filter(([, v]) => v !== '')
      .map(([k, v]) => ({ produto_id: Number(k), estoque_contado: Number(v) }))
    try {
      await api.post(`/inventario/${aberto.id}/contar`, { itens })
      const r = await api.get(`/inventario/${aberto.id}`)
      const c: Record<number, string> = {}
      r.data.itens?.forEach((i: Item) => { c[i.produto_id] = i.estoque_contado != null ? String(i.estoque_contado) : '' })
      setCont(c); setAberto(r.data)
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro') }
    setSalvando(false)
  }

  async function finalizar() {
    if (!aberto) return
    if (!confirm(`Finalizar ${aberto.numero}? Isso ajustará o estoque de todos os itens contados (exceto marcados como Manter).`)) return
    setSalvando(true)
    try {
      await api.post(`/inventario/${aberto.id}/finalizar`)
      setAberto(null); load()
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro') }
    setSalvando(false)
  }

  async function cancelar() {
    if (!aberto || !confirm('Cancelar inventário?')) return
    try { await api.delete(`/inventario/${aberto.id}`); setAberto(null); load() }
    catch (e: any) { alert(e.response?.data?.detail || 'Erro') }
  }

  async function toggleFlag(item: Item, flag: 'validar' | 'recontar' | 'manter') {
    if (!aberto) return
    const body = { [flag]: !item[flag] }
    try {
      const r = await api.patch(`/inventario/${aberto.id}/item/${item.id}`, body)
      setAberto(a => a ? { ...a, itens: a.itens.map(i => i.id === item.id ? r.data : i) } : a)
    } catch {}
  }

  const fmtNum = (v: number | null, dec = 3) =>
    v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })

  const fmtMoeda = (v: number) =>
    v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const fmtData = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

  const itensFiltrados = (aberto?.itens || []).filter(i => {
    if (!busca.trim()) return true
    const q = busca.toLowerCase()
    return i.produto_descricao?.toLowerCase().includes(q) || i.produto_codigo?.toLowerCase().includes(q)
  })

  const totalDivCusto = (aberto?.itens || []).reduce((s, i) => s + (i.div_custo || 0), 0)
  const totalDivPreco = (aberto?.itens || []).reduce((s, i) => s + (i.div_preco || 0), 0)
  const nContados     = (aberto?.itens || []).filter(i => i.estoque_contado != null).length
  const nDiverg       = (aberto?.itens || []).filter(i => i.estoque_contado != null && i.diferenca !== 0).length

  // ── Tela de lista de inventários ──────────────────────────────────────────
  if (!aberto) return (
    <div className="h-full flex flex-col" style={{ background: '#1a1f2e', color: '#e2e8f0' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
        style={{ background: '#141824', borderBottom: '2px solid #2d3548' }}>
        <div>
          <h1 className="text-lg font-black" style={{ color: '#f59e0b', letterSpacing: 1 }}>INVENTÁRIO DE ESTOQUE</h1>
          <p className="text-xs" style={{ color: '#64748b' }}>Contagem física e ajuste de estoque</p>
        </div>
        <button onClick={() => setShowNovo(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black"
          style={{ background: '#1d4ed8', color: '#fff' }}>
          <Plus size={14} /> Novo Inventário
        </button>
      </div>

      {/* Tabela de lotes */}
      <div className="flex-1 overflow-auto p-4">
        <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#1e2a3d', color: '#93c5fd' }}>
              {['Número', 'Descrição', 'Tipo', 'Data Geração', 'Itens', 'Divergências', 'Status', ''].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-black"
                  style={{ borderBottom: '2px solid #2d3548', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-10 text-sm" style={{ color: '#64748b' }}>Carregando...</td></tr>
            ) : lista.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-10 text-sm" style={{ color: '#64748b' }}>Nenhum inventário encontrado</td></tr>
            ) : lista.map((inv, ri) => {
              const statusCor: Record<string, string> = { ABERTO: '#f59e0b', FINALIZADO: '#22c55e', CANCELADO: '#ef4444' }
              const cor = statusCor[inv.status] || '#64748b'
              return (
                <tr key={inv.id}
                  style={{ background: ri % 2 === 0 ? '#1a1f2e' : '#1e2435', borderBottom: '1px solid #2d3548' }}
                  className="hover:brightness-110">
                  <td className="px-3 py-2.5 font-mono font-black" style={{ color: '#f59e0b' }}>{inv.numero}</td>
                  <td className="px-3 py-2.5 font-semibold">{inv.descricao || '—'}</td>
                  <td className="px-3 py-2.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black"
                      style={{ background: inv.tipo === 'PARCIAL' ? '#7c3aed22' : '#1d4ed822',
                               color:      inv.tipo === 'PARCIAL' ? '#a78bfa'   : '#93c5fd' }}>
                      {inv.tipo}
                    </span>
                  </td>
                  <td className="px-3 py-2.5" style={{ color: '#94a3b8' }}>{fmtData(inv.data_inicio)}</td>
                  <td className="px-3 py-2.5 font-bold text-center">{inv.total_itens}</td>
                  <td className="px-3 py-2.5 font-black text-center"
                    style={{ color: inv.divergencias > 0 ? '#f97316' : '#64748b' }}>
                    {inv.divergencias}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black" style={{ color: cor, background: cor + '22' }}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => abrir(inv.id)}
                      className="px-3 py-1 rounded text-xs font-bold"
                      style={{ background: '#1d4ed822', color: '#60a5fa' }}>
                      {inv.status === 'ABERTO' ? 'Contar' : 'Visualizar'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal novo inventário */}
      {showNovo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: '#1e2435', border: '1px solid #2d3548' }}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ background: '#141824', borderBottom: '1px solid #2d3548' }}>
              <p className="font-black text-white">Novo Inventário</p>
              <button onClick={() => setShowNovo(false)} style={{ color: '#64748b' }}><X size={18} /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="text-xs font-bold mb-1 block" style={{ color: '#94a3b8' }}>DESCRIÇÃO</label>
                <input value={novoDesc} onChange={e => setNovoDesc(e.target.value)} autoFocus
                  placeholder="Ex: INVENT GERAL 24/06/2026"
                  className="w-full px-3 py-2.5 rounded-xl text-sm text-white"
                  style={{ background: '#0f172a', border: '1px solid #2d3548', outline: 'none' }} />
              </div>
              <div>
                <label className="text-xs font-bold mb-1 block" style={{ color: '#94a3b8' }}>TIPO</label>
                <div className="flex gap-2">
                  {(['TOTAL', 'PARCIAL'] as const).map(t => (
                    <button key={t} onClick={() => setNovoTipo(t)}
                      className="flex-1 py-2 rounded-xl text-sm font-black"
                      style={{
                        background: novoTipo === t ? '#1d4ed8' : '#0f172a',
                        color: novoTipo === t ? '#fff' : '#64748b',
                        border: `1px solid ${novoTipo === t ? '#2563eb' : '#2d3548'}`,
                      }}>{t}</button>
                  ))}
                </div>
              </div>
              <button onClick={criar} disabled={criando}
                className="w-full py-3 rounded-xl font-black text-white text-sm mt-2"
                style={{ background: '#1d4ed8' }}>
                {criando ? 'Criando...' : 'Criar e Iniciar Contagem'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // ── Tela de contagem (estilo CONSINCO) ─────────────────────────────────────
  const isAberto = aberto.status === 'ABERTO'

  return (
    <div className="h-full flex flex-col" style={{ background: '#1a1f2e', color: '#e2e8f0', userSelect: 'none' }}>

      {/* ── Top toolbar ── */}
      <div className="flex items-center gap-2 px-4 py-2 flex-shrink-0"
        style={{ background: '#141824', borderBottom: '2px solid #2d3548' }}>
        <button onClick={() => setAberto(null)} className="px-3 py-1.5 rounded text-xs font-bold"
          style={{ background: '#1e2a3d', color: '#93c5fd' }}>
          ← Lotes
        </button>
        {isAberto && (
          <>
            <button onClick={salvar} disabled={salvando}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-black"
              style={{ background: '#1d4ed8', color: '#fff' }}>
              <Save size={12} /> {salvando ? 'Salvando...' : 'Salvar'}
            </button>
            <button onClick={finalizar} disabled={salvando}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-black"
              style={{ background: '#15803d', color: '#fff' }}>
              <CheckCircle size={12} /> Finalizar e Ajustar
            </button>
            <button onClick={cancelar}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-black"
              style={{ background: '#7f1d1d', color: '#fca5a5' }}>
              <X size={12} /> Cancelar
            </button>
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#64748b' }} />
            <input ref={buscaRef} value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar produto..."
              className="pl-7 pr-3 py-1.5 rounded text-xs text-white"
              style={{ background: '#0f172a', border: '1px solid #2d3548', outline: 'none', width: 200 }} />
          </div>
        </div>
      </div>

      {/* ── Header do lote ── */}
      <div className="flex items-center gap-6 px-5 py-2 flex-shrink-0 text-xs"
        style={{ background: '#1e2435', borderBottom: '1px solid #2d3548' }}>
        <div className="flex items-center gap-2">
          <span style={{ color: '#64748b' }}>Lote</span>
          <span className="font-black" style={{ color: '#f59e0b', fontFamily: 'monospace', fontSize: 13 }}>{aberto.numero}</span>
        </div>
        <div className="flex-1 font-bold" style={{ color: '#e2e8f0' }}>{aberto.descricao}</div>
        <div className="flex items-center gap-2">
          <span style={{ color: '#64748b' }}>Dta Geração</span>
          <span className="font-bold" style={{ color: '#93c5fd' }}>{fmtData(aberto.data_inicio)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ color: '#64748b' }}>Tipo</span>
          <span className="font-black px-2 py-0.5 rounded"
            style={{ background: aberto.tipo === 'PARCIAL' ? '#7c3aed22' : '#1d4ed822',
                     color:      aberto.tipo === 'PARCIAL' ? '#a78bfa'   : '#93c5fd' }}>
            {aberto.tipo}
          </span>
        </div>
        <div className="flex items-center gap-4 ml-4">
          <span style={{ color: '#64748b' }}>Itens: <strong style={{ color: '#e2e8f0' }}>{aberto.total_itens}</strong></span>
          <span style={{ color: '#64748b' }}>Contados: <strong style={{ color: '#22c55e' }}>{nContados}</strong></span>
          <span style={{ color: '#64748b' }}>Divergências: <strong style={{ color: nDiverg > 0 ? '#f97316' : '#64748b' }}>{nDiverg}</strong></span>
          <span style={{ color: '#64748b' }}>Status: <strong style={{ color: aberto.status === 'ABERTO' ? '#f59e0b' : '#22c55e' }}>{aberto.status}</strong></span>
        </div>
      </div>

      {/* ── Tabela de itens ── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr style={{ background: '#1e2a3d', color: '#93c5fd' }}>
              <th className="px-2 py-2 text-center font-black" style={{ borderBottom: '2px solid #2d3548', width: 60 }}>Validar</th>
              <th className="px-2 py-2 text-center font-black" style={{ borderBottom: '2px solid #2d3548', width: 62 }}>Recontar</th>
              <th className="px-2 py-2 text-center font-black" style={{ borderBottom: '2px solid #2d3548', width: 54 }}>Manter</th>
              <th className="px-2 py-2 text-left font-black"   style={{ borderBottom: '2px solid #2d3548', width: 80 }}>Cod.Interno</th>
              <th className="px-2 py-2 text-left font-black"   style={{ borderBottom: '2px solid #2d3548' }}>Descrição</th>
              <th className="px-2 py-2 text-center font-black" style={{ borderBottom: '2px solid #2d3548', width: 55 }}>Emb.Venda</th>
              <th className="px-2 py-2 text-right font-black"  style={{ borderBottom: '2px solid #2d3548', width: 90 }}>Qtde.Congelada</th>
              <th className="px-2 py-2 text-right font-black"  style={{ borderBottom: '2px solid #2d3548', width: 90 }}>Qtde.Contada</th>
              <th className="px-2 py-2 text-right font-black"  style={{ borderBottom: '2px solid #2d3548', width: 90 }}>Qtde.Diverg.</th>
              <th className="px-2 py-2 text-right font-black"  style={{ borderBottom: '2px solid #2d3548', width: 100 }}>Diverg.Custo</th>
              <th className="px-2 py-2 text-right font-black"  style={{ borderBottom: '2px solid #2d3548', width: 90 }}>Div.Preço</th>
            </tr>
          </thead>
          <tbody>
            {itensFiltrados.map((item, ri) => {
              const contVal  = contagens[item.produto_id]
              const contNum  = contVal !== '' && contVal !== undefined ? Number(contVal) : item.estoque_contado
              const dif      = contNum != null ? contNum - item.estoque_sistema : null
              const corDif   = dif == null ? '#64748b' : dif > 0 ? '#22c55e' : dif < 0 ? '#ef4444' : '#64748b'
              const isDiverg = dif != null && dif !== 0
              const rowBg    = item.validar ? '#1a2d1a' : item.recontar ? '#2d1a1a' : ri % 2 === 0 ? '#1a1f2e' : '#1c2236'

              return (
                <tr key={item.id} style={{ background: rowBg, borderBottom: '1px solid #232a3d' }}
                  className="hover:brightness-110">
                  {/* Validar */}
                  <td className="px-2 py-1.5 text-center">
                    <input type="checkbox" checked={item.validar}
                      onChange={() => isAberto && toggleFlag(item, 'validar')}
                      disabled={!isAberto}
                      className="w-3.5 h-3.5 cursor-pointer accent-green-500" />
                  </td>
                  {/* Recontar */}
                  <td className="px-2 py-1.5 text-center">
                    <input type="checkbox" checked={item.recontar}
                      onChange={() => isAberto && toggleFlag(item, 'recontar')}
                      disabled={!isAberto}
                      className="w-3.5 h-3.5 cursor-pointer accent-yellow-500" />
                  </td>
                  {/* Manter */}
                  <td className="px-2 py-1.5 text-center">
                    <input type="checkbox" checked={item.manter}
                      onChange={() => isAberto && toggleFlag(item, 'manter')}
                      disabled={!isAberto}
                      className="w-3.5 h-3.5 cursor-pointer accent-blue-500" />
                  </td>
                  {/* Código */}
                  <td className="px-2 py-1.5 font-mono" style={{ color: '#94a3b8' }}>{item.produto_codigo}</td>
                  {/* Descrição */}
                  <td className="px-2 py-1.5 font-semibold" style={{ color: '#e2e8f0' }}>{item.produto_descricao}</td>
                  {/* Unidade */}
                  <td className="px-2 py-1.5 text-center font-bold" style={{ color: '#93c5fd' }}>
                    {item.produto_unidade} 1
                  </td>
                  {/* Qtde Congelada */}
                  <td className="px-2 py-1.5 text-right font-bold" style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>
                    {fmtNum(item.estoque_sistema)}
                  </td>
                  {/* Qtde Contada */}
                  <td className="px-2 py-1.5 text-right">
                    {isAberto ? (
                      <input type="number" step="0.001" min="0"
                        value={contagens[item.produto_id] ?? ''}
                        onChange={e => setCont(c => ({ ...c, [item.produto_id]: e.target.value }))}
                        className="w-20 px-1.5 py-1 rounded text-right text-xs font-bold"
                        style={{ background: '#0f172a', border: '1px solid #2d3548', color: '#f59e0b',
                                 outline: 'none', fontFamily: 'monospace' }}
                        placeholder="0,000" />
                    ) : (
                      <span className="font-bold font-mono" style={{ color: '#f59e0b' }}>
                        {fmtNum(item.estoque_contado)}
                      </span>
                    )}
                  </td>
                  {/* Divergência qtd */}
                  <td className="px-2 py-1.5 text-right font-black font-mono" style={{ color: corDif }}>
                    {dif != null ? (isDiverg ? (dif > 0 ? '+' : '') + fmtNum(dif) : fmtNum(dif)) : '—'}
                  </td>
                  {/* Divergência custo */}
                  <td className="px-2 py-1.5 text-right font-bold font-mono"
                    style={{ color: isDiverg ? (item.div_custo < 0 ? '#ef4444' : '#22c55e') : '#64748b' }}>
                    {dif != null ? fmtMoeda(dif * (item.div_custo / (item.diferenca || 1) || 0)) : '—'}
                  </td>
                  {/* Divergência preço */}
                  <td className="px-2 py-1.5 text-right font-bold font-mono"
                    style={{ color: isDiverg ? (item.div_preco < 0 ? '#ef4444' : '#22c55e') : '#64748b' }}>
                    {dif != null ? fmtMoeda(dif * (item.div_preco / (item.diferenca || 1) || 0)) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
          {/* Totais */}
          <tfoot>
            <tr style={{ background: '#1e2a3d', borderTop: '2px solid #2d3548' }}>
              <td colSpan={9} className="px-4 py-2 font-black text-right text-xs" style={{ color: '#93c5fd' }}>
                TOTAIS ({itensFiltrados.length} itens)
              </td>
              <td className="px-2 py-2 text-right font-black text-xs font-mono"
                style={{ color: totalDivCusto < 0 ? '#ef4444' : totalDivCusto > 0 ? '#22c55e' : '#64748b' }}>
                {fmtMoeda(totalDivCusto)}
              </td>
              <td className="px-2 py-2 text-right font-black text-xs font-mono"
                style={{ color: totalDivPreco < 0 ? '#ef4444' : totalDivPreco > 0 ? '#22c55e' : '#64748b' }}>
                {fmtMoeda(totalDivPreco)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
