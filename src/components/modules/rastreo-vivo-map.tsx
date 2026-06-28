'use client'
import { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'

interface Props { repartidores: any[]; ubicaciones: any[]; puntosReferencia: any[]; selectedRepId?: string | null }

export default function VivoMap({ repartidores, ubicaciones, puntosReferencia, selectedRepId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersLayerRef = useRef<any>(null)
  const puntosLayerRef = useRef<any>(null)
  const [mapReady, setMapReady] = useState(false)

  const ROCHA_CENTER: [number, number] = [-34.4833, -54.3317]

  // 1) Crear mapa UNA SOLA VEZ y avisar cuando esté listo
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
      markersLayerRef.current = L.layerGroup().addTo(map)
      puntosLayerRef.current = L.layerGroup().addTo(map)
      mapRef.current = map
      setMapReady(true)
    })
    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
      setMapReady(false)
    }
  }, [])

  // 2) Dibujar TODO (vehiculos + puntos) cuando el mapa esté listo o cambien los datos
  useEffect(() => {
    if (!mapReady) return
    const map = mapRef.current
    const markersLayer = markersLayerRef.current
    const puntosLayer = puntosLayerRef.current
    if (!map || !markersLayer || !puntosLayer) return

    import('leaflet').then((LModule) => {
      const L = LModule.default

      // ── Limpiar todo ──
      markersLayer.clearLayers()
      puntosLayer.clearLayers()

      // ── Dibujar vehículos ──
      const filteredUbi = selectedRepId
        ? ubicaciones.filter(u => u.repartidor_id === selectedRepId)
        : ubicaciones
      let hasMarker = false
      repartidores.forEach((r) => {
        if (selectedRepId && r.id !== selectedRepId) return
        const ubi = ubicaciones.find((u: any) => u.repartidor_id === r.id)
        if (!ubi) return
        hasMarker = true
        const icon = L.divIcon({
          html: '<div style="background-color:' + (r.color || '#3b82f6') + ';width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>',
          className: '',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        })
        L.marker([ubi.latitud, ubi.longitud], { icon })
          .addTo(markersLayer)
          .bindPopup('<strong>' + r.nombre + '</strong><br/>Vel: ' + Math.round((ubi.velocidad || 0) * 3.6) + ' km/h' + (r.vehiculo ? '<br/>Vehiculo: ' + r.vehiculo : '') + (r.patente ? '<br/>Patente: ' + r.patente : ''))
      })
      if (filteredUbi.length > 0) {
        map.setView([filteredUbi[0].latitud, filteredUbi[0].longitud], 15, { animate: true })
      } else if (!hasMarker) {
        map.setView(ROCHA_CENTER, 14)
      }

      // ── Dibujar puntos de referencia con ETIQUETA PERMANENTE ──
      if (puntosReferencia && puntosReferencia.length > 0) {
        puntosReferencia.forEach(function(p) {
          var lat = Number(p.latitud || p.lat || 0)
          var lng = Number(p.longitud || p.lng || 0)
          if (!lat || !lng) return

          // Etiqueta permanente con el nombre
          var labelIcon = L.divIcon({
            html: '<div style="background:#059669;color:white;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid #34d399;">' + p.nombre + '</div>',
            className: '',
            iconSize: [120, 26],
            iconAnchor: [60, -10],
          })
          L.marker([lat, lng], { icon: labelIcon, interactive: true })
            .bindPopup('<strong>' + p.nombre + '</strong><br/>Lat: ' + lat + '<br/>Lng: ' + lng)
            .addTo(puntosLayer)

          // Punto verde debajo de la etiqueta
          L.circleMarker([lat, lng], {
            radius: 7,
            color: '#065f46',
            fillColor: '#10b981',
            fillOpacity: 0.9,
            weight: 2,
          }).addTo(puntosLayer)
        })

        // Si no hay vehiculos, centrar en los puntos
        if (!hasMarker) {
          var bounds = L.latLngBounds(puntosReferencia.map(function(p) {
            return [Number(p.latitud || p.lat), Number(p.longitud || p.lng)]
          }).filter(function(c) { return c[0] && c[1] }))
          if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 })
          }
        }
      }
    })
  }, [mapReady, repartidores, ubicaciones, puntosReferencia, selectedRepId])

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
}
