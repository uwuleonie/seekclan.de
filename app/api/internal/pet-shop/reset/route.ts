import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// POST /api/internal/pet-shop/reset — Täglicher Reset (per Cron oder Plugin)
export async function POST(req: NextRequest) {
  if (!await verifyPluginKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Heute schon einen Shop? Dann überspringen (falls manuell gesetzt)
  const existing = await pool.query(
    'SELECT manually_set FROM lobby_pet_shop WHERE active_date = CURRENT_DATE LIMIT 1'
  )
  if (existing.rows[0]?.manually_set) {
    return NextResponse.json({ skipped: true, reason: 'manually_set' })
  }

  // Alte Einträge von gestern löschen (optional — wir behalten History)
  // Neuen Shop generieren
  const pets = await pool.query(
    'SELECT p.id, r.chance FROM lobby_pets p JOIN lobby_rarity_config r ON p.rarity = r.rarity WHERE p.enabled = true'
  )

  if (pets.rows.length === 0) return NextResponse.json({ error: 'Keine Pets verfügbar' }, { status: 400 })

  const available = [...pets.rows]
  const selected: number[] = []

  for (let slot = 0; slot < 2; slot++) {
    if (available.length === 0) break
    const totalWeight = available.reduce((sum: number, p: any) => sum + parseFloat(p.chance), 0)
    let rand = Math.random() * totalWeight
    let chosen = available[0]
    for (const pet of available) {
      rand -= parseFloat(pet.chance)
      if (rand <= 0) { chosen = pet; break }
    }
    selected.push(chosen.id)
    available.splice(available.indexOf(chosen), 1)
  }

  await pool.query('DELETE FROM lobby_pet_shop WHERE active_date = CURRENT_DATE AND manually_set = false')
  for (let i = 0; i < selected.length; i++) {
    await pool.query(
      'INSERT INTO lobby_pet_shop (pet_id, slot, manually_set) VALUES ($1, $2, false)',
      [selected[i], i]
    )
  }

  // Auch quest/daily rewards resetten
  await pool.query(
    `UPDATE lobby_daily_rewards
     SET online_minutes_today = 0, messages_today = 0,
         quest_online_claimed = false, quest_messages_claimed = false,
         last_reset = CURRENT_DATE
     WHERE last_reset < CURRENT_DATE`
  )

  return NextResponse.json({ success: true, shop: selected })
}