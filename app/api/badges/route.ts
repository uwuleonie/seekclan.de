import { NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

export async function GET() {
  const badgesResult = await pool.query(
    `SELECT
       cb.*,
       CASE WHEN bc.id IS NOT NULL THEN json_build_object('id', bc.id, 'name', bc.name, 'color', bc.color) ELSE NULL END AS badge_categories
     FROM clan_badges cb
     LEFT JOIN badge_categories bc ON bc.id = cb.category_id
     ORDER BY cb.name ASC`
  )

  const categoriesResult = await pool.query('SELECT * FROM badge_categories ORDER BY created_at ASC')

  return NextResponse.json({ badges: badgesResult.rows || [], categories: categoriesResult.rows || [] })
}