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
  const [filtroCat, setFiltroCat]     = useState<'todos'|'nao_publicado'|'ml_vendedor'|'afiliado'>('todos')
  const [erroBusca, setErro]          = useState('')
  const [msgLink, setMsgLink]         = useState('')
  const [catSel, setCatSel]           = useState('Todos')
  const [publicandoId, setPublicandoId] = useState<number|null>(null)
  const [resultadoPublicar, setResultadoPublicar] = useState<any>(null)
  const [enviandoTodos, setEnviandoTodos] = useState(false)
  const [progressoEnvio, setProgressoEnvio] = useState({ atual:0, total:0 })
  const [resultadoEnvioTodos, setResultadoEnvioTodos] = useState<any>(null)

  // Modal importar por link
  const [modalLink, setModalLink]       = useState(false)
  const [inputLink, setInputLink]       = useState('')
  const [loadingImport, setLoadingImport] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)
  const [importErro, setImportErro]     = useState('')
  const [copiedKey, setCopiedKey]       = useState('')
  const [precoManual, setPrecoManual]   = useState('')
  const [imagemManual, setImagemManual] = useState('')
  const [tituloManual, setTituloManual] = useState('')

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
  async function buscarMLBrowser(q: string, limit: number, token?: string|null, category?: string, offset?: number): Promise<any[]> {
    const off = offset ? `&offset=${offset}` : ''
    const url = category
      ? `https://api.mercadolibre.com/sites/MLB/search?category=${category}&sort=sold_quantity_desc&limit=${limit}${off}`
      : `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(q)}&limit=${limit}&sort=sold_quantity_desc${off}`
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

    // Busca direto do browser (IP residencial → ML não bloqueia)
    // Fase 1: por CATEGORIA (top vendidos por categoria, sem sobreposição) — 15 cats × 50 = 750 raw
    // Fase 2: por PALAVRA-CHAVE complementar — 15 termos × 30 = 450 raw
    // Total esperado após dedup: 400–600 produtos únicos
    const CATS_ML = [
      'MLB1055',  // Celulares e Smartphones
      'MLB432',   // Televisores
      'MLB1648',  // Computação (notebooks, tablets)
      'MLB1144',  // Games (consoles, jogos)
      'MLB1574',  // Eletrodomésticos
      'MLB109285',// Fones / Headphones
      'MLB7195',  // Smartwatches
      'MLB1246',  // Beleza e Cuidado Pessoal
      'MLB1276',  // Esportes e Fitness
      'MLB1248',  // Camisetas e Roupas
      'MLB108562',// Tênis e Calçados
      'MLB1430',  // Moda e Acessórios
      'MLB1459',  // Eletrônicos em geral
      'MLB1010',  // Câmeras e Foto
      'MLB218519',// Ferramentas e Construção
    ]
    const TERMOS = [
      'samsung galaxy s', 'motorola moto g edge', 'xiaomi redmi note',
      'smart tv 65 4k', 'notebook gamer i7', 'fone bluetooth anc',
      'tênis corrida masculino', 'perfume importado masculino', 'air fryer digital',
      'suplemento whey protein', 'cadeira gamer', 'kit skincare facial',
      'aspirador robô wifi', 'tablet android', 'câmera mirrorless',
    ]

    const seen = new Set<string>()
    const todos: any[] = []

    // Fase 1: por categoria ML — 2 páginas por categoria (offset 0 e 50) → 15 cats × 100 = 1500 raw
    for (let i = 0; i < CATS_ML.length; i += 3) {
      const lote = CATS_ML.slice(i, i + 3)
      const resultados = await Promise.all([
        ...lote.map(cat => buscarMLBrowser('', 50, undefined, cat, 0)),
        ...lote.map(cat => buscarMLBrowser('', 50, undefined, cat, 50)),
      ])
      for (const prods of resultados) {
        for (const p of prods) {
          if (p.produto_ext_id && !seen.has(p.produto_ext_id)) { seen.add(p.produto_ext_id); todos.push(p) }
        }
      }
    }

    // Fase 2: por palavra-chave (15 termos, lotes de 5 em paralelo)
    for (let i = 0; i < TERMOS.length; i += 5) {
      const lote = TERMOS.slice(i, i + 5)
      const resultados = await Promise.all(lote.map(t => buscarMLBrowser(t, 50)))
      for (const prods of resultados) {
        for (const p of prods) {
          if (p.produto_ext_id && !seen.has(p.produto_ext_id)) { seen.add(p.produto_ext_id); todos.push(p) }
        }
      }
    }

    if (todos.length > 0) {
      // Ordena por maior comissão estimada
      todos.sort((a, b) => (b.comissao_valor || 0) - (a.comissao_valor || 0))
      setRes(todos)
      setLoadingAuto(false)
      return
    }

    // Fallback: backend (cold start Render)
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 90000)
      const r = await fetch(`${API}/afiliados/ml-destaques?limit=300`, { headers: hdr(), signal: ctrl.signal })
      clearTimeout(timer)
      if (r.ok) {
        const d = await r.json()
        const prods: any[] = d.resultados || []
        if (prods.length > 0) { setRes(prods); setLoadingAuto(false); return }
      }
    } catch {}

    setErro('sem_produtos')
    setLoadingAuto(false)
  }

  async function buscar() {
    // Busca vazia → recarrega os 200 destaques
    if (!query.trim()) { buscarAuto(); return }
    setLoading(true); setRes([]); setErro('')
    if (plat === 'ML_AFILIADOS') {
      try {
        const p = new URLSearchParams({ q: query, plataforma: 'ML_AFILIADOS', ordenar, limit: '24' })
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
    await fetch(`${API}/afiliados/catalogo`, { method:'POST', headers:hdr(), body:JSON.stringify(p) })
    carregarCatalogo(); setAba('catalogo')
  }

  async function publicarTudo(p: any) {
    // Se já tem id (produto do catálogo), usa direto; senão salva primeiro
    let prodId = p.id || p.produto_id
    if (!prodId) {
      const rs = await fetch(`${API}/afiliados/catalogo`, { method:'POST', headers:hdr(), body:JSON.stringify(p) })
      const ds = await rs.json()
      prodId = ds.id || ds.produto_id
    }
    if (!prodId) { alert('Erro ao salvar produto'); return }
    setPublicandoId(prodId)
    setResultadoPublicar(null)
    try {
      const r = await fetch(`${API}/vendedor/publicar-tudo`, {
        method:'POST', headers:hdr(),
        body:JSON.stringify({ produto_id:prodId, publicar_redes:true, modo_afiliado:false })
      })
      setResultadoPublicar(await r.json())
      carregarCatalogo()
    } catch(e:any) { setResultadoPublicar({ erro: e.message }) }
    setPublicandoId(null)
  }

  async function enviarTodosNaoPublicados() {
    const pendentes = catalogo.filter(p => p.pub_status !== 'ml_vendedor')
    if (pendentes.length === 0 || enviandoTodos) return
    setEnviandoTodos(true)
    setResultadoEnvioTodos(null)
    setProgressoEnvio({ atual:0, total:pendentes.length })
    const falhas: { titulo:string, motivo:string }[] = []
    let sucesso = 0
    for (let i = 0; i < pendentes.length; i++) {
      const p = pendentes[i]
      setProgressoEnvio({ atual:i+1, total:pendentes.length })
      try {
        const r = await fetch(`${API}/vendedor/publicar-tudo`, {
          method:'POST', headers:hdr(),
          body:JSON.stringify({ produto_id:p.id, publicar_redes:true, modo_afiliado:false })
        })
        const d = await r.json()
        const passoMl = (d.passos||[]).find((s:any) => s.passo === 'ML Vendedor')
        if (passoMl?.status?.startsWith('✅')) sucesso++
        else falhas.push({ titulo:p.titulo, motivo: passoMl?.status || 'Falha desconhecida' })
      } catch (e:any) {
        falhas.push({ titulo:p.titulo, motivo: e.message })
      }
    }
    await carregarCatalogo()
    setEnviandoTodos(false)
    setResultadoEnvioTodos({ total:pendentes.length, sucesso, falhas })
  }

  async function importarLink() {
    if (!inputLink.trim()) return
    setLoadingImport(true); setImportErro(''); setImportResult(null)
    setPrecoManual(''); setImagemManual(''); setTituloManual('')
    const texto = inputLink.trim()

    // Resolve meli.la → backend segue o redirect
    let textoReal = texto
    if (/meli\.la\//i.test(texto)) {
      try {
        const rr = await fetch(`${API}/afiliados/resolver-link?url=${encodeURIComponent(texto)}`, { headers: hdr() })
        if (rr.ok) { const dd = await rr.json(); if (dd.url_real) textoReal = dd.url_real }
      } catch {}
    }

    // Extrai IDs: wid= ou item_id= (mesmo URL-encoded como %3A) tem o item real com preço
    const textoDecoded = (() => { try { return decodeURIComponent(textoReal) } catch { return textoReal } })()
    const itemIdMatch = textoDecoded.match(/[?&#&](?:item_id|wid)[=:](MLB[\d]+)/i)
      || textoReal.match(/[?&](?:item_id|wid)=?(MLB[\d]+)/i)
    const mlMatch = textoReal.match(/MLB-?(\d+)/i)
    if (!mlMatch) {
      setImportErro('Link inválido. Use um link do Mercado Livre com MLB no endereço.')
      setLoadingImport(false); return
    }
    const catalogId  = `MLB${mlMatch[1]}`
    const itemId     = itemIdMatch ? itemIdMatch[1] : catalogId
    const varMatch   = textoReal.match(/[?&]searchVariation=(\d+)/i)
    const variationId = varMatch ? varMatch[1] : null

    // Extrai título do slug da URL — suporta dois formatos:
    // Formato 1: /MLB-digits-titulo-do-produto-_JM  (item direto)
    // Formato 2: /slug-titulo/p/MLB...              (catálogo /p/)
    function extrairTituloSlug(url: string): string {
      const fixes: Record<string,string> = {
        'tnis':'Tênis','calcado':'Calçado','calcados':'Calçados','camiseta':'Camiseta',
        'calcas':'Calças','oculos':'Óculos','eletrico':'Elétrico','eletrica':'Elétrica',
        'frequncia':'Frequência','funcoes':'Funções','automatica':'Automática',
        'inox':'Inox','portatil':'Portátil',
      }
      const toTitle = (slug: string) =>
        slug.split('-').filter(Boolean).map(p => { const l=p.toLowerCase(); return fixes[l]||(l.charAt(0).toUpperCase()+l.slice(1)) }).join(' ')
      // Formato 1: item direto
      const m1 = url.match(/MLB-\d+-(.+?)(?:-_JM|\?|#|$)/i)
      if (m1) return toTitle(m1[1])
      // Formato 2: catálogo /p/MLB
      const m2 = url.match(/mercadolivre\.com\.br\/([^/?#]+)\/p\/MLB/i)
      if (m2) return toTitle(m2[1])
      return ''
    }

    // Função auxiliar para montar produto a partir de resultado de search
    function montarDeBusca(res: any) {
      const pct = comissaoML(res.category_id || '')
      const preco = parseFloat(res.price || 0)
      return {
        produto_ext_id: res.id || itemId, titulo: res.title,
        preco, preco_original: res.original_price || null,
        comissao_pct: pct, comissao_valor: Math.round(preco*pct/100*100)/100,
        imagem_url: (res.thumbnail||'').replace('I.jpg','O.jpg').replace('http://','https://'),
        url_produto: res.permalink || textoReal,
        vendas_mes: res.sold_quantity||0, avaliacao:0, total_avaliacoes:0,
        categoria: res.category_id||'', plataforma:'ML_AFILIADOS',
      }
    }

    // Função auxiliar para montar produto a partir dos dados do /items endpoint
    function montarDeItem(id_data: any, preco_override?: number) {
      let preco = preco_override ?? parseFloat(id_data.price || 0)
      if (!preco_override && variationId && id_data.variations?.length) {
        const varData = id_data.variations.find((v:any) => String(v.id) === String(variationId))
        if (varData?.price) preco = parseFloat(varData.price)
      }
      const pct = comissaoML(id_data.category_id || '')
      const img = (id_data.thumbnail||'').replace('I.jpg','O.jpg').replace('http://','https://')
      return {
        produto_ext_id: id_data.id, titulo: id_data.title,
        preco, preco_original: id_data.original_price || null,
        comissao_pct: pct, comissao_valor: Math.round(preco*pct/100*100)/100,
        imagem_url: img, url_produto: id_data.permalink || textoReal,
        vendas_mes: id_data.sold_quantity||0, avaliacao:0, total_avaliacoes:0,
        categoria: id_data.category_id||'', plataforma:'ML_AFILIADOS',
      }
    }

    // Detecta se é URL de catálogo /p/MLB (múltiplos vendedores) ou item direto
    const isCatalogUrl = /\/p\/MLB/i.test(textoReal)

    // ── URLs de CATÁLOGO (/p/MLB...) ─────────────────────────────────────────
    // Usa API /products/{id} para título+foto e search price_asc para menor preço
    if (isCatalogUrl) {
      try {
        const [prodR, priceR] = await Promise.all([
          fetch(`https://api.mercadolibre.com/products/${catalogId}`),
          fetch(`https://api.mercadolibre.com/sites/MLB/search?catalog_product_id=${catalogId}&sort=price_asc&limit=5`)
        ])
        const prodData   = prodR.ok   ? await prodR.json()   : null
        const searchData = priceR.ok  ? await priceR.json()  : null
        const titulo = prodData?.name || prodData?.names?.pt_BR || ''
        const foto   = (prodData?.pictures?.[0]?.url || '').replace('I.jpg','O.jpg').replace('http://','https://')
        const cheapest = (searchData?.results||[]).find((r:any) => parseFloat(r.price||0) > 0)
        if (titulo && cheapest) {
          const pct = comissaoML(cheapest.category_id || '')
          const preco = parseFloat(cheapest.price || 0)
          setImportResult({ produto: {
            produto_ext_id: cheapest.id || catalogId, titulo,
            preco, preco_original: cheapest.original_price || null,
            comissao_pct: pct, comissao_valor: Math.round(preco*pct/100*100)/100,
            imagem_url: foto || (cheapest.thumbnail||'').replace('I.jpg','O.jpg').replace('http://','https://'),
            url_produto: cheapest.permalink || textoReal.split('?')[0].split('#')[0],
            vendas_mes: cheapest.sold_quantity||0, avaliacao:0, total_avaliacoes:0,
            categoria: cheapest.category_id||'', plataforma:'ML_AFILIADOS',
          }, copies: {} })
          setLoadingImport(false); return
        }
        // Se pelo menos tem título e foto, usa mesmo sem preço
        if (titulo) {
          const pct = 6
          setImportResult({ produto: {
            produto_ext_id: catalogId, titulo,
            preco: parseFloat(cheapest?.price||0), preco_original: null,
            comissao_pct: pct, comissao_valor: 0,
            imagem_url: foto, url_produto: textoReal.split('?')[0].split('#')[0],
            vendas_mes: 0, avaliacao:0, total_avaliacoes:0, categoria:'', plataforma:'ML_AFILIADOS',
          }, copies: {} })
          setLoadingImport(false); return
        }
      } catch {}
    }

    // ── URLs de ITEM DIRETO (produto.mercadolivre.com.br/MLB-...) ────────────
    // Busca direta ao ML via browser (IP residencial, sem bloqueio)
    if (!isCatalogUrl) {
      try {
        const r0 = await fetch(`https://api.mercadolibre.com/items/${itemId}?attributes=id,title,price,original_price,thumbnail,permalink,sold_quantity,category_id,variations`)
        if (r0.ok) {
          const id_data = await r0.json()
          if (id_data.title && parseFloat(id_data.price || 0) > 0) {
            setImportResult({ produto: montarDeItem(id_data), copies: {} })
            setLoadingImport(false); return
          }
        }
      } catch {}
    }

    // Proxy Vercel: tenta multiget/scraping como fallback
    try {
      const tok = await getMLToken()
      const params = new URLSearchParams({ id: itemId, url: textoReal.split('#')[0].split('?')[0] })
      if (tok) params.set('token', tok)
      const ir = await fetch(`/api/ml-item?${params}`)
      if (ir.ok) {
        const id_data = await ir.json()
        if (id_data.title && parseFloat(id_data.price || 0) > 0) {
          setImportResult({ produto: montarDeItem(id_data), copies: {} })
          setLoadingImport(false); return
        }
      }
    } catch {}

    // Busca pelo item ID real na search (encontra o produto pelo ID)
    if (itemId !== catalogId) {
      try {
        const sr2 = await fetch(`https://api.mercadolibre.com/sites/MLB/search?q=${itemId}&limit=10`)
        if (sr2.ok) {
          const sd2 = await sr2.json()
          const res2 = (sd2.results||[]).find((r:any) => r.id === itemId)
          if (res2?.title && parseFloat(res2.price||0) > 0) {
            setImportResult({ produto: montarDeBusca(res2), copies: {} })
            setLoadingImport(false); return
          }
        }
      } catch {}
    }

    // 4) Fallback: backend (Render)
    try {
      let url = `${API}/afiliados/importar-catalogo?catalog_id=${itemId}`
      if (variationId) url += `&variation_id=${variationId}`
      const r = await fetch(url, { headers: hdr() })
      if (r.ok) {
        const d = await r.json()
        if (d.titulo && d.titulo !== itemId && d.imagem_url) {
          const pct = comissaoML(d.categoria || '')
          setImportResult({ produto: { ...d, comissao_pct: pct, comissao_valor: Math.round((d.preco||0)*pct/100*100)/100, preco_original: null, vendas_mes: 0, avaliacao: 0, total_avaliacoes: 0 }, copies: {} })
          setLoadingImport(false); return
        }
      }
    } catch {}

    // 5) Último recurso: extrai título da URL (slug antes do /p/MLB ou depois do MLB-digits-)
    const tituloSlug = extrairTituloSlug(textoReal)
    const pct = 6
    const prod = {
      produto_ext_id: itemId, titulo: tituloSlug || catalogId,
      preco: 0, preco_original: null, comissao_pct: pct, comissao_valor: 0,
      imagem_url: '', url_produto: textoReal.split('?')[0].split('#')[0],
      vendas_mes: 0, avaliacao: 0, total_avaliacoes: 0, categoria: '', plataforma: 'ML_AFILIADOS',
    }
    setTituloManual(tituloSlug)
    setImportResult({ produto: prod, copies: {}, precisaImagem: true })
    setLoadingImport(false)
  }

  async function copiarTexto(texto: string, key: string) {
    await navigator.clipboard.writeText(texto)
    setCopiedKey(key); setTimeout(() => setCopiedKey(''), 2000)
  }

  async function salvarImportado() {
    if (!importResult?.produto) return
    const prod = { ...importResult.produto }
    if (prod.preco === 0 && precoManual && parseFloat(precoManual) > 0) {
      prod.preco = parseFloat(precoManual)
      prod.comissao_valor = Math.round(prod.preco * prod.comissao_pct / 100 * 100) / 100
    }
    if (tituloManual) prod.titulo = tituloManual
    if (imagemManual) prod.imagem_url = imagemManual
    await salvarProduto(prod)
    setModalLink(false); setImportResult(null); setInputLink(''); setPrecoManual(''); setImagemManual(''); setTituloManual('')
    setAba('catalogo')
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
            <button onClick={() => { setModalLink(true); setImportResult(null); setImportErro(''); setInputLink(''); setPrecoManual(''); setImagemManual(''); setTituloManual('') }}
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
                  className="w-full pl-8 pr-8 py-2 text-xs rounded-lg"/>
                {query && (
                  <button onClick={() => { setQuery(''); buscarAuto() }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background:'var(--card)', color:'var(--muted)' }}>
                    <X size={10}/>
                  </button>
                )}
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

            {!loading && !loadingAuto && resultados.length === 0 && (
              <div className="rounded-xl p-6 flex flex-col items-center gap-3 text-center" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
                <span className="text-4xl">🔍</span>
                <p className="text-sm font-black text-white">Busque produtos para promover</p>
                <p className="text-xs" style={{ color:'var(--muted)' }}>Digite no campo acima: <strong style={{color:'#f97316'}}>tênis, fone bluetooth, smartphone...</strong></p>
                <p className="text-xs" style={{ color:'var(--muted)' }}>Ou importe direto pelo link com o botão <strong style={{color:'#f97316'}}>"Importar Link ML"</strong></p>
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
          ) : (() => {
            const naoPublicados = catalogo.filter(p => p.pub_status !== 'ml_vendedor').length
            const noML          = catalogo.filter(p => p.pub_status === 'ml_vendedor').length
            const afiliados     = catalogo.filter(p => p.pub_status === 'afiliado').length
            const filtrados = filtroCat === 'nao_publicado'
              ? catalogo.filter(p => p.pub_status !== 'ml_vendedor')
              : filtroCat === 'ml_vendedor'
              ? catalogo.filter(p => p.pub_status === 'ml_vendedor')
              : filtroCat === 'afiliado'
              ? catalogo.filter(p => p.pub_status === 'afiliado')
              : catalogo
            return (
            <>
              {/* Filtros */}
              <div className="flex gap-1.5 flex-wrap mb-2">
                {([
                  { key:'todos',         label:`Todos (${catalogo.length})`,          cor:'#f97316' },
                  { key:'nao_publicado', label:`⚡ Não publicados (${naoPublicados})`, cor:'#ef4444' },
                  { key:'ml_vendedor',   label:`✅ No ML (${noML})`,                   cor:'#22c55e' },
                  { key:'afiliado',      label:`🔗 Só afiliado (${afiliados})`,        cor:'#f59e0b' },
                ] as const).map(f => (
                  <button key={f.key} onClick={() => setFiltroCat(f.key)}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-bold"
                    style={{
                      background: filtroCat===f.key ? f.cor+'25' : 'var(--card)',
                      border: `1px solid ${filtroCat===f.key ? f.cor : 'var(--border)'}`,
                      color: filtroCat===f.key ? f.cor : 'var(--muted)',
                    }}>
                    {f.label}
                  </button>
                ))}
                {naoPublicados > 0 && (
                  <button onClick={enviarTodosNaoPublicados} disabled={enviandoTodos}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-black text-white flex items-center gap-1.5 ml-auto"
                    style={{ background: enviandoTodos ? 'var(--card2)' : 'linear-gradient(135deg,#7c3aed,#f97316)', opacity: enviandoTodos ? 0.7 : 1 }}>
                    {enviandoTodos
                      ? <><RefreshCw size={11} className="animate-spin"/> Enviando {progressoEnvio.atual}/{progressoEnvio.total}...</>
                      : <><Zap size={11}/> Enviar Todos ({naoPublicados})</>}
                  </button>
                )}
              </div>
              <div className="grid gap-2" style={{ gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))' }}>
              {filtrados.map((p,i) => {
                const pubBadge = p.pub_status === 'ml_vendedor'
                  ? { label:'✅ No ML',   bg:'rgba(34,197,94,0.2)',  cor:'#22c55e',  border:'rgba(34,197,94,0.5)'  }
                  : p.pub_status === 'afiliado'
                  ? { label:'🔗 Afiliado', bg:'rgba(249,115,22,0.2)', cor:'#f97316',  border:'rgba(249,115,22,0.5)' }
                  : p.pub_status === 'pendente'
                  ? { label:'⏳ Pendente', bg:'rgba(245,158,11,0.2)', cor:'#f59e0b',  border:'rgba(245,158,11,0.5)' }
                  : null
                return (
                <div key={i} className="rounded-xl overflow-hidden" style={{ background:'var(--card)', border:`1px solid ${pubBadge ? pubBadge.border : 'var(--border)'}` }}>
                  <div className="relative flex items-center justify-center p-2" style={{ background:'var(--card2)', height:90 }}>
                    {p.imagem_url ? <img src={p.imagem_url} className="max-h-full object-contain"/> : <ShoppingBag size={28} color="var(--muted)"/>}
                    <button onClick={() => toggleFav(p.id)} className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center" style={{ background:'var(--card)' }}>
                      {p.favorito ? <Star size={12} color="#f59e0b" fill="#f59e0b"/> : <StarOff size={12} color="var(--muted)"/>}
                    </button>
                    {pubBadge && (
                      <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-black"
                        style={{ background: pubBadge.bg, color: pubBadge.cor, border:`1px solid ${pubBadge.border}` }}>
                        {pubBadge.label}
                      </span>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-[10px] font-bold text-white leading-tight mb-1" style={{ display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{p.titulo}</p>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-[10px] font-black" style={{ color:'#f97316' }}>{fmtR(p.preco)}</span>
                      <span className="text-[10px] font-bold" style={{ color:'#22c55e' }}>{p.comissao_pct}%</span>
                    </div>
                    {p.pub_status === 'ml_vendedor' && p.pub_url ? (
                      <a href={p.pub_url} target="_blank"
                        className="w-full py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 text-white mb-1"
                        style={{ background:'linear-gradient(135deg,#16a34a,#22c55e)' }}>
                        <ExternalLink size={10}/> Ver Anúncio ML
                      </a>
                    ) : (
                      <button onClick={() => publicarTudo(p)}
                        disabled={publicandoId===p.id}
                        className="w-full py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 text-white mb-1"
                        style={{ background: publicandoId===p.id ? 'var(--card2)' : 'linear-gradient(135deg,#7c3aed,#f97316)', opacity: publicandoId===p.id ? 0.6 : 1 }}>
                        {publicandoId===p.id ? <><RefreshCw size={10} className="animate-spin"/> Publicando...</> : <><Zap size={10}/> Publicar Tudo</>}
                      </button>
                    )}
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
                )
              })}
              </div>
            </>
            )
          })()}
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
                  {(resultadoPublicar.passos||[]).map((s:any,i:number) => {
                    const ico = s.status?.startsWith('✅') ? '✅'
                      : s.status?.startsWith('⚠️') ? '⚠️'
                      : s.status?.startsWith('⏭️') ? '⏭️'
                      : '❌'
                    return (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg" style={{ background:'var(--card2)' }}>
                      <span className="text-sm">{ico}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black text-white">{s.passo}</p>
                        <p className="text-[9px]" style={{ color:'var(--muted)' }}>{s.status?.replace(/^[\u{1F000}-\u{1FFFF}☀-⟿\s]+/u,'')}</p>
                        {s.detalhe && <p className="text-[9px] mt-1 break-all" style={{ color:'#ef4444' }}>{typeof s.detalhe === 'object' ? JSON.stringify(s.detalhe) : s.detalhe}</p>}
                        {s.url && <a href={s.url} target="_blank" className="text-[9px] text-blue-400 underline">Ver anúncio ↗</a>}
                        {s.link && (
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-[9px] truncate flex-1" style={{ color:'#22c55e' }}>{s.link}</span>
                            <button onClick={() => { navigator.clipboard.writeText(s.link); setCopiedKey('link_afil_'+i) }}
                              className="px-1.5 py-0.5 rounded text-[9px] font-bold flex-shrink-0"
                              style={{ background:'rgba(34,197,94,0.2)', color:'#22c55e' }}>
                              {copiedKey==='link_afil_'+i ? '✓ Copiado' : 'Copiar Link'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    )
                  })}
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

      {/* ── Modal Resultado Enviar Todos ─────────────────────────────────── */}
      {resultadoEnvioTodos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background:'rgba(0,0,0,0.75)' }}
          onClick={e => { if (e.target===e.currentTarget) setResultadoEnvioTodos(null) }}>
          <div className="w-full max-w-md mx-4 rounded-2xl overflow-hidden" style={{ background:'var(--card)', border:'1px solid #f97316', maxHeight:'85vh', display:'flex', flexDirection:'column' }}>
            <div className="px-4 py-3 flex items-center justify-between flex-shrink-0" style={{ background:'linear-gradient(135deg,#7c3aed,#f97316)' }}>
              <p className="font-black text-white text-sm flex items-center gap-2"><Zap size={14}/> Resultado — Enviar Todos</p>
              <button onClick={() => setResultadoEnvioTodos(null)} className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background:'rgba(255,255,255,0.2)' }}>
                <X size={12} color="#fff"/>
              </button>
            </div>
            <div className="p-4 space-y-2 overflow-y-auto">
              <div className="flex gap-2">
                <div className="flex-1 rounded-lg p-2 text-center" style={{ background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.2)' }}>
                  <p className="text-sm font-black" style={{ color:'#22c55e' }}>{resultadoEnvioTodos.sucesso}</p>
                  <p className="text-[9px]" style={{ color:'var(--muted)' }}>Publicados no ML</p>
                </div>
                <div className="flex-1 rounded-lg p-2 text-center" style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)' }}>
                  <p className="text-sm font-black" style={{ color:'#ef4444' }}>{resultadoEnvioTodos.falhas.length}</p>
                  <p className="text-[9px]" style={{ color:'var(--muted)' }}>Sem publicar (link afiliado gerado)</p>
                </div>
              </div>
              {resultadoEnvioTodos.falhas.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {resultadoEnvioTodos.falhas.map((f:any,i:number) => (
                    <div key={i} className="p-2 rounded-lg" style={{ background:'var(--card2)' }}>
                      <p className="text-[10px] font-bold text-white truncate">{f.titulo}</p>
                      <p className="text-[9px]" style={{ color:'#ef4444' }}>{f.motivo}</p>
                    </div>
                  ))}
                </div>
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
                      {(importResult.produto.imagem_url || imagemManual)
                        ? <img src={imagemManual || importResult.produto.imagem_url} className="w-14 h-14 object-contain rounded-lg flex-shrink-0" style={{ background:'var(--card)' }}/>
                        : <div className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background:'var(--card)' }}><ShoppingBag size={24} color="var(--muted)"/></div>}
                      <div className="flex-1 min-w-0">
                        {importResult.precisaImagem ? (
                          <input value={tituloManual} onChange={e => setTituloManual(e.target.value)}
                            className="w-full px-2 py-1 rounded-lg text-xs font-bold text-white mb-1"
                            style={{ background:'var(--card)', border:'1px solid var(--border)' }}
                            placeholder="Nome do produto"/>
                        ) : (
                          <p className="text-xs font-bold text-white leading-tight">{importResult.produto.titulo}</p>
                        )}
                        {importResult.produto.preco > 0 ? (
                          <>
                            <p className="text-lg font-black mt-1" style={{ color:'#f97316' }}>{fmtR(importResult.produto.preco)}</p>
                            <p className="text-[10px] font-bold" style={{ color:'#22c55e' }}>
                              Comissão: {importResult.produto.comissao_pct}% = {fmtR(importResult.produto.comissao_valor)}/venda
                            </p>
                          </>
                        ) : (
                          <div className="mt-1">
                            <p className="text-[10px] mb-1" style={{ color:'#f59e0b' }}>⚠️ Informe o preço do produto:</p>
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-bold text-white">R$</span>
                              <input type="number" value={precoManual} onChange={e => setPrecoManual(e.target.value)}
                                placeholder="145,00" className="flex-1 px-2 py-1 rounded-lg text-xs font-bold"
                                style={{ color:'#f97316' }}/>
                            </div>
                            {precoManual && parseFloat(precoManual) > 0 && (
                              <p className="text-[10px] mt-0.5 font-bold" style={{ color:'#22c55e' }}>
                                Comissão: {importResult.produto.comissao_pct}% = {fmtR(parseFloat(precoManual) * importResult.produto.comissao_pct / 100)}/venda
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Campo de imagem manual (quando ML bloqueia scraping) */}
                  {importResult.precisaImagem && (
                    <div className="rounded-xl p-3" style={{ background:'var(--card2)', border:'1px solid rgba(249,115,22,0.3)' }}>
                      <p className="text-[10px] mb-1 font-bold" style={{ color:'#f59e0b' }}>📷 Cole a URL da foto do produto (opcional):</p>
                      <p className="text-[10px] mb-2" style={{ color:'var(--muted)' }}>Abra o produto no ML → clique com botão direito na foto → "Copiar endereço da imagem"</p>
                      <input value={imagemManual} onChange={e => setImagemManual(e.target.value)}
                        className="w-full px-2 py-1 rounded-lg text-xs" placeholder="https://http2.mlstatic.com/..."
                        style={{ background:'var(--card)', border:'1px solid var(--border)', color:'var(--text)' }}/>
                    </div>
                  )}

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
