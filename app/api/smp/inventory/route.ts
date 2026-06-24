import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username')
  if (!username) return NextResponse.json({ error: 'username fehlt' }, { status: 400 })

  const statsResult = await pool.query(
    'SELECT uuid FROM smp_player_stats WHERE player_name ILIKE $1',
    [username]
  )
  const stats = statsResult.rows[0]

  if (!stats) return NextResponse.json({ inventory: null })

  const invResult = await pool.query(
    'SELECT inventory, enderchest, armor, offhand, updated_at FROM smp_player_inventory WHERE uuid = $1',
    [stats.uuid]
  )

  return NextResponse.json({ inventory: invResult.rows[0] || null })
}