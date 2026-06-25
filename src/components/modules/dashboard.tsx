'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  AlertTriangle,
  Info,
  TrendingUp,
  CalendarDays,
  AlertCircle,
  Wallet,
  Bike,
  Package,
  ShoppingCart,
  Users,
  Boxes,
  Activity,
  MapPin,
  Clock,
  Gauge,
  RefreshCw,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'

interface RepVivo {
  id: string
  nombre: string
  color: string
  vehiculo?: string | null
  ultima_velocidad_kmh: number
  ultima_actualizacion_iso: string | null
  segundos_desde_ultima: number | null
  online: boolean
  km_hoy: number
  paradas_hoy: number
  pings_hoy: number
}

interface Alerta {
  nivel: string
  modulo: string
  titulo: string
  detalle: string
}

interface StockBajoItem {
  id: string
  producto_id: string
  llenas: number
  producto?: { nombre: string } | { nombre: string }[] | null
}

interface DashboardData {
  total_ventas_hoy: number
  total_ventas_mes: number
  ventas_pendientes: number
  clientes_count: number
  productos_count: number
  stock_bajo: StockBajoItem[]
  cobrar_total: number
  pagar_total: number
  caja_hoy: { ingresos: number; egresos: number; margen: number; movimientos: number }
  ventas_7_dias: { fecha: string; dia: string; total: number; count: number }[]
  reps_en_vivo: RepVivo[]
  alertas: Alerta[]
}

const fmt$ = (n: number) => '$' + Number(n || 0).toLocaleString('es-UY')

function getProdNombre(p: StockBajoItem['producto']): string {
  if (!p) return 'Producto'
  if (Array.isArray(p)) return p[0]?.nombre || 'Producto'
  return p.nombre || 'Producto'
}

function KpiCard({
  label,
  value,
  icon: Icon,
  gradient,
  sub,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  gradient: string
  sub?: string
}) {
  return (
    <Card className={`${gradient} border-0 shadow-sm overflow-hidden`}>
      <CardContent className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground/70 uppercase tracking-wide">{label}</p>
            <p className="text-2xl md:text-3xl font-bold tracking-tight mt-1 truncate">{value}</p>
            {sub && <p className="text-[11px] text-foreground/60 mt-1">{sub}</p>}
          </div>
          <div className="rounded-lg bg-white/70 p-2 shadow-sm">
            <Icon className="size-5 text-foreground/80" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function AlertBanner({ a }: { a: Alerta }) {
  const isWarn = a.nivel === 'warn'
  const Icon = isWarn ? AlertTriangle : Info
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${
        isWarn
          ? 'border-amber-300 bg-amber-50 text-amber-900'
          : 'border-sky-200 bg-sky-50 text-sky-900'
      }`}
      role="status"
    >
      <Icon className={`size-5 shrink-0 mt-0.5 ${isWarn ? 'text-amber-600' : 'text-sky-600'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{a.titulo}</p>
        <p className="text-xs opacity-80">{a.detalle}</p>
      </div>
      <Badge variant="outline" className="capitalize text-[10px] bg-white/60">
        {a.modulo}
      </Badge>
    </div>
  )
}

function MiniStatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`rounded-lg ${color} p-2.5`}>
          <Icon className="size-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-lg font-bold truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function tiempoRelativo(segundos: number | null): string {
  if (segundos === null) return 'Sin datos'
  if (segundos < 60) return `hace ${segundos}s`
  if (segundos < 3600) return `hace ${Math.floor(segundos / 60)} min`
  return `hace ${Math.floor(segundos / 3600)} h`
}

export function DashboardModule() {
  const { toast } = useToast()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      setRefreshing(true)
      const res = await fetch('/api/dashboard', { cache: 'no-store' })
      if (!res.ok) throw new Error('Error al cargar dashboard')
      const json = await res.json()
      setData(json.data || null)
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e.message || 'No se pudo cargar el dashboard',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [toast])

  useEffect(() => {
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [load])

  const hoy = new Date()
  const hoyIso = hoy.toISOString().split('T')[0]

  const chartData = (data?.ventas_7_dias || []).map((d) => ({
    ...d,
    esHoy: d.fecha === hoyIso,
    diaCap: d.dia.charAt(0).toUpperCase() + d.dia.slice(1, 3),
  }))

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-72 rounded-xl lg:col-span-2" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground">Resumen general del negocio</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={refreshing}>
          <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Actualizar</span>
        </Button>
      </div>

      {/* Alertas */}
      {data?.alertas && data.alertas.length > 0 ? (
        <div className="space-y-2">
          {data.alertas.map((a, i) => (
            <AlertBanner key={i} a={a} />
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
          <Activity className="size-5 text-emerald-600" />
          <p className="text-sm font-medium">Todo en orden. Sin alertas activas.</p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <KpiCard
          label="Ventas Hoy"
          value={fmt$(data?.total_ventas_hoy || 0)}
          icon={TrendingUp}
          gradient="bg-gradient-to-br from-emerald-50 to-white border border-emerald-100"
          sub="Acumulado del día"
        />
        <KpiCard
          label="Ventas Mes"
          value={fmt$(data?.total_ventas_mes || 0)}
          icon={CalendarDays}
          gradient="bg-gradient-to-br from-sky-50 to-white border border-sky-100"
          sub="Mes en curso"
        />
        <KpiCard
          label="Por Cobrar"
          value={fmt$(data?.cobrar_total || 0)}
          icon={AlertCircle}
          gradient="bg-gradient-to-br from-amber-50 to-white border border-amber-100"
          sub="Cuentas pendientes"
        />
        <KpiCard
          label="Por Pagar"
          value={fmt$(data?.pagar_total || 0)}
          icon={Wallet}
          gradient="bg-gradient-to-br from-red-50 to-white border border-red-100"
          sub="A proveedores"
        />
      </div>

      {/* Charts + Reps en vivo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Ventas 7 días */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart className="size-4 text-emerald-600" />
              Ventas últimos 7 días
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">Sin datos de ventas.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="diaCap" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(v: number) => [fmt$(v), 'Total']}
                    labelFormatter={(_, p) => p?.[0]?.payload?.fecha || ''}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                  />
                  <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={56}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.esHoy ? '#10b981' : '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-emerald-500" /> Hoy
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-blue-500" /> Días anteriores
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Reps en vivo */}
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bike className="size-4 text-blue-600" />
              Reps en Vivo
              <Badge variant="outline" className="ml-auto text-[10px]">
                {data?.reps_en_vivo?.filter((r) => r.online).length || 0} online
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data?.reps_en_vivo?.length === 0 || !data?.reps_en_vivo ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No hay repartidores activos.
              </p>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto gt-scroll pr-1">
                {data.reps_en_vivo.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-lg border bg-card p-3 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="size-3 rounded-full shrink-0"
                        style={{ backgroundColor: r.color || '#3b82f6' }}
                      />
                      <p className="text-sm font-semibold truncate flex-1">{r.nombre}</p>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          r.online
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {r.online ? 'En línea' : 'Offline'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                      <div className="rounded bg-muted/50 px-1 py-1">
                        <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">
                          <MapPin className="size-3" /> km
                        </p>
                        <p className="text-xs font-semibold tabular-nums">{r.km_hoy.toFixed(1)}</p>
                      </div>
                      <div className="rounded bg-muted/50 px-1 py-1">
                        <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">
                          <Clock className="size-3" /> Paradas
                        </p>
                        <p className="text-xs font-semibold tabular-nums">{r.paradas_hoy}</p>
                      </div>
                      <div className="rounded bg-muted/50 px-1 py-1">
                        <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">
                          <Gauge className="size-3" /> km/h
                        </p>
                        <p className="text-xs font-semibold tabular-nums">
                          {r.ultima_velocidad_kmh.toFixed(0)}
                        </p>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                      <Clock className="size-3" />
                      Última: {tiempoRelativo(r.segundos_desde_ultima)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stock bajo + Ventas pendientes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Boxes className="size-4 text-amber-600" />
              Stock bajo
              <Badge variant="outline" className="ml-auto text-[10px]">
                {data?.stock_bajo?.length || 0}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data?.stock_bajo?.length === 0 || !data?.stock_bajo ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Todos los productos tienen buen stock.
              </p>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto gt-scroll pr-1">
                {data.stock_bajo.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-2 rounded border bg-amber-50/40 px-3 py-2"
                  >
                    <span className="text-sm font-medium truncate">{getProdNombre(s.producto)}</span>
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-amber-100 text-amber-800 border-amber-200"
                    >
                      {s.llenas} llenas
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="size-4 text-orange-600" />
              Ventas pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-6">
              <div className="text-center">
                <p className="text-4xl font-bold text-orange-600">
                  {data?.ventas_pendientes || 0}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  ventas con saldo pendiente de cobro
                </p>
                <p className="text-sm mt-3">
                  Total: <span className="font-semibold">{fmt$(data?.cobrar_total || 0)}</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MiniStatCard
          label="Clientes"
          value={(data?.clientes_count || 0).toLocaleString('es-UY')}
          icon={Users}
          color="bg-emerald-500"
        />
        <MiniStatCard
          label="Productos"
          value={(data?.productos_count || 0).toLocaleString('es-UY')}
          icon={Package}
          color="bg-sky-500"
        />
        <MiniStatCard
          label="Caja Hoy"
          value={fmt$(data?.caja_hoy?.margen || 0)}
          icon={Wallet}
          color="bg-violet-500"
        />
      </div>

      {/* Caja detalle */}
      <Card>
        <CardContent className="p-4 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Ingresos</p>
            <p className="text-lg font-bold text-emerald-600">
              {fmt$(data?.caja_hoy?.ingresos || 0)}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Egresos</p>
            <p className="text-lg font-bold text-red-600">{fmt$(data?.caja_hoy?.egresos || 0)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Margen</p>
            <p className="text-lg font-bold">{fmt$(data?.caja_hoy?.margen || 0)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
