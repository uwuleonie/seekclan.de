import { NextRequest, NextResponse } from 'next/server'
import { lookup } from 'dns/promises'
import { isIP } from 'net'
import { getPrivateUser } from '@/app/lib/private-auth'

// GET /api/private/wishlist/preview?url=https://…
// Holt Titel, Bild und (falls angegeben) Preis einer Produktseite für die Wunschliste.
// Liest nur öffentliche Webseiten: Adressen im eigenen Netz (localhost, 10.x, 192.168.x …)
// werden abgelehnt, damit niemand über diese Funktion den Server selbst ausspähen kann.

const MAX_BYTES = 1_500_000
const TIMEOUT_MS = 7000

function privateIp(ip: string): boolean {
  const v = isIP(ip)
  if (v === 4) {
    const [a, b] = ip.split('.').map(Number)
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224
  }
  if (v === 6) {
    const s = ip.toLowerCase()
    if (s === '::' || s === '::1') return true
    if (s.startsWith('fc') || s.startsWith('fd') || s.startsWith('fe8') || s.startsWith('fe9') || s.startsWith('fea') || s.startsWith('feb')) return true
    const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped) return privateIp(mapped[1])
    return false
  }
  return true
}

async function assertPublic(u: URL) {
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Nur http(s)-Links')
  if (u.port && u.port !== '80' && u.port !== '443') throw new Error('Ungewöhnlicher Port')
  if (u.username || u.password) throw new Error('Link mit Zugangsdaten nicht erlaubt')
  const host = u.hostname.replace(/^\[|\]$/g, '')
  if (/^localhost$/i.test(host) || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('Interne Adresse')
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true, verbatim: true })
  if (!addrs.length || addrs.some(a => privateIp(a.address))) throw new Error('Interne Adresse')
}

async function fetchPage(start: string): Promise<{ html: string; finalUrl: string }> {
  let url = new URL(start)
  for (let hop = 0; hop < 4; hop++) {
    await assertPublic(url)
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; seekclan-wishlist/1.0; +https://seekclan.de)',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.7',
      },
    })
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = new URL(res.headers.get('location')!, url)
      continue
    }
    if (!res.ok) throw new Error(`Seite antwortet mit ${res.status}`)
    if (!/text\/html|application\/xhtml/i.test(res.headers.get('content-type') || '')) throw new Error('Keine Webseite')
    const reader = res.body?.getReader()
    if (!reader) throw new Error('Leere Antwort')
    const chunks: Uint8Array[] = []
    let total = 0
    while (total < MAX_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      total += value.length
    }
    reader.cancel().catch(() => {})
    return { html: new TextDecoder('utf-8', { fatal: false }).decode(Buffer.concat(chunks)), finalUrl: url.toString() }
  }
  throw new Error('Zu viele Weiterleitungen')
}

function decode(s: string) {
  return s
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ').trim()
}

function meta(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const k = key.replace(/[:.]/g, m => `\\${m}`)
    const re1 = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${k}["'][^>]*content=["']([^"']*)["']`, 'i')
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name|itemprop)=["']${k}["']`, 'i')
    const m = html.match(re1) || html.match(re2)
    if (m && m[1].trim()) return decode(m[1])
  }
  return null
}

/** Preis aus JSON-LD (schema.org Product/Offer), falls die Seite keinen og:price hat */
function jsonLdPrice(html: string): { price: string; currency: string | null } | null {
  const blocks = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) || []
  for (const b of blocks) {
    const body = b.replace(/^<script[^>]*>|<\/script>$/gi, '')
    const price = body.match(/"price"\s*:\s*"?([\d.,]+)"?/)
    if (price) {
      const cur = body.match(/"priceCurrency"\s*:\s*"([A-Z]{3})"/)
      return { price: price[1], currency: cur ? cur[1] : null }
    }
  }
  return null
}

function toCents(raw: string | null): number | null {
  if (!raw) return null
  let s = raw.replace(/[^\d.,]/g, '')
  if (!s) return null
  // "1.299,99" → 1299.99 · "1,299.99" → 1299.99 · "19,99" → 19.99
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  else if (s.includes(',')) s = s.replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 && n < 1_000_000 ? Math.round(n * 100) : null
}

export async function GET(req: NextRequest) {
  const user = await getPrivateUser(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const raw = req.nextUrl.searchParams.get('url') || ''
  let target: URL
  try { target = new URL(raw) } catch { return NextResponse.json({ error: 'Ungültiger Link' }, { status: 400 }) }

  try {
    const { html, finalUrl } = await fetchPage(target.toString())
    const title = meta(html, ['og:title', 'twitter:title']) ?? (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ? decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)![1]) : null)
    let image = meta(html, ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src'])
    if (image) {
      try { image = new URL(image, finalUrl).toString() } catch { image = null }
      if (image && !/^https?:\/\//i.test(image)) image = null
    }
    let priceRaw = meta(html, ['product:price:amount', 'og:price:amount', 'price'])
    let currency = meta(html, ['product:price:currency', 'og:price:currency', 'priceCurrency'])
    if (!priceRaw) {
      const ld = jsonLdPrice(html)
      if (ld) { priceRaw = ld.price; currency = currency ?? ld.currency }
    }
    const cur = currency && ['EUR', 'USD', 'GBP', 'CHF'].includes(currency.toUpperCase()) ? currency.toUpperCase() : null

    return NextResponse.json({
      title: title ? title.slice(0, 200) : null,
      image_url: image ? image.slice(0, 2000) : null,
      price_cents: toCents(priceRaw),
      currency: cur,
      site: new URL(finalUrl).hostname.replace(/^www\./, ''),
    })
  } catch (err) {
    const msg = (err as Error)?.name === 'TimeoutError' ? 'Seite antwortet nicht' : (err as Error)?.message || 'Nicht abrufbar'
    return NextResponse.json({ error: `Vorschau nicht möglich: ${msg}` }, { status: 422 })
  }
}