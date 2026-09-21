import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// GET /api/internal/admin-items/player-items?uuid=...
// Plugin fragt: welche Items hat dieser Spieler?
export async function GET(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const uuid = new URL(req.url).searchParams.get('uuid')
  if (!uuid) return NextResponse.json({ error: 'uuid fehlt' }, { status: 400 })

  const result = await pool.query(
    `SELECT item_id, granted_at, granted_by
     FROM player_admin_items
     WHERE uuid = $1
     ORDER BY granted_at ASC`,
    [uuid]
  )

  return NextResponse.json({ items: result.rows })
}

// POST /api/internal/admin-items/player-items
// Plugin meldet: Spieler hat Item erhalten (z.B. nach /giveadminitem)
export async function POST(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { uuid, player_name, item_id, granted_by } = await req.json()
  if (!uuid || !player_name || !item_id) {
    return NextResponse.json({ error: 'uuid, player_name und item_id erforderlich' }, { status: 400 })
  }

  await pool.query(
    `INSERT INTO player_admin_items (uuid, player_name, item_id, granted_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (uuid, item_id) DO NOTHING`,
    [uuid, player_name, item_id, granted_by ?? 'plugin']
  )

  return NextResponse.json({ ok: true })
}