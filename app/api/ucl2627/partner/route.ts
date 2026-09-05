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

// GET: Verfügbare Partnervereine + eigene Wahl laden
export async function GET(req: NextRequest) {
  try {
    const seasonId = await getSeasonId()
    if (!seasonId) return NextResponse.json({ partnerClubs: [], myPartner: null })

    const gastName = req.nextUrl.searchParams.get('gast_name')
    const sessionUserId = await getUserId(req.cookies.get('session_token')?.value)

    const [partnerClubsRes, myPartnerRes] = await Promise.all([
      pool.query(
        `SELECT c.id, c.name, c.short, c.logo_url
         FROM ucl_partner_clubs pc
         JOIN ucl_clubs c ON c.id = pc.club_id
         WHERE pc.season_id = $1
         ORDER BY c.name`,
        [seasonId]
      ),
      sessionUserId
        ? pool.query('SELECT club_id FROM ucl_player_partners WHERE season_id = $1 AND user_id = $2', [seasonId, sessionUserId])
        : gastName
        ? pool.query('SELECT club_id FROM ucl_player_partners WHERE season_id = $1 AND gast_name = $2', [seasonId, gastName])
        : Promise.resolve({ rows: [] }),
    ])

    return NextResponse.json({
      partnerClubs: partnerClubsRes.rows,
      myPartner: myPartnerRes.rows[0]?.club_id ?? null,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST: Partnerverein wählen
export async function POST(req: NextRequest) {
  try {
    const sessionUserId = await getUserId(req.cookies.get('session_token')?.value)
    const { club_id, gast_name } = await req.json()
    if (!club_id) return NextResponse.json({ error: 'club_id fehlt' }, { status: 400 })
    if (!sessionUserId && !gast_name) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

    const seasonId = await getSeasonId()
    if (!seasonId) return NextResponse.json({ error: 'Season nicht gefunden' }, { status: 404 })

    // Prüfen ob Club in den Partnervereinen ist
    const check = await pool.query(
      'SELECT 1 FROM ucl_partner_clubs WHERE season_id = $1 AND club_id = $2',
      [seasonId, club_id]
    )
    if (!check.rows.length) return NextResponse.json({ error: 'Kein Partnerverein' }, { status: 400 })

    // Bereits gewählt? → nicht mehr änderbar
    const existing = sessionUserId
      ? await pool.query('SELECT club_id FROM ucl_player_partners WHERE season_id = $1 AND user_id = $2', [seasonId, sessionUserId])
      : await pool.query('SELECT club_id FROM ucl_player_partners WHERE season_id = $1 AND gast_name = $2', [seasonId, gast_name])

    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Partner bereits gewählt — kann nicht mehr geändert werden' }, { status: 400 })
    }

    if (sessionUserId) {
      await pool.query(
        'INSERT INTO ucl_player_partners (season_id, user_id, club_id) VALUES ($1, $2, $3)',
        [seasonId, sessionUserId, club_id]
      )
    } else {
      await pool.query(
        'INSERT INTO ucl_player_partners (season_id, gast_name, club_id) VALUES ($1, $2, $3)',
        [seasonId, gast_name, club_id]
      )
    }
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}