import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('stock_deposito')
      .select('*, producto:productos(*)')
      .order('created_at', { ascending: false })
    if (error) {
      console.error('[api/stock GET]', error.message)
      if (error.message.includes('Could not find the table')) {
        return NextResponse.json({ data: [], migration_required: true })
      }
      if (error.message.includes('created_at')) {
        const { data: d2, error: e2 } = await supabase
          .from('stock_deposito')
          .select('*, producto:productos(*)')
        if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
        return NextResponse.json({ data: d2 || [] })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data: data || [] })
  } catch (e: any) {
    console.error('[api/stock GET]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}
