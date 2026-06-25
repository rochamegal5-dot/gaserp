import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data, error } = await supabase.from('productos').select('*').order('created_at', { ascending: false })
    if (error) {
      console.error('[api/productos GET]', error.message)
      if (error.message.includes('Could not find the table')) {
        return NextResponse.json({ data: [], migration_required: true })
      }
      if (error.message.includes('created_at')) {
        const { data: d2, error: e2 } = await supabase.from('productos').select('*')
        if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
        return NextResponse.json({ data: d2 || [] })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data: data || [] })
  } catch (e: any) {
    console.error('[api/productos GET]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const row = {
      id: crypto.randomUUID(),
      nombre: body.nombre || '',
      tipo: body.tipo || 'garrafa',
      costo: Number(body.costo || 0),
      precio_venta: Number(body.precioVenta || body.precio_venta || 0),
      precio_comercio: Number(body.precioComercio || body.precio_comercio || 0),
      flete: Number(body.flete || 0),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase.from('productos').insert(row).select().single()
    if (error) {
      console.error('[api/productos POST]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data })
  } catch (e: any) {
    console.error('[api/productos POST]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}
