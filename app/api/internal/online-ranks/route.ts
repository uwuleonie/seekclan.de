import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

export async function GET(req: NextRequest) {
  if (!await verifyPluginKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const players = new URL(req.url).searchParams.get('players')
  if (!players) return NextResponse.json({ ranks: {} })

  const names = players.split(',').map(n => n.trim()).filter(Boolean).slice(0, 100)
  if (names.length === 0) return NextResponse.json({ ranks: {} })

  const result = await pool.query(
    `SELECT pr.player_name, r.tab_prefix, r.name_color, r.is_default
     FROM mc_player_ranks pr
     JOIN mc_ranks r ON pr.rank_id = r.id
     WHERE pr.player_name = ANY($1)`,
    [names]
  )

  const ranks: Record<string, { tab_prefix: string; name_color: string }> = {}
  for (const row of result.rows) {
    if (!row.is_default) {
      ranks[row.player_name] = {
        tab_prefix: row.tab_prefix || '',
        name_color: row.name_color || ''
      }
    }
  }
  return NextResponse.json({ ranks })
}