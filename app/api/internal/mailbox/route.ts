import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// GET /api/internal/mailbox?uuid=...
// Plugin lädt alle Items eines Spielers
export async function GET(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const uuid = new URL(req.url).searchParams.get('uuid')
  if (!uuid) return NextResponse.json({ error: 'uuid fehlt' }, { status: 400 })

  const result = await pool.query(
    `SELECT id, item_data, sender_name, sent_at
     FROM mailbox_items
     WHERE receiver_uuid = $1
     ORDER BY sent_at ASC`,
    [uuid]
  )

  return NextResponse.json({ items: result.rows })
}