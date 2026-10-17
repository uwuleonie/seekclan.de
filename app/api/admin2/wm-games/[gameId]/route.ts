import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { mitRecht } from '@/app/lib/rechte'

async function checkAccess(req: NextRequest) {
  return mitRecht(req, 'admin.teambereiche', 'admin.verwalten')
}

const RUNDEN = ['Gruppenphase', 'Sechzehntelfinale', 'Achtelfinale', 'Viertelfinale', 'Halbfinale', 'Spiel um Platz 3', 'Finale']

// PATCH /api/admin2/wm-games/[gameId]
// Body: { team1?, team2?, kickoff?, gruppe?, runde?, result_team1?, result_team2?, penalty_team1?, penalty_team2? }
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ gameId: string }> }
) {
  const user = await checkAccess(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { gameId } = await context.params
  const body = await req.json().catch(() => ({}))
  const { team1, team2, kickoff, gruppe, runde, result_team1, result_team2, penalty_team1, penalty_team2 } = body as {
    team1?: string, team2?: string, kickoff?: string, gruppe?: string, runde?: string,
    result_team1?: number | null, result_team2?: number | null, penalty_team1?: number | null, penalty_team2?: number | null
  }

  if (runde !== undefined && !RUNDEN.includes(runde)) {
    return NextResponse.json({ error: 'Ungültige Runde' }, { status: 400 })
  }

  const updates: Record<string, any> = {}
  if (team1 !== undefined) updates.team1 = team1.trim()
  if (team2 !== undefined) updates.team2 = team2.trim()
  if (kickoff !== undefined) updates.kickoff = kickoff
  if (gruppe !== undefined) updates.gruppe = gruppe?.trim() || null
  if (runde !== undefined) updates.runde = runde
  if (result_team1 !== undefined) updates.result_team1 = result_team1
  if (result_team2 !== undefined) updates.result_team2 = result_team2
  if (penalty_team1 !== undefined) updates.penalty_team1 = penalty_team1
  if (penalty_team2 !== undefined) updates.penalty_team2 = penalty_team2

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: true })
  }

  const keys = Object.keys(updates)
  const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ')
  const values = keys.map(key => updates[key])

  try {
    await pool.query(`UPDATE wm_games SET ${setClause} WHERE id = $${keys.length + 1}`, [...values, gameId])
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/admin2/wm-games/[gameId]
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ gameId: string }> }
) {
  const user = await checkAccess(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { gameId } = await context.params
  try {
    await pool.query('DELETE FROM wm_games WHERE id = $1', [gameId])
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}