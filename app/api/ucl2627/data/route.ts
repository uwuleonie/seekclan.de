import { NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function getSeasonId() {
  const res = await pool.query("SELECT id FROM ucl_seasons WHERE slug = '2627'")
  return res.rows[0]?.id ?? null
}

export async function GET() {
  try {
    const seasonId = await getSeasonId()
    if (!seasonId) return NextResponse.json({ error: 'Season not found' }, { status: 404 })

    const [clubs, matches] = await Promise.all([
      pool.query('SELECT * FROM ucl_clubs WHERE season_id = $1 ORDER BY name', [seasonId]),
      pool.query('SELECT * FROM ucl_matches WHERE season_id = $1 ORDER BY kickoff', [seasonId]),
    ])

    return NextResponse.json({ season_id: seasonId, clubs: clubs.rows, matches: matches.rows })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}