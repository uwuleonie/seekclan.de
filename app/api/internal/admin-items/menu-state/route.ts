import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// POST /api/internal/admin-items/menu-state
// Plugin speichert, ob ein Ei im /adminitems-Menü liegt (true) oder herausgenommen ist (false)
export async function POST(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { uuid, item_id, in_menu } = await req.json()
  if (!uuid || !item_id || typeof in_menu !== 'boolean') {
    return NextResponse.json({ error: 'uuid, item_id und in_menu erforderlich' }, { status: 400 })
  }

  const result = await pool.query(
    'UPDATE player_admin_items SET in_menu = $3 WHERE uuid = $1 AND item_id = $2',
    [uuid, item_id, in_menu]
  )

  if (result.rowCount === 0) {
    return NextResponse.json({ error: 'Ei nicht gefunden' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}