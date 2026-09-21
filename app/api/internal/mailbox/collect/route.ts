import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// POST /api/internal/mailbox/collect
// Plugin meldet: Spieler hat Item abgeholt → aus DB löschen
export async function POST(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { uuid, id } = await req.json()
  if (!uuid || !id) {
    return NextResponse.json({ error: 'uuid und id erforderlich' }, { status: 400 })
  }

  // Sicherheitscheck: Item gehört wirklich diesem Spieler
  await pool.query(
    `DELETE FROM mailbox_items WHERE id = $1 AND receiver_uuid = $2`,
    [id, uuid]
  )

  return NextResponse.json({ ok: true })
}