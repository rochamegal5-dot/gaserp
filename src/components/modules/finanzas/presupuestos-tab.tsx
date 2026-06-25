'use client'
import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import { FileText, Plus, Loader2, Check, X, ShoppingCart, Search, RefreshCw, Trash2 } from 'lucide-react'

const fmt = (n: number) => '$' + n.toLocaleString('es-UY')
const estadoConfig: Record<string, { label: string; color: string }> = { pendiente: { label: 'Pendiente', color: 'border-blue-300 text-blue-700 bg-blue-50' }, aprobado: { label: 'Aprobado', color: 'border-emerald-300 text-emerald-700 bg-emerald-50' }, rechazado: { label: 'Rechazado', color: 'border-red-300 text-red-700 bg-red-50' }, convertido: { label: 'Convertido', color: 'border-purple-300 text-purple-700 bg-purple-50' }, vencido: { label: 'Vencido', color: 'border-gray-300 text-gray-600 bg-gray-100' } }

export function PresupuestosTab() {
  const { toast } = useToast()
  const [presupuestos, setPresupuestos] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [productos, setProductos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [selectedPresup, setSelectedPresup] = useState<any>(null)
  const [filterEstado, setFilterEstado] = useState('todos')
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [clienteId, setClienteId] = useState('')
  const [clienteNombre, setClienteNombre] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [items, setItems] = useState<any[]>([])

  const fetchData = useCallback(async () => {
    setRefreshing(true)
    try {
      const params = new URLSearchParams(); if (filterEstado !== 'todos') params.set('estado', filterEstado); if (search) params.set('q', search)
      const [pRes, cRes, prodRes] = await Promise.all([fetch(`/api/presupuestos?${params}`, { cache: 'no-store' }), fetch('/api/clientes', { cache: 'no-store' }), fetch('/api/productos', { cache: 'no-store' })])
      const pData = await pRes.json(); const cData = await cRes.json(); const prodData = await prodRes.json()
      setPresupuestos(pData.presupuestos || []); setClientes(Array.isArray(cData) ? cData : (cData.clientes || [])); setProductos(Array.isArray(prodData) ? prodData : (prodData.productos || []))
    } catch { toast({ title: 'Error', variant: 'destructive' }) } finally { setLoading(false); setRefreshing(false) }
  }, [filterEstado, search, toast])
  useEffect(() => { fetchData() }, [fetchData])

  const addItem = () => setItems(prev => [...prev, { producto_id: '', producto_nombre: '', cantidad: 1, precio_unitario: 0, subtotal: 0 }])
  const updateItem = (idx: number, field: string, value: any) => { setItems(prev => { const n = [...prev]; n[idx] = { ...n[idx], [field]: value }; if (field === 'producto_id') { const p = productos.find(p => p.id === value); if (p) { n[idx].producto_nombre = p.nombre; n[idx].precio_unitario = p.precio_venta } } n[idx].subtotal = n[idx].cantidad * n[idx].precio_unitario; return n }) }
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))
  const total = items.reduce((sum, it) => sum + it.subtotal, 0)

  const handleSubmit = async () => {
    if (!clienteNombre && !clienteId) { toast({ title: 'Error', variant: 'destructive' }); return }
    if (items.length === 0) { toast({ title: 'Error', variant: 'destructive' }); return }
    let nf = clienteNombre; if (clienteId) { const c = clientes.find(c => c.id === clienteId); if (c) nf = `${c.apellido1 || ''} ${c.nombre1 || ''}`.trim() }
    if (!window.confirm(`Crear presupuesto por ${fmt(total)} para ${nf}?\n\n${items.length} item(s).`)) return
    setSubmitting(true)
    try { const res = await fetch('/api/presupuestos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cliente_id: clienteId || null, cliente_nombre: nf, observaciones, items }) }); const data = await res.json(); if (res.ok) { toast({ title: '✅ Presupuesto creado', description: `Total: ${fmt(data.total)}` }); setClienteId(''); setClienteNombre(''); setObservaciones(''); setItems([]); setShowForm(false); fetchData() } else { toast({ title: 'Error', description: data.error, variant: 'destructive' }) } } catch { toast({ title: 'Error', variant: 'destructive' }) } finally { setSubmitting(false) }
  }

  const cambiarEstado = async (id: string, accion: string) => { if (!window.confirm(`¿${accion}?`)) return; try { const res = await fetch(`/api/presupuestos/${id}?accion=${accion}`, { method: 'PATCH' }); if (res.ok) { toast({ title: '✅ Estado actualizado' }); fetchData() } } catch {} }
  const convertirAVenta = async (id: string, nombre: string, monto: number) => { if (!window.confirm(`¿Convertir presupuesto de ${nombre} (${fmt(monto)}) en venta?`)) return; try { const res = await fetch(`/api/presupuestos/${id}?accion=convertir`, { method: 'POST' }); const data = await res.json(); if (res.ok) { toast({ title: '✅ Convertido', description: `${data.ventas_creadas} venta(s)` }); fetchData() } } catch {} }
  const verDetalle = async (id: string) => { try { const res = await fetch(`/api/presupuestos/${id}`); if (res.ok) setSelectedPresup(await res.json()) } catch {} }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-purple-600" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2"><Select value={filterEstado} onValueChange={setFilterEstado}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem><SelectItem value="pendiente">Pendientes</SelectItem><SelectItem value="aprobado">Aprobados</SelectItem><SelectItem value="convertido">Convertidos</SelectItem></SelectContent></Select><div className="relative"><Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 w-64" /></div><Button variant="outline" size="sm" onClick={fetchData} disabled={refreshing}><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /></Button></div>
        <Button onClick={() => setShowForm(true)} className="bg-purple-600 hover:bg-purple-700"><Plus className="h-4 w-4 mr-1" /> Nuevo</Button>
      </div>
      {showForm && <Card className="border-purple-300"><CardHeader><CardTitle className="text-lg">Nuevo Presupuesto</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3"><div><Label>Cliente existente</Label><Select value={clienteId} onValueChange={v => { setClienteId(v === '__none__' ? '' : v); if (v !== '__none__') { const c = clientes.find(c => c.id === v); if (c) setClienteNombre(`${c.apellido1 || ''} ${c.nombre1 || ''}`.trim()) } }}><SelectTrigger><SelectValue placeholder="-- Opcional --" /></SelectTrigger><SelectContent><SelectItem value="__none__">-- Sin cliente --</SelectItem>{clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.apellido1 || ''} {c.nombre1 || ''}</SelectItem>)}</SelectContent></Select></div><div className="md:col-span-2"><Label>Nombre del cliente (requerido)</Label><Input value={clienteNombre} onChange={e => setClienteNombre(e.target.value)} /></div></div>
        <div className="border rounded-lg p-3 bg-purple-50/50 space-y-2"><div className="flex justify-between"><Label className="text-xs uppercase font-bold">Items</Label><Button size="sm" variant="outline" onClick={addItem}><Plus className="h-3 w-3 mr-1" /> Agregar</Button></div>{items.length === 0 ? <p className="text-center text-sm text-gray-500 py-4">Sin items</p> : items.map((it, idx) => <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-white p-2 rounded border"><div className="col-span-12 md:col-span-5"><Label className="text-[10px]">Producto</Label><Select value={it.producto_id} onValueChange={v => updateItem(idx, 'producto_id', v)}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="--" /></SelectTrigger><SelectContent>{productos.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent></Select></div><div className="col-span-3 md:col-span-2"><Label className="text-[10px]">Cant.</Label><Input type="number" min="1" value={it.cantidad} onChange={e => updateItem(idx, 'cantidad', Number(e.target.value))} className="h-8 text-xs" /></div><div className="col-span-4 md:col-span-2"><Label className="text-[10px]">Precio</Label><Input type="number" value={it.precio_unitario} onChange={e => updateItem(idx, 'precio_unitario', Number(e.target.value))} className="h-8 text-xs" /></div><div className="col-span-4 md:col-span-2"><Label className="text-[10px]">Subtotal</Label><p className="text-sm font-bold py-1">{fmt(it.subtotal)}</p></div><div className="col-span-1"><Button variant="ghost" size="sm" onClick={() => removeItem(idx)} className="text-red-500"><X className="h-4 w-4" /></Button></div></div>)}{items.length > 0 && <div className="flex justify-end pt-2 border-t"><p className="text-2xl font-black text-purple-700">{fmt(total)}</p></div>}</div>
        <div className="flex gap-2 justify-end"><Button variant="outline" onClick={() => { setShowForm(false); setClienteId(''); setClienteNombre(''); setItems([]) }}>Cancelar</Button><Button onClick={handleSubmit} disabled={submitting || items.length === 0 || !clienteNombre} className="bg-purple-600 hover:bg-purple-700">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear'}</Button></div>
      </CardContent></Card>}
      {presupuestos.length === 0 ? <Card className="border-purple-100"><CardContent className="p-12 text-center"><FileText className="h-12 w-12 text-purple-200 mx-auto mb-3" /><p className="text-gray-500">No hay presupuestos</p></CardContent></Card> :
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{presupuestos.map(p => { const ec = estadoConfig[p.estado] || estadoConfig.pendiente; return <Card key={p.id} className="border-purple-200"><CardContent className="p-4"><div className="flex items-start justify-between mb-2"><div><p className="font-bold text-base">{p.cliente_nombre}</p><p className="text-xs text-gray-500">{new Date(p.created_at).toLocaleDateString('es-UY')} · {p.items_count || 0} item(s)</p></div><Badge className={ec.color} variant="outline">{ec.label}</Badge></div><div className="flex items-end justify-between mb-3"><div><p className="text-xs text-gray-500 uppercase font-bold">Total</p><p className="text-2xl font-black text-purple-700">{fmt(p.total)}</p></div>{p.ventas_generadas ? <Badge className="bg-purple-100 text-purple-700"><ShoppingCart className="h-3 w-3 mr-1" />{p.ventas_generadas} venta(s)</Badge> : null}</div><div className="flex flex-wrap gap-1.5"><Button size="sm" variant="outline" onClick={() => verDetalle(p.id)}><FileText className="h-3 w-3 mr-1" /> Detalle</Button>{p.estado === 'pendiente' && <><Button size="sm" variant="outline" className="border-emerald-400 text-emerald-700" onClick={() => cambiarEstado(p.id, 'aprobar')}><Check className="h-3 w-3 mr-1" /> Aprobar</Button><Button size="sm" variant="outline" className="border-red-400 text-red-700" onClick={() => cambiarEstado(p.id, 'rechazar')}><X className="h-3 w-3 mr-1" /> Rechazar</Button></>}{p.estado === 'aprobado' && <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={() => convertirAVenta(p.id, p.cliente_nombre, p.total)}><ShoppingCart className="h-3 w-3 mr-1" /> Convertir</Button>}</div></CardContent></Card>})}
      </div>}
      {selectedPresup && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedPresup(null)}><div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}><div className="p-4 border-b flex justify-between"><h3 className="font-bold text-lg">Detalle</h3><Button variant="ghost" size="sm" onClick={() => setSelectedPresup(null)}><X className="h-4 w-4" /></Button></div><div className="p-4 space-y-3"><div className="grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-gray-500 uppercase font-bold">Cliente</p><p className="font-bold">{selectedPresup.cliente_nombre}</p></div><div><p className="text-xs text-gray-500 uppercase font-bold">Estado</p><Badge className={estadoConfig[selectedPresup.estado]?.color} variant="outline">{estadoConfig[selectedPresup.estado]?.label}</Badge></div></div><table className="w-full text-sm border"><thead className="bg-gray-100"><tr><th className="p-2 text-left border">Producto</th><th className="p-2 text-right border">Cant.</th><th className="p-2 text-right border">Precio</th><th className="p-2 text-right border">Subtotal</th></tr></thead><tbody>{(selectedPresup.items || []).map((it: any) => <tr key={it.id}><td className="p-2 border">{it.producto_nombre}</td><td className="p-2 text-right border">{it.cantidad}</td><td className="p-2 text-right border">{fmt(it.precio_unitario)}</td><td className="p-2 text-right border font-bold">{fmt(it.subtotal)}</td></tr>)}</tbody><tfoot><tr className="bg-purple-50"><td colSpan={3} className="p-2 text-right border font-bold">TOTAL</td><td className="p-2 text-right border font-black text-purple-700">{fmt(selectedPresup.total)}</td></tr></tfoot></table></div></div></div>}
    </div>
  )
}
