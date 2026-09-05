import { NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function getSeasonId() {
  const res = await pool.query("SELECT id FROM ucl_seasons WHERE slug = '2627'")
  return res.rows[0]?.id ?? null
}

function calcTable(matchRows: any[], clubIds: string[]) {
  const table: Record<string, { played:number; won:number; drawn:number; lost:number; goals_for:number; goals_against:number; points:number }> = {}
  for (const id of clubIds) table[id] = { played:0, won:0, drawn:0, lost:0, goals_for:0, goals_against:0, points:0 }
  for (const m of matchRows) {
    const h = table[m.home_club_id], a = table[m.away_club_id]
    if (!h || !a) continue
    const rh = Number(m.result_home), ra = Number(m.result_away)
    h.played++; a.played++
    h.goals_for += rh; h.goals_against += ra
    a.goals_for += ra; a.goals_against += rh
    if (rh > ra)      { h.won++; h.points += 3; a.lost++ }
    else if (rh < ra) { a.won++; a.points += 3; h.lost++ }
    else              { h.drawn++; h.points++;   a.drawn++; a.points++ }
  }
  return table
}

export async function GET() {
  try {
    const seasonId = await getSeasonId()
    if (!seasonId) return NextResponse.json({ table: [], source: 'empty', finishedMatchdays: [] })

    // Beendete Spieltage
    const statusRes = await pool.query(
      'SELECT matchday FROM ucl_matchday_status WHERE season_id = $1 AND finished = TRUE ORDER BY matchday',
      [seasonId]
    )
    const finishedMatchdays: number[] = statusRes.rows.map((r: any) => Number(r.matchday))

    // Clubs immer laden
    const clubRes = await pool.query('SELECT id FROM ucl_clubs WHERE season_id = $1', [seasonId])
    const clubIds: string[] = clubRes.rows.map((r: any) => r.id)

    // Kein beendeter Spieltag → leere Tabelle
    if (finishedMatchdays.length === 0) {
      return NextResponse.json({ table: [], source: 'calculated', finishedMatchdays: [] })
    }

    // Matches aus beendeten Spieltagen
    const placeholders = finishedMatchdays.map((_: any, i: number) => `$${i + 2}`).join(', ')
    const matchRes = await pool.query(
      `SELECT home_club_id, away_club_id, result_home, result_away
       FROM ucl_matches
       WHERE season_id = $1
         AND phase = 'ligaphase'
         AND result_home IS NOT NULL
         AND result_away IS NOT NULL
         AND matchday IN (${placeholders})`,
      [seasonId, ...finishedMatchdays]
    )

    // Override vorhanden?
    const overrideRes = await pool.query(
      'SELECT club_id, position FROM ucl_table_override WHERE season_id = $1 ORDER BY position ASC',
      [seasonId]
    )

    if (overrideRes.rows.length > 0) {
      const stats = calcTable(matchRes.rows, clubIds)
      const table = overrideRes.rows.map((row: any, idx: number) => ({
        club_id: row.club_id,
        position: idx + 1,
        ...(stats[row.club_id] ?? { played:0, won:0, drawn:0, lost:0, goals_for:0, goals_against:0, points:0 }),
      }))
      return NextResponse.json({ table, source: 'override', finishedMatchdays })
    }

    // Automatisch sortieren
    const stats = calcTable(matchRes.rows, clubIds)
    const sorted = Object.entries(stats)
      .map(([club_id, s]) => ({ club_id, ...s }))
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        const da = a.goals_for - a.goals_against, db = b.goals_for - b.goals_against
        if (db !== da) return db - da
        return b.goals_for - a.goals_for
      })
      .map((row, idx) => ({ ...row, position: idx + 1 }))

    return NextResponse.json({ table: sorted, source: 'calculated', finishedMatchdays })
  } catch (e: any) {
    console.error('[UCL table route]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}