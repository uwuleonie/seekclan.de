import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { mitRecht } from '@/app/lib/rechte'

async function checkRead(req: NextRequest) {
  return mitRecht(req, 'admin.zugang')
}

async function checkWrite(req: NextRequest) {
  return mitRecht(req, 'admin.verwalten')
}

async function generateDailyShop() {
  // Alle aktivierten Pets laden
  const pets = await pool.query('SELECT p.*, r.chance FROM lobby_pets p JOIN lobby_rarity_config r ON p.rarity = r.rarity WHERE p.enabled = true')
  const rarities = await pool.query('SELECT * FROM lobby_rarity_config')

  if (pets.rows.length === 0) return []

  // Weighted random selection
  const selected: number[] = []
  const available = [...pets.rows]

  for (let slot = 0; slot < 2; slot++) {
    if (available.length === 0) break
    const totalWeight = available.reduce((sum, p) => sum + parseFloat(p.chance), 0)
    let rand = Math.random() * totalWeight
    let chosen = available[0]
    for (const pet of available) {
      rand -= parseFloat(pet.chance)
      if (rand <= 0) { chosen = pet; break }
    }
    selected.push(chosen.id)
    available.splice(available.indexOf(chosen), 1)
  }
  return selected
}

// GET /api/admin2/pet-shop — aktuellen Shop laden
export async function GET(req: NextRequest) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const result = await pool.query(
    `SELECT ps.*, p.name, p.mob_type, p.price, p.rarity, p.description,
            r.label as rarity_label, r.color as rarity_color
     FROM lobby_pet_shop ps
     JOIN lobby_pets p ON ps.pet_id = p.id
     JOIN lobby_rarity_config r ON p.rarity = r.rarity
     WHERE ps.active_date = CURRENT_DATE
     ORDER BY ps.slot`
  )
  return NextResponse.json({ shop: result.rows })
}

// POST /api/admin2/pet-shop/refresh — Shop neu generieren
export async function POST(req: NextRequest) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const body = await req.json().catch(() => ({}))

  // Manuell gesetzte Pets
  if (body.manual && Array.isArray(body.pet_ids)) {
    await pool.query('DELETE FROM lobby_pet_shop WHERE active_date = CURRENT_DATE')
    for (let i = 0; i < body.pet_ids.length && i < 2; i++) {
      await pool.query(
        'INSERT INTO lobby_pet_shop (pet_id, slot, manually_set) VALUES ($1, $2, true)',
        [body.pet_ids[i], i]
      )
    }
    return NextResponse.json({ success: true })
  }

  // Automatisch generieren
  const selected = await generateDailyShop()
  await pool.query('DELETE FROM lobby_pet_shop WHERE active_date = CURRENT_DATE')
  for (let i = 0; i < selected.length; i++) {
    await pool.query(
      'INSERT INTO lobby_pet_shop (pet_id, slot, manually_set) VALUES ($1, $2, false)',
      [selected[i], i]
    )
  }
  return NextResponse.json({ success: true, count: selected.length })
}