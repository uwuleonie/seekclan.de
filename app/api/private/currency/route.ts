import { NextRequest, NextResponse } from 'next/server'
import { getPrivateUser } from '@/app/lib/private-auth'

// GET /api/private/currency — Wechselkurse (Basis EUR)
// Quelle: Frankfurter (https://frankfurter.dev), Referenzkurse der Europäischen Zentralbank,
// kostenlos und ohne API-Schlüssel. Die EZB aktualisiert werktags ca. 16 Uhr.
// Wird 1 Stunde im Server-Speicher gehalten.

const CACHE_MS = 60 * 60 * 1000
let cache: { at: number; data: { date: string; rates: Record<string, number> } } | null = null

async function fetchRates(): Promise<{ date: string; rates: Record<string, number> }> {
  // v1 (stabil, laut Doku dauerhaft verfügbar) – bei Fehler v2 probieren
  const urls = ['https://api.frankfurter.dev/v1/latest?base=EUR', 'https://api.frankfurter.dev/v2/rates?base=EUR']
  let lastErr: unknown = null
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error(`Frankfurter ${res.status}`)
      const raw = await res.json()
      const rates: Record<string, number> = { EUR: 1 }
      let date = ''
      if (Array.isArray(raw)) {
        // v2-Format: Liste mit { date, base, quote, rate }
        for (const r of raw) if (r?.quote && typeof r.rate === 'number') { rates[String(r.quote).toUpperCase()] = r.rate; date = r.date ?? date }
      } else if (raw?.rates && typeof raw.rates === 'object') {
        for (const [k, v] of Object.entries(raw.rates)) if (typeof v === 'number') rates[k.toUpperCase()] = v
        date = raw.date ?? ''
      }
      if (Object.keys(rates).length < 5) throw new Error('Unerwartete Antwort')
      return { date, rates }
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr
}

export async function GET(req: NextRequest) {
  const user = await getPrivateUser(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  if (cache && Date.now() - cache.at < CACHE_MS) return NextResponse.json({ ...cache.data, cached: true })
  try {
    const data = await fetchRates()
    cache = { at: Date.now(), data }
    return NextResponse.json(data)
  } catch (err) {
    console.error('Wechselkurse:', (err as Error)?.message)
    if (cache) return NextResponse.json({ ...cache.data, stale: true })
    return NextResponse.json({ error: 'Wechselkurse gerade nicht erreichbar' }, { status: 502 })
  }
}