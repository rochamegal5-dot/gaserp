import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const res = await fetch('http://localhost:3004/chats', { cache: 'no-store' })
    const text = await res.text()
    let json: any = text
    try { json = JSON.parse(text) } catch { /* keep text */ }
    return NextResponse.json(json, { status: res.status })
  } catch (e: any) {
    console.error('[api/whatsapp/chats GET]', e)
    return NextResponse.json({ error: e.message || 'whatsapp service unavailable', chats: [] }, { status: 503 })
  }
}
