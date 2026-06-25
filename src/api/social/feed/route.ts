import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data: posts, error: pErr } = await supabase
      .from('social_posts')
      .select('*')
      .order('publicado_en', { ascending: false })
      .limit(100)
    if (pErr) {
      console.error('[api/social/feed GET]', pErr.message)
      if (pErr.message.includes('Could not find the table')) {
        return NextResponse.json({ data: { posts: [], connections: [], migration_required: true } })
      }
      return NextResponse.json({ error: pErr.message }, { status: 500 })
    }
    const { data: connections } = await supabase.from('social_connections').select('*').eq('activo', true)
    return NextResponse.json({
      data: {
        posts: posts || [],
        connections: connections || [],
      },
    })
  } catch (e: any) {
    console.error('[api/social/feed GET]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}
