import { NextRequest, NextResponse } from 'next/server'
import { getPrivateUser } from '@/app/lib/private-auth'
import { parseRss, type FeedItem } from '@/app/lib/rss'

// GET /api/private/news?cat=top|inland|ausland|wirtschaft
// Schlagzeilen von tagesschau.de (öffentliche RSS-Feeds), 10 Minuten zwischengespeichert.

const FEEDS: Record<string, { url: string; label: string }> = {
  top: { url: 'https://www.tagesschau.de/index~rss2.xml', label: 'Top-Themen' },
  inland: { url: 'https://www.tagesschau.de/inland/index~rss2.xml', label: 'Deutschland' },
  ausland: { url: 'https://www.tagesschau.de/ausland/index~rss2.xml', label: 'Welt' },
  wirtschaft: { url: 'https://www.tagesschau.de/wirtschaft/index~rss2.xml', label: 'Wirtschaft' },
}
const CACHE_MS = 10 * 60 * 1000
const cache = new Map<string, { at: number; items: FeedItem[] }>()

async function load(cat: string): Promise<FeedItem[]> {
  const hit = cache.get(cat)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.items
  try {
    const res = await fetch(FEEDS[cat].url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'seekclan-private/1.0 (+https://seekclan.de)', Accept: 'application/rss+xml, application/xml, text/xml' },
    })
    if (!res.ok) throw new Error(`tagesschau ${res.status}`)
    const items = parseRss(await res.text(), 40)
    cache.set(cat, { at: Date.now(), items })
    return items
  } catch (err) {
    console.error('Nachrichten:', cat, (err as Error)?.message)
    if (hit) return hit.items // lieber ältere Schlagzeilen als gar keine
    throw err
  }
}

export async function GET(req: NextRequest) {
  const user = await getPrivateUser(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const cat = req.nextUrl.searchParams.get('cat') ?? 'top'
  if (!FEEDS[cat]) return NextResponse.json({ error: 'Unbekannte Kategorie' }, { status: 400 })
  try {
    const items = await load(cat)
    return NextResponse.json({ cat, label: FEEDS[cat].label, source: 'tagesschau.de', items }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Nachrichten gerade nicht erreichbar' }, { status: 502 })
  }
}