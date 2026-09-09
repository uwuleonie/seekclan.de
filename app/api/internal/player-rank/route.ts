import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// GET /api/internal/player-rank?uuid=...
// Plugin holt Rang eines Spielers — gibt immer einen Rang zurück (Fallback: Standard-Rang)
export async function GET(req: NextRequest) {
  if (!await verifyPluginKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const uuid = new URL(req.url).searchParams.get('uuid')
  if (!uuid) return NextResponse.json({ error: 'uuid erforderlich' }, { status: 400 })

  // Spieler-Rang laden
  const result = await pool.query(
    `SELECT r.id, r.name, r.display_name, r.chat_prefix, r.tab_prefix, r.tab_suffix, r.color, r.priority
     FROM mc_player_ranks pr
     JOIN mc_ranks r ON pr.rank_id = r.id
     WHERE pr.uuid = $1`,
    [uuid]
  )

  if (result.rows[0]) {
    return NextResponse.json({ rank: result.rows[0] })
  }

  // Fallback: Standard-Rang
  const defaultRank = await pool.query('SELECT * FROM mc_ranks WHERE is_default = true LIMIT 1')
  return NextResponse.json({ rank: defaultRank.rows[0] || null })
}

// POST /api/internal/player-rank
// Plugin setzt Rang per Befehl (/rang, /rang-upgrade, /rang-downgrade)
export async function POST(req: NextRequest) {
  if (!await verifyPluginKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const { uuid, player_name, rank_id, assigned_by } = body as {
    uuid?: string; player_name?: string; rank_id?: number; assigned_by?: string
  }
  if (!uuid || rank_id === undefined) return NextResponse.json({ error: 'uuid und rank_id erforderlich' }, { status: 400 })

  const rankCheck = await pool.query('SELECT id, is_default FROM mc_ranks WHERE id = $1', [rank_id])
  if (!rankCheck.rows[0]) return NextResponse.json({ error: 'Rang nicht gefunden' }, { status: 404 })

  if (rankCheck.rows[0].is_default) {
    await pool.query('DELETE FROM mc_player_ranks WHERE uuid = $1', [uuid])
  } else {
    await pool.query(
      `INSERT INTO mc_player_ranks (uuid, player_name, rank_id, assigned_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (uuid) DO UPDATE SET rank_id = $3, assigned_by = $4, assigned_at = now(), player_name = $2`,
      [uuid, player_name || uuid, rank_id, assigned_by || 'ingame']
    )
  }
  return NextResponse.json({ success: true })
}