'use client'
import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

interface Props { trail: any[]; repartidor: any; puntosReferencia: any[]; selectedEvent: any }

export default function HistorialMap({ trail, repartidor, puntosReferencia, selectedEvent }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const selectedMarkerRef = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    import('leaflet').then((LModule) => {
      const L = LModule.default
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })
      const center: [number, number] = trail[0] ? [trail[0].lat, trail[0].lng] : [-34.9011, -56.1645]
      const map = L.map(containerRef.current!).setView(center, 13)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map)
      mapRef.current = map
      if (trail[0]) L.marker([trail[0].lat, trail[0].lng]).addTo(map).bindPopup('<strong>Inicio</strong>')
      if (trail[trail.length - 1]) L.marker([trail[trail.length - 1].lat, trail[trail.length - 1].lng]).addTo(map).bindPopup('<strong>Fin</strong>')
      const stops: any[] = []
      let stopStart = -1
      for (let i = 0; i < trail.length; i++) {
        const p = trail[i]
        if (!p.en_movimiento) { if (stopStart === -1) stopStart = i }
        else { if (stopStart !== -1 && i - stopStart > 1) { const dur = (new Date(trail[i].timestamp).getTime() - new Date(trail[stopStart].timestamp).getTime()) / 60000; if (dur >= 0.5) stops.push({ ...trail[stopStart], duration: dur }) } stopStart = -1 }
      }
      stops.forEach((s) => { const isLong = s.duration >= 3; L.circleMarker([s.lat, s.lng], { radius: isLong ? 12 : 8, color: isLong ? '#f97316' : '#9ca3af', fillColor: isLong ? '#f97316' : '#9ca3af', fillOpacity: isLong ? 0.7 : 0.5 }).addTo(map).bindPopup(`<strong>${isLong ? 'Detención' : 'Parada'}</strong><br>${Math.round(s.duration)} min`) })
      puntosReferencia.forEach((p) => L.circleMarker([p.lat, p.lng], { radius: 6, color: '#10b981', fillColor: '#10b981', fillOpacity: 0.5 }).addTo(map).bindPopup(`<strong>${p.nombre}</strong>`))
      const allPoints: [number, number][] = [...stops.map(s => [s.lat, s.lng]), ...puntosReferencia.map(p => [p.lat, p.lng])]
      if (trail[0]) allPoints.push([trail[0].lat, trail[0].lng])
      if (trail[trail.length - 1]) allPoints.push([trail[trail.length - 1].lat, trail[trail.length - 1].lng])
      if (allPoints.length > 0) map.fitBounds(L.latLngBounds(allPoints).pad(0.1))
    })
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null } }
  }, [trail])

  useEffect(() => {
    if (!mapRef.current || !selectedEvent || !selectedEvent.lat) return
    const map = mapRef.current
    if (selectedMarkerRef.current) map.removeLayer(selectedMarkerRef.current)
    import('leaflet').then((LModule) => {
      const L = LModule.default
      selectedMarkerRef.current = L.circleMarker([selectedEvent.lat, selectedEvent.lng], { radius: 15, color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.3, className: 'hist-pulse' }).addTo(map).bindPopup(`<strong>${selectedEvent.evento}</strong>`)
      map.flyTo([selectedEvent.lat, selectedEvent.lng], 17, { duration: 0.8 })
    })
  }, [selectedEvent])

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
}
