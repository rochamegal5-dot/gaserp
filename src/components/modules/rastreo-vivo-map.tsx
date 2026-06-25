'use client'
import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

interface Props { repartidores: any[]; ubicaciones: any[]; puntosReferencia: any[] }

export default function VivoMap({ repartidores, ubicaciones, puntosReferencia }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])

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
      const center: [number, number] = ubicaciones[0] ? [ubicaciones[0].latitud, ubicaciones[0].longitud] : [-34.9011, -56.1645]
      const map = L.map(containerRef.current!).setView(center, 13)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map)
      mapRef.current = map
      puntosReferencia.forEach((p) => {
        L.circleMarker([p.lat, p.lng], { radius: 8, color: '#10b981', fillColor: '#10b981', fillOpacity: 0.5 }).addTo(map).bindPopup(`<strong>${p.nombre}</strong>`)
      })
    })
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null } }
  }, [])

  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current
    markersRef.current.forEach((m) => map.removeLayer(m))
    markersRef.current = []
    import('leaflet').then((LModule) => {
      const L = LModule.default
      repartidores.forEach((r) => {
        const ubi = ubicaciones.find((u: any) => u.repartidor_id === r.id)
        if (!ubi) return
        const icon = L.divIcon({ html: `<div style="background-color: ${r.color}; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3);"></div>`, className: '', iconSize: [20, 20] })
        const marker = L.marker([ubi.latitud, ubi.longitud], { icon }).addTo(map).bindPopup(`<strong>${r.nombre}</strong><br>Velocidad: ${Math.round((ubi.velocidad || 0) * 3.6)} km/h${r.vehiculo ? '<br>Vehículo: ' + r.vehiculo : ''}`)
        markersRef.current.push(marker)
      })
    })
  }, [repartidores, ubicaciones])

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
}
