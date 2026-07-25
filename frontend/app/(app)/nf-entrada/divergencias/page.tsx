'use client'
import { useEffect, useState } from 'react'
import api, { fmtMoeda, fmtData } from '@/lib/api'
import {
  RefreshCw, AlertTriangle, CheckCircle2, RotateCcw,
  Package, ChevronDown, ChevronUp, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'

type ItemDiv = {
  produto_id: number; descricao: string
  qty_nf: number; qty_conferida: number; diferenca: number; em_ruptura: boolean
}

type DivNF = {
  id: number; numero: string; serie: string; data_emissao?: string
  fornecedor_nome: string; valor_total: number; data_conf?: string
  total_div: number; itens_divergentes: ItemDiv[]
}

export default function DivergenciasNFPage() {
  const [lista,    setLista]    = useState<DivNF[]>([])
  const [loading,  setLoading]  = useState(true)
  const [expandido, setExpandido] = useState<number | null>(null)
  const [acao,     setAcao]     = useState<number | null>(null)
  const [msg,      setMsg]      = useState<{ ok: boolean; text: string } | null>(null)

  async function load() {
    setLoading(true)
    try { const r = await api.get('/nf-entrada/divergencias-recebimento'); setLista(r.data) } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function flash(ok: boolean, text: string) {
    setMsg({ ok, text })
    setTimeout(() => setMsg(null), 4000)
  }

  async function liberar(nf: DivNF) {
    setAcao(nf.id)
    try {
      await api.post(`/nf-entrada/${nf.id}/liberar-divergencia`, {})
      flash(true, `NF ${nf.numero} liberada com sucesso`)
      load()
    } catch (ex: any) {
      flash(false, ex.response?.data?.detail || 'Erro ao liberar')
    }
    setAcao(null)
  }

  async function reconferir(nf: DivNF) {
    setAcao(nf.id)
    try {
      await api.post(`/nf-entrada/${nf.id}/reconferir`, {})
      flash(true, `NF ${nf.numero} enviada para reconferência`)
      load()
    } catch (ex: any) {
      flash(false, ex.response?.data?.detail || 'Erro ao reconferir')
    }
    setAcao(null)
  }

  return (
    <div className="pg" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="pg-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-black text-white flex items-center gap-2">
              <AlertTriangle size={15} color="#F59E0B" />
              Divergências de Recebimento NF
            </h1>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>
              {lista.length} NF(s) com divergência pendente de liberação
            </p>
          </div>
          <button onClick={load} style={{ color: 'var(--muted)' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {msg && (
          <div className="mt-2 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2"
            style={{ background: msg.ok ? '#34C75922' : '#EF444422', color: msg.ok ? '#34C759' : '#EF4444' }}>
            {msg.ok ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
            {msg.text}
          </div>
        )}
      </div>

      <div className="pg-body space-y-2">
        {loading ? (
          <div className="text-center py-12" style={{ color: 'var(--muted)' }}>
            <RefreshCw size={24} className="mx-auto mb-2 animate-spin opacity-30" />
          </div>
        ) : lista.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--muted)' }}>
            <CheckCircle2 size={44} className="mx-auto mb-3 opacity-20" style={{ color: '#34C759' }} />
            <p className="text-sm font-bold">Nenhuma divergência pendente</p>
            <p className="text-xs mt-1 opacity-60">Todas as NFs foram conferidas corretamente</p>
          </div>
        ) : lista.map(nf => (
          <CardDivNF key={nf.id} nf={nf}
            expandido={expandido === nf.id}
            emAcao={acao === nf.id}
            onExpandir={() => setExpandido(expandido === nf.id ? null : nf.id)}
            onLiberar={() => liberar(nf)}
            onReconferir={() => reconferir(nf)}
          />
        ))}
      </div>
    </div>
  )
}

function CardDivNF({ nf, expandido, emAcao, onExpandir, onLiberar, onReconferir }: {
  nf: DivNF; expandido: boolean; emAcao: boolean
  onExpandir: () => void; onLiberar: () => void; onReconferir: () => void
}) {
  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--card)', border: '1px solid #F59E0B44' }}>

      {/* Linha principal */}
      <button onClick={onExpandir} className="w-full p-3 text-left">
        <div className="flex items-center gap-3">
          {/* Ícone */}
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: '#F59E0B22' }}>
            <AlertTriangle size={16} color="#F59E0B" />
          </div>

          {/* Info NF */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-black text-white">{nf.fornecedor_nome}</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: '#F59E0B22', color: '#F59E0B' }}>
                {nf.total_div} item(s) divergente(s)
              </span>
            </div>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
                NF {nf.numero}-{nf.serie}
              </span>
              {nf.data_emissao && (
                <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
                  Emitida {nf.data_emissao}
                </span>
              )}
              {nf.data_conf && (
                <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
                  Conferida {nf.data_conf.slice(0, 10)}
                </span>
              )}
              <span className="text-[10px] font-bold text-white">{fmtMoeda(nf.valor_total)}</span>
            </div>
          </div>

          {expandido ? <ChevronUp size={14} color="var(--muted)" /> : <ChevronDown size={14} color="var(--muted)" />}
        </div>
      </button>

      {/* Detalhe */}
      {expandido && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {/* Itens divergentes */}
          <div className="p-3 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wide mb-2"
              style={{ color: 'var(--muted)' }}>Produtos com divergência</p>

            {nf.itens_divergentes.map((it, i) => {
              const sobra = it.diferenca > 0
              const falta = it.diferenca < 0
              return (
                <div key={i} className="p-2.5 rounded-xl"
                  style={{ background: 'var(--card2)', border: '1px solid #F59E0B33' }}>
                  {/* Nome produto */}
                  <div className="flex items-start gap-2">
                    <Package size={12} color="#F59E0B" className="mt-0.5 flex-shrink-0" />
                    <p className="text-xs font-bold text-white leading-tight">{it.descricao}</p>
                    {it.em_ruptura && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ml-auto"
                        style={{ background: '#EF444422', color: '#EF4444' }}>
                        Ruptura
                      </span>
                    )}
                  </div>

                  {/* Comparativo */}
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex-1 text-center p-2 rounded-xl"
                      style={{ background: 'var(--bg)' }}>
                      <p className="text-[9px] font-bold uppercase tracking-wide"
                        style={{ color: 'var(--muted)' }}>Lançado na NF</p>
                      <p className="text-sm font-black text-white">{it.qty_nf}</p>
                    </div>
                    <div className="flex-1 text-center p-2 rounded-xl"
                      style={{ background: 'var(--bg)' }}>
                      <p className="text-[9px] font-bold uppercase tracking-wide"
                        style={{ color: 'var(--muted)' }}>Conferente contou</p>
                      <p className="text-sm font-black text-white">{it.qty_conferida}</p>
                    </div>
                    <div className="flex-1 text-center p-2 rounded-xl"
                      style={{ background: falta ? '#EF444422' : '#F59E0B22' }}>
                      <p className="text-[9px] font-bold uppercase tracking-wide"
                        style={{ color: 'var(--muted)' }}>Diferença</p>
                      <p className="text-sm font-black flex items-center justify-center gap-1"
                        style={{ color: falta ? '#EF4444' : '#F59E0B' }}>
                        {sobra ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        {it.diferenca > 0 ? '+' : ''}{it.diferenca}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Ações */}
          <div className="px-3 pb-3 flex gap-2" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <button onClick={onReconferir} disabled={emAcao}
              className="flex-1 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5"
              style={{ background: '#F59E0B22', color: '#F59E0B', border: '1px solid #F59E0B44' }}>
              {emAcao ? <RefreshCw size={11} className="animate-spin" /> : <RotateCcw size={11} />}
              Reconferir
            </button>
            <button onClick={onLiberar} disabled={emAcao}
              className="flex-1 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5"
              style={{ background: 'linear-gradient(135deg,#34C759,#16a34a)', color: 'white' }}>
              {emAcao ? <RefreshCw size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
              Liberar para NF
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
