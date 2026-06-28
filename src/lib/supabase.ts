import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

let _supabase: SupabaseClient | null = null
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    if (!_supabase) {
      _supabase = createClient(
        supabaseUrl || 'https://placeholder.supabase.co',
        supabaseAnonKey || 'placeholder-anon-key'
      )
    }
    return (_supabase as any)[prop]
  }
})

let _supabaseAdmin: SupabaseClient | null = null
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    if (!_supabaseAdmin) {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      _supabaseAdmin = serviceKey
        ? createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
        : supabase
    }
    return (_supabaseAdmin as any)[prop]
  }
})

export async function fetchAllUbicaciones(client: SupabaseClient = supabaseAdmin): Promise<any[]> {
  const PAGE_SIZE = 1000
  const allRows: any[] = []
  let offset = 0
  while (true) {
    const { data, error } = await client.from('ubicaciones').select('*').range(offset, offset + PAGE_SIZE - 1)
    if (error) { console.warn(`fetchAllUbicaciones: error at offset ${offset}:`, error.message); break }
    if (!data || data.length === 0) break
    allRows.push(...data)
    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
    if (offset >= 50000) break
  }
  return allRows
}

export async function fetchLatestUbicacionByRep(repartidorId: string, client: SupabaseClient = supabaseAdmin): Promise<any | null> {
  const { data: tsData, error: tsError } = await client.from('ubicaciones').select('timestamp').eq('repartidor_id', repartidorId).order('timestamp', { ascending: false }).range(0, 0)
  if (tsError || !tsData || tsData.length === 0) return null
  const latestTs = tsData[0].timestamp
  const { data: fullData, error: fullError } = await client.from('ubicaciones').select('*').in('timestamp', [latestTs])
  if (fullError || !fullData || fullData.length === 0) return null
  return fullData.find((p: any) => p.repartidor_id === repartidorId) || fullData[0]
}

export async function fetchUbicacionesByRepAndDate(repartidorId: string, requestedDate: string, client: SupabaseClient = supabaseAdmin): Promise<{ pings: any[]; effectiveDate: string; allDates: string[] }> {
  const allTimestamps: string[] = []
  let offset = 0
  let effectiveDate = requestedDate
  let effectiveDateDetermined = false
  while (true) {
    const { data, error } = await client.from('ubicaciones').select('timestamp').eq('repartidor_id', repartidorId).order('timestamp', { ascending: false }).range(offset, offset + 999)
    if (error || !data || data.length === 0) break
    if (!effectiveDateDetermined && data.length > 0) {
      const firstDate = new Date(data[0].timestamp).toISOString().split('T')[0]
      const hasRequestedDate = data.some((p: any) => new Date(p.timestamp).toISOString().split('T')[0] === requestedDate)
      effectiveDate = hasRequestedDate ? requestedDate : firstDate
      effectiveDateDetermined = true
    }
    for (const p of data) allTimestamps.push(p.timestamp)
    if (data.length < 1000) break
    offset += 1000
    if (offset >= 50000) break
  }
  const allDates = [...new Set(allTimestamps.map(ts => new Date(ts).toISOString().split('T')[0]))].sort().reverse()
  const dateTimestamps = allTimestamps.filter(ts => new Date(ts).toISOString().split('T')[0] === effectiveDate)
  if (dateTimestamps.length === 0) return { pings: [], effectiveDate, allDates }
  const CHUNK_SIZE = 200
  const allRows: any[] = []
  for (let i = 0; i < dateTimestamps.length; i += CHUNK_SIZE) {
    const chunk = dateTimestamps.slice(i, i + CHUNK_SIZE)
    const { data, error } = await client.from('ubicaciones').select('*').in('timestamp', chunk)
    if (error) { console.warn(`fetchUbicacionesByRepAndDate: chunk ${i} error:`, error.message); continue }
    if (data) allRows.push(...data.filter((p: any) => p.repartidor_id === repartidorId))
  }
  allRows.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  return { pings: allRows, effectiveDate, allDates }
}

export async function fetchUbicacionesDeHoy(client: SupabaseClient = supabaseAdmin): Promise<any[]> {
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const PAGE_SIZE = 1000
  const todayTimestamps: string[] = []
  let offset = 0
  let passedToday = false
  while (!passedToday) {
    const { data, error } = await client.from('ubicaciones').select('timestamp').order('timestamp', { ascending: false }).range(offset, offset + PAGE_SIZE - 1)
    if (error || !data || data.length === 0) break
    for (const p of data) {
      const dStr = new Date(p.timestamp).toISOString().split('T')[0]
      if (dStr === todayStr) todayTimestamps.push(p.timestamp)
      else if (dStr < todayStr) { passedToday = true; break }
    }
    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
    if (offset >= 10000) break
  }
  if (todayTimestamps.length === 0) return []
  const CHUNK_SIZE = 200
  const allRows: any[] = []
  for (let i = 0; i < todayTimestamps.length; i += CHUNK_SIZE) {
    const chunk = todayTimestamps.slice(i, i + CHUNK_SIZE)
    const { data, error } = await client.from('ubicaciones').select('*').in('timestamp', chunk)
    if (error) { console.warn(`fetchUbicacionesDeHoy: chunk ${i} error:`, error.message); continue }
    if (data) allRows.push(...data)
  }
  return allRows
}
