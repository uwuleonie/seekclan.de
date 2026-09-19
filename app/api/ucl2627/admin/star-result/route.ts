import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { getSeasonId as getSeasonIdBySlug, getSlugFromParam } from '@/app/lib/ucl-season'

async function checkAdmin(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const s = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  if (!s.rows[0]) return null
  const u = await pool.query('SELECT clan_role FROM users WHERE id = $1', [s.rows[0].user_id])
  const user = u.rows[0]
  if (!user || (user.clan_role !== 'owner' && user.clan_role !== 'administrator')) return null
  return user
}

async function getSeasonId() {
  return getSeasonIdBySlug('2627')
}

export async function GET(req: NextRequest) {
  try {
    const seasonId = await getSeasonId()
    if (!seasonId) return NextResponse.json({ results: [] })
    const res = await pool.query(
      'SELECT * FROM ucl_star_results WHERE season_id = $1 ORDER BY matchday, player_name',
      [seasonId]
    )
    return NextResponse.json({ results: res.rows })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST: Tore für einen Starspieler eintragen (mehrere Spieler pro Spieltag möglich)
export async function POST(req: NextRequest) {
  try {
    const admin = await checkAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

    const body = await req.json()
    const matchday = Number(body.matchday)
    const player_name = String(body.player_name ?? '').trim()
    const actual_goals = Number(body.actual_goals ?? 0)

    if (!matchday || !player_name)
      return NextResponse.json({ error: 'Fehlende Felder' }, { status: 400 })

    const seasonId = await getSeasonId()
    if (!seasonId) return NextResponse.json({ error: 'Season nicht gefunden' }, { status: 404 })

    await pool.query(
      `INSERT INTO ucl_star_results (season_id, matchday, player_name, actual_goals)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ON CONSTRAINT ucl_star_results_pkey
       DO UPDATE SET actual_goals = EXCLUDED.actual_goals`,
      [seasonId, matchday, player_name, actual_goals]
    )
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}