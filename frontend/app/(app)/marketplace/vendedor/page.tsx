'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Store, TrendingUp, Package, RefreshCw, Settings, Zap, ChevronRight, ShoppingBag } from 'lucide-react'

const API  = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'
const GRAD = 'linear-gradient(135deg,#7c3aed 0%,#f97316 100%)'

function fmtR(v:number) { return (Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) }
function hdr() { return { 'Content-Type':'application/json', Authorization:`Bearer ${localStorage.getItem('nexus_token')}` } }

const STATUS_COR: Record<string,{bg:string;cor:string}> = {
  ATIVO:    { bg:'rgba(34,197,94,0.15)',  cor:'#22c55e' },
  PENDENTE: { bg:'rgba(245,158,11,0.15)', cor:'#f59e0b' },
  PAUSADO:  { bg:'rgba(100,116,139,0.15)',cor:'#94a3b8' },
  ERRO:     { bg:'rgba(239,68,68,0.15)',  cor:'#ef4444' },
}

export default function PainelVendedor() {
  const router = useRouter()
  const [dash, setDash]     = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    try {
      const r = await fetch(`${API}/vendedor/dashboard`, { headers: hdr() })
      setDash(await r.json())
    } catch {}
    setLoading(false)
  }

  async function syncPedidos() {
    setSyncing(true)
    try {
      await fetch(`${API}/vendedor/sync-pedidos`, { method:'POST', headers:hdr() })
      carregar()
    } catch {}
    setSyncing(false)
  }

  return (
    <div className="pg">
      {/* Header */}
      <div className="pg-header rounded-xl overflow-hidden" style={{ background: GRAD }}>
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-black text-white flex items-center gap-2"><Store size={16}/> Painel Vendedor</h1>
            <p className="text-xs text-white/75 mt-0.5">Seus anúncios, pedidos e faturamento em todas as plataformas</p>
          </div>
          <div className="flex gap-2">
            <button onClick={syncPedidos} disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ background:'rgba(255,255,255,0.2)', color:'#fff', border:'1px solid rgba(255,255,255,0.35)' }}>
              <RefreshCw size={12} className={syncing?'animate-spin':''}/>
              {syncing ? 'Sincronizando...' : 'Sync Pedidos'}
            </button>
            <button onClick={() => router.push('/marketplace/vendedor/config')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ background:'rgba(255,255,255,0.2)', color:'#fff', border:'1px solid rgba(255,255,255,0.35)' }}>
              <Settings size={12}/> Config
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="pg-stats grid grid-cols-4 gap-2">
        {[
          { label:'Anúncios Ativos',  value: dash?.total_anuncios||0, cor:'#22c55e',  icon:Package   },
          { label:'Total Faturado',   value: fmtR(dash?.total_faturado||0), cor:'#f97316', icon:TrendingUp },
          { label:'Total Vendas',     value: dash?.total_vendas||0,   cor:'#3b82f6',  icon:Store     },
          { label:'Pendentes',        value: dash?.pendentes||0,      cor:'#f59e0b',  icon:RefreshCw },
        ].map((k,i) => (
          <div key={i} className="rounded-xl p-3" style={{ background:'var(--card)', border:`1px solid ${k.cor}30` }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-2" style={{ background:k.cor+'20' }}>
              <k.icon size={14} color={k.cor}/>
            </div>
            <p className="text-lg font-black" style={{ color:k.cor }}>{k.value}</p>
            <p className="text-[10px] mt-0.5" style={{ color:'var(--muted)' }}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* CTA — ir para catálogo publicar */}
      <div className="pg-stats rounded-xl p-4 flex items-center gap-4" style={{ background:'var(--card)', border:'2px solid rgba(124,58,237,0.4)' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:'linear-gradient(135deg,#7c3aed,#f97316)' }}>
          <Zap size={20} color="#fff"/>
        </div>
        <div className="flex-1">
          <p className="text-sm font-black text-white">Publicar Tudo Automático</p>
          <p className="text-xs mt-0.5" style={{ color:'var(--muted)' }}>
            Escolha um produto no Catálogo → clique em <strong style={{color:'#f97316'}}>Publicar Tudo</strong> → publica no ML Vendedor + gera link afiliado + posta nas redes sociais
          </p>
        </div>
        <button onClick={() => router.push('/marketplace/afiliados/catalogo')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black text-white flex-shrink-0"
          style={{ background:'linear-gradient(135deg,#7c3aed,#f97316)' }}>
          Ir ao Catálogo <ChevronRight size={13}/>
        </button>
      </div>

      {/* Anúncios recentes */}
      <div className="pg-body rounded-xl overflow-hidden" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
        <div className="px-4 py-2.5 flex items-center justify-between flex-shrink-0" style={{ borderBottom:'1px solid var(--border)' }}>
          <p className="text-[10px] font-black tracking-widest" style={{ color:'var(--muted)' }}>ANÚNCIOS RECENTES</p>
          <button onClick={() => router.push('/marketplace/vendedor/anuncios')}
            className="text-[10px] font-bold flex items-center gap-1"
            style={{ color:'#f97316' }}>
            Ver todos <ChevronRight size={10}/>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8"><RefreshCw size={20} color="#f97316" className="animate-spin"/></div>
        ) : (dash?.recentes||[]).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color:'var(--muted)' }}>
            <ShoppingBag size={32}/>
            <p className="text-xs">Nenhum anúncio publicado ainda</p>
            <p className="text-xs">Use o botão "Publicar Tudo" no Catálogo</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor:'var(--border)' }}>
            {(dash?.recentes||[]).map((a:any,i:number) => {
              const sc = STATUS_COR[a.status] || STATUS_COR.PENDENTE
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{a.titulo}</p>
                    <p className="text-[10px]" style={{ color:'var(--muted)' }}>{a.plataforma.replace('_VENDEDOR','')}</p>
                  </div>
                  <p className="text-xs font-black flex-shrink-0" style={{ color:'#f97316' }}>{fmtR(a.preco_venda)}</p>
                  <span className="text-[9px] px-2 py-0.5 rounded-full font-bold flex-shrink-0"
                    style={{ background:sc.bg, color:sc.cor }}>{a.status}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
