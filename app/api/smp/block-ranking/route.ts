import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

export async function GET(req: NextRequest) {
  const blockType = req.nextUrl.searchParams.get('block_type')

  if (!blockType) {
    return NextResponse.json({ error: 'block_type fehlt' }, { status: 400 })
  }

  let breaks
  try {
    const result = await pool.query(
      `SELECT uuid, broken FROM smp_block_stats
       WHERE block_type ILIKE $1 AND broken > 0
       ORDER BY broken DESC LIMIT 10`,
      [blockType]
    )
    breaks = result.rows
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  if (!breaks || breaks.length === 0) {
    return NextResponse.json({ ranking: [] })
  }

  const uuids = breaks.map(b => b.uuid)
  const playersResult = await pool.query(
    'SELECT uuid, player_name FROM smp_player_stats WHERE uuid = ANY($1)',
    [uuids]
  )

  const nameByUuid = playersResult.rows.reduce((acc, p) => {
    acc[p.uuid] = p.player_name
    return acc
  }, {} as Record<string, string>)

  const ranking = breaks.map(b => ({
    name: nameByUuid[b.uuid] || 'Unbekannt',
    count: b.broken,
  }))

  return NextResponse.json({ ranking })
}