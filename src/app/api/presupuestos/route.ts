import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('presupuestos')
      .select('*, cliente:clientes(*), items:presupuesto_items(*, producto:productos(*))')
      .order('created_at', { ascending: false })
    if (error) {
      console.error('[api/presupuestos GET]', error.message)
      if (error.message.includes('Could not find the table')) {
        return NextResponse.json({ data: [], migration_required: true })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data: data || [] })
  } catch (e: any) {
    console.error('[api/presupuestos GET]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const items: any[] = Array.isArray(body.items) ? body.items : []
    const total = items.reduce((s, it) => s + Number(it.subtotal || (Number(it.cantidad || 1) * Number(it.precioUnitario || it.precio_unitario || 0))), 0)
    const now = new Date().toISOString()

    const presupuestoRow: any = {
      id: crypto.randomUUID(),
      cliente_id: body.clienteId || body.cliente_id || null,
      cliente_nombre: body.clienteNombre || body.cliente_nombre || '',
      estado: body.estado || 'pendiente',
      total,
      observaciones: body.observaciones || null,
      validez: body.validez || null,
      created_at: now,
      updated_at: now,
    }

    const { data: presupuesto, error: pErr } = await supabase.from('presupuestos').insert(presupuestoRow).select().single()
    if (pErr) {
      console.error('[api/presupuestos POST]', pErr.message)
      if (pErr.message.includes('Could not find the table')) {
        return NextResponse.json({ data: null, migration_required: true })
      }
      return NextResponse.json({ error: pErr.message }, { status: 500 })
    }

    if (items.length > 0) {
      const itemRows = items.map((it) => ({
        id: crypto.randomUUID(),
        presupuesto_id: presupuesto.id,
        producto_id: it.productoId || it.producto_id || null,
        producto_nombre: it.productoNombre || it.producto_nombre || '',
        cantidad: Number(it.cantidad || 1),
        precio_unitario: Number(it.precioUnitario || it.precio_unitario || 0),
        subtotal: Number(it.subtotal || (Number(it.cantidad || 1) * Number(it.precioUnitario || it.precio_unitario || 0))),
      }))
      const { error: iErr } = await supabase.from('presupuesto_items').insert(itemRows)
      if (iErr) console.error('[api/presupuestos POST items]', iErr.message)
    }

    return NextResponse.json({ data: presupuesto })
  } catch (e: any) {
    console.error('[api/presupuestos POST]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}
