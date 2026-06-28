'use client'
import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

interface Props { repartidores: any[]; ubicaciones: any[]; puntosReferencia: any[]; selectedRepId?: string | null }

export default function VivoMap({ repartidores, ubicaciones, puntosReferencia, selectedRepId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const puntosLayerRef = useRef<any>(null)

  const ROCHA_CENTER: [number, number] = [-34.4833, -54.3317]

  // 1) Crear mapa UNA SOLA VEZ
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
      const map = L.map(containerRef.current!).setView(ROCHA_CENTER, 14)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
      }).addTo(map)
      puntosLayerRef.current = L.layerGroup().addTo(map)
      mapRef.current = map
    })
    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  }, [])

  // 2) Actualizar marcadores de repartidores
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current
    markersRef.current.forEach((m) => map.removeLayer(m))
    markersRef.current = []
    const filteredUbi = selectedRepId
      ? ubicaciones.filter(u => u.repartidor_id === selectedRepId)
      : ubicaciones
    import('leaflet').then((LModule) => {
      const L = LModule.default
      let hasMarker = false
      repartidores.forEach((r) => {
        if (selectedRepId && r.id !== selectedRepId) return
        const ubi = ubicaciones.find((u: any) => u.repartidor_id === r.id)
        if (!ubi) return
        hasMarker = true
        const icon = L.divIcon({
          html: `<div style="background-color:${r.color || '#3b82f6'};width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`,
          className: '',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        })
        const marker = L.marker([ubi.latitud, ubi.longitud], { icon })
          .addTo(map)
          .bindPopup(`<strong>${r.nombre}</strong><br/>Velocidad: ${Math.round((ubi.velocidad || 0) * 3.6)} km/h${r.vehiculo ? '<br/>Vehiculo: ' + r.vehiculo : ''}${r.patente ? '<br/>Patente: ' + r.patente : ''}`)
        markersRef.current.push(marker)
      })
      if (filteredUbi.length > 0) {
        const first = filteredUbi[0]
        map.setView([first.latitud, first.longitud], 15, { animate: true })
      } else if (!hasMarker) {
        map.setView(ROCHA_CENTER, 14)
      }
    })
  }, [repartidores, ubicaciones, selectedRepId])

  // 3) Dibujar puntos de referencia cuando llegan los datos
  useEffect(() => {
    const layer = puntosLayerRef.current
    if (!layer) return
    layer.clearLayers()
    if (!puntosReferencia || puntosReferencia.length === 0) return
    import('leaflet').then((LModule) => {
      const L = LModule.default
      puntosReferencia.forEach((p) => {
        if (!p.latitud || !p.longitud) return
        L.circleMarker([p.latitud, p.longitud], {
          radius: 8,
          color: '#059669',
          fillColor: '#10b981',
          fillOpacity: 0.5,
          weight: 2,
        })
          .bindPopup(`<strong>${p.nombre}</strong><br/>Lat: ${p.latitud}<br/>Lng: ${p.longitud}`)
          .addTo(layer)
      })
    })
  }, [puntosReferencia])

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
}
