import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const TABLES = [
  'clientes',
  'productos',
  'proveedores',
  'repartidores',
  'remitos',
  'remito_items',
  'stock_deposito',
  'stock_repartidor',
  'jornadas_repartidor',
  'ventas',
  'movimientos_stock',
  'movimientos_caja',
  'movimientos_capital',
  'configuraciones',
  'presupuestos',
  'presupuesto_items',
  'costos_repartidor',
  'campaigns',
  'campaign_templates',
  'social_connections',
  'social_posts',
  'ubicaciones',
  'puntos_ruta',
]

export async function GET() {
  try {
    const result: Record<string, boolean> = {}
    for (const t of TABLES) {
      const { error } = await supabase.from(t).select('id').limit(1)
      result[t] = !error
    }
    const allExist = Object.values(result).every(Boolean)
    return NextResponse.json({
      data: {
        all_exist: allExist,
        tables: result,
        missing: TABLES.filter((t) => !result[t]),
      },
    })
  } catch (e: any) {
    console.error('[api/finanzas/setup GET]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}
