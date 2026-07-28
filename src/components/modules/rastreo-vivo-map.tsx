'use client'
import { useEffect, useRef, useCallback } from 'react'
import 'leaflet/dist/leaflet.css'

/* ───────────────────────────────────────────────────────────────
   CSS — Pulso GPS + Pin tipo Google Maps (gota invertida)
   ─────────────────────────────────────────────────────────────── */
const VIVO_CSS = `
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
  0%   { transform:translate(-50%,-50%) scale(1);   opacity:.6; }
  100% { transform:translate(-50%,-50%) scale(3);   opacity:0;   }
}
.leaflet-container{ background:#f1f5f9; }

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

/* ── Pin tipo Google Maps (gota invertida con sombra) ── */
.gm-pin{
  width:28px;
  height:40px;
  position:relative;
  cursor:pointer;
  transform-origin:bottom center;
  filter:drop-shadow(0 3px 4px rgba(0,0,0,.45));
  transition:transform .15s ease;
}
.gm-pin:hover{ transform:scale(1.12); }
.gm-pin-body{
  width:28px;
  height:28px;
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
  width:8px;
  height:8px;
  border-radius:50%;
  background:#fff;
  transform:rotate(45deg);
}

/* Pin temporal (cuando se está creando un punto) */
.gm-pin-temp .gm-pin-body{ background:#1a73e8; }
.gm-pin-temp .gm-pin-dot{ background:#fff; }

/* Pin del punto seleccionado en la lista */
.gm-pin-selected .gm-pin-body{ background:#fbbc04; }

/* Tooltip persistente para nombre del punto */
.punto-label{
  background:rgba(255,255,255,.97) !important;
  border:1px solid #ea4335 !important;
  color:#111827 !important;
  font-size:11px;
  font-weight:700;
  padding:2px 7px;
  border-radius:5px;
  box-shadow:0 2px 6px rgba(0,0,0,.2);
  white-space:nowrap;
}
.punto-label:before{ display:none; }

/* ── Botones de zoom en esquina inferior derecha (estilo Google Maps) ── */
.leaflet-bottom.leaflet-right{
  margin-bottom:14px !important;
  margin-right:14px !important;
}
.leaflet-bottom.leaflet-right .leaflet-control-zoom{
  border:none !important;
  border-radius:10px !important;
  overflow:hidden;
  box-shadow:0 4px 12px rgba(0,0,0,.2) !important;
  margin:0 !important;
}
.leaflet-bottom.leaflet-right .leaflet-control-zoom a{
  width:38px !important;
  height:38px !important;
  line-height:38px !important;
  font-size:20px !important;
  font-weight:600 !important;
  color:#1a73e8 !important;
  background:#fff !important;
  border-bottom:1px solid #eee !important;
  transition:background .15s ease;
}
.leaflet-bottom.leaflet-right .leaflet-control-zoom a:hover{
  background:#f1f5f9 !important;
  color:#0d47a1 !important;
}
.leaflet-bottom.leaflet-right .leaflet-control-zoom a:last-child{
  border-bottom:none !important;
}
`

interface RepData {
  id: string
  nombre: string
  color: string
  vehiculo?: string | null
  latitud: number
  longitud: number
  velocidad: number
  en_movimiento: boolean
  lastTimestamp?: string
}
interface PuntoData {
  id: string
  nombre: string
  latitud: number
  longitud: number
  radio_m?: number
  descripcion?: string | null
}

interface Props {
  repartidores: RepData[]
  ubicaciones: any[]
  puntosReferencia: PuntoData[]
  selectedRepId: string | null
  /** Si es true, el mapa centra automáticamente al repartidor seleccionado en cada update */
  siguiendo?: boolean
  /** Coordenadas del punto que el usuario está creando (preview arrastrable) */
  previewPoint?: { lat: number; lng: number } | null
  /** Cuando el usuario arrastra el pin temporal */
  onPreviewDrag?: (lat: number, lng: number) => void
  /** Click en el mapa para iniciar nuevo punto */
  onMapClick?: (lat: number, lng: number) => void
  /** Click en un punto guardado (para edición) */
  onPuntoClick?: (punto: PuntoData) => void
  /** Cuando el usuario arrastra el mapa manualmente (para pausar el seguimiento) */
  onUserMapMove?: () => void
  onSpeedUpdate?: (repId: string, speedKmh: number) => void
}

export default function VivoMap({
  repartidores,
  ubicaciones,
  puntosReferencia,
  selectedRepId,
  siguiendo = false,
  previewPoint,
  onPreviewDrag,
  onMapClick,
  onPuntoClick,
  onUserMapMove,
  onSpeedUpdate,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<Map<string, any>>(new Map())
  const trailsRef = useRef<Map<string, any>>(new Map())
  const trailDataRef = useRef<Map<string, [number, number][]>>(new Map())
  const puntosLayerRef = useRef<any>(null)
  const previewMarkerRef = useRef<any>(null)
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

  // Crear ícono del repartidor con pulso
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

  // Pin tipo Google Maps para puntos de referencia
  const crearPinIcon = useCallback((selected = false) => {
    if (typeof window === 'undefined') return null
    const L = (window as any).L
    if (!L) return null
    return L.divIcon({
      className: selected ? 'gm-pin gm-pin-selected' : 'gm-pin',
      html: `<div class="gm-pin-body"><div class="gm-pin-dot"></div></div>`,
      iconSize: [28, 40],
      iconAnchor: [14, 38],
      popupAnchor: [0, -34],
    })
  }, [])

  // Pin temporal (preview de nuevo punto)
  const crearPinTemp = useCallback(() => {
    if (typeof window === 'undefined') return null
    const L = (window as any).L
    if (!L) return null
    return L.divIcon({
      className: 'gm-pin gm-pin-temp',
      html: `<div class="gm-pin-body"><div class="gm-pin-dot"></div></div>`,
      iconSize: [28, 40],
      iconAnchor: [14, 38],
      popupAnchor: [0, -34],
    })
  }, [])

  // ═══════════ Inicializar mapa (una sola vez) ═══════════
  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return

    if (typeof document !== 'undefined') {
      const styleId = 'vivo-map-css'
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style')
        style.id = styleId
        style.textContent = VIVO_CSS
        document.head.appendChild(style)
      }
    }

    import('leaflet').then((LModule) => {
      const L = LModule.default
      ;(window as any).L = L

      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const ROCHA_CENTER: [number, number] = [-34.4833, -54.3114]
      // zoomControl: false para mover los botones a la esquina inferior derecha
      const map = L.map(containerRef.current!, { zoomControl: false }).setView(ROCHA_CENTER, 25)
      // Botones de zoom en la esquina inferior derecha (estilo Google Maps)
      L.control.zoom({ position: 'bottomright' }).addTo(map)
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        { attribution: '&copy; OpenStreetMap & CARTO' }
      ).addTo(map)

      map.on('click', (e: any) => {
        onMapClick?.(e.latlng.lat, e.latlng.lng)
      })

      // Detectar cuando el usuario arrastra el mapa manualmente
      // para pausar el seguimiento automático
      map.on('dragstart', () => {
        onUserMapMove?.()
      })

      mapRef.current = map
      initializedRef.current = true

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
        previewMarkerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ═══════════ Renderizar puntos de referencia ═══════════
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
        // Círculo del radio de detección (sutil)
        if (p.radio_m && p.radio_m > 0) {
          L.circle([p.latitud, p.longitud], {
            radius: p.radio_m,
            color: '#ea4335',
            weight: 1,
            opacity: 0.4,
            fillColor: '#ea4335',
            fillOpacity: 0.08,
          }).addTo(puntosLayerRef.current!)
        }

        // Pin tipo Google Maps
        const marker = L.marker([p.latitud, p.longitud], {
          icon: crearPinIcon(false),
          draggable: false,
        }).addTo(puntosLayerRef.current!)

        // Label persistente con el nombre
        marker.bindTooltip(p.nombre, {
          permanent: true,
          direction: 'top',
          offset: [0, -36],
          className: 'punto-label',
        })

        // Popup con info detallada
        const radioTxt = p.radio_m ? `${p.radio_m} m` : '50 m (default)'
        const descTxt = p.descripcion ? `<br><small>${p.descripcion}</small>` : ''
        marker.bindPopup(
          `<div style="font-family:system-ui;min-width:180px;">
             <div style="font-weight:700;font-size:13px;color:#ea4335;margin-bottom:4px;">${p.nombre}</div>
             <div style="font-size:11px;color:#555;line-height:1.5;">
               <div>Lat: <code>${p.latitud.toFixed(6)}</code></div>
               <div>Lng: <code>${p.longitud.toFixed(6)}</code></div>
               <div>Radio: <strong>${radioTxt}</strong></div>
               ${descTxt}
             </div>
             <div style="margin-top:6px;font-size:10px;color:#888;border-top:1px solid #eee;padding-top:4px;">
               Hacé clic en Editar para modificar
             </div>
           </div>`
        )

        marker.on('click', () => {
          onPuntoClick?.(p)
        })
      }
    })
  }, [puntosReferencia, crearPinIcon, onPuntoClick])

  // ═══════════ Renderizar marker temporal (preview) ═══════════
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const L = (window as any).L
    if (!L) return

    // Remover marker anterior
    if (previewMarkerRef.current) {
      map.removeLayer(previewMarkerRef.current)
      previewMarkerRef.current = null
    }

    if (previewPoint) {
      const marker = L.marker([previewPoint.lat, previewPoint.lng], {
        icon: crearPinTemp(),
        draggable: true,
      }).addTo(map)

      marker.bindTooltip('Nuevo punto — arrastrá para ajustar', {
        permanent: true,
        direction: 'top',
        offset: [0, -36],
        className: 'punto-label',
      })

      marker.bindPopup(
        `<div style="font-family:system-ui;">
           <strong style="color:#1a73e8;">Pin temporal</strong><br>
           <small>Arrastrá el pin o hacé clic en otro lado del mapa para moverlo.</small>
         </div>`
      ).openPopup()

      marker.on('dragend', (e: any) => {
        const ll = e.target.getLatLng()
        onPreviewDrag?.(ll.lat, ll.lng)
      })

      previewMarkerRef.current = marker
    }
  }, [previewPoint, crearPinTemp, onPreviewDrag])

  // ═══════════ Render principal: repartidores + selección ═══════════
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const reps = repMap()
    const L = (window as any).L
    if (!L) return

    const activeIds = new Set<string>()

    reps.forEach((rep, id) => {
      activeIds.add(id)

      const existingTrail = trailDataRef.current.get(id) || []
      const lastPoint: [number, number] = [rep.latitud, rep.longitud]
      if (
        existingTrail.length === 0 ||
        (existingTrail[existingTrail.length - 1][0] !== lastPoint[0] ||
          existingTrail[existingTrail.length - 1][1] !== lastPoint[1])
      ) {
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
      } else {
        const marker = L.marker([rep.latitud, rep.longitud], { icon }).addTo(map)
        marker.bindTooltip(rep.nombre, {
          permanent: true,
          direction: 'top',
          offset: [0, -18],
          className: 'gps-tooltip',
        })
        marker.bindPopup(
          `<b>${rep.nombre}</b><br>
           Velocidad: ${(rep.velocidad * 3.6).toFixed(0)} km/h
           ${rep.vehiculo ? '<br>Vehículo: ' + rep.vehiculo : ''}`
        )
        markersRef.current.set(id, marker)

        const trail = L.polyline(existingTrail, {
          color: rep.color,
          weight: 4,
          opacity: 0.6,
        }).addTo(map)
        trailsRef.current.set(id, trail)
      }

      const trail = trailsRef.current.get(id)
      if (trail) trail.setLatLngs(existingTrail)
    })

    // Limpiar markers de reps eliminados
    markersRef.current.forEach((marker, id) => {
      if (!activeIds.has(id)) {
        map.removeLayer(marker)
        markersRef.current.delete(id)
        const trail = trailsRef.current.get(id)
        if (trail) { map.removeLayer(trail); trailsRef.current.delete(id) }
        trailDataRef.current.delete(id)
      }
    })

    // Auto-centrar / Seguir
    if (selectedRepId) {
      const selRep = reps.get(selectedRepId)
      if (selRep) {
        map.flyTo(
          [selRep.latitud, selRep.longitud],
          19,
          { animate: true, duration: 1 }
        )
        markersRef.current.get(selectedRepId)?.openPopup()
        onSpeedUpdate?.(selectedRepId, selRep.velocidad * 3.6)
      }
   
    } else if (markersRef.current.size > 0) {
      const bounds = L.featureGroup(Array.from(markersRef.current.values())).getBounds()
      if (!map.getBounds().contains(bounds)) {
        map.fitBounds(bounds.pad(0.2))
      }
    }
  }, [repartidores, ubicaciones, selectedRepId, siguiendo, repMap, crearIcono, onSpeedUpdate])

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
}
