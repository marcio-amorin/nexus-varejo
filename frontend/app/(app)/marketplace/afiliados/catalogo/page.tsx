'use client'
import { useEffect, useState } from 'react'
import { Search, Plus, Star, StarOff, Trash2, Link2, ShoppingBag, RefreshCw } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'
const GRAD = 'linear-gradient(135deg,#ea580c 0%,#f97316 40%,#f59e0b 80%,#fbbf24 100%)'

const PLATS = [
  { value:'ML_AFILIADOS', label:'Mercado Livre',  cor:'#f59e0b', icone:'🟡' },
  { value:'SHOPEE',       label:'Shopee',         cor:'#ef4444', icone:'🟠' },
  { value:'AMAZON',       label:'Amazon',         cor:'#f97316', icone:'📦' },
  { value:'TIKTOK_SHOP',  label:'TikTok Shop',    cor:'#ff0050', icone:'🎵' },
]

function hdr() { return { 'Content-Type':'application/json', Authorization:`Bearer ${localStorage.getItem('nexus_token')}` } }
function fmtR(v:number) { return v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) }

export default function Catalogo() {
  const [aba, setAba]             = useState<'buscar'|'catalogo'>('buscar')
  const [plat, setPlat]           = useState('ML_AFILIADOS')
  const [query, setQuery]         = useState('')
  const [ordenar, setOrdenar]     = useState('vendas')
  const [resultados, setRes]      = useState<any[]>([])
  const [catalogo, setCat]        = useState<any[]>([])
  const [loading, setLoading]         = useState(false)
  const [loadingAuto, setLoadingAuto] = useState(false)
  const [erroBusca, setErro]          = useState('')
  const [msgLink, setMsgLink]         = useState('')

  useEffect(() => { carregarCatalogo(); buscarAuto() }, [])

  async function carregarCatalogo() {
    try {
      const r = await fetch(`${API}/afiliados/catalogo`, { headers: hdr() })
      const d = await r.json()
      setCat(Array.isArray(d) ? d : [])
    } catch { setCat([]) }
  }

  async function buscarAuto() {
    setLoadingAuto(true); setRes([]); setErro('')
    try {
      const ctrl = new AbortController()
      const tid = setTimeout(() => ctrl.abort(), 15000)
      const p = new URLSearchParams({ q:'', plataforma:'ML_AFILIADOS', ordenar:'vendas', limit:'30' })
      const r = await fetch(`${API}/afiliados/buscar-produtos?${p}`, { headers: hdr(), signal: ctrl.signal })
      clearTimeout(tid)
      const d = await r.json()
      setRes(d.resultados||[])
      if (d.erro) setErro(d.erro)
    } catch (e:any) {
      if (e?.name === 'AbortError') setErro('Tempo esgotado — use o campo de busca acima')
      else setErro('Erro ao carregar produtos')
    }
    setLoadingAuto(false)
  }

  async function buscar() {
    setLoading(true); setRes([]); setErro('')
    try {
      const p = new URLSearchParams({ q:query, plataforma:plat, ordenar, limit:'20' })
      const r = await fetch(`${API}/afiliados/buscar-produtos?${p}`, { headers: hdr() })
      const d = await r.json()
      setRes(d.resultados||[])
      if (d.erro) setErro(d.erro)
    } catch { setErro('Erro ao buscar produtos') }
    setLoading(false)
  }

  async function salvarProduto(p: any) {
    const r = await fetch(`${API}/afiliados/catalogo`, { method:'POST', headers:hdr(), body:JSON.stringify(p) })
    const d = await r.json()
    if (d.duplicado) return
    carregarCatalogo(); setAba('catalogo')
  }

  async function toggleFav(id:number) {
    await fetch(`${API}/afiliados/catalogo/${id}/favorito`, { method:'PATCH', headers:hdr() })
    carregarCatalogo()
  }

  async function remover(id:number) {
    await fetch(`${API}/afiliados/catalogo/${id}`, { method:'DELETE', headers:hdr() })
    carregarCatalogo()
  }

  async function gerarLink(id:number, titulo:string) {
    const r = await fetch(`${API}/afiliados/gerar-link?produto_id=${id}`, { method:'POST', headers:hdr() })
    const d = await r.json()
    if (d.url_afiliado) {
      await navigator.clipboard.writeText(d.url_afiliado)
      setMsgLink(`Link copiado! ${titulo.slice(0,30)}`)
      setTimeout(() => setMsgLink(''), 3000)
    }
  }

  return (
    <div className="pg">
      {/* Header */}
      <div className="pg-header rounded-xl overflow-hidden" style={{ background: GRAD }}>
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-black text-white flex items-center gap-2"><ShoppingBag size={16}/> Catálogo Produtos</h1>
            <p className="text-xs text-white/75 mt-0.5">Produtos mais vendidos — salve e promova</p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-lg font-bold" style={{ background:'rgba(255,255,255,0.2)', color:'#fff' }}>
            {catalogo.length} salvos
          </span>
        </div>
      </div>

      {msgLink && (
        <div className="pg-stats rounded-xl px-4 py-2.5 flex items-center gap-2 text-xs font-bold"
          style={{ background:'rgba(34,197,94,0.15)', border:'1px solid #22c55e', color:'#22c55e' }}>
          <Link2 size={13}/> {msgLink}
        </div>
      )}

      {/* Abas */}
      <div className="pg-stats flex gap-1">
        {[['buscar','🔍 Buscar'],['catalogo',`📦 Meu Catálogo (${catalogo.length})`]].map(([v,l]) => (
          <button key={v} onClick={() => setAba(v as any)}
            className="px-4 py-1.5 rounded-lg text-xs font-bold"
            style={{ background:aba===v?GRAD:'var(--card2)', color:aba===v?'#fff':'var(--muted)', border:aba===v?'none':'1px solid var(--border)' }}>
            {l}
          </button>
        ))}
      </div>

      {/* ABA BUSCAR */}
      {aba === 'buscar' && (
        <>
          <div className="pg-stats rounded-xl p-3 space-y-2" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
            <div className="flex gap-1.5 flex-wrap">
              {PLATS.map(p => (
                <button key={p.value} onClick={() => setPlat(p.value)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold"
                  style={{ background:plat===p.value?p.cor+'25':'var(--card2)', border:`1px solid ${plat===p.value?p.cor:'var(--border)'}`, color:plat===p.value?p.cor:'var(--muted)' }}>
                  {p.icone} {p.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search size={14} color="var(--muted)" className="absolute left-3 top-1/2 -translate-y-1/2"/>
                <input value={query} onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key==='Enter' && buscar()}
                  placeholder="Ex: fone bluetooth, tênis, perfume..."
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-lg"/>
              </div>
              <select value={ordenar} onChange={e => setOrdenar(e.target.value)} className="px-2 py-2 rounded-lg text-xs">
                <option value="vendas">+ Vendidos</option>
                <option value="comissao">+ Comissão</option>
                <option value="preco">Menor Preço</option>
              </select>
              <button onClick={buscar} disabled={loading} className="btn-primary px-4 py-2 flex items-center gap-1.5 text-xs">
                {loading ? <RefreshCw size={13} className="animate-spin"/> : <Search size={13}/>} Buscar
              </button>
            </div>
          </div>

          <div className="pg-body p-2">
            {(loading || loadingAuto) && (
              <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color:'var(--muted)' }}>
                <RefreshCw size={28} color="#f97316" className="animate-spin"/>
                <p className="text-xs">Buscando produtos mais vendidos...</p>
              </div>
            )}

            {erroBusca && !loading && (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <p className="text-xs text-center" style={{ color:'#ef4444' }}>{erroBusca}</p>
              </div>
            )}

            {!loading && resultados.length > 0 && (
              <div className="grid gap-2" style={{ gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))' }}>
                {resultados.map((p,i) => (
                  <div key={i} className="rounded-xl overflow-hidden" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
                    <div className="flex items-center justify-center p-2" style={{ background:'var(--card2)', height:90 }}>
                      {p.imagem_url ? <img src={p.imagem_url} className="max-h-full object-contain"/> : <ShoppingBag size={28} color="var(--muted)"/>}
                    </div>
                    <div className="p-2">
                      <p className="text-[10px] font-bold text-white leading-tight mb-1.5" style={{ display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{p.titulo}</p>
                      <div className="flex justify-between mb-1.5">
                        <span className="text-[10px] font-black" style={{ color:'#f97316' }}>{fmtR(p.preco)}</span>
                        <span className="text-[10px] font-bold" style={{ color:'#22c55e' }}>{p.comissao_pct}% · {fmtR(p.comissao_valor)}</span>
                      </div>
                      <button onClick={() => salvarProduto(p)} className="w-full py-1.5 rounded-lg text-[10px] font-bold text-white flex items-center justify-center gap-1" style={{ background:GRAD }}>
                        <Plus size={11}/> Salvar no Catálogo
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ABA CATÁLOGO */}
      {aba === 'catalogo' && (
        <div className="pg-body p-2">
          {catalogo.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3" style={{ color:'var(--muted)' }}>
              <ShoppingBag size={36}/>
              <p className="text-sm font-bold text-white">Catálogo vazio</p>
              <p className="text-xs">Salve produtos da aba Buscar para promover</p>
              <button onClick={() => setAba('buscar')} className="btn-primary text-xs px-5 py-2">Ver Produtos</button>
            </div>
          ) : (
            <div className="grid gap-2" style={{ gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))' }}>
              {catalogo.map((p,i) => (
                <div key={i} className="rounded-xl overflow-hidden" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
                  <div className="relative flex items-center justify-center p-2" style={{ background:'var(--card2)', height:90 }}>
                    {p.imagem_url ? <img src={p.imagem_url} className="max-h-full object-contain"/> : <ShoppingBag size={28} color="var(--muted)"/>}
                    <button onClick={() => toggleFav(p.id)} className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center" style={{ background:'var(--card)' }}>
                      {p.favorito ? <Star size={12} color="#f59e0b" fill="#f59e0b"/> : <StarOff size={12} color="var(--muted)"/>}
                    </button>
                  </div>
                  <div className="p-2">
                    <p className="text-[10px] font-bold text-white leading-tight mb-1" style={{ display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{p.titulo}</p>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-[10px] font-black" style={{ color:'#f97316' }}>{fmtR(p.preco)}</span>
                      <span className="text-[10px] font-bold" style={{ color:'#22c55e' }}>{p.comissao_pct}%</span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => gerarLink(p.id, p.titulo)}
                        className="flex-1 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 text-white"
                        style={{ background:'var(--card2)', border:'1px solid var(--border)' }}>
                        <Link2 size={10}/> Link
                      </button>
                      <button onClick={() => remover(p.id)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.3)' }}>
                        <Trash2 size={11} color="#ef4444"/>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
