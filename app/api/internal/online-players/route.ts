import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// GET /api/internal/online-players — alle online Spieler (alle Server)
export async function GET(req: NextRequest) {
  if (!await verifyPluginKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Spieler die in den letzten 30 Sekunden einen Heartbeat geschickt haben
  const result = await pool.query(
    `SELECT player_name, server FROM lobby_online_sessions
     WHERE last_heartbeat > now() - INTERVAL '5 seconds'
     ORDER BY player_name ASC`
  )

  return NextResponse.json({
    players: result.rows.map(r => r.player_name),
    by_server: result.rows.reduce((acc: Record<string, string[]>, r) => {
      if (!acc[r.server]) acc[r.server] = []
      acc[r.server].push(r.player_name)
      return acc
    }, {})
  })
}

// POST /api/internal/online-players — Heartbeat senden
export async function POST(req: NextRequest) {
  if (!await verifyPluginKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { uuid, player_name, server } = await req.json().catch(() => ({}))
  if (!uuid || !player_name) return NextResponse.json({ error: 'uuid + player_name erforderlich' }, { status: 400 })

  await pool.query(
    `INSERT INTO lobby_online_sessions (uuid, player_name, server, last_heartbeat)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (uuid) DO UPDATE SET player_name = $2, server = $3, last_heartbeat = now()`,
    [uuid, player_name, server || 'lobby']
  )

  return NextResponse.json({ success: true })
}

// DELETE /api/internal/online-players — Spieler offline melden
export async function DELETE(req: NextRequest) {
  if (!await verifyPluginKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { uuid } = await req.json().catch(() => ({}))
  if (!uuid) return NextResponse.json({ error: 'uuid erforderlich' }, { status: 400 })

  await pool.query('DELETE FROM lobby_online_sessions WHERE uuid = $1', [uuid])
  return NextResponse.json({ success: true })
}