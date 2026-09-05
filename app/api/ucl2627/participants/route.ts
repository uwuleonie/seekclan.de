import { NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

// Öffentlich — gibt alle Teilnehmer mit minecraft_username zurück
export async function GET() {
  try {
    const seasonRes = await pool.query("SELECT id FROM ucl_seasons WHERE slug = '2627'")
    const seasonId = seasonRes.rows[0]?.id
    if (!seasonId) return NextResponse.json({ participants: [] })

    const res = await pool.query(
      `SELECT DISTINCT u.username, u.minecraft_username
       FROM users u
       WHERE u.id IN (
         SELECT DISTINCT user_id FROM ucl_match_tips WHERE season_id = $1 AND user_id IS NOT NULL
         UNION
         SELECT DISTINCT user_id FROM ucl_table_tips WHERE season_id = $1 AND user_id IS NOT NULL
       )`,
      [seasonId]
    )
    return NextResponse.json({ participants: res.rows })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}