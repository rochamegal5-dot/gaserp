import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const repartidorId = body.repartidorId || body.repartidor_id
    if (!repartidorId) return NextResponse.json({ error: 'repartidorId required' }, { status: 400 })

    const now = new Date().toISOString()

    // Find open jornada
    const { data: open } = await supabase
      .from('jornadas_repartidor')
      .select('*')
      .eq('repartidor_id', repartidorId)
      .eq('estado', 'abierta')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (open) {
      await supabase.from('jornadas_repartidor').update({
        estado: 'cerrada',
        cerrada_at: now,
      }).eq('id', open.id)
    }

    // Move repartidor stock back to deposito (zero out)
    const { data: sr } = await supabase.from('stock_repartidor').select('*').eq('repartidor_id', repartidorId)
    for (const s of sr || []) {
      if ((s.llenas || 0) > 0 || (s.vacias || 0) > 0 || (s.defectuosas || 0) > 0) {
        const { data: sd } = await supabase.from('stock_deposito').select('*').eq('producto_id', s.producto_id).maybeSingle()
        if (sd) {
          await supabase.from('stock_deposito').update({
            llenas: (sd.llenas || 0) + (s.llenas || 0),
            vacias: (sd.vacias || 0) + (s.vacias || 0),
            defectuosas: (sd.defectuosas || 0) + (s.defectuosas || 0),
          }).eq('id', sd.id)
        } else {
          await supabase.from('stock_deposito').insert({
            id: crypto.randomUUID(),
            producto_id: s.producto_id,
            llenas: s.llenas || 0,
            vacias: s.vacias || 0,
            defectuosas: s.defectuosas || 0,
          })
        }
        await supabase.from('movimientos_stock').insert({
          id: crypto.randomUUID(),
          tipo_mov: 'cierre_jornada',
          producto_id: s.producto_id,
          repartidor_id: repartidorId,
          llenas: -(s.llenas || 0),
          vacias: -(s.vacias || 0),
          defectuosas: -(s.defectuosas || 0),
          observaciones: 'Cierre jornada',
          referencia_id: open?.id || null,
          created_at: now,
        })
        await supabase.from('stock_repartidor').update({
          llenas: 0,
          vacias: 0,
          defectuosas: 0,
        }).eq('id', s.id)
      }
    }

    return NextResponse.json({ ok: true, cerrada_at: now, jornada_id: open?.id || null })
  } catch (e: any) {
    console.error('[api/stock/cierre POST]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}
