import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// GET /api/internal/online-ranks?players=name1,name2
// Liefert pro Spieler: Tab-Prefix, Namensfarbe, Prioritaet.
// Spieler ohne Eintrag in mc_player_ranks bekommen den Standard-Rang.
export async function GET(req: NextRequest) {
  if (!await verifyPluginKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const players = new URL(req.url).searchParams.get('players')
  if (!players) return NextResponse.json({ ranks: {} })

  const names = players.split(',').map(n => n.trim()).filter(Boolean).slice(0, 200)
  if (names.length === 0) return NextResponse.json({ ranks: {} })
  const lower = names.map(n => n.toLowerCase())

  const result = await pool.query(
    `SELECT pr.player_name, r.tab_prefix, r.color, r.priority
     FROM mc_player_ranks pr
     JOIN mc_ranks r ON pr.rank_id = r.id
     WHERE LOWER(pr.player_name) = ANY($1)`,
    [lower]
  )
  const defaultResult = await pool.query(
    'SELECT tab_prefix, color, priority FROM mc_ranks WHERE is_default = true LIMIT 1'
  )
  const def = defaultResult.rows[0] || null

  const byLower = new Map<string, any>()
  for (const row of result.rows) byLower.set(String(row.player_name).toLowerCase(), row)

  const ranks: Record<string, { prefix: string; color: string; priority: number }> = {}
  for (const name of names) {
    const row = byLower.get(name.toLowerCase()) || def
    if (!row) continue
    ranks[name] = {
      prefix: row.tab_prefix || '',
      color: row.color || '§f',
      priority: Math.max(0, Number(row.priority) || 0),
    }
  }
  return NextResponse.json({ ranks })
}