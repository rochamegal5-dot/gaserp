'use client'
import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

const HIST_CSS = `
.hist-pulse { animation: histPulse 1.5s ease-out infinite; }
@keyframes histPulse { 0% { opacity: 0.8; } 50% { opacity: 0.3; } 100% { opacity: 0.8; } }

.gm-pin{
  width:24px;
  height:34px;
  position:relative;
  cursor:pointer;
  filter:drop-shadow(0 2px 3px rgba(0,0,0,.4));
}
.gm-pin-body{
  width:24px;
  height:24px;
  border-radius:50% 50% 50% 0;
  background:#ea4335;
  transform:rotate(-45deg);
  border:2px solid #fff;
  box-sizing:border-box;
  display:flex;
  align-items:center;
  justify-content:center;
}
.gm-pin-dot{
  width:7px;
  height:7px;
  border-radius:50%;
  background:#fff;
  transform:rotate(45deg);
}
.gm-pin-visited .gm-pin-body{ background:#1e40af; }
.punto-label-h{
  background:rgba(255,255,255,.95) !important;
  border:1px solid #ea4335 !important;
  color:#111827 !important;
  font-size:11px;
  font-weight:700;
  padding:2px 7px;
  border-radius:5px;
  box-shadow:0 2px 5px rgba(0,0,0,.2);
  white-space:nowrap;
}
.punto-label-h:before{ display:none; }
.punto-label-visited{
  background:rgba(255,255,255,.95) !important;
  border:1px solid #1e40af !important;
  color:#1e40af !important;
}
`

interface TrailPoint {
  lat: number
  lng: number
  timestamp: string
  velocidad?: number
  en_movimiento?: boolean
  precision_gps?: number
}
interface PuntoData {
  id: string
  nombre: string
  latitud: number
  longitud: number
  radio_m?: number
  descripcion?: string | null
}
interface TimelineEvent {
  lat?: number
  lng?: number
  hora: string
  evento: string
  detalle: string
  punto_nombre?: string
  es_detencion?: boolean
  stop_id?: string
}

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

  // Inyectar CSS
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

  // Render principal del mapa con incidentes
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

      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }

      const ROCHA_CENTER: [number, number] = [-34.9011, -56.1645]
      const center: [number, number] = trail[0] ? [trail[0].lat, trail[0].lng] : ROCHA_CENTER
      const map = L.map(containerRef.current!).setView(center, 13)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
      }).addTo(map)
      mapRef.current = map

      if (trail.length === 0) {
        // Dibujar igual los puntos de referencia aunque no haya trail
        if (puntosReferencia.length > 0) {
          const histMarkers = L.layerGroup().addTo(map)
          histMarkersRef.current = histMarkers
          const boundsCoords: [number, number][] = []
          for (const pr of puntosReferencia) {
            L.marker([pr.latitud, pr.longitud], {
              icon: L.divIcon({
                className: 'gm-pin',
                html: `<div class="gm-pin-body"><div class="gm-pin-dot"></div></div>`,
                iconSize: [24, 34],
                iconAnchor: [12, 32],
              }),
            })
              .addTo(histMarkers)
              .bindPopup(
                `<div style="font-family:system-ui;min-width:160px;">
                   <div style="font-weight:700;font-size:13px;color:#ea4335;">${pr.nombre}</div>
                   <div style="font-size:11px;color:#555;margin-top:3px;">
                     Radio: <strong>${pr.radio_m || 50} m</strong><br>
                     Lat: <code>${pr.latitud.toFixed(6)}</code><br>
                     Lng: <code>${pr.longitud.toFixed(6)}</code>
                   </div>
                 </div>`
              )
            boundsCoords.push([pr.latitud, pr.longitud])
          }
          if (boundsCoords.length > 0) {
            map.fitBounds(L.latLngBounds(boundsCoords).pad(0.15))
          }
        }
        setTimeout(() => map.invalidateSize(), 200)
        return
      }

      // 1. Polilínea del recorrido
      const trailCoords: [number, number][] = trail.map(p => [p.lat, p.lng])
      L.polyline(trailCoords, {
        color: repartidor?.color || '#3b82f6',
        weight: 4,
        opacity: 0.7,
      }).addTo(map)

      // 2. Marcadores de inicio / fin
      L.marker(trailCoords[0]).addTo(map).bindPopup('<strong>&#9654; Inicio</strong>')
      L.marker(trailCoords[trailCoords.length - 1]).addTo(map).bindPopup('<strong>&#9632; Fin</strong>')

      // 3. Capa de incidentes
      const histMarkers = L.layerGroup().addTo(map)
      histMarkersRef.current = histMarkers
      const boundsCoords: [number, number][] = [...trailCoords]

      // Marcadores de tiempo cada 15 minutos
      let lastTimeMarker: Date | null = null
      for (const p of trail) {
        const pTime = new Date(p.timestamp)
        if (!lastTimeMarker || (pTime.getTime() - lastTimeMarker.getTime()) >= 15 * 60 * 1000) {
          const timeStr = pTime.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })
          const iconHtml = `<div style="background:white; padding:2px 5px; border-radius:4px; font-size:10px; font-weight:bold; border:1px solid #ccc;">&#128336; ${timeStr}</div>`
          L.marker([p.lat, p.lng], {
            icon: L.divIcon({ className: '', html: iconHtml, iconAnchor: [0, 20] }),
          }).addTo(histMarkers)
          lastTimeMarker = pTime
        }
      }

      // Excesos de velocidad (>45 km/h)
      for (const p of trail) {
        const speedKmh = (p.velocidad || 0) * 3.6
        if (speedKmh > 45) {
          L.circleMarker([p.lat, p.lng], {
            radius: 6, color: '#dc2626', fillColor: '#fca5a5', fillOpacity: 1,
          }).addTo(histMarkers).bindPopup(`<b>Exceso Velocidad</b><br>${speedKmh.toFixed(1)} km/h`)
          boundsCoords.push([p.lat, p.lng])
        }
      }

      // Visitas a waypoints
      const visitedWaypoints = new Set<string>()
      for (const p of trail) {
        if (puntosReferencia.length > 0) {
          for (const wp of puntosReferencia) {
            const dist = map.distance(L.latLng(p.lat, p.lng), L.latLng(wp.latitud, wp.longitud))
            if (dist <= (wp.radio_m || 50)) {
              if (!visitedWaypoints.has(wp.id)) {
                visitedWaypoints.add(wp.id)
              }
            }
          }
        }
      }

      // Detenciones prolongadas (>=3 min)
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
                if (map.distance(L.latLng(stopLat, stopLng), L.latLng(wp.latitud, wp.longitud)) <= (wp.radio_m || 50)) {
                  stopPlaceName = wp.nombre
                }
              }
              const detDetail = stopPlaceName
                ? `Detenido ${durationMins.toFixed(1)} min en: ${stopPlaceName}`
                : `Detenido ${durationMins.toFixed(1)} min`
              L.circleMarker([stopLat, stopLng], {
                radius: 8, color: '#ea580c', fillColor: '#fed7aa', fillOpacity: 1,
              }).addTo(histMarkers).bindPopup(`<b>Detención Prolongada</b><br>${detDetail}`)
              boundsCoords.push([stopLat, stopLng])
            }
            stopStartTime = null
          }
        }
      }

      // Dibujar TODOS los puntos de referencia (visitados en azul, no visitados en rojo)
      for (const pr of puntosReferencia) {
        const visited = visitedWaypoints.has(pr.id)
        const pinClass = visited ? 'gm-pin gm-pin-visited' : 'gm-pin'
        const labelClass = visited ? 'punto-label-h punto-label-visited' : 'punto-label-h'

        // Círculo del radio
        if (pr.radio_m && pr.radio_m > 0) {
          L.circle([pr.latitud, pr.longitud], {
            radius: pr.radio_m,
            color: visited ? '#1e40af' : '#ea4335',
            weight: 1,
            opacity: 0.5,
            fillColor: visited ? '#1e40af' : '#ea4335',
            fillOpacity: 0.1,
          }).addTo(histMarkers)
        }

        const m = L.marker([pr.latitud, pr.longitud], {
          icon: L.divIcon({
            className: pinClass,
            html: `<div class="gm-pin-body"><div class="gm-pin-dot"></div></div>`,
            iconSize: [24, 34],
            iconAnchor: [12, 32],
          }),
        }).addTo(histMarkers)

        m.bindTooltip(pr.nombre, {
          permanent: true,
          direction: 'top',
          offset: [0, -30],
          className: labelClass,
        })

        const statusTxt = visited
          ? '<span style="color:#1e40af;font-weight:700;">&#10003; Visitado</span>'
          : '<span style="color:#ea4335;font-weight:700;">No visitado</span>'

        m.bindPopup(
          `<div style="font-family:system-ui;min-width:180px;">
             <div style="font-weight:700;font-size:13px;color:#ea4335;margin-bottom:4px;">${pr.nombre}</div>
             <div style="font-size:11px;color:#555;line-height:1.5;">
               <div>Estado: ${statusTxt}</div>
               <div>Radio: <strong>${pr.radio_m || 50} m</strong></div>
               <div>Lat: <code>${pr.latitud.toFixed(6)}</code></div>
               <div>Lng: <code>${pr.longitud.toFixed(6)}</code></div>
               ${pr.descripcion ? `<br><small>${pr.descripcion}</small>` : ''}
             </div>
           </div>`
        )

        boundsCoords.push([pr.latitud, pr.longitud])
      }

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
  }, [trail, puntosReferencia])

  // Highlight del evento seleccionado
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
