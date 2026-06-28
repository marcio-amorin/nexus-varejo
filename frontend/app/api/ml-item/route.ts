import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const id    = req.nextUrl.searchParams.get('id') || ''
  const token = req.nextUrl.searchParams.get('token') || ''

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const url = `https://api.mercadolibre.com/items/${id}`
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  try {
    const r = await fetch(url, { headers, next: { revalidate: 0 } })
    const data = await r.json()
    return NextResponse.json(data, { status: r.status })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'fetch error' }, { status: 500 })
  }
}
