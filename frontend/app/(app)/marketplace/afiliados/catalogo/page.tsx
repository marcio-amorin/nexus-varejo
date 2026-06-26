'use client'
import { useEffect, useState } from 'react'
import { Search, Plus, Star, StarOff, Trash2, Link2, ShoppingBag, RefreshCw, ExternalLink, X, Copy, CheckCircle } from 'lucide-react'

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

  // Modal importar por link
  const [modalLink, setModalLink]       = useState(false)
  const [inputLink, setInputLink]       = useState('')
  const [loadingImport, setLoadingImport] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)
  const [importErro, setImportErro]     = useState('')
  const [copiedKey, setCopiedKey]       = useState('')

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
    let tokenValido = token
    // 1ª tentativa: chamada direta browser→ML com token OAuth (IP do usuário)
    if (tokenValido) {
      try {
        const url = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(q)}&limit=${limit}&sort=sold_quantity_desc`
        const r = await fetch(url, { headers: { Authorization: `Bearer ${tokenValido}`, Accept: 'application/json' } })
        const data = await r.json()
        if (r.ok) return (data.results || []).map((item:any) => montarProduto(item, 'ML_AFILIADOS'))
        if (r.status === 401 || r.status === 403) tokenValido = null // token expirado → proxy sem token
      } catch {
        // CORS ou rede → mantém token para o proxy tentar
      }
    }
    // 2ª tentativa: proxy Vercel (sem token se falhou, com token se só foi CORS)
    const p = new URLSearchParams({ q, limit: String(limit), sort: 'sold_quantity_desc' })
    if (tokenValido) p.set('token', tokenValido)
    const r = await fetch(`/api/ml-search?${p}`)
    const data = await r.json()
    if (r.status === 403 || r.status === 401) return [] // sem token válido — retorna vazio silenciosamente
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${data.message || data.error || JSON.stringify(data).slice(0,100)}`)
    return (data.results || []).map((item:any) => montarProduto(item, 'ML_AFILIADOS'))
  }

  async function buscarAuto() {
    setLoadingAuto(true); setRes([]); setErro('')
    try {
      // 1ª tentativa: browser direto com OAuth token (sem bloqueio IP)
      const token = await getMLToken()
      const todos: any[] = []
      for (const termo of TERMOS_AUTO.slice(0,2)) {
        try {
          const prods = await buscarMLDireto(termo, 15, token)
          todos.push(...prods)
        } catch { /* ignora — tenta fallback abaixo */ }
      }

      if (todos.length > 0) {
        const vistos = new Set<string>()
        const unicos = todos.filter(p => { if (vistos.has(p.produto_ext_id)) return false; vistos.add(p.produto_ext_id); return true })
        unicos.sort((a,b) => b.comissao_valor - a.comissao_valor)
        setRes(unicos.slice(0,30))
        setLoadingAuto(false)
        return
      }

      // 2ª tentativa: endpoint backend /ml-destaques (highlights público, sem bloqueio IP)
      const rd = await fetch(`${API}/afiliados/ml-destaques?limit=30`, { headers: hdr() })
      if (rd.ok) {
        const dd = await rd.json()
        const prods = dd.resultados || []
        if (prods.length > 0) { setRes(prods); setLoadingAuto(false); return }
      }

      setErro('Não foi possível carregar produtos automaticamente. Tente pesquisar manualmente acima.')
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

  async function importarLink() {
    if (!inputLink.trim()) return
    setLoadingImport(true); setImportErro(''); setImportResult(null)
    try {
      const r = await fetch(`${API}/afiliados/importar-link`, {
        method:'POST', headers:hdr(), body:JSON.stringify({ url_ou_texto: inputLink.trim() })
      })
      const d = await r.json()
      if (!r.ok) { setImportErro(d.detail || 'Erro ao processar'); setLoadingImport(false); return }
      setImportResult(d)
    } catch { setImportErro('Erro de conexão com o servidor') }
    setLoadingImport(false)
  }

  async function copiarTexto(texto: string, key: string) {
    await navigator.clipboard.writeText(texto)
    setCopiedKey(key); setTimeout(() => setCopiedKey(''), 2000)
  }

  async function salvarImportado() {
    if (!importResult?.produto) return
    await salvarProduto(importResult.produto)
    setModalLink(false); setImportResult(null); setInputLink('')
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
          <div className="flex items-center gap-2">
            <button onClick={() => { setModalLink(true); setImportResult(null); setImportErro(''); setInputLink('') }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black"
              style={{ background:'rgba(255,255,255,0.2)', color:'#fff', border:'1px solid rgba(255,255,255,0.35)' }}>
              <ExternalLink size={12}/> Importar Link ML
            </button>
            <span className="text-xs px-2.5 py-1 rounded-lg font-bold" style={{ background:'rgba(255,255,255,0.2)', color:'#fff' }}>
              {catalogo.length} salvos
            </span>
          </div>
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
      {/* ── Modal Importar por Link ───────────────────────────────────────── */}
      {modalLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background:'rgba(0,0,0,0.7)' }}
          onClick={e => { if (e.target === e.currentTarget) setModalLink(false) }}>
          <div className="w-full max-w-lg mx-4 rounded-2xl overflow-hidden flex flex-col" style={{ background:'var(--card)', border:'1px solid var(--border)', maxHeight:'90vh' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom:'1px solid var(--border)', background: GRAD }}>
              <div>
                <p className="text-sm font-black text-white flex items-center gap-2"><ExternalLink size={14}/> Importar Produto por Link</p>
                <p className="text-[10px] text-white/75">Cole o link do ML ou texto do produto → IA gera copies automático</p>
              </div>
              <button onClick={() => setModalLink(false)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background:'rgba(255,255,255,0.2)' }}>
                <X size={14} color="#fff"/>
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-3">
              {/* Input */}
              <div>
                <label className="text-[10px] font-bold block mb-1" style={{ color:'var(--muted)' }}>Link do produto ou texto descritivo</label>
                <textarea value={inputLink} onChange={e => setInputLink(e.target.value)}
                  placeholder="Cole o link: https://www.mercadolivre.com.br/fone-bluetooth.../p/MLB123...&#10;ou texto: Fone Bluetooth JBL R$ 89,90 categoria eletrônicos"
                  rows={3} className="w-full px-3 py-2 rounded-lg text-xs resize-none"/>
              </div>

              <button onClick={importarLink} disabled={loadingImport || !inputLink.trim()}
                className="w-full py-2.5 rounded-xl font-black text-white text-xs flex items-center justify-center gap-2"
                style={{ background: GRAD, opacity: inputLink.trim() ? 1 : 0.5 }}>
                {loadingImport
                  ? <><RefreshCw size={13} className="animate-spin"/> Processando com IA...</>
                  : <><Search size={13}/> Extrair Produto + Gerar Copies</>}
              </button>

              {importErro && (
                <div className="p-3 rounded-xl text-xs" style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#fca5a5' }}>
                  {importErro}
                </div>
              )}

              {/* Resultado */}
              {importResult && (
                <div className="space-y-3">
                  {/* Produto */}
                  <div className="rounded-xl overflow-hidden" style={{ background:'var(--card2)', border:'1px solid var(--border)' }}>
                    <div className="flex items-center gap-3 p-3">
                      {importResult.produto.imagem_url
                        ? <img src={importResult.produto.imagem_url} className="w-14 h-14 object-contain rounded-lg flex-shrink-0" style={{ background:'var(--card)' }}/>
                        : <div className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background:'var(--card)' }}><ShoppingBag size={24} color="var(--muted)"/></div>}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white leading-tight">{importResult.produto.titulo}</p>
                        <p className="text-lg font-black mt-1" style={{ color:'#f97316' }}>
                          {fmtR(importResult.produto.preco)}
                        </p>
                        <p className="text-[10px] font-bold" style={{ color:'#22c55e' }}>
                          Comissão estimada: {importResult.produto.comissao_pct}% = {fmtR(importResult.produto.comissao_valor)}/venda
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Copies gerados */}
                  {Object.entries(importResult.copies || {}).map(([rede, copy]: any) => (
                    <div key={rede} className="rounded-xl p-3 space-y-2" style={{ background:'var(--card2)', border:'1px solid var(--border)' }}>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black tracking-widest" style={{ color:'var(--muted)' }}>
                          {rede === 'instagram' ? '📸 INSTAGRAM' : '🎵 TIKTOK'}
                        </p>
                        <button onClick={() => copiarTexto(`${copy.texto}\n\n${copy.hashtags}`, rede)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold"
                          style={{ background: copiedKey===rede ? 'rgba(34,197,94,0.2)' : 'var(--card)', color: copiedKey===rede ? '#22c55e' : 'var(--muted)', border:`1px solid ${copiedKey===rede?'rgba(34,197,94,0.3)':'var(--border)'}` }}>
                          {copiedKey===rede ? <><CheckCircle size={10}/> Copiado!</> : <><Copy size={10}/> Copiar</>}
                        </button>
                      </div>
                      <p className="text-xs text-white leading-relaxed whitespace-pre-wrap">{copy.texto}</p>
                      <p className="text-[10px]" style={{ color:'#3b82f6' }}>{copy.hashtags}</p>
                    </div>
                  ))}

                  <button onClick={salvarImportado}
                    className="w-full py-2.5 rounded-xl font-black text-white text-xs flex items-center justify-center gap-2"
                    style={{ background:'linear-gradient(135deg,#16a34a,#22c55e)' }}>
                    <Plus size={13}/> Salvar no Catálogo
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
