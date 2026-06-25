import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function normalizePhone(phone: string): string {
  let p = (phone || '').trim()
  const plus = p.startsWith('+')
  p = p.replace(/\D/g, '')
  return plus ? `+${p}` : p
}

export async function POST() {
  try {
    const res = await fetch('http://localhost:3004/contacts', { cache: 'no-store' })
    if (!res.ok) {
      return NextResponse.json({ error: 'whatsapp service unavailable', status: res.status }, { status: 502 })
    }
    const text = await res.text()
    let contacts: any[] = []
    try {
      const parsed = JSON.parse(text)
      contacts = Array.isArray(parsed) ? parsed : (parsed.contacts || parsed.data || [])
    } catch {
      contacts = []
    }

    const now = new Date().toISOString()
    let upserted = 0
    let created = 0

    for (const c of contacts) {
      const tel = normalizePhone(c.telefono || c.phone || c.jid?.split('@')[0] || c.id || '')
      if (!tel) continue
      const nombre = c.nombre || c.name || c.pushName || null

      const { data: existing } = await supabase.from('clientes').select('id').eq('telefono', tel).maybeSingle()
      if (existing) {
        await supabase.from('clientes').update({
          ultima_actividad: now,
          updated_at: now,
          ...(nombre ? { nombre1: nombre } : {}),
        }).eq('id', existing.id)
        upserted++
      } else {
        const row: any = {
          id: crypto.randomUUID(),
          tipo: 'particular',
          telefono: tel,
          nombre1: nombre,
          fiado: false,
          origen: 'whatsapp',
          ultima_actividad: now,
          created_at: now,
          updated_at: now,
        }
        const { error } = await supabase.from('clientes').insert(row)
        if (error) {
          console.error('[api/whatsapp/sync-contacts insert]', error.message)
          if (error.message.includes('origen')) {
            const fb = { ...row }
            delete fb.origen
            await supabase.from('clientes').insert(fb)
            created++
          }
        } else {
          created++
        }
      }
    }

    return NextResponse.json({ data: { synced: contacts.length, upserted, created } })
  } catch (e: any) {
    console.error('[api/whatsapp/sync-contacts POST]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}
