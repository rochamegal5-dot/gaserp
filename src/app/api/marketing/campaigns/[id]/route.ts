import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const update: any = { updated_at: new Date().toISOString() }
    if (body.nombre !== undefined) update.nombre = body.nombre
    if (body.canal !== undefined) update.canal = body.canal
    if (body.target !== undefined) update.target = body.target
    if (body.mensaje !== undefined) update.mensaje = body.mensaje
    if (body.totalDestinatarios !== undefined) update.total_destinatarios = Number(body.totalDestinatarios)
    if (body.enviados !== undefined) update.enviados = Number(body.enviados)
    if (body.fallidos !== undefined) update.fallidos = Number(body.fallidos)
    if (body.estado !== undefined) update.estado = body.estado
    if (body.programadaPara !== undefined) update.programada_para = body.programadaPara
    if (body.iniciadaEn !== undefined) update.iniciada_en = body.iniciadaEn
    if (body.completadaEn !== undefined) update.completada_en = body.completadaEn
    if (body.filtroJson !== undefined) update.filtro_json = typeof body.filtroJson === 'string' ? body.filtroJson : JSON.stringify(body.filtroJson)
    if (body.resultadosJson !== undefined) update.resultados_json = typeof body.resultadosJson === 'string' ? body.resultadosJson : JSON.stringify(body.resultadosJson)

    const { data, error } = await supabase.from('campaigns').update(update).eq('id', id).select().single()
    if (error) {
      console.error('[api/marketing/campaigns/[id] PATCH]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data })
  } catch (e: any) {
    console.error('[api/marketing/campaigns/[id] PATCH]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { error } = await supabase.from('campaigns').delete().eq('id', id)
    if (error) {
      console.error('[api/marketing/campaigns/[id] DELETE]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[api/marketing/campaigns/[id] DELETE]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}
