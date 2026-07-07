import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// GET /api/internal/player-data?uuid=...&name=...
// Lädt Spielerdaten (Sternies, Lobby-Playtime, SMP-Playtime)
export async function GET(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const uuid = searchParams.get('uuid')
  const name = searchParams.get('name')

  if (!uuid) return NextResponse.json({ error: 'uuid erforderlich' }, { status: 400 })

  // Upsert: Spieler anlegen falls nicht vorhanden
  await pool.query(
    `INSERT INTO lobby_player_data (uuid, player_name)
     VALUES ($1, $2)
     ON CONFLICT (uuid) DO UPDATE SET player_name = $2, last_seen = now()`,
    [uuid, name || uuid]
  )

  // Lobby-Daten laden
  const lobbyResult = await pool.query(
    'SELECT sternies, lobby_playtime_minutes FROM lobby_player_data WHERE uuid = $1',
    [uuid]
  )

  // SMP-Playtime aus SeekInventory laden
  const smpResult = await pool.query(
    'SELECT playtime_minutes FROM smp_player_stats WHERE uuid = $1',
    [uuid]
  )

  const lobby = lobbyResult.rows[0]
  const smpMinutes = smpResult.rows[0]?.playtime_minutes || 0

  return NextResponse.json({
    data: {
      sternies: lobby?.sternies || 0,
      lobby_playtime_minutes: lobby?.lobby_playtime_minutes || 0,
      smp_playtime_minutes: smpMinutes,
    }
  })
}

// POST /api/internal/player-data
// Playtime hinzufügen oder Sternies ändern
export async function POST(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { uuid, player_name, add_lobby_minutes, add_sternies } = body as {
    uuid?: string
    player_name?: string
    add_lobby_minutes?: number
    add_sternies?: number
  }

  if (!uuid) return NextResponse.json({ error: 'uuid erforderlich' }, { status: 400 })

  // Sicherstellen dass Spieler existiert
  await pool.query(
    `INSERT INTO lobby_player_data (uuid, player_name)
     VALUES ($1, $2)
     ON CONFLICT (uuid) DO UPDATE SET player_name = $2, last_seen = now()`,
    [uuid, player_name || uuid]
  )

  if (add_lobby_minutes && add_lobby_minutes > 0) {
    await pool.query(
      'UPDATE lobby_player_data SET lobby_playtime_minutes = lobby_playtime_minutes + $1 WHERE uuid = $2',
      [add_lobby_minutes, uuid]
    )
  }

  if (add_sternies) {
    await pool.query(
      'UPDATE lobby_player_data SET sternies = GREATEST(0, sternies + $1) WHERE uuid = $2',
      [add_sternies, uuid]
    )
  }

  return NextResponse.json({ success: true })
}