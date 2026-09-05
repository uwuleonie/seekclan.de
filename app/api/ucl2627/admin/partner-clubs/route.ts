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

// GET: Aktuelle Partnervereine
export async function GET(req: NextRequest) {
  try {
    const seasonId = await getSeasonId()
    if (!seasonId) return NextResponse.json({ partnerClubs: [] })
    const res = await pool.query(
      'SELECT club_id FROM ucl_partner_clubs WHERE season_id = $1',
      [seasonId]
    )
    return NextResponse.json({ partnerClubs: res.rows.map((r: any) => r.club_id) })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST: Partnervereine setzen (ersetzt alle)
// Body: { club_ids: string[] } — max 12
export async function POST(req: NextRequest) {
  try {
    const admin = await checkAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

    const { club_ids } = await req.json()
    if (!Array.isArray(club_ids) || club_ids.length > 12)
      return NextResponse.json({ error: 'Max 12 Partnervereine' }, { status: 400 })

    const seasonId = await getSeasonId()
    if (!seasonId) return NextResponse.json({ error: 'Season nicht gefunden' }, { status: 404 })

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('DELETE FROM ucl_partner_clubs WHERE season_id = $1', [seasonId])
      for (const club_id of club_ids) {
        await client.query(
          'INSERT INTO ucl_partner_clubs (season_id, club_id) VALUES ($1, $2)',
          [seasonId, club_id]
        )
      }
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}