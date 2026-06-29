'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import {
  Loader2, MapPin, Route, Navigation, Clock, Plus, Trash2, Pin,
  ChevronLeft, ChevronRight, FileDown, AlertTriangle, Pause, Gauge,
  TrendingUp, Timer, Maximize2, Flag, Percent, PlayCircle, StopCircle,
  Check, X, ShoppingBag, Satellite, Search, RefreshCw,
} from 'lucide-react'

const VivoMap = dynamic(() => import('./rastreo-vivo-map'), {
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center bg-slate-100 rounded-lg"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>,
})
const HistorialMap = dynamic(() => import('./rastreo-historial-map'), {
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center bg-slate-100 rounded-lg"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>,
})

const getTodayStr = () => new Date().toISOString().split('T')[0]
const fmt = (n: number) => '$' + n.toLocaleString('es-UY')
const VENTAS_LS_KEY = 'gastrack-ventas-confirmadas'
type VentasMap = Record<string, 'si' | 'no'>

/* ═══════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════ */
export function RastreoModule() {
  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold">Rastreo GPS</h1><p className="text-sm text-gray-500">Seguimiento de rutas y ubicaciones en tiempo real</p></div>
      <Tabs defaultValue="vivo">
        <TabsList>
          <TabsTrigger value="vivo"><Navigation className="h-4 w-4 mr-1" /> En Vivo</TabsTrigger>
          <TabsTrigger value="historial"><Clock className="h-4 w-4 mr-1" /> Historial</TabsTrigger>
        </TabsList>
        <TabsContent value="vivo"><VivoTab /></TabsContent>
        <TabsContent value="historial"><HistorialTab /></TabsContent>
      </Tabs>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   PESTAÑA EN VIVO
   ═══════════════════════════════════════════════════════ */
function VivoTab() {
  const { toast } = useToast()
  const [reps, setReps] = useState<any[]>([])
  const [ubis, setUbis] = useState<any[]>([])
  const [puntos, setPuntos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRepId, setSelectedRepId] = useState<string | null>(null)
  const [newPoint, setNewPoint] = useState({ nombre: '', lat: '', lng: '' })
  const [simulandoId, setSimulandoId] = useState<string | null>(null)
  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const simPosRef = useRef<{ lat: number; lng: number; heading: number } | null>(null)

  /* ── FETCH PRINCIPAL ── */
  const fetchAll = useCallback(async () => {
    try {
      const [r1, r2, r3] = await Promise.all([
        fetch('/api/repartidores'),
        fetch('/api/ubicaciones'),
        fetch('/api/puntos-ruta'),
      ])
      const d1 = await r1.json()
      const d2 = await r2.json()
      const d3 = await r3.json()

      // FIX #1: La API devuelve { data: [...] }, NO d1.repartidores
      const repsData = Array.isArray(d1) ? d1 : (d1.data || d1.repartidores || [])
      setReps(repsData)

      // FIX #2: La API /api/ubicaciones devuelve { data: [{repartidor, ubicacion}] }
      // Necesitamos extraer el objeto ubicacion de cada entrada
      let ubisData: any[] = []
      if (Array.isArray(d2)) {
        ubisData = d2
      } else if (d2.ubicaciones) {
        // Formato plano: { ubicaciones: [...] }
        ubisData = d2.ubicaciones
      } else if (d2.data && Array.isArray(d2.data)) {
        // Formato anidado: { data: [{repartidor, ubicacion}] }
        ubisData = d2.data
          .map((entry: any) => {
            if (entry.ubicacion) return entry.ubicacion
            // Si es un objeto plano directamente, lo usamos
            if (entry.repartidor_id && entry.latitud) return entry
            return null
          })
          .filter(Boolean)
      }
      setUbis(ubisData)

      // Puntos: { data: [...] } → d3.data funciona correctamente
      const puntosData = Array.isArray(d3) ? d3 : (d3.data || d3.puntos || [])
      setPuntos(puntosData)
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar los datos', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 10000)
    return () => clearInterval(interval)
  }, [fetchAll])

  /* ── GUARDAR PUNTO DE REFERENCIA ── */
  const handleAddPoint = async () => {
    if (!newPoint.nombre.trim()) {
      toast({ title: 'Nombre requerido', description: 'Ingresá un nombre para el punto', variant: 'destructive' })
      return
    }
    const lat = Number(newPoint.lat)
    const lng = Number(newPoint.lng)
    if (isNaN(lat) || isNaN(lng)) {
      toast({ title: 'Coordenadas inválidas', description: 'Ingresá valores numéricos para latitud y longitud', variant: 'destructive' })
      return
    }
    try {
      const res = await fetch('/api/puntos-ruta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: newPoint.nombre.trim(), latitud: lat, longitud: lng }),
      })
      const result = await res.json()
      if (res.ok) {
        toast({ title: 'Punto guardado', description: `"${newPoint.nombre}" se guardó correctamente` })
        setNewPoint({ nombre: '', lat: '', lng: '' })
        fetchAll()
      } else {
        toast({ title: 'Error al guardar', description: result.error || 'No se pudo guardar el punto', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error de conexión', description: 'No se pudo conectar con el servidor', variant: 'destructive' })
    }
  }

  /* ── ELIMINAR PUNTO DE REFERENCIA ── */
  const handleDeletePoint = async (id: string, nombre: string) => {
    try {
      const res = await fetch(`/api/puntos-ruta?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast({ title: 'Punto eliminado', description: `"${nombre}" fue eliminado` })
        fetchAll()
      } else {
        toast({ title: 'Error al eliminar', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
    }
  }

  /* ── SIMULACIÓN GPS ── */
  const toggleSimulacion = (repId: string) => {
    if (simulandoId === repId) {
      setSimulandoId(null)
      if (simIntervalRef.current) clearInterval(simIntervalRef.current)
      toast({ title: 'Simulación detenida', description: 'Se detuvo la simulación GPS' })
      return
    }
    const ubi = ubis.find(u => u.repartidor_id === repId)
    simPosRef.current = {
      lat: ubi?.latitud || -34.4833,
      lng: ubi?.longitud || -54.3317,
      heading: Math.random() * 360,
    }
    setSimulandoId(repId)
    toast({ title: 'Simulación iniciada', description: 'Enviando posiciones cada 3 segundos...' })

    simIntervalRef.current = setInterval(async () => {
      if (!simPosRef.current) return
      const pos = simPosRef.current
      const speed = 0.0003 + Math.random() * 0.0007
      const rad = (pos.heading * Math.PI) / 180
      pos.lat += Math.cos(rad) * speed
      pos.lng += Math.sin(rad) * speed
      pos.heading += (Math.random() - 0.5) * 30
      const enMovimiento = Math.random() > 0.15
      try {
        await fetch('/api/rutas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repartidor_id: repId,
            latitud: pos.lat,
            longitud: pos.lng,
            velocidad: enMovimiento ? 2 + Math.random() * 8 : 0,
            en_movimiento: enMovimiento,
            bateria: 80,
          }),
        })
      } catch {}
    }, 3000)
  }

  useEffect(() => {
    return () => { if (simIntervalRef.current) clearInterval(simIntervalRef.current) }
  }, [])

  /* ── UI ── */
  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* ── PANEL IZQUIERDO ── */}
      <div className="space-y-4">
        {/* Tarjetas de vehículos / repartidores */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Navigation className="h-4 w-4" /> Vehículos
              </CardTitle>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={fetchAll} title="Refrescar">
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
            {reps.length === 0 && !loading && (
              <p className="text-xs text-amber-600 mt-1">No hay repartidores activos</p>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {reps.map(r => {
              const ubi = ubis.find(u => u.repartidor_id === r.id)
              const isSim = simulandoId === r.id
              const isSelected = selectedRepId === r.id
              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedRepId(isSelected ? null : r.id)}
                  className={`flex items-center gap-2 p-2.5 border rounded-lg cursor-pointer transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200 shadow-sm'
                      : 'hover:border-blue-300 hover:bg-blue-50/50'
                  }`}
                >
                  <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.color || '#3b82f6' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">{r.nombre}</p>
                    <p className="text-[10px] text-gray-500 truncate">
                      {r.vehiculo || 'Sin vehículo'}
                      {r.patente ? ` · ${r.patente}` : ''}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <Badge className={ubi ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}>
                      {ubi ? 'Online' : 'Offline'}
                    </Badge>
                    {ubi && (
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {Math.round((ubi.velocidad || 0) * 3.6)} km/h
                      </p>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSimulacion(r.id) }}
                    title={isSim ? 'Detener simulación' : 'Simular GPS'}
                    className={`flex items-center justify-center h-6 w-6 rounded-full transition-colors flex-shrink-0 ${
                      isSim
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-300'
                    }`}
                  >
                    {isSim ? <span className="text-xs font-black">■</span> : <Satellite className="h-3 w-3" />}
                  </button>
                </div>
              )
            })}
            {/* Botón "Todos" para deseleccionar */}
            {selectedRepId && (
              <button
                onClick={() => setSelectedRepId(null)}
                className="w-full text-xs text-blue-600 hover:text-blue-800 hover:underline py-1"
              >
                Mostrar todos los vehículos
              </button>
            )}
          </CardContent>
        </Card>

        {/* Puntos de referencia */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Pin className="h-4 w-4 text-emerald-600" /> Puntos de Referencia
              {puntos.length > 0 && (
                <Badge variant="outline" className="text-[10px] ml-auto">{puntos.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Input
              placeholder="Nombre del punto"
              value={newPoint.nombre}
              onChange={e => setNewPoint({ ...newPoint, nombre: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Latitud"
                type="number"
                step="any"
                value={newPoint.lat}
                onChange={e => setNewPoint({ ...newPoint, lat: e.target.value })}
              />
              <Input
                placeholder="Longitud"
                type="number"
                step="any"
                value={newPoint.lng}
                onChange={e => setNewPoint({ ...newPoint, lng: e.target.value })}
              />
            </div>
            <Button size="sm" onClick={handleAddPoint} className="w-full bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-3 w-3 mr-1" /> Agregar Punto
            </Button>
            {puntos.length > 0 && (
              <ScrollArea className="h-36">
                <div className="space-y-1">
                  {puntos.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-xs p-1.5 hover:bg-gray-50 rounded group">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Pin className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                        <span className="truncate">{p.nombre}</span>
                      </div>
                      <button
                        onClick={() => handleDeletePoint(p.id, p.nombre)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 flex-shrink-0"
                        title="Eliminar punto"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── MAPA ── */}
      <div className="lg:col-span-3">
        <Card className="overflow-hidden border-blue-200">
          <CardContent className="p-0 relative">
            <div className="h-[500px]">
              <VivoMap
                key={"map-" + puntos.length}
                repartidores={reps}
                ubicaciones={ubis}
                puntosReferencia={puntos}
                selectedRepId={selectedRepId}
              />
            </div>
            {/* Indicador de selección */}
            {selectedRepId && (
              <div className="absolute top-3 left-3 z-[1000]">
                <div className="flex items-center gap-2 bg-white/95 px-3 py-1.5 rounded-full shadow-md border border-blue-200">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-xs font-bold">
                    {reps.find(r => r.id === selectedRepId)?.nombre || 'Repartidor'}
                  </span>
                  <button onClick={() => setSelectedRepId(null)}>
                    <X className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600" />
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   PESTAÑA HISTORIAL
   ═══════════════════════════════════════════════════════ */
function HistorialTab() {
  const { toast } = useToast()
  const [reps, setReps] = useState<any[]>([])
  const [selRep, setSelRep] = useState('')
  const [histFecha, setHistFecha] = useState(getTodayStr())
  const [histData, setHistData] = useState<any>(null)
  const [loadingHist, setLoadingHist] = useState(false)
  const [histGenerated, setHistGenerated] = useState(false)
  const [selEventIdx, setSelEventIdx] = useState<number | null>(null)
  const [puntosReferencia, setPuntosReferencia] = useState<any[]>([])
  const [eventFilters, setEventFilters] = useState<Record<string, boolean>>({ 'Detención': true, 'Detención en Punto': true, 'Pasa por Punto': true, 'Exceso de Velocidad': true, 'Posición': true })
  const [searchTimeline, setSearchTimeline] = useState('')
  const [exportingPdf, setExportingPdf] = useState(false)
  const [ventasConfirmadas, setVentasConfirmadas] = useState<VentasMap>({})

  useEffect(() => { try { const s = localStorage.getItem(VENTAS_LS_KEY); if (s) setVentasConfirmadas(JSON.parse(s)) } catch {} }, [])

  // FIX #6: Mismo bug que VivoTab - agregar d.data como fallback
  useEffect(() => {
    fetch('/api/repartidores')
      .then(r => r.json())
      .then(d => setReps(Array.isArray(d) ? d : (d.data || d.repartidores || [])))
      .catch(() => {})
    fetch('/api/puntos-ruta')
      .then(r => r.json())
      .then(d => setPuntosReferencia(Array.isArray(d) ? d : (d.data || d.puntos || [])))
      .catch(() => {})
  }, [])

  const generarInforme = useCallback(async () => {
    if (!selRep) { toast({ title: 'Seleccioná un repartidor', variant: 'destructive' }); return }
    setLoadingHist(true); setHistGenerated(false); setSelEventIdx(null)
    try {
      const res = await fetch(`/api/rutas/historial?repartidor_id=${selRep}&fecha=${histFecha}`)
      const data = await res.json()
      // FIX: La API devuelve { data: {...} } — desanidar
      const inner = data.data || data
      setHistData(inner)
      setHistGenerated(true)
      if (inner.fecha && inner.fecha !== histFecha) setHistFecha(inner.fecha)
    } catch {
      toast({ title: 'Error', description: 'No se pudo generar el informe', variant: 'destructive' })
    } finally { setLoadingHist(false) }
  }, [selRep, histFecha, toast])

  const shiftDia = (delta: number) => { const d = new Date(histFecha + 'T00:00:00'); if (isNaN(d.getTime())) return; d.setDate(d.getDate() + delta); const n = d.toISOString().split('T')[0]; if (n === histFecha) return; setHistFecha(n); if (histGenerated && selRep) setTimeout(() => generarInforme(), 50) }
  const ventaKey = (stopId: string) => `${selRep}|${histData?.fecha || histFecha}|${stopId}`
  const confirmarVenta = (stopId: string, valor: 'si' | 'no') => { setVentasConfirmadas(prev => { const key = ventaKey(stopId); const next = { ...prev, [key]: prev[key] === valor ? ('' as any) : valor }; try { localStorage.setItem(VENTAS_LS_KEY, JSON.stringify(next)) } catch {} return next }) }
  const toggleFiltro = (tipo: string) => setEventFilters(prev => ({ ...prev, [tipo]: !prev[tipo] }))
  const restablecerFiltros = () => setEventFilters({ 'Detención': true, 'Detención en Punto': true, 'Pasa por Punto': true, 'Exceso de Velocidad': true, 'Posición': true })

  const timelineFiltrada = useMemo(() => {
    if (!histData?.timeline) return []
    // FIX: Si la timeline viene anidada en items (formato de la API), aplanarla
    let events = histData.timeline
    if (events.length > 0 && events[0].items) {
      events = events.flatMap((group: any) => group.items || [group])
    }
    // FIX: Mapear campo 'tipo' → 'evento' si viene de la API
    const mapped = events.map((ev: any) => ({
      ...ev,
      evento: ev.evento || ev.tipo || 'Posición',
      punto_nombre: ev.punto_nombre || ev.punto || '',
      detalle: ev.detalle || '',
      hora: ev.hora || '',
      es_detencion: ev.es_detencion || (ev.tipo === 'Detención') || (ev.tipo === 'Detención en Punto') || false,
      stop_id: ev.stop_id || null,
      latitud: ev.latitud ?? ev.lat ?? 0,
      longitud: ev.longitud ?? ev.lng ?? 0,
    }))
    return mapped.map((event: any, origIdx: number) => ({ origIdx, event }))
      .filter(({ event }: any) => {
        if (eventFilters[event.evento] === false) return false
        if (searchTimeline) {
          const q = searchTimeline.toLowerCase()
          return (event.detalle || '').toLowerCase().includes(q) ||
            (event.punto_nombre || '').toLowerCase().includes(q) ||
            (event.evento || '').toLowerCase().includes(q)
        }
        return true
      })
  }, [histData, eventFilters, searchTimeline])

  const eventCounts = useMemo(() => {
    const c: Record<string, number> = {}
    if (!histData?.timeline) return c
    let events = histData.timeline
    if (events.length > 0 && events[0].items) {
      events = events.flatMap((group: any) => group.items || [group])
    }
    for (const ev of events) {
      const tipo = ev.evento || ev.tipo || 'Posición'
      c[tipo] = (c[tipo] || 0) + 1
    }
    return c
  }, [histData])

  const exportarPDF = async () => {
    if (!histData) return; setExportingPdf(true)
    try {
      const { default: jsPDF } = await import('jspdf'); const autoTable = (await import('jspdf-autotable')).default
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }); const rep = histData.repartidor || {}; const stats = histData.stats || {}; const fecha = histData.fecha || histFecha; const pageWidth = doc.internal.pageSize.getWidth()
      doc.setFillColor(15, 64, 129); doc.rect(0, 0, pageWidth, 22, 'F'); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('GasTrack ERP - Informe de Recorrido', 12, 10); doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.text(`Repartidor: ${rep.nombre || '-'}`, 12, 17); doc.text(`Fecha: ${fecha}`, pageWidth - 60, 17)
      const paradasTotal = stats.paradas ?? stats.detenciones ?? 0; const ventasCount = Object.entries(ventasConfirmadas).filter(([k, v]) => v === 'si' && k.startsWith(`${selRep}|${fecha}|`)).length; const tasaConv = paradasTotal > 0 ? Math.round((ventasCount / paradasTotal) * 100) : 0; const fmtMin = (m?: number) => { if (m == null || isNaN(m)) return '--'; const h = Math.floor(m / 60); const mm = m % 60; return h > 0 ? `${h}h ${mm}m` : `${mm}m` }
      autoTable(doc, { startY: 35, theme: 'grid', head: [['Metrica', 'Valor', 'Metrica', 'Valor']], body: [['Distancia', `${stats.distancia_total_km ?? 0} km`, 'Paradas', `${paradasTotal}`], ['Ventas', `${ventasCount} / ${paradasTotal}`, 'Eficiencia', `${stats.eficiencia_pct ?? 0}%`], ['Vel. Max', `${stats.velocidad_max_kmh ?? 0} km/h`, 'Vel. Prom', `${stats.velocidad_prom_mov_kmh ?? 0} km/h`], ['T. Mov', fmtMin(stats.tiempo_movimiento_min), 'T. Det', fmtMin(stats.tiempo_detenido_min)], ['Conversion', `${tasaConv}%`, 'Puntos visitados', `${stats.puntos_visitados ?? 0}`], ['Hora inicio', stats.hora_inicio || '--', 'Hora fin', stats.hora_fin || '--']], headStyles: { fillColor: [59, 130, 246], fontSize: 9 }, bodyStyles: { fontSize: 9 }, margin: { left: 12, right: 12 } })
      autoTable(doc, { startY: (doc as any).lastAutoTable.finalY + 6, head: [['Hora', 'Evento', 'Detalle', 'Punto', 'Venta']], body: (histData.timeline || []).map((ev: any) => { const isDet = !!ev.es_detencion; const stopId = ev.stop_id; const venta = isDet && stopId ? (ventasConfirmadas[ventaKey(stopId)] === 'si' ? 'Si' : ventasConfirmadas[ventaKey(stopId)] === 'no' ? 'No' : '--') : '--'; const evento = ev.evento || ev.tipo || ''; const puntoNombre = ev.punto_nombre || ev.punto || ''; return [ev.hora || '', evento, ev.detalle || '', puntoNombre || '--', venta] }), headStyles: { fillColor: [59, 130, 246], fontSize: 9 }, bodyStyles: { fontSize: 8 }, margin: { left: 12, right: 12 } })
      doc.save(`informe-${rep.nombre || 'repartidor'}-${fecha}.pdf`.replace(/\s+/g, '_')); toast({ title: 'PDF generado' })
    } catch (e: any) { toast({ title: 'Error al exportar PDF', variant: 'destructive' }) } finally { setExportingPdf(false) }
  }

  const stats = histData?.stats || {}; const timeline = histData?.timeline || []
  const fmtMin = (m?: number) => { if (m == null || isNaN(m)) return '--'; const h = Math.floor(m / 60); const mm = m % 60; return h > 0 ? `${h}h ${mm}m` : `${mm}m` }
  const paradasTotal = stats.paradas ?? stats.detenciones ?? 0
  const ventasCount = Object.entries(ventasConfirmadas).filter(([k, v]) => v === 'si' && k.startsWith(`${selRep}|${histData?.fecha || histFecha}|`)).length
  const tasaConv = paradasTotal > 0 ? Math.round((ventasCount / paradasTotal) * 100) : 0

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-3 flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[200px]"><Label>Repartidor</Label><Select value={selRep} onValueChange={setSelRep}><SelectTrigger><SelectValue placeholder="-- Seleccione --" /></SelectTrigger><SelectContent><SelectItem value="__none__">-- Seleccione --</SelectItem>{reps.map(r => <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>)}</SelectContent></Select></div>
        <div className="flex items-center gap-1"><Button variant="outline" size="icon" onClick={() => shiftDia(-1)} className="h-9 w-9 border-blue-200"><ChevronLeft className="h-4 w-4" /></Button><Input type="date" value={histFecha} onChange={e => setHistFecha(e.target.value)} className="text-center font-medium" /><Button variant="outline" size="icon" onClick={() => shiftDia(1)} className="h-9 w-9 border-blue-200"><ChevronRight className="h-4 w-4" /></Button></div>
        <Button onClick={generarInforme} disabled={loadingHist} className="bg-blue-600 hover:bg-blue-700">{loadingHist ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Route className="h-4 w-4 mr-1" /> Generar</>}</Button>
        <Button onClick={exportarPDF} disabled={!histData || exportingPdf} variant="outline" className="border-red-300 text-red-700">{exportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />} PDF</Button>
      </CardContent></Card>

      {histGenerated && histData && (<>
        <Card className="overflow-hidden border-blue-200"><CardContent className="p-0 relative"><div className="h-[400px]"><HistorialMap trail={histData.trail || []} repartidor={histData.repartidor} puntosReferencia={puntosReferencia} selectedEvent={selEventIdx != null && timeline[selEventIdx] ? timeline[selEventIdx] : null} /></div>
          {selEventIdx != null && timeline[selEventIdx] && <div className="absolute top-3 left-3 z-[1000]"><div className="flex items-center gap-2 bg-white/95 px-3 py-1.5 rounded-full shadow-md border border-blue-200"><MapPin className="h-3.5 w-3.5 text-blue-600" /><span className="text-xs font-bold">{timeline[selEventIdx].evento || timeline[selEventIdx].tipo}</span><span className="text-[11px] text-gray-500 font-mono">{timeline[selEventIdx].hora}</span><button onClick={() => setSelEventIdx(null)}><X className="h-3.5 w-3.5" /></button></div></div>}
        </CardContent></Card>

        {/* Resumen ejecutivo */}
        <Card className="border-blue-300 bg-gradient-to-r from-blue-50 to-emerald-50"><CardContent className="p-4"><div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: histData.repartidor?.color || '#3b82f6' }} /><div><p className="text-xs text-gray-500 uppercase font-bold">Repartidor</p><p className="text-base font-black">{histData.repartidor?.nombre || '-'}{histData.repartidor?.vehiculo && <span className="text-xs font-normal text-gray-500 ml-2">· {histData.repartidor.vehiculo}</span>}</p></div></div>
          <div><p className="text-xs text-gray-500 uppercase font-bold">Fecha</p><p className="text-sm font-bold">{histData.fecha}</p></div>
          <div><p className="text-xs text-gray-500 uppercase font-bold">Horario</p><p className="text-sm font-bold font-mono">{stats.hora_inicio || '--'} → {stats.hora_fin || '--'}</p></div>
          <div><p className="text-xs text-gray-500 uppercase font-bold">Distancia</p><p className="text-sm font-bold text-blue-700">{stats.distancia_total_km} km</p></div>
          <div><p className="text-xs text-gray-500 uppercase font-bold">Paradas</p><p className="text-sm font-bold text-orange-700">{paradasTotal}</p></div>
          <div><p className="text-xs text-gray-500 uppercase font-bold">Ventas</p><p className="text-sm font-bold text-emerald-700">{ventasCount}/{paradasTotal} ({tasaConv}%)</p></div>
          <div><p className="text-xs text-gray-500 uppercase font-bold">Eficiencia</p><p className="text-sm font-bold text-purple-700">{stats.eficiencia_pct}%</p></div>
        </div></CardContent></Card>

        {/* 13 stat cards */}
        {(() => { const cards = [
          { icon: AlertTriangle, label: 'Exceso (>45 km/h)', value: String(stats.exceso_velocidad ?? 0), color: 'text-red-700', bg: 'border-red-200 bg-red-50/50' },
          { icon: Pause, label: 'Paradas (a 0 km/h)', value: String(paradasTotal), color: 'text-orange-700', bg: 'border-orange-200 bg-orange-50/50' },
          { icon: Gauge, label: 'Distancia Total', value: `${stats.distancia_total_km ?? 0} km`, color: 'text-blue-700', bg: 'border-blue-200 bg-blue-50/50' },
          { icon: ShoppingBag, label: 'Ventas Confirmadas', value: `${ventasCount}`, sub: `/ ${paradasTotal}`, color: 'text-emerald-700', bg: 'border-emerald-200 bg-emerald-50/50' },
          { icon: Maximize2, label: 'Velocidad Max', value: `${stats.velocidad_max_kmh ?? 0}`, sub: 'km/h', color: 'text-rose-700', bg: 'border-rose-200 bg-rose-50/50' },
          { icon: TrendingUp, label: 'Vel. Prom (en mov)', value: `${stats.velocidad_prom_mov_kmh ?? 0}`, sub: 'km/h', color: 'text-cyan-700', bg: 'border-cyan-200 bg-cyan-50/50' },
          { icon: StopCircle, label: 'Tiempo Detenido', value: fmtMin(stats.tiempo_detenido_min), color: 'text-amber-700', bg: 'border-amber-200 bg-amber-50/50' },
          { icon: PlayCircle, label: 'Tiempo en Mov', value: fmtMin(stats.tiempo_movimiento_min), color: 'text-teal-700', bg: 'border-teal-200 bg-teal-50/50' },
          { icon: Percent, label: '% Eficiencia', value: `${stats.eficiencia_pct ?? 0}%`, sub: 'mov / total', color: 'text-purple-700', bg: 'border-purple-200 bg-purple-50/50' },
          { icon: Timer, label: 'Parada Mas Larga', value: fmtMin(stats.parada_mas_larga_min), sub: stats.parada_mas_larga_punto ? `· ${stats.parada_mas_larga_punto}` : 'sin punto', color: 'text-orange-700', bg: 'border-orange-200 bg-orange-50/50' },
          { icon: Flag, label: 'Puntos Visitados', value: String(stats.puntos_visitados ?? 0), color: 'text-emerald-700', bg: 'border-emerald-200 bg-emerald-50/50' },
          { icon: ShoppingBag, label: 'Tasa Conversion', value: `${tasaConv}%`, sub: `${ventasCount}/${paradasTotal}`, color: 'text-green-700', bg: 'border-green-200 bg-green-50/50' },
          { icon: Clock, label: 'Inicio / Fin', value: stats.hora_inicio || '--', sub: `→ ${stats.hora_fin || '--'}`, color: 'text-indigo-700', bg: 'border-indigo-200 bg-indigo-50/50' },
        ]; return <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-3">{cards.map((c, i) => { const Icon = c.icon; return <Card key={i} className={c.bg}><CardContent className="p-3 text-center"><div className="flex items-center justify-center gap-1.5 mb-1"><Icon className={`h-3.5 w-3.5 ${c.color}`} /><p className={`text-[10px] font-bold uppercase ${c.color}`}>{c.label}</p></div><p className={`text-xl font-black ${c.color}`}>{c.value}{c.sub && <span className="text-xs font-bold text-gray-400 ml-1">{c.sub}</span>}</p></CardContent></Card> })}</div> })()}

        {/* Timeline con filtros */}
        <Card className="border-blue-200"><CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="text-lg flex items-center gap-2"><Clock className="h-5 w-5 text-blue-600" /> Linea de Tiempo {histData.repartidor && <span className="text-blue-600">- {histData.repartidor.nombre}</span>}</CardTitle><span className="text-xs text-gray-500">Mostrando <strong>{timelineFiltrada.length}</strong> de <strong>{timeline.length}</strong></span></div>
          <p className="text-xs text-gray-500">Hace <strong>clic en cualquier evento</strong> para ir al mapa. <strong>Cada vez que se detuvo a 0 km/h</strong> podes registrar si hubo venta.</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-blue-100"><span className="text-xs font-bold text-gray-600">Filtrar:</span>
            {[{ tipo: 'Detencion', color: 'border-orange-300 text-orange-700 bg-orange-50', dot: 'bg-orange-400' }, { tipo: 'Detencion en Punto', color: 'border-amber-400 text-amber-800 bg-amber-100', dot: 'bg-amber-500' }, { tipo: 'Pasa por Punto', color: 'border-emerald-300 text-emerald-700 bg-emerald-50', dot: 'bg-emerald-500' }, { tipo: 'Exceso de Velocidad', color: 'border-red-300 text-red-700 bg-red-50', dot: 'bg-red-500' }, { tipo: 'Posicion', color: 'border-gray-300 text-gray-600 bg-white', dot: 'bg-gray-400' }].map(f => { const active = eventFilters[f.tipo] !== false; const count = eventCounts[f.tipo] || 0; return <button key={f.tipo} onClick={() => toggleFiltro(f.tipo)} className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold border transition-all ${active ? f.color : 'border-gray-200 text-gray-400 bg-gray-50 opacity-60 line-through'}`}><span className={`w-1.5 h-1.5 rounded-full ${active ? f.dot : 'bg-gray-300'}`} />{f.tipo}<span className="text-[10px] opacity-70">({count})</span></button> })}
            <button onClick={restablecerFiltros} className="ml-auto text-[11px] text-blue-600 hover:underline">Restablecer</button>
          </div>
          <div className="relative mt-2"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input placeholder="Buscar en la linea de tiempo..." value={searchTimeline} onChange={e => setSearchTimeline(e.target.value)} className="pl-9 h-9" /></div>
        </CardHeader>
        <CardContent className="p-4 pt-0"><div className="border rounded max-h-[450px] overflow-y-auto"><table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-gray-200 z-10"><tr><th className="p-2 border font-extrabold">Hora</th><th className="p-2 border font-extrabold">Evento</th><th className="p-2 border font-extrabold">Detalle</th><th className="p-2 border font-extrabold">Punto</th><th className="p-2 border font-extrabold text-center">Venta</th></tr></thead>
          <tbody>{timeline.length === 0 ? <tr><td colSpan={5} className="p-4 text-center text-gray-500">No hay datos.</td></tr> : timelineFiltrada.map(({ origIdx, event }) => { const i = origIdx; const isDet = !!event.es_detencion; const stopId = event.stop_id; const confirmation = isDet && stopId ? ventasConfirmadas[ventaKey(stopId)] : undefined; const isSelected = selEventIdx === i; const eventoName = event.evento || ''; const rowBg = isSelected ? 'bg-blue-100 ring-2 ring-inset ring-blue-400' : eventoName.includes('Exceso') ? 'bg-red-50' : eventoName.includes('Punto') ? 'bg-amber-50' : eventoName.includes('Pasa') ? 'bg-emerald-50' : eventoName.includes('Detencion') ? 'bg-orange-50' : 'hover:bg-gray-50'; return (
            <tr key={i} onClick={() => setSelEventIdx(isSelected ? null : i)} className={`cursor-pointer ${rowBg}`}>
              <td className="p-2 border font-mono text-xs"><div className="flex items-center gap-1.5"><MapPin className={`h-3.5 w-3.5 ${isSelected ? 'text-blue-600' : 'text-gray-300'}`} />{event.hora}</div></td>
              <td className="p-2 border"><Badge variant="outline" className="text-xs">{eventoName}</Badge></td>
              <td className="p-2 border">{event.detalle}</td>
              <td className="p-2 border">{event.punto_nombre ? <span className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">{event.punto_nombre}</span> : <span className="text-gray-300">--</span>}</td>
              <td className="p-2 border text-center">{isDet && stopId ? <div className="flex items-center justify-center gap-1"><button onClick={e => { e.stopPropagation(); confirmarVenta(stopId, 'si') }} className={`h-6 w-6 rounded-full ${confirmation === 'si' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700 border border-green-300'}`}><Check className="h-3.5 w-3.5" /></button><button onClick={e => { e.stopPropagation(); confirmarVenta(stopId, 'no') }} className={`h-6 w-6 rounded-full ${confirmation === 'no' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700 border border-red-300'}`}><X className="h-3.5 w-3.5" /></button></div> : <span className="text-gray-300">--</span>}</td>
            </tr>) })}
          </tbody>
        </table></div></CardContent></Card>
      </>)}

      {!histGenerated && <Card className="border-blue-100"><CardContent className="p-12 text-center"><Route className="h-12 w-12 text-blue-200 mx-auto mb-3" /><p className="text-gray-500">Selecciona un repartidor y genera el informe.</p></CardContent></Card>}
    </div>
  )
}
