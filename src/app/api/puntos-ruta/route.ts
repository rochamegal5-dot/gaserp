import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data, error } = await supabase.from('puntos_ruta').select('*')
    if (error) {
      console.error('[api/puntos-ruta GET]', error.message)
      if (error.code === '42P01' || error.message?.includes('Could not find the table')) {
        return NextResponse.json({ data: [] })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data: data || [] })
  } catch (e: any) {
    console.error('[api/puntos-ruta GET]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const row = {
      id: crypto.randomUUID(),
      nombre: body.nombre || '',
      latitud: Number(body.latitud ?? 0),
      longitud: Number(body.longitud ?? 0),
      radio_m: Number(body.radio_m || body.radioM || 50),
    }
    const { data, error } = await supabase.from('puntos_ruta').insert(row).select().single()
    if (error) {
      console.error('[api/puntos-ruta POST]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data })
  } catch (e: any) {
    console.error('[api/puntos-ruta POST]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { error } = await supabase.from('puntos_ruta').delete().eq('id', id)
    if (error) {
      console.error('[api/puntos-ruta DELETE]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[api/puntos-ruta DELETE]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}
