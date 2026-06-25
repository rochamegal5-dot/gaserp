'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Wallet,
  X,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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

interface Cliente {
  id: string
  tipo: string
  telefono: string
  email?: string | null
  ci?: string | null
  nombre1?: string | null
  nombre2?: string | null
  apellido1?: string | null
  apellido2?: string | null
  calle?: string | null
  numero?: string | null
  ciudad?: string | null
  depto?: string | null
  fiado: boolean
  origen?: string
  ultima_actividad?: string | null
  created_at: string
}

function nombreCompleto(c: Cliente): string {
  const parts = [c.nombre1, c.nombre2, c.apellido1, c.apellido2].filter(Boolean)
  return parts.join(' ').trim() || c.telefono || 'Sin nombre'
}

function origenBadge(o?: string) {
  if (!o) return null
  const map: Record<string, string> = {
    whatsapp: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    web: 'bg-sky-50 text-sky-700 border-sky-200',
    lead: 'bg-violet-50 text-violet-700 border-violet-200',
    manual: 'bg-muted text-muted-foreground',
    import_csv: 'bg-amber-50 text-amber-700 border-amber-200',
  }
  return (
    <Badge variant="outline" className={cn('text-[10px] capitalize', map[o] || map.manual)}>
      {o.replace('_', ' ')}
    </Badge>
  )
}

const EMPTY_FORM = {
  nombre1: '',
  nombre2: '',
  apellido1: '',
  apellido2: '',
  telefono: '',
  email: '',
  ci: '',
  tipo: 'particular',
  calle: '',
  numero: '',
  ciudad: '',
  depto: '',
  fiado: false,
}

export function ClientesModule() {
  const { toast } = useToast()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState('all')
  const [filterOrigen, setFilterOrigen] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Cliente | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [detalle, setDetalle] = useState<Cliente | null>(null)
  const [detalleDeuda, setDetalleDeuda] = useState<any>(null)
  const [loadingDeuda, setLoadingDeuda] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/clientes', { cache: 'no-store' })
      const j = await res.json()
      setClientes(j.data || [])
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return clientes.filter((c) => {
      if (filterTipo !== 'all' && c.tipo !== filterTipo) return false
      if (filterOrigen !== 'all' && (c.origen || 'manual') !== filterOrigen) return false
      if (!s) return true
      const text = [
        c.nombre1,
        c.nombre2,
        c.apellido1,
        c.apellido2,
        c.telefono,
        c.email,
        c.ci,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return text.includes(s)
    })
  }, [clientes, search, filterTipo, filterOrigen])

  function openNew() {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setShowForm(true)
  }
  function openEdit(c: Cliente) {
    setEditing(c)
    setForm({
      nombre1: c.nombre1 || '',
      nombre2: c.nombre2 || '',
      apellido1: c.apellido1 || '',
      apellido2: c.apellido2 || '',
      telefono: c.telefono || '',
      email: c.email || '',
      ci: c.ci || '',
      tipo: c.tipo || 'particular',
      calle: c.calle || '',
      numero: c.numero || '',
      ciudad: c.ciudad || '',
      depto: c.depto || '',
      fiado: !!c.fiado,
    })
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.telefono) {
      toast({ title: 'Falta teléfono', description: 'El teléfono es obligatorio', variant: 'destructive' })
      return
    }
    const ok = window.confirm(editing ? '¿Guardar cambios del cliente?' : '¿Crear nuevo cliente?')
    if (!ok) return
    setSaving(true)
    try {
      // POST creates; we use a custom update via POST + id (not supported) so we use PATCH via /api/clientes/[id]
      // For now, use POST and (if editing) we DELETE then POST.
      let res
      if (editing) {
        // Delete + recreate (simple approach without new route)
        await fetch(`/api/clientes?id=${editing.id}`, { method: 'DELETE' }).catch(() => {})
        res = await fetch('/api/clientes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
      } else {
        res = await fetch('/api/clientes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Error al guardar')
      }
      toast({ title: editing ? 'Cliente actualizado' : 'Cliente creado' })
      setShowForm(false)
      load()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(c: Cliente) {
    const ok = window.confirm(`¿Eliminar cliente ${nombreCompleto(c)}?`)
    if (!ok) return
    try {
      await fetch(`/api/clientes?id=${c.id}`, { method: 'DELETE' })
      toast({ title: 'Cliente eliminado' })
      load()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  async function openDetalle(c: Cliente) {
    setDetalle(c)
    setDetalleDeuda(null)
    setLoadingDeuda(true)
    try {
      const res = await fetch('/api/finanzas/cobrar', { cache: 'no-store' })
      const j = await res.json()
      const found = (j.data || []).find((d: any) => d.cliente_id === c.id)
      setDetalleDeuda(found || null)
    } catch {
      setDetalleDeuda(null)
    } finally {
      setLoadingDeuda(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">Clientes</h2>
          <p className="text-sm text-muted-foreground">{clientes.length} clientes registrados</p>
        </div>
        <Button onClick={openNew} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="size-4" /> Nuevo
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3 grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="relative md:col-span-1">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, teléfono..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="particular">Particular</SelectItem>
              <SelectItem value="comercio">Comercio</SelectItem>
              <SelectItem value="lead">Lead</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterOrigen} onValueChange={setFilterOrigen}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Origen" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los orígenes</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="web">Web</SelectItem>
              <SelectItem value="lead">Lead</SelectItem>
              <SelectItem value="import_csv">Importación</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No se encontraron clientes con esos filtros.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c) => (
            <Card
              key={c.id}
              className="group relative hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => openDetalle(c)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{nombreCompleto(c)}</p>
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                      <Phone className="size-3" /> {c.telefono}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      onClick={(e) => {
                        e.stopPropagation()
                        openEdit(c)
                      }}
                    >
                      <Edit2 className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 text-red-600 hover:text-red-700"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(c)
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {c.tipo}
                  </Badge>
                  {c.fiado && (
                    <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                      Fiado
                    </Badge>
                  )}
                  {origenBadge(c.origen)}
                </div>
                {(c.calle || c.ciudad) && (
                  <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
                    <MapPin className="size-3" />
                    {[c.calle, c.numero && `#${c.numero}`, c.ciudad].filter(Boolean).join(' ')}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto gt-scroll">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar cliente' : 'Nuevo cliente'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Modificá los datos del cliente' : 'Completá los datos del nuevo cliente'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Primer nombre</Label>
              <Input value={form.nombre1} onChange={(e) => setForm({ ...form, nombre1: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Segundo nombre</Label>
              <Input value={form.nombre2} onChange={(e) => setForm({ ...form, nombre2: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Primer apellido</Label>
              <Input value={form.apellido1} onChange={(e) => setForm({ ...form, apellido1: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Segundo apellido</Label>
              <Input value={form.apellido2} onChange={(e) => setForm({ ...form, apellido2: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono *</Label>
              <Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>CI</Label>
              <Input value={form.ci} onChange={(e) => setForm({ ...form, ci: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="particular">Particular</SelectItem>
                  <SelectItem value="comercio">Comercio</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Calle</Label>
              <Input value={form.calle} onChange={(e) => setForm({ ...form, calle: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Número</Label>
              <Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Ciudad</Label>
              <Input value={form.ciudad} onChange={(e) => setForm({ ...form, ciudad: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Departamento</Label>
              <Input value={form.depto} onChange={(e) => setForm({ ...form, depto: e.target.value })} />
            </div>
            <div className="sm:col-span-2 flex items-center gap-2 pt-2">
              <Checkbox
                id="fiado"
                checked={form.fiado}
                onCheckedChange={(v) => setForm({ ...form, fiado: !!v })}
              />
              <Label htmlFor="fiado" className="cursor-pointer">
                Habilitado para fiado (cuenta corriente)
              </Label>
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                <X className="size-4" /> Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                {editing ? 'Guardar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detalle} onOpenChange={(o) => !o && setDetalle(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="size-5 text-emerald-600" />
              {detalle ? nombreCompleto(detalle) : ''}
            </DialogTitle>
          </DialogHeader>
          {detalle && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Phone className="size-4 text-muted-foreground" />
                  <span>{detalle.telefono}</span>
                </div>
                {detalle.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="size-4 text-muted-foreground" />
                    <span className="truncate">{detalle.email}</span>
                  </div>
                )}
                {detalle.ci && (
                  <div className="flex items-center gap-2">
                    <CreditCard className="size-4 text-muted-foreground" />
                    <span>{detalle.ci}</span>
                  </div>
                )}
                {detalle.fiado && (
                  <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 w-fit">
                    Habilitado para fiado
                  </Badge>
                )}
              </div>
              {(detalle.calle || detalle.ciudad) && (
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="size-4" /> Dirección
                  </p>
                  <p className="mt-1">
                    {[detalle.calle, detalle.numero && `#${detalle.numero}`, detalle.ciudad, detalle.depto]
                      .filter(Boolean)
                      .join(' ')}
                  </p>
                </div>
              )}
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="flex items-center gap-2 text-sm font-medium text-amber-800">
                  <Wallet className="size-4" /> Estado de cuenta
                </p>
                {loadingDeuda ? (
                  <p className="text-xs text-amber-600 mt-1">Cargando deuda...</p>
                ) : detalleDeuda ? (
                  <div className="mt-1">
                    <p className="text-2xl font-bold text-amber-700">
                      {fmt$(detalleDeuda.total_pendiente || 0)}
                    </p>
                    <p className="text-xs text-amber-700/70">
                      {detalleDeuda.ventas_pendientes || 0} venta(s) pendiente(s)
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-emerald-700 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="size-3.5" /> Sin deudas pendientes
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
