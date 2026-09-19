import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { getSeasonId, getSlugFromParam, getBothSeasonIds } from '@/app/lib/ucl-season'

export async function GET(req: NextRequest) {
  try {
    const compParam = req.nextUrl.searchParams.get('comp')

    if (compParam) {
      const slug = getSlugFromParam(compParam)
      const seasonId = await getSeasonId(slug)
      if (!seasonId) return NextResponse.json({ tips: [] })
      const result = await pool.query(
        `SELECT t.id, t.match_id, t.user_id, u.username, t.gast_name, t.tip_home, t.tip_away, $2::text AS comp
         FROM ucl_match_tips t
         LEFT JOIN users u ON u.id = t.user_id
         WHERE t.season_id = $1`,
        [seasonId, slug]
      )
      return NextResponse.json({ tips: result.rows })
    }

    const { ucl, uwcl } = await getBothSeasonIds()
    const seasonIds = [ucl, uwcl].filter(Boolean)
    if (!seasonIds.length) return NextResponse.json({ tips: [] })

    const result = await pool.query(
      `SELECT t.id, t.match_id, t.user_id, u.username, t.gast_name, t.tip_home, t.tip_away,
              s.slug AS comp
       FROM ucl_match_tips t
       LEFT JOIN users u ON u.id = t.user_id
       JOIN ucl_seasons s ON s.id = t.season_id
       WHERE t.season_id = ANY($1)`,
      [seasonIds]
    )
    return NextResponse.json({ tips: result.rows })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}