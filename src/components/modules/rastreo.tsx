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
  Check, X, ShoppingBag, Satellite, Search,
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

function VivoTab() {
  const { toast } = useToast()
  const [reps, setReps] = useState<any[]>([])
  const [ubis, setUbis] = useState<any[]>([])
  const [puntos, setPuntos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newPoint, setNewPoint] = useState({ nombre: '', lat: '', lng: '' })
  const [simulandoId, setSimulandoId] = useState<string | null>(null)
  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const simPosRef = useRef<{ lat: number; lng: number; heading: number } | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [r1, r2, r3] = await Promise.all([fetch('/api/repartidores'), fetch('/api/ubicaciones'), fetch('/api/puntos-ruta')])
      const d1 = await r1.json(); const d2 = await r2.json(); const d3 = await r3.json()
      setReps(Array.isArray(d1) ? d1 : (d1.repartidores || []))
      setUbis(Array.isArray(d2) ? d2 : (d2.ubicaciones || []))
      setPuntos(Array.isArray(d3) ? d3 : (d3.puntos || []))
    } catch { toast({ title: 'Error', description: 'No se pudieron cargar los datos', variant: 'destructive' }) }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { fetchAll(); const i = setInterval(fetchAll, 10000); return () => clearInterval(i) }, [fetchAll])

  const handleAddPoint = async () => {
    if (!newPoint.nombre || !newPoint.lat || !newPoint.lng) return
    try { await fetch('/api/puntos-ruta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: newPoint.nombre, latitud: Number(newPoint.lat), longitud: Number(newPoint.lng) }) }); setNewPoint({ nombre: '', lat: '', lng: '' }); fetchAll() } catch {}
  }
  const handleDeletePoint = async (id: string) => { try { await fetch(`/api/puntos-ruta?id=${id}`, { method: 'DELETE' }); fetchAll() } catch {} }

  const toggleSimulacion = (repId: string) => {
    if (simulandoId === repId) { setSimulandoId(null); if (simIntervalRef.current) clearInterval(simIntervalRef.current); return }
    const ubi = ubis.find(u => u.repartidor_id === repId)
    simPosRef.current = { lat: ubi?.latitud || -34.9011, lng: ubi?.longitud || -56.1645, heading: Math.random() * 360 }
    setSimulandoId(repId)
    simIntervalRef.current = setInterval(async () => {
      if (!simPosRef.current) return
      const pos = simPosRef.current; const speed = 0.0003 + Math.random() * 0.0007; const rad = (pos.heading * Math.PI) / 180
      pos.lat += Math.cos(rad) * speed; pos.lng += Math.sin(rad) * speed; pos.heading += (Math.random() - 0.5) * 30
      const enMovimiento = Math.random() > 0.15
      try { await fetch('/api/rutas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repartidor_id: repId, latitud: pos.lat, longitud: pos.lng, velocidad: enMovimiento ? 2 + Math.random() * 8 : 0, en_movimiento: enMovimiento, bateria: 80 }) }) } catch {}
    }, 3000)
  }
  useEffect(() => { return () => { if (simIntervalRef.current) clearInterval(simIntervalRef.current) } }, [])

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      <div className="space-y-4">
        <Card><CardHeader><CardTitle className="text-sm flex items-center gap-2"><Navigation className="h-4 w-4" /> Vehículos</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {reps.map(r => { const ubi = ubis.find(u => u.repartidor_id === r.id); const isSim = simulandoId === r.id; return (
              <div key={r.id} className="flex items-center gap-2 p-2 border rounded-lg">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: r.color }} />
                <div className="flex-1 min-w-0"><p className="text-xs font-bold truncate">{r.nombre}</p><p className="text-[10px] text-gray-500">{ubi ? `${Math.round((ubi.velocidad || 0) * 3.6)} km/h` : 'Sin señal'}</p></div>
                <Badge className={ubi ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}>{ubi ? 'Online' : 'Offline'}</Badge>
                <button onClick={() => toggleSimulacion(r.id)} title={isSim ? 'Detener' : 'Simular GPS'} className={`flex items-center justify-center h-6 w-6 rounded-full transition-colors ${isSim ? 'bg-red-500 text-white' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-300'}`}>{isSim ? <span className="text-xs font-black">■</span> : <Satellite className="h-3 w-3" />}</button>
              </div>) })}
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle className="text-sm flex items-center gap-2"><Pin className="h-4 w-4 text-emerald-600" /> Puntos de Referencia</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Input placeholder="Nombre" value={newPoint.nombre} onChange={e => setNewPoint({ ...newPoint, nombre: e.target.value })} />
            <div className="grid grid-cols-2 gap-2"><Input placeholder="Lat" value={newPoint.lat} onChange={e => setNewPoint({ ...newPoint, lat: e.target.value })} /><Input placeholder="Lng" value={newPoint.lng} onChange={e => setNewPoint({ ...newPoint, lng: e.target.value })} /></div>
            <Button size="sm" onClick={handleAddPoint} className="w-full"><Plus className="h-3 w-3 mr-1" /> Agregar</Button>
            <ScrollArea className="h-32">{puntos.map(p => <div key={p.id} className="flex items-center justify-between text-xs p-1.5 hover:bg-gray-50"><span className="truncate">{p.nombre}</span><button onClick={() => handleDeletePoint(p.id)}><Trash2 className="h-3 w-3 text-red-400" /></button></div>)}</ScrollArea>
          </CardContent>
        </Card>
      </div>
      <div className="lg:col-span-3"><Card className="overflow-hidden border-blue-200"><CardContent className="p-0 relative"><div className="h-[500px]"><VivoMap repartidores={reps} ubicaciones={ubis} puntosReferencia={puntos} /></div></CardContent></Card></div>
    </div>
  )
}

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
  useEffect(() => { fetch('/api/repartidores').then(r => r.json()).then(d => setReps(Array.isArray(d) ? d : (d.repartidores || []))); fetch('/api/puntos-ruta').then(r => r.json()).then(d => setPuntosReferencia(Array.isArray(d) ? d : (d.puntos || []))) }, [])

  const generarInforme = useCallback(async () => {
    if (!selRep) { toast({ title: 'Seleccioná un repartidor', variant: 'destructive' }); return }
    setLoadingHist(true); setHistGenerated(false); setSelEventIdx(null)
    try { const res = await fetch(`/api/rutas/historial?repartidor_id=${selRep}&fecha=${histFecha}`); const data = await res.json(); setHistData(data); setHistGenerated(true); if (data.fecha && data.fecha !== histFecha) setHistFecha(data.fecha) }
    catch { toast({ title: 'Error', description: 'No se pudo generar el informe', variant: 'destructive' }) }
    finally { setLoadingHist(false) }
  }, [selRep, histFecha, toast])

  const shiftDia = (delta: number) => { const d = new Date(histFecha + 'T00:00:00'); if (isNaN(d.getTime())) return; d.setDate(d.getDate() + delta); const n = d.toISOString().split('T')[0]; if (n === histFecha) return; setHistFecha(n); if (histGenerated && selRep) setTimeout(() => generarInforme(), 50) }
  const ventaKey = (stopId: string) => `${selRep}|${histData?.fecha || histFecha}|${stopId}`
  const confirmarVenta = (stopId: string, valor: 'si' | 'no') => { setVentasConfirmadas(prev => { const key = ventaKey(stopId); const next = { ...prev, [key]: prev[key] === valor ? ('' as any) : valor }; try { localStorage.setItem(VENTAS_LS_KEY, JSON.stringify(next)) } catch {} return next }) }
  const toggleFiltro = (tipo: string) => setEventFilters(prev => ({ ...prev, [tipo]: !prev[tipo] }))
  const restablecerFiltros = () => setEventFilters({ 'Detención': true, 'Detención en Punto': true, 'Pasa por Punto': true, 'Exceso de Velocidad': true, 'Posición': true })

  const timelineFiltrada = useMemo(() => { if (!histData?.timeline) return []; return histData.timeline.map((event: any, origIdx: number) => ({ origIdx, event })).filter(({ event }: any) => { if (eventFilters[event.evento] === false) return false; if (searchTimeline) { const q = searchTimeline.toLowerCase(); return (event.detalle || '').toLowerCase().includes(q) || (event.punto_nombre || '').toLowerCase().includes(q) || (event.evento || '').toLowerCase().includes(q) } return true }) }, [histData, eventFilters, searchTimeline])
  const eventCounts = useMemo(() => { const c: Record<string, number> = {}; if (!histData?.timeline) return c; for (const ev of histData.timeline) c[ev.evento] = (c[ev.evento] || 0) + 1; return c }, [histData])

  const exportarPDF = async () => {
    if (!histData) return; setExportingPdf(true)
    try {
      const { default: jsPDF } = await import('jspdf'); const autoTable = (await import('jspdf-autotable')).default
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }); const rep = histData.repartidor || {}; const stats = histData.stats || {}; const fecha = histData.fecha || histFecha; const pageWidth = doc.internal.pageSize.getWidth()
      doc.setFillColor(15, 64, 129); doc.rect(0, 0, pageWidth, 22, 'F'); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('GasTrack ERP · Informe de Recorrido', 12, 10); doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.text(`Repartidor: ${rep.nombre || '-'}`, 12, 17); doc.text(`Fecha: ${fecha}`, pageWidth - 60, 17)
      const paradasTotal = stats.paradas ?? stats.detenciones ?? 0; const ventasCount = Object.entries(ventasConfirmadas).filter(([k, v]) => v === 'si' && k.startsWith(`${selRep}|${fecha}|`)).length; const tasaConv = paradasTotal > 0 ? Math.round((ventasCount / paradasTotal) * 100) : 0; const fmtMin = (m?: number) => { if (m == null || isNaN(m)) return '--'; const h = Math.floor(m / 60); const mm = m % 60; return h > 0 ? `${h}h ${mm}m` : `${mm}m` }
      autoTable(doc, { startY: 35, theme: 'grid', head: [['Métrica', 'Valor', 'Métrica', 'Valor']], body: [['Distancia', `${stats.distancia_total_km ?? 0} km`, 'Paradas', `${paradasTotal}`], ['Ventas', `${ventasCount} / ${paradasTotal}`, 'Eficiencia', `${stats.eficiencia_pct ?? 0}%`], ['Vel. Máx', `${stats.velocidad_max_kmh ?? 0} km/h`, 'Vel. Prom', `${stats.velocidad_prom_mov_kmh ?? 0} km/h`], ['T. Mov', fmtMin(stats.tiempo_movimiento_min), 'T. Det', fmtMin(stats.tiempo_detenido_min)], ['Conversión', `${tasaConv}%`, 'Puntos visitados', `${stats.puntos_visitados ?? 0}`], ['Hora inicio', stats.hora_inicio || '--', 'Hora fin', stats.hora_fin || '--']], headStyles: { fillColor: [59, 130, 246], fontSize: 9 }, bodyStyles: { fontSize: 9 }, margin: { left: 12, right: 12 } })
      autoTable(doc, { startY: (doc as any).lastAutoTable.finalY + 6, head: [['Hora', 'Evento', 'Detalle', 'Punto', 'Venta']], body: (histData.timeline || []).map((ev: any) => { const isDet = !!ev.es_detencion; const stopId = ev.stop_id; const venta = isDet && stopId ? (ventasConfirmadas[ventaKey(stopId)] === 'si' ? 'Sí' : ventasConfirmadas[ventaKey(stopId)] === 'no' ? 'No' : '—') : '—'; return [ev.hora || '', ev.evento || '', ev.detalle || '', ev.punto_nombre || '—', venta] }), headStyles: { fillColor: [59, 130, 246], fontSize: 9 }, bodyStyles: { fontSize: 8 }, margin: { left: 12, right: 12 } })
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
          {selEventIdx != null && timeline[selEventIdx] && <div className="absolute top-3 left-3 z-[1000]"><div className="flex items-center gap-2 bg-white/95 px-3 py-1.5 rounded-full shadow-md border border-blue-200"><MapPin className="h-3.5 w-3.5 text-blue-600" /><span className="text-xs font-bold">{timeline[selEventIdx].evento}</span><span className="text-[11px] text-gray-500 font-mono">{timeline[selEventIdx].hora}</span><button onClick={() => setSelEventIdx(null)}><X className="h-3.5 w-3.5" /></button></div></div>}
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
          { icon: Maximize2, label: 'Velocidad Máx', value: `${stats.velocidad_max_kmh ?? 0}`, sub: 'km/h', color: 'text-rose-700', bg: 'border-rose-200 bg-rose-50/50' },
          { icon: TrendingUp, label: 'Vel. Prom (en mov)', value: `${stats.velocidad_prom_mov_kmh ?? 0}`, sub: 'km/h', color: 'text-cyan-700', bg: 'border-cyan-200 bg-cyan-50/50' },
          { icon: StopCircle, label: 'Tiempo Detenido', value: fmtMin(stats.tiempo_detenido_min), color: 'text-amber-700', bg: 'border-amber-200 bg-amber-50/50' },
          { icon: PlayCircle, label: 'Tiempo en Mov', value: fmtMin(stats.tiempo_movimiento_min), color: 'text-teal-700', bg: 'border-teal-200 bg-teal-50/50' },
          { icon: Percent, label: '% Eficiencia', value: `${stats.eficiencia_pct ?? 0}%`, sub: 'mov / total', color: 'text-purple-700', bg: 'border-purple-200 bg-purple-50/50' },
          { icon: Timer, label: 'Parada Más Larga', value: fmtMin(stats.parada_mas_larga_min), sub: stats.parada_mas_larga_punto ? `· ${stats.parada_mas_larga_punto}` : 'sin punto', color: 'text-orange-700', bg: 'border-orange-200 bg-orange-50/50' },
          { icon: Flag, label: 'Puntos Visitados', value: String(stats.puntos_visitados ?? 0), color: 'text-emerald-700', bg: 'border-emerald-200 bg-emerald-50/50' },
          { icon: ShoppingBag, label: 'Tasa Conversión', value: `${tasaConv}%`, sub: `${ventasCount}/${paradasTotal}`, color: 'text-green-700', bg: 'border-green-200 bg-green-50/50' },
          { icon: Clock, label: 'Inicio / Fin', value: stats.hora_inicio || '--', sub: `→ ${stats.hora_fin || '--'}`, color: 'text-indigo-700', bg: 'border-indigo-200 bg-indigo-50/50' },
        ]; return <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-3">{cards.map((c, i) => { const Icon = c.icon; return <Card key={i} className={c.bg}><CardContent className="p-3 text-center"><div className="flex items-center justify-center gap-1.5 mb-1"><Icon className={`h-3.5 w-3.5 ${c.color}`} /><p className={`text-[10px] font-bold uppercase ${c.color}`}>{c.label}</p></div><p className={`text-xl font-black ${c.color}`}>{c.value}{c.sub && <span className="text-xs font-bold text-gray-400 ml-1">{c.sub}</span>}</p></CardContent></Card> })}</div> })()}

        {/* Timeline con filtros */}
        <Card className="border-blue-200"><CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="text-lg flex items-center gap-2"><Clock className="h-5 w-5 text-blue-600" /> Línea de Tiempo {histData.repartidor && <span className="text-blue-600">- {histData.repartidor.nombre}</span>}</CardTitle><span className="text-xs text-gray-500">Mostrando <strong>{timelineFiltrada.length}</strong> de <strong>{timeline.length}</strong></span></div>
          <p className="text-xs text-gray-500">Hacé <strong>clic en cualquier evento</strong> para ir al mapa. <strong>Cada vez que se detuvo a 0 km/h</strong> podés registrar si hubo venta (✓ / ✗).</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-blue-100"><span className="text-xs font-bold text-gray-600">Filtrar:</span>
            {[{ tipo: 'Detención', color: 'border-orange-300 text-orange-700 bg-orange-50', dot: 'bg-orange-400' }, { tipo: 'Detención en Punto', color: 'border-amber-400 text-amber-800 bg-amber-100', dot: 'bg-amber-500' }, { tipo: 'Pasa por Punto', color: 'border-emerald-300 text-emerald-700 bg-emerald-50', dot: 'bg-emerald-500' }, { tipo: 'Exceso de Velocidad', color: 'border-red-300 text-red-700 bg-red-50', dot: 'bg-red-500' }, { tipo: 'Posición', color: 'border-gray-300 text-gray-600 bg-white', dot: 'bg-gray-400' }].map(f => { const active = eventFilters[f.tipo] !== false; const count = eventCounts[f.tipo] || 0; return <button key={f.tipo} onClick={() => toggleFiltro(f.tipo)} className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold border transition-all ${active ? f.color : 'border-gray-200 text-gray-400 bg-gray-50 opacity-60 line-through'}`}><span className={`w-1.5 h-1.5 rounded-full ${active ? f.dot : 'bg-gray-300'}`} />{f.tipo}<span className="text-[10px] opacity-70">({count})</span></button> })}
            <button onClick={restablecerFiltros} className="ml-auto text-[11px] text-blue-600 hover:underline">Restablecer</button>
          </div>
          <div className="relative mt-2"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input placeholder="Buscar en la línea de tiempo..." value={searchTimeline} onChange={e => setSearchTimeline(e.target.value)} className="pl-9 h-9" /></div>
        </CardHeader>
        <CardContent className="p-4 pt-0"><div className="border rounded max-h-[450px] overflow-y-auto"><table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-gray-200 z-10"><tr><th className="p-2 border font-extrabold">Hora</th><th className="p-2 border font-extrabold">Evento</th><th className="p-2 border font-extrabold">Detalle</th><th className="p-2 border font-extrabold">Punto</th><th className="p-2 border font-extrabold text-center">Venta</th></tr></thead>
          <tbody>{timeline.length === 0 ? <tr><td colSpan={5} className="p-4 text-center text-gray-500">No hay datos.</td></tr> : timelineFiltrada.map(({ origIdx, event }) => { const i = origIdx; const isDet = !!event.es_detencion; const stopId = event.stop_id; const confirmation = isDet && stopId ? ventasConfirmadas[ventaKey(stopId)] : undefined; const isSelected = selEventIdx === i; const rowBg = isSelected ? 'bg-blue-100 ring-2 ring-inset ring-blue-400' : event.evento === 'Exceso de Velocidad' ? 'bg-red-50' : event.evento === 'Detención' ? 'bg-orange-50' : event.evento === 'Detención en Punto' ? 'bg-amber-50' : event.evento === 'Pasa por Punto' ? 'bg-emerald-50' : 'hover:bg-gray-50'; return (
            <tr key={i} onClick={() => setSelEventIdx(isSelected ? null : i)} className={`cursor-pointer ${rowBg}`}>
              <td className="p-2 border font-mono text-xs"><div className="flex items-center gap-1.5"><MapPin className={`h-3.5 w-3.5 ${isSelected ? 'text-blue-600' : 'text-gray-300'}`} />{event.hora}</div></td>
              <td className="p-2 border"><Badge variant="outline" className="text-xs">{event.evento}</Badge></td>
              <td className="p-2 border">{event.detalle}</td>
              <td className="p-2 border">{event.punto_nombre ? <span className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">{event.punto_nombre}</span> : <span className="text-gray-300">—</span>}</td>
              <td className="p-2 border text-center">{isDet && stopId ? <div className="flex items-center justify-center gap-1"><button onClick={e => { e.stopPropagation(); confirmarVenta(stopId, 'si') }} className={`h-6 w-6 rounded-full ${confirmation === 'si' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700 border border-green-300'}`}><Check className="h-3.5 w-3.5" /></button><button onClick={e => { e.stopPropagation(); confirmarVenta(stopId, 'no') }} className={`h-6 w-6 rounded-full ${confirmation === 'no' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700 border border-red-300'}`}><X className="h-3.5 w-3.5" /></button></div> : <span className="text-gray-300">—</span>}</td>
            </tr>) })}
          </tbody>
        </table></div></CardContent></Card>
      </>)}

      {!histGenerated && <Card className="border-blue-100"><CardContent className="p-12 text-center"><Route className="h-12 w-12 text-blue-200 mx-auto mb-3" /><p className="text-gray-500">Seleccioná un repartidor y generá el informe.</p></CardContent></Card>}
    </div>
  )
}
