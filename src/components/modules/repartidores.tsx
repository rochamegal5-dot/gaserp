'use client'

import { useEffect, useState, useCallback } from 'react'
import { Bike, Plus, Edit2, Trash2, Bike as BikeIcon, Loader2, Palette } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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

interface Repartidor {
  id: string
  nombre: string
  telefono?: string | null
  vehiculo?: string | null
  patente?: string | null
  color: string
  activo: boolean
}

interface Producto {
  id: string
  nombre: string
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

const COLORES = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']
const EMPTY = { nombre: '', telefono: '', vehiculo: '', patente: '', color: '#3b82f6', activo: true }

function prodNombre(p: Producto | Producto[] | null | undefined): string {
  if (!p) return '—'
  return (Array.isArray(p) ? p[0] : p)?.nombre || '—'
}

export function RepartidoresModule() {
  const { toast } = useToast()
  const [reps, setReps] = useState<Repartidor[]>([])
  const [stockRep, setStockRep] = useState<StockRep[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Repartidor | null>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [r, sr] = await Promise.all([
        fetch('/api/repartidores', { cache: 'no-store' }).then((x) => x.json()),
        fetch('/api/stock/repartidor', { cache: 'no-store' }).then((x) => x.json()),
      ])
      setReps(r.data || [])
      setStockRep(sr.data || [])
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
    setForm({ ...EMPTY, color: COLORES[reps.length % COLORES.length] })
    setShowForm(true)
  }
  function openEdit(r: Repartidor) {
    setEditing(r)
    setForm({
      nombre: r.nombre,
      telefono: r.telefono || '',
      vehiculo: r.vehiculo || '',
      patente: r.patente || '',
      color: r.color,
      activo: r.activo,
    })
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre) {
      toast({ title: 'Falta nombre', variant: 'destructive' })
      return
    }
    const ok = window.confirm(editing ? '¿Guardar cambios?' : '¿Crear repartidor?')
    if (!ok) return
    setSaving(true)
    try {
      if (editing) {
        const res = await fetch(`/api/repartidores?id=${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) {
          toast({ title: 'Edición no disponible', variant: 'destructive' })
          setShowForm(false)
          return
        }
        toast({ title: 'Repartidor actualizado' })
      } else {
        const res = await fetch('/api/repartidores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error('Error al crear')
        toast({ title: 'Repartidor creado' })
      }
      setShowForm(false)
      load()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(r: Repartidor) {
    const ok = window.confirm(`¿Eliminar repartidor ${r.nombre}?`)
    if (!ok) return
    try {
      const res = await fetch(`/api/repartidores?id=${r.id}`, { method: 'DELETE' })
      if (!res.ok) {
        toast({ title: 'Eliminar no disponible', variant: 'destructive' })
        return
      }
      toast({ title: 'Repartidor eliminado' })
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">Repartidores</h2>
          <p className="text-sm text-muted-foreground">{reps.length} repartidores · {reps.filter((r) => r.activo).length} activos</p>
        </div>
        <Button onClick={openNew} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="size-4" /> Nuevo
        </Button>
      </div>

      <Tabs defaultValue="lista" className="w-full">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="lista" className="flex items-center gap-1.5">
            <Bike className="size-4" /> Lista
          </TabsTrigger>
          <TabsTrigger value="stock" className="flex items-center gap-1.5">
            <BikeIcon className="size-4" /> Stock por Camioneta
          </TabsTrigger>
        </TabsList>

        {/* Lista */}
        <TabsContent value="lista" className="space-y-4">
          {reps.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No hay repartidores.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {reps.map((r) => (
                <Card
                  key={r.id}
                  className="group relative hover:shadow-md transition-shadow border-l-4"
                  style={{ borderLeftColor: r.color }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="size-3 rounded-full shrink-0" style={{ background: r.color }} />
                          <p className="text-sm font-semibold truncate">{r.nombre}</p>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          <Badge variant="outline" className="text-[10px]">
                            {r.vehiculo || 'Sin vehículo'}
                          </Badge>
                          {r.patente && (
                            <Badge variant="outline" className="text-[10px]">{r.patente}</Badge>
                          )}
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px]',
                              r.activo
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-muted text-muted-foreground'
                            )}
                          >
                            {r.activo ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </div>
                        {r.telefono && (
                          <p className="text-xs text-muted-foreground mt-2">{r.telefono}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="size-7" onClick={() => openEdit(r)}>
                          <Edit2 className="size-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="size-7 text-red-600 hover:text-red-700"
                          onClick={() => handleDelete(r)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Stock por camioneta */}
        <TabsContent value="stock" className="space-y-4">
          {reps.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Sin repartidores para mostrar stock.
              </CardContent>
            </Card>
          ) : (
            reps.map((r) => {
              const stock = stockRep.filter((s) => s.repartidor_id === r.id)
              const totalLlenas = stock.reduce((s, x) => s + (x.llenas || 0), 0)
              return (
                <Card key={r.id} className="border-l-4" style={{ borderLeftColor: r.color }}>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="size-3 rounded-full" style={{ background: r.color }} />
                      {r.nombre}
                      <Badge variant="outline" className="text-[10px] ml-auto">
                        {totalLlenas} llenas totales
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {stock.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-3">
                        Sin stock asignado.
                      </p>
                    ) : (
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
                          {stock.map((s) => (
                            <TableRow key={s.id}>
                              <TableCell className="font-medium">{prodNombre(s.producto)}</TableCell>
                              <TableCell className="text-center font-semibold text-emerald-700">{s.llenas}</TableCell>
                              <TableCell className="text-center text-sky-700">{s.vacias}</TableCell>
                              <TableCell className="text-center text-amber-700">{s.defectuosas}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              )
            })
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar repartidor' : 'Nuevo repartidor'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Modificá los datos del repartidor' : 'Completá los datos'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nombre *</Label>
              <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono</Label>
              <Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Patente</Label>
              <Input value={form.patente} onChange={(e) => setForm({ ...form, patente: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Vehículo</Label>
              <Input value={form.vehiculo} onChange={(e) => setForm({ ...form, vehiculo: e.target.value })}
                placeholder="Ej: Moto, Camioneta, Auto..." />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="flex items-center gap-1.5"><Palette className="size-3.5" /> Color identificatorio</Label>
              <div className="flex gap-2 flex-wrap">
                {COLORES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    className={cn(
                      'size-8 rounded-full border-2 transition-all',
                      form.color === c ? 'border-foreground scale-110' : 'border-transparent'
                    )}
                    style={{ background: c }}
                    aria-label={`Color ${c}`}
                  />
                ))}
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="size-8 rounded border cursor-pointer"
                />
              </div>
            </div>
            <div className="sm:col-span-2 flex items-center gap-2">
              <Switch checked={form.activo} onCheckedChange={(v) => setForm({ ...form, activo: v })} id="activo" />
              <Label htmlFor="activo" className="cursor-pointer">Activo</Label>
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
