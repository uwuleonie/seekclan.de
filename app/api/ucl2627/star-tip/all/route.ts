import { NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { getBothSeasonIds, UWCL_SLUG } from '@/app/lib/ucl-season'

const COMP_SQL = `CASE WHEN s.slug = '${UWCL_SLUG}' THEN 'uwcl' ELSE 'ucl' END`

export async function GET() {
  try {
    const { ucl, uwcl } = await getBothSeasonIds()
    const seasonIds = [ucl, uwcl].filter(Boolean)
    if (!seasonIds.length) return NextResponse.json({ tips: [], results: [] })

    const [tipsRes, resultsRes] = await Promise.all([
      pool.query(
        `SELECT st.matchday, st.player_name, u.username, st.gast_name, ${COMP_SQL} AS comp
         FROM ucl_star_tips st
         LEFT JOIN users u ON u.id = st.user_id
         JOIN ucl_seasons s ON s.id = st.season_id
         WHERE st.season_id = ANY($1)
         ORDER BY comp, st.matchday, st.player_name`,
        [seasonIds]
      ),
      pool.query(
        `SELECT sr.matchday, sr.player_name, sr.actual_goals, ${COMP_SQL} AS comp
         FROM ucl_star_results sr
         JOIN ucl_seasons s ON s.id = sr.season_id
         WHERE sr.season_id = ANY($1)
         ORDER BY comp, sr.matchday, sr.player_name`,
        [seasonIds]
      ),
    ])

    return NextResponse.json({ tips: tipsRes.rows, results: resultsRes.rows })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}