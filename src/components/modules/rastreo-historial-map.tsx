'use client'
import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

/* ── Pulse for selected event ── */
const HIST_CSS = `
.hist-pulse { animation: histPulse 1.5s ease-out infinite; }
@keyframes histPulse { 0% { opacity: 0.8; } 50% { opacity: 0.3; } 100% { opacity: 0.8; } }
`

interface TrailPoint { lat: number; lng: number; timestamp: string; velocidad?: number; en_movimiento?: boolean; precision_gps?: number }
interface PuntoData { id: string; nombre: string; latitud: number; longitud: number; radio_m?: number }
interface TimelineEvent { lat?: number; lng?: number; hora: string; evento: string; detalle: string; punto_nombre?: string; es_detencion?: boolean; stop_id?: string }

interface Props {
  trail: TrailPoint[]
  repartidor: any
  puntosReferencia: PuntoData[]
  selectedEvent: TimelineEvent | null
}

export default function HistorialMap({ trail, repartidor, puntosReferencia, selectedEvent }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const selectedMarkerRef = useRef<any>(null)
  const histMarkersRef = useRef<any>(null)

  // Inject CSS
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const id = 'hist-pulse-css'
      if (!document.getElementById(id)) {
        const s = document.createElement('style')
        s.id = id
        s.textContent = HIST_CSS
        document.head.appendChild(s)
      }
    }
  }, [])

  // Main map render with incidents (same logic as reference's generarInforme)
  useEffect(() => {
    if (!containerRef.current) return

    import('leaflet').then((LModule) => {
      const L = LModule.default
      ;(window as any).L = L

      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      // Remove old map
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }

      const ROCHA_CENTER: [number, number] = [-34.9011, -56.1645]
      const center: [number, number] = trail[0] ? [trail[0].lat, trail[0].lng] : ROCHA_CENTER
      const map = L.map(containerRef.current!).setView(center, 13)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map)
      mapRef.current = map

      if (trail.length === 0) {
        setTimeout(() => map.invalidateSize(), 200)
        return
      }

      // 1. Draw trail polyline
      const trailCoords: [number, number][] = trail.map(p => [p.lat, p.lng])
      L.polyline(trailCoords, {
        color: repartidor?.color || '#3b82f6',
        weight: 4,
        opacity: 0.7,
      }).addTo(map)

      // 2. Start / End markers
      L.marker(trailCoords[0]).addTo(map).bindPopup('<strong>\u25B6 Inicio</strong>')
      L.marker(trailCoords[trailCoords.length - 1]).addTo(map).bindPopup('<strong>\u25A0 Fin</strong>')

      // 3. Incident layer (same as reference)
      const histMarkers = L.layerGroup().addTo(map)
      histMarkersRef.current = histMarkers
      const boundsCoords: [number, number][] = [...trailCoords]

      // Time markers every 15 minutes (same as reference)
      let lastTimeMarker: Date | null = null
      for (const p of trail) {
        const pTime = new Date(p.timestamp)
        if (!lastTimeMarker || (pTime.getTime() - lastTimeMarker.getTime()) >= 15 * 60 * 1000) {
          const timeStr = pTime.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })
          const iconHtml = `<div style="background:white; padding:2px 5px; border-radius:4px; font-size:10px; font-weight:bold; border:1px solid #ccc;">\uD83D\uDD50 ${timeStr}</div>`
          L.marker([p.lat, p.lng], {
            icon: L.divIcon({ className: '', html: iconHtml, iconAnchor: [0, 20] }),
          }).addTo(histMarkers)
          lastTimeMarker = pTime
        }
      }

      // Speed excess markers (red circles, >45 km/h) (same as reference)
      for (const p of trail) {
        const speedKmh = (p.velocidad || 0) * 3.6
        if (speedKmh > 45) {
          L.circleMarker([p.lat, p.lng], {
            radius: 6, color: '#dc2626', fillColor: '#fca5a5', fillOpacity: 1,
          }).addTo(histMarkers).bindPopup(`<b>Exceso Velocidad</b><br>${speedKmh.toFixed(1)} km/h`)
          boundsCoords.push([p.lat, p.lng])
        }
      }

      // Waypoint visit markers (blue, same as reference)
      const visitedWaypoints = new Set<string>()
      for (const p of trail) {
        if (puntosReferencia.length > 0) {
          for (const wp of puntosReferencia) {
            const dist = map.distance(L.latLng(p.lat, p.lng), L.latLng(wp.latitud, wp.longitud))
            if (dist <= (wp.radio_m || 50)) {
              if (!visitedWaypoints.has(wp.id)) {
                visitedWaypoints.add(wp.id)
                L.marker([wp.latitud, wp.longitud], {
                  icon: L.divIcon({
                    className: '',
                    html: `<div style="background:#1e40af; color:white; padding:3px 7px; border-radius:6px; font-size:10px; font-weight:bold; white-space:nowrap; border:2px solid white; box-shadow:0 2px 5px rgba(0,0,0,0.3);">\uD83D\uDCCD ${wp.nombre}</div>`,
                    iconSize: [120, 28],
                    iconAnchor: [15, 28],
                  }),
                }).addTo(histMarkers).bindPopup(`<b>Punto Ruta</b><br>${wp.nombre}`)
                boundsCoords.push([wp.latitud, wp.longitud])
              }
            } else {
              visitedWaypoints.delete(wp.id)
            }
          }
        }
      }

      // Prolonged stop markers (orange circles, >=3 min, same as reference)
      let stopStartTime: Date | null = null
      let stopStartIndex = -1
      for (let i = 0; i < trail.length; i++) {
        const p = trail[i]
        const pTime = new Date(p.timestamp)
        const isStopped = !p.en_movimiento || (p.velocidad || 0) < 0.5

        if (isStopped) {
          if (!stopStartTime) { stopStartTime = pTime; stopStartIndex = i }
        } else {
          if (stopStartTime) {
            const durationMins = (pTime.getTime() - stopStartTime.getTime()) / (1000 * 60)
            if (durationMins >= 3) {
              const stopLat = trail[stopStartIndex].lat
              const stopLng = trail[stopStartIndex].lng
              let stopPlaceName: string | null = null
              for (const wp of puntosReferencia) {
                if (map.distance(L.latLng(stopLat, stopLng), L.latLng(wp.latitud, wp.longitud)) <= 50) {
                  stopPlaceName = wp.nombre
                }
              }
              const detDetail = stopPlaceName
                ? `Detenido ${durationMins.toFixed(1)} min en: ${stopPlaceName}`
                : `Detenido ${durationMins.toFixed(1)} min`
              L.circleMarker([stopLat, stopLng], {
                radius: 8, color: '#ea580c', fillColor: '#fed7aa', fillOpacity: 1,
              }).addTo(histMarkers).bindPopup(`<b>Detenci\u00f3n Prolongada</b><br>${detDetail}`)
              boundsCoords.push([stopLat, stopLng])
            }
            stopStartTime = null
          }
        }
      }

      // Puntos de referencia as green circles (even if not visited)
      for (const pr of puntosReferencia) {
        if (!visitedWaypoints.has(pr.id)) {
          L.circleMarker([pr.latitud, pr.longitud], {
            radius: 8, color: '#10b981', fillColor: '#10b981', fillOpacity: 0.4,
          }).addTo(histMarkers).bindPopup(`<b>${pr.nombre}</b>`)
          boundsCoords.push([pr.latitud, pr.longitud])
        }
      }

      // Fit bounds to show everything
      if (boundsCoords.length > 0) {
        map.fitBounds(L.latLngBounds(boundsCoords).pad(0.15))
      }

      setTimeout(() => map.invalidateSize(), 200)
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trail])

  // Selected event highlight (fly to location)
  useEffect(() => {
    if (!mapRef.current || !selectedEvent || !selectedEvent.lat) return
    const map = mapRef.current
    const L = (window as any).L
    if (!L) return

    if (selectedMarkerRef.current) map.removeLayer(selectedMarkerRef.current)

    selectedMarkerRef.current = L.circleMarker([selectedEvent.lat, selectedEvent.lng], {
      radius: 15, color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.3, className: 'hist-pulse',
    }).addTo(map).bindPopup(`<strong>${selectedEvent.evento}</strong>`)

    map.flyTo([selectedEvent.lat, selectedEvent.lng], 17, { duration: 0.8 })
  }, [selectedEvent])

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
}
