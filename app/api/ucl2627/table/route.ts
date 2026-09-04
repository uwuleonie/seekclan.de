import { NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function getSeasonId() {
  const res = await pool.query("SELECT id FROM ucl_seasons WHERE slug = '2627'")
  return res.rows[0]?.id ?? null
}

export async function GET() {
  try {
    const seasonId = await getSeasonId()
    if (!seasonId) return NextResponse.json({ table: [] })

    const [matchRes, clubRes] = await Promise.all([
      pool.query(
        `SELECT home_club_id, away_club_id, result_home, result_away
         FROM ucl_matches WHERE season_id = $1 AND phase = 'ligaphase'
         AND result_home IS NOT NULL AND result_away IS NOT NULL`,
        [seasonId]
      ),
      pool.query('SELECT id FROM ucl_clubs WHERE season_id = $1', [seasonId]),
    ])

    const table: Record<string, { played: number; won: number; drawn: number; lost: number; goals_for: number; goals_against: number; points: number }> = {}

    for (const club of clubRes.rows) {
      table[club.id] = { played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0, points: 0 }
    }

    for (const m of matchRes.rows) {
      const h = table[m.home_club_id], a = table[m.away_club_id]
      if (!h || !a) continue
      const rh = Number(m.result_home), ra = Number(m.result_away)
      h.played++; a.played++
      h.goals_for += rh; h.goals_against += ra
      a.goals_for += ra; a.goals_against += rh
      if (rh > ra) { h.won++; h.points += 3; a.lost++ }
      else if (rh < ra) { a.won++; a.points += 3; h.lost++ }
      else { h.drawn++; h.points++; a.drawn++; a.points++ }
    }

    const sorted = Object.entries(table)
      .map(([club_id, stats]) => ({ club_id, ...stats }))
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        const da = a.goals_for - a.goals_against, db = b.goals_for - b.goals_against
        return db !== da ? db - da : b.goals_for - a.goals_for
      })

    return NextResponse.json({ table: sorted })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}