import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const q     = req.nextUrl.searchParams.get('q') || 'smartphone samsung'
  const limit = req.nextUrl.searchParams.get('limit') || '20'
  const sort  = req.nextUrl.searchParams.get('sort') || 'sold_quantity_desc'
  const token = req.nextUrl.searchParams.get('token') || ''

  const url = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(q)}&limit=${limit}&sort=${sort}`
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  try {
    const r = await fetch(url, { headers, next: { revalidate: 60 } })
    const data = await r.json()
    return NextResponse.json(data, { status: r.status })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'fetch error', results: [] }, { status: 500 })
  }
}
