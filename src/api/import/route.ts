import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const TEMPLATES: Record<string, string[]> = {
  clientes: ['telefono', 'nombre1', 'nombre2', 'apellido1', 'apellido2', 'tipo', 'email', 'ci', 'calle', 'numero', 'ciudad', 'depto', 'fiado'],
  productos: ['nombre', 'tipo', 'costo', 'precio_venta', 'precio_comercio', 'flete'],
  proveedores: ['nombre', 'cuit', 'contacto', 'telefono', 'direccion'],
  repartidores: ['nombre', 'telefono', 'vehiculo', 'patente', 'color'],
}

function parseCSV(text: string): string[][] {
  // Simple CSV parser supporting "..." quoted fields
  const rows: string[][] = []
  let cur: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',' || c === ';' || c === '\t') {
        cur.push(field)
        field = ''
      } else if (c === '\n') {
        cur.push(field)
        field = ''
        rows.push(cur)
        cur = []
      } else if (c === '\r') {
        // ignore
      } else {
        field += c
      }
    }
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field)
    rows.push(cur)
  }
  return rows.filter((r) => r.some((c) => c.trim().length > 0))
}

function buildRowForTipo(tipo: string, headers: string[], values: string[]): any {
  const map: Record<string, any> = {}
  for (let i = 0; i < headers.length; i++) {
    map[headers[i].trim()] = values[i] || ''
  }
  const now = new Date().toISOString()
  switch (tipo) {
    case 'clientes':
      return {
        id: crypto.randomUUID(),
        telefono: String(map.telefono || ''),
        nombre1: map.nombre1 || null,
        nombre2: map.nombre2 || null,
        apellido1: map.apellido1 || null,
        apellido2: map.apellido2 || null,
        tipo: map.tipo || 'particular',
        email: map.email || null,
        ci: map.ci || null,
        calle: map.calle || null,
        numero: map.numero || null,
        ciudad: map.ciudad || null,
        depto: map.depto || null,
        fiado: String(map.fiado || '').toLowerCase() === 'true' || map.fiado === '1' || map.fiado === 'si',
        origen: 'import_csv',
        created_at: now,
        updated_at: now,
      }
    case 'productos':
      return {
        id: crypto.randomUUID(),
        nombre: map.nombre || '',
        tipo: map.tipo || 'garrafa',
        costo: Number(map.costo || 0),
        precio_venta: Number(map.precio_venta || 0),
        precio_comercio: Number(map.precio_comercio || 0),
        flete: Number(map.flete || 0),
        created_at: now,
        updated_at: now,
      }
    case 'proveedores':
      return {
        id: crypto.randomUUID(),
        nombre: map.nombre || '',
        cuit: map.cuit || null,
        contacto: map.contacto || null,
        telefono: map.telefono || null,
        direccion: map.direccion || null,
        created_at: now,
        updated_at: now,
      }
    case 'repartidores':
      return {
        id: crypto.randomUUID(),
        nombre: map.nombre || '',
        telefono: map.telefono || null,
        vehiculo: map.vehiculo || null,
        patente: map.patente || null,
        color: map.color || '#3b82f6',
        activo: true,
        created_at: now,
        updated_at: now,
      }
    default:
      return null
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const tipo = searchParams.get('tipo') || 'clientes'
    const headers = TEMPLATES[tipo] || []
    if (headers.length === 0) return NextResponse.json({ error: 'tipo inválido' }, { status: 400 })
    const csv = headers.join(',') + '\n'
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="template_${tipo}.csv"` },
    })
  } catch (e: any) {
    console.error('[api/import GET]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const tipo = body.tipo
    const csv: string = body.csv || ''
    const dryRun = !!body.dry_run

    if (!tipo || !TEMPLATES[tipo]) return NextResponse.json({ error: 'tipo inválido' }, { status: 400 })
    if (!csv) return NextResponse.json({ error: 'csv required' }, { status: 400 })

    const rows = parseCSV(csv)
    if (rows.length < 2) return NextResponse.json({ data: { parsed: 0, inserted: 0, dry_run: dryRun } })

    const headers = rows[0].map((h) => h.trim())
    const dataRows = rows.slice(1)

    const builtRows: any[] = []
    const errores: { row: number; error: string }[] = []
    for (let i = 0; i < dataRows.length; i++) {
      const r = dataRows[i]
      try {
        const row = buildRowForTipo(tipo, headers, r)
        if (row) builtRows.push(row)
        else errores.push({ row: i + 2, error: 'tipo desconocido' })
      } catch (err: any) {
        errores.push({ row: i + 2, error: err.message })
      }
    }

    if (dryRun) {
      return NextResponse.json({ data: { parsed: dataRows.length, inserted: 0, dry_run: true, sample: builtRows.slice(0, 5), errores: errores.slice(0, 10) } })
    }

    // Insert in chunks of 100
    let inserted = 0
    for (let i = 0; i < builtRows.length; i += 100) {
      const chunk = builtRows.slice(i, i + 100)
      let { error } = await supabase.from(tipo).insert(chunk)
      if (error) {
        console.error('[api/import POST chunk]', error.message)
        if (error.message.includes('origen') && tipo === 'clientes') {
          const cleaned = chunk.map((r: any) => { const c = { ...r }; delete c.origen; return c })
          const e2 = await supabase.from(tipo).insert(cleaned)
          if (e2.error) {
            console.error('[api/import POST chunk retry]', e2.error.message)
          } else {
            inserted += cleaned.length
          }
        }
      } else {
        inserted += chunk.length
      }
    }

    return NextResponse.json({ data: { parsed: dataRows.length, inserted, dry_run: false, errores: errores.slice(0, 50) } })
  } catch (e: any) {
    console.error('[api/import POST]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}
