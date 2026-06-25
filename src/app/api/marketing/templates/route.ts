import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data, error } = await supabase.from('campaign_templates').select('*').order('created_at', { ascending: false })
    if (error) {
      console.error('[api/marketing/templates GET]', error.message)
      if (error.message.includes('Could not find the table')) {
        return NextResponse.json({ data: [], migration_required: true })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data: data || [] })
  } catch (e: any) {
    console.error('[api/marketing/templates GET]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const now = new Date().toISOString()
    const row = {
      id: crypto.randomUUID(),
      nombre: body.nombre || '',
      texto: body.texto || '',
      canal: body.canal || 'whatsapp',
      categoria: body.categoria || null,
      favorita: !!body.favorita,
      usos_count: 0,
      created_at: now,
      updated_at: now,
    }
    const { data, error } = await supabase.from('campaign_templates').insert(row).select().single()
    if (error) {
      console.error('[api/marketing/templates POST]', error.message)
      if (error.message.includes('Could not find the table')) {
        return NextResponse.json({ data: null, migration_required: true })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data })
  } catch (e: any) {
    console.error('[api/marketing/templates POST]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}
