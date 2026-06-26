'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api, { fmtMoeda, fmtData } from '@/lib/api'
import {
  ShoppingBag, AlertTriangle, ClipboardList,
  TrendingUp, Package, ArrowRight, Smartphone,
} from 'lucide-react'

const PRIOR_COLOR: Record<string, string> = {
  NORMAL: '#8E8E93', URGENTE: '#FF9F0A', CRITICA: '#FF3B30',
}
const STATUS_PC: Record<string, { bg: string; c: string }> = {
  RASCUNHO: { bg: '#8E8E9322', c: '#8E8E93' },
  ENVIADO:  { bg: '#32ADE622', c: '#32ADE6' },
  PARCIAL:  { bg: '#FF9F0A22', c: '#FF9F0A' },
  RECEBIDO: { bg: '#34C75922', c: '#34C759' },
  CANCELADO:{ bg: '#FF3B3022', c: '#FF3B30' },
}

export default function ComprasDashboard() {
  const router = useRouter()
  const [dados, setDados] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/compras/dashboard').then(r => { setDados(r.data); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64" style={{ color: 'var(--muted)' }}>Carregando...</div>

  const d = dados || {}

  return (
    <div className="h-full overflow-y-auto p-3 space-y-3">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-white">Central de Compras</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Dashboard do Módulo</p>
        </div>
        <div className="flex gap-2">
          <a href="/repositor" target="_blank"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
            style={{ background: '#34C75922', color: '#34C759', border: '1px solid #34C75944' }}>
            <Smartphone size={14} /> App Repositor
          </a>
          <button onClick={() => router.push('/compras/pedidos')}
            className="btn-primary flex items-center gap-2 text-sm">
            <ClipboardList size={14} /> Novo Pedido
          </button>
        </div>
      </div>

      {/* Alerta urgente */}
      {d.solicitacoes_urgentes > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-2xl"
          style={{ background: '#FF3B3018', border: '1px solid #FF3B3040' }}>
          <AlertTriangle size={20} color="#FF3B30" />
          <p className="text-sm font-bold" style={{ color: '#FF3B30' }}>
            {d.solicitacoes_urgentes} solicitaç{d.solicitacoes_urgentes === 1 ? 'ão urgente/crítica' : 'ões urgentes/críticas'} aguardando aprovação do comprador
          </p>
          <button onClick={() => router.push('/compras/solicitacoes')}
            className="ml-auto text-xs font-bold underline" style={{ color: '#FF3B30' }}>
            Ver agora →
          </button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { l: 'Solicitações\nPendentes', v: d.solicitacoes_pendentes ?? 0, c: '#F59E0B', ic: ClipboardList },
          { l: 'Urgentes /\nCríticas',   v: d.solicitacoes_urgentes ?? 0,  c: '#FF3B30', ic: AlertTriangle },
          { l: 'Pedidos\nem Aberto',     v: d.pedidos_abertos ?? 0,        c: '#32ADE6', ic: ShoppingBag },
          { l: 'Valor\nComprometido',    v: fmtMoeda(d.valor_comprometido ?? 0), c: '#EA580C', ic: TrendingUp },
          { l: 'Produtos\nSem Estoque',  v: d.produtos_criticos ?? 0,      c: '#FF3B30', ic: Package },
          { l: 'Estoque\nBaixo',         v: d.produtos_baixo_estoque ?? 0, c: '#FF9F0A', ic: Package },
        ].map((s, i) => (
          <div key={i} className="card text-center">
            <s.ic size={20} color={s.c} className="mx-auto mb-2" />
            <p className="text-xl font-black" style={{ color: s.c }}>{s.v}</p>
            <p className="text-[10px] font-semibold mt-0.5" style={{ color: 'var(--muted)', whiteSpace: 'pre-line' }}>{s.l}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Solicitações pendentes do repositor */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-white">Solicitações do Repositor</h2>
            <button onClick={() => router.push('/compras/solicitacoes')}
              className="flex items-center gap-1 text-xs font-bold" style={{ color: '#F59E0B' }}>
              Ver todas <ArrowRight size={12} />
            </button>
          </div>
          {(!d.ultimas_solicitacoes || d.ultimas_solicitacoes.length === 0) ? (
            <p className="text-sm text-center py-6" style={{ color: 'var(--muted)' }}>Nenhuma solicitação pendente</p>
          ) : d.ultimas_solicitacoes.map((s: any) => (
            <div key={s.id} className="flex items-center gap-3 py-2"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{s.produto_descricao}</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  Estoque: {s.estoque_atual} | Sugerido: {s.quantidade_sugerida} {s.produto_unidade}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="badge text-[10px] font-black" style={{
                  background: PRIOR_COLOR[s.prioridade] + '22',
                  color: PRIOR_COLOR[s.prioridade],
                }}>{s.prioridade}</span>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>{s.criado_por || '—'}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Pedidos em aberto */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-white">Pedidos em Aberto</h2>
            <button onClick={() => router.push('/compras/pedidos')}
              className="flex items-center gap-1 text-xs font-bold" style={{ color: '#F59E0B' }}>
              Ver todos <ArrowRight size={12} />
            </button>
          </div>
          {(!d.ultimos_pedidos || d.ultimos_pedidos.length === 0) ? (
            <p className="text-sm text-center py-6" style={{ color: 'var(--muted)' }}>Nenhum pedido em aberto</p>
          ) : d.ultimos_pedidos.map((p: any) => {
            const sc = STATUS_PC[p.status] || STATUS_PC.RASCUNHO
            return (
              <div key={p.id} className="flex items-center gap-3 py-2"
                style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold" style={{ color: '#F59E0B' }}>{p.numero}</span>
                    <span className="badge text-[10px]" style={{ background: sc.bg, color: sc.c }}>{p.status}</span>
                  </div>
                  <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>{p.fornecedor_nome}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold" style={{ color: '#F59E0B' }}>{fmtMoeda(p.valor_total)}</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>{p.total_itens} iten(s)</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Alertas de estoque */}
      {d.alertas_estoque?.length > 0 && (
        <div className="card">
          <h2 className="font-bold text-white mb-3">Alertas de Estoque — Precisam de Reposição</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {d.alertas_estoque.map((a: any) => {
              const cc = a.status === 'CRITICO' ? '#FF3B30' : '#FF9F0A'
              return (
                <div key={a.produto_id} className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: cc + '12', border: `1px solid ${cc}30` }}>
                  <AlertTriangle size={16} color={cc} className="flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{a.descricao}</p>
                    <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
                      Atual: <span style={{ color: cc, fontWeight: 700 }}>{a.estoque_atual}</span> | Mín: {a.estoque_minimo}
                    </p>
                  </div>
                  <span className="badge text-[10px] font-black flex-shrink-0"
                    style={{ background: cc + '22', color: cc }}>{a.status}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
