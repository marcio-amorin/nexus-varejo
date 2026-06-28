import { NextRequest, NextResponse } from 'next/server'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

export async function GET(req: NextRequest) {
  const id      = req.nextUrl.searchParams.get('id')    || ''
  const pageUrl = req.nextUrl.searchParams.get('url')   || ''
  const token   = req.nextUrl.searchParams.get('token') || ''

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const debug: Record<string, any> = {}

  // 1) ML multiget /items?ids= (diferente do /items/{id}, pode ter auth diferente)
  try {
    const hdrs: Record<string, string> = { 'User-Agent': UA, Accept: 'application/json' }
    if (token) hdrs.Authorization = `Bearer ${token}`
    const r = await fetch(
      `https://api.mercadolibre.com/items?ids=${id}&attributes=id,title,price,original_price,thumbnail,permalink,sold_quantity,category_id`,
      { headers: hdrs, cache: 'no-store' }
    )
    debug.multiget_status = r.status
    if (r.ok) {
      const arr = await r.json()
      const item = arr?.[0]?.body || arr?.[0]
      debug.multiget_title = item?.title
      if (item?.title) return NextResponse.json(item)
    }
  } catch (e: any) { debug.multiget_error = e?.message }

  // 2) ML single item /items/{id}
  try {
    const hdrs: Record<string, string> = { 'User-Agent': UA, Accept: 'application/json' }
    if (token) hdrs.Authorization = `Bearer ${token}`
    const r = await fetch(`https://api.mercadolibre.com/items/${id}`, { headers: hdrs, cache: 'no-store' })
    debug.single_status = r.status
    if (r.ok) {
      const d = await r.json()
      debug.single_title = d?.title
      if (d.title) return NextResponse.json(d)
    }
  } catch (e: any) { debug.single_error = e?.message }

  // 3) Scraping HTML — usa URL limpa (sem query params de rastreamento)
  const cleanUrl = (pageUrl || '').split('?')[0].split('#')[0]
    || `https://produto.mercadolivre.com.br/${id.replace(/^MLB/, 'MLB-')}`
  debug.scrape_url = cleanUrl
  try {
    const r = await fetch(cleanUrl, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'pt-BR,pt;q=0.9' },
      redirect: 'follow',
      cache: 'no-store',
    })
    debug.scrape_status = r.status
    if (r.ok) {
      const html = await r.text()
      debug.html_len = html.length

      // OG meta tags (mais simples e confiáveis)
      const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1]
        || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i)?.[1]
      const ogImage = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)?.[1]
        || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i)?.[1]
      const ogPrice = html.match(/<meta[^>]+property="product:price:amount"[^>]+content="([^"]+)"/i)?.[1]
        || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="product:price:amount"/i)?.[1]
      debug.og = { ogTitle, ogImage, ogPrice }

      // JSON-LD
      let ldTitle = '', ldPrice = 0, ldImage = ''
      for (const m of [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]) {
        try {
          const ld = JSON.parse(m[1])
          const objs = Array.isArray(ld) ? ld : [ld, ...(ld['@graph'] || [])]
          const prod = objs.find((o: any) => o['@type'] === 'Product')
          if (prod) {
            ldTitle = prod.name || ''
            ldPrice = parseFloat(prod.offers?.price || prod.offers?.lowPrice || 0)
            const imgs = Array.isArray(prod.image) ? prod.image : (prod.image ? [prod.image] : [])
            ldImage = imgs[0] || ''
            break
          }
        } catch {}
      }
      debug.ld = { ldTitle, ldPrice, ldImage }

      const title = ogTitle || ldTitle
      const image = (ogImage || ldImage || '').replace('I.jpg', 'O.jpg')
      const price = parseFloat(ogPrice || String(ldPrice) || '0')

      if (title) {
        return NextResponse.json({ id, title, price, original_price: null, thumbnail: image, permalink: cleanUrl, category_id: '', sold_quantity: 0 })
      }

      // Retorna debug para diagnóstico
      debug.html_sample = html.slice(0, 1000)
    }
  } catch (e: any) { debug.scrape_error = e?.message }

  return NextResponse.json({ error: 'not_found', debug }, { status: 404 })
}
