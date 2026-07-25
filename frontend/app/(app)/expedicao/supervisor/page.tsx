'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import {
  ShieldCheck, ArrowLeft, RefreshCw, AlertTriangle, CheckCircle2,
  ChevronRight, FileText, ShoppingCart, ClipboardList,
} from 'lucide-react'

type Contagens = {
  pv: number
  pc: number
  nf: number
}

export default function SupervisorPage() {
  const router = useRouter()
  const [contagens, setContagens] = useState<Contagens>({ pv: 0, pc: 0, nf: 0 })
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const [pvRes, nfRes] = await Promise.allSettled([
        api.get('/pedido-venda/divergencias'),
        api.get('/nf-entrada/conf/pendentes'),
      ])
      const divPv: any[] = pvRes.status === 'fulfilled' ? pvRes.value.data : []
      const nfs:   any[] = nfRes.status  === 'fulfilled' ? nfRes.value.data  : []
      setContagens({
        pv: divPv.length,
        pc: 0, // Pedido de Compra — implementar quando tiver o fluxo
        nf: nfs.filter((n: any) => n.status_conf === 'DIVERGENCIA').length,
      })
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const totalPendentes = contagens.pv + contagens.pc + contagens.nf

  const cards = [
    {
      label:  'Liberação — Pedido de Venda',
      sub:    'Divergências de conferência de pedidos',
      icon:   <ClipboardList size={26} color="#32ADE6" />,
      cor:    '#32ADE6',
      bg:     'linear-gradient(135deg, #1e3a5f 0%, #0f2340 100%)',
      count:  contagens.pv,
      unit:   'PV',
      rota:   '/expedicao/supervisor/liberacao-pv',
    },
    {
      label:  'Liberação — Pedido de Compra',
      sub:    'Divergências de recebimento de compras',
      icon:   <ShoppingCart size={26} color="#F59E0B" />,
      cor:    '#F59E0B',
      bg:     'linear-gradient(135deg, #3f2e00 0%, #231900 100%)',
      count:  contagens.pc,
      unit:   'PC',
      rota:   '/expedicao/supervisor/liberacao-pc',
    },
    {
      label:  'Liberação — Nota Fiscal Entrada',
      sub:    'Divergências de conferência de NF',
      icon:   <FileText size={26} color="#34C759" />,
      cor:    '#34C759',
      bg:     'linear-gradient(135deg, #1e3f1e 0%, #0f2310 100%)',
      count:  contagens.nf,
      unit:   'NF',
      rota:   '/expedicao/supervisor/liberacao-nf',
    },
  ]

  return (
    <div className="pg" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="pg-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/expedicao')} style={{ color: 'var(--muted)' }}>
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-base font-black text-white flex items-center gap-2">
                <ShieldCheck size={15} color="#A855F7" />
                Modo Liberação
              </h1>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>
                Liberação de pedidos e notas fiscais
              </p>
            </div>
          </div>
          <button onClick={load} style={{ color: 'var(--muted)' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Alerta geral */}
      {!loading && totalPendentes > 0 && (
        <div className="mx-4 mt-0 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2"
          style={{ background: '#EF444411', border: '1px solid #EF444433', color: '#EF4444' }}>
          <AlertTriangle size={12} />
          {totalPendentes} pendência{totalPendentes !== 1 ? 's' : ''} aguardando liberação
        </div>
      )}
      {!loading && totalPendentes === 0 && (
        <div className="mx-4 mt-0 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2"
          style={{ background: '#34C75911', border: '1px solid #34C75933', color: '#34C759' }}>
          <CheckCircle2 size={12} /> Sem pendências — tudo liberado
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {cards.map(c => (
          <button
            key={c.rota}
            onClick={() => router.push(c.rota)}
            className="w-full rounded-3xl p-5 text-left transition-all active:scale-[0.98]"
            style={{
              background: c.bg,
              border: `1.5px solid ${c.count > 0 ? c.cor : c.cor + '44'}`,
            }}>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: c.cor + '22' }}>
                {c.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-black text-white">{c.label}</p>
                <p className="text-xs mt-0.5" style={{ color: c.cor }}>{c.sub}</p>
                <div className="mt-2">
                  {loading ? (
                    <span className="text-[10px]" style={{ color: 'var(--muted)' }}>Carregando...</span>
                  ) : c.count === 0 ? (
                    <span className="text-[10px] font-bold flex items-center gap-1" style={{ color: '#34C759' }}>
                      <CheckCircle2 size={9} /> Sem pendências
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 w-fit"
                      style={{ background: '#EF444422', color: '#EF4444' }}>
                      <AlertTriangle size={8} /> {c.count} aguardando liberação
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-center flex-shrink-0">
                {loading ? (
                  <RefreshCw size={18} color={c.cor} className="animate-spin" />
                ) : (
                  <>
                    <span className="text-4xl font-black leading-none"
                      style={{ color: c.count > 0 ? '#EF4444' : c.cor + '44' }}>
                      {c.count}
                    </span>
                    <span className="text-[9px] font-bold mt-0.5"
                      style={{ color: c.count > 0 ? '#EF4444' : 'var(--muted)' }}>
                      {c.unit}
                    </span>
                  </>
                )}
                <ChevronRight size={14} color={c.cor} className="mt-1" />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
