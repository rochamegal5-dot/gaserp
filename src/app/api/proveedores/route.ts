import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data, error } = await supabase.from('proveedores').select('*').order('created_at', { ascending: false })
    if (error) {
      console.error('[api/proveedores GET]', error.message)
      if (error.message.includes('Could not find the table')) {
        return NextResponse.json({ data: [], migration_required: true })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data: data || [] })
  } catch (e: any) {
    console.error('[api/proveedores GET]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const row = {
      id: crypto.randomUUID(),
      nombre: body.nombre || '',
      cuit: body.cuit || null,
      contacto: body.contacto || null,
      telefono: body.telefono || null,
      direccion: body.direccion || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase.from('proveedores').insert(row).select().single()
    if (error) {
      console.error('[api/proveedores POST]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data })
  } catch (e: any) {
    console.error('[api/proveedores POST]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}
