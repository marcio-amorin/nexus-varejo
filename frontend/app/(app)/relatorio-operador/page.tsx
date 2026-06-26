'use client'
import { useEffect, useState } from 'react'
import api, { fmtMoeda, fmtData } from '@/lib/api'
import { BarChart2, User, TrendingUp, ShoppingCart, Tag, RefreshCw } from 'lucide-react'

const hoje = new Date().toISOString().slice(0, 10)
const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

const FORMAS: Record<string, string> = {
  DINHEIRO: 'Dinheiro', CREDITO: 'Crédito', DEBITO: 'Débito',
  PIX: 'PIX', BOLETO: 'Boleto', CHEQUE: 'Cheque',
  CREDITO_DEVOLUCAO: 'Crédito Dev.', CONVENIO: 'Convênio',
}

const CORES = ['#f97316','#3b82f6','#22c55e','#a855f7','#f59e0b','#06b6d4','#ef4444','#84cc16']

export default function RelatorioOperadorPage() {
  const [dataIni, setDataIni]   = useState(hoje)
  const [dataFim, setDataFim]   = useState(hoje)
  const [dados, setDados]       = useState<any>(null)
  const [loading, setLoading]   = useState(false)
  const [opSel, setOpSel]       = useState<string | null>(null)

  async function carregar(ini = dataIni, fim = dataFim) {
    setLoading(true)
    try {
      const r = await api.get('/relatorios/vendas-por-operador', { params: { data_ini: ini, data_fim: fim } })
      setDados(r.data)
      setOpSel(null)
    } catch { setDados(null) }
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  function atalho(label: string, ini: string, fim: string) {
    setDataIni(ini); setDataFim(fim); carregar(ini, fim)
  }

  const operadores: any[] = dados?.operadores || []
  const opAtual = opSel ? operadores.find(o => o.operador === opSel) : null
  const vendasExibidas: any[] = opAtual
    ? opAtual.vendas
    : operadores.flatMap((o: any) => o.vendas.map((v: any) => ({ ...v, _op: o.operador })))

  return (
    <div className="pg">
      {/* ── HEADER ── */}
      <div className="pg-header flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-base font-black text-white flex items-center gap-2">
            <BarChart2 size={16} color="#f97316" /> Vendas por Operador
          </h1>
          {dados && (
            <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
              {dados.total_vendas} vendas · Total: <span style={{ color: '#f97316' }}>{fmtMoeda(dados.total_geral)}</span>
            </p>
          )}
        </div>

        {/* Atalhos de período */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { l: 'Hoje',    ini: hoje,       fim: hoje       },
            { l: 'Ontem',   ini: ontem(),    fim: ontem()    },
            { l: 'Semana',  ini: semana(),   fim: hoje       },
            { l: 'Mês',     ini: inicioMes,  fim: hoje       },
          ].map(a => (
            <button key={a.l} onClick={() => atalho(a.l, a.ini, a.fim)}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold"
              style={{
                background: dataIni === a.ini && dataFim === a.fim ? '#f97316' : 'var(--card2)',
                color:      dataIni === a.ini && dataFim === a.fim ? 'white'   : 'var(--muted)',
              }}>
              {a.l}
            </button>
          ))}
          <input type="date" value={dataIni} onChange={e => setDataIni(e.target.value)}
            className="text-xs px-2 py-1 rounded-lg"
            style={{ background: 'var(--input)', border: '1px solid var(--border)', color: 'white' }} />
          <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
            className="text-xs px-2 py-1 rounded-lg"
            style={{ background: 'var(--input)', border: '1px solid var(--border)', color: 'white' }} />
          <button onClick={() => carregar()} disabled={loading}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: '#f97316', color: 'white' }}>
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      </div>

      <div className="pg-body space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-16" style={{ color: 'var(--muted)' }}>
            <RefreshCw size={20} className="animate-spin mr-2" /> Carregando...
          </div>
        )}

        {!loading && dados && (
          <>
            {/* ── CARDS POR OPERADOR ── */}
            {operadores.length === 0 ? (
              <div className="text-center py-12" style={{ color: 'var(--muted)' }}>
                Nenhuma venda encontrada no período
              </div>
            ) : (
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                {operadores.map((op: any, idx: number) => {
                  const cor = CORES[idx % CORES.length]
                  const pct = dados.total_geral > 0 ? (op.total_vendido / dados.total_geral * 100) : 0
                  const sel = opSel === op.operador
                  return (
                    <button key={op.operador}
                      onClick={() => setOpSel(sel ? null : op.operador)}
                      className="rounded-2xl p-4 text-left transition-all"
                      style={{
                        background: sel ? cor + '22' : 'var(--card)',
                        border: `2px solid ${sel ? cor : 'var(--border)'}`,
                        boxShadow: sel ? `0 4px 16px ${cor}33` : 'none',
                      }}>
                      {/* Avatar + nome */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-base flex-shrink-0"
                          style={{ background: cor + '22', color: cor }}>
                          {op.operador[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-white text-sm truncate">{op.operador}</p>
                          <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{op.qtd_vendas} vendas</p>
                        </div>
                      </div>

                      {/* Valor */}
                      <p className="font-black text-xl mb-1" style={{ color: cor, fontFamily: 'monospace' }}>
                        {fmtMoeda(op.total_vendido)}
                      </p>

                      {/* Barra de participação */}
                      <div className="h-1.5 rounded-full mb-2" style={{ background: 'var(--card2)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cor }} />
                      </div>

                      {/* Stats menores */}
                      <div className="grid grid-cols-3 gap-1 mt-2">
                        {[
                          { l: 'Ticket',   v: fmtMoeda(op.ticket_medio) },
                          { l: 'Itens',    v: String(op.total_itens) },
                          { l: 'Part. %',  v: `${pct.toFixed(1)}%` },
                        ].map(s => (
                          <div key={s.l} className="text-center">
                            <p className="text-[11px] font-black text-white">{s.v}</p>
                            <p className="text-[9px]" style={{ color: 'var(--muted)' }}>{s.l}</p>
                          </div>
                        ))}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* ── TABELA DE VENDAS ── */}
            {vendasExibidas.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-black" style={{ color: 'var(--muted)' }}>
                    {opSel ? `VENDAS DE ${opSel.toUpperCase()}` : 'TODAS AS VENDAS'}
                    {' '}({vendasExibidas.length})
                  </p>
                  {opSel && (
                    <button onClick={() => setOpSel(null)}
                      className="text-[10px] px-2 py-1 rounded-lg font-bold"
                      style={{ background: 'var(--card2)', color: 'var(--muted)' }}>
                      Ver todos
                    </button>
                  )}
                </div>
                <table className="tbl">
                  <thead><tr>
                    {['Nº', 'Data', 'Hora', 'Operador', 'Cliente', 'Itens', 'Desconto', 'Forma', 'Total'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {vendasExibidas.slice(0, 200).map((v: any, idx: number) => {
                      const op = opAtual || operadores.find(o => o.operador === v._op)
                      const cor = CORES[(operadores.findIndex((o: any) => o.operador === (v._op || opSel)) || 0) % CORES.length]
                      return (
                        <tr key={`${v.id}-${idx}`}>
                          <td className="font-mono text-xs font-bold" style={{ color: cor }}>{v.numero}</td>
                          <td style={{ color: 'var(--muted)' }}>{fmtData(v.data)}</td>
                          <td className="font-mono text-xs" style={{ color: 'var(--muted)' }}>{v.hora || '—'}</td>
                          <td>
                            <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                              style={{ background: cor + '22', color: cor }}>
                              {v._op || opSel}
                            </span>
                          </td>
                          <td className="max-w-[140px] truncate text-xs text-white">{v.cliente}</td>
                          <td className="text-center" style={{ color: 'var(--muted)' }}>{v.itens}</td>
                          <td className="text-right" style={{ color: v.desconto > 0 ? '#ef4444' : 'var(--muted)' }}>
                            {v.desconto > 0 ? `-${fmtMoeda(v.desconto)}` : '—'}
                          </td>
                          <td className="text-xs" style={{ color: 'var(--muted)' }}>
                            {FORMAS[v.forma_pagamento] || v.forma_pagamento}
                          </td>
                          <td className="font-black text-right" style={{ color: '#f97316' }}>
                            {fmtMoeda(v.total)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {vendasExibidas.length > 200 && (
                  <p className="text-center text-xs py-2" style={{ color: 'var(--muted)' }}>
                    Exibindo 200 de {vendasExibidas.length} registros
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function ontem() {
  const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10)
}
function semana() {
  const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10)
}
