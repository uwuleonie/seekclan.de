import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'
import { isUuid, uuidToName } from '@/app/lib/mojang'

// GET /api/internal/rank-members
// Alle Raenge ueber dem Standard-Rang, jeweils mit den Spielern, die ihn haben.
export async function GET(req: NextRequest) {
  if (!await verifyPluginKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ranksResult = await pool.query(
    `SELECT id, name, display_name, tab_prefix, color, priority
     FROM mc_ranks
     WHERE is_default = false
     ORDER BY priority DESC, id ASC`
  )
  const membersResult = await pool.query(
    `SELECT pr.uuid, pr.rank_id, pr.player_name
     FROM mc_player_ranks pr
     JOIN mc_ranks r ON r.id = pr.rank_id
     WHERE r.is_default = false`
  )

  // Eintraege, bei denen nur die UUID als Name gespeichert ist, reparieren
  const broken = membersResult.rows.filter((r: any) => !r.player_name || isUuid(r.player_name)).slice(0, 20)
  await Promise.all(broken.map(async (r: any) => {
    const name = await uuidToName(r.uuid)
    if (name) {
      await pool.query('UPDATE mc_player_ranks SET player_name = $2 WHERE uuid = $1', [r.uuid, name])
      r.player_name = name
    }
  }))

  const byRank = new Map<number, string[]>()
  for (const row of membersResult.rows) {
    const list = byRank.get(row.rank_id) || []
    list.push(row.player_name)
    byRank.set(row.rank_id, list)
  }
  for (const list of byRank.values()) list.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))

  const ranks = ranksResult.rows.map((r: any) => ({ ...r, members: byRank.get(r.id) || [] }))
  return NextResponse.json({ ranks })
}