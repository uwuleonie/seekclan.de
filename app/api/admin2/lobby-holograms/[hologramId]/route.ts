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

// PATCH /api/admin2/lobby-holograms/[hologramId]
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ hologramId: string }> }
) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const { hologramId } = await context.params
  const body = await req.json().catch(() => ({}))

  const allowed = ['label', 'world', 'pos_x', 'pos_y', 'pos_z', 'lines']
  const updates: Record<string, any> = {}
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key]
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ success: true })

  const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 1}`).join(', ')
  const values = [...Object.values(updates), hologramId]
  await pool.query(`UPDATE lobby_holograms SET ${setClauses} WHERE id = $${values.length}`, values)
  return NextResponse.json({ success: true })
}

// DELETE /api/admin2/lobby-holograms/[hologramId]
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ hologramId: string }> }
) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const { hologramId } = await context.params
  await pool.query('DELETE FROM lobby_holograms WHERE id = $1', [hologramId])
  return NextResponse.json({ success: true })
}