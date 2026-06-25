import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('ventas')
      .select('*, cliente:clientes(*), producto:productos(*), repartidor:repartidores(*), presupuesto:presupuestos(*)')
      .order('created_at', { ascending: false })
    if (error) {
      console.error('[api/ventas GET]', error.message)
      if (error.message.includes('Could not find the table')) {
        return NextResponse.json({ data: [], migration_required: true })
      }
      if (error.message.includes('saldo_pendiente')) {
        const { data: d2, error: e2 } = await supabase
          .from('ventas')
          .select('id, origen, tipo_venta, repartidor_id, cliente_id, producto_id, cantidad_llenas, cantidad_vacias, cantidad_defectuosas, kilos_recarga, total, metodo_pago, estado, presupuesto_id, created_at, cliente:clientes(*), producto:productos(*), repartidor:repartidores(*)')
          .order('created_at', { ascending: false })
        if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
        return NextResponse.json({ data: d2 || [] })
      }
      if (error.message.includes('presupuestos') || error.message.includes('presupuesto')) {
        // Retry without presupuesto join
        const { data: d2, error: e2 } = await supabase
          .from('ventas')
          .select('*, cliente:clientes(*), producto:productos(*), repartidor:repartidores(*)')
          .order('created_at', { ascending: false })
        if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
        return NextResponse.json({ data: d2 || [] })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data: data || [] })
  } catch (e: any) {
    console.error('[api/ventas GET]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const metodoPago = body.metodoPago || body.metodo_pago || 'efectivo'
    // credit sales use 'fiado'
    const finalMetodo = metodoPago === 'cuenta_corriente' || metodoPago === 'ctacte' || metodoPago === 'cta_cte' ? 'fiado' : metodoPago
    const total = Number(body.total || 0)
    const estado = body.estado || (finalMetodo === 'fiado' ? 'Pendiente' : 'Cobrado')
    const saldoPendiente = finalMetodo === 'fiado' ? total : 0

    const ventaRow: any = {
      id: crypto.randomUUID(),
      origen: body.origen || 'web',
      tipo_venta: body.tipoVenta || body.tipo_venta || 'intercambio',
      repartidor_id: body.repartidorId || body.repartidor_id || null,
      cliente_id: body.clienteId || body.cliente_id || null,
      producto_id: body.productoId || body.producto_id || null,
      cantidad_llenas: Number(body.cantidadLlenas || body.cantidad_llenas || 0),
      cantidad_vacias: Number(body.cantidadVacias || body.cantidad_vacias || 0),
      cantidad_defectuosas: Number(body.cantidadDefectuosas || body.cantidad_defectuosas || 0),
      kilos_recarga: Number(body.kilosRecarga || body.kilos_recarga || 0),
      total,
      saldo_pendiente: saldoPendiente,
      metodo_pago: finalMetodo,
      estado,
      presupuesto_id: body.presupuestoId || body.presupuesto_id || null,
      created_at: new Date().toISOString(),
    }

    const { data: venta, error: vErr } = await supabase.from('ventas').insert(ventaRow).select().single()
    if (vErr) {
      console.error('[api/ventas POST]', vErr.message)
      if (vErr.message.includes('saldo_pendiente')) {
        const fb = { ...ventaRow }
        delete fb.saldo_pendiente
        const { data: v2, error: e2 } = await supabase.from('ventas').insert(fb).select().single()
        if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
        return await finalizeVenta(v2, body, finalMetodo, total, estado)
      }
      return NextResponse.json({ error: vErr.message }, { status: 500 })
    }
    return await finalizeVenta(venta, body, finalMetodo, total, estado)
  } catch (e: any) {
    console.error('[api/ventas POST]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}

async function finalizeVenta(venta: any, body: any, metodoPago: string, total: number, estado: string) {
  const tipoVenta = body.tipoVenta || body.tipo_venta || 'intercambio'
  const repartidorId = body.repartidorId || body.repartidor_id || null
  const productoId = body.productoId || body.producto_id || null
  const cantidadLlenas = Number(body.cantidadLlenas || body.cantidad_llenas || 0)
  const cantidadVacias = Number(body.cantidadVacias || body.cantidad_vacias || 0)
  const cantidadDefectuosas = Number(body.cantidadDefectuosas || body.cantidad_defectuosas || 0)
  const kilos = Number(body.kilosRecarga || body.kilos_recarga || 0)

  // Stock update for intercambio (only if repartidor and product)
  if (tipoVenta === 'intercambio' && repartidorId && productoId) {
    const { data: sr } = await supabase
      .from('stock_repartidor')
      .select('*')
      .eq('repartidor_id', repartidorId)
      .eq('producto_id', productoId)
      .maybeSingle()
    if (sr) {
      const newLlenas = (sr.llenas || 0) - cantidadLlenas
      const newVacias = (sr.vacias || 0) + cantidadVacias
      const newDef = (sr.defectuosas || 0) + cantidadDefectuosas
      await supabase.from('stock_repartidor').update({
        llenas: Math.max(0, newLlenas),
        vacias: newVacias,
        defectuosas: newDef,
      }).eq('id', sr.id)
    } else {
      await supabase.from('stock_repartidor').insert({
        id: crypto.randomUUID(),
        repartidor_id: repartidorId,
        producto_id: productoId,
        llenas: 0,
        vacias: cantidadVacias,
        defectuosas: cantidadDefectuosas,
      })
    }
    await supabase.from('movimientos_stock').insert({
      id: crypto.randomUUID(),
      tipo_mov: 'venta',
      producto_id: productoId,
      repartidor_id: repartidorId,
      llenas: -cantidadLlenas,
      vacias: cantidadVacias,
      defectuosas: cantidadDefectuosas,
      kilos_gas: kilos,
      observaciones: `Venta ${venta.id}`,
      referencia_id: venta.id,
      created_at: new Date().toISOString(),
    })
  } else if (tipoVenta === 'recarga' && repartidorId && productoId && kilos > 0) {
    await supabase.from('movimientos_stock').insert({
      id: crypto.randomUUID(),
      tipo_mov: 'recarga',
      producto_id: productoId,
      repartidor_id: repartidorId,
      kilos_gas: kilos,
      observaciones: `Recarga venta ${venta.id}`,
      referencia_id: venta.id,
      created_at: new Date().toISOString(),
    })
  }

  // Caja movement (only if Cobrado)
  if (estado === 'Cobrado' && total > 0) {
    await supabase.from('movimientos_caja').insert({
      id: crypto.randomUUID(),
      tipo: 'ingreso',
      concepto: 'Venta',
      monto: total,
      forma: metodoPago,
      detalle: `Venta ${venta.id}`,
      referencia_id: venta.id,
      created_at: new Date().toISOString(),
    })
  }
  return NextResponse.json({ data: venta })
}
