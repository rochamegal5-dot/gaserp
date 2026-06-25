import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const target = searchParams.get('target') || 'all'

    const selectCols = 'id, tipo, telefono, nombre1, nombre2, apellido1, apellido2, email, fiado, ultima_actividad, created_at, origen'
    const selectColsFallback = 'id, tipo, telefono, nombre1, nombre2, apellido1, apellido2, email, fiado, created_at'

    let q = supabase.from('clientes').select(selectCols)

    if (target === 'particular') {
      q = q.eq('tipo', 'particular')
    } else if (target === 'comercio') {
      q = q.eq('tipo', 'comercio')
    } else if (target === 'deudor') {
      // Clients with pending saldo_pendiente
      const { data: deudores, error: dErr } = await supabase
        .from('ventas')
        .select('cliente_id, saldo_pendiente, estado')
        .eq('estado', 'Pendiente')
      if (dErr) {
        console.error('[api/marketing GET deudor]', dErr.message)
        if (dErr.message.includes('saldo_pendiente')) {
          // Try without saldo_pendiente
          const { data: d2, error: e3 } = await supabase
            .from('ventas')
            .select('cliente_id, estado')
            .eq('estado', 'Pendiente')
          if (e3) return NextResponse.json({ error: e3.message }, { status: 500 })
          const ids = [...new Set((d2 || []).map((d) => d.cliente_id).filter(Boolean))]
          if (ids.length === 0) return NextResponse.json({ data: [] })
          const { data: cd, error: ec } = await supabase.from('clientes').select(selectCols).in('id', ids)
          if (ec) {
            if (ec.message.includes('origen') || ec.message.includes('ultima_actividad')) {
              const { data: cd2 } = await supabase.from('clientes').select(selectColsFallback).in('id', ids)
              return NextResponse.json({ data: (cd2 || []).filter((c: any) => !!c.telefono) })
            }
            return NextResponse.json({ error: ec.message }, { status: 500 })
          }
          return NextResponse.json({ data: (cd || []).filter((c: any) => !!c.telefono) })
        }
        return NextResponse.json({ error: dErr.message }, { status: 500 })
      }
      const ids = [...new Set((deudores || []).map((d) => d.cliente_id).filter(Boolean))]
      if (ids.length === 0) return NextResponse.json({ data: [] })
      const { data, error } = await supabase.from('clientes').select(selectCols).in('id', ids)
      if (error) {
        if (error.message.includes('origen') || error.message.includes('ultima_actividad')) {
          const { data: d2 } = await supabase.from('clientes').select(selectColsFallback).in('id', ids)
          return NextResponse.json({ data: (d2 || []).filter((c: any) => !!c.telefono) })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ data: (data || []).filter((c: any) => !!c.telefono) })
    } else if (target === 'inactivos') {
      // No activity in last 30 days
      const cutoff = new Date(Date.now() - 30 * 86400 * 1000).toISOString()
      q = q.or(`ultima_actividad.is.null,ultima_actividad.lt.${cutoff}`)
    } else if (target === 'lead') {
      q = q.eq('tipo', 'lead')
    }

    const { data, error } = await q
    if (error) {
      console.error('[api/marketing GET]', error.message)
      if (error.message.includes('origen') || error.message.includes('ultima_actividad')) {
        let q2 = supabase.from('clientes').select(selectColsFallback)
        if (target === 'particular') q2 = q2.eq('tipo', 'particular')
        else if (target === 'comercio') q2 = q2.eq('tipo', 'comercio')
        else if (target === 'lead') q2 = q2.eq('tipo', 'lead')
        // 'inactivos' relies on ultima_actividad, skip filter
        const { data: d2, error: e2 } = await q2
        if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
        return NextResponse.json({ data: (d2 || []).filter((c: any) => !!c.telefono) })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    // Filter to only clients with telefono
    return NextResponse.json({ data: (data || []).filter((c: any) => !!c.telefono) })
  } catch (e: any) {
    console.error('[api/marketing GET]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}
