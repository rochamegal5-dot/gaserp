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
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  Loader2, MapPin, Route, Navigation, Clock, Plus, Trash2, Pin,
  ChevronLeft, ChevronRight, FileDown, AlertTriangle, Pause, Gauge,
  TrendingUp, Timer, Maximize2, Flag, Percent, PlayCircle, StopCircle,
  Check, X, ShoppingBag, Satellite, Search, Edit3, Save, MapPinned,
  Eye, EyeOff, Locate, Crosshair,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

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

const ROCHA_CENTER: [number, number] = [-34.9011, -56.1645]
const UMBRAL_ONLINE = 120 // 2 minutos

function tiempoAtras(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000)
  if (s < 5) return 'Ahora'
  if (s < 60) return `Hace ${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `Hace ${m}m`
  return `Hace ${Math.floor(m / 60)}h`
}

export function RastreoModule() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Rastreo GPS</h1>
        <p className="text-sm text-gray-500">Seguimiento de rutas y ubicaciones en tiempo real</p>
      </div>
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

/* ════════════════════════════════════════════════════════════
   TAB EN VIVO
   ════════════════════════════════════════════════════════════ */
function VivoTab() {
  const { toast } = useToast()
  const [reps, setReps] = useState<any[]>([])
  const [ubis, setUbis] = useState<any[]>([])
  const [puntos, setPuntos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRepId, setSelectedRepId] = useState<string | null>(null)
  const [siguiendo, setSiguiendo] = useState(false)  // modo seguimiento activo
  const [speedKmh, setSpeedKmh] = useState<number>(0)
  const [liveLog, setLiveLog] = useState<{ hora: string; nombre: string; velocidad: string }[]>([])
  const [simulandoId, setSimulandoId] = useState<string | null>(null)
  const [mostrarPuntos, setMostrarPuntos] = useState(true)

  // Formulario de nuevo punto
  const [newPoint, setNewPoint] = useState({
    nombre: '',
    lat: '',
    lng: '',
    radio: 50,
    descripcion: '',
  })
  // Preview del marker temporal (cuando el usuario hace clic en el mapa)
  const [previewPoint, setPreviewPoint] = useState<{ lat: number; lng: number } | null>(null)

  // Búsqueda por dirección
  const [busquedaDireccion, setBusquedaDireccion] = useState('')
  const [buscandoDireccion, setBuscandoDireccion] = useState(false)

  // Edición de punto existente
  const [editandoPunto, setEditandoPunto] = useState<any | null>(null)

  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const simPosRef = useRef<{ lat: number; lng: number; heading: number } | null>(null)
  const realtimeChannelRef = useRef<any>(null)
  const updateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const puntosChannelRef = useRef<any>(null)

  // Construir repartidores enriquecidos
  const enrichedReps = useMemo(() => {
    return reps.map(r => {
      const ubi = ubis.find((u: any) => u.repartidor_id === r.id)
      return {
        ...r,
        latitud: ubi?.latitud ?? ROCHA_CENTER[0],
        longitud: ubi?.longitud ?? ROCHA_CENTER[1],
        velocidad: ubi?.velocidad ?? 0,
        en_movimiento: ubi?.en_movimiento ?? false,
        lastTimestamp: ubi?.timestamp,
      }
    })
  }, [reps, ubis])

  // Puntos filtrados para mostrar (toggle)
  const puntosParaMapa = useMemo(() => mostrarPuntos ? puntos : [], [puntos, mostrarPuntos])

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
      const repsData = Array.isArray(d1) ? d1 : (d1.data || d1.repartidores || [])
      setReps(repsData)
      const ubiRaw = d2.data || d2.ubicaciones || d2
      if (Array.isArray(ubiRaw) && ubiRaw.length > 0 && ubiRaw[0]?.ubicacion) {
        setUbis(ubiRaw.map((item: any) => ({
          ...(item.ubicacion || {}),
          repartidor_id: item.repartidor?.id || item.ubicacion?.repartidor_id,
        })).filter((u: any) => u.latitud != null))
      } else {
        setUbis(Array.isArray(ubiRaw) ? ubiRaw : [])
      }
      const puntosRaw = d3.data || d3.puntos || d3
      setPuntos(Array.isArray(puntosRaw) ? puntosRaw : [])
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar los datos', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ══ SUPABASE REALTIME para ubicaciones ══
  useEffect(() => {
    if (!supabase) return
    const channel = supabase
      .channel('ubicaciones-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ubicaciones' },
        (payload: any) => {
          const data = payload.new
          if (!data) return
          setUbis(prev => {
            const idx = prev.findIndex((u: any) => u.repartidor_id === data.repartidor_id)
            const newUbi = { ...data }
            if (idx >= 0) {
              const next = [...prev]
              next[idx] = newUbi
              return next
            }
            return [...prev, newUbi]
          })
          const rep = reps.find((r: any) => r.id === data.repartidor_id)
          if (rep) {
            const hora = new Date().toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            const vel = ((data.velocidad || 0) * 3.6).toFixed(0)
            setLiveLog(prev => [{ hora, nombre: rep.nombre, velocidad: vel }, ...prev].slice(0, 20))
          }
          if (data.repartidor_id === selectedRepId) {
            setSpeedKmh((data.velocidad || 0) * 3.6)
          }
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') console.log('[GPS Realtime] Conectado')
        if (status === 'CHANNEL_ERROR') console.warn('[GPS Realtime] Error de conexion')
        if (status === 'TIMED_OUT') console.warn('[GPS Realtime] Timeout')
      })
    realtimeChannelRef.current = channel
    updateTimerRef.current = setInterval(fetchAll, 60_000)
    return () => {
      supabase.removeChannel(channel)
      if (updateTimerRef.current) clearInterval(updateTimerRef.current)
    }
  }, [reps, selectedRepId, fetchAll])

  // ══ SUPABASE REALTIME para puntos_ruta ══
  // Cuando otro usuario agrega/edita/elimina un punto, se actualiza solo
  useEffect(() => {
    if (!supabase) return
    const channel = supabase
      .channel('puntos-ruta-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'puntos_ruta' },
        () => {
          fetch('/api/puntos-ruta')
            .then(r => r.json())
            .then(d => setPuntos(Array.isArray(d) ? d : (d.data || d.puntos || [])))
            .catch(() => {})
        }
      )
      .subscribe()
    puntosChannelRef.current = channel
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Click en mapa → crear preview arrastrable
  const handleMapClick = useCallback((lat: number, lng: number) => {
    setPreviewPoint({ lat, lng })
    setNewPoint(prev => ({ ...prev, lat: lat.toFixed(6), lng: lng.toFixed(6) }))
    // Cerrar edición si estaba abierta
    setEditandoPunto(null)
  }, [])
   // Usuario arrastró el mapa → pausar seguimiento
  const handleUserMapMove = useCallback(() => {
    if (siguiendo) setSiguiendo(false)
  }, [siguiendo])

  // Arrastrar el preview
  const handlePreviewDrag = useCallback((lat: number, lng: number) => {
    setPreviewPoint({ lat, lng })
    setNewPoint(prev => ({ ...prev, lat: lat.toFixed(6), lng: lng.toFixed(6) }))
  }, [])

  const handleSpeedUpdate = useCallback((repId: string, speed: number) => {
    setSpeedKmh(speed)
  }, [])

  // ══ Buscar dirección (Nominatim / OpenStreetMap, gratis) ══
  const buscarDireccion = async () => {
    if (!busquedaDireccion.trim()) return
    setBuscandoDireccion(true)
    try {
      const q = encodeURIComponent(busquedaDireccion + ', Rocha, Uruguay')
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`,
        { headers: { 'Accept-Language': 'es' } }
      )
      const data = await res.json()
      if (data && data.length > 0) {
        const { lat, lon } = data[0]
        const latNum = Number(lat)
        const lngNum = Number(lon)
        setPreviewPoint({ lat: latNum, lng: lngNum })
        setNewPoint(prev => ({ ...prev, lat: latNum.toFixed(6), lng: lngNum.toFixed(6) }))
        toast({ title: 'Ubicación encontrada', description: busquedaDireccion })
      } else {
        toast({ title: 'Sin resultados', description: 'Probá con otra dirección', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error en búsqueda', variant: 'destructive' })
    } finally {
      setBuscandoDireccion(false)
    }
  }

  // ══ Guardar nuevo punto ══
  const handleAddPoint = async () => {
    if (!newPoint.nombre || !newPoint.lat || !newPoint.lng) {
      toast({ title: 'Completá el nombre y ubicá el punto en el mapa', variant: 'destructive' })
      return
    }
    try {
      const res = await fetch('/api/puntos-ruta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: newPoint.nombre,
          latitud: Number(newPoint.lat),
          longitud: Number(newPoint.lng),
          radio_m: Number(newPoint.radio) || 50,
          descripcion: newPoint.descripcion || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Error al guardar')
      }
      toast({ title: 'Punto guardado', description: `"${newPoint.nombre}" agregado correctamente` })
      setNewPoint({ nombre: '', lat: '', lng: '', radio: 50, descripcion: '' })
      setPreviewPoint(null)
      fetchAll()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  // ══ Cancelar nuevo punto ══
  const cancelarNuevo = () => {
    setNewPoint({ nombre: '', lat: '', lng: '', radio: 50, descripcion: '' })
    setPreviewPoint(null)
  }

  // ══ Eliminar punto (con confirmación) ══
  const handleDeletePoint = async (p: any) => {
    if (!window.confirm(`¿Eliminar el punto "${p.nombre}"?\nEsta acción no se puede deshacer.`)) return
    try {
      await fetch(`/api/puntos-ruta?id=${p.id}`, { method: 'DELETE' })
      toast({ title: 'Punto eliminado', description: p.nombre })
      if (editandoPunto?.id === p.id) setEditandoPunto(null)
      fetchAll()
    } catch {
      toast({ title: 'Error al eliminar', variant: 'destructive' })
    }
  }

  // ══ Editar punto existente ══
  const iniciarEdicion = (p: any) => {
    setEditandoPunto({ ...p })
    setPreviewPoint(null)
    setSelectedRepId(null)
  }

  const handleUpdatePoint = async () => {
    if (!editandoPunto) return
    if (!editandoPunto.nombre) {
      toast({ title: 'El nombre es obligatorio', variant: 'destructive' })
      return
    }
    try {
      const res = await fetch('/api/puntos-ruta', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editandoPunto.id,
          nombre: editandoPunto.nombre,
          latitud: Number(editandoPunto.latitud),
          longitud: Number(editandoPunto.longitud),
          radio_m: Number(editandoPunto.radio_m) || 50,
          descripcion: editandoPunto.descripcion || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Error al actualizar')
      }
      toast({ title: 'Punto actualizado', description: editandoPunto.nombre })
      setEditandoPunto(null)
      fetchAll()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  // ══ Centrar mapa en un punto específico de la lista ══
  const [centerOnPunto, setCenterOnPunto] = useState<{ lat: number; lng: number } | null>(null)
  const centrarEnPunto = (p: any) => {
    setCenterOnPunto({ lat: p.latitud, lng: p.longitud })
    // El preview temporal hace que el mapa vuele a esa posición
    setTimeout(() => {
      if (mapPanRef.current) mapPanRef.current(p.latitud, p.longitud)
    }, 50)
  }
  const mapPanRef = useRef<((lat: number, lng: number) => void) | null>(null)

  // ══ Simulación de GPS (mantener del original) ══
  const toggleSimulacion = (repId: string) => {
    if (simulandoId === repId) {
      setSimulandoId(null)
      if (simIntervalRef.current) clearInterval(simIntervalRef.current)
      return
    }
    const ubi = ubis.find((u: any) => u.repartidor_id === repId)
    simPosRef.current = { lat: ubi?.latitud || -34.9011, lng: ubi?.longitud || -56.1645, heading: Math.random() * 360 }
    setSimulandoId(repId)
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

  const centrarEn = (repId: string) => {
    if (repId === selectedRepId) {
      // Ya estaba seleccionado → alternar: si está siguiendo, dejar de seguir
      if (siguiendo) {
        setSiguiendo(false)
        setSelectedRepId(null)
      } else {
        setSiguiendo(true)
      }
    } else {
      // Nuevo repartidor → seleccionar + activar seguimiento
      setSelectedRepId(repId)
      setSiguiendo(true)
    }
  }

  // Activar manualmente el modo seguimiento (botón flotante)
  const activarSeguimiento = () => {
    if (selectedRepId) setSiguiendo(true)
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Mapa */}
      <div className="lg:col-span-3 relative">
        <Card className="overflow-hidden border-blue-200 h-full">
          <CardContent className="p-0 relative">
            <div className="h-[600px]">
              <VivoMap
                repartidores={enrichedReps}
                ubicaciones={ubis}
                puntosReferencia={puntosParaMapa}
                selectedRepId={selectedRepId}
                 siguiendo={siguiendo}            // ← nuevo
                previewPoint={previewPoint}
                onPreviewDrag={handlePreviewDrag}
                onMapClick={handleMapClick}
                onPuntoClick={(p) => iniciarEdicion(p)}
                onUserMapMove={handleUserMapMove}  // ← nuevo
                onSpeedUpdate={handleSpeedUpdate}
              />
            </div>
            {/* Toolbar superior del mapa */}
            <div className="absolute top-3 left-3 z-[1000] flex flex-wrap gap-2">
              <div className="bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-md flex items-center gap-2">
                <Pin className="h-3.5 w-3.5 text-blue-600" />
                <span className="text-xs font-semibold text-gray-700">Puntos: {puntos.length}</span>
                {puntos.length === 0 && !loading && (
                  <span className="text-[10px] text-amber-600 font-medium">(agregá el primero)</span>
                )}
              </div>
              <button
                onClick={() => setMostrarPuntos(v => !v)}
                className="bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-md flex items-center gap-1.5 text-xs font-semibold text-gray-700 hover:bg-white"
                title={mostrarPuntos ? 'Ocultar puntos' : 'Mostrar puntos'}
              >
                {mostrarPuntos ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                {mostrarPuntos ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            {/* Velocidad del repartidor seleccionado */}
            {selectedRepId && (
              <div className="absolute top-3 right-3 z-[1000]">
                <div className="bg-white/95 backdrop-blur-sm px-4 py-2 rounded-lg shadow-md">
                  <div className="text-[10px] text-gray-500 uppercase font-bold">Velocidad</div>
                  <div className="text-2xl font-black text-blue-700">{Math.round(speedKmh)} <span className="text-xs">km/h</span></div>
                </div>
              </div>
            )}
            {/* Botón flotante "Seguir" cuando hay repartidor seleccionado pero el seguimiento está pausado */}
{selectedRepId && !siguiendo && (
  <button
    onClick={activarSeguimiento}
    className="absolute bottom-20 right-4 z-[1000] bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-xs font-bold transition-all hover:scale-105"
    title="Volver a seguir al repartidor"
  >
    <Crosshair className="h-3.5 w-3.5" />
    Seguir repartidor
  </button>
)}
{/* Indicador de seguimiento activo */}
{selectedRepId && siguiendo && (
  <div className="absolute bottom-20 right-4 z-[1000] bg-emerald-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-xs font-bold animate-pulse">
    <Crosshair className="h-3.5 w-3.5" />
    Siguiendo
  </div>
)}
          </CardContent>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-3">
        {/* Vehículos */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Navigation className="h-4 w-4" /> Vehículos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Select value={selectedRepId || '__all__'} onValueChange={v => setSelectedRepId(v === '__all__' ? null : v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="-- Todos --" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">-- Todos --</SelectItem>
                {reps.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ScrollArea className="h-44">
              <div className="space-y-2 pr-1">
                {enrichedReps.map(r => {
                  const isOnline = r.lastTimestamp
                    ? (Date.now() - new Date(r.lastTimestamp).getTime()) / 1000 < UMBRAL_ONLINE
                    : false
                  const isSim = simulandoId === r.id
                  const velKmh = Math.round((r.velocidad || 0) * 3.6)
                  const tiempo = r.lastTimestamp ? tiempoAtras(new Date(r.lastTimestamp)) : 'Sin datos'
                  const isSelected = selectedRepId === r.id
                  return (
                    <div
                      key={r.id}
                      onClick={() => centrarEn(r.id)}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                        isSelected ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-300'
                          : isOnline ? 'border-green-200 bg-green-50/50 hover:bg-green-50'
                          : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{r.nombre}</p>
                        <p className="text-[10px] text-gray-500">{velKmh} km/h &middot; {tiempo}</p>
                      </div>
                      <div className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <button
                        onClick={e => { e.stopPropagation(); toggleSimulacion(r.id) }}
                        title={isSim ? 'Detener simulación' : 'Simular GPS'}
                        className={`flex items-center justify-center h-6 w-6 rounded-full transition-colors shrink-0 ${
                          isSim ? 'bg-red-500 text-white'
                            : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-300'
                        }`}
                      >
                        {isSim ? <span className="text-xs font-black">■</span> : <Satellite className="h-3 w-3" />}
                      </button>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Buscar dirección */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Search className="h-4 w-4 text-purple-600" /> Buscar dirección
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="Ej: 18 de Julio 1234, Rocha"
                value={busquedaDireccion}
                onChange={e => setBusquedaDireccion(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') buscarDireccion() }}
                className="h-8 text-xs"
              />
              <Button size="sm" onClick={buscarDireccion} disabled={buscandoDireccion} className="h-8 px-3">
                {buscandoDireccion ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
              </Button>
            </div>
            <p className="text-[10px] text-gray-400">Usa OpenStreetMap. Marcá el mapa o buscá una dirección.</p>
          </CardContent>
        </Card>

        {/* Agregar Punto (cuando hay preview) */}
        {previewPoint && (
          <Card className="border-blue-300 ring-2 ring-blue-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Plus className="h-4 w-4 text-blue-600" /> Nuevo Punto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Input
                placeholder="Nombre del punto *"
                value={newPoint.nombre}
                onChange={e => setNewPoint({ ...newPoint, nombre: e.target.value })}
                className="h-8 text-xs"
                autoFocus
              />
              <div>
                <Label className="text-[10px] font-bold text-gray-600">Descripción (opcional)</Label>
                <Textarea
                  placeholder="Notas, referencias, horarios..."
                  value={newPoint.descripcion}
                  onChange={e => setNewPoint({ ...newPoint, descripcion: e.target.value })}
                  className="text-xs mt-0.5 min-h-[50px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] font-bold text-gray-600">Latitud</Label>
                  <Input value={newPoint.lat} readOnly className="h-8 text-xs bg-gray-50 mt-0.5 font-mono" />
                </div>
                <div>
                  <Label className="text-[10px] font-bold text-gray-600">Longitud</Label>
                  <Input value={newPoint.lng} readOnly className="h-8 text-xs bg-gray-50 mt-0.5 font-mono" />
                </div>
              </div>
              <div>
                <Label className="text-[10px] font-bold text-gray-600">Radio de detección: {newPoint.radio} m</Label>
                <input
                  type="range"
                  min={10}
                  max={500}
                  step={10}
                  value={newPoint.radio}
                  onChange={e => setNewPoint({ ...newPoint, radio: Number(e.target.value) })}
                  className="w-full mt-1"
                />
                <div className="flex justify-between text-[9px] text-gray-400">
                  <span>10m</span><span>50m</span><span>250m</span><span>500m</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddPoint} className="flex-1 h-8 text-xs">
                  <Save className="h-3 w-3 mr-1" /> Guardar
                </Button>
                <Button size="sm" variant="outline" onClick={cancelarNuevo} className="h-8 text-xs">
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-[10px] text-blue-600 flex items-center gap-1">
                <MapPinned className="h-3 w-3" /> Arrastrá el pin azul para ajustar la posición
              </p>
            </CardContent>
          </Card>
        )}

        {/* Editar Punto Existente */}
        {editandoPunto && (
          <Card className="border-amber-300 ring-2 ring-amber-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-amber-600" /> Editar Punto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Input
                placeholder="Nombre"
                value={editandoPunto.nombre || ''}
                onChange={e => setEditandoPunto({ ...editandoPunto, nombre: e.target.value })}
                className="h-8 text-xs"
              />
              <Textarea
                placeholder="Descripción"
                value={editandoPunto.descripcion || ''}
                onChange={e => setEditandoPunto({ ...editandoPunto, descripcion: e.target.value })}
                className="text-xs min-h-[50px]"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] font-bold text-gray-600">Latitud</Label>
                  <Input
                    type="number"
                    step="0.000001"
                    value={editandoPunto.latitud}
                    onChange={e => setEditandoPunto({ ...editandoPunto, latitud: Number(e.target.value) })}
                    className="h-8 text-xs mt-0.5 font-mono"
                  />
                </div>
                <div>
                  <Label className="text-[10px] font-bold text-gray-600">Longitud</Label>
                  <Input
                    type="number"
                    step="0.000001"
                    value={editandoPunto.longitud}
                    onChange={e => setEditandoPunto({ ...editandoPunto, longitud: Number(e.target.value) })}
                    className="h-8 text-xs mt-0.5 font-mono"
                  />
                </div>
              </div>
              <div>
                <Label className="text-[10px] font-bold text-gray-600">Radio: {editandoPunto.radio_m || 50} m</Label>
                <input
                  type="range"
                  min={10}
                  max={500}
                  step={10}
                  value={editandoPunto.radio_m || 50}
                  onChange={e => setEditandoPunto({ ...editandoPunto, radio_m: Number(e.target.value) })}
                  className="w-full mt-1"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleUpdatePoint} className="flex-1 h-8 text-xs bg-amber-600 hover:bg-amber-700">
                  <Save className="h-3 w-3 mr-1" /> Actualizar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditandoPunto(null)} className="h-8 text-xs">
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lista de Puntos de Referencia */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 justify-between">
              <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-red-500" /> Puntos Guardados</span>
              <Badge variant="secondary" className="text-[10px]">{puntos.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-56">
              {puntos.length === 0 ? (
                <div className="text-center py-6">
                  <MapPin className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">Sin puntos registrados</p>
                  <p className="text-[10px] text-gray-400 mt-1">Hacé clic en el mapa para agregar el primero</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {puntos.map((p: any) => (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer hover:bg-gray-50 ${
                        editandoPunto?.id === p.id ? 'border-amber-300 bg-amber-50' : 'border-gray-200'
                      }`}
                      onClick={() => centrarEnPunto(p)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold truncate">{p.nombre}</span>
                        </div>
                        <p className="text-[10px] text-gray-400 font-mono">
                          {Number(p.latitud).toFixed(4)}, {Number(p.longitud).toFixed(4)} · {p.radio_m || 50}m
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={e => { e.stopPropagation(); iniciarEdicion(p) }}
                          title="Editar"
                          className="p-1 rounded hover:bg-amber-100 text-amber-600"
                        >
                          <Edit3 className="h-3 w-3" />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); handleDeletePoint(p) }}
                          title="Eliminar"
                          className="p-1 rounded hover:bg-red-100 text-red-500"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Registro en Vivo */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Gauge className="h-4 w-4 text-blue-600" /> Registro en Vivo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-32">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-1 border text-[10px] font-bold">Hora</th>
                    <th className="p-1 border text-[10px] font-bold">Repartidor</th>
                    <th className="p-1 border text-[10px] font-bold text-center">Vel</th>
                  </tr>
                </thead>
                <tbody>
                  {liveLog.length === 0 ? (
                    <tr><td colSpan={3} className="p-2 text-center text-gray-400">Esperando datos...</td></tr>
                  ) : (
                    liveLog.map((log, i) => (
                      <tr key={i}>
                        <td className="p-1 border font-mono text-[10px]">{log.hora}</td>
                        <td className="p-1 border text-[10px]">{log.nombre}</td>
                        <td className="p-1 border text-[10px] text-center font-bold">{log.velocidad}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   TAB HISTORIAL
   ════════════════════════════════════════════════════════════ */
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
  const [eventFilters, setEventFilters] = useState<Record<string, boolean>>({
    'Detención': true, 'Detención en Punto': true, 'Pasa por Punto': true, 'Exceso de Velocidad': true, 'Posición': true,
  })
  const [searchTimeline, setSearchTimeline] = useState('')
  const [exportingPdf, setExportingPdf] = useState(false)
  const [ventasConfirmadas, setVentasConfirmadas] = useState<VentasMap>({})

  // Cargar repartidores Y puntos SIEMPRE (no solo una vez, ahora se refresca)
  const cargarDatosBase = useCallback(() => {
    fetch('/api/repartidores').then(r => r.json()).then(d => setReps(Array.isArray(d) ? d : (d.data || d.repartidores || [])))
    fetch('/api/puntos-ruta').then(r => r.json()).then(d => setPuntosReferencia(Array.isArray(d) ? d : (d.data || d.puntos || [])))
  }, [])

  useEffect(() => { cargarDatosBase() }, [cargarDatosBase])

  // Refrescar puntos cada 30s mientras se está en Historial
  useEffect(() => {
    const t = setInterval(cargarDatosBase, 30_000)
    return () => clearInterval(t)
  }, [cargarDatosBase])

  useEffect(() => {
    try { const s = localStorage.getItem(VENTAS_LS_KEY); if (s) setVentasConfirmadas(JSON.parse(s)) } catch {}
  }, [])

  const generarInforme = useCallback(async () => {
    if (!selRep) { toast({ title: 'Seleccioná un repartidor', variant: 'destructive' }); return }
    setLoadingHist(true); setHistGenerated(false); setSelEventIdx(null)
    try {
      const res = await fetch(`/api/rutas/historial?repartidor_id=${selRep}&fecha=${histFecha}`)
      const json = await res.json()
      const data = json.data || json
      setHistData(data)
      setHistGenerated(true)
      if (data.fecha && data.fecha !== histFecha) setHistFecha(data.fecha)
    } catch { toast({ title: 'Error', description: 'No se pudo generar el informe', variant: 'destructive' }) }
    finally { setLoadingHist(false) }
  }, [selRep, histFecha, toast])

  const shiftDia = (delta: number) => {
    const d = new Date(histFecha + 'T00:00:00')
    if (isNaN(d.getTime())) return
    d.setDate(d.getDate() + delta)
    const n = d.toISOString().split('T')[0]
    if (n === histFecha) return
    setHistFecha(n)
    if (histGenerated && selRep) setTimeout(() => generarInforme(), 50)
  }

  const ventaKey = (stopId: string) => `${selRep}|${histData?.fecha || histFecha}|${stopId}`
  const confirmarVenta = (stopId: string, valor: 'si' | 'no') => {
    setVentasConfirmadas(prev => {
      const key = ventaKey(stopId)
      const next = { ...prev, [key]: prev[key] === valor ? ('' as any) : valor }
      try { localStorage.setItem(VENTAS_LS_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  const toggleFiltro = (tipo: string) => setEventFilters(prev => ({ ...prev, [tipo]: !prev[tipo] }))
  const restablecerFiltros = () => setEventFilters({ 'Detención': true, 'Detención en Punto': true, 'Pasa por Punto': true, 'Exceso de Velocidad': true, 'Posición': true })

  const timelineFiltrada = useMemo(() => {
    if (!histData?.timeline) return []
    const flatTimeline = histData.timeline.map((entry: any, idx: number) => {
      if (entry.items && entry.items.length > 0) {
        return entry.items.map((item: any) => ({ ...item, origIdx: idx }))
      }
      return { ...entry, origIdx: idx }
    }).flat()
    return flatTimeline.filter((event: any) => {
      if (eventFilters[event.tipo || event.evento] === false) return false
      if (searchTimeline) {
        const q = searchTimeline.toLowerCase()
        return (event.detalle || '').toLowerCase().includes(q) ||
               (event.punto || event.punto_nombre || '').toLowerCase().includes(q) ||
               (event.tipo || event.evento || '').toLowerCase().includes(q)
      }
      return true
    })
  }, [histData, eventFilters, searchTimeline])

  const eventCounts = useMemo(() => {
    const c: Record<string, number> = {}
    if (!histData?.timeline) return c
    for (const ev of histData.timeline) {
      if (ev.items) {
        for (const item of ev.items) c[item.tipo || item.evento] = (c[item.tipo || item.evento] || 0) + 1
      } else {
        c[ev.tipo || ev.evento] = (c[ev.tipo || ev.evento] || 0) + 1
      }
    }
    return c
  }, [histData])

  const exportarPDF = async () => {
    if (!histData) return
    setExportingPdf(true)
    try {
      const { default: jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const rep = histData.repartidor || {}
      const stats = histData.stats || {}
      const fecha = histData.fecha || histFecha
      const pageWidth = doc.internal.pageSize.getWidth()

      doc.setFillColor(15, 64, 129)
      doc.rect(0, 0, pageWidth, 22, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.text('GasTrack ERP · Informe de Recorrido', 12, 10)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Repartidor: ${rep.nombre || '-'}`, 12, 17)
      doc.text(`Fecha: ${fecha}`, pageWidth - 60, 17)

      const paradasTotal = stats.paradas ?? stats.detenciones ?? 0
      const ventasCount = Object.entries(ventasConfirmadas).filter(([k, v]) => v === 'si' && k.startsWith(`${selRep}|${fecha}|`)).length
      const tasaConv = paradasTotal > 0 ? Math.round((ventasCount / paradasTotal) * 100) : 0
      const fmtMin = (m?: number) => {
        if (m == null || isNaN(m)) return '--'
        const h = Math.floor(m / 60)
        const mm = m % 60
        return h > 0 ? `${h}h ${mm}m` : `${mm}m`
      }

      autoTable(doc, {
        startY: 35, theme: 'grid',
        head: [['Métrica', 'Valor', 'Métrica', 'Valor']],
        body: [
          ['Distancia', `${stats.distancia_total_km ?? 0} km`, 'Paradas', `${paradasTotal}`],
          ['Ventas', `${ventasCount} / ${paradasTotal}`, 'Eficiencia', `${stats.eficiencia_pct ?? 0}%`],
          ['Vel. Max', `${stats.velocidad_max_kmh ?? 0} km/h`, 'Vel. Prom', `${stats.velocidad_prom_mov_kmh ?? 0} km/h`],
          ['T. Mov', fmtMin(stats.tiempo_movimiento_min), 'T. Det', fmtMin(stats.tiempo_detenido_min)],
          ['Conversión', `${tasaConv}%`, 'Puntos visitados', `${stats.puntos_visitados ?? 0}`],
          ['Hora inicio', stats.hora_inicio || '--', 'Hora fin', stats.hora_fin || '--'],
        ],
        headStyles: { fillColor: [59, 130, 246], fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        margin: { left: 12, right: 12 },
      })

      const flatForPdf = (histData.timeline || []).flatMap((ev: any) => ev.items || [ev])
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 6,
        head: [['Hora', 'Evento', 'Detalle', 'Punto', 'Venta']],
        body: flatForPdf.map((ev: any) => {
          const isDet = !!ev.es_detencion
          const stopId = ev.stop_id
          const venta = isDet && stopId
            ? (ventasConfirmadas[ventaKey(stopId)] === 'si' ? 'Sí' : ventasConfirmadas[ventaKey(stopId)] === 'no' ? 'No' : '--')
            : '--'
          return [
            ev.hora || '',
            ev.tipo || ev.evento || '',
            ev.detalle || '',
            ev.punto || ev.punto_nombre || '--',
            venta,
          ]
        }),
        headStyles: { fillColor: [59, 130, 246], fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 12, right: 12 },
      })

      doc.save(`informe-${(rep.nombre || 'repartidor').replace(/\s+/g, '_')}-${fecha}.pdf`)
      toast({ title: 'PDF generado' })
    } catch (e: any) {
      toast({ title: 'Error al exportar PDF', variant: 'destructive' })
    } finally {
      setExportingPdf(false)
    }
  }

  const trailPoints = useMemo(() => histData?.trail || [], [histData])

  const flatTimeline = useMemo(() => {
    if (!histData?.timeline) return []
    return histData.timeline.flatMap((ev: any, idx: number) => {
      if (ev.items) return ev.items.map((item: any) => ({ ...item, _groupIdx: idx }))
      return [{ ...ev, _groupIdx: idx }]
    })
  }, [histData])

  const stats = histData?.stats || {}
  const timeline = flatTimeline
  const fmtMin = (m?: number) => {
    if (m == null || isNaN(m)) return '--'
    const h = Math.floor(m / 60)
    const mm = m % 60
    return h > 0 ? `${h}h ${mm}m` : `${mm}m`
  }
  const paradasTotal = stats.paradas ?? stats.detenciones ?? 0
  const ventasCount = Object.entries(ventasConfirmadas).filter(([k, v]) => v === 'si' && k.startsWith(`${selRep}|${histData?.fecha || histFecha}|`)).length
  const tasaConv = paradasTotal > 0 ? Math.round((ventasCount / paradasTotal) * 100) : 0
  const selectedEvent = selEventIdx != null && timeline[selEventIdx] ? timeline[selEventIdx] : null

  return (
    <div className="space-y-4">
      {/* Controles */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[200px]">
            <Label>Repartidor</Label>
            <Select value={selRep} onValueChange={setSelRep}>
              <SelectTrigger><SelectValue placeholder="-- Seleccione --" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">-- Seleccione --</SelectItem>
                {reps.map(r => <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => shiftDia(-1)} className="h-9 w-9 border-blue-200"><ChevronLeft className="h-4 w-4" /></Button>
            <Input type="date" value={histFecha} onChange={e => setHistFecha(e.target.value)} className="text-center font-medium" />
            <Button variant="outline" size="icon" onClick={() => shiftDia(1)} className="h-9 w-9 border-blue-200"><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <Button onClick={generarInforme} disabled={loadingHist} className="bg-blue-600 hover:bg-blue-700">
            {loadingHist ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Route className="h-4 w-4 mr-1" /> Generar</>}
          </Button>
          <Button onClick={exportarPDF} disabled={!histData || exportingPdf} variant="outline" className="border-red-300 text-red-700">
            {exportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <><FileDown className="h-4 w-4 mr-1" /> PDF</>}
          </Button>
        </CardContent>
      </Card>

      {/* Indicador de puntos cargados */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <MapPin className="h-3.5 w-3.5 text-red-500" />
        <span>{puntosReferencia.length} punto(s) de referencia cargados</span>
        <Button variant="ghost" size="sm" onClick={cargarDatosBase} className="h-6 text-[10px]">
          <Locate className="h-3 w-3 mr-1" /> Refrescar
        </Button>
      </div>

      {histGenerated && histData && (<>
        {/* Mapa Historial */}
        <Card className="overflow-hidden border-blue-200">
          <CardContent className="p-0 relative">
            <div className="h-[400px]">
              <HistorialMap
                trail={trailPoints}
                repartidor={histData.repartidor}
                puntosReferencia={puntosReferencia}
                selectedEvent={selectedEvent}
              />
            </div>
            {selEventIdx != null && timeline[selEventIdx] && (
              <div className="absolute top-3 left-3 z-[1000]">
                <div className="flex items-center gap-2 bg-white/95 px-3 py-1.5 rounded-full shadow-md border border-blue-200">
                  <MapPin className="h-3.5 w-3.5 text-blue-600" />
                  <span className="text-xs font-bold">{timeline[selEventIdx].tipo || timeline[selEventIdx].evento}</span>
                  <span className="text-[11px] text-gray-500 font-mono">{timeline[selEventIdx].hora}</span>
                  <button onClick={() => setSelEventIdx(null)}><X className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resumen ejecutivo */}
        <Card className="border-blue-300 bg-gradient-to-r from-blue-50 to-emerald-50">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: histData.repartidor?.color || '#3b82f6' }} />
                <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">Repartidor</p>
                  <p className="text-base font-black">{histData.repartidor?.nombre || '-'}{histData.repartidor?.vehiculo && <span className="text-xs font-normal text-gray-500 ml-2">&middot; {histData.repartidor.vehiculo}</span>}</p>
                </div>
              </div>
              <div><p className="text-xs text-gray-500 uppercase font-bold">Fecha</p><p className="text-sm font-bold">{histData.fecha}</p></div>
              <div><p className="text-xs text-gray-500 uppercase font-bold">Horario</p><p className="text-sm font-bold font-mono">{stats.hora_inicio || '--'} &rarr; {stats.hora_fin || '--'}</p></div>
              <div><p className="text-xs text-gray-500 uppercase font-bold">Distancia</p><p className="text-sm font-bold text-blue-700">{stats.distancia_total_km} km</p></div>
              <div><p className="text-xs text-gray-500 uppercase font-bold">Paradas</p><p className="text-sm font-bold text-orange-700">{paradasTotal}</p></div>
              <div><p className="text-xs text-gray-500 uppercase font-bold">Ventas</p><p className="text-sm font-bold text-emerald-700">{ventasCount}/{paradasTotal} ({tasaConv}%)</p></div>
              <div><p className="text-xs text-gray-500 uppercase font-bold">Eficiencia</p><p className="text-sm font-bold text-purple-700">{stats.eficiencia_pct}%</p></div>
            </div>
          </CardContent>
        </Card>

        {/* Stat cards */}
        {(() => {
          const cards = [
            { icon: AlertTriangle, label: 'Exceso (>45 km/h)', value: String(stats.exceso_velocidad ?? 0), color: 'text-red-700', bg: 'border-red-200 bg-red-50/50' },
            { icon: Pause, label: 'Paradas (a 0 km/h)', value: String(paradasTotal), color: 'text-orange-700', bg: 'border-orange-200 bg-orange-50/50' },
            { icon: Gauge, label: 'Distancia Total', value: `${stats.distancia_total_km ?? 0} km`, color: 'text-blue-700', bg: 'border-blue-200 bg-blue-50/50' },
            { icon: ShoppingBag, label: 'Ventas Confirmadas', value: `${ventasCount}`, sub: `/ ${paradasTotal}`, color: 'text-emerald-700', bg: 'border-emerald-200 bg-emerald-50/50' },
            { icon: Maximize2, label: 'Velocidad Max', value: `${stats.velocidad_max_kmh ?? 0}`, sub: 'km/h', color: 'text-rose-700', bg: 'border-rose-200 bg-rose-50/50' },
            { icon: TrendingUp, label: 'Vel. Prom (en mov)', value: `${stats.velocidad_prom_mov_kmh ?? 0}`, sub: 'km/h', color: 'text-cyan-700', bg: 'border-cyan-200 bg-cyan-50/50' },
            { icon: StopCircle, label: 'Tiempo Detenido', value: fmtMin(stats.tiempo_detenido_min), color: 'text-amber-700', bg: 'border-amber-200 bg-amber-50/50' },
            { icon: PlayCircle, label: 'Tiempo en Mov', value: fmtMin(stats.tiempo_movimiento_min), color: 'text-teal-700', bg: 'border-teal-200 bg-teal-50/50' },
            { icon: Percent, label: '% Eficiencia', value: `${stats.eficiencia_pct ?? 0}%`, sub: 'mov / total', color: 'text-purple-700', bg: 'border-purple-200 bg-purple-50/50' },
            { icon: Timer, label: 'Parada Más Larga', value: fmtMin(stats.parada_mas_larga_min), sub: stats.parada_mas_larga_punto ? `· ${stats.parada_mas_larga_punto}` : 'sin punto', color: 'text-orange-700', bg: 'border-orange-200 bg-orange-50/50' },
            { icon: Flag, label: 'Puntos Visitados', value: String(stats.puntos_visitados ?? 0), color: 'text-emerald-700', bg: 'border-emerald-200 bg-emerald-50/50' },
            { icon: ShoppingBag, label: 'Tasa Conversión', value: `${tasaConv}%`, sub: `${ventasCount}/${paradasTotal}`, color: 'text-green-700', bg: 'border-green-200 bg-green-50/50' },
            { icon: Clock, label: 'Inicio / Fin', value: stats.hora_inicio || '--', sub: `→ ${stats.hora_fin || '--'}`, color: 'text-indigo-700', bg: 'border-indigo-200 bg-indigo-50/50' },
          ]
          return (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-3">
              {cards.map((c, i) => {
                const Icon = c.icon
                return (
                  <Card key={i} className={c.bg}>
                    <CardContent className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <Icon className={`h-3.5 w-3.5 ${c.color}`} />
                        <p className={`text-[10px] font-bold uppercase ${c.color}`}>{c.label}</p>
                      </div>
                      <p className={`text-xl font-black ${c.color}`}>
                        {c.value}{c.sub && <span className="text-xs font-bold text-gray-400 ml-1">{c.sub}</span>}
                      </p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )
        })()}

        {/* Timeline */}
        <Card className="border-blue-200">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" /> Línea de Tiempo {histData.repartidor && <span className="text-blue-600">- {histData.repartidor.nombre}</span>}
              </CardTitle>
              <span className="text-xs text-gray-500">Mostrando <strong>{timelineFiltrada.length}</strong> de <strong>{timeline.length}</strong></span>
            </div>
            <p className="text-xs text-gray-500">
              Hacé <strong>clic en cualquier evento</strong> para ir al mapa. <strong>Cada vez que se detuvo a 0 km/h</strong> podés registrar si hubo venta.
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-blue-100">
              <span className="text-xs font-bold text-gray-600">Filtrar:</span>
              {[
                { tipo: 'Detención', color: 'border-orange-300 text-orange-700 bg-orange-50', dot: 'bg-orange-400' },
                { tipo: 'Detención en Punto', color: 'border-amber-400 text-amber-800 bg-amber-100', dot: 'bg-amber-500' },
                { tipo: 'Pasa por Punto', color: 'border-emerald-300 text-emerald-700 bg-emerald-50', dot: 'bg-emerald-500' },
                { tipo: 'Exceso de Velocidad', color: 'border-red-300 text-red-700 bg-red-50', dot: 'bg-red-500' },
                { tipo: 'Posición', color: 'border-gray-300 text-gray-600 bg-white', dot: 'bg-gray-400' },
              ].map(f => {
                const active = eventFilters[f.tipo] !== false
                const count = eventCounts[f.tipo] || 0
                return (
                  <button
                    key={f.tipo}
                    onClick={() => toggleFiltro(f.tipo)}
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold border transition-all ${active ? f.color : 'border-gray-200 text-gray-400 bg-gray-50 opacity-60 line-through'}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${active ? f.dot : 'bg-gray-300'}`} />
                    {f.tipo}<span className="text-[10px] opacity-70">({count})</span>
                  </button>
                )
              })}
              <button onClick={restablecerFiltros} className="ml-auto text-[11px] text-blue-600 hover:underline">Restablecer</button>
            </div>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Buscar en la línea de tiempo..." value={searchTimeline} onChange={e => setSearchTimeline(e.target.value)} className="pl-9 h-9" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="border rounded max-h-[450px] overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-gray-200 z-10">
                  <tr>
                    <th className="p-2 border font-extrabold">Hora</th>
                    <th className="p-2 border font-extrabold">Evento</th>
                    <th className="p-2 border font-extrabold">Detalle</th>
                    <th className="p-2 border font-extrabold">Punto</th>
                    <th className="p-2 border font-extrabold text-center">Venta</th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.length === 0 ? (
                    <tr><td colSpan={5} className="p-4 text-center text-gray-500">No hay datos.</td></tr>
                  ) : (
                    timelineFiltrada.map((event: any) => {
                      const i = event.origIdx ?? event._groupIdx
                      const isDet = !!event.es_detencion
                      const stopId = event.stop_id
                      const confirmation = isDet && stopId ? ventasConfirmadas[ventaKey(stopId)] : undefined
                      const isSelected = selEventIdx === i
                      const eventType = event.tipo || event.evento || ''
                      const rowBg = isSelected
                        ? 'bg-blue-100 ring-2 ring-inset ring-blue-400'
                        : eventType.includes('Exceso') ? 'bg-red-50'
                          : eventType.includes('Detención en Punto') ? 'bg-amber-50'
                            : eventType.includes('Pasa por Punto') ? 'bg-emerald-50'
                              : eventType.includes('Detención') ? 'bg-orange-50'
                                : 'hover:bg-gray-50'
                      const puntoNombre = event.punto || event.punto_nombre
                      return (
                        <tr key={i} onClick={() => setSelEventIdx(isSelected ? null : i)} className={`cursor-pointer ${rowBg}`}>
                          <td className="p-2 border font-mono text-xs">
                            <div className="flex items-center gap-1.5">
                              <MapPin className={`h-3.5 w-3.5 ${isSelected ? 'text-blue-600' : 'text-gray-300'}`} />
                              {event.hora}
                            </div>
                          </td>
                          <td className="p-2 border"><Badge variant="outline" className="text-xs">{eventType}</Badge></td>
                          <td className="p-2 border">{event.detalle}</td>
                          <td className="p-2 border">
                            {puntoNombre
                              ? <span className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">{puntoNombre}</span>
                              : <span className="text-gray-300">&mdash;</span>}
                          </td>
                          <td className="p-2 border text-center">
                            {isDet && stopId ? (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={e => { e.stopPropagation(); confirmarVenta(stopId, 'si') }}
                                  className={`h-6 w-6 rounded-full ${confirmation === 'si' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700 border border-green-300'}`}
                                ><Check className="h-3.5 w-3.5" /></button>
                                <button
                                  onClick={e => { e.stopPropagation(); confirmarVenta(stopId, 'no') }}
                                  className={`h-6 w-6 rounded-full ${confirmation === 'no' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700 border border-red-300'}`}
                                ><X className="h-3.5 w-3.5" /></button>
                              </div>
                            ) : <span className="text-gray-300">&mdash;</span>}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </>)}

      {!histGenerated && (
        <Card className="border-blue-100">
          <CardContent className="p-12 text-center">
            <Route className="h-12 w-12 text-blue-200 mx-auto mb-3" />
            <p className="text-gray-500">Selecciona un repartidor y genera el informe.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
