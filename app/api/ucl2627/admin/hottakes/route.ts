import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function getUserId(token: string | undefined) {
  if (!token) return null
  const res = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  return res.rows[0]?.user_id ?? null
}

async function getSeasonId() {
  const res = await pool.query("SELECT id FROM ucl_seasons WHERE slug = '2627'")
  return res.rows[0]?.id ?? null
}

// Gibt den Beginn der aktuellen Woche zurück (Freitag 00:00 UTC der letzten Woche)
// Woche läuft Fr 00:00 UTC → nächste Fr 00:00 UTC
function getWeekStart(): Date {
  const now = new Date()
  // Wochentag: 0=So, 1=Mo, ..., 5=Fr, 6=Sa
  const day = now.getUTCDay()
  // Tage zurück bis zum letzten Freitag (5)
  const daysBack = day >= 5 ? day - 5 : day + 2
  const friday = new Date(now)
  friday.setUTCDate(now.getUTCDate() - daysBack)
  friday.setUTCHours(0, 0, 0, 0)
  return friday
}

// GET: Eigene Hottakes + öffentliche (nur abgelaufene)
export async function GET(req: NextRequest) {
  try {
    const seasonId = await getSeasonId()
    if (!seasonId) return NextResponse.json({ mine: [], public: [] })

    const sessionUserId = await getUserId(req.cookies.get('session_token')?.value)
    const gastName = req.nextUrl.searchParams.get('gast_name')

    // Eigene Hottakes
    let mineRes = { rows: [] as any[] }
    if (sessionUserId) {
      mineRes = await pool.query(
        `SELECT h.*, u.username FROM ucl_hottakes h
         LEFT JOIN users u ON u.id = h.user_id
         WHERE h.season_id = $1 AND h.user_id = $2 ORDER BY h.created_at DESC`,
        [seasonId, sessionUserId]
      )
    } else if (gastName) {
      mineRes = await pool.query(
        'SELECT * FROM ucl_hottakes WHERE season_id = $1 AND gast_name = $2 ORDER BY created_at DESC',
        [seasonId, gastName]
      )
    }

    // Öffentliche Hottakes — accepted + (abgelaufen ODER bereits erfüllt)
    const publicRes = await pool.query(
      `SELECT h.id, h.content, h.valid_until, h.hardness, h.created_at, h.fulfilled,
              u.username, h.gast_name
       FROM ucl_hottakes h
       LEFT JOIN users u ON u.id = h.user_id
       WHERE h.season_id = $1
         AND h.status = 'accepted'
         AND (h.valid_until < NOW() OR h.fulfilled = true)
       ORDER BY h.created_at DESC`,
      [seasonId]
    )

    // Eigene Hottakes dieser Woche (für Limit-Check)
    const weekStart = getWeekStart()
    const weekCountRes = sessionUserId
      ? await pool.query('SELECT COUNT(*) FROM ucl_hottakes WHERE season_id = $1 AND user_id = $2 AND created_at >= $3', [seasonId, sessionUserId, weekStart])
      : gastName
      ? await pool.query('SELECT COUNT(*) FROM ucl_hottakes WHERE season_id = $1 AND gast_name = $2 AND created_at >= $3', [seasonId, gastName, weekStart])
      : { rows: [{ count: '0' }] }
    const weekCount = parseInt(weekCountRes.rows[0].count)

    return NextResponse.json({ mine: mineRes.rows, public: publicRes.rows, week_count: weekCount })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST: Hottake absenden — jederzeit möglich, max 3 pro Woche (Reset jeden Freitag 00:00 UTC)
export async function POST(req: NextRequest) {
  try {
    const sessionUserId = await getUserId(req.cookies.get('session_token')?.value)
    const { content, valid_until, gast_name } = await req.json()

    if (!content?.trim()) return NextResponse.json({ error: 'Kein Inhalt' }, { status: 400 })
    if (!valid_until || isNaN(new Date(valid_until).getTime())) return NextResponse.json({ error: 'Gültiges Datum erforderlich' }, { status: 400 })
    if (!sessionUserId && !gast_name) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

    const seasonId = await getSeasonId()
    if (!seasonId) return NextResponse.json({ error: 'Season nicht gefunden' }, { status: 404 })

    const weekStart = getWeekStart()

    // Max 3 Hottakes pro Woche prüfen (seit letztem Freitag 00:00 UTC)
    const countRes = sessionUserId
      ? await pool.query(
          'SELECT COUNT(*) FROM ucl_hottakes WHERE season_id = $1 AND user_id = $2 AND created_at >= $3',
          [seasonId, sessionUserId, weekStart]
        )
      : await pool.query(
          'SELECT COUNT(*) FROM ucl_hottakes WHERE season_id = $1 AND gast_name = $2 AND created_at >= $3',
          [seasonId, gast_name, weekStart]
        )

    if (parseInt(countRes.rows[0].count) >= 3) {
      return NextResponse.json({ error: 'Maximal 3 Hottakes pro Woche erlaubt. Reset jeden Freitag um 00:00 Uhr.' }, { status: 400 })
    }

    if (sessionUserId) {
      await pool.query(
        'INSERT INTO ucl_hottakes (season_id, user_id, content, valid_until) VALUES ($1, $2, $3, $4)',
        [seasonId, sessionUserId, content.trim(), new Date(valid_until)]
      )
    } else {
      await pool.query(
        'INSERT INTO ucl_hottakes (season_id, gast_name, content, valid_until) VALUES ($1, $2, $3, $4)',
        [seasonId, gast_name, content.trim(), new Date(valid_until)]
      )
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}