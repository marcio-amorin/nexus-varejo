'use client'
import { useEffect, useState } from 'react'
import api, { fmtMoeda, fmtData } from '@/lib/api'
import {
  AlertTriangle, Search, Plus, X, Package,
  TrendingUp, BarChart2, Zap, ChevronUp, ChevronDown,
} from 'lucide-react'

type Aba = 'saldo' | 'movimentos' | 'alertas' | 'giro'

const TC: Record<string, { bg: string; color: string }> = {
  ENTRADA: { bg: '#22C55E22', color: '#22C55E' },
  SAIDA:   { bg: '#EF444422', color: '#EF4444' },
  AJUSTE:  { bg: '#F59E0B22', color: '#F59E0B' },
  PERDA:   { bg: '#A855F722', color: '#A855F7' },
}

export default function EstoquePage() {
  const [aba, setAba]           = useState<Aba>('saldo')
  const [produtos, setProdutos] = useState<any[]>([])
  const [movimentos, setMov]    = useState<any[]>([])
  const [alertas, setAlertas]   = useState<any[]>([])
  const [giro, setGiro]         = useState<any[]>([])
  const [stats, setStats]       = useState<any>(null)
  const [loading, setLoading]   = useState(true)
  const [busca, setBusca]       = useState('')
  const [showAjuste, setShowAjuste] = useState<any>(null)
  const [saving, setSaving]     = useState(false)
  const [ajuste, setAjuste]     = useState({ tipo: 'AJUSTE', quantidade: '', observacao: '' })
  const [giroSort, setGiroSort] = useState<'vendido' | 'giro' | 'dias'>('vendido')

  async function load() {
    setLoading(true)
    try {
      const [rp, rs, rm, ra, rg] = await Promise.all([
        api.get('/estoque/saldo'),
        api.get('/estoque/stats'),
        api.get('/estoque/movimentos', { params: { limit: 200 } }),
        api.get('/estoque/alertas'),
        api.get('/estoque/giro', { params: { dias: 30 } }),
      ])
      setProdutos(rp.data)
      setStats(rs.data)
      setMov(rm.data)
      setAlertas(ra.data)
      setGiro(rg.data)
    } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function salvarAjuste() {
    if (!ajuste.quantidade) return
    setSaving(true)
    try {
      await api.post('/estoque/ajuste', {
        produto_id: showAjuste.produto_id || showAjuste.id,
        tipo: ajuste.tipo,
        quantidade: Number(ajuste.quantidade),
        observacao: ajuste.observacao,
      })
      setShowAjuste(null)
      load()
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro') }
    setSaving(false)
  }

  const filtrados = busca
    ? produtos.filter(p =>
        p.descricao?.toLowerCase().includes(busca.toLowerCase()) ||
        p.codigo?.toLowerCase().includes(busca.toLowerCase()))
    : produtos

  const giroSorted = [...giro].sort((a, b) => {
    if (giroSort === 'vendido') return b.vendido_periodo - a.vendido_periodo
    if (giroSort === 'giro') return b.giro - a.giro
    return a.dias_cobertura - b.dias_cobertura
  })

  const inp = 'w-full px-2.5 py-2 text-xs rounded-lg outline-none'
  const inpStyle = { background: 'var(--input)', border: '1px solid var(--border)', color: 'white' }

  const ABAS: { key: Aba; label: string; badge?: number; badgeColor?: string }[] = [
    { key: 'saldo',      label: 'Posição' },
    { key: 'alertas',    label: 'Alertas', badge: alertas.length, badgeColor: alertas.some(a => a.nivel === 'ZERADO') ? '#ef4444' : '#f59e0b' },
    { key: 'movimentos', label: 'Movimentos' },
    { key: 'giro',       label: 'Giro 30d' },
  ]

  return (
    <div className="pg">
      {/* Header */}
      <div className="pg-header flex items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-base font-black text-white">Estoque</h1>
            {stats && (
              <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
                {stats.total_produtos} produtos · custo {fmtMoeda(stats.valor_custo)} · venda {fmtMoeda(stats.valor_venda)}
              </p>
            )}
          </div>
          {/* Tabs */}
          <div className="flex gap-1 ml-3">
            {ABAS.map(({ key, label, badge, badgeColor }) => (
              <button key={key} onClick={() => setAba(key)}
                className="relative px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors"
                style={{
                  background: aba === key ? '#f97316' : 'var(--card2)',
                  color: aba === key ? 'white' : 'var(--muted)',
                }}>
                {label}
                {badge !== undefined && badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black"
                    style={{ background: badgeColor || '#ef4444', color: 'white' }}>
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {stats && (
            <div className="flex gap-2">
              {[
                { l: 'Zerado', v: stats.produtos_zerados, c: '#ef4444' },
                { l: 'Baixo',  v: stats.produtos_estoque_baixo, c: '#f59e0b' },
              ].map(s => (
                <div key={s.l} className="px-3 py-1.5 rounded-lg text-center"
                  style={{ background: 'var(--card)', border: `1px solid ${s.c}30` }}>
                  <p className="text-sm font-black" style={{ color: s.c }}>{s.v}</p>
                  <p className="text-[9px]" style={{ color: 'var(--muted)' }}>{s.l}</p>
                </div>
              ))}
            </div>
          )}
          {aba === 'saldo' && (
            <div className="relative">
              <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
              <input value={busca} onChange={e => setBusca(e.target.value)}
                placeholder="Buscar produto..."
                className="pl-7 pr-3 py-1.5 text-xs rounded-lg w-44 outline-none"
                style={{ background: 'var(--card2)', border: '1px solid var(--border)', color: 'white' }} />
            </div>
          )}
        </div>
      </div>

      {/* Conteúdo */}
      <div className="pg-body">

        {/* ── Aba: Posição ────────────────────────────────────────────────── */}
        {aba === 'saldo' && (
          <table className="tbl">
            <thead>
              <tr>
                {['Código', 'Produto', 'Saldo', 'Mínimo', 'Custo', 'Val. Estoque', 'Status', ''].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-8" style={{ color: 'var(--muted)' }}>Carregando...</td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10" style={{ color: 'var(--muted)' }}>Nenhum produto</td></tr>
              ) : filtrados.map(p => {
                const sem   = p.estoque_atual <= 0
                const baixo = !sem && p.estoque_minimo > 0 && p.estoque_atual <= p.estoque_minimo
                const sc = sem   ? { bg: '#EF444422', c: '#EF4444', l: 'SEM ESTOQUE' }
                         : baixo ? { bg: '#F59E0B22', c: '#F59E0B', l: 'BAIXO' }
                         :         { bg: '#22C55E22', c: '#22C55E', l: 'OK' }
                return (
                  <tr key={p.produto_id || p.id}>
                    <td className="font-mono" style={{ color: '#f97316' }}>{p.codigo}</td>
                    <td>
                      <p className="font-semibold text-white">{p.descricao}</p>
                      <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{p.categoria || '—'}</p>
                    </td>
                    <td className="font-black" style={{ color: sem ? '#ef4444' : baixo ? '#f59e0b' : 'white' }}>
                      {p.estoque_atual} {p.unidade}
                    </td>
                    <td style={{ color: 'var(--muted)' }}>{p.estoque_minimo}</td>
                    <td style={{ color: 'var(--muted)' }}>{fmtMoeda(p.preco_custo)}</td>
                    <td className="font-semibold" style={{ color: '#ea580c' }}>
                      {fmtMoeda((p.estoque_atual || 0) * (p.preco_custo || 0))}
                    </td>
                    <td>
                      <span className="badge" style={{ background: sc.bg, color: sc.c }}>
                        {baixo && <AlertTriangle size={8} />} {sc.l}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => { setShowAjuste(p); setAjuste({ tipo: 'AJUSTE', quantidade: '', observacao: '' }) }}
                        className="w-6 h-6 rounded flex items-center justify-center"
                        style={{ background: '#f97316' + '22', color: '#f97316' }}>
                        <Plus size={11} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {/* ── Aba: Alertas ────────────────────────────────────────────────── */}
        {aba === 'alertas' && (
          <div className="space-y-2 p-1">
            {loading ? (
              <div className="text-center py-12" style={{ color: 'var(--muted)' }}>Carregando...</div>
            ) : alertas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: '#22c55e20' }}>
                  <Package size={28} color="#22c55e" />
                </div>
                <p className="font-bold text-white">Estoque em ordem!</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>Nenhum produto zerado ou abaixo do mínimo.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="p-3 rounded-xl" style={{ background: '#ef444415', border: '1px solid #ef444430' }}>
                    <p className="text-2xl font-black" style={{ color: '#ef4444' }}>
                      {alertas.filter(a => a.nivel === 'ZERADO').length}
                    </p>
                    <p className="text-xs font-bold" style={{ color: '#ef4444' }}>Produtos ZERADOS — Ruptura!</p>
                    <p className="text-[10px]" style={{ color: 'var(--muted)' }}>Necessitam reposição imediata</p>
                  </div>
                  <div className="p-3 rounded-xl" style={{ background: '#f59e0b15', border: '1px solid #f59e0b30' }}>
                    <p className="text-2xl font-black" style={{ color: '#f59e0b' }}>
                      {alertas.filter(a => a.nivel === 'BAIXO').length}
                    </p>
                    <p className="text-xs font-bold" style={{ color: '#f59e0b' }}>Produtos ABAIXO do mínimo</p>
                    <p className="text-[10px]" style={{ color: 'var(--muted)' }}>Programar reposição em breve</p>
                  </div>
                </div>
                <table className="tbl">
                  <thead>
                    <tr>
                      {['Produto', 'Saldo Atual', 'Estoque Mínimo', 'Cobertura', 'Nível', ''].map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {alertas.map(p => (
                      <tr key={p.produto_id}>
                        <td>
                          <p className="font-semibold text-white">{p.descricao}</p>
                          <p className="text-[10px]" style={{ color: '#f97316' }}>{p.codigo} · {p.categoria}</p>
                        </td>
                        <td className="font-black" style={{ color: p.nivel === 'ZERADO' ? '#ef4444' : '#f59e0b' }}>
                          {p.estoque_atual} {p.unidade}
                        </td>
                        <td style={{ color: 'var(--muted)' }}>{p.estoque_minimo} {p.unidade}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--border)', minWidth: 60 }}>
                              <div className="h-full rounded-full"
                                style={{
                                  width: `${Math.min(p.cobertura_pct, 100)}%`,
                                  background: p.nivel === 'ZERADO' ? '#ef4444' : '#f59e0b',
                                }} />
                            </div>
                            <span className="text-[10px] font-bold w-10 text-right"
                              style={{ color: p.nivel === 'ZERADO' ? '#ef4444' : '#f59e0b' }}>
                              {p.cobertura_pct}%
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="badge font-black"
                            style={{
                              background: p.nivel === 'ZERADO' ? '#ef444422' : '#f59e0b22',
                              color: p.nivel === 'ZERADO' ? '#ef4444' : '#f59e0b',
                            }}>
                            {p.nivel === 'ZERADO' ? '🚫 ZERADO' : '⚠️ BAIXO'}
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => { setShowAjuste(p); setAjuste({ tipo: 'ENTRADA', quantidade: '', observacao: '' }) }}
                            className="w-7 h-7 rounded-lg flex items-center justify-center"
                            style={{ background: '#22c55e22', color: '#22c55e' }}>
                            <Plus size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}

        {/* ── Aba: Movimentos ─────────────────────────────────────────────── */}
        {aba === 'movimentos' && (
          <table className="tbl">
            <thead>
              <tr>
                {['Data', 'Produto', 'Tipo', 'Qtde', 'Custo Unit.', 'Valor', 'Origem'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--muted)' }}>Carregando...</td></tr>
              ) : movimentos.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10" style={{ color: 'var(--muted)' }}>Sem movimentações</td></tr>
              ) : movimentos.map((m: any) => {
                const tc = TC[m.tipo] || TC.AJUSTE
                return (
                  <tr key={m.id}>
                    <td style={{ color: 'var(--muted)' }}>{fmtData(m.data)}</td>
                    <td>
                      <p className="font-semibold text-white">{m.produto_descricao || m.produto_nome}</p>
                    </td>
                    <td>
                      <span className="badge" style={{ background: tc.bg, color: tc.color }}>{m.tipo}</span>
                    </td>
                    <td className="font-bold" style={{ color: tc.color }}>
                      {m.tipo === 'SAIDA' ? '-' : '+'}{Math.abs(m.quantidade)}
                    </td>
                    <td style={{ color: 'var(--muted)' }}>
                      {m.custo_unitario ? fmtMoeda(m.custo_unitario) : '—'}
                    </td>
                    <td style={{ color: '#f97316' }}>
                      {m.valor_total ? fmtMoeda(m.valor_total) : '—'}
                    </td>
                    <td style={{ color: 'var(--muted)' }}>
                      {m.origem?.replace('_', ' ')}
                      {m.documento_ref && (
                        <span className="block font-mono text-[10px]" style={{ color: '#f97316' }}>
                          {m.documento_ref}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {/* ── Aba: Giro ───────────────────────────────────────────────────── */}
        {aba === 'giro' && (
          <div>
            <div className="flex items-center gap-2 mb-3 px-1">
              <BarChart2 size={13} color="#f59e0b" />
              <p className="text-xs font-bold text-white">Giro de Estoque — Últimos 30 dias</p>
              <div className="ml-auto flex gap-1">
                {[
                  { key: 'vendido', label: 'Mais vendido' },
                  { key: 'giro',    label: 'Maior giro' },
                  { key: 'dias',    label: 'Menor cobertura' },
                ].map(({ key, label }) => (
                  <button key={key} onClick={() => setGiroSort(key as any)}
                    className="px-2 py-1 rounded-lg text-[10px] font-bold"
                    style={{
                      background: giroSort === key ? '#f97316' : 'var(--card2)',
                      color: giroSort === key ? 'white' : 'var(--muted)',
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  {['#', 'Produto', 'Estoque', 'Vendido 30d', 'Média/dia', 'Giro', 'Cobertura', 'Val. Estoque'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-8" style={{ color: 'var(--muted)' }}>Carregando...</td></tr>
                ) : giroSorted.filter(g => g.vendido_periodo > 0 || g.estoque_atual > 0).slice(0, 100).map((g, i) => {
                  const diasCor = g.dias_cobertura <= 3 ? '#ef4444'
                                : g.dias_cobertura <= 7 ? '#f59e0b'
                                : '#22c55e'
                  return (
                    <tr key={g.produto_id}>
                      <td className="text-center font-bold" style={{ color: 'var(--muted)' }}>{i + 1}</td>
                      <td>
                        <p className="font-semibold text-white">{g.descricao}</p>
                        <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{g.categoria}</p>
                      </td>
                      <td className="font-bold text-white">{g.estoque_atual} {g.unidade}</td>
                      <td>
                        <span className="font-bold" style={{ color: g.vendido_periodo > 0 ? '#22c55e' : 'var(--muted)' }}>
                          {g.vendido_periodo} {g.unidade}
                        </span>
                      </td>
                      <td style={{ color: 'var(--muted)' }}>{g.media_diaria.toFixed(2)}/d</td>
                      <td>
                        <span className="font-black" style={{ color: g.giro >= 1 ? '#22c55e' : g.giro >= 0.5 ? '#f59e0b' : '#ef4444' }}>
                          {g.giro.toFixed(2)}×
                        </span>
                      </td>
                      <td>
                        <span className="font-bold text-xs px-2 py-0.5 rounded-full"
                          style={{ background: diasCor + '22', color: diasCor }}>
                          {g.dias_cobertura >= 999 ? '∞' : `${g.dias_cobertura}d`}
                        </span>
                      </td>
                      <td style={{ color: '#ea580c' }}>{fmtMoeda(g.valor_estoque)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Ajuste */}
      {showAjuste && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="w-full max-w-xs rounded-2xl p-5 space-y-3" style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between">
              <p className="font-black text-white">Ajuste de Estoque</p>
              <button onClick={() => setShowAjuste(null)} style={{ color: 'var(--muted)' }}>
                <X size={16} />
              </button>
            </div>
            <div className="p-2.5 rounded-xl" style={{ background: 'var(--card2)' }}>
              <p className="font-semibold text-white text-xs">{showAjuste.descricao}</p>
              <p className="text-[10px]" style={{ color: '#f97316' }}>
                Saldo: {showAjuste.estoque_atual} {showAjuste.unidade}
              </p>
            </div>
            <select value={ajuste.tipo} onChange={e => setAjuste(a => ({ ...a, tipo: e.target.value }))}
              className={inp} style={inpStyle}>
              <option value="AJUSTE">Ajuste (quantidade exata)</option>
              <option value="ENTRADA">Entrada (adiciona)</option>
              <option value="SAIDA">Saída (subtrai)</option>
              <option value="PERDA">Perda / Quebra</option>
            </select>
            <input type="number" step="0.001" value={ajuste.quantidade}
              onChange={e => setAjuste(a => ({ ...a, quantidade: e.target.value }))}
              placeholder={ajuste.tipo === 'AJUSTE' ? 'Nova quantidade' : 'Quantidade'}
              className={inp} style={inpStyle} />
            <input value={ajuste.observacao} onChange={e => setAjuste(a => ({ ...a, observacao: e.target.value }))}
              placeholder="Observação" className={inp} style={inpStyle} />
            <button onClick={salvarAjuste} disabled={saving || !ajuste.quantidade}
              className="btn-primary w-full py-2.5 text-sm">
              {saving ? 'Salvando...' : 'Confirmar Ajuste'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
