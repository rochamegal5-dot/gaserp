'use client'
import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { Sparkles, Loader2, Send, Users, Wifi, WifiOff, RefreshCw, Eye, CheckCircle, Facebook, Instagram, History, FileText, Plus, Clock, Search, Star, Trash2, AlertCircle, Link2, Link2Off, Heart, MessageCircle, Share2, ExternalLink, Calendar } from 'lucide-react'

const WHATSAPP_LIMIT = 4096
const TEMPLATES = [
  { name: 'Promoción', text: '¡Hola {nombre}! 🎉 Tenemos una promo especial en gas envasado.' },
  { name: 'Recordatorio', text: 'Hola {nombre}, te recordamos que tenés un saldo pendiente. ¡Comunicate!' },
  { name: 'Nuevo Servicio', text: '¡Hola {nombre}! 📢 Incorporamos entrega a domicilio.' },
]

export function MarketingModule() {
  const [tab, setTab] = useState('enviar')
  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="h-6 w-6 text-emerald-600" /> Marketing</h1><p className="text-sm text-gray-500">Campañas por WhatsApp y redes sociales</p></div>
      <div className="flex gap-2 flex-wrap">{[{ id: 'enviar', label: 'Enviar', icon: Send }, { id: 'historial', label: 'Historial', icon: History }, { id: 'plantillas', label: 'Plantillas', icon: FileText }, { id: 'redes', label: 'FB / IG', icon: Instagram }].map(t => { const Icon = t.icon; return <button key={t.id} onClick={() => setTab(t.id)} className={`text-sm px-4 py-2 rounded-lg font-medium flex items-center gap-1.5 ${tab === t.id ? 'bg-purple-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}><Icon className="h-4 w-4" /> {t.label}</button> })}
      </div>
      {tab === 'enviar' && <EnviarTab />}
      {tab === 'historial' && <HistorialTab />}
      {tab === 'plantillas' && <PlantillasTab />}
      {tab === 'redes' && <RedesTab />}
    </div>
  )
}

function EnviarTab() {
  const { toast } = useToast()
  const [status, setStatus] = useState('disconnected')
  const [target, setTarget] = useState('all')
  const [clients, setClients] = useState<any[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [searchClient, setSearchClient] = useState('')
  const [showScheduled, setShowScheduled] = useState(false)
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [syncingContacts, setSyncingContacts] = useState(false)
  const [bulkProgress, setBulkProgress] = useState<any>(null)

  useEffect(() => { const p = async () => { try { const r = await fetch('/api/whatsapp/status'); const d = await r.json(); setStatus(d.status || 'disconnected') } catch {} }; p(); const i = setInterval(p, 5000); return () => clearInterval(i) }, [])
  const fetchClients = useCallback(async () => { try { const r = await fetch(`/api/marketing?target=${target}`, { cache: 'no-store' }); const d = await r.json(); const list = Array.isArray(d) ? d : []; setClients(list); setSelected(new Set(list.map((c: any) => c.id))) } catch { toast({ title: 'Error', variant: 'destructive' }) } finally { setLoading(false) } }, [target, toast])
  useEffect(() => { fetchClients() }, [fetchClients])
  const syncContacts = async () => { if (!window.confirm('¿Importar contactos?')) return; setSyncingContacts(true); try { const res = await fetch('/api/whatsapp/sync-contacts', { method: 'POST' }); const data = await res.json(); if (res.ok) { toast({ title: '✅ Sincronización completada', description: `${data.nuevos} nuevos` }); fetchClients() } } catch {} finally { setSyncingContacts(false) } }
  const charCount = message.length
  const filteredClients = clients.filter(c => !searchClient || c.nombre.toLowerCase().includes(searchClient.toLowerCase()) || c.telefono.includes(searchClient))
  const toggleSelection = (id: string) => { const n = new Set(selected); if (n.has(id)) n.delete(id); else n.add(id); setSelected(n) }

  const handleSend = async () => {
    if (!message.trim() || selected.size === 0) return
    const recipients = clients.filter(c => selected.has(c.id))
    if (charCount > WHATSAPP_LIMIT) { toast({ title: 'Error', description: `Supera ${WHATSAPP_LIMIT} caracteres`, variant: 'destructive' }); return }
    if (showScheduled && scheduledDate && scheduledTime) { const f = new Date(`${scheduledDate}T${scheduledTime}`); if (f.getTime() <= Date.now()) { toast({ title: 'Error', description: 'Fecha debe ser futura', variant: 'destructive' }); return } try { await fetch('/api/marketing/scheduled', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: `Campaña ${new Date().toLocaleDateString('es-UY')}`, target, mensaje: message.trim(), programada_para: f.toISOString() }) }); toast({ title: '✅ Campaña programada' }) } catch {} return }
    if (status !== 'connected') { if (!window.confirm(`WhatsApp no conectado. Se abrirán ${recipients.length} ventanas de WhatsApp Web. ¿Continuar?`)) return; setSending(true); setBulkProgress(null); let ok = 0; for (const c of recipients) { const text = message.replace(/\{nombre\}/g, c.nombre.split(' ')[0] || c.nombre); window.open(`https://wa.me/${c.telefono.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`, '_blank'); ok++; setBulkProgress({ total: recipients.length, sent: ok, failed: 0, current: c.nombre, progress: Math.round((ok / recipients.length) * 100) }); await new Promise(r => setTimeout(r, 2000)) } setSending(false); toast({ title: 'Ventanas abiertas', description: `${ok} ventanas` }); return }
    if (!window.confirm(`Enviar a ${recipients.length} cliente(s)?`)) return
    setSending(true); setBulkProgress(null); let ok = 0, fail = 0; let campaignId = null
    try { const cr = await fetch('/api/marketing/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: `Campaña ${new Date().toLocaleDateString('es-UY')}`, canal: 'whatsapp', target, mensaje: message.trim(), total_destinatarios: recipients.length, estado: 'enviando' }) }); const cd = await cr.json(); if (cr.ok) campaignId = cd.campaign_id } catch {}
    for (const c of recipients) { const text = message.replace(/\{nombre\}/g, c.nombre.split(' ')[0] || c.nombre).replace(/\{monto\}/g, c.deuda?.toLocaleString('es-UY') || '0'); try { const r = await fetch('/api/whatsapp/send-message', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: `${c.telefono.replace(/[^0-9]/g, '')}@s.whatsapp.net`, text }) }); if (r.ok) ok++; else fail++ } catch { fail++ } setBulkProgress({ total: recipients.length, sent: ok, failed: fail, current: c.nombre, progress: Math.round(((ok + fail) / recipients.length) * 100) }); await new Promise(r => setTimeout(r, 500)) }
    if (campaignId) { try { await fetch(`/api/marketing/campaigns/${campaignId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: 'completada', enviados: ok, fallidos: fail }) }) } catch {} }
    setSending(false); toast({ title: 'Envío completado', description: `✅ ${ok} OK, ❌ ${fail} fallidos` })
  }

  return (
    <div className="space-y-4">
      {status === 'connected' && <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50"><CardContent className="p-3 flex items-center justify-between"><div className="flex items-center gap-2"><div className="rounded-full bg-emerald-100 p-2"><Wifi className="h-4 w-4 text-emerald-600" /></div><div><p className="text-sm font-bold text-emerald-900">WhatsApp Conectado</p><p className="text-xs text-emerald-700">Importá contactos del celular</p></div></div><Button onClick={syncContacts} disabled={syncingContacts} variant="outline" size="sm" className="border-emerald-300 text-emerald-700">{syncingContacts ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}Sincronizar</Button></CardContent></Card>}
      {status !== 'connected' && <Card className="border-amber-200 bg-amber-50"><CardContent className="p-3 flex items-start gap-3"><AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" /><div className="text-sm"><p className="font-semibold text-amber-800">WhatsApp no conectado</p><p className="text-amber-700 mt-0.5 text-xs">Se abrirán ventanas de WhatsApp Web como fallback</p></div></CardContent></Card>}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <Card><CardHeader className="pb-3"><CardTitle className="text-base">Destinatarios</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Select value={target} onValueChange={setTarget}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="particular">Particulares</SelectItem><SelectItem value="comercio">Comercios</SelectItem><SelectItem value="deudor">Deudores</SelectItem><SelectItem value="inactivos">Inactivos 30+</SelectItem><SelectItem value="lead">Leads</SelectItem></SelectContent></Select>
              <div className="flex justify-between text-xs"><span><strong>{clients.length}</strong> con teléfono · <strong>{selected.size}</strong> seleccionados</span><div className="flex gap-2"><button onClick={() => setSelected(new Set(clients.map(c => c.id)))} className="text-emerald-600">Todos</button><button onClick={() => setSelected(new Set())} className="text-gray-400">Ninguno</button></div></div>
              {clients.length > 0 && <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input placeholder="Buscar..." value={searchClient} onChange={e => setSearchClient(e.target.value)} className="pl-9 h-9" /></div>}
              <ScrollArea className="h-64 rounded-lg border bg-white">{loading ? <Loader2 className="h-6 w-6 animate-spin mx-auto my-8" /> : filteredClients.map(c => <label key={c.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer border-b"><Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleSelection(c.id)} /><div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{c.nombre}</p><p className="text-xs text-gray-500">{c.telefono}</p></div>{c.deuda > 0 && <Badge variant="destructive" className="text-[10px]">${c.deuda.toLocaleString('es-UY')}</Badge>}</label>)}</ScrollArea>
            </CardContent>
          </Card>
          <Card><CardHeader className="pb-3"><CardTitle className="text-base">Mensaje</CardTitle><CardDescription className="text-xs">Usá <code className="bg-slate-100 px-1 rounded">{'{nombre}'}</code> y <code className="bg-slate-100 px-1 rounded">{'{monto}'}</code></CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <Textarea rows={5} value={message} onChange={e => setMessage(e.target.value)} className="resize-none" placeholder="¡Hola {nombre}!..." />
              <div className="flex justify-between text-xs"><span className="text-gray-400">Variables: {'{nombre}'}, {'{monto}'}</span><span className={charCount > WHATSAPP_LIMIT ? 'text-red-600 font-bold' : charCount > WHATSAPP_LIMIT * 0.9 ? 'text-amber-600 font-bold' : 'text-gray-400'}>{charCount} / {WHATSAPP_LIMIT}</span></div>
              <div className="flex flex-wrap gap-1.5">{TEMPLATES.map(t => <Button key={t.name} variant="outline" size="sm" className="text-xs h-7" onClick={() => setMessage(t.text)}>{t.name}</Button>)}</div>
              <Separator />
              <label className="flex items-center gap-2 cursor-pointer"><Checkbox checked={showScheduled} onCheckedChange={v => setShowScheduled(!!v)} /><span className="text-sm font-medium"><Clock className="h-4 w-4 inline mr-1 text-purple-600" />Programar envío</span></label>
              {showScheduled && <div className="grid grid-cols-2 gap-2 pl-6"><div><Label className="text-xs">Fecha</Label><Input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} min={new Date().toISOString().split('T')[0]} /></div><div><Label className="text-xs">Hora</Label><Input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} /></div></div>}
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-2 space-y-4">
          <Card><CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Eye className="h-4 w-4 text-indigo-600" /> Vista Previa</CardTitle></CardHeader>
            <CardContent><div className="bg-[#e5ddd5] rounded-lg p-4 min-h-[140px]"><div className="bg-[#dcf8c6] rounded-lg p-3 max-w-[85%] ml-auto shadow-sm"><p className="text-sm whitespace-pre-wrap">{message || 'Escribí un mensaje...'}</p></div></div></CardContent>
          </Card>
          <Card><CardHeader className="pb-3"><CardTitle className="text-base">Envío</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className={`p-2.5 rounded-lg text-sm ${status === 'connected' ? 'bg-emerald-50' : 'bg-amber-50'}`}>{status === 'connected' ? <><Wifi className="h-4 w-4 inline text-green-600 mr-1" /><span className="text-green-700 font-medium">Envío directo</span></> : <><WifiOff className="h-4 w-4 inline text-amber-600 mr-1" /><span className="text-amber-700 font-medium">WhatsApp Web fallback</span></>}</div>
              {sending && bulkProgress && <div className="space-y-2"><div className="flex justify-between text-sm"><span>Enviando a: <strong>{bulkProgress.current}</strong></span><span>{bulkProgress.progress}%</span></div><div className="w-full h-2 bg-gray-200 rounded-full"><div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${bulkProgress.progress}%` }} /></div><div className="flex justify-between text-xs text-gray-500"><span>✅ {bulkProgress.sent}</span><span>❌ {bulkProgress.failed}</span><span>Total: {bulkProgress.total}</span></div></div>}
              <Button onClick={handleSend} disabled={sending || selected.size === 0 || !message.trim() || charCount > WHATSAPP_LIMIT} className={`w-full text-white py-5 text-base font-bold ${showScheduled ? 'bg-purple-600 hover:bg-purple-700' : 'bg-green-600 hover:bg-green-700'}`}>{sending ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : showScheduled ? <><Clock className="h-5 w-5 mr-2" />Programar ({selected.size})</> : <><Send className="h-5 w-5 mr-2" />Enviar a {selected.size} cliente(s)</>}</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function HistorialTab() {
  const [campaigns, setCampañas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { toast } = useToast()
  const fetchCampaigns = useCallback(async () => { setRefreshing(true); try { const res = await fetch('/api/marketing/campaigns', { cache: 'no-store' }); const d = await res.json(); setCampañas(d.campaigns || []) } catch {} finally { setLoading(false); setRefreshing(false) } }, [])
  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])
  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-purple-600" /></div>
  const estadoConfig: Record<string, string> = { borrador: 'border-gray-300 text-gray-600 bg-gray-50', completada: 'border-emerald-300 text-emerald-700 bg-emerald-50', enviando: 'border-blue-300 text-blue-700 bg-blue-50', fallida: 'border-red-300 text-red-700 bg-red-50', programada: 'border-purple-300 text-purple-700 bg-purple-50' }
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center"><h3 className="font-bold">Historial de Campañas</h3><Button variant="outline" size="sm" onClick={fetchCampaigns} disabled={refreshing}><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /></Button></div>
      {campaigns.length > 0 && <div className="grid grid-cols-2 md:grid-cols-4 gap-3"><Card className="shadow-sm"><CardContent className="p-3 text-center"><p className="text-xs uppercase font-bold text-gray-500">Total</p><p className="text-2xl font-black text-purple-700">{campaigns.length}</p></CardContent></Card><Card className="shadow-sm"><CardContent className="p-3 text-center"><p className="text-xs uppercase font-bold text-gray-500">Completadas</p><p className="text-2xl font-black text-emerald-700">{campaigns.filter(c => c.estado === 'completada').length}</p></CardContent></Card><Card className="shadow-sm"><CardContent className="p-3 text-center"><p className="text-xs uppercase font-bold text-gray-500">Programadas</p><p className="text-2xl font-black text-purple-700">{campaigns.filter(c => c.estado === 'programada').length}</p></CardContent></Card><Card className="shadow-sm"><CardContent className="p-3 text-center"><p className="text-xs uppercase font-bold text-gray-500">Enviados</p><p className="text-2xl font-black text-blue-700">{campaigns.reduce((s, c) => s + (c.enviados || 0), 0)}</p></CardContent></Card></div>}
      {campaigns.length === 0 ? <Card className="border-purple-100"><CardContent className="py-12 flex flex-col items-center text-center"><div className="rounded-full bg-purple-100 p-4 mb-3"><History className="h-10 w-10 text-purple-600" /></div><h3 className="text-lg font-bold">No hay campañas todavía</h3></CardContent></Card> :
        <div className="space-y-2">{campaigns.map(c => <Card key={c.id} className="shadow-sm"><CardContent className="p-4"><div className="flex items-start justify-between gap-3"><div className="flex-1 min-w-0"><div className="flex items-center gap-2 flex-wrap mb-1"><Badge variant="outline" className={`text-xs ${estadoConfig[c.estado] || estadoConfig.borrador}`}>{c.estado}</Badge><Badge variant="outline" className="text-xs">{c.canal}</Badge>{c.target && <Badge variant="outline" className="text-xs text-gray-600">{c.target}</Badge>}</div><p className="font-bold text-sm truncate">{c.nombre}</p><p className="text-xs text-gray-500 line-clamp-1">{c.mensaje}</p><div className="flex items-center gap-3 mt-1 text-xs text-gray-500"><span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(c.created_at).toLocaleString('es-UY', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>{c.total_destinatarios > 0 && <span className="text-blue-700 font-bold">{c.enviados || 0}/{c.total_destinatarios}</span>}</div></div><Button variant="ghost" size="sm" onClick={() => { if (window.confirm('¿Eliminar?')) { fetch(`/api/marketing/campaigns/${c.id}`, { method: 'DELETE' }).then(() => fetchCampaigns()) } }} className="text-red-500 shrink-0"><Trash2 className="h-3.5 w-3.5" /></Button></div></CardContent></Card>)}</div>}
    </div>
  )
}

function PlantillasTab() {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ nombre: '', texto: '', canal: 'whatsapp', favorita: false })
  const fetchTemplates = useCallback(async () => { try { const res = await fetch('/api/marketing/templates', { cache: 'no-store' }); const d = await res.json(); setTemplates(d.templates || []) } catch {} finally { setLoading(false) } }, [])
  useEffect(() => { fetchTemplates() }, [fetchTemplates])
  const handleSubmit = async () => { if (!form.nombre || !form.texto) { toast({ title: 'Error', variant: 'destructive' }); return } setSubmitting(true); try { const res = await fetch('/api/marketing/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); if (res.ok) { toast({ title: '✅ Plantilla creada' }); setForm({ nombre: '', texto: '', canal: 'whatsapp', favorita: false }); setShowForm(false); fetchTemplates() } } catch {} finally { setSubmitting(false) } }
  const toggleFav = async (t: any) => { try { await fetch(`/api/marketing/templates/${t.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ favorita: !t.favorita }) }); fetchTemplates() } catch {} }
  const deleteT = async (t: any) => { if (!window.confirm(`¿Eliminar "${t.nombre}"?`)) return; try { await fetch(`/api/marketing/templates/${t.id}`, { method: 'DELETE' }); toast({ title: '✅ Eliminada' }); fetchTemplates() } catch {} }
  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
  return (
    <div className="space-y-4">
      <div className="flex justify-between"><div><h3 className="font-bold">Plantillas personalizadas</h3><p className="text-xs text-gray-500">Las ⭐ aparecen en el composer</p></div><Button onClick={() => setShowForm(!showForm)} className="bg-purple-600 hover:bg-purple-700"><Plus className="h-4 w-4 mr-1" /> Nueva</Button></div>
      {showForm && <Card className="border-purple-300"><CardContent className="p-4 space-y-3"><div className="grid grid-cols-2 gap-3"><div><Label>Nombre</Label><Input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} /></div><div><Label>Canal</Label><Select value={form.canal} onValueChange={v => setForm({ ...form, canal: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="facebook">Facebook</SelectItem><SelectItem value="instagram">Instagram</SelectItem></SelectContent></Select></div></div><div><Label>Texto</Label><Textarea rows={4} value={form.texto} onChange={e => setForm({ ...form, texto: e.target.value })} placeholder="Usá {nombre} y {monto}..." /></div><label className="flex items-center gap-2"><input type="checkbox" checked={form.favorita} onChange={e => setForm({ ...form, favorita: e.target.checked })} /><Star className={`h-4 w-4 ${form.favorita ? 'text-amber-500 fill-amber-500' : 'text-gray-400'}`} /><span className="text-sm">Favorita</span></label><div className="flex gap-2 justify-end"><Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button><Button onClick={handleSubmit} disabled={submitting} className="bg-purple-600 hover:bg-purple-700">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear'}</Button></div></CardContent></Card>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{templates.map(t => <Card key={t.id} className={`shadow-sm ${t.favorita ? 'border-amber-300 bg-amber-50/30' : ''}`}><CardContent className="p-4"><div className="flex justify-between mb-2"><Badge variant="outline" className="text-xs">{t.canal}</Badge><button onClick={() => toggleFav(t)}><Star className={`h-4 w-4 ${t.favorita ? 'text-amber-500 fill-amber-500' : 'text-gray-300'}`} /></button></div><p className="font-bold text-sm">{t.nombre}</p><p className="text-xs text-gray-600 mt-1 line-clamp-3">{t.texto}</p><div className="flex justify-end mt-2"><Button variant="ghost" size="sm" onClick={() => deleteT(t)} className="text-red-500"><Trash2 className="h-3.5 w-3.5" /></Button></div></CardContent></Card>)}</div>
    </div>
  )
}

function RedesTab() {
  const { toast } = useToast()
  const [conexiones, setConexiones] = useState<any[]>([])
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showConnect, setShowConnect] = useState(false)
  const [connForm, setConnForm] = useState({ plataforma: 'facebook', account_id: '', account_name: '', access_token: '' })
  const [submitting, setSubmitting] = useState(false)
  const fetchData = useCallback(async () => { try { const [r1, r2] = await Promise.all([fetch('/api/social/connect', { cache: 'no-store' }), fetch('/api/social/feed', { cache: 'no-store' })]); const d1 = await r1.json(); const d2 = await r2.json(); setConexiones(d1.conexiones || []); setPosts(d2.posts || []) } catch {} finally { setLoading(false) } }, [])
  useEffect(() => { fetchData() }, [fetchData])
  const handleConnect = async () => { if (!connForm.account_id || !connForm.access_token) { toast({ title: 'Error', variant: 'destructive' }); return } setSubmitting(true); try { const res = await fetch('/api/social/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(connForm) }); if (res.ok) { toast({ title: '✅ Conexión guardada' }); setShowConnect(false); setConnForm({ plataforma: 'facebook', account_id: '', account_name: '', access_token: '' }); fetchData() } } catch {} finally { setSubmitting(false) } }
  const handleDisconnect = async (id: string) => { if (!window.confirm('¿Desconectar?')) return; try { await fetch(`/api/social/connect?id=${id}`, { method: 'DELETE' }); fetchData() } catch {} }
  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
  return (
    <div className="space-y-4">
      <Card className="border-blue-200 bg-blue-50/50"><CardContent className="p-3 flex items-start gap-2"><AlertCircle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" /><div className="text-xs text-blue-900"><p className="font-bold">Integración con Facebook e Instagram</p><p>Para conectar, necesitás un Access Token de Meta. Obtenelo en <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="underline">Graph API Explorer</a>.</p></div></CardContent></Card>
      <Card><CardHeader><div className="flex justify-between"><CardTitle className="text-base flex items-center gap-2"><Link2 className="h-4 w-4 text-purple-600" /> Cuentas Conectadas</CardTitle><Button size="sm" onClick={() => setShowConnect(!showConnect)} className="bg-purple-600 hover:bg-purple-700"><Plus className="h-4 w-4 mr-1" /> Conectar</Button></div></CardHeader>
        <CardContent>{showConnect && <div className="mb-4 p-4 border rounded-lg space-y-3"><div className="grid grid-cols-2 gap-2"><button onClick={() => setConnForm({ ...connForm, plataforma: 'facebook' })} className={`p-3 rounded-lg border-2 flex items-center gap-2 ${connForm.plataforma === 'facebook' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200'}`}><Facebook className="h-5 w-5" /><span className="font-bold text-sm">Facebook</span></button><button onClick={() => setConnForm({ ...connForm, plataforma: 'instagram' })} className={`p-3 rounded-lg border-2 flex items-center gap-2 ${connForm.plataforma === 'instagram' ? 'border-pink-500 bg-pink-50 text-pink-700' : 'border-gray-200'}`}><Instagram className="h-5 w-5" /><span className="font-bold text-sm">Instagram</span></button></div><div><Label className="text-xs">Account ID *</Label><Input value={connForm.account_id} onChange={e => setConnForm({ ...connForm, account_id: e.target.value })} /></div><div><Label className="text-xs">Nombre</Label><Input value={connForm.account_name} onChange={e => setConnForm({ ...connForm, account_name: e.target.value })} /></div><div><Label className="text-xs">Access Token *</Label><Textarea rows={2} value={connForm.access_token} onChange={e => setConnForm({ ...connForm, access_token: e.target.value })} className="font-mono text-xs" /></div><div className="flex gap-2 justify-end"><Button variant="outline" onClick={() => setShowConnect(false)}>Cancelar</Button><Button onClick={handleConnect} disabled={submitting} className="bg-purple-600 hover:bg-purple-700">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Conectar'}</Button></div></div>}
          {conexiones.length === 0 ? <p className="text-center text-sm text-gray-400 py-6">No hay redes conectadas</p> : <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{conexiones.map(c => <div key={c.id} className="flex items-center gap-3 p-3 border rounded-lg"><div className={`p-2 rounded-full ${c.plataforma === 'facebook' ? 'bg-blue-100' : 'bg-pink-100'}`}>{c.plataforma === 'facebook' ? <Facebook className="h-5 w-5 text-blue-600" /> : <Instagram className="h-5 w-5 text-pink-600" />}</div><div className="flex-1 min-w-0"><p className="text-sm font-bold truncate">{c.account_name || c.account_id}</p><p className="text-xs text-gray-500 capitalize">{c.plataforma}</p></div><button onClick={() => handleDisconnect(c.id)} className="text-red-400"><Link2Off className="h-4 w-4" /></button></div>)}</div>}
        </CardContent>
      </Card>
      {posts.length > 0 && <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{posts.map(p => <Card key={p.id} className="shadow-sm overflow-hidden">{p.image_url && <div className="aspect-video bg-gray-100"><img src={p.image_url} alt="" className="w-full h-full object-cover" /></div>}<CardContent className="p-3"><div className="flex items-center gap-2 mb-2"><div className={`p-1.5 rounded-full ${p.plataforma === 'facebook' ? 'bg-blue-100' : 'bg-pink-100'}`}>{p.plataforma === 'facebook' ? <Facebook className="h-3.5 w-3.5 text-blue-600" /> : <Instagram className="h-3.5 w-3.5 text-pink-600" />}</div><span className="text-xs text-gray-500">{new Date(p.publicado_en).toLocaleDateString('es-UY')}</span>{p.permalink && <a href={p.permalink} target="_blank" rel="noopener noreferrer" className="ml-auto text-gray-400"><ExternalLink className="h-3.5 w-3.5" /></a>}</div><p className="text-sm line-clamp-3">{p.contenido || '(sin texto)'}</p><Separator className="my-2" /><div className="flex items-center gap-4 text-xs text-gray-500"><span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{p.likes}</span><span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{p.comments}</span><span className="flex items-center gap-1"><Share2 className="h-3.5 w-3.5" />{p.shares}</span></div></CardContent></Card>)}</div>}
    </div>
  )
}
