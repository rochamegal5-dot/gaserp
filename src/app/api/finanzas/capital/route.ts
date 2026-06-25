import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data: capital, error } = await supabase
      .from('movimientos_capital')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      console.error('[api/finanzas/capital GET]', error.message)
      if (error.message.includes('Could not find the table')) {
        return NextResponse.json({ data: { entradas: 0, salidas: 0, ganancia: 0, patrimonio_neto: 0, movimientos: [] }, migration_required: true })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    let entradas = 0, salidas = 0
    for (const m of capital || []) {
      if (m.tipo === 'entrada') entradas += Number(m.monto || 0)
      else if (m.tipo === 'salida') salidas += Number(m.monto || 0)
    }
    return NextResponse.json({
      data: {
        entradas,
        salidas,
        ganancia: entradas - salidas,
        patrimonio_neto: entradas - salidas,
        movimientos: capital || [],
      },
    })
  } catch (e: any) {
    console.error('[api/finanzas/capital GET]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const tipo = body.tipo === 'salida' ? 'salida' : 'entrada'
    const monto = Number(body.monto || 0)
    const detalle = body.detalle || ''
    const forma = body.forma || 'efectivo'
    const now = new Date().toISOString()

    if (monto <= 0) return NextResponse.json({ error: 'monto required' }, { status: 400 })

    const { data, error } = await supabase.from('movimientos_capital').insert({
      id: crypto.randomUUID(),
      tipo,
      monto,
      detalle,
      created_at: now,
    }).select().single()
    if (error) {
      console.error('[api/finanzas/capital POST]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Also create a caja movement (egreso/ingreso) with forma
    await supabase.from('movimientos_caja').insert({
      id: crypto.randomUUID(),
      tipo: tipo === 'entrada' ? 'ingreso' : 'egreso',
      concepto: 'Capital',
      monto,
      forma,
      detalle: detalle || `Movimiento capital (${tipo})`,
      referencia_id: data.id,
      created_at: now,
    })

    return NextResponse.json({ data })
  } catch (e: any) {
    console.error('[api/finanzas/capital POST]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}
