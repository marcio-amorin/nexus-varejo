'use client'
import { useEffect, useState, useRef } from 'react'
import { Search, Plus, Star, StarOff, Trash2, Link2, ShoppingBag, RefreshCw, ExternalLink, X, Copy, CheckCircle, ChevronLeft, ChevronRight, Zap } from 'lucide-react'

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

const CATS_ICONE: Record<string,string> = {
  'Todos':'🏷️','Celulares':'📱','TV & Vídeo':'📺','Informática':'💻','Games':'🎮',
  'Eletrodomésticos':'🏠','Áudio':'🎧','Calçados':'👟','Roupas':'👗','Smartwatches':'⌚',
  'Beleza':'💄','Acessórios':'👜','Esporte':'🏋️','Foto & Vídeo':'📷','Outros':'📦'
}

function detectarCat(titulo: string): string {
  const t = titulo.toLowerCase()
  if (/samsung|motorola|iphone|xiaomi|realme|poco|smartphone|celular|moto g|galaxy [as]|redmi/.test(t)) return 'Celulares'
  if (/smart tv|televisão|\btv\b|qled|oled|4k|android tv|roku|aiwa/.test(t)) return 'TV & Vídeo'
  if (/notebook|laptop|computador|monitor|\btablet\b|ipad|impressora/.test(t)) return 'Informática'
  if (/playstation|xbox|nintendo|ps5|ps4|switch|joystick|gamer|gift card/.test(t)) return 'Games'
  if (/air fryer|fritadeira|geladeira|máquina de lavar|fogão|micro-ondas|liquidificador|aspirador|cafeteira/.test(t)) return 'Eletrodomésticos'
  if (/fone|headphone|earphone|bluetooth|caixa de som|speaker|soundbar/.test(t)) return 'Áudio'
  if (/tênis|sapato|bota|sandália|chinelo|sapatênis|mocassim/.test(t)) return 'Calçados'
  if (/camiseta|camisa|blusa|vestido|calça|jaqueta|moletom|shorts|saia|macacão|conjunto|legging/.test(t)) return 'Roupas'
  if (/smartwatch|watch|relógio/.test(t)) return 'Smartwatches'
  if (/perfume|desodorante|shampoo|condicionador|hidratante|creme|protetor solar|maquiagem|skincare|sérum/.test(t)) return 'Beleza'
  if (/bolsa|mochila|carteira|colar|brinco|anel|óculos|cinto|chapéu/.test(t)) return 'Acessórios'
  if (/bicicleta|esteira|haltere|kettlebell|yoga|fitness|musculação/.test(t)) return 'Esporte'
  if (/câmera|camera|drone|gopro|ring light|tripé/.test(t)) return 'Foto & Vídeo'
  return 'Outros'
}

export default function Catalogo() {
  const tabsRef = useRef<HTMLDivElement>(null)
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
  const [catSel, setCatSel]           = useState('Todos')
  const [publicandoId, setPublicandoId] = useState<number|null>(null)
  const [resultadoPublicar, setResultadoPublicar] = useState<any>(null)

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

  // ── Chama ML direto do BROWSER do usuário (IP residencial → não bloqueado pelo ML)
  async function buscarMLBrowser(q: string, limit: number, token?: string|null): Promise<any[]> {
    const url = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(q)}&limit=${limit}&sort=sold_quantity_desc`
    // 1ª: simples sem headers (sem CORS preflight, mais compatível)
    try {
      const r = await fetch(url)
      if (r.ok) {
        const d = await r.json()
        if ((d.results || []).length > 0)
          return d.results.map((item:any) => montarProduto(item, 'ML_AFILIADOS'))
      }
    } catch {}
    // 2ª: com token OAuth / client_credentials (backend auto-gera se expirado)
    const tok = token !== undefined ? token : await getMLToken()
    if (tok) {
      try {
        const r = await fetch(url, { headers: { Authorization: `Bearer ${tok}` } })
        if (r.ok) {
          const d = await r.json()
          return (d.results || []).map((item:any) => montarProduto(item, 'ML_AFILIADOS'))
        }
      } catch {}
    }
    return []
  }

  async function buscarAuto() {
    setLoadingAuto(true); setRes([]); setErro('')
    // Tenta backend primeiro, fallback direto no browser
    let prods: any[] = []
    try {
      const r = await fetch(`${API}/afiliados/ml-destaques?limit=300`, { headers: hdr() })
      if (r.ok) {
        const d = await r.json()
        prods = d.resultados || []
      }
    } catch {}
    if (prods.length === 0) {
      prods = await buscarMLBrowser('smartphone fone tênis notebook', 48)
    }
    if (prods.length > 0) setRes(prods)
    else setErro('Não foi possível carregar produtos. Use a busca manual ou Importar Link ML.')
    setLoadingAuto(false)
  }

  async function buscar() {
    setLoading(true); setRes([]); setErro('')
    if (plat === 'ML_AFILIADOS') {
      try {
        const p = new URLSearchParams({ q: query || 'smartphone samsung', plataforma: 'ML_AFILIADOS', ordenar, limit: '24' })
        const r = await fetch(`${API}/afiliados/buscar-produtos?${p}`, { headers: hdr() })
        const d = await r.json()
        const prods: any[] = d.resultados || []
        setRes(prods)
        if (d.erro) setErro(d.erro)
        else if (prods.length === 0) setErro('Nenhum produto encontrado. Tente outro termo.')
      } catch { setErro('Erro ao buscar produtos') }
    } else {
      // Outras plataformas via backend
      try {
        const p = new URLSearchParams({ q: query || '', plataforma: plat, ordenar, limit: '20' })
        const r = await fetch(`${API}/afiliados/buscar-produtos?${p}`, { headers: hdr() })
        const d = await r.json()
        setRes(d.resultados || [])
        if (d.erro) setErro(d.erro)
        else if ((d.resultados || []).length === 0) setErro('Nenhum produto encontrado')
      } catch { setErro('Erro ao buscar produtos') }
    }
    setLoading(false)
  }

  async function salvarProduto(p: any) {
    const r = await fetch(`${API}/afiliados/catalogo`, { method:'POST', headers:hdr(), body:JSON.stringify(p) })
    const d = await r.json()
    if (d.duplicado) return
    carregarCatalogo(); setAba('catalogo')
  }

  async function publicarTudo(p: any) {
    const rs = await fetch(`${API}/afiliados/catalogo`, { method:'POST', headers:hdr(), body:JSON.stringify(p) })
    const ds = await rs.json()
    const prodId = ds.id || ds.produto_id
    if (!prodId) { alert('Erro ao salvar produto'); return }
    setPublicandoId(prodId)
    setResultadoPublicar(null)
    try {
      const r = await fetch(`${API}/vendedor/publicar-tudo`, {
        method:'POST', headers:hdr(),
        body:JSON.stringify({ produto_id:prodId, publicar_redes:true })
      })
      setResultadoPublicar(await r.json())
      carregarCatalogo()
    } catch(e:any) { setResultadoPublicar({ erro: e.message }) }
    setPublicandoId(null)
  }

  async function importarLink() {
    if (!inputLink.trim()) return
    setLoadingImport(true); setImportErro(''); setImportResult(null)
    const texto = inputLink.trim()

    // Extrai MLB ID e chama ML direto do browser (sem depender do backend)
    const mlMatch = texto.match(/MLB-?(\d+)/i)
    if (mlMatch) {
      const itemId = `MLB${mlMatch[1]}`
      try {
        const r = await fetch(`https://api.mercadolibre.com/items/${itemId}`)
        if (r.ok) {
          const d = await r.json()
          // Preço: direto ou menor variação (para produtos com tamanhos/cores)
          let preco = parseFloat(d.price || d.base_price || 0)
          if (!preco && d.variations?.length) {
            const precos = d.variations.map((v:any) => parseFloat(v.price || 0)).filter((p:number) => p > 0)
            if (precos.length) preco = Math.min(...precos)
          }
          if (!preco && d.sale_price?.amount) preco = parseFloat(d.sale_price.amount)
          const pct = comissaoML(d.category_id || '')
          // Imagem: tenta pictures[0] se thumbnail falhar
          const imagem = d.pictures?.[0]?.url || (d.thumbnail || '').replace('I.jpg', 'O.jpg')
          const produto = {
            produto_ext_id: d.id,
            titulo: d.title,
            preco,
            preco_original: d.original_price || null,
            comissao_pct: pct,
            comissao_valor: Math.round(preco * pct / 100 * 100) / 100,
            imagem_url: imagem,
            url_produto: d.permalink || texto,
            vendas_mes: d.sold_quantity || 0,
            avaliacao: 0, total_avaliacoes: 0,
            categoria: d.category_id || '',
            plataforma: 'ML_AFILIADOS',
          }
          setImportResult({ produto, copies: {} })
          setLoadingImport(false)
          return
        }
      } catch {}
    }

    // Fallback: backend
    try {
      const r = await fetch(`${API}/afiliados/importar-link`, {
        method:'POST', headers:hdr(), body:JSON.stringify({ url_ou_texto: texto })
      })
      const d = await r.json()
      if (!r.ok) { setImportErro(d.detail || 'Produto não encontrado. Verifique o link.'); setLoadingImport(false); return }
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

          <div className="pg-body p-2 space-y-2">
            {(loading || loadingAuto) && (
              <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color:'var(--muted)' }}>
                <RefreshCw size={28} color="#f97316" className="animate-spin"/>
                <p className="text-xs">Carregando produtos mais vendidos do Mercado Livre...</p>
              </div>
            )}

            {erroBusca && !loadingAuto && !loading && (
              <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)' }}>
                <p className="text-xs font-bold" style={{ color:'#ef4444' }}>Erro ao carregar produtos:</p>
                <p className="text-xs" style={{ color:'#fca5a5' }}>{erroBusca}</p>
                <p className="text-xs" style={{ color:'var(--muted)' }}>Use o campo de busca acima para pesquisar manualmente.</p>
              </div>
            )}

            {!loading && !loadingAuto && resultados.length > 0 && (() => {
              const prodsComCat = resultados.map(p => ({ ...p, categoria: p.categoria || detectarCat(p.titulo) }))
              const contagem: Record<string,number> = { 'Todos': prodsComCat.length }
              prodsComCat.forEach(p => { contagem[p.categoria] = (contagem[p.categoria]||0)+1 })
              const cats = ['Todos', ...Object.keys(contagem).filter(c => c !== 'Todos').sort()]
              const filtrados = catSel === 'Todos' ? prodsComCat : prodsComCat.filter(p => p.categoria === catSel)
              return (
                <>
                  {/* Abas de categoria com setas de scroll */}
                  <div className="flex items-center gap-1">
                    <button onClick={() => tabsRef.current?.scrollBy({ left:-150, behavior:'smooth' })}
                      className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center"
                      style={{ background:'var(--card)', border:'1px solid var(--border)', color:'var(--muted)' }}>
                      <ChevronLeft size={12}/>
                    </button>
                    <div ref={tabsRef} className="flex gap-1.5 overflow-x-auto pb-1 flex-1" style={{ scrollbarWidth:'none' }}>
                      {cats.map(cat => (
                        <button key={cat} onClick={() => setCatSel(cat)}
                          className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all"
                          style={{
                            background: catSel===cat ? GRAD : 'var(--card)',
                            color: catSel===cat ? '#fff' : 'var(--muted)',
                            border: catSel===cat ? 'none' : '1px solid var(--border)',
                            whiteSpace:'nowrap'
                          }}>
                          {CATS_ICONE[cat]||'📦'} {cat}
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black"
                            style={{ background: catSel===cat?'rgba(255,255,255,0.25)':'var(--card2)' }}>
                            {contagem[cat]}
                          </span>
                        </button>
                      ))}
                    </div>
                    <button onClick={() => tabsRef.current?.scrollBy({ left:150, behavior:'smooth' })}
                      className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center"
                      style={{ background:'var(--card)', border:'1px solid var(--border)', color:'var(--muted)' }}>
                      <ChevronRight size={12}/>
                    </button>
                  </div>

                  {/* Contador */}
                  <p className="text-[10px]" style={{ color:'var(--muted)' }}>
                    {filtrados.length} produtos {catSel !== 'Todos' ? `em ${catSel}` : 'no total'} — ordenados por maior comissão
                  </p>

                  {/* Grid de produtos */}
                  <div className="grid gap-2" style={{ gridTemplateColumns:'repeat(auto-fill,minmax(165px,1fr))' }}>
                    {filtrados.map((p,i) => (
                      <div key={i} className="rounded-xl overflow-hidden flex flex-col"
                        style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
                        {/* Foto */}
                        <div className="relative flex items-center justify-center" style={{ background:'#fff', height:140 }}>
                          {p.imagem_url
                            ? <img src={p.imagem_url} alt={p.titulo} className="w-full h-full object-contain p-2"/>
                            : <ShoppingBag size={36} color="#ccc"/>}
                          {/* Badge categoria */}
                          <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md text-[9px] font-black"
                            style={{ background:'rgba(0,0,0,0.7)', color:'#fff' }}>
                            {CATS_ICONE[p.categoria]||'📦'} {p.categoria}
                          </span>
                        </div>
                        {/* Info */}
                        <div className="p-2 flex flex-col gap-1 flex-1">
                          <p className="text-[10px] font-bold leading-tight" style={{ color:'var(--fg)', display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                            {p.titulo}
                          </p>
                          <div className="mt-auto">
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="text-xs font-black" style={{ color:'#f97316' }}>{fmtR(p.preco)}</span>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background:'rgba(34,197,94,0.15)', color:'#22c55e' }}>
                                +{fmtR(p.comissao_valor)}
                              </span>
                            </div>
                            {/* Botão Publicar Tudo — ação principal */}
                            <button onClick={() => publicarTudo(p)} disabled={publicandoId !== null}
                              className="w-full py-2 rounded-lg text-[10px] font-black text-white flex items-center justify-center gap-1 mb-1"
                              style={{ background:'linear-gradient(135deg,#7c3aed,#f97316)', opacity: publicandoId!==null?0.6:1 }}>
                              {publicandoId !== null ? <RefreshCw size={10} className="animate-spin"/> : <Zap size={10}/>}
                              Publicar Tudo
                            </button>
                            <button onClick={() => salvarProduto(p)}
                              className="w-full py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1"
                              style={{ background:'var(--card2)', color:'var(--muted)', border:'1px solid var(--border)' }}>
                              <Plus size={10}/> Só Catálogo
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )
            })()}
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
      {/* ── Modal Resultado Publicar Tudo ────────────────────────────────── */}
      {resultadoPublicar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background:'rgba(0,0,0,0.75)' }}
          onClick={e => { if (e.target===e.currentTarget) setResultadoPublicar(null) }}>
          <div className="w-full max-w-md mx-4 rounded-2xl overflow-hidden" style={{ background:'var(--card)', border:'1px solid #f97316' }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ background:'linear-gradient(135deg,#7c3aed,#f97316)' }}>
              <p className="font-black text-white text-sm flex items-center gap-2"><Zap size={14}/> Resultado — Publicar Tudo</p>
              <button onClick={() => setResultadoPublicar(null)} className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background:'rgba(255,255,255,0.2)' }}>
                <X size={12} color="#fff"/>
              </button>
            </div>
            <div className="p-4 space-y-2">
              {resultadoPublicar.erro ? (
                <p className="text-xs text-red-400">{resultadoPublicar.erro}</p>
              ) : (
                <>
                  <p className="text-xs font-bold text-white truncate">{resultadoPublicar.produto}</p>
                  {(resultadoPublicar.passos||[]).map((s:any,i:number) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg" style={{ background:'var(--card2)' }}>
                      <span className="text-sm">{s.status?.startsWith('✅') ? '✅' : s.status?.startsWith('⚠️') ? '⚠️' : '❌'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black text-white">{s.passo}</p>
                        <p className="text-[9px]" style={{ color:'var(--muted)' }}>{s.status?.replace(/^[✅⚠️❌]\s*/,'')}</p>
                        {s.detalhe && <p className="text-[9px] mt-1 break-all" style={{ color:'#ef4444' }}>{typeof s.detalhe === 'object' ? JSON.stringify(s.detalhe) : s.detalhe}</p>}
                        {s.url && <a href={s.url} target="_blank" className="text-[9px] text-blue-400 underline">Ver anúncio ↗</a>}
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-2 pt-1">
                    <div className="flex-1 rounded-lg p-2 text-center" style={{ background:'rgba(249,115,22,0.1)', border:'1px solid rgba(249,115,22,0.2)' }}>
                      <p className="text-xs font-black" style={{ color:'#f97316' }}>R$ {resultadoPublicar.preco_venda?.toFixed(2)}</p>
                      <p className="text-[9px]" style={{ color:'var(--muted)' }}>Preço de venda</p>
                    </div>
                    <div className="flex-1 rounded-lg p-2 text-center" style={{ background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.2)' }}>
                      <p className="text-xs font-black" style={{ color:'#22c55e' }}>{resultadoPublicar.margem_pct}%</p>
                      <p className="text-[9px]" style={{ color:'var(--muted)' }}>Margem</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
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
