import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const productoId = body.productoId || body.producto_id
    const llenas = Number(body.llenas || 0)
    const vacias = Number(body.vacias || 0)
    const defectuosas = Number(body.defectuosas || 0)
    const kilos = Number(body.kilos || body.kilos_gas || 0)
    const observaciones = body.observaciones || 'Descarga depósito'

    if (!productoId) return NextResponse.json({ error: 'productoId required' }, { status: 400 })

    const { data: sd } = await supabase.from('stock_deposito').select('*').eq('producto_id', productoId).maybeSingle()
    if (sd) {
      await supabase.from('stock_deposito').update({
        llenas: Math.max(0, (sd.llenas || 0) - llenas),
        vacias: Math.max(0, (sd.vacias || 0) - vacias),
        defectuosas: Math.max(0, (sd.defectuosas || 0) - defectuosas),
      }).eq('id', sd.id)
    }

    const { error: mErr } = await supabase.from('movimientos_stock').insert({
      id: crypto.randomUUID(),
      tipo_mov: 'descarga_deposito',
      producto_id: productoId,
      llenas: -llenas,
      vacias: -vacias,
      defectuosas: -defectuosas,
      kilos_gas: kilos,
      observaciones,
      referencia_id: sd?.id || null,
      created_at: new Date().toISOString(),
    })
    if (mErr) console.error('[api/stock/descarga mov]', mErr.message)

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[api/stock/descarga POST]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}
