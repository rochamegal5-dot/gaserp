import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const anioParam = searchParams.get('anio')
    const anio = anioParam ? Number(anioParam) : new Date().getFullYear()

    const start = new Date(anio, 0, 1).toISOString()
    const end = new Date(anio, 11, 31, 23, 59, 59, 999).toISOString()

    // Ingresos y egresos por mes desde movimientos_caja
    const { data: caja, error: cErr } = await supabase
      .from('movimientos_caja')
      .select('tipo, monto, created_at')
      .gte('created_at', start)
      .lte('created_at', end)
    if (cErr) {
      console.error('[api/finanzas/historico GET]', cErr.message)
      if (cErr.message.includes('Could not find the table')) {
        return NextResponse.json({ data: { anio, meses: [], migration_required: true } })
      }
      return NextResponse.json({ error: cErr.message }, { status: 500 })
    }

    // Capital
    const { data: cap } = await supabase
      .from('movimientos_capital')
      .select('tipo, monto, created_at')
      .gte('created_at', start)
      .lte('created_at', end)

    // Ventas
    const { data: ventas } = await supabase
      .from('ventas')
      .select('total, created_at')
      .gte('created_at', start)
      .lte('created_at', end)

    const byMonth: any[] = []
    let acumulado = 0
    for (let m = 0; m < 12; m++) {
      const monthStart = new Date(anio, m, 1).toISOString()
      const monthEnd = new Date(anio, m + 1, 0, 23, 59, 59, 999).toISOString()
      let ingresos = 0, egresos = 0, capitalEntradas = 0, capitalSalidas = 0, ventasTotal = 0
      for (const c of caja || []) {
        if (c.created_at >= monthStart && c.created_at <= monthEnd) {
          if (c.tipo === 'ingreso') ingresos += Number(c.monto || 0)
          else if (c.tipo === 'egreso') egresos += Number(c.monto || 0)
        }
      }
      for (const cp of cap || []) {
        if (cp.created_at >= monthStart && cp.created_at <= monthEnd) {
          if (cp.tipo === 'entrada') capitalEntradas += Number(cp.monto || 0)
          else if (cp.tipo === 'salida') capitalSalidas += Number(cp.monto || 0)
        }
      }
      for (const v of ventas || []) {
        if (v.created_at >= monthStart && v.created_at <= monthEnd) {
          ventasTotal += Number(v.total || 0)
        }
      }
      const ganancia = ingresos - egresos
      acumulado += ganancia
      byMonth.push({
        mes: m + 1,
        nombre: MESES[m],
        ingresos,
        egresos,
        ganancia,
        acumulado,
        ventas: ventasTotal,
        capital_entradas: capitalEntradas,
        capital_salidas: capitalSalidas,
      })
    }

    return NextResponse.json({ data: { anio, meses: byMonth } })
  } catch (e: any) {
    console.error('[api/finanzas/historico GET]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}
