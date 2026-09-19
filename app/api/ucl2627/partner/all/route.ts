import { NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { getBothSeasonIds } from '@/app/lib/ucl-season'

export async function GET() {
  try {
    const { ucl, uwcl } = await getBothSeasonIds()
    const seasonIds = [ucl, uwcl].filter(Boolean)
    if (!seasonIds.length) return NextResponse.json({ partners: [] })

    const res = await pool.query(
      `SELECT pp.user_id, u.username, pp.gast_name, pp.club_id, s.slug AS comp
       FROM ucl_player_partners pp
       LEFT JOIN users u ON u.id = pp.user_id
       JOIN ucl_seasons s ON s.id = pp.season_id
       WHERE pp.season_id = ANY($1)`,
      [seasonIds]
    )
    return NextResponse.json({ partners: res.rows })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}