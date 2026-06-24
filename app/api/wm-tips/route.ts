import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function getUserId(token: string | undefined) {
  if (!token) return null
  const sessionResult = await pool.query(
    'SELECT user_id, expires_at FROM sessions WHERE token = $1',
    [token]
  )
  const session = sessionResult.rows[0]
  if (!session || new Date(session.expires_at) < new Date()) return null
  return session.user_id as string
}

export async function GET() {
  const result = await pool.query(
    `SELECT
       wt.*,
       json_build_object('username', u.username) AS users
     FROM wm_tips wt
     LEFT JOIN users u ON u.id = wt.user_id`
  )

  const formatted = (result.rows || []).map((t: any) => ({
    ...t,
    gast_name: t.gast_name || t.users?.username || t.user_id,
    users: undefined,
  }))

  return NextResponse.json({ tips: formatted })
}

export async function POST(req: NextRequest) {
  const { game_id, tip_team1, tip_team2, gast_name } = await req.json()

  if (!game_id || tip_team1 === undefined || tip_team2 === undefined) {
    return NextResponse.json({ error: 'Fehlende Felder' }, { status: 400 })
  }

  const sessionUserId = await getUserId(req.cookies.get('session_token')?.value)

  if (!sessionUserId && !gast_name) {
    return NextResponse.json({ error: 'Gastname erforderlich, wenn nicht eingeloggt' }, { status: 400 })
  }

  const gameResult = await pool.query('SELECT kickoff FROM wm_games WHERE id = $1', [game_id])
  const game = gameResult.rows[0]

  if (!game) return NextResponse.json({ error: 'Spiel nicht gefunden' }, { status: 404 })
  if (new Date(game.kickoff) <= new Date()) {
    return NextResponse.json({ error: 'Anpfiff bereits vorbei' }, { status: 400 })
  }

  try {
    if (sessionUserId) {
      await pool.query(
        `INSERT INTO wm_tips (game_id, user_id, tip_team1, tip_team2)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (game_id, user_id) DO UPDATE SET tip_team1 = EXCLUDED.tip_team1, tip_team2 = EXCLUDED.tip_team2`,
        [game_id, sessionUserId, tip_team1, tip_team2]
      )
    } else {
      await pool.query(
        `INSERT INTO wm_tips (game_id, gast_name, tip_team1, tip_team2)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (game_id, gast_name) DO UPDATE SET tip_team1 = EXCLUDED.tip_team1, tip_team2 = EXCLUDED.tip_team2`,
        [game_id, gast_name, tip_team1, tip_team2]
      )
    }
  } catch (err) {
    return NextResponse.json({ error: 'Fehler beim Speichern' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}