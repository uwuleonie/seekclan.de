import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// Upsert für smp_player_stats - playtime_minutes wird live aus smp_login_sessions
// berechnet (siehe /api/smp/stats), nicht hier geschrieben. villager_trades ist
// IMMER der absolute aktuelle Stand aus der Bukkit-Statistik, kein Delta.
export async function POST(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Ungültiger API Key' }, { status: 401 })
  }

  const body = await req.json()
  const { uuid, player_name, blocks_broken, blocks_placed, mob_kills, deaths, villager_trades } = body

  if (!uuid || !player_name) {
    return NextResponse.json({ error: 'uuid und player_name sind erforderlich' }, { status: 400 })
  }

  try {
    await pool.query(
      `INSERT INTO smp_player_stats (uuid, player_name, blocks_broken, blocks_placed, mob_kills, deaths, villager_trades, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())
       ON CONFLICT (uuid) DO UPDATE SET
         player_name = EXCLUDED.player_name,
         blocks_broken = EXCLUDED.blocks_broken,
         blocks_placed = EXCLUDED.blocks_placed,
         mob_kills = EXCLUDED.mob_kills,
         deaths = EXCLUDED.deaths,
         villager_trades = EXCLUDED.villager_trades,
         updated_at = now()`,
      [uuid, player_name, blocks_broken || 0, blocks_placed || 0, mob_kills || 0, deaths || 0, villager_trades || 0]
    )
  } catch (err: any) {
    return NextResponse.json({ error: `Stats konnten nicht gespeichert werden: ${err.message}` }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}