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
function fmtR(v:any) { return (Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) }

const COM_ML: Record<string,number> = {
  'MLB1000':8,'MLB1055':10,'MLB1051':9,'MLB1648':12,'MLB1499':11,'MLB1574':10,'MLB1459':8,'MLB12':7
}
function comissaoML(catId:string) {
  for (const [k,v] of Object.entries(COM_ML)) { if (catId.startsWith(k)) return v }
  return 6
}
function montarProduto(item:any, plat:string, comPct?:number) {
  const preco = parseFloat(item.price || 0)
  const pct = comPct ?? comissaoML(item.category_id || '')
  return {
    produto_ext_id: item.id, titulo: item.title, preco,
    preco_original: item.original_price,
    comissao_pct: pct, comissao_valor: Math.round(preco*pct/100*100)/100,
    imagem_url: (item.thumbnail||'').replace('I.jpg','O.jpg'),
    url_produto: item.permalink, vendas_mes: item.sold_quantity||0,
    avaliacao:0, total_avaliacoes:0, categoria: item.category_id, plataforma: plat,
  }
}

const TERMOS_AUTO = ['smartphone samsung','notebook gamer','smartwatch','fone bluetooth','perfume importado','air fryer','tênis nike','kit skincare']

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

  async function getMLToken(): Promise<string|null> {
    try {
      const r = await fetch(`${API}/afiliados/ml-token`, { headers: hdr() })
      const d = await r.json()
      return d.access_token || null
    } catch { return null }
  }

  async function buscarMLDireto(q: string, limit: number, token: string|null) {
    // 1ª tentativa: chamada direta ML do browser (IP do usuário não é bloqueado)
    if (token) {
      try {
        const url = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(q)}&limit=${limit}&sort=sold_quantity_desc`
        const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
        const data = await r.json()
        if (r.ok) return (data.results || []).map((item:any) => montarProduto(item, 'ML_AFILIADOS'))
        // 401/403 → token inválido/expirado, tenta proxy abaixo
      } catch {
        // CORS ou rede → tenta proxy abaixo
      }
    }
    // 2ª tentativa: proxy Vercel (com token se disponível)
    const p = new URLSearchParams({ q, limit: String(limit), sort: 'sold_quantity_desc' })
    if (token) p.set('token', token)
    const r = await fetch(`/api/ml-search?${p}`)
    const data = await r.json()
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${data.message || data.error || JSON.stringify(data).slice(0,100)}`)
    return (data.results || []).map((item:any) => montarProduto(item, 'ML_AFILIADOS'))
  }

  async function buscarAuto() {
    setLoadingAuto(true); setRes([]); setErro('')
    try {
      const token = await getMLToken()
      // Continua mesmo sem token — proxy busca publicamente
      const todos: any[] = []
      let ultimoErro = ''
      for (const termo of TERMOS_AUTO.slice(0,2)) {
        try {
          const prods = await buscarMLDireto(termo, 15, token)
          todos.push(...prods)
        } catch (e:any) { ultimoErro = e?.message || String(e) }
      }
      const vistos = new Set<string>()
      const unicos = todos.filter(p => { if (vistos.has(p.produto_ext_id)) return false; vistos.add(p.produto_ext_id); return true })
      unicos.sort((a,b) => b.comissao_valor - a.comissao_valor)
      setRes(unicos.slice(0,30))
      if (unicos.length === 0) setErro(ultimoErro || 'Sem produtos encontrados')
    } catch (e:any) {
      setErro(`Erro: ${e?.message || String(e)}`)
    }
    setLoadingAuto(false)
  }

  async function buscar() {
    setLoading(true); setRes([]); setErro('')
    try {
      if (plat === 'ML_AFILIADOS') {
        const token = await getMLToken()
        const prods = await buscarMLDireto(query || 'smartphone', 20, token)
        setRes(prods)
        if (prods.length === 0) setErro('Nenhum produto encontrado')
      } else {
        // Outras plataformas via backend
        const p = new URLSearchParams({ q:query, plataforma:plat, ordenar, limit:'20' })
        const r = await fetch(`${API}/afiliados/buscar-produtos?${p}`, { headers: hdr() })
        const d = await r.json()
        setRes(d.resultados||[])
        if (d.erro) setErro(d.erro)
      }
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

            {erroBusca && !loadingAuto && !loading && (
              <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)' }}>
                <p className="text-xs font-bold" style={{ color:'#ef4444' }}>Erro ao carregar produtos:</p>
                <p className="text-xs" style={{ color:'#fca5a5' }}>{erroBusca}</p>
                <p className="text-xs" style={{ color:'var(--muted)' }}>Use o campo de busca acima para pesquisar manualmente.</p>
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
