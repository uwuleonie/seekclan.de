import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin, csrfError } from '@/app/lib/csrf'
import { checkRateLimit, getIP, rateLimitResponse } from '@/app/lib/rate-limit'
import { getGeoUser } from '@/app/lib/geo-server'
import { unlockQuiz } from '@/app/lib/geo-data'

// Geo-Sternis (Währung von seekclan.de/geo) – nur für eingeloggte Nutzer
// GET  /api/geo/sternis → { sternis, unlocks: [{ slug, price, at }], log: letzte 40 Buchungen }
// POST /api/geo/sternis  Body: { slug } → Quiz freikaufen → { ok, slug, price, sternis }

const SLUG = /^[a-z0-9-]{2,60}$/

export async function GET(req: NextRequest) {
  const user = await getGeoUser(req).catch(() => null)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  try {
    const [p, u, l] = await Promise.all([
      pool.query('SELECT sternis FROM geo_profile WHERE user_id = $1', [user.id]),
      pool.query('SELECT slug, price, created_at FROM geo_unlocks WHERE user_id = $1 ORDER BY created_at DESC', [user.id]),
      pool.query('SELECT amount, reason, slug, ref, note, created_at FROM geo_sterni_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT 40', [user.id]),
    ])
    return NextResponse.json({
      sternis: Number(p.rows[0]?.sternis ?? 0),
      unlocks: u.rows.map(r => ({ slug: r.slug, price: r.price, at: r.created_at })),
      log: l.rows.map(r => ({ amount: r.amount, reason: r.reason, slug: r.slug, ref: r.ref, note: r.note, at: r.created_at })),
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: unknown) {
    console.error('geo/sternis GET', err)
    return NextResponse.json({ error: 'Konnte nicht geladen werden' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return csrfError()
  const user = await getGeoUser(req).catch(() => null)
  if (!user) return NextResponse.json({ error: 'Zum Freikaufen bitte einloggen' }, { status: 401 })
  const rl = await checkRateLimit(`${getIP(req)}:${user.id}`, 'api')
  if (!rl.allowed) return rateLimitResponse(rl)

  const b = await req.json().catch(() => ({}))
  const slug = String(b.slug ?? '')
  if (!SLUG.test(slug)) return NextResponse.json({ error: 'Ungültiges Quiz' }, { status: 400 })
  try {
    const r = await unlockQuiz(user.id, user.role, slug)
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
    return NextResponse.json({ ok: true, slug, price: r.price, sternis: r.sternis })
  } catch (err: unknown) {
    console.error('geo/sternis POST', err)
    return NextResponse.json({ error: 'Freikaufen fehlgeschlagen' }, { status: 500 })
  }
}