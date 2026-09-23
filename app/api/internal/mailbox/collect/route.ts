import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// POST /api/internal/mailbox/collect
// Plugin will ein Item abholen → erst hier löschen.
// deleted = 1 → Spieler bekommt das Item, deleted = 0 → war schon weg (kein doppeltes Abholen)
export async function POST(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { uuid, id } = await req.json()
  if (!uuid || !id) {
    return NextResponse.json({ error: 'uuid und id erforderlich' }, { status: 400 })
  }

  const result = await pool.query(
    'DELETE FROM mailbox_items WHERE id = $1 AND receiver_uuid = $2',
    [id, uuid]
  )

  return NextResponse.json({ ok: true, deleted: result.rowCount ?? 0 })
}