import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function checkAdmin(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT username, clan_role FROM users WHERE id = $1', [session.user_id])
  const user = userResult.rows[0]
  if (!user || (user.clan_role !== 'administrator' && user.clan_role !== 'owner')) return null
  return user
}

async function getSeasonId() {
  const res = await pool.query("SELECT id FROM ucl_seasons WHERE slug = '2627'")
  return res.rows[0]?.id ?? null
}

// GET: Alle Matches + Clubs der Season
export async function GET(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const seasonId = await getSeasonId()
  if (!seasonId) return NextResponse.json({ error: 'Season nicht gefunden' }, { status: 404 })

  const [matches, clubs] = await Promise.all([
    pool.query(
      'SELECT * FROM ucl_matches WHERE season_id = $1 ORDER BY matchday ASC, kickoff ASC',
      [seasonId]
    ),
    pool.query('SELECT id, name, short FROM ucl_clubs WHERE season_id = $1 ORDER BY name', [seasonId]),
  ])

  return NextResponse.json({ matches: matches.rows, clubs: clubs.rows })
}

// PATCH: Ergebnis eintragen oder aktualisieren
export async function PATCH(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { match_id, result_home, result_away } = await req.json()

  if (!match_id || result_home === undefined || result_away === undefined) {
    return NextResponse.json({ error: 'Fehlende Felder' }, { status: 400 })
  }

  const rh = parseInt(result_home)
  const ra = parseInt(result_away)
  if (isNaN(rh) || isNaN(ra) || rh < 0 || ra < 0) {
    return NextResponse.json({ error: 'Ungültige Werte' }, { status: 400 })
  }

  await pool.query(
    'UPDATE ucl_matches SET result_home = $1, result_away = $2 WHERE id = $3',
    [rh, ra, match_id]
  )

  return NextResponse.json({ success: true })
}

// DELETE: Ergebnis zurücksetzen
export async function DELETE(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { match_id } = await req.json()
  if (!match_id) return NextResponse.json({ error: 'match_id fehlt' }, { status: 400 })

  await pool.query('UPDATE ucl_matches SET result_home = NULL, result_away = NULL WHERE id = $1', [match_id])

  return NextResponse.json({ success: true })
}