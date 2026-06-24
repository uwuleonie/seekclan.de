import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

export async function GET(req: NextRequest) {
  const mobType = req.nextUrl.searchParams.get('mob_type')

  if (!mobType) {
    return NextResponse.json({ error: 'mob_type fehlt' }, { status: 400 })
  }

  let kills
  try {
    const result = await pool.query(
      `SELECT uuid, kills FROM smp_mob_kills
       WHERE mob_type ILIKE $1 AND kills > 0
       ORDER BY kills DESC LIMIT 10`,
      [mobType]
    )
    kills = result.rows
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  if (!kills || kills.length === 0) {
    return NextResponse.json({ ranking: [] })
  }

  const uuids = kills.map(k => k.uuid)
  const playersResult = await pool.query(
    'SELECT uuid, player_name FROM smp_player_stats WHERE uuid = ANY($1)',
    [uuids]
  )

  const nameByUuid = playersResult.rows.reduce((acc, p) => {
    acc[p.uuid] = p.player_name
    return acc
  }, {} as Record<string, string>)

  const ranking = kills.map(k => ({
    name: nameByUuid[k.uuid] || 'Unbekannt',
    kills: k.kills,
  }))

  return NextResponse.json({ ranking })
}