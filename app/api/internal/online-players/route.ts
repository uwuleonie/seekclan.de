import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// GET — SeekTabsystem holt alle Online-Spieler (last_seen < 60s)
export async function GET(req: NextRequest) {
  if (!await verifyPluginKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await pool.query(
    `SELECT player_name, uuid, server, skin_texture, skin_signature
     FROM mc_online_players
     WHERE last_seen > now() - interval '60 seconds'`
  )

  const by_server: Record<string, string[]> = {}
  const skins: Record<string, { texture: string; signature: string }> = {}

  for (const row of result.rows) {
    if (!by_server[row.server]) by_server[row.server] = []
    by_server[row.server].push(row.player_name)
    if (row.skin_texture) {
      skins[row.player_name] = { texture: row.skin_texture, signature: row.skin_signature || '' }
    }
  }

  return NextResponse.json({ by_server, skins })
}

// POST — Heartbeat eines einzelnen Spielers
export async function POST(req: NextRequest) {
  if (!await verifyPluginKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const { uuid, player_name, server, skin_texture, skin_signature } = body
  if (!uuid || !player_name || !server) return NextResponse.json({ error: 'Ungültige Daten' }, { status: 400 })

  await pool.query(
    `INSERT INTO mc_online_players (player_name, uuid, server, skin_texture, skin_signature, last_seen)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (player_name) DO UPDATE SET uuid=$2, server=$3, skin_texture=$4, skin_signature=$5, last_seen=now()`,
    [player_name, uuid, server, skin_texture || null, skin_signature || null]
  )

  return NextResponse.json({ success: true })
}

// DELETE — Spieler offline melden
export async function DELETE(req: NextRequest) {
  if (!await verifyPluginKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const { uuid } = body
  if (!uuid) return NextResponse.json({ error: 'uuid fehlt' }, { status: 400 })

  await pool.query('DELETE FROM mc_online_players WHERE uuid = $1', [uuid])
  return NextResponse.json({ success: true })
}