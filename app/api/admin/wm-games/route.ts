import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function checkAdmin(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null

  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null

  const userResult = await pool.query(
    'SELECT username, clan_role FROM users WHERE id = $1',
    [session.user_id]
  )
  const user = userResult.rows[0]

  if (!user || user.clan_role !== 'admin') return null
  return user
}

// Alle Spiele laden
export async function GET(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const result = await pool.query('SELECT * FROM wm_games ORDER BY kickoff ASC')

  return NextResponse.json({ games: result.rows || [] })
}

// Spiel anlegen
export async function POST(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const body = await req.json()
  const { team1, team2, kickoff, gruppe } = body
  const runde = body.runde || 'Gruppenphase'
  if (!team1 || !team2 || !kickoff) return NextResponse.json({ error: 'Team1, Team2 und Anpfiff erforderlich' }, { status: 400 })

  try {
    await pool.query(
      'INSERT INTO wm_games (team1, team2, kickoff, gruppe, runde) VALUES ($1, $2, $3, $4, $5)',
      [team1, team2, kickoff, gruppe || null, runde]
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// Ergebnis eintragen / Spiel bearbeiten
export async function PATCH(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { id, result_team1, result_team2, team1, team2, kickoff, gruppe, runde } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID erforderlich' }, { status: 400 })

  try {
    await pool.query(
      `UPDATE wm_games SET result_team1 = $1, result_team2 = $2, team1 = $3, team2 = $4, kickoff = $5, gruppe = $6, runde = $7
       WHERE id = $8`,
      [result_team1, result_team2, team1, team2, kickoff, gruppe, runde, id]
    )
  } catch (err: any) {
    return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// Spiel löschen
export async function DELETE(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID erforderlich' }, { status: 400 })

  try {
    await pool.query('DELETE FROM wm_games WHERE id = $1', [id])
  } catch (err: any) {
    return NextResponse.json({ error: 'Fehler beim Löschen' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}