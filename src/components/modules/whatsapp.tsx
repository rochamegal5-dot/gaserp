'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import { MessageCircle, Loader2, Wifi, WifiOff, QrCode, RefreshCw, Phone, Send, Zap, X, Check, Users, AlertCircle, Clock } from 'lucide-react'

const PLANTILLAS = [
  { id: 'recordatorio_pago', titulo: 'Recordatorio de pago', icon: '💰', texto: 'Hola {nombre}, te recordamos que tenés un saldo pendiente de ${monto}. ¡Gracias!' },
  { id: 'pedido_camino', titulo: 'Pedido en camino', icon: '🚚', texto: 'Hola {nombre}! Tu pedido está en camino. Llegará en aprox. 30 min.' },
  { id: 'pedido_entregado', titulo: 'Pedido entregado', icon: '✅', texto: 'Hola {nombre}, tu pedido fue entregado. ¡Gracias por tu compra!' },
  { id: 'saludo_buenos_dias', titulo: 'Buenos días', icon: '☀️', texto: 'Buenos días {nombre}! ¿Necesitás garrafas o tubos? Avisanos!' },
  { id: 'promocion', titulo: 'Promoción', icon: '🎉', texto: 'Hola {nombre}! 🔥 Tenemos una promo especial esta semana.' },
  { id: 'cierre_jornada', titulo: 'Cierre de jornada', icon: '🌙', texto: 'Hola {nombre}, cerramos por hoy. Mañana volvemos 8 am.' },
]

export function WhatsAppModule() {
  const { toast } = useToast()
  const [status, setStatus] = useState('disconnected')
  const [qr, setQr] = useState<string | null>(null)
  const [chats, setChats] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [activeChat, setActiveChat] = useState<string | null>(null)
  const [msgInput, setMsgInput] = useState('')
  const [showTemplates, setShowTemplates] = useState(false)
  const [showClientDialog, setShowClientDialog] = useState(false)
  const [clientes, setClientes] = useState<any[]>([])
  const [clientSearch, setClientSearch] = useState('')
  const [sending, setSending] = useState(false)
  const [qrReceivedAt, setQrReceivedAt] = useState<number | null>(null)
  const [qrSecondsLeft, setQrSecondsLeft] = useState(60)
  const [deudores, setDeudores] = useState<any[]>([])
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [bulkMessage, setBulkMessage] = useState('')
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())
  const [bulkSending, setBulkSending] = useState(false)
  const [bulkResults, setBulkResults] = useState<any[]>([])
  const [syncingContacts, setSyncingContacts] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/whatsapp/status', { cache: 'no-store' })
        const data = await res.json()
        setStatus(data.status || 'disconnected')
        if (data.qr) { setQr(data.qr); setQrReceivedAt(Date.now()); setQrSecondsLeft(60) }
        else if (data.status !== 'qr') { setQr(null); setQrReceivedAt(null) }
        if (data.status === 'connected') {
          const cr = await fetch('/api/whatsapp/chats', { cache: 'no-store' })
          const cd = await cr.json()
          setChats(cd.chats || [])
        }
      } catch {}
    }
    poll()
    const i = setInterval(poll, 3000)
    return () => clearInterval(i)
  }, [])

  useEffect(() => {
    if (status !== 'qr' || !qrReceivedAt) return
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - qrReceivedAt) / 1000)
      const remaining = Math.max(0, 60 - elapsed)
      setQrSecondsLeft(remaining)
      if (remaining === 10) fetch('/api/whatsapp/request-qr', { method: 'POST' })
    }, 1000)
    return () => clearInterval(interval)
  }, [status, qrReceivedAt])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const fetchDeudores = useCallback(async () => {
    try {
      const res = await fetch('/api/finanzas/cobrar', { cache: 'no-store' })
      const d = await res.json()
      setDeudores((d.cobros || []).filter((c: any) => c.telefono))
      setBulkSelected(new Set((d.cobros || []).map((c: any) => c.id)))
    } catch {}
  }, [])

  useEffect(() => {
    if (bulkDialogOpen) {
      fetchDeudores()
      if (!bulkMessage) setBulkMessage('Hola {nombre}, te recordamos que tenés un saldo pendiente de ${monto}. ¡Gracias!')
    }
  }, [bulkDialogOpen, fetchDeudores, bulkMessage])

  const syncContacts = async () => {
    if (!window.confirm('¿Importar contactos de WhatsApp?')) return
    setSyncingContacts(true)
    try {
      const res = await fetch('/api/whatsapp/sync-contacts', { method: 'POST' })
      const data = await res.json()
      if (res.ok) toast({ title: '✅ Sincronización completada', description: `${data.nuevos} nuevos, ${data.actualizados} actualizados` })
    } catch { toast({ title: 'Error', variant: 'destructive' }) }
    finally { setSyncingContacts(false) }
  }

  const requestQR = async () => {
    setStatus('connecting')
    setQr(null)
    setQrReceivedAt(null)
    try { await fetch('/api/whatsapp/request-qr', { method: 'POST' }) } catch {}
  }

  const openChat = async (jid: string) => {
    setActiveChat(jid)
    setMessages([])
    try {
      const res = await fetch(`/api/whatsapp/messages?jid=${encodeURIComponent(jid)}`)
      const d = await res.json()
      setMessages(d.messages || [])
    } catch {}
  }

  const fetchClientes = useCallback(async () => {
    try {
      const res = await fetch('/api/clientes', { cache: 'no-store' })
      const d = await res.json()
      setClientes(Array.isArray(d) ? d : (d.clientes || []))
    } catch {}
  }, [])

  const selectClient = (c: any) => {
    if (!c.telefono) return
    const phone = c.telefono.replace(/[^0-9]/g, '')
    const jid = `${phone}@s.whatsapp.net`
    setChats(prev => prev.find(c => c.id === jid) ? prev : [{ id: jid, name: `${c.apellido1 || ''} ${c.nombre1 || ''}`.trim(), unreadCount: 0, timestamp: Math.floor(Date.now() / 1000), lastMessage: '' }, ...prev])
    openChat(jid)
    setShowClientDialog(false)
    setClientSearch('')
  }

  const filteredClientes = clientes.filter(c => {
    if (!c.telefono) return false
    if (!clientSearch) return true
    const q = clientSearch.toLowerCase()
    return `${c.apellido1 || ''} ${c.nombre1 || ''}`.trim().toLowerCase().includes(q) || c.telefono.includes(clientSearch)
  })

  const sendMessage = async () => {
    if (!activeChat || !msgInput.trim()) return
    setSending(true)
    const text = msgInput.trim()
    setMsgInput('')
    setMessages(prev => [...prev, { text, fromMe: true, timestamp: Math.floor(Date.now() / 1000), key: { id: 'opt-' + Date.now() } }])
    try {
      const res = await fetch('/api/whatsapp/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: activeChat, text }),
      })
      if (!res.ok) {
        setMessages(prev => prev.filter(m => m.key.id !== 'opt-' + Date.now()))
        const d = await res.json()
        toast({ title: 'Error', description: d.error, variant: 'destructive' })
      }
    } catch { toast({ title: 'Error', description: 'No se pudo enviar', variant: 'destructive' }) }
    finally { setSending(false) }
  }

  const insertarPlantilla = (p: typeof PLANTILLAS[0]) => {
    if (!activeChat) return
    const nombre = (chats.find(c => c.id === activeChat)?.name || '').split(' ')[0] || ''
    const texto = p.texto.replace(/\{nombre\}/g, nombre).replace(/\{monto\}/g, '0').replace(/\{tiempo\}/g, '30').replace(/\{promo\}/g, '2x1 en garrafas')
    setMsgInput(prev => prev ? prev + '\n' + texto : texto)
    setShowTemplates(false)
  }

  const enviarMasivo = async () => {
    if (bulkSelected.size === 0 || !bulkMessage.trim()) return
    if (status !== 'connected') { toast({ title: 'WhatsApp no conectado', variant: 'destructive' }); return }
    if (!window.confirm(`¿Enviar a ${bulkSelected.size} deudor(es)?`)) return
    setBulkSending(true)
    setBulkResults([])
    const resultados: any[] = []
    for (const d of deudores) {
      if (!bulkSelected.has(d.id)) continue
      const telefono = d.telefono.replace(/[^0-9]/g, '')
      const jid = `${telefono}@s.whatsapp.net`
      const nombre = d.nombre.split(' ')[0] || ''
      const texto = bulkMessage.replace(/\{nombre\}/g, nombre).replace(/\{monto\}/g, d.total_adeudado.toLocaleString('es-UY'))
      try {
        const res = await fetch('/api/whatsapp/send-message', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: jid, text: texto }) })
        const data = await res.json()
        resultados.push({ nombre: d.nombre, telefono: d.telefono, success: res.ok && data.success })
      } catch { resultados.push({ nombre: d.nombre, telefono: d.telefono, success: false }) }
      setBulkResults([...resultados])
      await new Promise(r => setTimeout(r, 500))
    }
    toast({ title: 'Envío completado', description: `${resultados.filter(r => r.success).length} OK, ${resultados.filter(r => !r.success).length} fallidos` })
    setBulkSending(false)
  }

  const toggleDeudor = (id: string) => { const n = new Set(bulkSelected); if (n.has(id)) n.delete(id); else n.add(id); setBulkSelected(n) }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">WhatsApp</h1><p className="text-sm text-gray-500">Mensajía integrada</p></div>
        <div className="flex items-center gap-2">
          {status === 'connected' && <Button variant="outline" size="sm" onClick={syncContacts} disabled={syncingContacts}><RefreshCw className={`h-4 w-4 mr-1 ${syncingContacts ? 'animate-spin' : ''}`} /> Sync</Button>}
          <Badge className={status === 'connected' ? 'bg-emerald-100 text-emerald-700' : status === 'qr' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}>
            {status === 'connected' ? <><Wifi className="h-3 w-3 mr-1" /> Conectado</> : status === 'qr' ? <><QrCode className="h-3 w-3 mr-1" /> Escaneá QR</> : <><WifiOff className="h-3 w-3 mr-1" /> Desconectado</>}
          </Badge>
        </div>
      </div>

      {status !== 'connected' ? (
        <Card className="max-w-md mx-auto shadow-lg border-emerald-100 overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-emerald-500 to-teal-600" />
          <CardContent className="p-8 flex flex-col items-center text-center">
            <div className={`relative mb-6 ${status === 'connecting' ? 'animate-pulse' : ''}`}>
              <div className="h-24 w-24 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                {status === 'connecting' ? <Loader2 className="h-12 w-12 text-white animate-spin" /> : status === 'qr' ? <QrCode className="h-12 w-12 text-white" /> : <Phone className="h-12 w-12 text-white" />}
              </div>
              {status === 'connecting' && <div className="absolute inset-0 rounded-full bg-emerald-400 opacity-30 animate-ping" />}
            </div>
            {status === 'qr' && qr ? (
              <>
                <h3 className="text-2xl font-black mb-2">Escaneá el Código QR</h3>
                <p className="text-sm text-gray-500 mb-5">Abrí WhatsApp → Dispositivos vinculados → Vincular dispositivo → Escaneá este código QR</p>
                <div className="bg-white rounded-2xl p-4 shadow-lg border-2 border-emerald-100 mb-3 relative">
                  <img src={qr.startsWith('data:') ? qr : `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qr)}`} alt="WhatsApp QR" className="w-64 h-64" />
                  <div className="absolute top-2 left-2 w-6 h-6 border-t-4 border-l-4 border-emerald-500 rounded-tl-lg" />
                  <div className="absolute top-2 right-2 w-6 h-6 border-t-4 border-r-4 border-emerald-500 rounded-tr-lg" />
                  <div className="absolute bottom-2 left-2 w-6 h-6 border-b-4 border-l-4 border-emerald-500 rounded-bl-lg" />
                  <div className="absolute bottom-2 right-2 w-6 h-6 border-b-4 border-r-4 border-emerald-500 rounded-br-lg" />
                  {qrSecondsLeft <= 10 && qrSecondsLeft > 0 && (
                    <div className="absolute inset-0 bg-amber-500/10 rounded-2xl flex items-center justify-center">
                      <div className="bg-amber-500 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">⚠️ Expira en {qrSecondsLeft}s</div>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-center gap-2 mb-3">
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-1000 ${qrSecondsLeft > 30 ? 'bg-emerald-500' : qrSecondsLeft > 10 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${(qrSecondsLeft / 60) * 100}%` }} />
                  </div>
                  <span className={`text-xs font-bold tabular-nums ${qrSecondsLeft > 30 ? 'text-emerald-600' : qrSecondsLeft > 10 ? 'text-amber-600' : 'text-red-600'}`}>{qrSecondsLeft}s</span>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  {qrSecondsLeft > 10 ? 'El código se actualizará automáticamente si expira' : qrSecondsLeft > 0 ? '⚠️ El código está por expirar — se va a regenerar' : '🔄 Regenerando código QR...'}
                </p>
                <Button variant="outline" onClick={requestQR} className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                  <RefreshCw className="mr-2 h-4 w-4" /> Regenerar QR ahora
                </Button>
              </>
            ) : status === 'connecting' ? (
              <>
                <h3 className="text-2xl font-black mb-2">Conectando...</h3>
                <p className="text-sm text-gray-500 mb-6">Esperando respuesta del servidor de WhatsApp</p>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="h-2 w-2 rounded-full bg-emerald-600 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </>
            ) : (
              <>
                <h3 className="text-2xl font-black mb-2">Conectar WhatsApp</h3>
                <p className="text-sm text-gray-500 mb-6">Vinculá tu cuenta para enviar y recibir mensajes, sincronizar contactos y enviar campañas masivas.</p>
                <Button onClick={requestQR} className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 h-12 text-base font-bold shadow-md" size="lg">
                  <QrCode className="mr-2 h-5 w-5" /> Generar Código QR
                </Button>
                <div className="mt-6 pt-6 border-t border-gray-100 w-full">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">¿Cómo funciona?</p>
                  <div className="space-y-2 text-left">
                    <div className="flex items-start gap-2 text-xs text-gray-600"><span className="font-bold text-emerald-600">1.</span><span>Generá el código QR haciendo clic arriba</span></div>
                    <div className="flex items-start gap-2 text-xs text-gray-600"><span className="font-bold text-emerald-600">2.</span><span>Abrí WhatsApp → Configuración → Dispositivos vinculados</span></div>
                    <div className="flex items-start gap-2 text-xs text-gray-600"><span className="font-bold text-emerald-600">3.</span><span>Tocá "Vincular dispositivo" y escaneá el código QR</span></div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-1">
            <CardContent className="p-0">
              <div className="p-3 border-b flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2"><MessageCircle className="h-4 w-4 text-emerald-600" /> Chats</h3>
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => { setShowClientDialog(true); fetchClientes() }} className="text-xs"><Users className="h-3.5 w-3.5 mr-1" /> Clientes</Button>
                  <Button variant="outline" size="sm" onClick={() => setBulkDialogOpen(true)} className="text-xs border-amber-300 text-amber-700 hover:bg-amber-50"><Users className="h-3.5 w-3.5 mr-1" /> Masivo</Button>
                </div>
              </div>
              <ScrollArea className="h-[500px]">
                {chats.length === 0 ? <p className="text-center text-sm text-gray-400 py-8">No hay chats</p> : chats.map(c => (
                  <button key={c.id} onClick={() => openChat(c.id)} className={`w-full text-left p-3 border-b hover:bg-emerald-50 ${activeChat === c.id ? 'bg-emerald-50' : ''}`}>
                    <p className="text-sm font-bold truncate">{c.name || c.id.split('@')[0]}</p>
                    <p className="text-xs text-gray-500 truncate">{c.lastMessage || 'Sin mensajes'}</p>
                  </button>
                ))}
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardContent className="p-0 h-[560px] flex flex-col">
              {activeChat ? (
                <>
                  <div className="p-3 border-b"><h3 className="font-bold text-sm">{chats.find(c => c.id === activeChat)?.name || activeChat.split('@')[0]}</h3></div>
                  <ScrollArea className="flex-1 p-3">
                    <div className="space-y-2">
                      {messages.map((m, i) => (
                        <div key={i} className={`flex ${m.fromMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%] rounded-lg px-3 py-2 ${m.fromMe ? 'bg-emerald-100' : 'bg-white border'}`}>
                            <p className="text-sm whitespace-pre-wrap">{m.text}</p>
                            <p className="text-[10px] text-gray-400 mt-1">{new Date((m.timestamp || 0) * 1000).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                  <div className="p-3 border-t space-y-2">
                    {showTemplates && (
                      <div className="border rounded-lg shadow-lg bg-white max-h-64 overflow-y-auto">
                        <div className="sticky top-0 bg-gray-50 px-3 py-2 border-b flex justify-between items-center">
                          <p className="text-xs font-bold uppercase">Plantillas rápidas</p>
                          <button onClick={() => setShowTemplates(false)}><X className="h-4 w-4" /></button>
                        </div>
                        <div className="divide-y divide-gray-50">
                          {PLANTILLAS.map(p => (
                            <button key={p.id} onClick={() => insertarPlantilla(p)} className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-emerald-50 text-left">
                              <span className="text-xl shrink-0">{p.icon}</span>
                              <div className="flex-1 min-w-0"><p className="text-sm font-bold text-gray-800">{p.titulo}</p><p className="text-xs text-gray-500 truncate">{p.texto}</p></div>
                            </button>
                          ))}
                        </div>
                        <div className="px-3 py-2 bg-amber-50 border-t text-xs text-amber-700">💡 Variables: <code>{'{nombre}'}</code>, <code>{'{monto}'}</code>, <code>{'{tiempo}'}</code>, <code>{'{promo}'}</code></div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => setShowTemplates(!showTemplates)} className="text-emerald-600"><Zap className="h-4 w-4" /></Button>
                      <Input placeholder="Escribí un mensaje... (o usá una plantilla ⚡)" value={msgInput} onChange={e => setMsgInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sendMessage() }} className="flex-1" />
                      <Button onClick={sendMessage} disabled={sending || !msgInput.trim()} className="bg-emerald-600 hover:bg-emerald-700">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-400">
                  <div className="text-center"><MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-30" /><p>Seleccioná un chat</p></div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Buscar Cliente dialog */}
      {showClientDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowClientDialog(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between"><h3 className="font-bold text-lg">Buscar Cliente</h3><Button variant="ghost" size="sm" onClick={() => setShowClientDialog(false)}><X className="h-4 w-4" /></Button></div>
            <div className="p-4 space-y-3">
              <Input placeholder="Buscar por nombre o teléfono..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} autoFocus />
              <ScrollArea className="h-[400px] border rounded-lg">
                {filteredClientes.length === 0 ? <p className="text-center text-sm text-gray-400 py-8">No hay clientes con teléfono</p> : filteredClientes.map(c => (
                  <button key={c.id} onClick={() => selectClient(c)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-emerald-50 text-left border-b">
                    <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0"><Phone className="h-4 w-4 text-emerald-600" /></div>
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{c.apellido1 || ''} {c.nombre1 || ''}</p><p className="text-xs text-gray-500">{c.telefono}</p></div>
                    <MessageCircle className="h-4 w-4 text-gray-400 shrink-0" />
                  </button>
                ))}
              </ScrollArea>
            </div>
          </div>
        </div>
      )}

      {/* Bulk send dialog */}
      {bulkDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setBulkDialogOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between"><h3 className="font-bold text-lg flex items-center gap-2"><Users className="h-5 w-5 text-amber-600" /> Envío Masivo a Deudores</h3><Button variant="ghost" size="sm" onClick={() => setBulkDialogOpen(false)}><X className="h-4 w-4" /></Button></div>
            <div className="p-4 space-y-4">
              {bulkResults.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex justify-between"><h4 className="font-bold">Resultados</h4><Button variant="outline" size="sm" onClick={() => { setBulkResults([]); setBulkDialogOpen(false) }}>Cerrar</Button></div>
                  <div className="max-h-[400px] overflow-y-auto border rounded-lg">
                    {bulkResults.map((r, i) => (
                      <div key={i} className={`flex items-center gap-2 px-3 py-2 border-b ${r.success ? 'bg-emerald-50' : 'bg-red-50'}`}>
                        {r.success ? <Check className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-red-600" />}
                        <div className="flex-1"><p className="text-sm font-medium">{r.nombre}</p><p className="text-xs text-gray-500">{r.telefono}</p>{r.error && <p className="text-xs text-red-600">{r.error}</p>}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 text-center">{bulkResults.filter(r => r.success).length} OK · {bulkResults.filter(r => !r.success).length} fallidos</p>
                </div>
              ) : (
                <>
                  <div><Label className="text-xs font-bold uppercase">Mensaje</Label><Textarea className="mt-1 w-full text-sm h-32 resize-none" placeholder="Hola {nombre}..." value={bulkMessage} onChange={e => setBulkMessage(e.target.value)} /><p className="text-xs text-gray-500 mt-1">Variables: <code>{'{nombre}'}</code>, <code>{'{monto}'}</code></p></div>
                  <div>
                    <div className="flex justify-between mb-2"><Label className="text-xs font-bold uppercase">Destinatarios ({bulkSelected.size} de {deudores.length})</Label>
                    <div className="flex gap-2"><button onClick={() => setBulkSelected(new Set(deudores.map(d => d.id)))} className="text-xs text-emerald-600 hover:underline">Todos</button><button onClick={() => setBulkSelected(new Set())} className="text-xs text-gray-500">Ninguno</button></div>
                  </div>
                  <div className="max-h-[200px] overflow-y-auto border rounded-lg divide-y divide-gray-50">
                    {deudores.length === 0 ? <div className="p-4 text-center text-sm text-gray-500">No hay deudores con teléfono</div> : deudores.map(d => (
                      <label key={d.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                        <input type="checkbox" checked={bulkSelected.has(d.id)} onChange={() => toggleDeudor(d.id)} className="h-4 w-4" />
                        <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{d.nombre}</p><p className="text-xs text-gray-500">{d.telefono}</p></div>
                        <Badge className="bg-red-100 text-red-700 text-xs">${d.total_adeudado.toLocaleString('es-UY')}</Badge>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2"><AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" /><div className="text-xs text-amber-900"><p className="font-bold mb-1">Antes de enviar:</p><ul className="list-disc pl-4 space-y-0.5"><li>Mensajes uno por uno (0.5s delay)</li><li>WhatsApp puede bloquear spam</li><li>No se puede deshacer</li></ul></div></div>
                <div className="flex gap-2 justify-end"><Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Cancelar</Button><Button onClick={enviarMasivo} disabled={bulkSending || bulkSelected.size === 0 || !bulkMessage.trim()} className="bg-amber-600 hover:bg-amber-700">{bulkSending ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Enviando...</> : <><Send className="h-4 w-4 mr-1" />Enviar a {bulkSelected.size}</>}</Button></div>
              </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
