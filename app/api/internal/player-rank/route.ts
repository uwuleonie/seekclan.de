import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// GET /api/internal/player-rank?uuid=...&name=...
// Hat der Spieler noch keinen Rang, bekommt er sofort den Standard-Rang (wird gespeichert).
export async function GET(req: NextRequest) {
  if (!await verifyPluginKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const params = new URL(req.url).searchParams
  const uuid = params.get('uuid')
  const name = params.get('name')
  if (!uuid) return NextResponse.json({ error: 'uuid erforderlich' }, { status: 400 })

  const result = await pool.query(
    `SELECT r.id, r.name, r.display_name, r.chat_prefix, r.tab_prefix, r.tab_suffix,
            r.color, r.priority, r.is_default, r.permissions, r.can_assign_up_to_priority,
            pr.player_name
     FROM mc_player_ranks pr
     JOIN mc_ranks r ON pr.rank_id = r.id
     WHERE pr.uuid = $1`,
    [uuid]
  )

  if (result.rows[0]) {
    // Spielername aktuell halten (Namensaenderungen)
    if (name && result.rows[0].player_name !== name) {
      await pool.query('UPDATE mc_player_ranks SET player_name = $2 WHERE uuid = $1', [uuid, name])
    }
    const { player_name, ...rank } = result.rows[0]
    return NextResponse.json({ rank })
  }

  // Noch kein Rang -> Standard-Rang vergeben und speichern
  const defaultRank = await pool.query('SELECT * FROM mc_ranks WHERE is_default = true LIMIT 1')
  const rank = defaultRank.rows[0] || null
  if (rank && name) {
    await pool.query(
      `INSERT INTO mc_player_ranks (uuid, player_name, rank_id, assigned_by)
       VALUES ($1, $2, $3, 'auto')
       ON CONFLICT (uuid) DO NOTHING`,
      [uuid, name, rank.id]
    )
  }
  return NextResponse.json({ rank })
}

// POST /api/internal/player-rank
// Rang per Befehl setzen (/rang, /rang-upgrade, /rang-downgrade) — auch der Standard-Rang wird gespeichert.
export async function POST(req: NextRequest) {
  if (!await verifyPluginKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const { uuid, player_name, rank_id, assigned_by } = body as {
    uuid?: string; player_name?: string; rank_id?: number; assigned_by?: string
  }
  if (!uuid || rank_id === undefined) return NextResponse.json({ error: 'uuid und rank_id erforderlich' }, { status: 400 })

  const rankCheck = await pool.query('SELECT id FROM mc_ranks WHERE id = $1', [rank_id])
  if (!rankCheck.rows[0]) return NextResponse.json({ error: 'Rang nicht gefunden' }, { status: 404 })

  await pool.query(
    `INSERT INTO mc_player_ranks (uuid, player_name, rank_id, assigned_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (uuid) DO UPDATE SET rank_id = $3, assigned_by = $4, assigned_at = now(), player_name = $2`,
    [uuid, player_name || uuid, rank_id, assigned_by || 'ingame']
  )
  return NextResponse.json({ success: true })
}