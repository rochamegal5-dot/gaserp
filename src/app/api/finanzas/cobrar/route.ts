import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Deudores grouped by cliente (only ventas with saldo_pendiente > 0 and Pendiente)
    const { data: ventas, error } = await supabase
      .from('ventas')
      .select('id, cliente_id, saldo_pendiente, total, created_at, cliente:clientes(*), metodo_pago, estado')
      .eq('estado', 'Pendiente')
      .order('created_at', { ascending: true })
    if (error) {
      console.error('[api/finanzas/cobrar GET]', error.message)
      if (error.message.includes('Could not find the table')) {
        return NextResponse.json({ data: [], migration_required: true })
      }
      if (error.message.includes('saldo_pendiente')) {
        // Fallback: ignore saldo_pendiente column
        const { data: v2, error: e2 } = await supabase
          .from('ventas')
          .select('id, cliente_id, total, created_at, cliente:clientes(*), metodo_pago, estado')
          .eq('estado', 'Pendiente')
          .order('created_at', { ascending: true })
        if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
        return NextResponse.json({ data: groupDeudores(v2 || [], false) })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data: groupDeudores(ventas || [], true) })
  } catch (e: any) {
    console.error('[api/finanzas/cobrar GET]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}

function groupDeudores(ventas: any[], hasSaldo: boolean): any[] {
  const map = new Map<string, any>()
  for (const v of ventas) {
    if (!v.cliente_id) continue
    const saldo = hasSaldo ? Number(v.saldo_pendiente || 0) : Number(v.total || 0)
    if (saldo <= 0) continue
    if (!map.has(v.cliente_id)) {
      map.set(v.cliente_id, {
        cliente_id: v.cliente_id,
        cliente: v.cliente,
        total_pendiente: 0,
        ventas_pendientes: 0,
        ventas: [],
      })
    }
    const entry = map.get(v.cliente_id)
    entry.total_pendiente += saldo
    entry.ventas_pendientes += 1
    entry.ventas.push({ ...v, saldo_pendiente: saldo })
  }
  return Array.from(map.values()).sort((a, b) => b.total_pendiente - a.total_pendiente)
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const clienteId = body.clienteId || body.cliente_id
    const monto = Number(body.monto || 0)
    const forma = body.forma || 'efectivo'
    const detalle = body.detalle || 'Cobro de cuenta corriente'

    if (!clienteId || monto <= 0) return NextResponse.json({ error: 'clienteId and monto required' }, { status: 400 })

    // Fetch pending ventas ordered by oldest first
    const { data: ventas, error: vErr } = await supabase
      .from('ventas')
      .select('id, cliente_id, total, saldo_pendiente, estado, metodo_pago, created_at')
      .eq('cliente_id', clienteId)
      .eq('estado', 'Pendiente')
      .order('created_at', { ascending: true })
    if (vErr) {
      console.error('[api/finanzas/cobrar POST]', vErr.message)
      if (vErr.message.includes('saldo_pendiente')) {
        return await distributeCobroNoSaldo(clienteId, monto, forma, detalle)
      }
      return NextResponse.json({ error: vErr.message }, { status: 500 })
    }

    let restante = monto
    const distribucion: any[] = []
    for (const v of ventas || []) {
      if (restante <= 0) break
      const saldo = Number(v.saldo_pendiente || v.total || 0)
      if (saldo <= 0) continue
      const aplicado = Math.min(saldo, restante)
      const nuevoSaldo = saldo - aplicado
      const nuevoEstado = nuevoSaldo <= 0 ? 'Cobrado' : 'Pendiente'
      const updateRes = await supabase.from('ventas').update({
        saldo_pendiente: nuevoSaldo,
        estado: nuevoEstado,
      }).eq('id', v.id)
      if (updateRes.error) {
        // retry without saldo_pendiente
        if (updateRes.error.message.includes('saldo_pendiente')) {
          await supabase.from('ventas').update({ estado: nuevoEstado }).eq('id', v.id)
        } else {
          console.error('[api/finanzas/cobrar POST update]', updateRes.error.message)
        }
      }
      distribucion.push({ venta_id: v.id, aplicado, saldo_anterior: saldo, saldo_nuevo: nuevoSaldo, estado: nuevoEstado })
      restante -= aplicado
    }

    // Caja ingreso
    await supabase.from('movimientos_caja').insert({
      id: crypto.randomUUID(),
      tipo: 'ingreso',
      concepto: 'Cobro CC',
      monto: monto - restante,
      forma,
      detalle: `${detalle} - Cliente ${clienteId}`,
      referencia_id: clienteId,
      created_at: new Date().toISOString(),
    })

    return NextResponse.json({ data: { cliente_id: clienteId, monto_recibido: monto, monto_aplicado: monto - restante, vuelto: restante, distribucion } })
  } catch (e: any) {
    console.error('[api/finanzas/cobrar POST]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}

async function distributeCobroNoSaldo(clienteId: string, monto: number, forma: string, detalle: string) {
  const { data: ventas } = await supabase
    .from('ventas')
    .select('id, total, estado, metodo_pago, created_at')
    .eq('cliente_id', clienteId)
    .eq('estado', 'Pendiente')
    .order('created_at', { ascending: true })
  let restante = monto
  const distribucion: any[] = []
  for (const v of ventas || []) {
    if (restante <= 0) break
    const saldo = Number(v.total || 0)
    if (saldo <= 0) continue
    const aplicado = Math.min(saldo, restante)
    const nuevoEstado = aplicado >= saldo ? 'Cobrado' : 'Pendiente'
    await supabase.from('ventas').update({ estado: nuevoEstado }).eq('id', v.id)
    distribucion.push({ venta_id: v.id, aplicado, saldo_anterior: saldo, saldo_nuevo: saldo - aplicado, estado: nuevoEstado })
    restante -= aplicado
  }
  await supabase.from('movimientos_caja').insert({
    id: crypto.randomUUID(),
    tipo: 'ingreso',
    concepto: 'Cobro CC',
    monto: monto - restante,
    forma,
    detalle: `${detalle} - Cliente ${clienteId}`,
    referencia_id: clienteId,
    created_at: new Date().toISOString(),
  })
  return NextResponse.json({ data: { cliente_id: clienteId, monto_recibido: monto, monto_aplicado: monto - restante, vuelto: restante, distribucion } })
}
