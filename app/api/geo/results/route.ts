import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin, csrfError } from '@/app/lib/csrf'
import { checkRateLimit, getIP, rateLimitResponse } from '@/app/lib/rate-limit'
import { getGeoUser } from '@/app/lib/geo-server'
import { awardPerfect, quizKeys } from '@/app/lib/geo-data'

// Ergebnisse der Geo-Quizzes (nur für eingeloggte Nutzer, Tabelle geo_results)

const SLUG = /^(mix:)?[a-z0-9-]{2,60}(\+[a-z0-9-]{2,60}){0,11}$/
const MODES = ['click', 'name', 'type', 'text', 'mixed']
const VARIANTS = ['normal', 'sprint', 'leben']

const int = (v: unknown, min: number, max: number): number | null => {
  const n = Number(v)
  return Number.isInteger(n) && n >= min && n <= max ? n : null
}

// GET /api/geo/results → bester Wert je Quiz { bests: { slug: { accuracy, seconds, mode, variant } } }
export async function GET(req: NextRequest) {
  const user = await getGeoUser(req).catch(() => null)
  if (!user) return NextResponse.json({ bests: {} }, { status: 401 })
  try {
    const r = await pool.query(
      `SELECT DISTINCT ON (slug) slug, accuracy, seconds, mode, variant
       FROM geo_results WHERE user_id = $1 AND variant <> 'sprint'
       ORDER BY slug, accuracy DESC, seconds ASC`,
      [user.id],
    )
    const bests: Record<string, { accuracy: number; seconds: number; mode: string; variant: string }> = {}
    for (const row of r.rows) bests[row.slug] = { accuracy: row.accuracy, seconds: row.seconds, mode: row.mode, variant: row.variant }
    return NextResponse.json({ bests }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: unknown) {
    console.error('geo/results GET', err)
    return NextResponse.json({ bests: {} })
  }
}

// POST /api/geo/results  Body: { slug, mode, variant, total, right, wrong, seconds, accuracy }
export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return csrfError()
  const user = await getGeoUser(req).catch(() => null)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const rl = await checkRateLimit(`${getIP(req)}:${user.id}`, 'api')
  if (!rl.allowed) return rateLimitResponse(rl)

  const b = await req.json().catch(() => ({}))
  const slug = String(b.slug ?? '')
  const mode = String(b.mode ?? '')
  const variant = String(b.variant ?? '')
  const total = int(b.total, 1, 5000)
  const right = int(b.right, 0, 100000)
  const wrong = int(b.wrong, 0, 100000)
  const seconds = int(b.seconds, 0, 86400)
  if (!SLUG.test(slug) || !MODES.includes(mode) || !VARIANTS.includes(variant) || total === null || right === null || wrong === null || seconds === null) {
    return NextResponse.json({ error: 'Ungültige Daten' }, { status: 400 })
  }
  if (right + wrong === 0) return NextResponse.json({ error: 'Keine Antworten' }, { status: 400 })
  const accuracy = Math.round((right / (right + wrong)) * 100)

  try {
    await pool.query(
      `INSERT INTO geo_results (user_id, slug, mode, variant, total, right_count, wrong_count, seconds, accuracy)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [user.id, slug, mode, variant, total, right, wrong, seconds, accuracy],
    )
    // Fehlerfrei über (fast) das ganze Quiz → einmaliger Bonus (nicht im Sprint, nicht bei "Nur Fehler üben", nicht bei Mixen)
    let parts: { reason: string; amount: number; label: string }[] = []
    if (wrong === 0 && variant !== 'sprint' && !slug.startsWith('mix:') && b.practice !== true) {
      const size = (await quizKeys(slug)).size
      if (size && total >= Math.ceil(size * 0.8) && right >= total) parts = await awardPerfect(user.id, slug)
    }
    return NextResponse.json({ ok: true, gained: parts.reduce((s, p) => s + p.amount, 0), parts })
  } catch (err: unknown) {
    console.error('geo/results POST', err)
    return NextResponse.json({ error: 'Speichern fehlgeschlagen' }, { status: 500 })
  }
}