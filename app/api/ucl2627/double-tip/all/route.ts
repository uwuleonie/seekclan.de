import { NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { getBothSeasonIds } from '@/app/lib/ucl-season'

export async function GET() {
  try {
    const { ucl, uwcl } = await getBothSeasonIds()
    const seasonIds = [ucl, uwcl].filter(Boolean)
    if (!seasonIds.length) return NextResponse.json({ doubles: [] })

    const res = await pool.query(
      `SELECT d.matchday, d.match_id, d.user_id, u.username, d.gast_name, s.slug AS comp
       FROM ucl_double_tips d
       LEFT JOIN users u ON u.id = d.user_id
       JOIN ucl_seasons s ON s.id = d.season_id
       WHERE d.season_id = ANY($1)`,
      [seasonIds]
    )
    return NextResponse.json({ doubles: res.rows })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}