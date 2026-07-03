import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

// WM-Tippspiel gehört zu den Bereichen, in denen Teammitglieder auch SCHREIBEN
// dürfen (nicht nur lesen) - siehe Besprechung und TEAMMEMBER_WRITE_PATHS in
// admin2/layout.tsx, die um '/admin2/wm-tippspiel' ergänzt werden muss.
async function checkAccess(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT id, username, clan_role FROM users WHERE id = $1', [session.user_id])
  const user = userResult.rows[0]
  if (!user || !['administrator', 'owner', 'teammitglied'].includes(user.clan_role)) return null
  return user
}

const RUNDEN = ['Gruppenphase', 'Sechzehntelfinale', 'Achtelfinale', 'Viertelfinale', 'Halbfinale', 'Spiel um Platz 3', 'Finale']

// GET /api/admin2/wm-games
// Liefert alle Spiele inkl. Tipp-Anzahl pro Spiel (für die "X Tipps"-Anzeige)
// und einem berechneten Status (geplant/live/beendet) fürs neue Interface.
export async function GET(req: NextRequest) {
  const user = await checkAccess(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  try {
    const gamesResult = await pool.query(
      `SELECT
         g.id, g.team1, g.team2, g.kickoff, g.gruppe, g.runde,
         g.result_team1, g.result_team2, g.penalty_team1, g.penalty_team2,
         (SELECT COUNT(*) FROM wm_tips t WHERE t.game_id = g.id) AS tip_count
       FROM wm_games g
       ORDER BY g.kickoff ASC`
    )

    const now = new Date()
    const games = gamesResult.rows.map(g => {
      let status: 'geplant' | 'live' | 'beendet' = 'geplant'
      if (g.result_team1 !== null && g.result_team2 !== null) {
        status = 'beendet'
      } else if (new Date(g.kickoff) <= now) {
        // Live-Fenster: 2 Stunden nach Anpfiff, danach ohne Ergebnis als "geplant"
        // zurückgestuft (Admin hat es vermutlich einfach noch nicht eingetragen),
        // damit Spiele nicht für immer als "live" hängen bleiben.
        const twoHoursLater = new Date(new Date(g.kickoff).getTime() + 2 * 60 * 60 * 1000)
        status = now <= twoHoursLater ? 'live' : 'geplant'
      }
      return { ...g, status }
    })

    return NextResponse.json({ games })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/admin2/wm-games
// Body: { team1, team2, kickoff, gruppe?, runde }
export async function POST(req: NextRequest) {
  const user = await checkAccess(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { team1, team2, kickoff, gruppe, runde } = body as {
    team1?: string, team2?: string, kickoff?: string, gruppe?: string, runde?: string
  }

  if (!team1?.trim() || !team2?.trim() || !kickoff) {
    return NextResponse.json({ error: 'Team1, Team2 und Anpfiff erforderlich' }, { status: 400 })
  }

  try {
    const result = await pool.query(
      `INSERT INTO wm_games (team1, team2, kickoff, gruppe, runde)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [team1.trim(), team2.trim(), kickoff, gruppe?.trim() || null, runde && RUNDEN.includes(runde) ? runde : 'Gruppenphase']
    )
    return NextResponse.json({ id: result.rows[0].id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}