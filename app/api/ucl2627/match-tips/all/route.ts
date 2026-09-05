import { NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

export async function GET() {
  try {
    const seasonRes = await pool.query("SELECT id FROM ucl_seasons WHERE slug = '2627'")
    const seasonId = seasonRes.rows[0]?.id
    if (!seasonId) return NextResponse.json({ tips: [] })

    const result = await pool.query(
      `SELECT t.id, t.match_id, t.user_id, u.username, t.gast_name, t.tip_home, t.tip_away
       FROM ucl_match_tips t
       LEFT JOIN users u ON u.id = t.user_id
       WHERE t.season_id = $1`,
      [seasonId]
    )
    return NextResponse.json({ tips: result.rows })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}