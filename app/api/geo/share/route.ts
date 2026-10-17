import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { pool } from '@/app/lib/db'
import { checkOrigin, csrfError } from '@/app/lib/csrf'
import { getGeoUser } from '@/app/lib/geo-server'
import { checkRateLimit, getIP, rateLimitResponse } from '@/app/lib/rate-limit'

// Geteilte Ergebnisse: ein kurzer Link (seekclan.de/geo/ergebnis/<id>) mit Schaubild des Ergebnisses
// POST /api/geo/share  Body: { slug, title, mode, variant, total, right, wrong, seconds, accuracy, bestStreak, solved: [keys], mistakes: [keys] } → { id, url }
// GET  /api/geo/share?id=<id> → { share }

const SLUG = /^(mix:)?[a-z0-9-]{2,60}(\+[a-z0-9-]{2,60}){0,11}$/
const ID = /^[A-Za-z0-9_-]{6,16}$/
const int = (v: unknown, max: number) => { const n = Number(v); return Number.isInteger(n) && n >= 0 && n <= max ? n : 0 }
const keys = (v: unknown) => (Array.isArray(v) ? v.slice(0, 6000).map(x => String(x).slice(0, 120)) : [])

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') ?? ''
  if (!ID.test(id)) return NextResponse.json({ error: 'Ungültiger Link' }, { status: 400 })
  try {
    const r = await pool.query(
      `SELECT s.id, s.slug, s.data, s.created_at, u.username, COALESCE(u.anzeigename, u.username) AS name FROM geo_shares s LEFT JOIN users u ON u.id = s.user_id WHERE s.id = $1`,
      [id],
    )
    if (!r.rows[0]) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
    const x = r.rows[0]
    return NextResponse.json({ share: { id: x.id, slug: x.slug, ...x.data, username: x.username ?? null, name: x.name ?? null, createdAt: new Date(x.created_at).toISOString() } })
  } catch (err: unknown) {
    console.error('geo/share GET', err)
    return NextResponse.json({ error: 'Fehler' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return csrfError()
  const user = await getGeoUser(req).catch(() => null)
  const rl = await checkRateLimit(`${getIP(req)}:geo-share`, 'settings')
  if (!rl.allowed) return rateLimitResponse(rl)
  const b = await req.json().catch(() => ({}))
  const slug = String(b.slug ?? '')
  if (!SLUG.test(slug)) return NextResponse.json({ error: 'Ungültige Daten' }, { status: 400 })
  const data = {
    title: String(b.title ?? '').slice(0, 160),
    mode: String(b.mode ?? '').slice(0, 12), variant: String(b.variant ?? '').slice(0, 12),
    total: int(b.total, 10000), right: int(b.right, 100000), wrong: int(b.wrong, 100000),
    seconds: int(b.seconds, 86400), accuracy: Math.min(100, int(b.accuracy, 100)), bestStreak: int(b.bestStreak, 100000),
    solved: keys(b.solved), mistakes: keys(b.mistakes),
  }
  const id = randomBytes(6).toString('base64url')
  try {
    await pool.query('INSERT INTO geo_shares (id, user_id, slug, data) VALUES ($1, $2, $3, $4)', [id, user?.id ?? null, slug, JSON.stringify(data)])
    return NextResponse.json({ id, url: `/geo/ergebnis/${id}` })
  } catch (err: unknown) {
    console.error('geo/share POST', err)
    return NextResponse.json({ error: 'Link konnte nicht erstellt werden' }, { status: 500 })
  }
}