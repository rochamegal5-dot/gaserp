import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const desde = searchParams.get('fecha_desde')
    const hasta = searchParams.get('fecha_hasta')

    const { data: reps } = await supabase.from('repartidores').select('*')
    const result: any[] = []

    for (const rep of reps || []) {
      // Ventas del rep
      let vq = supabase
        .from('ventas')
        .select('total, metodo_pago, estado, created_at, producto_id, producto:productos(*)')
        .eq('repartidor_id', rep.id)
      if (desde) vq = vq.gte('created_at', desde)
      if (hasta) vq = vq.lte('created_at', hasta + 'T23:59:59.999Z')
      const { data: ventas } = await vq

      // Costos del rep
      let cq = supabase
        .from('costos_repartidor')
        .select('monto, tipo, fecha')
        .eq('repartidor_id', rep.id)
      if (desde) cq = cq.gte('fecha', desde)
      if (hasta) cq = cq.lte('fecha', hasta + 'T23:59:59.999Z')
      const { data: costos } = await cq

      const totalVentas = (ventas || []).reduce((s, v) => s + Number(v.total || 0), 0)
      // Margen = ventas - costo (need to compute cost of product sold)
      let costoTotal = 0
      for (const v of ventas || []) {
        if (v.producto && Array.isArray(v.producto)) {
          costoTotal += Number(v.producto[0]?.costo || 0)
        } else {
          costoTotal += Number((v.producto as any)?.costo || 0)
        }
      }
      const totalCostos = (costos || []).reduce((s, c) => s + Number(c.monto || 0), 0)
      const totalEgresos = costoTotal + totalCostos
      const ganancia = totalVentas - totalEgresos
      const margen = totalVentas > 0 ? Math.round((ganancia / totalVentas) * 100) : 0

      result.push({
        repartidor_id: rep.id,
        repartidor_nombre: rep.nombre,
        ventas_count: ventas?.length || 0,
        ventas_total: totalVentas,
        costo_productos: costoTotal,
        costos_repartidor: totalCostos,
        total_egresos: totalEgresos,
        ganancia,
        margen_pct: margen,
      })
    }
    return NextResponse.json({ data: result })
  } catch (e: any) {
    console.error('[api/rentabilidad-repartidor GET]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}
