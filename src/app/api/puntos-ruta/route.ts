import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// ════════════════════════════════════════════════════════════
// GET — Listar todos los puntos de ruta
// ════════════════════════════════════════════════════════════
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('puntos_ruta')
      .select('*')
      .order('nombre', { ascending: true })

    if (error) {
      console.error('[api/puntos-ruta GET]', error.message)
      // Si la tabla no existe, devolver array vacío (no romper el front)
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

// ════════════════════════════════════════════════════════════
// POST — Crear nuevo punto de ruta
// Body: { nombre, latitud, longitud, radio_m?, descripcion? }
// ════════════════════════════════════════════════════════════
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))

    // Validaciones
    if (!body.nombre || typeof body.nombre !== 'string' || !body.nombre.trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    }
    const lat = Number(body.latitud)
    const lng = Number(body.longitud)
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ error: 'Coordenadas inválidas' }, { status: 400 })
    }

    const row = {
      id: crypto.randomUUID(),
      nombre: body.nombre.trim(),
      latitud: lat,
      longitud: lng,
      radio_m: Number(body.radio_m || body.radioM || 50),
      descripcion: body.descripcion || null,
    }

    const { data, error } = await supabase
      .from('puntos_ruta')
      .insert(row)
      .select()
      .single()

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

// ════════════════════════════════════════════════════════════
// PUT — Actualizar punto existente
// Body: { id, nombre?, latitud?, longitud?, radio_m?, descripcion? }
// ════════════════════════════════════════════════════════════
export async function PUT(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))

    if (!body.id) {
      return NextResponse.json({ error: 'id es obligatorio' }, { status: 400 })
    }

    // Construir solo los campos que vienen (update parcial)
    const update: any = {}
    if (body.nombre !== undefined) {
      if (typeof body.nombre !== 'string' || !body.nombre.trim()) {
        return NextResponse.json({ error: 'El nombre no puede estar vacío' }, { status: 400 })
      }
      update.nombre = body.nombre.trim()
    }
    if (body.latitud !== undefined) {
      const lat = Number(body.latitud)
      if (isNaN(lat) || lat < -90 || lat > 90) {
        return NextResponse.json({ error: 'Latitud inválida' }, { status: 400 })
      }
      update.latitud = lat
    }
    if (body.longitud !== undefined) {
      const lng = Number(body.longitud)
      if (isNaN(lng) || lng < -180 || lng > 180) {
        return NextResponse.json({ error: 'Longitud inválida' }, { status: 400 })
      }
      update.longitud = lng
    }
    if (body.radio_m !== undefined) {
      const r = Number(body.radio_m)
      if (isNaN(r) || r < 1 || r > 5000) {
        return NextResponse.json({ error: 'Radio debe estar entre 1 y 5000 metros' }, { status: 400 })
      }
      update.radio_m = r
    }
    if (body.descripcion !== undefined) {
      update.descripcion = body.descripcion || null
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('puntos_ruta')
      .update(update)
      .eq('id', body.id)
      .select()
      .single()

    if (error) {
      console.error('[api/puntos-ruta PUT]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data })
  } catch (e: any) {
    console.error('[api/puntos-ruta PUT]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}

// ════════════════════════════════════════════════════════════
// DELETE — Eliminar punto de ruta
// Query: ?id=xxx
// ════════════════════════════════════════════════════════════
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
