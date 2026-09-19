import { NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { getBothSeasonIds, UCL_SLUG } from '@/app/lib/ucl-season'

export async function GET() {
  try {
    const { ucl } = await getBothSeasonIds()
    if (!ucl) return NextResponse.json({ tips: [] })

    const uclRes = await pool.query(
      `SELECT t.user_id, u.username, t.gast_name, t.ranking, t.ranking_uwcl
       FROM ucl_table_tips t
       LEFT JOIN users u ON u.id = t.user_id
       WHERE t.season_id = $1`,
      [ucl]
    )

    return NextResponse.json({ tips: uclRes.rows })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}