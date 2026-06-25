import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const repartidorId = searchParams.get('repartidor_id')
    let q = supabase.from('stock_repartidor').select('*, producto:productos(*)')
    if (repartidorId) q = q.eq('repartidor_id', repartidorId)
    const { data, error } = await q.order('created_at', { ascending: false })
    if (error) {
      console.error('[api/stock/repartidor GET]', error.message)
      if (error.message.includes('Could not find the table')) {
        return NextResponse.json({ data: [], migration_required: true })
      }
      if (error.message.includes('created_at')) {
        let q2 = supabase.from('stock_repartidor').select('*, producto:productos(*)')
        if (repartidorId) q2 = q2.eq('repartidor_id', repartidorId)
        const { data: d2, error: e2 } = await q2
        if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
        return NextResponse.json({ data: d2 || [] })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data: data || [] })
  } catch (e: any) {
    console.error('[api/stock/repartidor GET]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}
