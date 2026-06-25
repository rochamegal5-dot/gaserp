import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('remitos')
      .select('*, proveedor:proveedores(*), items:remito_items(*, producto:productos(*))')
      .order('created_at', { ascending: false })
    if (error) {
      console.error('[api/remitos GET]', error.message)
      if (error.message.includes('Could not find the table')) {
        return NextResponse.json({ data: [], migration_required: true })
      }
      // Fallback without saldo_pendiente
      if (error.message.includes('saldo_pendiente')) {
        const { data: d2, error: e2 } = await supabase
          .from('remitos')
          .select('id, proveedor_id, numero, monto_total, pagado, fecha_pago, created_at, proveedor:proveedores(*), items:remito_items(*, producto:productos(*))')
          .order('created_at', { ascending: false })
        if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
        return NextResponse.json({ data: d2 || [] })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data: data || [] })
  } catch (e: any) {
    console.error('[api/remitos GET]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const items: any[] = Array.isArray(body.items) ? body.items : []
    const montoTotal = Number(body.montoTotal || body.monto_total || 0)
    const pagado = !!body.pagado
    const now = new Date().toISOString()

    const remitoRow: any = {
      id: crypto.randomUUID(),
      proveedor_id: body.proveedorId || body.proveedor_id,
      numero: body.numero || `R-${Date.now()}`,
      monto_total: montoTotal,
      saldo_pendiente: pagado ? 0 : montoTotal,
      pagado,
      fecha_pago: pagado ? now : null,
      created_at: now,
    }

    const { data: remito, error: rErr } = await supabase.from('remitos').insert(remitoRow).select().single()
    if (rErr) {
      console.error('[api/remitos POST]', rErr.message)
      if (rErr.message.includes('saldo_pendiente')) {
        const fallback = { ...remitoRow }
        delete fallback.saldo_pendiente
        const { data: r2, error: e2 } = await supabase.from('remitos').insert(fallback).select().single()
        if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
        return await finalizeRemito(r2, items)
      }
      return NextResponse.json({ error: rErr.message }, { status: 500 })
    }
    return await finalizeRemito(remito, items)
  } catch (e: any) {
    console.error('[api/remitos POST]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}

async function finalizeRemito(remito: any, items: any[]) {
  if (items.length > 0) {
    const rows = items.map((it) => ({
      id: crypto.randomUUID(),
      remito_id: remito.id,
      producto_id: it.productoId || it.producto_id,
      entran_llenas: Number(it.entranLlenas || it.entran_llenas || 0),
      salen_vacias: Number(it.salenVacias || it.salen_vacias || 0),
      salen_defectuosas: Number(it.salenDefectuosas || it.salen_defectuosas || 0),
    }))
    const { error: iErr } = await supabase.from('remito_items').insert(rows)
    if (iErr) console.error('[api/remitos POST items]', iErr.message)

    // Update stock_deposito for each item
    for (const it of items) {
      const productoId = it.productoId || it.producto_id
      const entranLlenas = Number(it.entranLlenas || it.entran_llenas || 0)
      const salenVacias = Number(it.salenVacias || it.salen_vacias || 0)
      const salenDefectuosas = Number(it.salenDefectuosas || it.salen_defectuosas || 0)
      if (!productoId) continue
      const { data: sd } = await supabase.from('stock_deposito').select('*').eq('producto_id', productoId).maybeSingle()
      if (sd) {
        await supabase.from('stock_deposito').update({
          llenas: (sd.llenas || 0) + entranLlenas,
          vacias: (sd.vacias || 0) + salenVacias,
          defectuosas: (sd.defectuosas || 0) + salenDefectuosas,
        }).eq('id', sd.id)
      } else {
        await supabase.from('stock_deposito').insert({
          id: crypto.randomUUID(),
          producto_id: productoId,
          llenas: entranLlenas,
          vacias: salenVacias,
          defectuosas: salenDefectuosas,
        })
      }
      await supabase.from('movimientos_stock').insert({
        id: crypto.randomUUID(),
        tipo_mov: 'remito',
        producto_id: productoId,
        llenas: entranLlenas,
        vacias: salenVacias,
        defectuosas: salenDefectuosas,
        observaciones: `Remito ${remito.numero}`,
        referencia_id: remito.id,
        created_at: new Date().toISOString(),
      })
    }
  }
  return NextResponse.json({ data: remito })
}
