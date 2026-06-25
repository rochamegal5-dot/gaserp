import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function buildClienteInsert(body: any) {
  const row: any = {
    id: crypto.randomUUID(),
    tipo: body.tipo || 'particular',
    telefono: body.telefono || '',
    email: body.email || null,
    ci: body.ci || null,
    nombre1: body.nombre1 || null,
    nombre2: body.nombre2 || null,
    apellido1: body.apellido1 || null,
    apellido2: body.apellido2 || null,
    pais: body.pais || 'URUGUAY',
    depto: body.depto || null,
    ciudad: body.ciudad || null,
    calle: body.calle || null,
    numero: body.numero || null,
    complejo: body.complejo || null,
    apto: body.apto || null,
    entre1: body.entre1 || null,
    entre2: body.entre2 || null,
    latitud: body.latitud ?? null,
    longitud: body.longitud ?? null,
    fiado: !!body.fiado,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  if (body.origen !== undefined) row.origen = body.origen
  if (body.ultima_actividad !== undefined) row.ultima_actividad = body.ultima_actividad
  return row
}

export async function GET() {
  try {
    const { data, error } = await supabase.from('clientes').select('*').order('created_at', { ascending: false })
    if (error) {
      console.error('[api/clientes GET]', error.message)
      if (error.message.includes('Could not find the table')) {
        return NextResponse.json({ data: [], migration_required: true })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data: data || [] })
  } catch (e: any) {
    console.error('[api/clientes GET]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const row = buildClienteInsert(body)
    const { data, error } = await supabase.from('clientes').insert(row).select().single()
    if (error) {
      console.error('[api/clientes POST]', error.message)
      if (error.message.includes('origen')) {
        const fallback = { ...row }
        delete fallback.origen
        const { data: d2, error: e2 } = await supabase.from('clientes').insert(fallback).select().single()
        if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
        return NextResponse.json({ data: d2 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data })
  } catch (e: any) {
    console.error('[api/clientes POST]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}
