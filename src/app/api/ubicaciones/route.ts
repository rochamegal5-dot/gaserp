import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase, fetchLatestUbicacionByRep } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data: reps, error: rErr } = await supabase.from('repartidores').select('*').eq('activo', true)
    if (rErr) {
      console.error('[api/ubicaciones GET]', rErr.message)
      return NextResponse.json({ error: rErr.message }, { status: 500 })
    }
    const result: any[] = []
    for (const rep of reps || []) {
      const latest = await fetchLatestUbicacionByRep(rep.id)
      result.push({
        repartidor: rep,
        ubicacion: latest,
      })
    }
    return NextResponse.json({ data: result })
  } catch (e: any) {
    console.error('[api/ubicaciones GET]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}
