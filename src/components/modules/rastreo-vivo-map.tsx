'use client'
import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

export default function VivoMap({ repartidores, ubicaciones, puntosReferencia, selectedRepId }: any) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)

  useEffect(() => {
    // Destruir mapa anterior si existe
    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
    }
    if (!containerRef.current) return

    import('leaflet').then(function (LModule) {
      var L = LModule.default
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      var ROCHA: [number, number] = [-34.4833, -54.3317]
      var map = L.map(containerRef.current).setView(ROCHA, 14)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
      }).addTo(map)

      // ═══ PUNTOS DE REFERENCIA - con etiqueta permanente ═══
      if (puntosReferencia && puntosReferencia.length > 0) {
        puntosReferencia.forEach(function (p) {
          var lat = Number(p.latitud != null ? p.latitud : (p.lat != null ? p.lat : 0))
          var lng = Number(p.longitud != null ? p.longitud : (p.lng != null ? p.lng : 0))
          if (!lat || !lng) return

          // Punto verde en el suelo
          L.circleMarker([lat, lng], {
            radius: 7,
            color: '#065f46',
            fillColor: '#10b981',
            fillOpacity: 0.85,
            weight: 2,
          }).addTo(map).bindPopup('<strong>' + (p.nombre || 'Punto') + '</strong><br/>Lat: ' + lat + '<br/>Lng: ' + lng)

          // Etiqueta con nombre permanente arriba del punto
          var label = L.divIcon({
            html: '<div style="background:#059669;color:#fff;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:bold;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.35);border:2px solid #34d399;font-family:system-ui,sans-serif;">' + (p.nombre || 'Punto') + '</div>',
            className: '',
            iconSize: [120, 28],
            iconAnchor: [60, -12],
          })
          L.marker([lat, lng], { icon: label, interactive: true }).addTo(map)
        })
        console.log('[VivoMap] Puntos dibujados:', puntosReferencia.length)
      }

      // ═══ VEHICULOS / REPARTIDORES ═══
      var hasVehicle = false
      var firstUbi = null
      if (repartidores && repartidores.length > 0) {
        repartidores.forEach(function (r) {
          if (selectedRepId && r.id !== selectedRepId) return
          var ubi = null
          for (var i = 0; i < ubicaciones.length; i++) {
            if (ubicaciones[i].repartidor_id === r.id) { ubi = ubicaciones[i]; break }
          }
          if (!ubi) return
          hasVehicle = true
          if (!firstUbi) firstUbi = ubi
          var icon = L.divIcon({
            html: '<div style="background-color:' + (r.color || '#3b82f6') + ';width:26px;height:26px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);"></div>',
            className: '',
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          })
          L.marker([ubi.latitud, ubi.longitud], { icon: icon })
            .addTo(map)
            .bindPopup(
              '<strong>' + r.nombre + '</strong><br/>Vel: ' + Math.round((ubi.velocidad || 0) * 3.6) + ' km/h' +
              (r.vehiculo ? '<br/>Vehiculo: ' + r.vehiculo : '') +
              (r.patente ? '<br/>Patente: ' + r.patente : '')
            )
        })
      }

      // Centrar mapa
      if (selectedRepId && firstUbi) {
        map.setView([firstUbi.latitud, firstUbi.longitud], 15)
      } else if (hasVehicle && firstUbi) {
        map.setView([firstUbi.latitud, firstUbi.longitud], 14)
      } else if (puntosReferencia && puntosReferencia.length > 0 && !hasVehicle) {
        // Si solo hay puntos, ajustar zoom para verlos todos
        var bounds = L.latLngBounds(
          puntosReferencia
            .map(function (p) {
              var la = Number(p.latitud != null ? p.latitud : (p.lat != null ? p.lat : 0))
              var ln = Number(p.longitud != null ? p.longitud : (p.lng != null ? p.lng : 0))
              return (!la || !ln) ? null : [la, ln]
            })
            .filter(function (c) { return c !== null })
        )
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 })
        }
      }

      mapRef.current = map
    })

    return function () {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  }, [repartidores, ubicaciones, puntosReferencia, selectedRepId])

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
}
