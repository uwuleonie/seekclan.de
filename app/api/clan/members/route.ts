import { NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

export async function GET() {
  try {
    const result = await pool.query(
      `SELECT
         cm.id, cm.display_name, cm.role, cm.join_date, cm.discord_tag,
         COALESCE(
           json_agg(
             json_build_object('id', cb.id, 'name', cb.name, 'icon_url', cb.icon_url)
           ) FILTER (WHERE cb.id IS NOT NULL),
           '[]'
         ) AS badges
       FROM clan_members cm
       LEFT JOIN clan_member_badges cmb ON cmb.member_id = cm.id
       LEFT JOIN clan_badges cb ON cb.id = cmb.badge_id
       GROUP BY cm.id, cm.display_name, cm.role, cm.join_date, cm.discord_tag
       ORDER BY cm.join_date ASC`
    )

    return NextResponse.json({ members: result.rows })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}