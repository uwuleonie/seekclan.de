import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function checkWrite(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const s = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  if (!s.rows[0]) return null
  const u = await pool.query('SELECT id, clan_role FROM users WHERE id = $1', [s.rows[0].user_id])
  const user = u.rows[0]
  if (!user || (user.clan_role !== 'administrator' && user.clan_role !== 'owner')) return null
  return user
}

// PATCH /api/admin2/rarity-config — Chancen anpassen
export async function PATCH(req: NextRequest) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const { rarity, chance, color, label } = await req.json().catch(() => ({}))
  if (!rarity) return NextResponse.json({ error: 'rarity erforderlich' }, { status: 400 })
  const updates: Record<string, any> = {}
  if (chance !== undefined) updates.chance = chance
  if (color !== undefined) updates.color = color
  if (label !== undefined) updates.label = label
  if (!Object.keys(updates).length) return NextResponse.json({ success: true })
  const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 1}`).join(', ')
  await pool.query(`UPDATE lobby_rarity_config SET ${setClauses} WHERE rarity = $${Object.keys(updates).length + 1}`, [...Object.values(updates), rarity])
  return NextResponse.json({ success: true })
}