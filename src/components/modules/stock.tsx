'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  Boxes,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  Bike,
  History,
  Fuel,
  Search,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Plus,
  Minus,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface Producto {
  id: string
  nombre: string
  tipo: string
}
interface StockDep {
  id: string
  producto_id: string
  llenas: number
  vacias: number
  defectuosas: number
  producto?: Producto | Producto[] | null
}
interface Repartidor {
  id: string
  nombre: string
  color: string
  vehiculo?: string | null
  patente?: string | null
}
interface StockRep {
  id: string
  repartidor_id: string
  producto_id: string
  llenas: number
  vacias: number
  defectuosas: number
  producto?: Producto | Producto[] | null
}
interface Movimiento {
  id: string
  tipo_mov: string
  producto_id?: string | null
  repartidor_id?: string | null
  llenas: number
  vacias: number
  defectuosas: number
  kilos_gas: number
  observaciones?: string | null
  created_at: string
  producto?: Producto | Producto[] | null
  repartidor?: Repartidor | Repartidor[] | null
}

const fmt$ = (n: number) => '$' + Number(n || 0).toLocaleString('es-UY')

function prodNombre(p: Producto | Producto[] | null | undefined): string {
  if (!p) return '—'
  return (Array.isArray(p) ? p[0] : p)?.nombre || '—'
}
function repNombre(r: Repartidor | Repartidor[] | null | undefined): string {
  if (!r) return '—'
  return (Array.isArray(r) ? r[0] : r)?.nombre || '—'
}

function statusLlenas(n: number): { label: string; cls: string } {
  if (n < 5) return { label: 'Bajo', cls: 'bg-red-50 text-red-700 border-red-200' }
  if (n < 15) return { label: 'Medio', cls: 'bg-amber-50 text-amber-700 border-amber-200' }
  return { label: 'OK', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
}

function tipoMovBadge(t: string): { label: string; cls: string } {
  const map: Record<string, { label: string; cls: string }> = {
    carga_deposito: { label: 'Carga depósito', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    descarga_deposito: { label: 'Descarga depósito', cls: 'bg-red-50 text-red-700 border-red-200' },
    venta: { label: 'Venta', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
    recarga: { label: 'Recarga', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
    remito: { label: 'Remito', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
    tubo_recarga: { label: 'Recarga tubo', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    cierre_jornada: { label: 'Cierre jornada', cls: 'bg-muted text-muted-foreground' },
  }
  return map[t] || { label: t, cls: 'bg-muted text-muted-foreground' }
}

export function StockModule() {
  const { toast } = useToast()
  const [stockDep, setStockDep] = useState<StockDep[]>([])
  const [stockRep, setStockRep] = useState<StockRep[]>([])
  const [reps, setReps] = useState<Repartidor[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [movs, setMovs] = useState<Movimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Forms
  const [cargaProdId, setCargaProdId] = useState('')
  const [cargaLlenas, setCargaLlenas] = useState(0)
  const [cargaVacias, setCargaVacias] = useState(0)
  const [cargaDefect, setCargaDefect] = useState(0)
  const [cargaKilos, setCargaKilos] = useState(0)
  const [cargaObs, setCargaObs] = useState('')
  const [cargaTipo, setCargaTipo] = useState<'carga' | 'descarga'>('carga')

  const [repSel, setRepSel] = useState('')
  const [tuboProdId, setTuboProdId] = useState('')
  const [tuboKilos, setTuboKilos] = useState(0)
  const [tuboDetalle, setTuboDetalle] = useState('Recarga tubo')

  const [searchDep, setSearchDep] = useState('')
  const [searchMov, setSearchMov] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, sr, r, p, m] = await Promise.all([
        fetch('/api/stock', { cache: 'no-store' }).then((x) => x.json()),
        fetch('/api/stock/repartidor', { cache: 'no-store' }).then((x) => x.json()),
        fetch('/api/repartidores', { cache: 'no-store' }).then((x) => x.json()),
        fetch('/api/productos', { cache: 'no-store' }).then((x) => x.json()),
        fetch('/api/stock/movimientos', { cache: 'no-store' }).then((x) => x.json()),
      ])
      setStockDep(s.data || [])
      setStockRep(sr.data || [])
      setReps(r.data || [])
      setProductos(p.data || [])
      setMovs(m.data || [])
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    let active = true
    const init = async () => { if (active) await load() }
    init()
    return () => { active = false }
  }, [load])

  // Summary deposito
  const totalesDep = useMemo(() => {
    return stockDep.reduce(
      (acc, s) => ({
        llenas: acc.llenas + (s.llenas || 0),
        vacias: acc.vacias + (s.vacias || 0),
        defect: acc.defect + (s.defectuosas || 0),
      }),
      { llenas: 0, vacias: 0, defect: 0 }
    )
  }, [stockDep])

  const stockBajo = stockDep.filter((s) => s.llenas < 5)
  const filteredDep = useMemo(() => {
    const s = searchDep.trim().toLowerCase()
    if (!s) return stockDep
    return stockDep.filter((d) => prodNombre(d.producto).toLowerCase().includes(s))
  }, [stockDep, searchDep])

  const filteredMovs = useMemo(() => {
    const s = searchMov.trim().toLowerCase()
    if (!s) return movs
    return movs.filter(
      (m) =>
        prodNombre(m.producto).toLowerCase().includes(s) ||
        repNombre(m.repartidor).toLowerCase().includes(s) ||
        (m.observaciones || '').toLowerCase().includes(s) ||
        m.tipo_mov.toLowerCase().includes(s)
    )
  }, [movs, searchMov])

  const stockRepSel = useMemo(
    () => stockRep.filter((s) => s.repartidor_id === repSel),
    [stockRep, repSel]
  )

  async function handleCargaDescarga(e: React.FormEvent) {
    e.preventDefault()
    if (!cargaProdId) {
      toast({ title: 'Seleccioná producto', variant: 'destructive' })
      return
    }
    const url = cargaTipo === 'carga' ? '/api/stock/carga' : '/api/stock/descarga'
    const body = {
      productoId: cargaProdId,
      llenas: cargaLlenas,
      vacias: cargaVacias,
      defectuosas: cargaDefect,
      kilos: cargaKilos,
      observaciones: cargaObs || (cargaTipo === 'carga' ? 'Carga depósito' : 'Descarga depósito'),
    }
    const ok = window.confirm(
      `${cargaTipo === 'carga' ? 'Cargar' : 'Descargar'} ${cargaLlenas} llenas, ${cargaVacias} vacías, ${cargaDefect} defectuosas?`
    )
    if (!ok) return
    setSaving(true)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Error al registrar movimiento')
      toast({ title: cargaTipo === 'carga' ? 'Carga registrada' : 'Descarga registrada' })
      setCargaLlenas(0); setCargaVacias(0); setCargaDefect(0); setCargaKilos(0); setCargaObs('')
      load()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleTuboRecarga(e: React.FormEvent) {
    e.preventDefault()
    if (!repSel || !tuboProdId || tuboKilos <= 0) {
      toast({ title: 'Faltan datos', description: 'Seleccioná repartidor, producto y kilos', variant: 'destructive' })
      return
    }
    const ok = window.confirm(`Registrar recarga de tubo: ${tuboKilos} kg?`)
    if (!ok) return
    setSaving(true)
    try {
      const res = await fetch('/api/stock/tubo-recarga', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repartidorId: repSel,
          productoId: tuboProdId,
          kilos: tuboKilos,
          detalle: tuboDetalle,
        }),
      })
      if (!res.ok) throw new Error('Error al registrar recarga')
      toast({ title: 'Recarga de tubo registrada' })
      setTuboKilos(0)
      load()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleCerrarJornada(repId: string, repName: string) {
    const ok = window.confirm(`¿Cerrar jornada de ${repName}? El stock vuelve al depósito.`)
    if (!ok) return
    try {
      const res = await fetch('/api/stock/cierre', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repartidorId: repId }),
      })
      if (!res.ok) throw new Error('Error al cerrar jornada')
      toast({ title: 'Jornada cerrada', description: 'Stock devuelto al depósito' })
      load()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl md:text-2xl font-bold tracking-tight">Stock</h2>
        <p className="text-sm text-muted-foreground">Gestión de inventario en depósito y camionetas</p>
      </div>

      <Tabs defaultValue="deposito" className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full h-auto">
          <TabsTrigger value="deposito" className="flex items-center gap-1.5">
            <Boxes className="size-4" /> Depósito
          </TabsTrigger>
          <TabsTrigger value="camionetas" className="flex items-center gap-1.5">
            <Bike className="size-4" /> Camionetas
          </TabsTrigger>
          <TabsTrigger value="movimientos" className="flex items-center gap-1.5">
            <History className="size-4" /> Movimientos
          </TabsTrigger>
          <TabsTrigger value="tubo" className="flex items-center gap-1.5">
            <Fuel className="size-4" /> Recarga Tubo
          </TabsTrigger>
        </TabsList>

        {/* Depósito */}
        <TabsContent value="deposito" className="space-y-4">
          {/* Gradient summary */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 border-0">
              <CardContent className="p-4 text-center">
                <p className="text-[11px] uppercase text-emerald-700/70 font-medium">Llenas</p>
                <p className="text-2xl md:text-3xl font-bold text-emerald-700">{totalesDep.llenas}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-sky-50 to-white border border-sky-100 border-0">
              <CardContent className="p-4 text-center">
                <p className="text-[11px] uppercase text-sky-700/70 font-medium">Vacías</p>
                <p className="text-2xl md:text-3xl font-bold text-sky-700">{totalesDep.vacias}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-amber-50 to-white border border-amber-100 border-0">
              <CardContent className="p-4 text-center">
                <p className="text-[11px] uppercase text-amber-700/70 font-medium">Defectuosas</p>
                <p className="text-2xl md:text-3xl font-bold text-amber-700">{totalesDep.defect}</p>
              </CardContent>
            </Card>
          </div>

          {/* Stock bajo alert */}
          {stockBajo.length > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-900">
              <AlertTriangle className="size-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">Stock bajo</p>
                <p className="text-xs">
                  {stockBajo.length} producto(s) con menos de 5 unidades llenas:{' '}
                  {stockBajo.map((s) => `${prodNombre(s.producto)} (${s.llenas})`).join(', ')}
                </p>
              </div>
            </div>
          )}

          {/* Carga/Descarga form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {cargaTipo === 'carga' ? (
                  <ArrowDownToLine className="size-4 text-emerald-600" />
                ) : (
                  <ArrowUpFromLine className="size-4 text-red-600" />
                )}
                {cargaTipo === 'carga' ? 'Cargar al depósito' : 'Descargar del depósito'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCargaDescarga} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                <div className="space-y-1.5 md:col-span-1 lg:col-span-1">
                  <Label>Producto</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={cargaProdId}
                    onChange={(e) => setCargaProdId(e.target.value)}
                  >
                    <option value="">Seleccionar...</option>
                    {productos.map((p) => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-emerald-700">Llenas</Label>
                  <Input type="number" min={0} value={cargaLlenas}
                    onChange={(e) => setCargaLlenas(Math.max(0, Number(e.target.value)))}
                    className="border-emerald-200" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sky-700">Vacías</Label>
                  <Input type="number" min={0} value={cargaVacias}
                    onChange={(e) => setCargaVacias(Math.max(0, Number(e.target.value)))}
                    className="border-sky-200" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-amber-700">Defectuosas</Label>
                  <Input type="number" min={0} value={cargaDefect}
                    onChange={(e) => setCargaDefect(Math.max(0, Number(e.target.value)))}
                    className="border-amber-200" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-orange-700">Kilos</Label>
                  <Input type="number" min={0} step="0.01" value={cargaKilos}
                    onChange={(e) => setCargaKilos(Math.max(0, Number(e.target.value)))}
                    className="border-orange-200" />
                </div>
                <div className="space-y-1.5 md:col-span-1">
                  <Label>Observaciones</Label>
                  <Input value={cargaObs} onChange={(e) => setCargaObs(e.target.value)} placeholder="Opcional" />
                </div>
                <div className="space-y-1.5">
                  <Label>Acción</Label>
                  <div className="flex gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant={cargaTipo === 'carga' ? 'default' : 'outline'}
                      className={cargaTipo === 'carga' ? 'bg-emerald-600 hover:bg-emerald-700 flex-1' : 'flex-1'}
                      onClick={() => setCargaTipo('carga')}
                    >
                      <Plus className="size-3.5" /> Cargar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={cargaTipo === 'descarga' ? 'default' : 'outline'}
                      className={cargaTipo === 'descarga' ? 'bg-red-600 hover:bg-red-700 flex-1' : 'flex-1'}
                      onClick={() => setCargaTipo('descarga')}
                    >
                      <Minus className="size-3.5" /> Descargar
                    </Button>
                  </div>
                </div>
                <div className="flex items-end">
                  <Button type="submit" disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-700">
                    {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                    Confirmar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">Inventario depósito</CardTitle>
                <div className="relative">
                  <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={searchDep}
                    onChange={(e) => setSearchDep(e.target.value)}
                    className="pl-8 h-8 w-40 sm:w-56"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-center">Llenas</TableHead>
                    <TableHead className="text-center">Vacías</TableHead>
                    <TableHead className="text-center">Defect.</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDep.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                        Sin productos en stock.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDep.map((s) => {
                      const st = statusLlenas(s.llenas)
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{prodNombre(s.producto)}</TableCell>
                          <TableCell className="text-center font-semibold text-emerald-700">{s.llenas}</TableCell>
                          <TableCell className="text-center text-sky-700">{s.vacias}</TableCell>
                          <TableCell className="text-center text-amber-700">{s.defectuosas}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={cn('text-[10px]', st.cls)}>
                              {st.label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Camionetas */}
        <TabsContent value="camionetas" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {reps.length === 0 ? (
              <p className="col-span-full text-sm text-muted-foreground text-center py-6">
                No hay repartidores.
              </p>
            ) : (
              reps.map((r) => {
                const isSelected = repSel === r.id
                return (
                  <Card
                    key={r.id}
                    className={cn(
                      'cursor-pointer hover:shadow-md transition-all border-l-4',
                      isSelected && 'ring-2 ring-offset-1'
                    )}
                    style={{ borderLeftColor: r.color }}
                    onClick={() => setRepSel(r.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="size-3 rounded-full" style={{ background: r.color }} />
                        <p className="text-sm font-semibold truncate flex-1">{r.nombre}</p>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {r.vehiculo || 'Sin vehículo'} {r.patente ? `· ${r.patente}` : ''}
                      </p>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>

          {repSel && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Stock de {reps.find((r) => r.id === repSel)?.nombre}
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCerrarJornada(repSel, reps.find((r) => r.id === repSel)?.nombre || '')}
                  >
                    Cerrar jornada
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-center">Llenas</TableHead>
                      <TableHead className="text-center">Vacías</TableHead>
                      <TableHead className="text-center">Defect.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockRepSel.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                          Sin stock asignado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      stockRepSel.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{prodNombre(s.producto)}</TableCell>
                          <TableCell className="text-center font-semibold text-emerald-700">{s.llenas}</TableCell>
                          <TableCell className="text-center text-sky-700">{s.vacias}</TableCell>
                          <TableCell className="text-center text-amber-700">{s.defectuosas}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Movimientos */}
        <TabsContent value="movimientos" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">Historial de movimientos</CardTitle>
                <div className="relative">
                  <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={searchMov}
                    onChange={(e) => setSearchMov(e.target.value)}
                    className="pl-8 h-8 w-40 sm:w-56"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-[60vh] overflow-y-auto gt-scroll">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Repartidor</TableHead>
                      <TableHead className="text-center">Llenas</TableHead>
                      <TableHead className="text-center">Kilos</TableHead>
                      <TableHead>Obs.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMovs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                          Sin movimientos.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredMovs.slice(0, 200).map((m) => {
                        const tb = tipoMovBadge(m.tipo_mov)
                        const pos = m.llenas > 0
                        return (
                          <TableRow key={m.id}>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(m.created_at).toLocaleString('es-UY')}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn('text-[10px]', tb.cls)}>
                                {tb.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{prodNombre(m.producto)}</TableCell>
                            <TableCell className="text-sm">{repNombre(m.repartidor)}</TableCell>
                            <TableCell className={cn('text-center font-semibold', pos ? 'text-emerald-700' : 'text-red-700')}>
                              {m.llenas > 0 ? '+' : ''}{m.llenas}
                            </TableCell>
                            <TableCell className="text-center text-sm">{m.kilos_gas || '—'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-32 truncate">
                              {m.observaciones || '—'}
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tubo Recarga */}
        <TabsContent value="tubo" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Fuel className="size-4 text-orange-600" />
                Recarga de tubo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <p className="text-sm font-medium">Seleccionar repartidor</p>
                  <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto gt-scroll pr-1">
                    {reps.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setRepSel(r.id)}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border p-2.5 text-left text-sm transition-all',
                          repSel === r.id
                            ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
                            : 'border-input hover:bg-accent'
                        )}
                        style={repSel === r.id ? { borderLeftColor: r.color, borderLeftWidth: '4px' } : {}}
                      >
                        <span className="size-3 rounded-full shrink-0" style={{ background: r.color }} />
                        <span className="truncate">{r.nombre}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <form onSubmit={handleTuboRecarga} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Producto</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                      value={tuboProdId}
                      onChange={(e) => setTuboProdId(e.target.value)}
                    >
                      <option value="">Seleccionar...</option>
                      {productos.map((p) => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-orange-700">Kilos a recargar</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={tuboKilos}
                      onChange={(e) => setTuboKilos(Math.max(0, Number(e.target.value)))}
                      className="border-orange-200"
                    />
                    <div className="flex gap-2 flex-wrap">
                      {[10.75, 21.5, 43].map((k) => (
                        <Button
                          key={k}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setTuboKilos(k)}
                        >
                          {k} kg
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Detalle</Label>
                    <Input value={tuboDetalle} onChange={(e) => setTuboDetalle(e.target.value)} />
                  </div>
                  <Button type="submit" disabled={saving} className="w-full bg-orange-600 hover:bg-orange-700">
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <Fuel className="size-4" />}
                    Registrar recarga
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Hidden Select placeholder to satisfy import usage */}
      <div className="hidden">
        <Select value="" onValueChange={() => {}}>
          <SelectTrigger><SelectValue placeholder="" /></SelectTrigger>
          <SelectContent />
        </Select>
      </div>
    </div>
  )
}
