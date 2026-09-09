import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

export async function GET(req: NextRequest) {
  const home = req.nextUrl.searchParams.get('home')
  const away = req.nextUrl.searchParams.get('away')

  if (!home || !away) return NextResponse.json({ error: 'home und away required' }, { status: 400 })

  try {
    // Beide Richtungen abfragen (home/away vertauscht egal)
    const res = await pool.query(
      `SELECT date, competition, round, home_team, away_team, home_goals, away_goals, notes
       FROM ucl_h2h
       WHERE (home_id = $1 AND away_id = $2) OR (home_id = $2 AND away_id = $1)
       AND (logged_at IS NULL OR logged_at < NOW() - INTERVAL '12 hours')
       ORDER BY date DESC
       LIMIT 10`,
      [home, away]
    )

    const matches = res.rows.map(r => ({
      date: r.date,
      competition: r.competition,
      round: r.round,
      homeTeam: r.home_team,
      awayTeam: r.away_team,
      homeGoals: r.home_goals,
      awayGoals: r.away_goals,
      notes: r.notes,
    }))

    return NextResponse.json({ matches })
  } catch (e: any) {
    return NextResponse.json({ error: e.message, matches: [] }, { status: 500 })
  }
}