import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// POST /api/internal/admin-items/totem-death
// Plugin meldet: Spieler ist gestorben, Woche-6-Totem wurde ausgelöst
export async function POST(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { uuid, player_name } = await req.json()
  if (!uuid || !player_name) {
    return NextResponse.json({ error: 'uuid und player_name erforderlich' }, { status: 400 })
  }

  await pool.query(
    `INSERT INTO admin_item_totem_deaths (uuid, player_name) VALUES ($1, $2)`,
    [uuid, player_name]
  )

  return NextResponse.json({ ok: true })
}