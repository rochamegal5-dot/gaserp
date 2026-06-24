import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data: remitos, error } = await supabase
      .from('remitos')
      .select('*, proveedor:proveedores(*)')
      .eq('pagado', false)
      .order('created_at', { ascending: true })
    if (error) {
      console.error('[api/finanzas/pagar GET]', error.message)
      if (error.message.includes('Could not find the table')) {
        return NextResponse.json({ data: [], migration_required: true })
      }
      if (error.message.includes('saldo_pendiente')) {
        const { data: r2, error: e2 } = await supabase
          .from('remitos')
          .select('id, proveedor_id, numero, monto_total, pagado, fecha_pago, created_at, proveedor:proveedores(*)')
          .eq('pagado', false)
          .order('created_at', { ascending: true })
        if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
        return NextResponse.json({ data: r2 || [] })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data: remitos || [] })
  } catch (e: any) {
    console.error('[api/finanzas/pagar GET]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const remitoId = body.remitoId || body.remito_id
    const monto = Number(body.monto || 0)
    const forma = body.forma || 'efectivo'
    const detalle = body.detalle || 'Pago a proveedor'

    if (!remitoId || monto <= 0) return NextResponse.json({ error: 'remitoId and monto required' }, { status: 400 })

    const { data: remito } = await supabase.from('remitos').select('*').eq('id', remitoId).maybeSingle()
    if (!remito) return NextResponse.json({ error: 'remito no encontrado' }, { status: 404 })

    const saldoActual = Number(remito.saldo_pendiente ?? remito.monto_total ?? 0)
    const nuevoSaldo = Math.max(0, saldoActual - monto)
    const pagado = nuevoSaldo <= 0
    const now = new Date().toISOString()

    const updateRes = await supabase.from('remitos').update({
      saldo_pendiente: nuevoSaldo,
      pagado,
      fecha_pago: pagado ? now : (remito.fecha_pago || null),
    }).eq('id', remitoId)
    if (updateRes.error) {
      console.error('[api/finanzas/pagar POST]', updateRes.error.message)
      if (updateRes.error.message.includes('saldo_pendiente')) {
        const e2 = await supabase.from('remitos').update({
          pagado,
          fecha_pago: pagado ? now : (remito.fecha_pago || null),
        }).eq('id', remitoId)
        if (e2.error) return NextResponse.json({ error: e2.error.message }, { status: 500 })
      } else {
        return NextResponse.json({ error: updateRes.error.message }, { status: 500 })
      }
    }

    await supabase.from('movimientos_caja').insert({
      id: crypto.randomUUID(),
      tipo: 'egreso',
      concepto: 'Pago Proveedor',
      monto,
      forma,
      detalle: `${detalle} - Remito ${remito.numero || remitoId}`,
      referencia_id: remitoId,
      created_at: now,
    })

    return NextResponse.json({ data: { remito_id: remitoId, monto_pagado: monto, saldo_anterior: saldoActual, saldo_nuevo: nuevoSaldo, pagado } })
  } catch (e: any) {
    console.error('[api/finanzas/pagar POST]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}
