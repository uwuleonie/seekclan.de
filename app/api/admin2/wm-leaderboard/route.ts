import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

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

// GET /api/admin2/wm-leaderboard
//
// Punktesystem (Standard-Tippspiel-Regeln, siehe Besprechung):
// - 3 Punkte für exaktes Ergebnis (inkl. exaktem Elfmeterschießen-Ergebnis
//   falls vorhanden - wird hier bewusst NICHT gesondert gewertet, da die
//   Elfmeter-Tipp-Funktion in wm_tips gar nicht existiert; nur das reguläre
//   Ergebnis wird verglichen)
// - 1 Punkt für richtige Tendenz (wer gewinnt / Unentschieden), aber falsches
//   genaues Ergebnis
// - 0 Punkte sonst
// Nur Spiele mit eingetragenem Ergebnis (result_team1/2 nicht NULL) fließen
// in die Wertung ein.
export async function GET(req: NextRequest) {
  const user = await checkAccess(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  try {
    const tipsResult = await pool.query(
      `SELECT
         t.user_id, t.gast_name, t.tip_team1, t.tip_team2,
         g.result_team1, g.result_team2,
         COALESCE(u.username, t.gast_name) AS name
       FROM wm_tips t
       JOIN wm_games g ON g.id = t.game_id
       LEFT JOIN users u ON u.id = t.user_id
       WHERE g.result_team1 IS NOT NULL AND g.result_team2 IS NOT NULL`
    )

    const scores = new Map<string, { name: string, points: number, exact: number, tendency: number, total: number }>()

    for (const row of tipsResult.rows) {
      const key = row.user_id || `gast:${row.gast_name}`
      if (!scores.has(key)) {
        scores.set(key, { name: row.name || 'Unbekannt', points: 0, exact: 0, tendency: 0, total: 0 })
      }
      const entry = scores.get(key)!
      entry.total += 1

      const tipDiff = row.tip_team1 - row.tip_team2
      const resultDiff = row.result_team1 - row.result_team2
      const tipTendency = Math.sign(tipDiff)
      const resultTendency = Math.sign(resultDiff)

      if (row.tip_team1 === row.result_team1 && row.tip_team2 === row.result_team2) {
        entry.points += 3
        entry.exact += 1
      } else if (tipTendency === resultTendency) {
        entry.points += 1
        entry.tendency += 1
      }
    }

    const leaderboard = [...scores.values()].sort((a, b) => b.points - a.points || b.exact - a.exact)

    return NextResponse.json({ leaderboard })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}