import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// GET /api/internal/player-pets?uuid=...
export async function GET(req: NextRequest) {
  if (!await verifyPluginKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const uuid = new URL(req.url).searchParams.get('uuid')
  if (!uuid) return NextResponse.json({ error: 'uuid erforderlich' }, { status: 400 })
  const result = await pool.query(
    `SELECT pp.pet_id, COALESCE(pp.custom_name, p.name) as name, p.name as base_name,
            p.mob_type, p.rarity, r.color as rarity_color, r.label as rarity_label,
            pp.custom_name
     FROM lobby_player_pets pp
     JOIN lobby_pets p ON pp.pet_id = p.id
     JOIN lobby_rarity_config r ON p.rarity = r.rarity
     WHERE pp.uuid = $1 ORDER BY pp.purchased_at DESC`,
    [uuid]
  )
  return NextResponse.json({ pets: result.rows })
}

// PATCH /api/internal/player-pets — Pet umbenennen
// Body: { uuid, pet_id, custom_name }
export async function PATCH(req: NextRequest) {
  if (!await verifyPluginKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { uuid?: string; pet_id?: number; custom_name?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 })
  }

  const { uuid, pet_id, custom_name } = body
  if (!uuid || pet_id == null) {
    return NextResponse.json({ error: 'uuid und pet_id erforderlich' }, { status: 400 })
  }

  // Prüfen ob Spieler das Pet besitzt
  const owned = await pool.query(
    'SELECT 1 FROM lobby_player_pets WHERE uuid = $1 AND pet_id = $2',
    [uuid, pet_id]
  )
  if (owned.rowCount === 0) {
    return NextResponse.json({ error: 'Pet nicht im Besitz' }, { status: 403 })
  }

  // Name validieren (null = zurücksetzen auf Standard)
  let finalName: string | null = null
  if (custom_name !== null && custom_name !== undefined && custom_name.trim() !== '') {
    finalName = custom_name.trim().slice(0, 32) // max 32 Zeichen
    // Keine Farbcodes erlauben (§ oder &)
    finalName = finalName.replace(/[§&][0-9a-fk-or]/gi, '').trim()
    if (finalName === '') finalName = null
  }

  await pool.query(
    'UPDATE lobby_player_pets SET custom_name = $1 WHERE uuid = $2 AND pet_id = $3',
    [finalName, uuid, pet_id]
  )

  return NextResponse.json({ success: true, custom_name: finalName })
}