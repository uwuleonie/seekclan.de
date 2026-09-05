import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

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
  const res = await pool.query("SELECT id FROM ucl_seasons WHERE slug = '2627'")
  return res.rows[0]?.id ?? null
}

// GET: Alle Star-Results
export async function GET(req: NextRequest) {
  try {
    const seasonId = await getSeasonId()
    if (!seasonId) return NextResponse.json({ results: [] })
    const res = await pool.query('SELECT * FROM ucl_star_results WHERE season_id = $1 ORDER BY matchday', [seasonId])
    return NextResponse.json({ results: res.rows })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST: Star-Result setzen
export async function POST(req: NextRequest) {
  try {
    const admin = await checkAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

    const { matchday, player_name, actual_goals } = await req.json()
    if (!matchday || !player_name?.trim() || typeof actual_goals !== 'number')
      return NextResponse.json({ error: 'Fehlende Felder' }, { status: 400 })

    const seasonId = await getSeasonId()
    if (!seasonId) return NextResponse.json({ error: 'Season nicht gefunden' }, { status: 404 })

    await pool.query(
      `INSERT INTO ucl_star_results (season_id, matchday, player_name, actual_goals)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (season_id, matchday) DO UPDATE SET player_name = EXCLUDED.player_name, actual_goals = EXCLUDED.actual_goals`,
      [seasonId, matchday, player_name.trim(), actual_goals]
    )
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}