import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// GET /api/internal/admin-items/player-items?uuid=...
// Plugin lädt alle Eier eines Spielers inkl. ob sie im Menü liegen
export async function GET(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const uuid = new URL(req.url).searchParams.get('uuid')
  if (!uuid) return NextResponse.json({ error: 'uuid fehlt' }, { status: 400 })

  const result = await pool.query(
    `SELECT item_id, in_menu, granted_at, granted_by
     FROM player_admin_items
     WHERE uuid = $1
     ORDER BY granted_at ASC`,
    [uuid]
  )

  return NextResponse.json({ items: result.rows })
}

// POST /api/internal/admin-items/player-items
// Plugin vergibt ein Ei (/giveadminitem). Jedes Ei gibt es nur einmal.
export async function POST(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { uuid, player_name, item_id, granted_by } = await req.json()
  if (!uuid || !player_name || !item_id) {
    return NextResponse.json({ error: 'uuid, player_name und item_id erforderlich' }, { status: 400 })
  }

  const exists = await pool.query(
    'SELECT player_name FROM player_admin_items WHERE item_id = $1',
    [item_id]
  )
  if (exists.rows.length > 0) {
    return NextResponse.json(
      { error: `Bereits an ${exists.rows[0].player_name} vergeben.` },
      { status: 409 }
    )
  }

  await pool.query(
    `INSERT INTO player_admin_items (uuid, player_name, item_id, granted_by, in_menu)
     VALUES ($1, $2, $3, $4, true)`,
    [uuid, player_name, item_id, granted_by ?? 'plugin']
  )

  return NextResponse.json({ ok: true })
}