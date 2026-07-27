# Módulo Rastreo GPS — Versión Mejorada

## Archivos a reemplazar

Reemplazar estos 4 archivos en tu proyecto `gaserp-main`:

| # | Archivo en este ZIP | Carpeta destino en tu proyecto |
|---|---------------------|-------------------------------|
| 1 | `components/modules/rastreo.tsx` | `src/components/modules/rastreo.tsx` |
| 2 | `components/modules/rastreo-vivo-map.tsx` | `src/components/modules/rastreo-vivo-map.tsx` |
| 3 | `components/modules/rastreo-historial-map.tsx` | `src/components/modules/rastreo-historial-map.tsx` |
| 4 | `app/api/puntos-ruta/route.ts` | `src/app/api/puntos-ruta/route.ts` |

## Migración de base de datos (Supabase)

Ejecutar en el SQL Editor de Supabase:

```
supabase-migracion-puntos-ruta.sql
```

Esto agrega la columna `descripcion` a la tabla `puntos_ruta` y habilita **Realtime** para que los puntos agregados en un navegador aparezcan automáticamente en los demás.

## Mejoras incluidas

### Bug crítico arreglado
- `rastreo-vivo-map.tsx` tenía un `useEffect` sin cerrar (faltaba `})` y `}, [deps])`), que impedía renderizar los puntos de referencia en el mapa en vivo.

### Estilo tipo Google Maps
- Pin tipo gota invertida roja (`#ea4335`) con sombra, en vez del label azul horizontal del original.
- Pin temporal azul arrastrable cuando se está creando un punto nuevo.
- Pin amarillo cuando se está editando un punto existente.

### Funcionalidades nuevas
1. **Marker temporal arrastrable** — al hacer clic en el mapa aparece un pin azul que podés arrastrar para ajustar la posición antes de guardar.
2. **Búsqueda por dirección** — input "Buscar dirección" que usa Nominatim (OpenStreetMap, gratis). Escribí "18 de Julio 1234, Rocha" y encontrás la ubicación.
3. **Edición de puntos** — botón Editar (lápiz) en cada punto guardado para cambiar nombre, descripción, coordenadas o radio.
4. **Radio ajustable** — slider de 10 a 500 metros para definir el radio de detección de "Pasa por Punto".
5. **Descripción opcional** — cada punto puede tener una descripción (notas, horarios, referencias).
6. **Confirmación al eliminar** — `window.confirm` antes de borrar un punto.
7. **Popup al hacer clic** en un punto guardado: muestra nombre, coords, radio, descripción.
8. **Toggle mostrar/ocultar puntos** — botón en el toolbar del mapa.
9. **Realtime de puntos** — cambios en `puntos_ruta` (insert/update/delete) se propagan a todos los navegadores vía Supabase Realtime.
10. **Refresco automático en Historial** — los puntos se recargan cada 30s y también al hacer clic en "Refrescar".
11. **Validaciones en la API** — coordenadas, radio, nombre obligatorio, lat/lng en rangos válidos.
12. **Puntos visitados vs no visitados** — en el mapa de historial, los puntos visitados se muestran en azul con check, los no visitados en rojo.
13. **Círculo del radio de detección** — visible alrededor de cada punto, tanto en vivo como en historial.

## Dependencias necesarias

El proyecto ya tiene todo lo necesario. Solo verificar en `package.json`:
- `leaflet` y `@types/leaflet` (ya están)
- `lucide-react` para iconos (ya está, se agregaron `Edit3`, `Save`, `MapPinned`, `Eye`, `EyeOff`, `Locate`)

Si algún icono no existe en tu versión de lucide-react, reemplazar por otro similar.

## Cómo usar

### Agregar un punto nuevo
1. En la pestaña "En Vivo", hacé clic en el mapa donde querés el punto.
2. Aparece un pin azul arrastrable + un formulario en el sidebar.
3. Escribí el nombre (obligatorio), descripción opcional, ajustá el radio con el slider.
4. Arrastrá el pin si querés afinar la posición.
5. Click en "Guardar".

### Buscar por dirección
1. En "Buscar dirección", escribí la calle + número + ciudad.
2. Enter o click en la lupa.
3. El pin azul aparece en la ubicación encontrada.

### Editar un punto
1. En la lista "Puntos Guardados", click en el ícono de lápiz.
2. O hacé clic en el pin del mapa → se abre el formulario de edición.
3. Modificá lo que quieras (incluido arrastrar coords manualmente con valores numéricos).
4. Click en "Actualizar".

### Eliminar un punto
1. Click en el ícono de tacho.
2. Confirmá en el diálogo.

### Realtime
- Si abrís dos navegadores y agregás un punto en uno, aparecerá automáticamente en el otro en 1-2 segundos.
- Para que funcione, ejecutá el script SQL que habilita Realtime en `puntos_ruta`.
