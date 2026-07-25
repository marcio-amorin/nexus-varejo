'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import {
  RefreshCw, ChevronRight, Package, CheckCircle2, AlertTriangle,
  Scan, EyeOff, Search, CalendarDays, Truck, XCircle, ArrowLeft,
} from 'lucide-react'

type NFPendente = {
  id: number; numero: string; serie?: string; fornecedor: string
  data_entrada: string; valor_total: number; status_conf: string; total_itens: number
}
type ItemCego = {
  id: number; produto_id: number; descricao: string; codigo: string
  codigo_barras?: string; unidade: string; controla_validade: boolean; em_ruptura: boolean
}
type NFCega = {
  id: number; numero: string; fornecedor: string; data_entrada: string
  status_conf: string; itens: ItemCego[]
}
type ItemDivergente = {
  produto_id: number; descricao: string; qty_conferida: number
  divergencia: boolean; em_ruptura: boolean; data_validade?: string
}

type FaseCNF = 'lista' | 'conferencia' | 'divergencia' | 'sucesso'

function fmtData(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR')
}

export default function ConferenciaNFPage() {
  const router = useRouter()
  const [fase,       setFase]      = useState<FaseCNF>('lista')
  const [nfs,        setNfs]       = useState<NFPendente[]>([])
  const [loading,    setLoading]   = useState(true)
  const [nfAtual,    setNfAtual]   = useState<NFCega | null>(null)
  const [contados,   setContados]  = useState<Record<number, number>>({})
  const [validades,  setValidades] = useState<Record<number, string>>({})
  const [saving,     setSaving]    = useState(false)
  const [scanInput,  setScanInput] = useState('')
  const [scanMsg,    setScanMsg]   = useState<{ ok: boolean; text: string } | null>(null)
  const [busca,      setBusca]     = useState('')
  const [divItens,   setDivItens]  = useState<ItemDivergente[]>([])
  const [itemFoco,   setItemFoco]  = useState<number | null>(null)
  const scanRef  = useRef<HTMLInputElement>(null)

  async function loadNFs() {
    setLoading(true)
    try { const r = await api.get('/nf-entrada/conf/pendentes'); setNfs(r.data) } catch {}
    setLoading(false)
  }
  useEffect(() => { loadNFs() }, [])

  async function abrirNF(nf: NFPendente) {
    try {
      const r = await api.get(`/nf-entrada/conf/${nf.id}/cego`)
      const data: NFCega = r.data
      setNfAtual(data)
      const init: Record<number, number> = {}
      const initV: Record<number, string> = {}
      data.itens.forEach(it => { init[it.produto_id] = 0; initV[it.produto_id] = '' })
      setContados(init)
      setValidades(initV)
      setScanInput(''); setScanMsg(null)
      setItemFoco(data.itens[0]?.produto_id ?? null)
      setFase('conferencia')
      setTimeout(() => scanRef.current?.focus(), 100)
    } catch {
      setScanMsg({ ok: false, text: 'Erro ao abrir NF' })
    }
  }

  function handleScan(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    const cod = scanInput.trim()
    if (!cod || !nfAtual) { setScanInput(''); return }

    const item = nfAtual.itens.find(it => it.codigo === cod || it.codigo_barras === cod)
    if (!item) {
      setScanMsg({ ok: false, text: `"${cod}" não está nesta NF` })
      setTimeout(() => setScanMsg(null), 2500)
    } else {
      setContados(c => ({ ...c, [item.produto_id]: (c[item.produto_id] || 0) + 1 }))
      setItemFoco(item.produto_id)
      setScanMsg({ ok: true, text: `✓ ${item.descricao}` })
      setTimeout(() => setScanMsg(null), 1200)
    }
    setScanInput('')
  }

  async function finalizarConferencia() {
    if (!nfAtual) return
    setSaving(true)
    try {
      const payload = {
        itens: nfAtual.itens.map(it => ({
          produto_id:   it.produto_id,
          descricao:    it.descricao,
          qty_conferida: contados[it.produto_id] || 0,
          data_validade: it.controla_validade ? (validades[it.produto_id] || null) : null,
        })),
      }
      const r = await api.post(`/nf-entrada/conf/${nfAtual.id}/finalizar`, payload)
      const res = r.data
      if (res.tem_divergencia) {
        setDivItens(res.itens_divergentes || [])
        setFase('divergencia')
      } else {
        setFase('sucesso')
        setTimeout(() => { setFase('lista'); loadNFs() }, 3000)
      }
    } catch (e: any) {
      setScanMsg({ ok: false, text: e.response?.data?.detail || 'Erro ao finalizar' })
    }
    setSaving(false)
  }

  const totalProdutos = nfAtual?.itens.length || 0
  const produtosContados = nfAtual ? nfAtual.itens.filter(it => (contados[it.produto_id] || 0) > 0).length : 0
  const pct = totalProdutos > 0 ? Math.round(produtosContados / totalProdutos * 100) : 0

  const filtradas = nfs.filter(nf =>
    !busca || nf.numero.includes(busca) || nf.fornecedor.toLowerCase().includes(busca.toLowerCase())
  )

  // ── SUCESSO ────────────────────────────────────────────────────────────────
  if (fase === 'sucesso') return (
    <div className="pg flex flex-col items-center justify-center gap-6 p-8">
      <div className="w-20 h-20 rounded-full flex items-center justify-center"
        style={{ background: '#34C75922' }}>
        <CheckCircle2 size={48} color="#34C759" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-black text-white">Conferência Finalizada!</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          NF #{nfAtual?.numero} conferida com sucesso. Sem divergências.
        </p>
      </div>
    </div>
  )

  // ── DIVERGÊNCIA ────────────────────────────────────────────────────────────
  if (fase === 'divergencia' && nfAtual) return (
    <div className="pg" style={{ background: 'var(--bg)' }}>
      <div className="pg-header">
        <h1 className="text-base font-black text-white flex items-center gap-2">
          <AlertTriangle size={16} color="#EF4444" /> Divergência na Conferência
        </h1>
        <p className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>
          NF #{nfAtual.numero} · {nfAtual.fornecedor}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="rounded-2xl p-3" style={{ background: '#EF444411', border: '1px solid #EF444433' }}>
          <p className="text-xs font-bold" style={{ color: '#EF4444' }}>
            ⚠️ Os produtos abaixo tiveram divergência entre o que está na NF e o que foi contado.
            O lançador da nota será notificado automaticamente.
          </p>
        </div>

        {divItens.map((it, i) => (
          <div key={i} className="rounded-2xl p-3"
            style={{ background: 'var(--card)', border: '1px solid #EF444433' }}>
            <p className="text-sm font-bold text-white">{it.descricao}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-[10px] px-2 py-1 rounded-lg font-bold"
                style={{ background: '#EF444422', color: '#EF4444' }}>
                Contado: {it.qty_conferida}
              </span>
              {it.em_ruptura && (
                <span className="text-[10px] px-2 py-1 rounded-lg font-bold"
                  style={{ background: '#F59E0B22', color: '#F59E0B' }}>
                  ⚠️ EM RUPTURA
                </span>
              )}
              {it.data_validade && (
                <span className="text-[10px] px-2 py-1 rounded-lg font-bold"
                  style={{ background: '#32ADE622', color: '#32ADE6' }}>
                  Val: {it.data_validade}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
        <button
          onClick={() => { setFase('lista'); loadNFs() }}
          className="w-full py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg,#EF4444,#B91C1C)', color: 'white' }}>
          <XCircle size={14} /> Registrar Divergência e Encerrar
        </button>
        <p className="text-center text-[10px] mt-2" style={{ color: 'var(--muted)' }}>
          A divergência ficará registrada e o lançador da NF visualizará no painel.
        </p>
      </div>
    </div>
  )

  // ── CONFERÊNCIA ────────────────────────────────────────────────────────────
  if (fase === 'conferencia' && nfAtual) return (
    <div className="pg" style={{ background: 'var(--bg)' }}>
      <div className="pg-header flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setFase('lista')} style={{ color: 'var(--muted)' }}>
            <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <div>
            <h1 className="text-base font-black text-white flex items-center gap-2">
              <EyeOff size={14} color="#32ADE6" /> Conferência Cega · NF#{nfAtual.numero}
            </h1>
            <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
              {nfAtual.fornecedor} · Conte sem ver as quantidades da NF
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-full overflow-hidden" style={{ background: 'var(--card2)', width: 80, height: 7 }}>
            <div className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: '#32ADE6' }} />
          </div>
          <span className="text-xs font-black" style={{ color: '#32ADE6' }}>{pct}%</span>
        </div>
      </div>

      {/* Scan */}
      <div className="px-4 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: 'var(--card)', border: '1px solid #32ADE644' }}>
          <Scan size={14} color="#32ADE6" />
          <input ref={scanRef} value={scanInput}
            onChange={e => setScanInput(e.target.value)}
            onKeyDown={handleScan}
            placeholder="Escanear produto..."
            className="flex-1 text-sm bg-transparent text-white outline-none" />
        </div>
        {scanMsg && (
          <div className="mt-1 px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: scanMsg.ok ? '#34C75922' : '#EF444422', color: scanMsg.ok ? '#34C759' : '#EF4444' }}>
            {scanMsg.text}
          </div>
        )}
      </div>

      {/* Itens */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <p className="text-[10px] text-center font-bold mb-1" style={{ color: 'var(--muted)' }}>
          <EyeOff size={10} className="inline mr-1" />
          Recebimento cego — as quantidades da NF ficam ocultas
        </p>
        {nfAtual.itens.map(it => {
          const cnt = contados[it.produto_id] || 0
          const val = validades[it.produto_id] || ''
          const contado = cnt > 0
          const focoAtivo = itemFoco === it.produto_id
          return (
            <div key={it.produto_id}
              className="rounded-2xl p-3 transition-all"
              style={{
                background: 'var(--card)',
                border: `1px solid ${focoAtivo ? '#32ADE6' : contado ? '#34C75944' : 'var(--border)'}`,
              }}>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: contado ? '#34C75922' : 'var(--card2)' }}>
                  {contado ? <CheckCircle2 size={13} color="#34C759" /> : <Package size={13} color="var(--muted)" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white leading-tight">{it.descricao}</p>
                  <p className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>{it.codigo}</p>

                  {/* Alerta ruptura */}
                  {it.em_ruptura && (
                    <div className="mt-1.5 flex items-center gap-1.5 px-2 py-1 rounded-lg"
                      style={{ background: '#F59E0B22', border: '1px solid #F59E0B44' }}>
                      <AlertTriangle size={10} color="#F59E0B" />
                      <p className="text-[9px] font-black" style={{ color: '#F59E0B' }}>
                        PRODUTO EM RUPTURA — PRECISA LEVAR PARA LOJA
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>Qtd:</span>
                      <input
                        type="number" min={0}
                        value={cnt === 0 ? '' : cnt}
                        onChange={e => {
                          const n = parseFloat(e.target.value) || 0
                          setContados(c => ({ ...c, [it.produto_id]: Math.max(0, n) }))
                          setItemFoco(it.produto_id)
                        }}
                        placeholder="0"
                        className="w-20 px-2 py-1 rounded-lg text-sm font-black text-white text-center outline-none"
                        style={{ background: 'var(--card2)', border: '1px solid var(--border)' }}
                      />
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>{it.unidade}</span>
                    </div>

                    {it.controla_validade && (
                      <div className="flex items-center gap-1.5">
                        <CalendarDays size={12} color="#32ADE6" />
                        <input
                          type="text"
                          value={val}
                          onChange={e => setValidades(v => ({ ...v, [it.produto_id]: e.target.value }))}
                          placeholder="Validade (MM/AAAA)"
                          className="w-32 px-2 py-1 rounded-lg text-xs text-white outline-none"
                          style={{ background: 'var(--card2)', border: '1px solid #32ADE644' }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-2 text-xs" style={{ color: 'var(--muted)' }}>
          <span>Conferidos: {produtosContados} / {totalProdutos}</span>
          {produtosContados < totalProdutos && (
            <span style={{ color: '#F59E0B' }}>⚠️ Há produtos sem contar</span>
          )}
        </div>
        <button
          onClick={finalizarConferencia} disabled={saving}
          className="w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg,#32ADE6,#0369a1)', color: 'white' }}>
          {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          Finalizar Conferência
        </button>
      </div>
    </div>
  )

  // ── LISTA ──────────────────────────────────────────────────────────────────
  return (
    <div className="pg">
      <div className="pg-header flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/expedicao')} style={{ color: 'var(--muted)' }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-base font-black text-white flex items-center gap-2">
              <Truck size={15} color="#32ADE6" /> Conferência NF Entrada
            </h1>
            <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
              Recebimento cego — confira as NFs do fornecedor no coletor
            </p>
          </div>
        </div>
        <button onClick={loadNFs} style={{ color: 'var(--muted)' }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="px-4 pb-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <Search size={13} color="var(--muted)" />
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar NF ou fornecedor..."
            className="flex-1 text-xs bg-transparent text-white outline-none" />
        </div>
      </div>

      <div className="pg-body space-y-2">
        {loading ? (
          <div className="text-center py-12" style={{ color: 'var(--muted)' }}>Carregando...</div>
        ) : filtradas.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--muted)' }}>
            <CheckCircle2 size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma NF aguardando conferência</p>
          </div>
        ) : filtradas.map(nf => (
          <div key={nf.id} className="rounded-2xl p-4"
            style={{
              background: 'var(--card)',
              border: `1px solid ${nf.status_conf === 'DIVERGENCIA' ? '#EF444433' : 'var(--border)'}`,
            }}>
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-black text-white">NF #{nf.numero}</p>
                  {nf.serie && <p className="text-xs" style={{ color: 'var(--muted)' }}>Série {nf.serie}</p>}
                  {nf.status_conf === 'DIVERGENCIA' && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5"
                      style={{ background: '#EF444422', color: '#EF4444' }}>
                      <AlertTriangle size={8} /> Divergência anterior
                    </span>
                  )}
                </div>
                <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted)' }}>
                  {nf.fornecedor} · {nf.total_itens} item(s) · {fmtData(nf.data_entrada)}
                </p>
              </div>
              <button onClick={() => abrirNF(nf)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 flex-shrink-0 mt-0.5"
                style={{ background: '#32ADE6', color: 'white' }}>
                Conferir <ChevronRight size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
