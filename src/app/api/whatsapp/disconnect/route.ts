import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const res = await fetch('http://localhost:3004/disconnect', {
      method: 'POST',
      cache: 'no-store',
    })
    const text = await res.text()
    let json: any = text
    try { json = JSON.parse(text) } catch { /* keep text */ }
    return NextResponse.json(json, { status: res.status })
  } catch (e: any) {
    console.error('[api/whatsapp/disconnect POST]', e)
    return NextResponse.json({ error: e.message || 'whatsapp service unavailable' }, { status: 503 })
  }
}
