import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const jid = searchParams.get('jid')
    const url = new URL('http://localhost:3004/messages')
    if (jid) url.searchParams.set('jid', jid)
    const res = await fetch(url.toString(), { cache: 'no-store' })
    const text = await res.text()
    let json: any = text
    try { json = JSON.parse(text) } catch { /* keep text */ }
    return NextResponse.json(json, { status: res.status })
  } catch (e: any) {
    console.error('[api/whatsapp/messages GET]', e)
    return NextResponse.json({ error: e.message || 'whatsapp service unavailable', messages: [] }, { status: 503 })
  }
}
