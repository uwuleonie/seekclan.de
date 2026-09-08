import { NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function getSeasonId() {
  const res = await pool.query("SELECT id FROM ucl_seasons WHERE slug = '2627'")
  return res.rows[0]?.id ?? null
}

// Alle Star-Tipps + Ergebnisse — öffentlich (keine Auth), wird für Leaderboard-Detailansicht benötigt
export async function GET() {
  try {
    const seasonId = await getSeasonId()
    if (!seasonId) return NextResponse.json({ tips: [], results: [] })

    const [tipsRes, resultsRes] = await Promise.all([
      pool.query(
        `SELECT st.matchday, st.player_name, st.goals,
                u.username, st.gast_name
         FROM ucl_star_tips st
         LEFT JOIN users u ON u.id = st.user_id
         WHERE st.season_id = $1
         ORDER BY st.matchday`,
        [seasonId]
      ),
      pool.query(
        'SELECT matchday, player_name, actual_goals FROM ucl_star_results WHERE season_id = $1 ORDER BY matchday',
        [seasonId]
      ),
    ])

    return NextResponse.json({ tips: tipsRes.rows, results: resultsRes.rows })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}