import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data, error } = await supabase.from('social_connections').select('*').order('created_at', { ascending: false })
    if (error) {
      console.error('[api/social/connect GET]', error.message)
      if (error.message.includes('Could not find the table')) {
        return NextResponse.json({ data: [], migration_required: true })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data: data || [] })
  } catch (e: any) {
    console.error('[api/social/connect GET]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const now = new Date().toISOString()
    const row = {
      id: crypto.randomUUID(),
      plataforma: body.plataforma || 'whatsapp',
      account_id: body.accountId || body.account_id || '',
      account_name: body.accountName || body.account_name || null,
      access_token: body.accessToken || body.access_token || '',
      token_expira: body.tokenExpira || body.token_expira || null,
      scopes: body.scopes ? (typeof body.scopes === 'string' ? body.scopes : JSON.stringify(body.scopes)) : null,
      activo: body.activo !== undefined ? !!body.activo : true,
      created_at: now,
      updated_at: now,
    }
    const { data, error } = await supabase.from('social_connections').insert(row).select().single()
    if (error) {
      console.error('[api/social/connect POST]', error.message)
      if (error.message.includes('Could not find the table')) {
        return NextResponse.json({ data: null, migration_required: true })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data })
  } catch (e: any) {
    console.error('[api/social/connect POST]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { error } = await supabase.from('social_connections').delete().eq('id', id)
    if (error) {
      console.error('[api/social/connect DELETE]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[api/social/connect DELETE]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}
