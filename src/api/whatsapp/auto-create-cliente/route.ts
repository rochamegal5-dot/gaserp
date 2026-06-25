import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function normalizePhone(phone: string): string {
  // Strip non-digits, keep leading + if present
  let p = (phone || '').trim()
  const plus = p.startsWith('+')
  p = p.replace(/\D/g, '')
  return plus ? `+${p}` : p
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const telefonoRaw = body.telefono || body.phone || ''
    const pushName = body.pushName || body.push_name || body.nombre || null

    if (!telefonoRaw) return NextResponse.json({ error: 'telefono required' }, { status: 400 })

    const telefono = normalizePhone(telefonoRaw)
    const now = new Date().toISOString()

    // Try to find existing
    const { data: existing, error: fErr } = await supabase
      .from('clientes')
      .select('*')
      .eq('telefono', telefono)
      .maybeSingle()
    if (fErr) {
      console.error('[api/whatsapp/auto-create-cliente find]', fErr.message)
      return NextResponse.json({ error: fErr.message }, { status: 500 })
    }
    if (existing) {
      // Update ultima_actividad
      const update: any = { ultima_actividad: now, updated_at: now }
      if (pushName && !existing.nombre1) update.nombre1 = pushName
      await supabase.from('clientes').update(update).eq('id', existing.id)
      return NextResponse.json({ data: { ...existing, ...update }, created: false })
    }

    // Create new with origen='whatsapp'
    const row: any = {
      id: crypto.randomUUID(),
      tipo: 'particular',
      telefono,
      nombre1: pushName,
      fiado: false,
      origen: 'whatsapp',
      ultima_actividad: now,
      created_at: now,
      updated_at: now,
    }
    const { data, error } = await supabase.from('clientes').insert(row).select().single()
    if (error) {
      console.error('[api/whatsapp/auto-create-cliente create]', error.message)
      if (error.message.includes('origen')) {
        const fb = { ...row }
        delete fb.origen
        const { data: d2, error: e2 } = await supabase.from('clientes').insert(fb).select().single()
        if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
        return NextResponse.json({ data: d2, created: true })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data, created: true })
  } catch (e: any) {
    console.error('[api/whatsapp/auto-create-cliente POST]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}
