'use client'
import { useEffect, useRef, useCallback } from 'react'
import 'leaflet/dist/leaflet.css'

/* ── Pulse animation (same as reference HTML) ── */

const PULSE_CSS = `
.gps-marker{
  border-radius:50%;
  border:3px solid #fff;
  box-shadow:0 0 8px rgba(0,0,0,.5);
}

.gps-pulse{
  position:absolute;
  top:50%;
  left:50%;
  transform:translate(-50%,-50%);
  border-radius:50%;
  opacity:0;
  animation:gpsPulse 2s ease-out infinite;
}

@keyframes gpsPulse{
  0%{
      transform:translate(-50%,-50%) scale(1);
      opacity:.6;
  }
  100%{
      transform:translate(-50%,-50%) scale(3);
      opacity:0;
  }
}

.leaflet-container{
    background:#f1f5f9;
}

.gps-tooltip{
    background:#ffffff !important;
    color:#111827 !important;
    border:2px solid #16a34a !important;
    border-radius:8px;
    font-size:13px;
    font-weight:700;
    padding:3px 8px;
    box-shadow:0 2px 8px rgba(0,0,0,.25);
}


.punto-tooltip{
  background: rgba(255,255,255,.95);
  border: 1px solid #2563eb;
  color:#111827;
  font-weight:700;
  font-size:12px;
  padding:3px 8px;
  border-radius:6px;
  box-shadow:0 2px 6px rgba(0,0,0,.25);
}

.punto-tooltip:before{
  display:none;
}
`
interface RepData {id: string; nombre: string; color: string; vehiculo?: string | null; latitud: number; longitud: number; velocidad: number; en_movimiento: boolean; lastTimestamp?: string }
interface PuntoData { id: string; nombre: string; latitud: number; longitud: number }

interface Props {
  repartidores: RepData[]
  ubicaciones: any[]
  puntosReferencia: PuntoData[]
  selectedRepId: string | null
  onMapClick?: (lat: number, lng: number) => void
  onSpeedUpdate?: (repId: string, speedKmh: number) => void
}

export default function VivoMap({ repartidores, ubicaciones, puntosReferencia, selectedRepId, onMapClick, onSpeedUpdate }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<Map<string, any>>(new Map())
  const trailsRef = useRef<Map<string, any>>(new Map())
  const trailDataRef = useRef<Map<string, [number, number][]>>(new Map())
  const puntosLayerRef = useRef<any>(null)
  const initializedRef = useRef(false)

  // Build rep map with latest ubicacion
  const repMap = useCallback(() => {
    const m = new Map<string, RepData>()
    for (const r of repartidores) {
      const ubi = ubicaciones.find((u: any) => u.repartidor_id === r.id)
      m.set(r.id, {
        ...r,
        latitud: ubi?.latitud ?? -34.9011,
        longitud: ubi?.longitud ?? -56.1645,
        velocidad: ubi?.velocidad ?? 0,
        en_movimiento: ubi?.en_movimiento ?? false,
        lastTimestamp: ubi?.timestamp,
      })
    }
    return m
  }, [repartidores, ubicaciones])

  // Create the icon with pulse animation (same as reference)
  const crearIcono = useCallback((color: string, size = 18) => {
    if (typeof window === 'undefined') return null
    const L = (window as any).L
    if (!L) return null
    return L.divIcon({
      className: '',
      html: `<div style="position:relative; width:${size}px; height:${size}px;">
               <div class="gps-pulse" style="background:${color}; width:${size}px; height:${size}px;"></div>
               <div class="gps-marker" style="background:${color}; width:${size}px; height:${size}px;"></div>
             </div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    })
  }, [])

  // Initialize map once

  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return

    // Inject pulse CSS
    if (typeof document !== 'undefined') {
      const styleId = 'gps-pulse-css'
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style')
        style.id = styleId
        style.textContent = PULSE_CSS
        document.head.appendChild(style)
      }
    }

    import('leaflet').then((LModule) => {
      const L = LModule.default
      ;(window as any).L = L // expose globally for this module

      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const ROCHA_CENTER: [number, number] = [-34.9011, -56.1645]
      const map = L.map(containerRef.current!, { zoomControl: true }).setView(ROCHA_CENTER, 13)
      L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  {
    attribution: '&copy; OpenStreetMap & CARTO'
  }
).addTo(map)

      // Click on map to get coordinates (same as reference)
      map.on('click', (e: any) => {
        onMapClick?.(e.latlng.lat, e.latlng.lng)
      })

      mapRef.current = map
      initializedRef.current = true

      // Fit bounds after initial markers render
      setTimeout(() => map.invalidateSize(), 200)
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        initializedRef.current = false
        markersRef.current.clear()
        trailsRef.current.clear()
        trailDataRef.current.clear()
        puntosLayerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

// Update puntos de ruta layer
useEffect(() => {
  const map = mapRef.current
  if (!map) return

  import('leaflet').then((LModule) => {
    const L = LModule.default

    if (puntosLayerRef.current) {
      puntosLayerRef.current.clearLayers()
    } else {
      puntosLayerRef.current = L.layerGroup().addTo(map)
    }

    for (const p of puntosReferencia) {

      const punto = L.marker(
        [p.latitud, p.longitud],
        {
          icon: L.icon({
            iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
            shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
            iconSize: [25, 41],
            iconAnchor: [12, 41]
          })
        }
      ).addTo(puntosLayerRef.current!)

      punto.bindTooltip(p.nombre, {
        permanent: true,
        direction: "right",
        offset: [15, 0],
        className: "punto-tooltip"
      })
    }

  })

}, [puntosReferencia])


  // Main render: create/update markers, trails, and handle selection
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const reps = repMap()
    const L = (window as any).L
    if (!L) return

    const activeIds = new Set<string>()

    reps.forEach((rep, id) => {
      activeIds.add(id)

      // Build trail data
      const existingTrail = trailDataRef.current.get(id) || []
      const lastPoint: [number, number] = [rep.latitud, rep.longitud]
      // Only add if position changed
      if (existingTrail.length === 0 ||
          (existingTrail[existingTrail.length - 1][0] !== lastPoint[0] ||
           existingTrail[existingTrail.length - 1][1] !== lastPoint[1])) {
        existingTrail.push(lastPoint)
        if (existingTrail.length > 100) existingTrail.shift()
      }
      trailDataRef.current.set(id, existingTrail)

      const icon = crearIcono(rep.color)
      if (!icon) return

      const existingMarker = markersRef.current.get(id)

if (existingMarker) {
    existingMarker.setLatLng([rep.latitud, rep.longitud])
    existingMarker.setIcon(icon)

    existingMarker.setTooltipContent(rep.nombre)

    existingMarker.setPopupContent(
      `<b>${rep.nombre}</b><br>
       Velocidad: ${(rep.velocidad * 3.6).toFixed(0)} km/h
       ${rep.vehiculo ? '<br>Vehículo: ' + rep.vehiculo : ''}`
    )
}

      else {
	const marker = L.marker([rep.latitud, rep.longitud], { icon }).addTo(map)

marker.bindTooltip(rep.nombre,{
    permanent:true,
    direction:"top",
    offset:[0,-18],
    className:"gps-tooltip"
})

marker.bindPopup(
    `<b>${rep.nombre}</b>
     <br>Velocidad: ${(rep.velocidad * 3.6).toFixed(0)} km/h
     ${rep.vehiculo ? '<br>Vehículo: '+rep.vehiculo : ''}`
)

markersRef.current.set(id,marker)


        
        // Create trail polyline (same as reference, commented out in ref but we enable it)
        const trail = L.polyline(existingTrail, {
          color: rep.color,
          weight: 4,
          opacity: 0.6,
        }).addTo(map)
        trailsRef.current.set(id, trail)
      }

      // Update trail line
      const trail = trailsRef.current.get(id)
      if (trail) {
        trail.setLatLngs(existingTrail)
      }
    })

    // Remove markers for deleted reps
    markersRef.current.forEach((marker, id) => {
      if (!activeIds.has(id)) {
        map.removeLayer(marker)
        markersRef.current.delete(id)
        const trail = trailsRef.current.get(id)
        if (trail) { map.removeLayer(trail); trailsRef.current.delete(id) }
        trailDataRef.current.delete(id)
      }
    })

    

// Auto-center
if (selectedRepId) {
  const selRep = reps.get(selectedRepId)

  if (selRep) {
    map.panTo([selRep.latitud, selRep.longitud], {
      animate: true,
      duration: 0.5
    })

    markersRef.current.get(selectedRepId)?.openPopup()

    onSpeedUpdate?.(
      selectedRepId,
      selRep.velocidad * 3.6
    )
  }

} else {


if (!selectedRepId && markersRef.current.size > 0) {

    const bounds = L.featureGroup(
        Array.from(markersRef.current.values())
    ).getBounds()

    if (!map.getBounds().contains(bounds)) {
        map.fitBounds(bounds.pad(0.2))
    }

}

  }, [repartidores, ubicaciones, selectedRepId, repMap, crearIcono, onSpeedUpdate])

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
}
