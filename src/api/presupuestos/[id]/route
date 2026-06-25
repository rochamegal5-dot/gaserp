import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { data, error } = await supabase
      .from('presupuestos')
      .select('*, cliente:clientes(*), items:presupuesto_items(*, producto:productos(*))')
      .eq('id', id)
      .maybeSingle()
    if (error) {
      console.error('[api/presupuestos/[id] GET]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: 'no encontrado' }, { status: 404 })
    return NextResponse.json({ data })
  } catch (e: any) {
    console.error('[api/presupuestos/[id] GET]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const accion = searchParams.get('accion')
    const now = new Date().toISOString()
    let nuevoEstado: string | null = null

    if (accion === 'aprobar') nuevoEstado = 'aprobado'
    else if (accion === 'rechazar') nuevoEstado = 'rechazado'
    else if (accion === 'vencer') nuevoEstado = 'vencido'
    else return NextResponse.json({ error: 'accion inválida (aprobar|rechazar|vencer)' }, { status: 400 })

    const { data, error } = await supabase.from('presupuestos').update({
      estado: nuevoEstado,
      updated_at: now,
    }).eq('id', id).select().single()
    if (error) {
      console.error('[api/presupuestos/[id] PATCH]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data })
  } catch (e: any) {
    console.error('[api/presupuestos/[id] PATCH]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const accion = searchParams.get('accion')
    if (accion !== 'convertir') {
      return NextResponse.json({ error: 'accion inválida (usar convertir)' }, { status: 400 })
    }

    // Load presupuesto + items
    const { data: presupuesto, error: pErr } = await supabase
      .from('presupuestos')
      .select('*, items:presupuesto_items(*)')
      .eq('id', id)
      .maybeSingle()
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
    if (!presupuesto) return NextResponse.json({ error: 'presupuesto no encontrado' }, { status: 404 })
    if (presupuesto.estado !== 'aprobado') return NextResponse.json({ error: 'presupuesto debe estar aprobado' }, { status: 400 })

    const now = new Date().toISOString()
    const ventasCreadas: any[] = []
    let totalCaja = 0

    for (const it of (presupuesto.items || [])) {
      const ventaRow: any = {
        id: crypto.randomUUID(),
        origen: 'presupuesto',
        tipo_venta: 'intercambio',
        cliente_id: presupuesto.cliente_id || null,
        producto_id: it.producto_id || null,
        cantidad_llenas: Number(it.cantidad || 0),
        total: Number(it.subtotal || 0),
        saldo_pendiente: 0,
        metodo_pago: 'efectivo',
        estado: 'Cobrado',
        presupuesto_id: presupuesto.id,
        created_at: now,
      }
      const { data: venta, error: vErr } = await supabase.from('ventas').insert(ventaRow).select().single()
      if (vErr) {
        console.error('[api/presupuestos/[id] POST venta]', vErr.message)
        if (vErr.message.includes('saldo_pendiente')) {
          const fb = { ...ventaRow }
          delete fb.saldo_pendiente
          const { data: v2, error: e2 } = await supabase.from('ventas').insert(fb).select().single()
          if (e2) continue
          ventasCreadas.push(v2)
          totalCaja += Number(it.subtotal || 0)
        }
        continue
      }
      ventasCreadas.push(venta)
      totalCaja += Number(it.subtotal || 0)
    }

    // Caja ingreso
    if (totalCaja > 0) {
      await supabase.from('movimientos_caja').insert({
        id: crypto.randomUUID(),
        tipo: 'ingreso',
        concepto: 'Venta (Presupuesto)',
        monto: totalCaja,
        forma: 'efectivo',
        detalle: `Conversión presupuesto ${id}`,
        referencia_id: id,
        created_at: now,
      })
    }

    // Update presupuesto to convertido
    await supabase.from('presupuestos').update({ estado: 'convertido', updated_at: now }).eq('id', id)

    return NextResponse.json({ data: { presupuesto_id: id, ventas_creadas: ventasCreadas, total_caja: totalCaja } })
  } catch (e: any) {
    console.error('[api/presupuestos/[id] POST]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { error } = await supabase.from('presupuestos').delete().eq('id', id)
    if (error) {
      console.error('[api/presupuestos/[id] DELETE]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[api/presupuestos/[id] DELETE]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}
