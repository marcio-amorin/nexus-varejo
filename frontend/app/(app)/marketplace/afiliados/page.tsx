'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Target, TrendingUp, DollarSign, Clock, Image, ShoppingBag, ArrowRight, Settings, Zap, Rocket, Package, CheckCircle, Send, AlertCircle } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'
const GRAD = 'linear-gradient(135deg,#ea580c 0%,#f97316 40%,#f59e0b 80%,#fbbf24 100%)'

function fmtR(v: any) { return (Number(v)||0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function hdr() { return { Authorization: `Bearer ${localStorage.getItem('nexus_token')}` } }

export default function AfiliadosPainel() {
  const router = useRouter()
  const [dash, setDash] = useState<any>(null)
  const [maq, setMaq] = useState<any>(null)
  const [pub, setPub] = useState(false)
  const [poster, setPoster] = useState<any>(null)
  const [posting, setPosting] = useState(false)
  const [publicados, setPublicados] = useState<any[]>([])

  function loadMaq() {
    fetch(`${API}/vendedor/auto-publish/status`, { headers: hdr() }).then(r => r.json()).then(setMaq).catch(() => {})
  }
  function loadPoster() {
    fetch(`${API}/afiliados/auto-poster/status`, { headers: hdr() }).then(r => r.json()).then(setPoster).catch(() => {})
  }
  function loadPublicados() {
    fetch(`${API}/afiliados/publicados`, { headers: hdr() }).then(r => r.json()).then(d => setPublicados(Array.isArray(d) ? d : [])).catch(() => {})
  }

  async function rodarAgora() {
    setPub(true)
    try {
      await fetch(`${API}/vendedor/auto-publish/rodar-agora`, { method: 'POST', headers: hdr() })
      loadMaq()
      loadPublicados()
    } catch {}
    setPub(false)
  }
  async function rodarPoster() {
    setPosting(true)
    try {
      await fetch(`${API}/afiliados/auto-poster/rodar-agora`, { method: 'POST', headers: hdr() })
      loadPoster()
    } catch {}
    setPosting(false)
  }

  useEffect(() => {
    fetch(`${API}/afiliados/dashboard`, { headers: hdr() }).then(r => r.json()).then(setDash).catch(() => {})
    loadMaq()
    loadPoster()
    loadPublicados()
  }, [])

  const kpis = dash?.kpis || {}
  const meta = dash?.meta_mes

  const cards = [
    { label: 'Comissão do Mês',  value: fmtR(kpis.comissao_mes || 0),        icon: DollarSign, cor: '#22c55e' },
    { label: 'Vendas no Mês',    value: String(kpis.vendas_mes || 0),        icon: TrendingUp, cor: '#f97316' },
    { label: 'Comissão a Receber', value: fmtR(kpis.comissao_receber || 0),  icon: Clock,      cor: '#f59e0b' },
    { label: 'Produtos Ativos',  value: String(kpis.total_produtos || 0),    icon: ShoppingBag,cor: '#3b82f6' },
  ]

  const atalhos = [
    { label: 'Meta Vendas',        desc: 'Plano IA para atingir R$20k/mês',   icon: Target,     cor: '#f97316', href: '/marketplace/afiliados/metas'      },
    { label: 'Catálogo Produtos',  desc: 'Buscar e salvar produtos afiliados', icon: ShoppingBag,cor: '#3b82f6', href: '/marketplace/afiliados/catalogo'   },
    { label: 'Criar Conteúdo IA',  desc: 'Posts automáticos para redes',       icon: Image,      cor: '#8b5cf6', href: '/marketplace/afiliados/conteudo'   },
    { label: 'Financeiro',         desc: 'Comissões e projeções',              icon: DollarSign, cor: '#22c55e', href: '/marketplace/afiliados/financeiro' },
    { label: 'Configurações',      desc: 'Vincular ML, Shopee, Instagram',     icon: Settings,   cor: '#38bdf8', href: '/marketplace/afiliados/config'     },
  ]

  return (
    <div className="pg" style={{ overflowY: 'auto' }}>
      {/* Header */}
      <div className="pg-header rounded-xl overflow-hidden" style={{ background: GRAD }}>
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-black text-white flex items-center gap-2">
              <Target size={16} /> Marketing de Afiliados
            </h1>
            <p className="text-xs text-white/75 mt-0.5">Plataforma completa — ML, Shopee, Amazon</p>
          </div>
          <button onClick={() => router.push('/marketplace/afiliados/config')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.35)' }}>
            <Settings size={13} /> Configurar
          </button>
        </div>
      </div>

      {/* Meta do mês */}
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
            Defina sua meta de vendas → receba um plano de IA personalizado
          </p>
          <ArrowRight size={13} color="#f59e0b" />
        </div>
      )}

      {/* Máquina de Vendas Automática (Auto-Publisher) */}
      <div className="pg-stats rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid #8b5cf640' }}>
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#8b5cf620' }}>
              <Rocket size={16} color="#8b5cf6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-white flex items-center gap-1.5">
                Máquina de Vendas Automática
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                  style={{ background: maq?.ativo ? '#22c55e20' : '#ef444420', color: maq?.ativo ? '#22c55e' : '#ef4444' }}>
                  {maq?.ativo ? '● ATIVA' : '○ PARADA'}
                </span>
              </p>
              <p className="text-[10px] truncate" style={{ color: 'var(--muted)' }}>
                Publica {maq?.regras?.qtd_dia ?? 10}/dia · comissão ≥ {maq?.regras?.comissao_min ?? 5}% · R$ {maq?.regras?.preco_min ?? 50}–{maq?.regras?.preco_max ?? 300}
              </p>
            </div>
          </div>
          <button onClick={rodarAgora} disabled={pub}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold flex-shrink-0"
            style={{ background: pub ? 'var(--card2)' : GRAD, color: '#fff', opacity: pub ? 0.6 : 1, cursor: pub ? 'wait' : 'pointer' }}>
            <Zap size={13} /> {pub ? 'Publicando...' : 'Publicar agora'}
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Publicados',     value: maq?.catalogo?.ja_publicados ?? 0,      cor: '#22c55e', icon: CheckCircle },
            { label: 'Pendentes',      value: maq?.catalogo?.pendentes_elegiveis ?? 0, cor: '#f59e0b', icon: Package },
            { label: 'Com erro',       value: maq?.catalogo?.com_erro ?? 0,           cor: '#ef4444', icon: Zap },
            { label: 'Catálogo ativo', value: maq?.catalogo?.total_ativos ?? 0,       cor: '#3b82f6', icon: ShoppingBag },
          ].map((s, i) => (
            <div key={i} className="rounded-lg p-2" style={{ background: 'var(--card2)' }}>
              <div className="flex items-center gap-1.5">
                <s.icon size={12} color={s.cor} />
                <p className="text-sm font-black" style={{ color: s.cor }}>{s.value}</p>
              </div>
              <p className="text-[9px] mt-0.5" style={{ color: 'var(--muted)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Auto-Poster nas Redes (Elo 2) */}
      <div className="pg-stats rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid #ec489940' }}>
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#ec489920' }}>
              <Send size={15} color="#ec4899" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-white flex items-center gap-1.5">
                Auto-Poster nas Redes
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                  style={{ background: (poster?.redes_conectadas?.length) ? '#22c55e20' : '#f59e0b20', color: (poster?.redes_conectadas?.length) ? '#22c55e' : '#f59e0b' }}>
                  {(poster?.redes_conectadas?.length) ? '● POSTANDO' : '○ CONECTE SUAS CONTAS'}
                </span>
              </p>
              <p className="text-[10px] truncate" style={{ color: 'var(--muted)' }}>
                {(poster?.redes_conectadas?.length)
                  ? `Postando em ${poster.redes_conectadas.join(', ')} · ${poster?.por_ciclo ?? 3}/ciclo · horários de pico`
                  : 'Gera posts com IA e publica sozinho — falta conectar Instagram/Facebook'}
              </p>
            </div>
          </div>
          {(poster?.redes_conectadas?.length)
            ? <button onClick={rodarPoster} disabled={posting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold flex-shrink-0"
                style={{ background: posting ? 'var(--card2)' : 'linear-gradient(135deg,#ec4899,#8b5cf6)', color: '#fff', opacity: posting ? 0.6 : 1, cursor: posting ? 'wait' : 'pointer' }}>
                <Send size={12} /> {posting ? 'Postando...' : 'Postar agora'}
              </button>
            : <button onClick={() => router.push('/marketplace/afiliados/config')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#ec4899,#8b5cf6)', color: '#fff' }}>
                <AlertCircle size={12} /> Conectar contas
              </button>}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Posts publicados',   value: poster?.conteudos_postados ?? 0,                     cor: '#22c55e', icon: CheckCircle },
            { label: 'Na fila (prontos)',  value: poster?.conteudos_prontos_aguardando_conexao ?? 0,   cor: '#f59e0b', icon: Package },
            { label: 'Redes conectadas',   value: poster?.redes_conectadas?.length ?? 0,               cor: '#ec4899', icon: Send },
          ].map((s, i) => (
            <div key={i} className="rounded-lg p-2" style={{ background: 'var(--card2)' }}>
              <div className="flex items-center gap-1.5">
                <s.icon size={12} color={s.cor} />
                <p className="text-sm font-black" style={{ color: s.cor }}>{s.value}</p>
              </div>
              <p className="text-[9px] mt-0.5" style={{ color: 'var(--muted)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

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

      {/* Body — grid responsivo via Tailwind (CSS mobile override faz 1 coluna) */}
      <div className="grid grid-cols-2 gap-2" style={{ minHeight: 360, flexShrink: 0 }}>

        {/* Acesso rápido */}
        <div className="rounded-xl flex flex-col" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
            <p className="text-[10px] font-black tracking-widest" style={{ color: 'var(--muted)' }}>ACESSO RÁPIDO</p>
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

        {/* Top produtos */}
        <div className="rounded-xl flex flex-col" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="px-4 py-3 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
            <p className="text-[10px] font-black tracking-widest" style={{ color: 'var(--muted)' }}>PRODUTOS PUBLICADOS PELA MÁQUINA {publicados.length ? `(${publicados.length})` : ''}</p>
            <button onClick={() => router.push('/marketplace/afiliados/catalogo')}
              className="text-[10px] font-bold flex items-center gap-1" style={{ color: '#f97316' }}>
              Ver todos <ArrowRight size={10} />
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            {publicados.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 py-8" style={{ color: 'var(--muted)' }}>
                <Rocket size={28} />
                <p className="text-xs">A máquina ainda não publicou nada</p>
                <button onClick={rodarAgora} disabled={pub} className="btn-primary text-xs px-4 py-2">
                  {pub ? 'Publicando...' : 'Publicar agora'}
                </button>
              </div>
            ) : publicados.map((p: any, i: number) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
                {p.imagem_url
                  ? <img src={p.imagem_url} className="w-8 h-8 object-contain rounded-md flex-shrink-0" style={{ background: 'var(--card2)' }} />
                  : <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: 'var(--card2)' }}><ShoppingBag size={14} color="var(--muted)" /></div>}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate text-white">{p.titulo}</p>
                  <p className="text-[10px] flex items-center gap-1" style={{ color: 'var(--muted)' }}>
                    <span className="font-bold" style={{ color: '#22c55e' }}>✓ publicado</span> · {p.comissao_pct}% · R$ {(p.preco || 0).toFixed(0)}
                  </p>
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
