import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// Upsert für einen täglichen Snapshot in smp_stats_history. playtime_minutes wird
// hier NICHT mehr geschrieben - die Website-Route, die diese Historie anzeigt,
// berechnet die Spielzeit pro Tag stattdessen live aus smp_login_sessions
// (dort existiert dank PlaytimeTracker bereits eine Zeile pro Spieler und Tag).
export async function POST(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Ungültiger API Key' }, { status: 401 })
  }

  const body = await req.json()
  const { uuid, player_name, date, blocks_broken, blocks_placed, mob_kills, deaths } = body

  if (!uuid || !player_name || !date) {
    return NextResponse.json({ error: 'uuid, player_name und date sind erforderlich' }, { status: 400 })
  }

  try {
    await pool.query(
      `INSERT INTO smp_stats_history (uuid, player_name, date, blocks_broken, blocks_placed, mob_kills, deaths)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (uuid, date) DO UPDATE SET
         player_name = EXCLUDED.player_name,
         blocks_broken = EXCLUDED.blocks_broken,
         blocks_placed = EXCLUDED.blocks_placed,
         mob_kills = EXCLUDED.mob_kills,
         deaths = EXCLUDED.deaths`,
      [uuid, player_name, date, blocks_broken || 0, blocks_placed || 0, mob_kills || 0, deaths || 0]
    )
  } catch (err: any) {
    return NextResponse.json({ error: `History-Snapshot konnte nicht gespeichert werden: ${err.message}` }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}