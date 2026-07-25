'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import {
  ClipboardCheck, Truck, ChevronRight, RefreshCw,
  AlertTriangle, CheckCircle2, Package, ShieldCheck, Lock,
} from 'lucide-react'

type Resumo = {
  pedidos_aguardando: number
  pedidos_divergencia: number
  nfs_aguardando: number
  nfs_divergencia: number
  div_pv: number
  div_nf: number
}

export default function ExpedicaoPage() {
  const router  = useRouter()
  const [resumo,   setResumo]   = useState<Resumo | null>(null)
  const [loading,  setLoading]  = useState(true)

  async function loadResumo() {
    setLoading(true)
    try {
      const [pedRes, nfRes, divPvRes] = await Promise.allSettled([
        api.get('/pedido-venda/conferencia'),
        api.get('/nf-entrada/conf/pendentes'),
        api.get('/pedido-venda/divergencias'),
      ])

      const pedidos: any[] = pedRes.status === 'fulfilled' ? pedRes.value.data : []
      const nfs:     any[] = nfRes.status  === 'fulfilled' ? nfRes.value.data  : []
      const divPv:   any[] = divPvRes.status === 'fulfilled' ? divPvRes.value.data : []

      setResumo({
        pedidos_aguardando:  pedidos.filter(p => !p.status_conferencia).length,
        pedidos_divergencia: pedidos.filter(p => p.status_conferencia === 'DIVERGENCIA').length,
        nfs_aguardando:      nfs.filter(n => n.status_conf !== 'DIVERGENCIA').length,
        nfs_divergencia:     nfs.filter(n => n.status_conf === 'DIVERGENCIA').length,
        div_pv:              divPv.length,
        div_nf:              nfs.filter(n => n.status_conf === 'DIVERGENCIA').length,
      })
    } catch {}
    setLoading(false)
  }

  useEffect(() => { loadResumo() }, [])

  const totalPedidos = (resumo?.pedidos_aguardando || 0) + (resumo?.pedidos_divergencia || 0)
  const totalNFs     = (resumo?.nfs_aguardando    || 0) + (resumo?.nfs_divergencia    || 0)

  return (
    <div className="pg" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="pg-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-black text-white">Expedição / Recebimento</h1>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>
              Selecione o modo de conferência
            </p>
          </div>
          <button onClick={loadResumo} style={{ color: 'var(--muted)' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* MODO 1 — Reconferência de Pedidos */}
        <button
          onClick={() => router.push('/conferencia')}
          className="w-full rounded-3xl p-5 text-left transition-all active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2340 100%)',
            border: `1.5px solid ${totalPedidos > 0 ? '#32ADE6' : '#32ADE644'}`,
          }}>
          <div className="flex items-center gap-4">
            {/* Ícone */}
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: '#32ADE622' }}>
              <ClipboardCheck size={26} color="#32ADE6" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-base font-black text-white">Reconferência de Pedidos</p>
              <p className="text-xs mt-0.5" style={{ color: '#32ADE6' }}>Pedidos vindos da separação</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {loading ? (
                  <span className="text-[10px]" style={{ color: 'var(--muted)' }}>Carregando...</span>
                ) : totalPedidos === 0 ? (
                  <span className="text-[10px] font-bold flex items-center gap-1" style={{ color: '#34C759' }}>
                    <CheckCircle2 size={9} /> Tudo conferido
                  </span>
                ) : (
                  <>
                    {(resumo?.pedidos_aguardando || 0) > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1"
                        style={{ background: '#32ADE622', color: '#32ADE6' }}>
                        <Package size={8} /> {resumo!.pedidos_aguardando} aguardando
                      </span>
                    )}
                    {(resumo?.pedidos_divergencia || 0) > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1"
                        style={{ background: '#EF444422', color: '#EF4444' }}>
                        <AlertTriangle size={8} /> {resumo!.pedidos_divergencia} divergência
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Contador grande */}
            <div className="flex flex-col items-center flex-shrink-0">
              {loading ? (
                <RefreshCw size={20} color="#32ADE6" className="animate-spin" />
              ) : (
                <>
                  <span className="text-4xl font-black leading-none"
                    style={{ color: totalPedidos > 0 ? '#32ADE6' : '#32ADE644' }}>
                    {totalPedidos}
                  </span>
                  <span className="text-[9px] font-bold mt-0.5"
                    style={{ color: totalPedidos > 0 ? '#32ADE6' : 'var(--muted)' }}>
                    pedido{totalPedidos !== 1 ? 's' : ''}
                  </span>
                </>
              )}
              <ChevronRight size={14} color="#32ADE6" className="mt-1" />
            </div>
          </div>
        </button>

        {/* MODO 2 — Conferência NF Entrada */}
        <button
          onClick={() => router.push('/expedicao/conferencia-nf')}
          className="w-full rounded-3xl p-5 text-left transition-all active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, #1e3f1e 0%, #0f2310 100%)',
            border: `1.5px solid ${totalNFs > 0 ? '#34C759' : '#34C75944'}`,
          }}>
          <div className="flex items-center gap-4">
            {/* Ícone */}
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: '#34C75922' }}>
              <Truck size={26} color="#34C759" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-base font-black text-white">Conferência NF Entrada</p>
              <p className="text-xs mt-0.5" style={{ color: '#34C759' }}>Notas fiscais de fornecedores</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {loading ? (
                  <span className="text-[10px]" style={{ color: 'var(--muted)' }}>Carregando...</span>
                ) : totalNFs === 0 ? (
                  <span className="text-[10px] font-bold flex items-center gap-1" style={{ color: '#34C759' }}>
                    <CheckCircle2 size={9} /> Nenhuma NF pendente
                  </span>
                ) : (
                  <>
                    {(resumo?.nfs_aguardando || 0) > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1"
                        style={{ background: '#34C75922', color: '#34C759' }}>
                        <Package size={8} /> {resumo!.nfs_aguardando} aguardando
                      </span>
                    )}
                    {(resumo?.nfs_divergencia || 0) > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1"
                        style={{ background: '#EF444422', color: '#EF4444' }}>
                        <AlertTriangle size={8} /> {resumo!.nfs_divergencia} divergência
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Contador grande */}
            <div className="flex flex-col items-center flex-shrink-0">
              {loading ? (
                <RefreshCw size={20} color="#34C759" className="animate-spin" />
              ) : (
                <>
                  <span className="text-4xl font-black leading-none"
                    style={{ color: totalNFs > 0 ? '#34C759' : '#34C75944' }}>
                    {totalNFs}
                  </span>
                  <span className="text-[9px] font-bold mt-0.5"
                    style={{ color: totalNFs > 0 ? '#34C759' : 'var(--muted)' }}>
                    NF{totalNFs !== 1 ? 's' : ''}
                  </span>
                </>
              )}
              <ChevronRight size={14} color="#34C759" className="mt-1" />
            </div>
          </div>
        </button>

        {/* Divisor Supervisor */}
        <div className="flex items-center gap-3 pt-2">
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          <span className="text-[10px] font-bold flex items-center gap-1" style={{ color: 'var(--muted)' }}>
            <Lock size={9} /> MODO LIBERAÇÃO
          </span>
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        </div>

        {/* MODO SUPERVISOR */}
        {(() => {
          const totalDiv = (resumo?.div_pv || 0) + (resumo?.div_nf || 0)
          return (
            <button
              onClick={() => router.push('/expedicao/supervisor')}
              className="w-full rounded-3xl p-5 text-left transition-all active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #2d1f3f 0%, #1a1025 100%)',
                border: `1.5px solid ${totalDiv > 0 ? '#A855F7' : '#A855F744'}`,
              }}>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: '#A855F722' }}>
                  <ShieldCheck size={26} color="#A855F7" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-black text-white">Modo Liberação</p>
                  <p className="text-xs mt-0.5" style={{ color: '#A855F7' }}>Liberar pedidos e notas fiscais</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {loading ? (
                      <span className="text-[10px]" style={{ color: 'var(--muted)' }}>Carregando...</span>
                    ) : totalDiv === 0 ? (
                      <span className="text-[10px] font-bold flex items-center gap-1" style={{ color: '#34C759' }}>
                        <CheckCircle2 size={9} /> Sem pendências
                      </span>
                    ) : (
                      <>
                        {(resumo?.div_pv || 0) > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1"
                            style={{ background: '#EF444422', color: '#EF4444' }}>
                            <AlertTriangle size={8} /> {resumo!.div_pv} PV
                          </span>
                        )}
                        {(resumo?.div_nf || 0) > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1"
                            style={{ background: '#EF444422', color: '#EF4444' }}>
                            <AlertTriangle size={8} /> {resumo!.div_nf} NF
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-center flex-shrink-0">
                  {loading ? (
                    <RefreshCw size={20} color="#A855F7" className="animate-spin" />
                  ) : (
                    <>
                      <span className="text-4xl font-black leading-none"
                        style={{ color: totalDiv > 0 ? '#EF4444' : '#A855F744' }}>
                        {totalDiv}
                      </span>
                      <span className="text-[9px] font-bold mt-0.5"
                        style={{ color: totalDiv > 0 ? '#EF4444' : 'var(--muted)' }}>
                        pendente{totalDiv !== 1 ? 's' : ''}
                      </span>
                    </>
                  )}
                  <ChevronRight size={14} color="#A855F7" className="mt-1" />
                </div>
              </div>
            </button>
          )
        })()}
      </div>
    </div>
  )
}
