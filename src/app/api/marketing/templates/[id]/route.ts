import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const update: any = { updated_at: new Date().toISOString() }
    if (body.nombre !== undefined) update.nombre = body.nombre
    if (body.texto !== undefined) update.texto = body.texto
    if (body.canal !== undefined) update.canal = body.canal
    if (body.categoria !== undefined) update.categoria = body.categoria
    if (body.favorita !== undefined) update.favorita = !!body.favorita

    const { data, error } = await supabase.from('campaign_templates').update(update).eq('id', id).select().single()
    if (error) {
      console.error('[api/marketing/templates/[id] PATCH]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data })
  } catch (e: any) {
    console.error('[api/marketing/templates/[id] PATCH]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { error } = await supabase.from('campaign_templates').delete().eq('id', id)
    if (error) {
      console.error('[api/marketing/templates/[id] DELETE]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[api/marketing/templates/[id] DELETE]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const accion = searchParams.get('accion')
    if (accion !== 'incrementar-uso') {
      return NextResponse.json({ error: 'accion inválida (usar incrementar-uso)' }, { status: 400 })
    }
    const { data: tpl } = await supabase.from('campaign_templates').select('usos_count').eq('id', id).maybeSingle()
    const current = Number(tpl?.usos_count || 0)
    const { data, error } = await supabase.from('campaign_templates').update({
      usos_count: current + 1,
      updated_at: new Date().toISOString(),
    }).eq('id', id).select().single()
    if (error) {
      console.error('[api/marketing/templates/[id] POST]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data })
  } catch (e: any) {
    console.error('[api/marketing/templates/[id] POST]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}
