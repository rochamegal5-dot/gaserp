import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const repartidorId = searchParams.get('repartidor_id')
    const tipo = searchParams.get('tipo')
    const desde = searchParams.get('fecha_desde')
    const hasta = searchParams.get('fecha_hasta')

    let q = supabase
      .from('costos_repartidor')
      .select('*, repartidor:repartidores(*)')
      .order('fecha', { ascending: false })
    if (repartidorId) q = q.eq('repartidor_id', repartidorId)
    if (tipo) q = q.eq('tipo', tipo)
    if (desde) q = q.gte('fecha', desde)
    if (hasta) q = q.lte('fecha', hasta + 'T23:59:59.999Z')

    const { data, error } = await q
    if (error) {
      console.error('[api/costos-repartidor GET]', error.message)
      if (error.message.includes('Could not find the table')) {
        return NextResponse.json({ data: [], migration_required: true })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data: data || [] })
  } catch (e: any) {
    console.error('[api/costos-repartidor GET]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const repartidorId = body.repartidorId || body.repartidor_id
    const monto = Number(body.monto || 0)
    if (!repartidorId || monto <= 0) return NextResponse.json({ error: 'repartidorId and monto required' }, { status: 400 })

    const now = new Date().toISOString()
    const row = {
      id: crypto.randomUUID(),
      repartidor_id: repartidorId,
      tipo: body.tipo || 'otro',
      monto,
      fecha: body.fecha || now,
      detalle: body.detalle || null,
      litros: body.litros !== undefined ? Number(body.litros) : null,
      km_odometro: body.kmOdometro !== undefined ? Number(body.kmOdometro) : null,
      periodo_desde: body.periodoDesde || body.periodo_desde || null,
      periodo_hasta: body.periodoHasta || body.periodo_hasta || null,
      forma: body.forma || 'efectivo',
      created_at: now,
    }
    const { data, error } = await supabase.from('costos_repartidor').insert(row).select().single()
    if (error) {
      console.error('[api/costos-repartidor POST]', error.message)
      if (error.message.includes('Could not find the table')) {
        return NextResponse.json({ data: null, migration_required: true })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Also insert caja egreso
    await supabase.from('movimientos_caja').insert({
      id: crypto.randomUUID(),
      tipo: 'egreso',
      concepto: `Costo Repartidor (${row.tipo})`,
      monto,
      forma: row.forma,
      detalle: body.detalle || `Costo ${row.tipo} repartidor ${repartidorId}`,
      referencia_id: data.id,
      created_at: now,
    })

    return NextResponse.json({ data })
  } catch (e: any) {
    console.error('[api/costos-repartidor POST]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}
