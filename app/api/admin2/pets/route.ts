import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function checkRead(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const s = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  if (!s.rows[0]) return null
  const u = await pool.query('SELECT id, clan_role FROM users WHERE id = $1', [s.rows[0].user_id])
  const user = u.rows[0]
  if (!user || !['administrator', 'owner', 'teammitglied'].includes(user.clan_role)) return null
  return user
}

async function checkWrite(req: NextRequest) {
  const user = await checkRead(req)
  if (!user || (user.clan_role !== 'administrator' && user.clan_role !== 'owner')) return null
  return user
}

// GET /api/admin2/pets
export async function GET(req: NextRequest) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const [pets, rarities] = await Promise.all([
    pool.query('SELECT * FROM lobby_pets ORDER BY rarity, name'),
    pool.query('SELECT * FROM lobby_rarity_config ORDER BY chance DESC'),
  ])
  return NextResponse.json({ pets: pets.rows, rarities: rarities.rows })
}

// POST /api/admin2/pets
export async function POST(req: NextRequest) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const { name, mob_type, price, rarity, description } = await req.json().catch(() => ({}))
  if (!name || !mob_type) return NextResponse.json({ error: 'Name und Mob-Typ erforderlich' }, { status: 400 })
  const result = await pool.query(
    'INSERT INTO lobby_pets (name, mob_type, price, rarity, description) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [name, mob_type, price || 50, rarity || 'common', description || null]
  )
  return NextResponse.json({ id: result.rows[0].id })
}

// PATCH /api/admin2/pets
export async function PATCH(req: NextRequest) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const { id, ...fields } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'ID erforderlich' }, { status: 400 })
  const allowed = ['name', 'mob_type', 'price', 'rarity', 'description', 'enabled']
  const updates: Record<string, any> = {}
  for (const k of allowed) if (fields[k] !== undefined) updates[k] = fields[k]
  if (!Object.keys(updates).length) return NextResponse.json({ success: true })
  const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 1}`).join(', ')
  await pool.query(`UPDATE lobby_pets SET ${setClauses} WHERE id = $${Object.keys(updates).length + 1}`, [...Object.values(updates), id])
  return NextResponse.json({ success: true })
}

// DELETE /api/admin2/pets
export async function DELETE(req: NextRequest) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const { id } = await req.json().catch(() => ({}))
  await pool.query('DELETE FROM lobby_pets WHERE id = $1', [id])
  return NextResponse.json({ success: true })
}