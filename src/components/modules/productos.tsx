'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { Package, Plus, Edit2, Trash2, TrendingUp, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
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

const TIPOS = [
  { value: 'garrafa', label: 'Garrafa', color: 'border-emerald-200 bg-emerald-50' },
  { value: 'tubo', label: 'Tubo', color: 'border-sky-200 bg-sky-50' },
  { value: 'kit', label: 'Kit', color: 'border-violet-200 bg-violet-50' },
  { value: 'repuesto', label: 'Repuesto', color: 'border-amber-200 bg-amber-50' },
  { value: 'accesorio', label: 'Accesorio', color: 'border-pink-200 bg-pink-50' },
  { value: 'otro', label: 'Otro', color: 'border-muted bg-muted/30' },
]

const tipoStyle = (t: string) => TIPOS.find((x) => x.value === t) || TIPOS[TIPOS.length - 1]

interface Producto {
  id: string
  nombre: string
  tipo: string
  costo: number
  precio_venta: number
  precio_comercio: number
  flete: number
  created_at: string
}

const EMPTY = { nombre: '', tipo: 'garrafa', costo: 0, precio_venta: 0, precio_comercio: 0, flete: 0 }

export function ProductosModule() {
  const { toast } = useToast()
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Producto | null>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/productos', { cache: 'no-store' })
      const j = await res.json()
      setProductos(j.data || [])
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  function openNew() {
    setEditing(null)
    setForm({ ...EMPTY })
    setShowForm(true)
  }
  function openEdit(p: Producto) {
    setEditing(p)
    setForm({
      nombre: p.nombre,
      tipo: p.tipo,
      costo: p.costo,
      precio_venta: p.precio_venta,
      precio_comercio: p.precio_comercio,
      flete: p.flete,
    })
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre) {
      toast({ title: 'Falta nombre', variant: 'destructive' })
      return
    }
    const ok = window.confirm(editing ? '¿Guardar cambios del producto?' : '¿Crear producto?')
    if (!ok) return
    setSaving(true)
    try {
      if (editing) {
        // try PATCH first; if it fails, just POST a new one (no duplicate risk for demo)
        const patchRes = await fetch(`/api/productos?id=${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!patchRes.ok) {
          toast({ title: 'Edición no disponible', description: 'El backend no soporta PATCH', variant: 'destructive' })
          setShowForm(false)
          return
        }
        toast({ title: 'Producto actualizado' })
      } else {
        const res = await fetch('/api/productos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error('Error al crear')
        toast({ title: 'Producto creado' })
      }
      setShowForm(false)
      load()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(p: Producto) {
    const ok = window.confirm(`¿Eliminar producto ${p.nombre}?`)
    if (!ok) return
    try {
      const res = await fetch(`/api/productos?id=${p.id}`, { method: 'DELETE' })
      if (!res.ok) {
        toast({ title: 'Eliminar no disponible', description: 'El backend no soporta DELETE', variant: 'destructive' })
        return
      }
      toast({ title: 'Producto eliminado' })
      load()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const margen = useMemo(() => {
    const margenPesos = form.precio_venta - form.costo - form.flete
    const margenPct = form.precio_venta > 0 ? Math.round((margenPesos / form.precio_venta) * 100) : 0
    return { pesos: margenPesos, pct: margenPct }
  }, [form])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">Productos</h2>
          <p className="text-sm text-muted-foreground">{productos.length} productos en catálogo</p>
        </div>
        <Button onClick={openNew} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="size-4" /> Nuevo
        </Button>
      </div>

      {productos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No hay productos. Creá el primero.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {productos.map((p) => {
            const st = tipoStyle(p.tipo)
            const margenP = p.precio_venta - p.costo - p.flete
            const margenPctP = p.precio_venta > 0 ? Math.round((margenP / p.precio_venta) * 100) : 0
            return (
              <Card
                key={p.id}
                className={cn('group relative hover:shadow-md transition-shadow', st.color, 'border')}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Package className="size-4 text-foreground/60 shrink-0" />
                        <p className="text-sm font-semibold truncate">{p.nombre}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] mt-1 capitalize bg-white/60">
                        {p.tipo}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="size-7" onClick={() => openEdit(p)}>
                        <Edit2 className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-red-600 hover:text-red-700"
                        onClick={() => handleDelete(p)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                    <div className="rounded bg-white/60 p-2">
                      <p className="text-muted-foreground">Costo</p>
                      <p className="font-semibold">{fmt$(p.costo)}</p>
                    </div>
                    <div className="rounded bg-white/60 p-2">
                      <p className="text-muted-foreground">Venta</p>
                      <p className="font-semibold text-emerald-700">{fmt$(p.precio_venta)}</p>
                    </div>
                    <div className="rounded bg-white/60 p-2">
                      <p className="text-muted-foreground">Comercio</p>
                      <p className="font-semibold">{fmt$(p.precio_comercio)}</p>
                    </div>
                    <div className="rounded bg-white/60 p-2">
                      <p className="text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="size-3" /> Margen
                      </p>
                      <p className="font-semibold text-emerald-700">{margenPctP}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Modificá los datos del producto' : 'Completá los datos del nuevo producto'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nombre *</Label>
              <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Costo</Label>
              <Input type="number" min={0} value={form.costo}
                onChange={(e) => setForm({ ...form, costo: Math.max(0, Number(e.target.value)) })} />
            </div>
            <div className="space-y-1.5">
              <Label>Flete</Label>
              <Input type="number" min={0} value={form.flete}
                onChange={(e) => setForm({ ...form, flete: Math.max(0, Number(e.target.value)) })} />
            </div>
            <div className="space-y-1.5">
              <Label>Precio venta</Label>
              <Input type="number" min={0} value={form.precio_venta}
                onChange={(e) => setForm({ ...form, precio_venta: Math.max(0, Number(e.target.value)) })} />
            </div>
            <div className="space-y-1.5">
              <Label>Precio comercio</Label>
              <Input type="number" min={0} value={form.precio_comercio}
                onChange={(e) => setForm({ ...form, precio_comercio: Math.max(0, Number(e.target.value)) })} />
            </div>
            <div className="sm:col-span-2 rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="text-xs text-muted-foreground">Margen de ganancia</p>
              <p className="text-lg font-bold text-emerald-700">
                {fmt$(margen.pesos)} <span className="text-sm">({margen.pct}%)</span>
              </p>
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                {editing ? 'Guardar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
