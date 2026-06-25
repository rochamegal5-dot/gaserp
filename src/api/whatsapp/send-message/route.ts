import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const res = await fetch('http://localhost:3004/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: body.to, text: body.text }),
      cache: 'no-store',
    })
    const text = await res.text()
    let json: any = text
    try { json = JSON.parse(text) } catch { /* keep text */ }
    return NextResponse.json(json, { status: res.status })
  } catch (e: any) {
    console.error('[api/whatsapp/send-message POST]', e)
    return NextResponse.json({ error: e.message || 'whatsapp service unavailable' }, { status: 503 })
  }
}
