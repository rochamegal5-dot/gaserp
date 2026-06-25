'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  Wallet,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Loader2,
  DollarSign,
  Banknote,
  ArrowLeftRight,
  CreditCard,
  Plus,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  TableFooter,
} from '@/components/ui/table'
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
import { PresupuestosTab } from '@/components/modules/finanzas/presupuestos-tab'
import { CostosRepartidorTab } from '@/components/modules/finanzas/costos-repartidor-tab'
import { ImportarTab } from '@/components/modules/finanzas/importar-tab'

const fmt$ = (n: number) => '$' + Number(n || 0).toLocaleString('es-UY')

interface Deudor {
  cliente_id: string
  total_pendiente: number
  ventas_pendientes: number
  cliente?: any
  ventas?: any[]
}
interface RemitoPorPagar {
  id: string
  proveedor_id: string
  numero: string
  monto_total: number
  saldo_pendiente?: number
  pagado: boolean
  created_at: string
  proveedor?: any
}
interface CajaMov {
  id: string
  tipo: string
  concepto: string
  monto: number
  forma: string
  detalle?: string | null
  created_at: string
}
interface MesHist {
  mes: number
  nombre: string
  ingresos: number
  egresos: number
  ganancia: number
  acumulado: number
  ventas: number
  capital_entradas: number
  capital_salidas: number
}
interface CapitalMov {
  id: string
  tipo: string
  monto: number
  detalle?: string | null
  created_at: string
}

function clienteNombre(c: any): string {
  if (!c) return 'Cliente'
  if (Array.isArray(c)) c = c[0]
  if (!c) return 'Cliente'
  const parts = [c.nombre1, c.nombre2, c.apellido1, c.apellido2].filter(Boolean)
  return parts.join(' ').trim() || c.telefono || 'Sin nombre'
}
function provNombre(p: any): string {
  if (!p) return 'Proveedor'
  if (Array.isArray(p)) p = p[0]
  return p?.nombre || 'Proveedor'
}

// Cobrar Tab
function CobrarTab() {
  const { toast } = useToast()
  const [deudores, setDeudores] = useState<Deudor[]>([])
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState<Deudor | null>(null)
  const [monto, setMonto] = useState(0)
  const [forma, setForma] = useState('efectivo')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/finanzas/cobrar', { cache: 'no-store' })
      const j = await res.json()
      setDeudores(j.data || [])
    } catch {
      setDeudores([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleCobro(e: React.FormEvent) {
    e.preventDefault()
    if (!sel || monto <= 0) return
    const ok = window.confirm(`¿Registrar cobro de ${fmt$(monto)} a ${clienteNombre(sel.cliente)}?`)
    if (!ok) return
    setSaving(true)
    try {
      const res = await fetch('/api/finanzas/cobrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteId: sel.cliente_id, monto, forma }),
      })
      if (!res.ok) throw new Error('Error al registrar cobro')
      const j = await res.json()
      const resto = j.data?.vuelto || 0
      toast({
        title: 'Cobro registrado',
        description: resto > 0 ? `Aplicado. Vuelto: ${fmt$(resto)}` : 'Cuenta saldada',
      })
      setSel(null); setMonto(0)
      load()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const totalPend = deudores.reduce((s, d) => s + d.total_pendiente, 0)
  const isParcial = sel && monto > 0 && monto < sel.total_pendiente
  const isExced = sel && monto > sel.total_pendiente

  if (loading) return <Skeleton className="h-96 rounded-xl" />

  return (
    <div className="space-y-4">
      {/* Gradient cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-br from-amber-50 to-white border border-amber-100 border-0">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase text-amber-700/70 font-medium">Total por cobrar</p>
            <p className="text-2xl md:text-3xl font-bold text-amber-700">{fmt$(totalPend)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-white border border-red-100 border-0">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase text-red-700/70 font-medium">Deudores</p>
            <p className="text-2xl md:text-3xl font-bold text-red-700">{deudores.length}</p>
          </CardContent>
        </Card>
      </div>

      {deudores.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="size-12 mx-auto text-emerald-500 mb-2" />
            <p className="text-sm font-medium text-emerald-700">Sin deudas pendientes</p>
            <p className="text-xs text-muted-foreground">Todos los clientes están al día.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Clientes con deuda</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto gt-scroll pr-1">
                {deudores.map((d) => (
                  <button
                    key={d.cliente_id}
                    onClick={() => { setSel(d); setMonto(d.total_pendiente) }}
                    className={cn(
                      'w-full text-left rounded-lg border p-3 transition-all hover:shadow-sm',
                      sel?.cliente_id === d.cliente_id
                        ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
                        : 'border-input hover:bg-accent'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold truncate">{clienteNombre(d.cliente)}</p>
                      <p className="text-base font-bold text-amber-700">{fmt$(d.total_pendiente)}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {d.ventas_pendientes} venta(s) pendiente(s)
                    </p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Registrar cobro</CardTitle>
            </CardHeader>
            <CardContent>
              {!sel ? (
                <p className="text-sm text-muted-foreground text-center py-12">
                  Seleccioná un deudor para registrar un cobro.
                </p>
              ) : (
                <form onSubmit={handleCobro} className="space-y-3">
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Cliente</p>
                    <p className="text-sm font-semibold">{clienteNombre(sel.cliente)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Saldo pendiente</p>
                    <p className="text-2xl font-bold text-amber-700">
                      <span className="text-base font-normal text-muted-foreground">$</span>
                      {sel.total_pendiente.toLocaleString('es-UY')}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Monto a cobrar</Label>
                    <div className="relative">
                      <DollarSign className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="number"
                        min={0}
                        value={monto}
                        onChange={(e) => setMonto(Math.max(0, Number(e.target.value)))}
                        className="pl-9 text-lg font-semibold"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" className="flex-1"
                        onClick={() => setMonto(sel.total_pendiente)}>
                        Pago total
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="flex-1"
                        onClick={() => setMonto(Math.round(sel.total_pendiente / 2))}>
                        Mitad
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Forma de pago</Label>
                    <Select value={forma} onValueChange={setForma}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="efectivo">Efectivo</SelectItem>
                        <SelectItem value="transferencia">Transferencia</SelectItem>
                        <SelectItem value="tarjeta">Tarjeta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {isParcial && (
                    <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                      <AlertCircle className="size-3.5" />
                      Pago parcial: quedará un saldo de {fmt$(sel.total_pendiente - monto)}
                    </div>
                  )}
                  {isExced && (
                    <div className="flex items-center gap-2 text-xs text-sky-700 bg-sky-50 border border-sky-200 rounded p-2">
                      <AlertCircle className="size-3.5" />
                      Excedente: vuelto de {fmt$(monto - sel.total_pendiente)}
                    </div>
                  )}
                  <Button type="submit" disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-700">
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                    Registrar cobro
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

// Pagar Tab
function PagarTab() {
  const { toast } = useToast()
  const [items, setItems] = useState<RemitoPorPagar[]>([])
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState<RemitoPorPagar | null>(null)
  const [monto, setMonto] = useState(0)
  const [forma, setForma] = useState('efectivo')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/finanzas/pagar', { cache: 'no-store' })
      const j = await res.json()
      setItems(j.data || [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handlePago(e: React.FormEvent) {
    e.preventDefault()
    if (!sel || monto <= 0) return
    const ok = window.confirm(`¿Registrar pago de ${fmt$(monto)} a ${provNombre(sel.proveedor)}?`)
    if (!ok) return
    setSaving(true)
    try {
      const res = await fetch('/api/finanzas/pagar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remitoId: sel.id, monto, forma }),
      })
      if (!res.ok) throw new Error('Error al registrar pago')
      toast({ title: 'Pago registrado' })
      setSel(null); setMonto(0)
      load()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const totalPend = items.reduce((s, r) => s + Number(r.saldo_pendiente ?? r.monto_total ?? 0), 0)
  const isParcial = sel && monto > 0 && monto < (sel.saldo_pendiente ?? sel.monto_total)

  if (loading) return <Skeleton className="h-96 rounded-xl" />

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-br from-red-50 to-white border border-red-100 border-0">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase text-red-700/70 font-medium">Total por pagar</p>
            <p className="text-2xl md:text-3xl font-bold text-red-700">{fmt$(totalPend)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-white border border-amber-100 border-0">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase text-amber-700/70 font-medium">Remitos pend.</p>
            <p className="text-2xl md:text-3xl font-bold text-amber-700">{items.length}</p>
          </CardContent>
        </Card>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="size-12 mx-auto text-emerald-500 mb-2" />
            <p className="text-sm font-medium text-emerald-700">Sin pagos pendientes</p>
            <p className="text-xs text-muted-foreground">Todos los remitos están pagos.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Remitos por pagar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto gt-scroll pr-1">
                {items.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => { setSel(r); setMonto(Number(r.saldo_pendiente ?? r.monto_total)) }}
                    className={cn(
                      'w-full text-left rounded-lg border p-3 transition-all hover:shadow-sm',
                      sel?.id === r.id
                        ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
                        : 'border-input hover:bg-accent'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{r.numero}</p>
                        <p className="text-xs text-muted-foreground">{provNombre(r.proveedor)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-bold text-red-700">
                          {fmt$(Number(r.saldo_pendiente ?? r.monto_total))}
                        </p>
                        {r.saldo_pendiente !== undefined && r.saldo_pendiente < r.monto_total && (
                          <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-200">
                            PARCIAL
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Registrar pago</CardTitle>
            </CardHeader>
            <CardContent>
              {!sel ? (
                <p className="text-sm text-muted-foreground text-center py-12">
                  Seleccioná un remito para pagar.
                </p>
              ) : (
                <form onSubmit={handlePago} className="space-y-3">
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Remito</p>
                    <p className="text-sm font-semibold">{sel.numero}</p>
                    <p className="text-xs text-muted-foreground mt-1">{provNombre(sel.proveedor)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Saldo pendiente</p>
                    <p className="text-2xl font-bold text-red-700">
                      <span className="text-base font-normal text-muted-foreground">$</span>
                      {Number(sel.saldo_pendiente ?? sel.monto_total).toLocaleString('es-UY')}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Monto a pagar</Label>
                    <div className="relative">
                      <DollarSign className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="number"
                        min={0}
                        value={monto}
                        onChange={(e) => setMonto(Math.max(0, Number(e.target.value)))}
                        className="pl-9 text-lg font-semibold"
                      />
                    </div>
                    <Button type="button" size="sm" variant="outline" className="w-full"
                      onClick={() => setMonto(Number(sel.saldo_pendiente ?? sel.monto_total))}>
                      Pago total
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Forma de pago</Label>
                    <Select value={forma} onValueChange={setForma}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="efectivo">Efectivo</SelectItem>
                        <SelectItem value="transferencia">Transferencia</SelectItem>
                        <SelectItem value="tarjeta">Tarjeta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {isParcial && (
                    <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                      <AlertCircle className="size-3.5" />
                      Pago parcial: quedará un saldo.
                    </div>
                  )}
                  <Button type="submit" disabled={saving} className="w-full bg-red-600 hover:bg-red-700">
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                    Registrar pago
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

// Caja Tab
function CajaTab() {
  const { toast } = useToast()
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [data, setData] = useState<{ ingresos: number; egresos: number; margen: number; movimientos: CajaMov[] } | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/finanzas/caja?fecha=${fecha}`, { cache: 'no-store' })
      const j = await res.json()
      setData(j.data || null)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [fecha])

  useEffect(() => {
    load()
  }, [load])

  function formaIcon(f: string) {
    switch (f) {
      case 'efectivo': return <Banknote className="size-3" />
      case 'transferencia': return <ArrowLeftRight className="size-3" />
      case 'tarjeta': return <CreditCard className="size-3" />
      default: return <Wallet className="size-3" />
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-3 flex items-center gap-2">
          <Calendar className="size-4 text-muted-foreground" />
          <Input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="max-w-44"
          />
          <Button size="sm" variant="outline" onClick={() => setFecha(new Date().toISOString().split('T')[0])}>
            Hoy
          </Button>
          <Button size="sm" variant="ghost" onClick={load}>Actualizar</Button>
        </CardContent>
      </Card>

      {loading ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 border-0">
              <CardContent className="p-3 text-center">
                <p className="text-[11px] uppercase text-emerald-700/70">Ingresos</p>
                <p className="text-xl md:text-2xl font-bold text-emerald-700">{fmt$(data?.ingresos || 0)}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-red-50 to-white border border-red-100 border-0">
              <CardContent className="p-3 text-center">
                <p className="text-[11px] uppercase text-red-700/70">Egresos</p>
                <p className="text-xl md:text-2xl font-bold text-red-700">{fmt$(data?.egresos || 0)}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-violet-50 to-white border border-violet-100 border-0">
              <CardContent className="p-3 text-center">
                <p className="text-[11px] uppercase text-violet-700/70">Margen</p>
                <p className="text-xl md:text-2xl font-bold text-violet-700">{fmt$(data?.margen || 0)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Movimientos del día</CardTitle>
            </CardHeader>
            <CardContent>
              {data?.movimientos?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Sin movimientos este día.
                </p>
              ) : (
                <div className="max-h-[55vh] overflow-y-auto gt-scroll">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow>
                        <TableHead>Hora</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Concepto</TableHead>
                        <TableHead>Forma</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.movimientos?.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(m.created_at).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn(
                              'text-[10px]',
                              m.tipo === 'ingreso'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-red-50 text-red-700 border-red-200'
                            )}>
                              {m.tipo}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {m.concepto}
                            {m.detalle && <p className="text-[10px] text-muted-foreground truncate max-w-32">{m.detalle}</p>}
                          </TableCell>
                          <TableCell className="text-xs capitalize flex items-center gap-1">
                            {formaIcon(m.forma)} {m.forma}
                          </TableCell>
                          <TableCell className={cn(
                            'text-right font-bold',
                            m.tipo === 'ingreso' ? 'text-emerald-700' : 'text-red-700'
                          )}>
                            {m.tipo === 'ingreso' ? '+' : '-'}{fmt$(m.monto)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

// Histórico Tab
function HistoricoTab() {
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [meses, setMeses] = useState<MesHist[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/finanzas/historico?anio=${anio}`, { cache: 'no-store' })
      const j = await res.json()
      setMeses(j.data?.meses || [])
    } catch {
      setMeses([])
    } finally {
      setLoading(false)
    }
  }, [anio])

  useEffect(() => {
    load()
  }, [load])

  const totalAnio = meses.reduce((s, m) => s + m.ganancia, 0)
  const totalIng = meses.reduce((s, m) => s + m.ingresos, 0)
  const totalEgr = meses.reduce((s, m) => s + m.egresos, 0)

  const anios = [new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2]

  if (loading) return <Skeleton className="h-96 rounded-xl" />

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-3 flex items-center gap-2">
          <Calendar className="size-4 text-muted-foreground" />
          <Select value={String(anio)} onValueChange={(v) => setAnio(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {anios.map((a) => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 border-0">
          <CardContent className="p-3 text-center">
            <p className="text-[11px] uppercase text-emerald-700/70">Ingresos</p>
            <p className="text-lg md:text-xl font-bold text-emerald-700">{fmt$(totalIng)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-white border border-red-100 border-0">
          <CardContent className="p-3 text-center">
            <p className="text-[11px] uppercase text-red-700/70">Egresos</p>
            <p className="text-lg md:text-xl font-bold text-red-700">{fmt$(totalEgr)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-violet-50 to-white border border-violet-100 border-0">
          <CardContent className="p-3 text-center">
            <p className="text-[11px] uppercase text-violet-700/70">Ganancia</p>
            <p className="text-lg md:text-xl font-bold text-violet-700">{fmt$(totalAnio)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mes</TableHead>
                <TableHead className="text-right">Ingresos</TableHead>
                <TableHead className="text-right">Egresos</TableHead>
                <TableHead className="text-right">Ganancia</TableHead>
                <TableHead className="text-right">Acumulado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {meses.map((m) => (
                <TableRow key={m.mes}>
                  <TableCell className="font-medium capitalize">{m.nombre}</TableCell>
                  <TableCell className="text-right text-emerald-700">{fmt$(m.ingresos)}</TableCell>
                  <TableCell className="text-right text-red-700">{fmt$(m.egresos)}</TableCell>
                  <TableCell className={cn('text-right font-semibold', m.ganancia >= 0 ? 'text-emerald-700' : 'text-red-700')}>
                    {fmt$(m.ganancia)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{fmt$(m.acumulado)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-bold">TOTAL</TableCell>
                <TableCell className="text-right font-bold text-emerald-700">{fmt$(totalIng)}</TableCell>
                <TableCell className="text-right font-bold text-red-700">{fmt$(totalEgr)}</TableCell>
                <TableCell className="text-right font-bold">{fmt$(totalAnio)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// Capital Tab
function CapitalTab() {
  const { toast } = useToast()
  const [data, setData] = useState<{ entradas: number; salidas: number; ganancia: number; patrimonio_neto: number; movimientos: CapitalMov[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tipo, setTipo] = useState<'entrada' | 'salida'>('entrada')
  const [monto, setMonto] = useState(0)
  const [forma, setForma] = useState('efectivo')
  const [detalle, setDetalle] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/finanzas/capital', { cache: 'no-store' })
      const j = await res.json()
      setData(j.data || null)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (monto <= 0) return
    const ok = window.confirm(`¿Registrar ${tipo} de capital por ${fmt$(monto)}?`)
    if (!ok) return
    setSaving(true)
    try {
      const res = await fetch('/api/finanzas/capital', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, monto, detalle, forma }),
      })
      if (!res.ok) throw new Error('Error al registrar')
      toast({ title: 'Movimiento de capital registrado' })
      setMonto(0); setDetalle('')
      load()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Skeleton className="h-96 rounded-xl" />

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 border-0">
          <CardContent className="p-3 text-center">
            <p className="text-[11px] uppercase text-emerald-700/70">Entradas</p>
            <p className="text-lg font-bold text-emerald-700">{fmt$(data?.entradas || 0)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-white border border-red-100 border-0">
          <CardContent className="p-3 text-center">
            <p className="text-[11px] uppercase text-red-700/70">Salidas</p>
            <p className="text-lg font-bold text-red-700">{fmt$(data?.salidas || 0)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-violet-50 to-white border border-violet-100 border-0">
          <CardContent className="p-3 text-center">
            <p className="text-[11px] uppercase text-violet-700/70">Ganancia</p>
            <p className="text-lg font-bold text-violet-700">{fmt$(data?.ganancia || 0)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-white border border-amber-100 border-0">
          <CardContent className="p-3 text-center">
            <p className="text-[11px] uppercase text-amber-700/70">Patrimonio neto</p>
            <p className="text-lg font-bold text-amber-700">{fmt$(data?.patrimonio_neto || 0)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PiggyBank className="size-4 text-amber-600" /> Nuevo movimiento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" size="sm" variant={tipo === 'entrada' ? 'default' : 'outline'}
                    className={tipo === 'entrada' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                    onClick={() => setTipo('entrada')}>
                    <TrendingUp className="size-4" /> Entrada
                  </Button>
                  <Button type="button" size="sm" variant={tipo === 'salida' ? 'default' : 'outline'}
                    className={tipo === 'salida' ? 'bg-red-600 hover:bg-red-700' : ''}
                    onClick={() => setTipo('salida')}>
                    <TrendingDown className="size-4" /> Salida
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Monto</Label>
                <Input type="number" min={0} value={monto}
                  onChange={(e) => setMonto(Math.max(0, Number(e.target.value)))} />
              </div>
              <div className="space-y-1.5">
                <Label>Forma</Label>
                <Select value={forma} onValueChange={setForma}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="tarjeta">Tarjeta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Detalle</Label>
                <Input value={detalle} onChange={(e) => setDetalle(e.target.value)} />
              </div>
              <Button type="submit" disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-700">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Registrar
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historial</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-72 overflow-y-auto gt-scroll space-y-2">
              {data?.movimientos?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sin movimientos.</p>
              ) : (
                data?.movimientos?.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 rounded border p-2">
                    <div className="min-w-0">
                      <Badge variant="outline" className={cn(
                        'text-[10px]',
                        m.tipo === 'entrada'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      )}>
                        {m.tipo}
                      </Badge>
                      {m.detalle && <p className="text-xs text-muted-foreground mt-1 truncate">{m.detalle}</p>}
                      <p className="text-[10px] text-muted-foreground">{new Date(m.created_at).toLocaleString('es-UY')}</p>
                    </div>
                    <p className={cn(
                      'font-bold',
                      m.tipo === 'entrada' ? 'text-emerald-700' : 'text-red-700'
                    )}>
                      {m.tipo === 'entrada' ? '+' : '-'}{fmt$(m.monto)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Import plus icon for capital tab
// (Plus imported at top)

export function FinanzasModule() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl md:text-2xl font-bold tracking-tight">Finanzas</h2>
        <p className="text-sm text-muted-foreground">Cuentas, caja, presupuestos y reportes</p>
      </div>

      <Tabs defaultValue="cobrar" className="w-full">
        <TabsList className="grid grid-cols-4 md:grid-cols-8 w-full h-auto gap-1">
          <TabsTrigger value="cobrar" className="text-xs">Cobrar</TabsTrigger>
          <TabsTrigger value="pagar" className="text-xs">Pagar</TabsTrigger>
          <TabsTrigger value="caja" className="text-xs">Caja</TabsTrigger>
          <TabsTrigger value="presupuestos" className="text-xs">Presup.</TabsTrigger>
          <TabsTrigger value="costos" className="text-xs">Costos Reps</TabsTrigger>
          <TabsTrigger value="historico" className="text-xs">Histórico</TabsTrigger>
          <TabsTrigger value="capital" className="text-xs">Capital</TabsTrigger>
          <TabsTrigger value="importar" className="text-xs">Importar</TabsTrigger>
        </TabsList>

        <TabsContent value="cobrar" className="mt-4"><CobrarTab /></TabsContent>
        <TabsContent value="pagar" className="mt-4"><PagarTab /></TabsContent>
        <TabsContent value="caja" className="mt-4"><CajaTab /></TabsContent>
        <TabsContent value="presupuestos" className="mt-4"><PresupuestosTab /></TabsContent>
        <TabsContent value="costos" className="mt-4"><CostosRepartidorTab /></TabsContent>
        <TabsContent value="historico" className="mt-4"><HistoricoTab /></TabsContent>
        <TabsContent value="capital" className="mt-4"><CapitalTab /></TabsContent>
        <TabsContent value="importar" className="mt-4"><ImportarTab /></TabsContent>
      </Tabs>
    </div>
  )
}
