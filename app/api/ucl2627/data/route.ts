import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { getSeasonId, getSlugFromParam } from '@/app/lib/ucl-season'

export async function GET(req: NextRequest) {
  try {
    const slug = getSlugFromParam(req.nextUrl.searchParams.get('comp'))
    const seasonId = await getSeasonId(slug)
    if (!seasonId) return NextResponse.json({ error: 'Season not found' }, { status: 404 })

    const [clubs, matches] = await Promise.all([
      pool.query('SELECT * FROM ucl_clubs WHERE season_id = $1 ORDER BY name', [seasonId]),
      pool.query('SELECT * FROM ucl_matches WHERE season_id = $1 ORDER BY kickoff', [seasonId]),
    ])

    return NextResponse.json({ season_id: seasonId, slug, clubs: clubs.rows, matches: matches.rows })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}