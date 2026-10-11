import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin, csrfError } from '@/app/lib/csrf'
import { getGeoUser } from '@/app/lib/geo-server'
import { loadConfig, loadProfile } from '@/app/lib/geo-data'

// GET /api/geo/me → { profile: { xp, hidden, level }, progress: { slug: Anzahl einmal richtiger Einträge }, rank }
export async function GET(req: NextRequest) {
  const user = await getGeoUser(req).catch(() => null)
  if (!user) return NextResponse.json({ profile: null }, { status: 401 })
  try {
    const cfg = await loadConfig()
    const [profile, prog, rank] = await Promise.all([
      loadProfile(user.id, cfg),
      pool.query('SELECT slug, count(*)::int AS n FROM geo_item_progress WHERE user_id = $1 GROUP BY slug', [user.id]),
      pool.query(`SELECT count(*)::int + 1 AS r FROM geo_profile p WHERE p.hidden = false AND p.xp > COALESCE((SELECT xp FROM geo_profile WHERE user_id = $1), 0)`, [user.id]),
    ])
    const progress: Record<string, number> = {}
    for (const r of prog.rows) progress[r.slug] = r.n
    return NextResponse.json({ profile, progress, rank: profile.hidden ? null : rank.rows[0].r }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: unknown) {
    console.error('geo/me', err)
    return NextResponse.json({ error: 'Profil konnte nicht geladen werden' }, { status: 500 })
  }
}

// POST /api/geo/me  Body: { hidden: boolean } → aus Ranglisten aus-/einblenden
export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return csrfError()
  const user = await getGeoUser(req).catch(() => null)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  if (typeof b.hidden !== 'boolean') return NextResponse.json({ error: 'Ungültige Daten' }, { status: 400 })
  try {
    await pool.query(
      `INSERT INTO geo_profile (user_id, hidden) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET hidden = EXCLUDED.hidden, updated_at = now()`,
      [user.id, b.hidden],
    )
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('geo/me POST', err)
    return NextResponse.json({ error: 'Speichern fehlgeschlagen' }, { status: 500 })
  }
}