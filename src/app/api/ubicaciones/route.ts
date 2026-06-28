import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase, fetchLatestUbicacionByRep } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // 1) Obtener repartidores activos
    const { data: reps, error: rErr } = await supabase
      .from('repartidores')
      .select('*')
      .eq('activo', true)

    if (rErr) {
      console.error('[api/ubicaciones GET] reps error:', rErr.message)
      return NextResponse.json({ error: rErr.message }, { status: 500 })
    }

    if (!reps || reps.length === 0) {
      return NextResponse.json({ ubicaciones: [] })
    }

    // 2) Obtener la última ubicación de cada repartidor
    const ubicaciones: any[] = []
    for (const rep of reps) {
      const latest = await fetchLatestUbicacionByRep(rep.id)
      if (latest) {
        ubicaciones.push(latest)
      }
    }

    // 3) Devolver formato plano que el componente espera
    return NextResponse.json({ ubicaciones })
  } catch (e: any) {
    console.error('[api/ubicaciones GET]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}
