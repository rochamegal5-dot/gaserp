import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const repartidorId = body.repartidorId || body.repartidor_id || body.repartidor
    const latitud = Number(body.latitud ?? body.lat ?? 0)
    const longitud = Number(body.longitud ?? body.lng ?? body.lon ?? 0)
    const velocidad = Number(body.velocidad ?? body.speed ?? 0)
    const timestamp = body.timestamp || new Date().toISOString()

    if (!repartidorId) return NextResponse.json({ error: 'repartidorId required' }, { status: 400 })

    const row: any = {
      id: crypto.randomUUID(),
      repartidor_id: repartidorId,
      latitud,
      longitud,
      velocidad,
      timestamp,
    }
    if (body.altitud !== undefined) row.altitud = Number(body.altitud)
    if (body.precision !== undefined) row.precision = Number(body.precision)
    if (body.precision_gps !== undefined) row.precision_gps = Number(body.precision_gps)
    if (body.heading !== undefined) row.heading = Number(body.heading)
    if (body.en_movimiento !== undefined) row.en_movimiento = !!body.en_movimiento
    if (body.bateria !== undefined) row.bateria = Number(body.bateria)

    const { data, error } = await supabase.from('ubicaciones').insert(row).select().single()
    if (error) {
      console.error('[api/rutas POST]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data })
  } catch (e: any) {
    console.error('[api/rutas POST]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}
