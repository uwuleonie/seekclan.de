import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { mcAnzeigenameSql } from '@/app/lib/smp-namen'

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

  const ranking = kills.map(k => ({
    name: anzeigeByUuid[k.uuid] || 'Unbekannt',
    player_name: nameByUuid[k.uuid] || null,
    kills: k.kills,
  }))

  return NextResponse.json({ ranking })
}