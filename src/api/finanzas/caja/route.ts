import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function startOfDay(d: Date): string {
  const s = new Date(d)
  s.setHours(0, 0, 0, 0)
  return s.toISOString()
}
function endOfDay(d: Date): string {
  const s = new Date(d)
  s.setHours(23, 59, 59, 999)
  return s.toISOString()
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const fechaParam = searchParams.get('fecha')
    const d = fechaParam ? new Date(fechaParam + 'T12:00:00') : new Date()
    const dStart = startOfDay(d)
    const dEnd = endOfDay(d)

    const { data: movs, error } = await supabase
      .from('movimientos_caja')
      .select('*')
      .gte('created_at', dStart)
      .lte('created_at', dEnd)
      .order('created_at', { ascending: false })
    if (error) {
      console.error('[api/finanzas/caja GET]', error.message)
      if (error.message.includes('Could not find the table')) {
        return NextResponse.json({ data: { fecha: fechaParam || d.toISOString().split('T')[0], ingresos: 0, egresos: 0, margen: 0, desglose: {}, movimientos: [] }, migration_required: true })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let ingresos = 0, egresos = 0
    const desglose: any = {}
    for (const m of movs || []) {
      if (m.tipo === 'ingreso') ingresos += Number(m.monto || 0)
      else if (m.tipo === 'egreso') egresos += Number(m.monto || 0)
      const key = `${m.tipo}:${m.concepto || ''}`
      desglose[key] = (desglose[key] || 0) + Number(m.monto || 0)
    }

    return NextResponse.json({
      data: {
        fecha: fechaParam || d.toISOString().split('T')[0],
        ingresos,
        egresos,
        margen: ingresos - egresos,
        desglose,
        movimientos: movs || [],
      },
    })
  } catch (e: any) {
    console.error('[api/finanzas/caja GET]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}
