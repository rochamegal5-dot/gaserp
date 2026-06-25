import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase, fetchLatestUbicacionByRep, fetchUbicacionesDeHoy } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function startOfDayISO(d: Date): string {
  const s = new Date(d)
  s.setHours(0, 0, 0, 0)
  return s.toISOString()
}
function endOfDayISO(d: Date): string {
  const s = new Date(d)
  s.setHours(23, 59, 59, 999)
  return s.toISOString()
}
function startOfMonthISO(d: Date): string {
  const s = new Date(d.getFullYear(), d.getMonth(), 1)
  return s.toISOString()
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export async function GET() {
  try {
    const now = new Date()
    const todayStart = startOfDayISO(now)
    const todayEnd = endOfDayISO(now)
    const monthStart = startOfMonthISO(now)

    // Total ventas hoy
    let totalVentasHoy = 0
    let ventasPendientes = 0
    let cobrarTotal = 0
    let pagarTotal = 0
    let cajaHoy = { ingresos: 0, egresos: 0, margen: 0, movimientos: 0 }
    let totalVentasMes = 0

    const { data: ventasHoy } = await supabase
      .from('ventas')
      .select('total, metodo_pago, estado, saldo_pendiente, created_at')
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd)
    if (ventasHoy) {
      for (const v of ventasHoy) {
        totalVentasHoy += Number(v.total || 0)
        if (v.estado === 'Pendiente' || v.metodo_pago === 'fiado') {
          ventasPendientes++
          cobrarTotal += Number(v.saldo_pendiente || v.total || 0)
        }
      }
    }

    // Total ventas mes
    const { data: ventasMes } = await supabase
      .from('ventas')
      .select('total')
      .gte('created_at', monthStart)
    if (ventasMes) {
      for (const v of ventasMes) totalVentasMes += Number(v.total || 0)
    }

    // Total pendientes en fiado (all)
    const { data: pendientes } = await supabase
      .from('ventas')
      .select('total, saldo_pendiente, metodo_pago, estado')
      .eq('estado', 'Pendiente')
    if (pendientes) {
      cobrarTotal = 0
      for (const v of pendientes) {
        cobrarTotal += Number(v.saldo_pendiente || v.total || 0)
      }
    }

    // Remitos no pagados
    const { data: remitosNp } = await supabase
      .from('remitos')
      .select('monto_total, saldo_pendiente, pagado')
      .eq('pagado', false)
    if (remitosNp) {
      for (const r of remitosNp) {
        pagarTotal += Number(r.saldo_pendiente || r.monto_total || 0)
      }
    }

    // Caja hoy
    const { data: cajaMovs } = await supabase
      .from('movimientos_caja')
      .select('tipo, monto')
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd)
    if (cajaMovs) {
      let ing = 0, egr = 0
      for (const m of cajaMovs) {
        if (m.tipo === 'ingreso') ing += Number(m.monto || 0)
        else if (m.tipo === 'egreso') egr += Number(m.monto || 0)
      }
      cajaHoy = { ingresos: ing, egresos: egr, margen: ing - egr, movimientos: cajaMovs.length }
    }

    // Counts
    const { count: clientesCount } = await supabase.from('clientes').select('id', { count: 'exact', head: true })
    const { count: productosCount } = await supabase.from('productos').select('id', { count: 'exact', head: true })

    // Stock bajo (llenas < 5)
    let stockBajo: any[] = []
    const { data: sd } = await supabase.from('stock_deposito').select('id, producto_id, llenas, producto:productos(nombre)').lt('llenas', 5)
    if (sd) stockBajo = sd

    // Ventas 7 días
    const ventas7Dias: { fecha: string; dia: string; total: number; count: number }[] = []
    const diasSemana = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      const dStart = startOfDayISO(d)
      const dEnd = endOfDayISO(d)
      const { data: vd } = await supabase
        .from('ventas')
        .select('total')
        .gte('created_at', dStart)
        .lte('created_at', dEnd)
      const total = (vd || []).reduce((s, v) => s + Number(v.total || 0), 0)
      ventas7Dias.push({
        fecha: d.toISOString().split('T')[0],
        dia: diasSemana[d.getDay()],
        total,
        count: vd?.length || 0,
      })
    }

    // Reps en vivo
    const { data: reps } = await supabase.from('repartidores').select('*').eq('activo', true)
    const repsEnVivo: any[] = []
    if (reps) {
      const todayPings = await fetchUbicacionesDeHoy()
      const todayPingsByRep = new Map<string, any[]>()
      for (const p of todayPings) {
        if (!todayPingsByRep.has(p.repartidor_id)) todayPingsByRep.set(p.repartidor_id, [])
        todayPingsByRep.get(p.repartidor_id)!.push(p)
      }
      for (const rep of reps) {
        const latest = await fetchLatestUbicacionByRep(rep.id)
        const ts = latest?.timestamp ? new Date(latest.timestamp).getTime() : 0
        const segundos = ts > 0 ? Math.round((Date.now() - ts) / 1000) : null
        const online = segundos !== null && segundos < 300
        const pingsHoy = todayPingsByRep.get(rep.id) || []
        // Compute paradas hoy (detenciones >= 30s in today pings)
        let paradasHoy = 0
        let kmHoy = 0
        const sortedP = [...pingsHoy].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        for (let i = 1; i < sortedP.length; i++) {
          const prev = sortedP[i - 1]
          const p = sortedP[i]
          const dt = new Date(p.timestamp).getTime() - new Date(prev.timestamp).getTime()
          if (dt >= 30000 && Number(p.velocidad || 0) <= 5) paradasHoy++
          if (dt > 0 && dt < 10 * 60 * 1000) {
            kmHoy += haversineKm(Number(prev.latitud), Number(prev.longitud), Number(p.latitud), Number(p.longitud))
          }
        }
        repsEnVivo.push({
          id: rep.id,
          nombre: rep.nombre,
          color: rep.color,
          vehiculo: rep.vehiculo,
          ultima_velocidad_kmh: latest?.velocidad ? Number(latest.velocidad) : 0,
          ultima_actualizacion_iso: latest?.timestamp || null,
          segundos_desde_ultima: segundos,
          online,
          km_hoy: Number(kmHoy.toFixed(2)),
          paradas_hoy: paradasHoy,
          pings_hoy: pingsHoy.length,
        })
      }
    }

    // Alertas
    const alertas: { nivel: string; modulo: string; titulo: string; detalle: string }[] = []
    if (stockBajo.length > 0) {
      alertas.push({
        nivel: 'warn',
        modulo: 'stock',
        titulo: 'Stock bajo',
        detalle: `${stockBajo.length} producto(s) con menos de 5 unidades llenas`,
      })
    }
    if (cobrarTotal > 0) {
      alertas.push({
        nivel: 'info',
        modulo: 'finanzas',
        titulo: 'Cuentas por cobrar',
        detalle: `$${cobrarTotal} pendiente de cobro`,
      })
    }
    if (pagarTotal > 0) {
      alertas.push({
        nivel: 'info',
        modulo: 'finanzas',
        titulo: 'Cuentas por pagar',
        detalle: `$${pagarTotal} pendiente de pago a proveedores`,
      })
    }
    const offlineReps = repsEnVivo.filter((r) => !r.online)
    if (offlineReps.length > 0) {
      alertas.push({
        nivel: 'warn',
        modulo: 'repartidores',
        titulo: 'Repartidores sin señal',
        detalle: `${offlineReps.length} repartidor(es) sin GPS en los últimos 5 min`,
      })
    }

    return NextResponse.json({
      data: {
        total_ventas_hoy: totalVentasHoy,
        total_ventas_mes: totalVentasMes,
        ventas_pendientes: ventasPendientes,
        clientes_count: clientesCount || 0,
        productos_count: productosCount || 0,
        stock_bajo: stockBajo,
        cobrar_total: cobrarTotal,
        pagar_total: pagarTotal,
        caja_hoy: cajaHoy,
        ventas_7_dias: ventas7Dias,
        reps_en_vivo: repsEnVivo,
        alertas,
      },
    })
  } catch (e: any) {
    console.error('[api/dashboard GET]', e)
    return NextResponse.json({ error: e.message || 'internal' }, { status: 500 })
  }
}
