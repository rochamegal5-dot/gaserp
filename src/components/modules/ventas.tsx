'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  ShoppingCart,
  TrendingUp,
  CalendarDays,
  Plus,
  User,
  Package,
  Bike,
  CreditCard,
  Banknote,
  ArrowLeftRight,
  Clock,
  CheckCircle2,
  Loader2,
  Trash2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const fmt$ = (n: number) => '$' + Number(n || 0).toLocaleString('es-UY')

interface Cliente {
  id: string
  telefono: string
  nombre1?: string | null
  nombre2?: string | null
  apellido1?: string | null
  apellido2?: string | null
  tipo?: string
}
interface Producto {
  id: string
  nombre: string
  tipo: string
  costo: number
  precio_venta: number
  precio_comercio: number
  flete: number
}
interface Repartidor {
  id: string
  nombre: string
  color: string
}
interface Venta {
  id: string
  origen: string
  tipo_venta: string
  cliente_id?: string | null
  producto_id?: string | null
  repartidor_id?: string | null
  cantidad_llenas: number
  cantidad_vacias: number
  cantidad_defectuosas: number
  kilos_recarga: number
  total: number
  metodo_pago: string
  estado: string
  created_at: string
  cliente?: Cliente | Cliente[] | null
  producto?: Producto | Producto[] | null
  repartidor?: Repartidor | Repartidor[] | null
}

const TIPOS_VENTA = [
  { value: 'intercambio', label: 'Intercambio' },
  { value: 'venta_llena', label: 'Venta Llena' },
  { value: 'recarga', label: 'Recarga' },
  { value: 'recarga_variable', label: 'Recarga Variable' },
]
const METODOS_PAGO = [
  { value: 'efectivo', label: 'Efectivo', icon: Banknote },
  { value: 'transferencia', label: 'Transferencia', icon: ArrowLeftRight },
  { value: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
  { value: 'fiado', label: 'Fiado', icon: Clock },
]

function clienteNombre(c: Cliente | Cliente[] | null | undefined): string {
  if (!c) return 'Consumidor final'
  const cli = Array.isArray(c) ? c[0] : c
  if (!cli) return 'Consumidor final'
  const parts = [cli.nombre1, cli.nombre2, cli.apellido1, cli.apellido2].filter(Boolean)
  return parts.join(' ').trim() || cli.telefono || 'Sin nombre'
}

function prodNombre(p: Producto | Producto[] | null | undefined): string {
  if (!p) return '—'
  const pr = Array.isArray(p) ? p[0] : p
  return pr?.nombre || '—'
}

function repNombre(r: Repartidor | Repartidor[] | null | undefined): string {
  if (!r) return '—'
  const rp = Array.isArray(r) ? r[0] : r
  return rp?.nombre || '—'
}

function metodoBadgeClass(m: string): string {
  switch (m) {
    case 'efectivo':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'transferencia':
      return 'bg-sky-50 text-sky-700 border-sky-200'
    case 'tarjeta':
      return 'bg-violet-50 text-violet-700 border-violet-200'
    case 'fiado':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

export function VentasModule() {
  const { toast } = useToast()
  const [ventas, setVentas] = useState<Venta[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [repartidores, setRepartidores] = useState<Repartidor[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state
  const [clienteId, setClienteId] = useState('')
  const [productoId, setProductoId] = useState('')
  const [repartidorId, setRepartidorId] = useState('')
  const [tipoVenta, setTipoVenta] = useState('intercambio')
  const [cantLlenas, setCantLlenas] = useState(0)
  const [cantVacias, setCantVacias] = useState(0)
  const [cantDefect, setCantDefect] = useState(0)
  const [kilosRecarga, setKilosRecarga] = useState(0)
  const [metodoPago, setMetodoPago] = useState('efectivo')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [v, c, p, r] = await Promise.all([
        fetch('/api/ventas', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/clientes', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/productos', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/repartidores', { cache: 'no-store' }).then((r) => r.json()),
      ])
      setVentas(v.data || [])
      setClientes(c.data || [])
      setProductos(p.data || [])
      setRepartidores(r.data || [])
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const clienteSel = useMemo(
    () => clientes.find((c) => c.id === clienteId),
    [clientes, clienteId]
  )
  const productoSel = useMemo(
    () => productos.find((p) => p.id === productoId),
    [productos, productoId]
  )

  const total = useMemo(() => {
    if (!productoSel) return 0
    const esComercio = clienteSel?.tipo === 'comercio'
    const precioBase = esComercio
      ? productoSel.precio_comercio || productoSel.precio_venta
      : productoSel.precio_venta
    if (tipoVenta === 'recarga_variable' && kilosRecarga > 0) {
      // Precio por kilo = precioVenta / 11 (approx de tubo 11kg)
      const precioPorKilo = productoSel.precio_venta / 11
      return Math.round(precioPorKilo * kilosRecarga)
    }
    if (tipoVenta === 'recarga' && kilosRecarga > 0) {
      return precioBase * Math.ceil(kilosRecarga / 11)
    }
    return cantLlenas * precioBase
  }, [productoSel, clienteSel, tipoVenta, kilosRecarga, cantLlenas])

  const estadoAuto = metodoPago === 'fiado' ? 'Pendiente' : 'Cobrado'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!productoId) {
      toast({ title: 'Falta producto', description: 'Seleccioná un producto', variant: 'destructive' })
      return
    }
    if (
      tipoVenta !== 'recarga' &&
      tipoVenta !== 'recarga_variable' &&
      cantLlenas === 0 &&
      cantVacias === 0 &&
      cantDefect === 0
    ) {
      toast({ title: 'Faltan cantidades', description: 'Ingresá al menos una cantidad', variant: 'destructive' })
      return
    }
    if ((tipoVenta === 'recarga' || tipoVenta === 'recarga_variable') && kilosRecarga <= 0) {
      toast({ title: 'Faltan kilos', description: 'Ingresá los kilos de recarga', variant: 'destructive' })
      return
    }
    const ok = window.confirm(
      `¿Confirmar venta por ${fmt$(total)} (${metodoPago} - ${estadoAuto})?`
    )
    if (!ok) return

    setSaving(true)
    try {
      const res = await fetch('/api/ventas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId: clienteId || null,
          productoId,
          repartidorId: repartidorId || null,
          tipoVenta,
          cantidadLlenas: cantLlenas,
          cantidadVacias: cantVacias,
          cantidadDefectuosas: cantDefect,
          kilosRecarga,
          metodoPago,
          total,
          estado: estadoAuto,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Error al guardar venta')
      }
      toast({
        title: 'Venta registrada',
        description: `Total: ${fmt$(total)} · ${estadoAuto}`,
      })
      // Reset form
      setCantLlenas(0)
      setCantVacias(0)
      setCantDefect(0)
      setKilosRecarga(0)
      setMetodoPago('efectivo')
      setTipoVenta('intercambio')
      load()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // Resumen
  const hoyStr = new Date().toISOString().split('T')[0]
  const mesStr = hoyStr.slice(0, 7)
  const ventasHoy = ventas.filter((v) => (v.created_at || '').startsWith(hoyStr))
  const totalHoy = ventasHoy.reduce((s, v) => s + Number(v.total || 0), 0)
  const ventasMes = ventas.filter((v) => (v.created_at || '').startsWith(mesStr))
  const totalMes = ventasMes.reduce((s, v) => s + Number(v.total || 0), 0)

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl md:text-2xl font-bold tracking-tight">Ventas</h2>
        <p className="text-sm text-muted-foreground">Registrar y listar ventas del día</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <Card className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 border-0 shadow-sm">
          <CardContent className="p-4 md:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-foreground/70 uppercase">Ventas Hoy</p>
              <p className="text-2xl md:text-3xl font-bold tracking-tight mt-1">{fmt$(totalHoy)}</p>
              <p className="text-[11px] text-foreground/60 mt-1">{ventasHoy.length} ventas</p>
            </div>
            <div className="rounded-lg bg-white/70 p-2 shadow-sm">
              <TrendingUp className="size-5 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-sky-50 to-white border border-sky-100 border-0 shadow-sm">
          <CardContent className="p-4 md:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-foreground/70 uppercase">Ventas Mes</p>
              <p className="text-2xl md:text-3xl font-bold tracking-tight mt-1">{fmt$(totalMes)}</p>
              <p className="text-[11px] text-foreground/60 mt-1">{ventasMes.length} ventas</p>
            </div>
            <div className="rounded-lg bg-white/70 p-2 shadow-sm">
              <CalendarDays className="size-5 text-sky-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="size-4 text-emerald-600" />
            Nueva venta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><User className="size-3.5" /> Cliente</Label>
              <Select value={clienteId || '__cf__'} onValueChange={(v) => setClienteId(v === '__cf__' ? '' : v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__cf__">Consumidor final</SelectItem>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {clienteNombre(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {clienteSel?.tipo === 'comercio' && (
                <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-700 border-sky-200">
                  Precio comercio aplicado
                </Badge>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Package className="size-3.5" /> Producto</Label>
              <Select value={productoId} onValueChange={setProductoId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {productos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre} · ${p.precio_venta.toLocaleString('es-UY')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Bike className="size-3.5" /> Repartidor</Label>
              <Select value={repartidorId || '__nr__'} onValueChange={(v) => setRepartidorId(v === '__nr__' ? '' : v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__nr__">Sin repartidor</SelectItem>
                  {repartidores.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      <span className="flex items-center gap-2">
                        <span className="size-2 rounded-full" style={{ background: r.color }} />
                        {r.nombre}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Tipo de venta</Label>
              <Select value={tipoVenta} onValueChange={setTipoVenta}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_VENTA.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Método de pago</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {METODOS_PAGO.map((m) => {
                  const Icon = m.icon
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setMetodoPago(m.value)}
                      className={cn(
                        'flex flex-col items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-[10px] font-medium transition-all',
                        metodoPago === m.value
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-input bg-background hover:bg-accent'
                      )}
                    >
                      <Icon className="size-4" />
                      {m.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Total calculado</Label>
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                <p className="text-2xl font-bold text-emerald-700">{fmt$(total)}</p>
                <p className="text-[11px] text-emerald-600/70">Estado: {estadoAuto}</p>
              </div>
            </div>

            {/* Cantidades */}
            {tipoVenta !== 'recarga' && tipoVenta !== 'recarga_variable' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-emerald-700">Llenas</Label>
                  <Input
                    type="number"
                    min={0}
                    value={cantLlenas}
                    onChange={(e) => setCantLlenas(Math.max(0, Number(e.target.value)))}
                    className="border-emerald-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sky-700">Vacías</Label>
                  <Input
                    type="number"
                    min={0}
                    value={cantVacias}
                    onChange={(e) => setCantVacias(Math.max(0, Number(e.target.value)))}
                    className="border-sky-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-amber-700">Defectuosas</Label>
                  <Input
                    type="number"
                    min={0}
                    value={cantDefect}
                    onChange={(e) => setCantDefect(Math.max(0, Number(e.target.value)))}
                    className="border-amber-200"
                  />
                </div>
              </>
            )}

            {(tipoVenta === 'recarga' || tipoVenta === 'recarga_variable') && (
              <div className="space-y-1.5 md:col-span-2 lg:col-span-3">
                <Label className="text-orange-700">Kilos de recarga</Label>
                <div className="flex gap-2 flex-wrap">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={kilosRecarga}
                    onChange={(e) => setKilosRecarga(Math.max(0, Number(e.target.value)))}
                    className="border-orange-200 max-w-32"
                  />
                  {[10.75, 21.5, 43].map((k) => (
                    <Button
                      key={k}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setKilosRecarga(k)}
                    >
                      {k} kg
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="md:col-span-2 lg:col-span-3 flex justify-end gap-2 pt-2 border-t">
              <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Registrar venta
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Recent sales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="size-4 text-emerald-600" />
            Ventas recientes
            <Badge variant="outline" className="ml-auto text-[10px]">{ventas.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ventas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aún no hay ventas registradas.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto gt-scroll pr-1">
              {ventas.slice(0, 50).map((v) => {
                const esPend = v.estado === 'Pendiente'
                return (
                  <div
                    key={v.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border bg-card p-3 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold truncate">
                          {clienteNombre(v.cliente)}
                        </p>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {v.tipo_venta.replace('_', ' ')}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn('text-[10px] capitalize', metodoBadgeClass(v.metodo_pago))}
                        >
                          {v.metodo_pago}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px]',
                            esPend
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          )}
                        >
                          {esPend ? (
                            <>
                              <Clock className="size-3" /> {v.estado}
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="size-3" /> {v.estado}
                            </>
                          )}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {prodNombre(v.producto)} · {v.cantidad_llenas} llenas · Rep: {repNombre(v.repartidor)}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(v.created_at).toLocaleString('es-UY')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{fmt$(v.total)}</p>
                      {esPend && (
                        <p className="text-[10px] text-amber-600">
                          Saldo: {fmt$(v.total)}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
