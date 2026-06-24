import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Seed no permitido en producción' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Use /api/finanzas/seed solo en desarrollo' }, { status: 403 })
  } catch (e: any) {
    console.error('[api/finanzas/seed POST]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}
