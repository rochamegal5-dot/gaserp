'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  FileText,
  Plus,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const fmt$ = (n: number) => '$' + Number(n || 0).toLocaleString('es-UY')

interface Proveedor {
  id: string
  nombre: string
}
interface Producto {
  id: string
  nombre: string
}
interface RemitoItem {
  id: string
  producto_id: string
  entran_llenas: number
  salen_vacias: number
  salen_defectuosas: number
  producto?: Producto | Producto[] | null
}
interface Remito {
  id: string
  proveedor_id: string
  numero: string
  monto_total: number
  saldo_pendiente?: number
  pagado: boolean
  fecha_pago?: string | null
  created_at: string
  proveedor?: Proveedor | Proveedor[] | null
  items?: RemitoItem[]
}

function provNombre(p: Proveedor | Proveedor[] | null | undefined): string {
  if (!p) return '—'
  return (Array.isArray(p) ? p[0] : p)?.nombre || '—'
}
function prodNombre(p: Producto | Producto[] | null | undefined): string {
  if (!p) return '—'
  return (Array.isArray(p) ? p[0] : p)?.nombre || '—'
}

interface ItemForm {
  productoId: string
  entranLlenas: number
  salenVacias: number
  salenDefectuosas: number
}

export function RemitosModule() {
  const { toast } = useToast()
  const [remitos, setRemitos] = useState<Remito[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [provId, setProvId] = useState('')
  const [numero, setNumero] = useState('')
  const [montoTotal, setMontoTotal] = useState(0)
  const [pagado, setPagado] = useState(false)
  const [items, setItems] = useState<ItemForm[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [r, p, pr] = await Promise.all([
        fetch('/api/remitos', { cache: 'no-store' }).then((x) => x.json()),
        fetch('/api/proveedores', { cache: 'no-store' }).then((x) => x.json()),
        fetch('/api/productos', { cache: 'no-store' }).then((x) => x.json()),
      ])
      setRemitos(r.data || [])
      setProveedores(p.data || [])
      setProductos(pr.data || [])
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const stats = useMemo(() => {
    const pend = remitos.filter((r) => !r.pagado)
    const pag = remitos.filter((r) => r.pagado)
    const totalPend = pend.reduce((s, r) => s + Number(r.saldo_pendiente ?? r.monto_total ?? 0), 0)
    const totalPag = pag.reduce((s, r) => s + Number(r.monto_total ?? 0), 0)
    return { pendCount: pend.length, pagCount: pag.length, totalPend, totalPag }
  }, [remitos])

  function addItem() {
    setItems([...items, { productoId: '', entranLlenas: 0, salenVacias: 0, salenDefectuosas: 0 }])
  }
  function updateItem(idx: number, patch: Partial<ItemForm>) {
    setItems(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }
  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx))
  }

  function resetForm() {
    setProvId(''); setNumero(''); setMontoTotal(0); setPagado(false); setItems([])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!provId || montoTotal <= 0) {
      toast({ title: 'Faltan datos', description: 'Proveedor y monto son obligatorios', variant: 'destructive' })
      return
    }
    const ok = window.confirm(`¿Crear remito ${numero || 'auto'} por ${fmt$(montoTotal)}?`)
    if (!ok) return
    setSaving(true)
    try {
      const res = await fetch('/api/remitos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proveedorId: provId,
          numero: numero || undefined,
          montoTotal,
          pagado,
          items: items.map((it) => ({
            productoId: it.productoId,
            entranLlenas: it.entranLlenas,
            salenVacias: it.salenVacias,
            salenDefectuosas: it.salenDefectuosas,
          })),
        }),
      })
      if (!res.ok) throw new Error('Error al crear remito')
      toast({ title: 'Remito creado' })
      setShowForm(false)
      resetForm()
      load()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">Remitos</h2>
          <p className="text-sm text-muted-foreground">Compras a proveedores y saldos</p>
        </div>
        <Button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="size-4" /> Nuevo remito
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <Card className="bg-gradient-to-br from-amber-50 to-white border border-amber-100 border-0">
          <CardContent className="p-4 md:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-foreground/70 uppercase">Pendientes</p>
              <p className="text-2xl md:text-3xl font-bold text-amber-700">{stats.pendCount}</p>
              <p className="text-[11px] text-foreground/60 mt-1">{fmt$(stats.totalPend)}</p>
            </div>
            <Clock className="size-8 text-amber-500/50" />
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 border-0">
          <CardContent className="p-4 md:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-foreground/70 uppercase">Pagados</p>
              <p className="text-2xl md:text-3xl font-bold text-emerald-700">{stats.pagCount}</p>
              <p className="text-[11px] text-foreground/60 mt-1">{fmt$(stats.totalPag)}</p>
            </div>
            <CheckCircle2 className="size-8 text-emerald-500/50" />
          </CardContent>
        </Card>
      </div>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="size-4 text-emerald-600" /> Remitos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {remitos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No hay remitos.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto gt-scroll pr-1">
              {remitos.map((r) => {
                const saldo = Number(r.saldo_pendiente ?? r.monto_total ?? 0)
                return (
                  <div key={r.id} className="rounded-lg border bg-card p-3 hover:shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold">{r.numero}</p>
                          <Badge variant="outline" className="text-[10px]">
                            {provNombre(r.proveedor)}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px]',
                              r.pagado
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            )}
                          >
                            {r.pagado ? (
                              <>
                                <CheckCircle2 className="size-3" /> Pagado
                              </>
                            ) : (
                              <>
                                <Clock className="size-3" /> Pendiente
                              </>
                            )}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(r.created_at).toLocaleDateString('es-UY')}
                          {r.items && r.items.length > 0 && ` · ${r.items.length} ítem(s)`}
                        </p>
                        {r.items && r.items.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {r.items.slice(0, 3).map((it, i) => (
                              <Badge key={i} variant="outline" className="text-[9px]">
                                {prodNombre(it.producto)}: +{it.entran_llenas}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold">{fmt$(r.monto_total)}</p>
                        {!r.pagado && saldo > 0 && (
                          <p className="text-[10px] text-amber-600">Saldo: {fmt$(saldo)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto gt-scroll">
          <DialogHeader>
            <DialogTitle>Nuevo remito</DialogTitle>
            <DialogDescription>Registrar compra a proveedor</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Proveedor *</Label>
                <Select value={provId} onValueChange={setProvId}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {proveedores.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Número</Label>
                <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Auto si vacío" />
              </div>
              <div className="space-y-1.5">
                <Label>Monto total *</Label>
                <Input type="number" min={0} value={montoTotal}
                  onChange={(e) => setMontoTotal(Math.max(0, Number(e.target.value)))} />
              </div>
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select value={pagado ? 'pagado' : 'pendiente'} onValueChange={(v) => setPagado(v === 'pagado')}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="pagado">Pagado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Items builder */}
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Ítems del remito</Label>
                <Button type="button" size="sm" variant="outline" onClick={addItem}>
                  <Plus className="size-3.5" /> Agregar
                </Button>
              </div>
              {items.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">
                  Sin ítems. Agregá productos para actualizar stock automáticamente.
                </p>
              )}
              {items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-12 sm:col-span-5 space-y-1">
                    <Label className="text-[11px]">Producto</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                      value={it.productoId}
                      onChange={(e) => updateItem(idx, { productoId: e.target.value })}
                    >
                      <option value="">Seleccionar...</option>
                      {productos.map((p) => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-4 sm:col-span-2 space-y-1">
                    <Label className="text-[11px] text-emerald-700">Entran llenas</Label>
                    <Input type="number" min={0} value={it.entranLlenas}
                      onChange={(e) => updateItem(idx, { entranLlenas: Math.max(0, Number(e.target.value)) })}
                      className="h-9 border-emerald-200" />
                  </div>
                  <div className="col-span-4 sm:col-span-2 space-y-1">
                    <Label className="text-[11px] text-sky-700">Salen vacías</Label>
                    <Input type="number" min={0} value={it.salenVacias}
                      onChange={(e) => updateItem(idx, { salenVacias: Math.max(0, Number(e.target.value)) })}
                      className="h-9 border-sky-200" />
                  </div>
                  <div className="col-span-3 sm:col-span-2 space-y-1">
                    <Label className="text-[11px] text-amber-700">Defect.</Label>
                    <Input type="number" min={0} value={it.salenDefectuosas}
                      onChange={(e) => updateItem(idx, { salenDefectuosas: Math.max(0, Number(e.target.value)) })}
                      className="h-9 border-amber-200" />
                  </div>
                  <div className="col-span-1">
                    <Button type="button" size="icon" variant="ghost" className="size-9 text-red-600"
                      onClick={() => removeItem(idx)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Crear remito
              </Button>
            </DialogFooter>
            {!pagado && montoTotal > 0 && (
              <div className="flex items-center gap-2 text-xs text-amber-700">
                <AlertCircle className="size-3.5" />
                Se registrará saldo pendiente de {fmt$(montoTotal)}.
              </div>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
