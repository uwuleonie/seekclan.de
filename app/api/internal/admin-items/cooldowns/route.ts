import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// GET /api/internal/admin-items/cooldowns?uuid=...&item_id=...
// GET /api/internal/admin-items/cooldowns?uuid=...&all=true
// Plugin fragt Cooldown(s) ab
export async function GET(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const params = new URL(req.url).searchParams
  const uuid = params.get('uuid')
  if (!uuid) return NextResponse.json({ error: 'uuid fehlt' }, { status: 400 })

  // Alle Cooldowns eines Spielers (beim Login-Preload)
  if (params.get('all') === 'true') {
    const result = await pool.query(
      `SELECT item_id, cooldown_until
       FROM admin_item_cooldowns
       WHERE uuid = $1 AND cooldown_until > EXTRACT(EPOCH FROM now())`,
      [uuid]
    )
    return NextResponse.json({ cooldowns: result.rows })
  }

  // Einzelner Cooldown
  const item_id = params.get('item_id')
  if (!item_id) return NextResponse.json({ error: 'item_id fehlt' }, { status: 400 })

  const result = await pool.query(
    `SELECT cooldown_until
     FROM admin_item_cooldowns
     WHERE uuid = $1 AND item_id = $2`,
    [uuid, item_id]
  )

  const row = result.rows[0]
  return NextResponse.json({
    cooldown_until: row?.cooldown_until ?? null
  })
}

// POST /api/internal/admin-items/cooldowns
// Plugin setzt Cooldown
export async function POST(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { uuid, item_id, cooldown_until } = await req.json()
  if (!uuid || !item_id || cooldown_until == null) {
    return NextResponse.json({ error: 'uuid, item_id und cooldown_until erforderlich' }, { status: 400 })
  }

  await pool.query(
    `INSERT INTO admin_item_cooldowns (uuid, item_id, cooldown_until)
     VALUES ($1, $2, $3)
     ON CONFLICT (uuid, item_id) DO UPDATE SET cooldown_until = $3`,
    [uuid, item_id, cooldown_until]
  )

  return NextResponse.json({ ok: true })
}

// DELETE /api/internal/admin-items/cooldowns
// Plugin oder Admin löscht Cooldown
export async function DELETE(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { uuid, item_id } = await req.json()
  if (!uuid || !item_id) {
    return NextResponse.json({ error: 'uuid und item_id erforderlich' }, { status: 400 })
  }

  await pool.query(
    `DELETE FROM admin_item_cooldowns WHERE uuid = $1 AND item_id = $2`,
    [uuid, item_id]
  )

  return NextResponse.json({ ok: true })
}