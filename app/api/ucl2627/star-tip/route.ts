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

export async function GET(req: NextRequest) {
  try {
    const seasonId = await getSeasonId()
    if (!seasonId) return NextResponse.json({ tips: [], results: [] })

    const sessionUserId = await getUserId(req.cookies.get('session_token')?.value)
    const gastName = req.nextUrl.searchParams.get('gast_name')

    let tipsRes = { rows: [] as any[] }
    if (sessionUserId) {
      tipsRes = await pool.query(
        'SELECT * FROM ucl_star_tips WHERE season_id = $1 AND user_id = $2 ORDER BY matchday, player_name',
        [seasonId, sessionUserId]
      )
    } else if (gastName) {
      tipsRes = await pool.query(
        'SELECT * FROM ucl_star_tips WHERE season_id = $1 AND gast_name = $2 ORDER BY matchday, player_name',
        [seasonId, gastName]
      )
    }

    const resultsRes = await pool.query(
      'SELECT * FROM ucl_star_results WHERE season_id = $1 ORDER BY matchday, player_name',
      [seasonId]
    )

    return NextResponse.json({ tips: tipsRes.rows, results: resultsRes.rows })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionUserId = await getUserId(req.cookies.get('session_token')?.value)
    const { matchday, player_name, gast_name } = await req.json()

    if (!matchday || !player_name?.trim()) return NextResponse.json({ error: 'Fehlende Felder' }, { status: 400 })
    if (!sessionUserId && !gast_name) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

    const seasonId = await getSeasonId()
    if (!seasonId) return NextResponse.json({ error: 'Season nicht gefunden' }, { status: 404 })

    const name = player_name.trim()

    // Spieler bereits von diesem Tipper in diesem Spieltag eingetragen?
    if (sessionUserId) {
      const ex = await pool.query(
        'SELECT 1 FROM ucl_star_tips WHERE season_id = $1 AND matchday = $2 AND user_id = $3 AND LOWER(player_name) = LOWER($4)',
        [seasonId, matchday, sessionUserId, name]
      )
      if (ex.rows.length) return NextResponse.json({ error: `${name} bereits als Starspieler eingetragen` }, { status: 400 })
      await pool.query(
        `INSERT INTO ucl_star_tips (season_id, matchday, user_id, player_name)
         VALUES ($1, $2, $3, $4)`,
        [seasonId, matchday, sessionUserId, name]
      )
    } else {
      const ex = await pool.query(
        'SELECT 1 FROM ucl_star_tips WHERE season_id = $1 AND matchday = $2 AND gast_name = $3 AND LOWER(player_name) = LOWER($4)',
        [seasonId, matchday, gast_name, name]
      )
      if (ex.rows.length) return NextResponse.json({ error: `${name} bereits als Starspieler eingetragen` }, { status: 400 })
      await pool.query(
        `INSERT INTO ucl_star_tips (season_id, matchday, gast_name, player_name)
         VALUES ($1, $2, $3, $4)`,
        [seasonId, matchday, gast_name, name]
      )
    }
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}