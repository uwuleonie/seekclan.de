import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { getSeasonId, getSlugFromParam } from '@/app/lib/ucl-season'

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

export async function GET(req: NextRequest) {
  try {
    const slug = getSlugFromParam(req.nextUrl.searchParams.get('comp'))
    const seasonId = await getSeasonId(slug)
    if (!seasonId) return NextResponse.json({ status: {} })
    const res = await pool.query(
      'SELECT matchday, finished FROM ucl_matchday_status WHERE season_id = $1',
      [seasonId]
    )
    const status: Record<number, boolean> = {}
    for (const row of res.rows) status[row.matchday] = row.finished
    return NextResponse.json({ status })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await checkAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

    const body = await req.json()
    const { matchday, finished, comp } = body
    if (matchday === undefined || finished === undefined)
      return NextResponse.json({ error: 'matchday + finished fehlt' }, { status: 400 })

    const slug = getSlugFromParam(comp)
    const seasonId = await getSeasonId(slug)
    if (!seasonId) return NextResponse.json({ error: 'Season nicht gefunden' }, { status: 404 })

    await pool.query(
      `INSERT INTO ucl_matchday_status (season_id, matchday, finished)
       VALUES ($1, $2, $3)
       ON CONFLICT (season_id, matchday) DO UPDATE SET finished = EXCLUDED.finished`,
      [seasonId, matchday, finished]
    )

    return NextResponse.json({ success: true, matchday, finished })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}