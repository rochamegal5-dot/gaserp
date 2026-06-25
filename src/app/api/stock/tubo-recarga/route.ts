import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const repartidorId = body.repartidorId || body.repartidor_id
    const productoId = body.productoId || body.producto_id
    const kilos = Number(body.kilos || body.kilos_gas || 0)
    const detalle = body.detalle || 'Recarga tubo'

    if (!repartidorId || !productoId || kilos <= 0) {
      return NextResponse.json({ error: 'repartidorId, productoId, kilos required' }, { status: 400 })
    }

    const { error } = await supabase.from('movimientos_stock').insert({
      id: crypto.randomUUID(),
      tipo_mov: 'tubo_recarga',
      producto_id: productoId,
      repartidor_id: repartidorId,
      kilos_gas: kilos,
      observaciones: detalle,
      created_at: new Date().toISOString(),
    })
    if (error) {
      console.error('[api/stock/tubo-recarga POST]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[api/stock/tubo-recarga POST]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}
