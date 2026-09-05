import { NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

// Alle Spieler-Partnerwahlen + Gewinne berechnen
export async function GET() {
  try {
    const seasonRes = await pool.query("SELECT id FROM ucl_seasons WHERE slug = '2627'")
    const seasonId = seasonRes.rows[0]?.id
    if (!seasonId) return NextResponse.json({ partners: [] })

    const res = await pool.query(
      `SELECT pp.user_id, u.username, pp.gast_name, pp.club_id
       FROM ucl_player_partners pp
       LEFT JOIN users u ON u.id = pp.user_id
       WHERE pp.season_id = $1`,
      [seasonId]
    )
    return NextResponse.json({ partners: res.rows })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}