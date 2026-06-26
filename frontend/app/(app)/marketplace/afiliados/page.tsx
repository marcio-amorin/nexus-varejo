'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Target, TrendingUp, DollarSign, Clock, Image, ShoppingBag, ArrowRight, Settings, Zap } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'
const GRAD = 'linear-gradient(135deg,#ea580c 0%,#f97316 40%,#f59e0b 80%,#fbbf24 100%)'

function fmtR(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function hdr() { return { Authorization: `Bearer ${localStorage.getItem('nexus_token')}` } }

export default function AfiliadosPainel() {
  const router = useRouter()
  const [dash, setDash] = useState<any>(null)

  useEffect(() => {
    fetch(`${API}/afiliados/dashboard`, { headers: hdr() }).then(r => r.json()).then(setDash).catch(() => {})
  }, [])

  const kpis = dash?.kpis || {}
  const meta = dash?.meta_mes

  const cards = [
    { label: 'ComissÃµes do MÃªs', value: fmtR(kpis.comissao_mes || 0),      icon: DollarSign, cor: '#22c55e' },
    { label: 'A Receber',        value: fmtR(kpis.comissao_pendente || 0),  icon: Clock,      cor: '#f59e0b' },
    { label: 'Produtos Ativos',  value: String(kpis.total_produtos || 0),   icon: ShoppingBag,cor: '#3b82f6' },
    { label: 'ConteÃºdos Pub.',   value: String(kpis.conteudos_publicados||0),icon: Image,     cor: '#8b5cf6' },
  ]

  const atalhos = [
    { label: 'Meta Vendas',       desc: 'Plano IA para atingir R$20k/mÃªs',  icon: Target,     cor: '#f97316', href: '/marketplace/afiliados/metas'      },
    { label: 'CatÃ¡logo Produtos', desc: 'Buscar e salvar produtos afiliados',icon: ShoppingBag,cor: '#3b82f6', href: '/marketplace/afiliados/catalogo'   },
    { label: 'Criar ConteÃºdo IA', desc: 'Posts automÃ¡ticos para redes',      icon: Image,      cor: '#8b5cf6', href: '/marketplace/afiliados/conteudo'   },
    { label: 'Financeiro',        desc: 'ComissÃµes e projeÃ§Ãµes',             icon: DollarSign, cor: '#22c55e', href: '/marketplace/afiliados/financeiro' },
    { label: 'ConfiguraÃ§Ãµes',     desc: 'Vincular ML, Shopee, Instagram',    icon: Settings,   cor: '#38bdf8', href: '/marketplace/afiliados/config'     },
  ]

  return (
    <div className="pg">
      {/* Header */}
      <div className="pg-header rounded-xl overflow-hidden" style={{ background: GRAD }}>
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-black text-white flex items-center gap-2">
              <Target size={16} /> Marketing de Afiliados
            </h1>
            <p className="text-xs text-white/75 mt-0.5">Plataforma completa â€” ML, Shopee, Amazon</p>
          </div>
          <button onClick={() => router.push('/marketplace/afiliados/config')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.35)' }}>
            <Settings size={13} /> Configurar
          </button>
        </div>
      </div>

      {/* Meta do mÃªs */}
      {meta ? (
        <div className="pg-stats rounded-xl p-4 flex items-center gap-4 cursor-pointer"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          onClick={() => router.push('/marketplace/afiliados/metas')}>
          <Target size={20} color="#f97316" className="flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex justify-between mb-1">
              <span className="text-xs font-bold text-white">META {meta.mes_ano}</span>
              <span className="text-xs font-black" style={{ color: '#f97316' }}>{meta.pct}%</span>
            </div>
            <div className="w-full rounded-full h-1.5" style={{ background: 'var(--card2)' }}>
              <div className="h-1.5 rounded-full" style={{ width: `${Math.min(meta.pct, 100)}%`, background: GRAD }} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px]" style={{ color: 'var(--muted)' }}>Realizado: {fmtR(meta.realizado || 0)}</span>
              <span className="text-[10px]" style={{ color: 'var(--muted)' }}>Meta: {fmtR(meta.meta_renda)}</span>
            </div>
          </div>
          <ArrowRight size={14} color="var(--muted)" className="flex-shrink-0" />
        </div>
      ) : (
        <div className="pg-stats rounded-xl p-3 flex items-center gap-3 cursor-pointer"
          style={{ background: 'var(--card)', border: '1px dashed #f59e0b' }}
          onClick={() => router.push('/marketplace/afiliados/metas')}>
          <Zap size={16} color="#f59e0b" className="flex-shrink-0" />
          <p className="text-xs font-bold flex-1" style={{ color: '#f59e0b' }}>
            Defina sua meta de vendas â†’ receba um plano de IA personalizado
          </p>
          <ArrowRight size={13} color="#f59e0b" />
        </div>
      )}

      {/* KPIs */}
      <div className="pg-stats grid grid-cols-4 gap-2">
        {cards.map((c, i) => (
          <div key={i} className="rounded-xl p-3" style={{ background: 'var(--card)', border: `1px solid ${c.cor}30` }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: c.cor + '20' }}>
                <c.icon size={14} color={c.cor} />
              </div>
            </div>
            <p className="text-lg font-black" style={{ color: c.cor }}>{c.value}</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>{c.label}</p>
          </div>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 grid gap-2 min-h-0" style={{ gridTemplateColumns: '1fr 1fr' }}>

        {/* Acesso rÃ¡pido */}
        <div className="rounded-xl flex flex-col min-h-0" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
            <p className="text-[10px] font-black tracking-widest" style={{ color: 'var(--muted)' }}>ACESSO RÃPIDO</p>
          </div>
          <div className="flex-1 overflow-auto p-2 space-y-1">
            {atalhos.map((a, i) => (
              <button key={i} onClick={() => router.push(a.href)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all hover:opacity-80"
                style={{ background: 'var(--card2)', border: `1px solid ${a.cor}25` }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: a.cor + '20' }}>
                  <a.icon size={14} color={a.cor} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate text-white">{a.label}</p>
                  <p className="text-[10px] truncate" style={{ color: 'var(--muted)' }}>{a.desc}</p>
                </div>
                <ArrowRight size={12} color="var(--muted)" />
              </button>
            ))}
          </div>
        </div>

        {/* Top produtos + comissÃµes recentes */}
        <div className="rounded-xl flex flex-col min-h-0" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="px-4 py-3 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
            <p className="text-[10px] font-black tracking-widest" style={{ color: 'var(--muted)' }}>TOP PRODUTOS â€” MAIOR COMISSÃƒO</p>
            <button onClick={() => router.push('/marketplace/afiliados/catalogo')}
              className="text-[10px] font-bold flex items-center gap-1" style={{ color: '#f97316' }}>
              Ver todos <ArrowRight size={10} />
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            {(dash?.top_produtos || []).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: 'var(--muted)' }}>
                <ShoppingBag size={28} />
                <p className="text-xs">Adicione produtos ao catÃ¡logo</p>
                <button onClick={() => router.push('/marketplace/afiliados/catalogo')} className="btn-primary text-xs px-4 py-2">
                  Buscar Produtos
                </button>
              </div>
            ) : (dash.top_produtos || []).map((p: any, i: number) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
                {p.imagem_url
                  ? <img src={p.imagem_url} className="w-8 h-8 object-contain rounded-md flex-shrink-0" style={{ background: 'var(--card2)' }} />
                  : <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: 'var(--card2)' }}><ShoppingBag size={14} color="var(--muted)" /></div>}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate text-white">{p.titulo}</p>
                  <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{p.plataforma} Â· {p.comissao_pct}%</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-black" style={{ color: '#22c55e' }}>R$ {p.comissao_valor?.toFixed(2)}</p>
                  <p className="text-[10px]" style={{ color: 'var(--muted)' }}>por venda</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

