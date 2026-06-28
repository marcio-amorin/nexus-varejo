import { NextRequest, NextResponse } from 'next/server'

const HDRS_BROWSER = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
}

function extractFromHtml(html: string, itemId: string) {
  // 1) JSON-LD schema (mais confiável)
  const ldMatches = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
  for (const m of ldMatches) {
    try {
      const ld = JSON.parse(m[1])
      const items = Array.isArray(ld) ? ld : [ld]
      for (const item of items) {
        const obj = item['@type'] === 'Product' ? item : (item['@graph'] || []).find((x:any) => x['@type'] === 'Product')
        if (!obj) continue
        const name   = obj.name || ''
        const price  = parseFloat(obj.offers?.price || obj.offers?.lowPrice || 0)
        const images = Array.isArray(obj.image) ? obj.image : (obj.image ? [obj.image] : [])
        const img    = (images[0] || '').replace('I.jpg', 'O.jpg')
        if (name) return { title: name, price, thumbnail: img, id: itemId }
      }
    } catch {}
  }

  // 2) __NEXT_DATA__ JSON embutido pelo SSR
  const ndMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (ndMatch) {
    try {
      const nd   = JSON.parse(ndMatch[1])
      const pdp  = nd?.props?.pageProps?.initialState?.pdp || nd?.props?.pageProps
      const comp = pdp?.components || {}
      // Procura título em vários caminhos possíveis
      const titleRaw = pdp?.head?.title || comp?.short_description?.title || ''
      const title = titleRaw.replace(/\s*\|.*$/, '').trim()
      const priceRaw = comp?.price?.prices?.price?.value || comp?.price?.price?.value || 0
      const price = parseFloat(priceRaw)
      const imgRaw = comp?.gallery?.pictures?.[0]?.url || ''
      if (title) return { title, price, thumbnail: imgRaw, id: itemId }
    } catch {}
  }

  // 3) Regex como último recurso
  const titleM = html.match(/<h1[^>]*class="[^"]*ui-pdp-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/)
    || html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/)
  const priceM  = html.match(/"price"\s*:\s*(\d+(?:\.\d+)?)/)
  const imgM    = html.match(/"https:\/\/([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/)

  const title  = titleM ? titleM[1].replace(/<[^>]+>/g, '').trim() : ''
  const price  = priceM ? parseFloat(priceM[1]) : 0
  const imgRaw = imgM   ? `https://${imgM[1]}`  : ''
  const thumbnail = imgRaw.replace('I.jpg', 'O.jpg')

  if (title) return { title, price, thumbnail, id: itemId }
  return null
}

export async function GET(req: NextRequest) {
  const id      = req.nextUrl.searchParams.get('id')    || ''
  const pageUrl = req.nextUrl.searchParams.get('url')   || ''
  const token   = req.nextUrl.searchParams.get('token') || ''

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // 1) ML items API com token (se disponível)
  if (token) {
    try {
      const r = await fetch(`https://api.mercadolibre.com/items/${id}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'User-Agent': HDRS_BROWSER['User-Agent'] },
        next: { revalidate: 0 },
      })
      if (r.ok) {
        const d = await r.json()
        if (d.title) return NextResponse.json(d)
      }
    } catch {}
  }

  // 2) ML items API sem token (pode funcionar para itens públicos)
  try {
    const r = await fetch(`https://api.mercadolibre.com/items/${id}`, {
      headers: { Accept: 'application/json', 'User-Agent': HDRS_BROWSER['User-Agent'] },
      next: { revalidate: 0 },
    })
    if (r.ok) {
      const d = await r.json()
      if (d.title) return NextResponse.json(d)
    }
  } catch {}

  // 3) Scraping da página HTML do produto (não precisa de auth)
  const urls = pageUrl
    ? [pageUrl.split('#')[0]]
    : [`https://produto.mercadolivre.com.br/${id.replace(/^MLB/, 'MLB-')}`, `https://www.mercadolivre.com.br/i/${id}`]

  for (const url of urls) {
    try {
      const r = await fetch(url, { headers: HDRS_BROWSER as any, redirect: 'follow', next: { revalidate: 0 } })
      if (!r.ok) continue
      const html = await r.text()
      const result = extractFromHtml(html, id)
      if (result?.title) {
        // Formata igual ao /items endpoint para o frontend processar igual
        return NextResponse.json({
          id: result.id,
          title: result.title,
          price: result.price,
          original_price: null,
          thumbnail: result.thumbnail,
          permalink: pageUrl || url,
          category_id: '',
          sold_quantity: 0,
        })
      }
    } catch {}
  }

  return NextResponse.json({ error: 'product not found' }, { status: 404 })
}
