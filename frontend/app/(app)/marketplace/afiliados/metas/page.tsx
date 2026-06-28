'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Target, Zap, ShoppingBag, CheckCircle, RefreshCw, TrendingUp, Calendar, Award, ArrowRight, BarChart3 } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'
const GRAD = 'linear-gradient(135deg,#ea580c 0%,#f97316 40%,#f59e0b 80%,#fbbf24 100%)'

function fmtR(v: number) { return (Number(v)||0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function hdr() { return { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('nexus_token')}` } }

const CAT_COR: Record<string, string> = {
  'Celulares':'#8b5cf6','Eletrodomesticos':'#f59e0b','Eletrodomésticos':'#f59e0b',
  'Audio':'#3b82f6','Áudio':'#3b82f6','Calcados':'#ec4899','Calçados':'#ec4899',
  'Roupas':'#f43f5e','Beleza':'#a855f7','Informatica':'#06b6d4','Informática':'#06b6d4',
  'Games':'#22c55e','Smartwatches':'#f97316','Acessorios':'#94a3b8','Acessórios':'#94a3b8',
  'Esporte':'#10b981','TV & Video':'#6366f1','TV & Vídeo':'#6366f1','Outros':'#475569',
}
function catCor(c: string) { return CAT_COR[c] || '#f97316' }

export default function MetaVendas() {
  const router = useRouter()
  const hoje = new Date()
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`

  const [metaRenda, setMetaRenda] = useState('20000')
  const [mesAno, setMesAno]       = useState(mesAtual)
  const [metas, setMetas]         = useState<any[]>([])
  const [opors, setOpors]         = useState<any[]>([])
  const [estrategia, setEstrategia] = useState<any>(null)
  const [loading, setLoading]     = useState(false)
  const [salvando, setSalvando]   = useState(false)
  const [salvou, setSalvou]       = useState(false)
  const [aba, setAba]             = useState<'roadmap'|'produtos'|'historico'>('roadmap')
  const [checados, setChecados]   = useState<Set<number>>(new Set())
  const [editandoMeta, setEditandoMeta] = useState(false)

  useEffect(() => { carregarMetas(); escanear() }, [])

  async function carregarMetas() {
    try {
      const r = await fetch(`${API}/afiliados/metas`, { headers: hdr() })
      const d = await r.json()
      setMetas(d)
      const ma = d.find((m: any) => m.mes_ano === mesAtual)
      if (ma) setMetaRenda(String(ma.meta_renda))
    } catch {}
  }

  async function escanear(meta?: number) {
    setLoading(true)
    const v = meta || parseFloat(metaRenda) || 20000
    try {
      const r = await fetch(`${API}/afiliados/top-oportunidades?meta_renda=${v}`, { headers: hdr() })
      const d = await r.json()
      setOpors(d.oportunidades || [])
      setEstrategia(d.estrategia || null)
    } catch {}
    setLoading(false)
  }

  async function salvarMeta() {
    setSalvando(true)
    try {
      await fetch(`${API}/afiliados/metas`, {
        method: 'POST', headers: hdr(),
        body: JSON.stringify({ mes_ano: mesAno, meta_renda: parseFloat(metaRenda) })
      })
    } catch {}
    setSalvando(false); setSalvou(true); setEditandoMeta(false)
    setTimeout(() => setSalvou(false), 2000)
    carregarMetas(); escanear(parseFloat(metaRenda))
  }

  async function salvarProduto(p: any) {
    try { await fetch(`${API}/afiliados/catalogo`, { method: 'POST', headers: hdr(), body: JSON.stringify(p) }) } catch {}
  }

  const metaNum   = parseFloat(metaRenda) || 20000
  const mesAtualMeta = metas.find(m => m.mes_ano === mesAtual)
  const realizado = mesAtualMeta?.realizado_renda || 0
  const pct       = Math.min(100, Math.round(realizado / metaNum * 100))

  function toggleCheck(i: number) {
    setChecados(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n })
  }

  return (
    <div className="pg">
      {/* Header */}
      <div className="pg-header rounded-xl overflow-hidden" style={{ background: GRAD }}>
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-black text-white flex items-center gap-2"><Target size={16}/> Meta Vendas IA</h1>
            <p className="text-xs text-white/75 mt-0.5">Estratégia inteligente para atingir sua renda mensal</p>
          </div>
          <div className="flex items-center gap-2">
            {editandoMeta ? (
              <div className="flex items-center gap-1.5">
                <input type="number" value={metaRenda} onChange={e => setMetaRenda(e.target.value)}
                  className="w-28 text-sm font-black px-2 py-1.5 rounded-lg text-center"
                  style={{ background:'rgba(255,255,255,0.2)', color:'#fff', border:'1px solid rgba(255,255,255,0.4)' }}/>
                <button onClick={salvarMeta} disabled={salvando}
                  className="px-3 py-1.5 rounded-lg text-xs font-black text-white"
                  style={{ background:'rgba(34,197,94,0.5)', border:'1px solid rgba(34,197,94,0.7)' }}>
                  {salvando ? '...' : salvou ? '✓' : 'OK'}
                </button>
                <button onClick={() => setEditandoMeta(false)}
                  className="px-2 py-1.5 rounded-lg text-xs font-bold text-white/70">✕</button>
              </div>
            ) : (
              <button onClick={() => setEditandoMeta(true)}
                className="text-right cursor-pointer"
                style={{ background:'none', border:'none', padding:0 }}>
                <p className="text-white/60 text-[10px]">Meta mensal</p>
                <p className="text-white font-black text-base">{fmtR(metaNum)}</p>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Progresso do mês */}
      <div className="pg-stats rounded-xl p-3" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-[10px] font-black tracking-widest" style={{ color:'var(--muted)' }}>PROGRESSO — {mesAtual.replace('-','/')}</p>
            <p className="text-xs font-bold text-white mt-0.5">
              {fmtR(realizado)} <span style={{ color:'var(--muted)', fontWeight:400 }}>de</span> {fmtR(metaNum)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black" style={{ color: pct >= 100 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#f97316' }}>{pct}%</p>
            <p className="text-[9px]" style={{ color:'var(--muted)' }}>da meta</p>
          </div>
        </div>
        <div className="w-full rounded-full h-2.5 overflow-hidden" style={{ background:'var(--card2)' }}>
          <div className="h-2.5 rounded-full transition-all duration-500"
            style={{ width:`${pct}%`, background: pct>=100 ? '#22c55e' : GRAD }}/>
        </div>
        <div className="flex justify-between mt-1.5">
          <p className="text-[9px]" style={{ color:'var(--muted)' }}>Falta: {fmtR(Math.max(0, metaNum - realizado))}</p>
          {estrategia && <p className="text-[9px]" style={{ color:'var(--muted)' }}>Meta/dia: {fmtR(estrategia.meta_dia)}</p>}
        </div>
      </div>

      {/* Abas */}
      <div className="pg-stats flex gap-1">
        {([['roadmap','🗺️ Roadmap IA'],['produtos',`🛍️ Produtos (${opors.length})`],['historico','📊 Histórico']] as [string,string][]).map(([v,l]) => (
          <button key={v} onClick={() => setAba(v as any)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background:aba===v?GRAD:'var(--card2)', color:aba===v?'#fff':'var(--muted)', border:aba===v?'none':'1px solid var(--border)' }}>
            {l}
          </button>
        ))}
        <button onClick={() => escanear(metaNum)} disabled={loading}
          className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold text-white"
          style={{ background:'var(--card2)', border:'1px solid var(--border)' }}>
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''}/> Atualizar
        </button>
      </div>

      <div className="pg-body p-3 space-y-3">

        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color:'var(--muted)' }}>
            <RefreshCw size={32} color="#f97316" className="animate-spin"/>
            <p className="text-sm font-bold text-white">IA analisando seu portfólio...</p>
            <p className="text-xs">Calculando a melhor rota para R$ {fmtR(metaNum)}</p>
          </div>
        )}

        {/* ── ABA ROADMAP ─────────────────────────────────────────────────── */}
        {!loading && aba === 'roadmap' && estrategia && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { label:'Meta/Mês',     value: fmtR(estrategia.meta),           cor:'#f97316', icon: Target   },
                { label:'Vendas/Dia',   value: String(estrategia.vendas_dia),    cor:'#3b82f6', icon: TrendingUp },
                { label:'Cliques/Dia',  value: (estrategia.cliques_dia||0).toLocaleString('pt-BR'), cor:'#8b5cf6', icon: BarChart3 },
                { label:'Posts/Dia',    value: String(estrategia.posts_dia),     cor:'#ec4899', icon: Zap      },
              ].map((k,i) => (
                <div key={i} className="rounded-xl p-2.5 text-center" style={{ background:'var(--card)', border:`1px solid ${k.cor}25` }}>
                  <k.icon size={14} color={k.cor} className="mx-auto mb-1"/>
                  <p className="text-base font-black" style={{ color:k.cor }}>{k.value}</p>
                  <p className="text-[9px]" style={{ color:'var(--muted)' }}>{k.label}</p>
                </div>
              ))}
            </div>

            {/* Fórmula */}
            <div className="rounded-xl p-3" style={{ background:'var(--card)', border:'1px solid #f97316' }}>
              <p className="text-[9px] font-black mb-2 tracking-widest" style={{ color:'#f97316' }}>📈 FÓRMULA DA META</p>
              <div className="flex items-center justify-around text-center gap-2">
                <div>
                  <p className="text-lg font-black" style={{ color:'#fbbf24' }}>{fmtR(estrategia.meta_dia || estrategia.meta/30)}</p>
                  <p className="text-[9px]" style={{ color:'var(--muted)' }}>por dia</p>
                </div>
                <p className="text-lg font-black" style={{ color:'var(--muted)' }}>=</p>
                <div>
                  <p className="text-base font-black" style={{ color:'#60a5fa' }}>{estrategia.vendas_dia} vendas</p>
                  <p className="text-[9px]" style={{ color:'var(--muted)' }}>× {fmtR(estrategia.ticket_medio_com)} comissão</p>
                </div>
                <p className="text-lg font-black" style={{ color:'var(--muted)' }}>=</p>
                <div>
                  <p className="text-base font-black" style={{ color:'#22c55e' }}>{fmtR(estrategia.meta)}</p>
                  <p className="text-[9px]" style={{ color:'var(--muted)' }}>por mês</p>
                </div>
              </div>
            </div>

            {/* Milestones — 4 semanas */}
            <div className="rounded-xl overflow-hidden" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
              <div className="px-3 py-2" style={{ borderBottom:'1px solid var(--border)' }}>
                <p className="text-[9px] font-black tracking-widest" style={{ color:'var(--muted)' }}>📅 ROADMAP 4 SEMANAS</p>
              </div>
              <div className="p-2 space-y-1.5">
                {(estrategia.milestones||[]).map((m:any, i:number) => (
                  <div key={i} className="flex items-start gap-2.5 p-2 rounded-xl"
                    style={{ background: i===3 ? 'rgba(34,197,94,0.08)' : 'var(--card2)', border:`1px solid ${i===3?'rgba(34,197,94,0.25)':'transparent'}` }}>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-black text-white"
                      style={{ background: i===0?'#475569':i===1?'#f59e0b':i===2?'#f97316':'#22c55e' }}>
                      S{m.semana}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-[10px] font-black" style={{ color: i===3?'#22c55e':'var(--fg)' }}>{fmtR(m.meta_parcial)}</p>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                          style={{ background:i===3?'rgba(34,197,94,0.15)':'rgba(249,115,22,0.15)', color:i===3?'#22c55e':'#f97316' }}>
                          {m.pct}% da meta
                        </span>
                      </div>
                      <p className="text-[9px] leading-relaxed" style={{ color:'var(--muted)' }}>{m.acao}</p>
                    </div>
                    {i===3 && <Award size={16} color="#22c55e" className="flex-shrink-0 mt-0.5"/>}
                  </div>
                ))}
              </div>
            </div>

            {/* Top produtos para focar */}
            <div className="rounded-xl overflow-hidden" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
              <div className="px-3 py-2" style={{ borderBottom:'1px solid var(--border)' }}>
                <p className="text-[9px] font-black tracking-widest" style={{ color:'var(--muted)' }}>🛍️ PORTFÓLIO — PRODUTOS PARA FOCAR</p>
              </div>
              {(estrategia.plano_produtos||[]).map((p:any, i:number) => (
                <div key={i} className="flex items-center gap-2.5 px-3 py-2.5" style={{ borderBottom:'1px solid var(--border)' }}>
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-black text-white"
                    style={{ background: i===0?'linear-gradient(135deg,#f97316,#fbbf24)':i===1?'linear-gradient(135deg,#7c3aed,#a855f7)':'var(--card2)', color:i>1?'var(--muted)':undefined }}>
                    {i+1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-white truncate">{p.produto}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold"
                        style={{ background:catCor(p.categoria)+'20', color:catCor(p.categoria) }}>
                        {p.categoria}
                      </span>
                      <span className="text-[9px]" style={{ color:'var(--muted)' }}>{p.vendas_necessarias} vendas/mês</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-black" style={{ color:'#22c55e' }}>{fmtR(p.comissao)}/venda</p>
                    <p className="text-[9px]" style={{ color:'#f97316' }}>{fmtR(p.renda_gerada)}/mês</p>
                  </div>
                </div>
              ))}
              {estrategia.renda_projetada > 0 && (
                <div className="flex items-center justify-between px-3 py-2.5"
                  style={{ background:'rgba(34,197,94,0.08)', borderTop:'1px solid rgba(34,197,94,0.2)' }}>
                  <p className="text-xs font-black" style={{ color:'#22c55e' }}>Total projetado</p>
                  <p className="text-sm font-black" style={{ color:'#22c55e' }}>{fmtR(estrategia.renda_projetada)}/mês</p>
                </div>
              )}
            </div>

            {/* Checklist rotina diária */}
            <div className="rounded-xl overflow-hidden" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
              <div className="px-3 py-2" style={{ borderBottom:'1px solid var(--border)' }}>
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-black tracking-widest" style={{ color:'var(--muted)' }}>✅ ROTINA DIÁRIA — CHECKLIST</p>
                  <span className="text-[9px] font-bold" style={{ color:'#22c55e' }}>{checados.size}/{(estrategia.acoes_diarias||[]).length}</span>
                </div>
              </div>
              <div className="p-2 space-y-1">
                {(estrategia.acoes_diarias||[]).map((a:string, i:number) => (
                  <button key={i} onClick={() => toggleCheck(i)}
                    className="w-full flex items-start gap-2.5 p-2 rounded-xl text-left"
                    style={{ background: checados.has(i) ? 'rgba(34,197,94,0.08)' : 'transparent', border:`1px solid ${checados.has(i)?'rgba(34,197,94,0.2)':'transparent'}` }}>
                    <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: checados.has(i) ? '#22c55e' : 'var(--card2)', border:`1px solid ${checados.has(i)?'#22c55e':'var(--border)'}` }}>
                      {checados.has(i) && <CheckCircle size={10} color="#fff"/>}
                    </div>
                    <p className="text-[10px] leading-relaxed" style={{ color: checados.has(i) ? 'var(--muted)' : 'var(--fg)', textDecoration: checados.has(i) ? 'line-through' : 'none' }}>
                      {a}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {!loading && aba === 'roadmap' && !estrategia && (
          <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color:'var(--muted)' }}>
            <Target size={40}/>
            <p className="text-sm font-bold text-white">Gerando plano IA...</p>
            <button onClick={() => escanear(metaNum)} className="btn-primary text-xs px-5 py-2 flex items-center gap-1.5">
              <Zap size={13}/> Gerar Estratégia
            </button>
          </div>
        )}

        {/* ── ABA PRODUTOS ─────────────────────────────────────────────────── */}
        {!loading && aba === 'produtos' && (
          <>
            {opors.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color:'var(--muted)' }}>
                <ShoppingBag size={36}/>
                <p className="text-xs">Nenhum produto encontrado</p>
                <button onClick={() => router.push('/marketplace/afiliados/catalogo')} className="btn-primary text-xs px-4 py-2">
                  Ir ao Catálogo
                </button>
              </div>
            ) : (
              <>
                <p className="text-[10px]" style={{ color:'var(--muted)' }}>
                  {opors.length} produtos ordenados por potencial mensal de comissão
                </p>
                <div className="grid gap-2" style={{ gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))' }}>
                  {opors.map((p, i) => (
                    <div key={i} className="rounded-xl overflow-hidden" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
                      <div className="relative flex items-center justify-center p-2" style={{ background:'var(--card2)', height:80 }}>
                        {p.imagem_url
                          ? <img src={p.imagem_url} className="max-h-full object-contain"/>
                          : <ShoppingBag size={24} color="var(--muted)"/>}
                        <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white"
                          style={{ background: i<3?'#f97316':i<10?'#7c3aed':'#475569' }}>{i+1}</div>
                        <span className="absolute bottom-1.5 left-1.5 text-[8px] px-1 py-0.5 rounded font-bold"
                          style={{ background:catCor(p.categoria_nome)+'25', color:catCor(p.categoria_nome) }}>
                          {p.categoria_nome}
                        </span>
                      </div>
                      <div className="p-2">
                        <p className="text-[9px] font-bold leading-tight mb-1.5 text-white"
                          style={{ display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                          {p.titulo}
                        </p>
                        <div className="grid grid-cols-2 gap-1 mb-1.5">
                          <div className="rounded-lg p-1 text-center" style={{ background:'var(--card2)' }}>
                            <p className="text-[10px] font-black" style={{ color:'#22c55e' }}>{fmtR(p.comissao_valor)}</p>
                            <p className="text-[8px]" style={{ color:'var(--muted)' }}>por venda</p>
                          </div>
                          <div className="rounded-lg p-1 text-center" style={{ background:'var(--card2)' }}>
                            <p className="text-[10px] font-black" style={{ color:'#f97316' }}>{p.comissao_pct}%</p>
                            <p className="text-[8px]" style={{ color:'var(--muted)' }}>comissão</p>
                          </div>
                        </div>
                        {p.ganho_mensal_pot > 0 && (
                          <div className="rounded-lg px-1.5 py-1 text-center mb-1.5"
                            style={{ background:'rgba(124,58,237,0.1)', border:'1px solid rgba(124,58,237,0.2)' }}>
                            <p className="text-[8px]" style={{ color:'var(--muted)' }}>Potencial/mês</p>
                            <p className="text-[10px] font-black" style={{ color:'#a855f7' }}>{fmtR(p.ganho_mensal_pot)}</p>
                          </div>
                        )}
                        <button onClick={() => salvarProduto(p)}
                          className="w-full py-1.5 rounded-lg text-[9px] font-black text-white" style={{ background:GRAD }}>
                          + Salvar no Catálogo
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* ── ABA HISTÓRICO ────────────────────────────────────────────────── */}
        {!loading && aba === 'historico' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
              <div className="flex-1">
                <input type="month" value={mesAno} onChange={e => setMesAno(e.target.value)}
                  className="text-xs px-2 py-1.5 rounded-lg mr-2"/>
                <input type="number" value={metaRenda} onChange={e => setMetaRenda(e.target.value)}
                  placeholder="20000" className="w-24 text-xs px-2 py-1.5 rounded-lg"/>
              </div>
              <button onClick={salvarMeta} disabled={salvando}
                className="px-3 py-1.5 rounded-lg text-xs font-black text-white flex items-center gap-1"
                style={{ background: GRAD }}>
                <Calendar size={11}/> {salvando ? '...' : salvou ? 'Salvo!' : 'Salvar Meta'}
              </button>
            </div>
            {metas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color:'var(--muted)' }}>
                <Target size={32}/><p className="text-sm">Nenhuma meta registrada</p>
              </div>
            ) : metas.map((m: any, i: number) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
                <p className="text-xs font-black text-white w-16 flex-shrink-0">{m.mes_ano}</p>
                <div className="flex-1">
                  <div className="w-full rounded-full h-1.5 mb-1" style={{ background:'var(--card2)' }}>
                    <div className="h-1.5 rounded-full" style={{ width:`${Math.min(m.pct,100)}%`, background:GRAD }}/>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[10px]" style={{ color:'var(--muted)' }}>{fmtR(m.realizado_renda)}</span>
                    <span className="text-[10px]" style={{ color:'var(--muted)' }}>{fmtR(m.meta_renda)}</span>
                  </div>
                </div>
                <p className="text-sm font-black flex-shrink-0" style={{ color:m.pct>=100?'#22c55e':'#f97316' }}>{m.pct}%</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
