import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase, fetchUbicacionesByRepAndDate } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

function fmtEs(date: Date): string {
  return new Intl.DateTimeFormat('es-UY', {
    timeZone: 'America/Montevideo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const repartidorId = searchParams.get('repartidor_id')
    const fecha = searchParams.get('fecha') || new Date().toISOString().split('T')[0]
    if (!repartidorId) return NextResponse.json({ error: 'repartidor_id required' }, { status: 400 })

    const { pings, effectiveDate, allDates } = await fetchUbicacionesByRepAndDate(repartidorId, fecha)
    if (pings.length === 0) {
      return NextResponse.json({
        data: {
          repartidor_id: repartidorId,
          fecha: effectiveDate,
          fechas_disponibles: allDates,
          stats: null,
          timeline: [],
          puntos: 0,
        },
      })
    }

    // Load puntos_ruta
    const { data: puntosRuta } = await supabase.from('puntos_ruta').select('*')

    // Sort by timestamp asc (already sorted in helper, but ensure)
    const sorted = [...pings].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    // Stats
    let distanciaTotalKm = 0
    let velocidadMax = 0
    let velocidadSumMov = 0
    let countMov = 0
    let excesoVelocidad = 0
    let tiempoMovimientoMs = 0
    let tiempoDetenidoMs = 0
    const detenciones: { startTs: number; endTs: number; lat: number; lon: number; ms: number }[] = []

    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i]
      const v = Number(p.velocidad || 0)
      if (v > 45) excesoVelocidad++
      if (v > velocidadMax) velocidadMax = v
      if (v > 5) {
        velocidadSumMov += v
        countMov++
      }
      if (i > 0) {
        const prev = sorted[i - 1]
        const dt = new Date(p.timestamp).getTime() - new Date(prev.timestamp).getTime()
        if (dt > 0 && dt < 10 * 60 * 1000) {
          if (v > 5) {
            tiempoMovimientoMs += dt
            distanciaTotalKm += haversineKm(Number(prev.latitud), Number(prev.longitud), Number(p.latitud), Number(p.longitud))
          } else {
            tiempoDetenidoMs += dt
          }
        }
        // Detect detencion >= 30s
        if (v <= 5 && dt >= 30000) {
          detenciones.push({
            startTs: new Date(prev.timestamp).getTime(),
            endTs: new Date(p.timestamp).getTime(),
            lat: Number(p.latitud),
            lon: Number(p.longitud),
            ms: dt,
          })
        }
      }
    }

    // Detect "paradas" - detenciones inside a punto_ruta radio
    const paradas: any[] = []
    for (const det of detenciones) {
      let matchedPunto: any = null
      if (puntosRuta && puntosRuta.length > 0) {
        for (const pr of puntosRuta) {
          const d = haversineKm(det.lat, det.lon, Number(pr.latitud), Number(pr.longitud)) * 1000
          if (d <= (pr.radio_m || 50)) {
            matchedPunto = pr
            break
          }
        }
      }
      if (matchedPunto) {
        paradas.push({ ...det, punto: matchedPunto })
      }
    }

    const horaInicio = new Date(sorted[0].timestamp)
    const horaFin = new Date(sorted[sorted.length - 1].timestamp)
    const duracionTotalMin = (horaFin.getTime() - horaInicio.getTime()) / 60000
    const velocidadPromMov = countMov > 0 ? velocidadSumMov / countMov : 0
    const tiempoMovimientoMin = tiempoMovimientoMs / 60000
    const tiempoDetenidoMin = tiempoDetenidoMs / 60000
    const eficiencia = duracionTotalMin > 0 ? Math.round((tiempoMovimientoMin / duracionTotalMin) * 100) : 0

    let paradaMasLargaMin = 0
    let paradaMasLargaPunto: string | null = null
    for (const par of paradas) {
      const m = par.ms / 60000
      if (m > paradaMasLargaMin) {
        paradaMasLargaMin = m
        paradaMasLargaPunto = par.punto?.nombre || null
      }
    }

    const stats = {
      exceso_velocidad: excesoVelocidad,
      detenciones: detenciones.length,
      paradas: paradas.length,
      distancia_total_km: Number(distanciaTotalKm.toFixed(2)),
      duracion_total_min: Number(duracionTotalMin.toFixed(1)),
      velocidad_max_kmh: Number(velocidadMax.toFixed(1)),
      velocidad_prom_mov_kmh: Number(velocidadPromMov.toFixed(1)),
      tiempo_detenido_min: Number(tiempoDetenidoMin.toFixed(1)),
      tiempo_movimiento_min: Number(tiempoMovimientoMin.toFixed(1)),
      eficiencia_pct: eficiencia,
      parada_mas_larga_min: Number(paradaMasLargaMin.toFixed(1)),
      parada_mas_larga_punto: paradaMasLargaPunto,
      puntos_visitados: new Set(paradas.map((p) => p.punto?.id)).size,
      hora_inicio: fmtEs(horaInicio),
      hora_fin: fmtEs(horaFin),
    }

    // Build timeline
    const timeline: any[] = []
    const timelineByTs = new Map<number, any>()

    const addTimeline = (ts: number, item: any) => {
      const existing = timelineByTs.get(ts)
      if (existing) {
        existing.items = existing.items || []
        existing.items.push(item)
      } else {
        timelineByTs.set(ts, { _ts: ts, items: [item] })
      }
    }

    // Posición every 5 minutes
    let lastPosTs = 0
    for (const p of sorted) {
      const ts = new Date(p.timestamp).getTime()
      if (ts - lastPosTs >= 5 * 60 * 1000) {
        addTimeline(ts, {
          tipo: 'Posición',
          hora: fmtEs(new Date(p.timestamp)),
          latitud: Number(p.latitud),
          longitud: Number(p.longitud),
          velocidad: Number(p.velocidad || 0),
        })
        lastPosTs = ts
      }
    }

    // Excesos
    for (const p of sorted) {
      const v = Number(p.velocidad || 0)
      if (v > 45) {
        const ts = new Date(p.timestamp).getTime()
        addTimeline(ts, {
          tipo: 'Exceso',
          hora: fmtEs(new Date(p.timestamp)),
          latitud: Number(p.latitud),
          longitud: Number(p.longitud),
          velocidad: v,
        })
      }
    }

    // Detenciones (>=30s) and Pasa por punto / Detención en Punto
    const passedPuntos = new Set<string>()
    for (const p of sorted) {
      const ts = new Date(p.timestamp).getTime()
      // Check if pass through punto
      if (puntosRuta && puntosRuta.length > 0) {
        for (const pr of puntosRuta) {
          const d = haversineKm(Number(p.latitud), Number(p.longitud), Number(pr.latitud), Number(pr.longitud)) * 1000
          if (d <= (pr.radio_m || 50)) {
            if (!passedPuntos.has(pr.id)) {
              passedPuntos.add(pr.id)
              addTimeline(ts, {
                tipo: 'Pasa por Punto',
                hora: fmtEs(new Date(p.timestamp)),
                punto: pr.nombre,
                latitud: Number(p.latitud),
                longitud: Number(p.longitud),
              })
            }
          }
        }
      }
    }

    for (const det of detenciones) {
      let matchedPunto: any = null
      if (puntosRuta && puntosRuta.length > 0) {
        for (const pr of puntosRuta) {
          const d = haversineKm(det.lat, det.lon, Number(pr.latitud), Number(pr.longitud)) * 1000
          if (d <= (pr.radio_m || 50)) {
            matchedPunto = pr
            break
          }
        }
      }
      if (matchedPunto) {
        addTimeline(det.endTs, {
          tipo: 'Detención en Punto',
          hora: fmtEs(new Date(det.endTs)),
          punto: matchedPunto.nombre,
          duracion_seg: Math.round(det.ms / 1000),
          latitud: det.lat,
          longitud: det.lon,
        })
      } else {
        addTimeline(det.endTs, {
          tipo: 'Detención',
          hora: fmtEs(new Date(det.endTs)),
          duracion_seg: Math.round(det.ms / 1000),
          latitud: det.lat,
          longitud: det.lon,
        })
      }
    }

    const finalTimeline = Array.from(timelineByTs.values()).sort((a, b) => a._ts - b._ts)

    // Raw trail for map rendering (same data the reference uses for drawing)
    const trail = sorted.map(p => ({
      lat: Number(p.latitud),
      lng: Number(p.longitud),
      timestamp: p.timestamp,
      velocidad: Number(p.velocidad || 0),
      en_movimiento: !!p.en_movimiento,
      precision_gps: Number(p.precision_gps || 0),
    }))

    // Also include repartidor data for map coloring
    const { data: repData } = await supabase.from('repartidores').select('*').eq('id', repartidorId).single()

    return NextResponse.json({
      data: {
        repartidor_id: repartidorId,
        repartidor: repData,
        fecha: effectiveDate,
        fechas_disponibles: allDates,
        stats,
        timeline: finalTimeline,
        trail,
        puntos: sorted.length,
      },
    })
  } catch (e: any) {
    console.error('[api/rutas/historial GET]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}
