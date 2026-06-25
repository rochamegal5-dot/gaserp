import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data, error } = await supabase.from('repartidores').select('*').order('created_at', { ascending: false })
    if (error) {
      console.error('[api/repartidores GET]', error.message)
      if (error.message.includes('Could not find the table')) {
        return NextResponse.json({ data: [], migration_required: true })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data: data || [] })
  } catch (e: any) {
    console.error('[api/repartidores GET]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const row = {
      id: crypto.randomUUID(),
      nombre: body.nombre || '',
      telefono: body.telefono || null,
      vehiculo: body.vehiculo || null,
      patente: body.patente || null,
      color: body.color || '#3b82f6',
      activo: body.activo !== undefined ? !!body.activo : true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase.from('repartidores').insert(row).select().single()
    if (error) {
      console.error('[api/repartidores POST]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data })
  } catch (e: any) {
    console.error('[api/repartidores POST]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}
