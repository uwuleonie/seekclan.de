import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { mcAnzeigenameSql } from '@/app/lib/smp-namen'

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

  const ranking = breaks.map(b => ({
    name: anzeigeByUuid[b.uuid] || 'Unbekannt',
    player_name: nameByUuid[b.uuid] || null,
    count: b.broken,
  }))

  return NextResponse.json({ ranking })
}