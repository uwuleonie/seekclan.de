import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { getGeoUser } from '@/app/lib/geo-server'
import { loadConfig, quizKeys } from '@/app/lib/geo-data'
import { levelOf } from '@/app/geo/_lib/xp'

// Ranglisten von seekclan.de/geo (wer sich ausgeblendet hat, erscheint nirgends)
// GET /api/geo/leaderboard?type=level                 → Level (Gesamt-XP)
// GET /api/geo/leaderboard?type=quiz&slug=<quiz>      → je Quiz: % einmal geschafft + Bestzeit (normaler Durchlauf)

const SLUG = /^[a-z0-9-]{2,60}$/
const LIMIT = 100

export async function GET(req: NextRequest) {
  const user = await getGeoUser(req).catch(() => null)
  const sp = req.nextUrl.searchParams
  const type = sp.get('type') ?? 'level'
  const headers = { 'Cache-Control': 'no-store' }
  try {
    const cfg = await loadConfig()
    if (!cfg.leaderboards) return NextResponse.json({ off: true, rows: [] }, { headers })

    if (type === 'level') {
      const r = await pool.query(
        `SELECT p.user_id, u.username, p.xp FROM geo_profile p JOIN users u ON u.id = p.user_id
         WHERE p.hidden = false AND p.xp > 0 ORDER BY p.xp DESC, p.updated_at ASC LIMIT ${LIMIT}`,
      )
      const rows = r.rows.map((x, i) => ({ rank: i + 1, username: x.username, xp: Number(x.xp), level: levelOf(Number(x.xp), cfg).level, me: x.user_id === user?.id }))
      return NextResponse.json({ rows }, { headers })
    }

    const slug = sp.get('slug') ?? ''
    if (type !== 'quiz' || !SLUG.test(slug)) return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
    const total = (await quizKeys(slug)).size || 1
    const [pct, time] = await Promise.all([
      pool.query(
        `SELECT g.user_id, u.username, count(*)::int AS n, max(g.created_at) AS last
         FROM geo_item_progress g JOIN users u ON u.id = g.user_id
         LEFT JOIN geo_profile p ON p.user_id = g.user_id
         WHERE g.slug = $1 AND COALESCE(p.hidden, false) = false
         GROUP BY g.user_id, u.username ORDER BY n DESC, last ASC LIMIT ${LIMIT}`,
        [slug],
      ),
      pool.query(
        `SELECT * FROM (
           SELECT DISTINCT ON (r.user_id) r.user_id, u.username, r.accuracy, r.seconds, r.mode, r.created_at
           FROM geo_results r JOIN users u ON u.id = r.user_id
           LEFT JOIN geo_profile p ON p.user_id = r.user_id
           WHERE r.slug = $1 AND r.variant = 'normal' AND r.total >= $2 AND COALESCE(p.hidden, false) = false
           ORDER BY r.user_id, r.accuracy DESC, r.seconds ASC
         ) b ORDER BY accuracy DESC, seconds ASC LIMIT ${LIMIT}`,
        [slug, Math.ceil(total * 0.8)],
      ),
    ])
    return NextResponse.json({
      total,
      pct: pct.rows.map((x, i) => ({ rank: i + 1, username: x.username, solved: x.n, pct: Math.min(100, Math.round((x.n / total) * 100)), me: x.user_id === user?.id })),
      time: time.rows.map((x, i) => ({ rank: i + 1, username: x.username, accuracy: x.accuracy, seconds: x.seconds, mode: x.mode, me: x.user_id === user?.id })),
    }, { headers })
  } catch (err: unknown) {
    console.error('geo/leaderboard', err)
    return NextResponse.json({ error: 'Rangliste konnte nicht geladen werden', rows: [] }, { status: 500 })
  }
}