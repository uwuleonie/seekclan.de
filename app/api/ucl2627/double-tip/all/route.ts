import { NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

// Alle Doppeltipps — für Leaderboard-Berechnung
export async function GET() {
  try {
    const seasonRes = await pool.query("SELECT id FROM ucl_seasons WHERE slug = '2627'")
    const seasonId = seasonRes.rows[0]?.id
    if (!seasonId) return NextResponse.json({ doubles: [] })

    const res = await pool.query(
      `SELECT d.matchday, d.match_id, d.user_id, u.username, d.gast_name
       FROM ucl_double_tips d
       LEFT JOIN users u ON u.id = d.user_id
       WHERE d.season_id = $1`,
      [seasonId]
    )
    return NextResponse.json({ doubles: res.rows })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}