import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// GET /api/internal/pet-shop — Plugin lädt täglichen Shop
export async function GET(req: NextRequest) {
  if (!await verifyPluginKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await pool.query(
    `SELECT ps.slot, p.id, p.name, p.mob_type, p.price, p.rarity,
            r.label as rarity_label, r.color as rarity_color, p.description
     FROM lobby_pet_shop ps
     JOIN lobby_pets p ON ps.pet_id = p.id
     JOIN lobby_rarity_config r ON p.rarity = r.rarity
     WHERE ps.active_date = CURRENT_DATE
     ORDER BY ps.slot`
  )
  return NextResponse.json({ shop: result.rows })
}

// POST /api/internal/pet-shop/buy — Pet kaufen
export async function POST(req: NextRequest) {
  if (!await verifyPluginKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { uuid, player_name, pet_id } = await req.json().catch(() => ({}))
  if (!uuid || !pet_id) return NextResponse.json({ error: 'uuid + pet_id erforderlich' }, { status: 400 })

  // Preis laden
  const petResult = await pool.query('SELECT price FROM lobby_pets WHERE id = $1 AND enabled = true', [pet_id])
  if (!petResult.rows[0]) return NextResponse.json({ error: 'Pet nicht gefunden' }, { status: 404 })
  const price = petResult.rows[0].price

  // Sternies prüfen
  const playerResult = await pool.query('SELECT sternies FROM lobby_player_data WHERE uuid = $1', [uuid])
  if (!playerResult.rows[0] || playerResult.rows[0].sternies < price) {
    return NextResponse.json({ error: 'Nicht genug Sternies', code: 'insufficient_funds' }, { status: 400 })
  }

  // Schon gekauft?
  const owned = await pool.query('SELECT 1 FROM lobby_player_pets WHERE uuid = $1 AND pet_id = $2', [uuid, pet_id])
  if (owned.rows.length > 0) return NextResponse.json({ error: 'Pet bereits gekauft', code: 'already_owned' }, { status: 400 })

  // Kauf durchführen
  await pool.query('UPDATE lobby_player_data SET sternies = sternies - $1 WHERE uuid = $2', [price, uuid])
  await pool.query('INSERT INTO lobby_player_pets (uuid, pet_id) VALUES ($1, $2)', [uuid, pet_id])

  return NextResponse.json({ success: true, new_sternies: playerResult.rows[0].sternies - price })
}