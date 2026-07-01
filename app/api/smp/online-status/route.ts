import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

// Liefert für mehrere Spieler auf einmal, ob sie aktuell online sind — bestimmt
// über die Aktualität ihres letzten Positions-Updates (das Plugin schreibt
// smp_player_positions nur, während der Spieler online ist). Gleiches Prinzip
// wie STALE_AFTER_MS bei /api/smp/server-status, nur pro Spieler statt global.
//
// GET /api/smp/online-status?usernames=name1,name2,name3

const ONLINE_AFTER_MS = 2 * 60 * 1000 // 2 Minuten, wie beim globalen Server-Status

export async function GET(req: NextRequest) {
  const usernamesParam = req.nextUrl.searchParams.get('usernames')
  if (!usernamesParam) return NextResponse.json({ error: 'usernames erforderlich' }, { status: 400 })

  const usernames = usernamesParam.split(',').map(u => u.trim()).filter(Boolean)
  if (usernames.length === 0) return NextResponse.json({ status: {} })

  const result = await pool.query(
    `SELECT DISTINCT ON (player_name) player_name, recorded_at
     FROM smp_player_positions
     WHERE player_name ILIKE ANY($1)
     ORDER BY player_name, recorded_at DESC`,
    [usernames.map(u => `${u}`)]
  )

  const status: Record<string, boolean> = {}
  for (const name of usernames) status[name] = false

  for (const row of result.rows) {
    const matchingUsername = usernames.find(u => u.toLowerCase() === row.player_name.toLowerCase())
    if (!matchingUsername) continue
    const isOnline = Date.now() - new Date(row.recorded_at).getTime() < ONLINE_AFTER_MS
    status[matchingUsername] = isOnline
  }

  return NextResponse.json({ status })
}