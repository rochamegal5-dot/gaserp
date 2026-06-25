import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('movimientos_stock')
      .select('*, producto:productos(*), repartidor:repartidores(*)')
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) {
      console.error('[api/stock/movimientos GET]', error.message)
      if (error.message.includes('Could not find the table')) {
        return NextResponse.json({ data: [], migration_required: true })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data: data || [] })
  } catch (e: any) {
    console.error('[api/stock/movimientos GET]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}
