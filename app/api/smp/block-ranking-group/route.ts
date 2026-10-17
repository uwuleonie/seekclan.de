import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { mcAnzeigenameSql } from '@/app/lib/smp-namen'

export async function GET(req: NextRequest) {
  const blockTypes = req.nextUrl.searchParams.get('block_types')

  if (!blockTypes) {
    return NextResponse.json({ error: 'block_types fehlt' }, { status: 400 })
  }

  const types = blockTypes.split(',').map(t => t.trim()).filter(Boolean)

  if (types.length === 0) {
    return NextResponse.json({ ranking: [] })
  }

  let breaks
  try {
    const result = await pool.query(
      'SELECT uuid, block_type, broken FROM smp_block_stats WHERE block_type = ANY($1) AND broken > 0',
      [types]
    )
    breaks = result.rows
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  if (!breaks || breaks.length === 0) {
    return NextResponse.json({ ranking: [] })
  }

  const totalByUuid: Record<string, number> = {}
  for (const b of breaks) {
    totalByUuid[b.uuid] = (totalByUuid[b.uuid] || 0) + b.broken
  }

  const uuids = Object.keys(totalByUuid)
  const playersResult = await pool.query(
    `SELECT s.uuid, s.player_name, ${mcAnzeigenameSql('s.uuid', 's.player_name')} AS name FROM smp_player_stats s WHERE s.uuid = ANY($1)`,
    [uuids]
  )

  const nameByUuid = playersResult.rows.reduce((acc, p) => {
    acc[p.uuid] = p.player_name
    return acc
  }, {} as Record<string, string>)
  // Anzeigename (Spitzname/Minecraft-Name des Accounts) – nur zur Anzeige
  const anzeigeByUuid = playersResult.rows.reduce((acc, p) => {
    acc[p.uuid] = p.name || p.player_name
    return acc
  }, {} as Record<string, string>)

  const ranking = Object.entries(totalByUuid)
    .map(([uuid, count]) => ({ name: anzeigeByUuid[uuid] || 'Unbekannt', player_name: nameByUuid[uuid] || null, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return NextResponse.json({ ranking })
}