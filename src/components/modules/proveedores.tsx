'use client'

import { useEffect, useState, useCallback } from 'react'
import { Truck, Plus, Edit2, Trash2, Phone, MapPin, User, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

interface Proveedor {
  id: string
  nombre: string
  cuit?: string | null
  contacto?: string | null
  telefono?: string | null
  direccion?: string | null
  created_at: string
}

const EMPTY = { nombre: '', cuit: '', contacto: '', telefono: '', direccion: '' }

export function ProveedoresModule() {
  const { toast } = useToast()
  const [items, setItems] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Proveedor | null>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/proveedores', { cache: 'no-store' })
      const j = await res.json()
      setItems(j.data || [])
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
  function openEdit(p: Proveedor) {
    setEditing(p)
    setForm({
      nombre: p.nombre,
      cuit: p.cuit || '',
      contacto: p.contacto || '',
      telefono: p.telefono || '',
      direccion: p.direccion || '',
    })
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre) {
      toast({ title: 'Falta nombre', variant: 'destructive' })
      return
    }
    const ok = window.confirm(editing ? '¿Guardar cambios?' : '¿Crear proveedor?')
    if (!ok) return
    setSaving(true)
    try {
      if (editing) {
        const res = await fetch(`/api/proveedores?id=${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) {
          toast({ title: 'Edición no disponible', variant: 'destructive' })
          setShowForm(false)
          return
        }
        toast({ title: 'Proveedor actualizado' })
      } else {
        const res = await fetch('/api/proveedores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error('Error al crear')
        toast({ title: 'Proveedor creado' })
      }
      setShowForm(false)
      load()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(p: Proveedor) {
    const ok = window.confirm(`¿Eliminar proveedor ${p.nombre}?`)
    if (!ok) return
    try {
      const res = await fetch(`/api/proveedores?id=${p.id}`, { method: 'DELETE' })
      if (!res.ok) {
        toast({ title: 'Eliminar no disponible', variant: 'destructive' })
        return
      }
      toast({ title: 'Proveedor eliminado' })
      load()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">Proveedores</h2>
          <p className="text-sm text-muted-foreground">{items.length} proveedores</p>
        </div>
        <Button onClick={openNew} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="size-4" /> Nuevo
        </Button>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No hay proveedores registrados.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((p) => (
            <Card key={p.id} className="group relative hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Truck className="size-4 text-foreground/60 shrink-0" />
                      <p className="text-sm font-semibold truncate">{p.nombre}</p>
                    </div>
                    {p.cuit && (
                      <p className="text-[11px] text-muted-foreground mt-1">CUIT: {p.cuit}</p>
                    )}
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
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {p.contacto && (
                    <p className="flex items-center gap-1.5"><User className="size-3" /> {p.contacto}</p>
                  )}
                  {p.telefono && (
                    <p className="flex items-center gap-1.5"><Phone className="size-3" /> {p.telefono}</p>
                  )}
                  {p.direccion && (
                    <p className="flex items-center gap-1.5"><MapPin className="size-3" /> {p.direccion}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar proveedor' : 'Nuevo proveedor'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Modificá los datos del proveedor' : 'Completá los datos'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nombre *</Label>
              <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>CUIT</Label>
              <Input value={form.cuit} onChange={(e) => setForm({ ...form, cuit: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Contacto</Label>
              <Input value={form.contacto} onChange={(e) => setForm({ ...form, contacto: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono</Label>
              <Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Dirección</Label>
              <Input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
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
