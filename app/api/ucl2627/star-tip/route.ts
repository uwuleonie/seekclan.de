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

// GET: Eigene Star-Tipps + aktuelles Result laden
export async function GET(req: NextRequest) {
  try {
    const seasonId = await getSeasonId()
    if (!seasonId) return NextResponse.json({ tips: [], results: [] })

    const sessionUserId = await getUserId(req.cookies.get('session_token')?.value)
    const gastName = req.nextUrl.searchParams.get('gast_name')

    let tipsRes = { rows: [] as any[] }
    if (sessionUserId) {
      tipsRes = await pool.query(
        'SELECT * FROM ucl_star_tips WHERE season_id = $1 AND user_id = $2 ORDER BY matchday',
        [seasonId, sessionUserId]
      )
    } else if (gastName) {
      tipsRes = await pool.query(
        'SELECT * FROM ucl_star_tips WHERE season_id = $1 AND gast_name = $2 ORDER BY matchday',
        [seasonId, gastName]
      )
    }

    const resultsRes = await pool.query(
      'SELECT * FROM ucl_star_results WHERE season_id = $1 ORDER BY matchday',
      [seasonId]
    )

    return NextResponse.json({ tips: tipsRes.rows, results: resultsRes.rows })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST: Star-Tipp setzen
export async function POST(req: NextRequest) {
  try {
    const sessionUserId = await getUserId(req.cookies.get('session_token')?.value)
    const { matchday, player_name, goals, gast_name } = await req.json()

    if (!matchday || !player_name?.trim()) return NextResponse.json({ error: 'Fehlende Felder' }, { status: 400 })

    if (!sessionUserId && !gast_name) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
    if (typeof goals !== 'number' || goals < 0) return NextResponse.json({ error: 'Ungültige Tore' }, { status: 400 })

    // Nur Do–Mo
    const day = new Date().getUTCDay()
    if (!(day >= 4 || day <= 1)) return NextResponse.json({ error: 'Nur Do–Mo möglich' }, { status: 400 })

    const seasonId = await getSeasonId()

    // Bereits getippt → kein Update
    if (sessionUserId) {
      const ex = await pool.query('SELECT 1 FROM ucl_star_tips WHERE season_id = $1 AND matchday = $2 AND user_id = $3', [seasonId, matchday, sessionUserId])
      if (ex.rows.length) return NextResponse.json({ error: 'Bereits getippt — kein Bearbeiten möglich' }, { status: 400 })
    } else if (gast_name) {
      const ex = await pool.query('SELECT 1 FROM ucl_star_tips WHERE season_id = $1 AND matchday = $2 AND gast_name = $3', [seasonId, matchday, gast_name])
      if (ex.rows.length) return NextResponse.json({ error: 'Bereits getippt — kein Bearbeiten möglich' }, { status: 400 })
    }

    const seasonId2 = seasonId
    if (!seasonId) return NextResponse.json({ error: 'Season nicht gefunden' }, { status: 404 })

    if (sessionUserId) {
      await pool.query(
        `INSERT INTO ucl_star_tips (season_id, matchday, user_id, player_name, goals)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (season_id, matchday, user_id) DO UPDATE SET player_name = EXCLUDED.player_name, goals = EXCLUDED.goals`,
        [seasonId, matchday, sessionUserId, player_name.trim(), goals]
      )
    } else {
      await pool.query(
        `INSERT INTO ucl_star_tips (season_id, matchday, gast_name, player_name, goals)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (season_id, matchday, gast_name) DO UPDATE SET player_name = EXCLUDED.player_name, goals = EXCLUDED.goals`,
        [seasonId, matchday, gast_name, player_name.trim(), goals]
      )
    }
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}