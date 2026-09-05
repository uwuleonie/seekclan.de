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

// GET: Alle Star-Tipps eines Spieltags
export async function GET(req: NextRequest) {
  try {
    const admin = await checkAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

    const matchday = req.nextUrl.searchParams.get('matchday')
    const seasonId = await getSeasonId()
    if (!seasonId) return NextResponse.json({ tips: [] })

    const res = await pool.query(
      `SELECT st.matchday, st.player_name, st.goals as tipped_goals,
              u.username, st.gast_name
       FROM ucl_star_tips st
       LEFT JOIN users u ON u.id = st.user_id
       WHERE st.season_id = $1 ${matchday ? 'AND st.matchday = $2' : ''}
       ORDER BY st.matchday, st.player_name`,
      matchday ? [seasonId, matchday] : [seasonId]
    )
    return NextResponse.json({ tips: res.rows })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}