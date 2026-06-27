'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Target, Zap, ShoppingBag, CheckCircle, RefreshCw, Settings, ArrowRight } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'
const GRAD = 'linear-gradient(135deg,#ea580c 0%,#f97316 40%,#f59e0b 80%,#fbbf24 100%)'

function fmtR(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function hdr() { return { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('nexus_token')}` } }

const CATS_COR: Record<string, string> = {
  'Eletrônicos': '#3b82f6', 'Celulares': '#8b5cf6', 'Computadores': '#0891b2',
  'Moda': '#ec4899', 'Beleza': '#f43f5e', 'Esportes': '#22c55e',
  'Casa': '#f59e0b', 'Bebês': '#a78bfa', 'Ferramentas': '#94a3b8', 'Jogos': '#06b6d4',
}

export default function MetaVendas() {
  const router = useRouter()
  const hoje = new Date()
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`

  const [metaRenda, setMetaRenda]   = useState('20000')
  const [mesAno, setMesAno]         = useState(mesAtual)
  const [metas, setMetas]           = useState<any[]>([])
  const [opors, setOpors]           = useState<any[]>([])
  const [estrategia, setEstrategia] = useState<any>(null)
  const [loadingOp, setLoadingOp]   = useState(false)
  const [salvando, setSalvando]     = useState(false)
  const [precisaConfig, setPrecisa] = useState(false)
  const [aba, setAba]               = useState<'estrategia'|'oportunidades'|'historico'>('estrategia')
  const [salvou, setSalvou]         = useState(false)

  useEffect(() => { carregarMetas(); buscarOp() }, [])

  async function carregarMetas() {
    try {
      const r = await fetch(`${API}/afiliados/metas`, { headers: hdr() })
      const d = await r.json()
      setMetas(d)
      const ma = d.find((m: any) => m.mes_ano === mesAtual)
      if (ma) setMetaRenda(String(ma.meta_renda))
    } catch {}
  }

  async function buscarOp(meta?: number) {
    setLoadingOp(true); setPrecisa(false)
    const v = meta || parseFloat(metaRenda) || 20000
    try {
      const r = await fetch(`${API}/afiliados/top-oportunidades?meta_renda=${v}`, { headers: hdr() })
      const d = await r.json()
      if (d.precisa_config) { setPrecisa(true); setLoadingOp(false); return }
      setOpors(d.oportunidades || [])
      setEstrategia(d.estrategia || null)
    } catch {}
    setLoadingOp(false)
  }

  async function salvarMeta() {
    setSalvando(true)
    try {
      await fetch(`${API}/afiliados/metas`, { method: 'POST', headers: hdr(), body: JSON.stringify({ mes_ano: mesAno, meta_renda: parseFloat(metaRenda) }) })
    } catch {}
    setSalvando(false); setSalvou(true); setTimeout(() => setSalvou(false), 2000)
    carregarMetas(); buscarOp(parseFloat(metaRenda))
  }

  async function salvarProduto(p: any) {
    try { await fetch(`${API}/afiliados/catalogo`, { method: 'POST', headers: hdr(), body: JSON.stringify(p) }) } catch {}
  }

  return (
    <div className="pg">
      {/* Header */}
      <div className="pg-header rounded-xl overflow-hidden" style={{ background: GRAD }}>
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-black text-white flex items-center gap-2"><Target size={16}/> Meta Vendas</h1>
            <p className="text-xs text-white/75 mt-0.5">IA analisa o mercado e monta o plano para atingir sua meta</p>
          </div>
          <div className="text-right">
            <p className="text-white/60 text-[10px]">Meta mensal</p>
            <p className="text-white font-black text-base">{fmtR(parseFloat(metaRenda)||20000)}</p>
          </div>
        </div>
      </div>

      {/* Controles */}
      <div className="pg-stats rounded-xl p-3 flex flex-wrap gap-2 items-end"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div>
          <p className="text-[10px] font-bold mb-1" style={{ color: 'var(--muted)' }}>META (R$)</p>
          <input type="number" value={metaRenda} onChange={e => setMetaRenda(e.target.value)}
            className="w-32 text-sm font-black px-3 py-2 rounded-lg" placeholder="20000" />
        </div>
        <div>
          <p className="text-[10px] font-bold mb-1" style={{ color: 'var(--muted)' }}>MÊS</p>
          <input type="month" value={mesAno} onChange={e => setMesAno(e.target.value)}
            className="text-sm px-3 py-2 rounded-lg" />
        </div>
        <button onClick={salvarMeta} disabled={salvando}
          className="px-4 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-1.5"
          style={{ background: 'var(--card2)', border: '1px solid var(--border)' }}>
          {salvando ? <RefreshCw size={12} className="animate-spin"/> : <Target size={12}/>}
          {salvou ? 'Salvo!' : 'Salvar'}
        </button>
        <button onClick={() => buscarOp(parseFloat(metaRenda))} disabled={loadingOp}
          className="btn-primary flex-1 py-2 flex items-center justify-center gap-1.5 text-xs" style={{ minWidth: 180 }}>
          {loadingOp
            ? <><RefreshCw size={13} className="animate-spin"/> Analisando mercado...</>
            : <><Zap size={13}/> Escanear Melhores Oportunidades</>}
        </button>
      </div>

      {precisaConfig && (
        <div className="pg-stats rounded-xl p-3 flex items-center gap-3 cursor-pointer"
          style={{ background: 'var(--card)', border: '1px dashed #f59e0b' }}
          onClick={() => router.push('/marketplace/afiliados/config')}>
          <Settings size={16} color="#f59e0b"/>
          <div className="flex-1">
            <p className="text-xs font-bold" style={{ color: '#f59e0b' }}>Conecte o Mercado Livre para ver as oportunidades</p>
            <p className="text-[10px]" style={{ color: 'var(--muted)' }}>Clique &rarr; Configurações &rarr; Conectar ML (3 minutos)</p>
          </div>
          <ArrowRight size={13} color="#f59e0b"/>
        </div>
      )}

      {/* Abas */}
      {(opors.length > 0 || estrategia) && (
        <div className="pg-stats flex gap-1">
          {([['estrategia','🎯 Plano'],['oportunidades',`🛍️ Top ${opors.length}`],['historico','📊 Histórico']] as [string,string][]).map(([v,l]) => (
            <button key={v} onClick={() => setAba(v as any)}
              className="px-4 py-1.5 rounded-lg text-xs font-bold"
              style={{ background: aba===v ? GRAD : 'var(--card2)', color: aba===v ? '#fff' : 'var(--muted)', border: aba===v ? 'none' : '1px solid var(--border)' }}>
              {l}
            </button>
          ))}
        </div>
      )}

      {/* Corpo scrollável */}
      <div className="pg-body p-3 space-y-3">

        {/* Loading */}
        {loadingOp && (
          <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: 'var(--muted)' }}>
            <RefreshCw size={32} color="#f97316" className="animate-spin"/>
            <p className="text-sm font-bold text-white">Analisando o mercado...</p>
            <p className="text-xs">Buscando top produtos em 10 categorias do ML</p>
          </div>
        )}

        {/* ESTRATÉGIA */}
        {!loadingOp && aba === 'estrategia' && estrategia && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Meta / Mês',    value: fmtR(estrategia.meta),                          cor: '#f97316' },
                { label: 'Vendas / Dia',  value: String(estrategia.vendas_dia),                  cor: '#3b82f6' },
                { label: 'Cliques / Dia', value: estrategia.cliques_dia?.toLocaleString('pt-BR'), cor: '#8b5cf6' },
                { label: 'Posts / Dia',   value: String(estrategia.posts_dia),                   cor: '#ec4899' },
              ].map((k,i) => (
                <div key={i} className="rounded-xl p-3 text-center" style={{ background:'var(--card)', border:`1px solid ${k.cor}30` }}>
                  <p className="text-xl font-black" style={{ color: k.cor }}>{k.value}</p>
                  <p className="text-[10px] mt-0.5" style={{ color:'var(--muted)' }}>{k.label}</p>
                </div>
              ))}
            </div>

            {/* Fórmula */}
            <div className="rounded-xl p-4" style={{ background:'var(--card)', border:'1px solid #f97316' }}>
              <p className="text-[10px] font-black mb-2" style={{ color:'var(--muted)', letterSpacing:'0.08em' }}>📈 FÓRMULA DA META</p>
              <div className="flex items-center justify-around text-center">
                <div>
                  <p className="text-lg font-black" style={{ color:'#fbbf24' }}>{fmtR(estrategia.meta/30)}</p>
                  <p className="text-[10px]" style={{ color:'var(--muted)' }}>por dia</p>
                </div>
                <p className="text-xl" style={{ color:'var(--muted)' }}>=</p>
                <div>
                  <p className="text-lg font-black" style={{ color:'#60a5fa' }}>{estrategia.vendas_dia} vendas</p>
                  <p className="text-[10px]" style={{ color:'var(--muted)' }}>&times; {fmtR(estrategia.ticket_medio_com)}</p>
                </div>
              </div>
            </div>

            {/* Produtos foco */}
            <div className="rounded-xl overflow-hidden" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
              <div className="px-4 py-2.5" style={{ borderBottom:'1px solid var(--border)' }}>
                <p className="text-[10px] font-black tracking-widest" style={{ color:'var(--muted)' }}>🛍️ TOP PRODUTOS PARA FOCAR</p>
              </div>
              {(estrategia.plano_produtos||[]).map((p:any, i:number) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom:'1px solid var(--border)' }}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-black text-white"
                    style={{ background: i===0?'#f97316':i===1?'#3b82f6':'#8b5cf6' }}>{i+1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate text-white">{p.produto}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                        style={{ background:(CATS_COR[p.categoria]||'#94a3b8')+'20', color:CATS_COR[p.categoria]||'#94a3b8' }}>
                        {p.categoria}
                      </span>
                      <span className="text-[9px]" style={{ color:'var(--muted)' }}>{p.vendas_necessarias} vendas/mês</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-black" style={{ color:'#22c55e' }}>{fmtR(p.comissao)}</p>
                    <p className="text-[9px]" style={{ color:'var(--muted)' }}>{fmtR(p.renda_gerada)}/mês</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Ações diárias */}
            <div className="rounded-xl overflow-hidden" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
              <div className="px-4 py-2.5" style={{ borderBottom:'1px solid var(--border)' }}>
                <p className="text-[10px] font-black tracking-widest" style={{ color:'var(--muted)' }}>✅ ROTINA DIÁRIA</p>
              </div>
              <div className="p-3 space-y-1.5">
                {(estrategia.acoes_diarias||[]).map((a:string, i:number) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle size={13} color="#22c55e" className="mt-0.5 flex-shrink-0"/>
                    <p className="text-xs text-white">{a}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* OPORTUNIDADES */}
        {!loadingOp && aba === 'oportunidades' && (
          <div className="grid grid-cols-3 gap-2">
            {opors.map((p, i) => (
              <div key={i} className="rounded-xl overflow-hidden" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
                <div className="relative flex items-center justify-center p-2" style={{ background:'var(--card2)', height:80 }}>
                  {p.imagem_url ? <img src={p.imagem_url} className="max-h-full object-contain"/> : <ShoppingBag size={24} color="var(--muted)"/>}
                  <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white"
                    style={{ background: i<3?'#f97316':i<10?'#3b82f6':'#475569' }}>{i+1}</div>
                  <span className="absolute top-1.5 right-1.5 text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                    style={{ background:(CATS_COR[p.categoria_nome]||'#475569')+'30', color:CATS_COR[p.categoria_nome]||'#94a3b8' }}>
                    {p.categoria_nome}
                  </span>
                </div>
                <div className="p-2">
                  <p className="text-[10px] font-bold leading-tight mb-1.5 text-white"
                    style={{ display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                    {p.titulo}
                  </p>
                  <div className="grid grid-cols-2 gap-1 mb-1.5">
                    <div className="rounded-lg p-1 text-center" style={{ background:'var(--card2)' }}>
                      <p className="text-xs font-black" style={{ color:'#22c55e' }}>{fmtR(p.comissao_valor)}</p>
                      <p className="text-[9px]" style={{ color:'var(--muted)' }}>por venda</p>
                    </div>
                    <div className="rounded-lg p-1 text-center" style={{ background:'var(--card2)' }}>
                      <p className="text-xs font-black" style={{ color:'#3b82f6' }}>{p.comissao_pct}%</p>
                      <p className="text-[9px]" style={{ color:'var(--muted)' }}>comissão</p>
                    </div>
                  </div>
                  {p.ganho_mensal_pot > 0 && (
                    <div className="rounded-lg px-2 py-1 text-center mb-1.5"
                      style={{ background:'rgba(249,115,22,0.1)', border:'1px solid rgba(249,115,22,0.2)' }}>
                      <p className="text-[9px]" style={{ color:'var(--muted)' }}>Potencial mensal</p>
                      <p className="text-xs font-black" style={{ color:'#f97316' }}>{fmtR(p.ganho_mensal_pot)}</p>
                    </div>
                  )}
                  <button onClick={() => salvarProduto(p)}
                    className="w-full py-1.5 rounded-lg text-[10px] font-bold text-white" style={{ background:GRAD }}>
                    + Salvar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* HISTÓRICO */}
        {!loadingOp && aba === 'historico' && (
          <div className="space-y-2">
            {metas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color:'var(--muted)' }}>
                <Target size={32}/><p className="text-sm">Nenhuma meta registrada</p>
              </div>
            ) : metas.map((m:any, i:number) => (
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

        {/* Vazio */}
        {!loadingOp && opors.length===0 && !precisaConfig && !estrategia && (
          <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color:'var(--muted)' }}>
            <Target size={40}/>
            <p className="text-sm font-bold text-white">Configure o ML e clique em Escanear</p>
            <p className="text-xs text-center">A IA varre 10 categorias e monta seu plano para R$20.000/mês</p>
          </div>
        )}
      </div>
    </div>
  )
}
