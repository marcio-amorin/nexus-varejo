'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api, { fmtMoeda } from '@/lib/api'
import {
  AlertTriangle, CheckCircle2, RotateCcw, RefreshCw, ArrowLeft, Package,
} from 'lucide-react'

type ItemDiv = {
  descricao: string
  qty_separada: number
  qty_conferida: number
}
type PedidoDiv = {
  id: number
  numero: string
  cliente_nome: string
  total: number
  total_itens: number
  detalhe: ItemDiv[]
}

export default function DivergenciasPage() {
  const router = useRouter()
  const [pedidos, setPedidos] = useState<PedidoDiv[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState<number | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function load() {
    setLoading(true)
    try {
      const r = await api.get('/pedido-venda/divergencias')
      setPedidos(r.data)
    } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function liberar(id: number) {
    setSalvando(id)
    try {
      await api.post(`/pedido-venda/pedidos/${id}/liberar-divergencia`)
      setMsg({ ok: true, text: 'Pedido liberado! Seguirá para emissão de NF.' })
      setTimeout(() => { setMsg(null); load() }, 2000)
    } catch {
      setMsg({ ok: false, text: 'Erro ao liberar pedido.' })
      setTimeout(() => setMsg(null), 3000)
    }
    setSalvando(null)
  }

  async function reconferir(id: number) {
    setSalvando(id)
    try {
      await api.post(`/pedido-venda/pedidos/${id}/reconferir`)
      setMsg({ ok: true, text: 'Pedido devolvido para reconferência.' })
      setTimeout(() => { setMsg(null); load() }, 2000)
    } catch {
      setMsg({ ok: false, text: 'Erro ao devolver pedido.' })
      setTimeout(() => setMsg(null), 3000)
    }
    setSalvando(null)
  }

  return (
    <div className="pg" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="pg-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/expedicao/supervisor')} style={{ color: 'var(--muted)' }}>
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-base font-black text-white flex items-center gap-2">
                <AlertTriangle size={15} color="#EF4444" />
                Liberação — Pedido de Venda
              </h1>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>
                Pedidos com divergência aguardando liberação
              </p>
            </div>
          </div>
          <button onClick={load} style={{ color: 'var(--muted)' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Mensagem de feedback */}
      {msg && (
        <div className="mx-4 mt-0 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2"
          style={{
            background: msg.ok ? '#34C75922' : '#EF444422',
            border: `1px solid ${msg.ok ? '#34C75944' : '#EF444444'}`,
            color: msg.ok ? '#34C759' : '#EF4444',
          }}>
          {msg.ok ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
          {msg.text}
        </div>
      )}

      <div className="pg-body space-y-4">
        {loading ? (
          <div className="text-center py-12" style={{ color: 'var(--muted)' }}>
            <RefreshCw size={24} className="mx-auto mb-2 animate-spin opacity-40" />
          </div>
        ) : pedidos.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--muted)' }}>
            <CheckCircle2 size={44} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm font-bold">Nenhuma divergência pendente</p>
            <p className="text-xs mt-1 opacity-60">Todas as conferências estão OK</p>
          </div>
        ) : pedidos.map(p => (
          <div key={p.id} className="rounded-3xl overflow-hidden"
            style={{ border: '1.5px solid #EF444444', background: 'var(--card)' }}>

            {/* Cabeçalho do pedido */}
            <div className="px-4 py-3 flex items-center justify-between"
              style={{ background: '#EF444411', borderBottom: '1px solid #EF444433' }}>
              <div>
                <p className="font-black text-white text-sm">{p.numero}</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>
                  {p.cliente_nome} · {p.total_itens} item(s) · {fmtMoeda(p.total)}
                </p>
              </div>
              <span className="text-[10px] font-black px-2 py-1 rounded-lg flex items-center gap-1"
                style={{ background: '#EF444422', color: '#EF4444' }}>
                <AlertTriangle size={9} /> DIVERGÊNCIA
              </span>
            </div>

            {/* Itens divergentes */}
            <div className="px-4 py-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wide mb-2"
                style={{ color: 'var(--muted)' }}>
                O que divergiu:
              </p>
              {p.detalhe.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  Detalhes não disponíveis
                </p>
              ) : p.detalhe.map((it, i) => (
                <div key={i} className="rounded-2xl p-3 flex items-center gap-3"
                  style={{ background: 'var(--card2)', border: '1px solid #EF444422' }}>
                  <Package size={13} color="#EF4444" className="flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{it.descricao}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: '#32ADE622', color: '#32ADE6' }}>
                        Separado: {it.qty_separada}
                      </span>
                      <span className="text-[10px]" style={{ color: 'var(--muted)' }}>→</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: '#EF444422', color: '#EF4444' }}>
                        Contado: {it.qty_conferida}
                      </span>
                      <span className="text-[10px] font-black ml-auto"
                        style={{ color: it.qty_conferida < it.qty_separada ? '#EF4444' : '#F59E0B' }}>
                        {it.qty_conferida < it.qty_separada
                          ? `−${it.qty_separada - it.qty_conferida}`
                          : `+${it.qty_conferida - it.qty_separada}`}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Ações do supervisor */}
            <div className="px-4 pb-4 flex gap-2">
              <button
                onClick={() => reconferir(p.id)}
                disabled={salvando === p.id}
                className="flex-1 py-2.5 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5"
                style={{ background: '#F59E0B22', color: '#F59E0B', border: '1px solid #F59E0B44' }}>
                {salvando === p.id
                  ? <RefreshCw size={11} className="animate-spin" />
                  : <RotateCcw size={11} />}
                Reconferir
              </button>
              <button
                onClick={() => liberar(p.id)}
                disabled={salvando === p.id}
                className="flex-1 py-2.5 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5"
                style={{ background: 'linear-gradient(135deg,#34C759,#16a34a)', color: 'white' }}>
                {salvando === p.id
                  ? <RefreshCw size={11} className="animate-spin" />
                  : <CheckCircle2 size={11} />}
                Liberar para NF
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
