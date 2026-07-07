import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// GET /api/internal/player-pets?uuid=...
export async function GET(req: NextRequest) {
  if (!await verifyPluginKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const uuid = new URL(req.url).searchParams.get('uuid')
  if (!uuid) return NextResponse.json({ error: 'uuid erforderlich' }, { status: 400 })
  const result = await pool.query(
    `SELECT pp.pet_id, p.name, p.mob_type, p.rarity, r.color as rarity_color, r.label as rarity_label
     FROM lobby_player_pets pp
     JOIN lobby_pets p ON pp.pet_id = p.id
     JOIN lobby_rarity_config r ON p.rarity = r.rarity
     WHERE pp.uuid = $1 ORDER BY pp.purchased_at DESC`,
    [uuid]
  )
  return NextResponse.json({ pets: result.rows })
}