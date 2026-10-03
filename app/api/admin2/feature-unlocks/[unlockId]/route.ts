import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function checkWrite(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT id, clan_role FROM users WHERE id = $1', [session.user_id])
  const user = userResult.rows[0]
  if (!user || (user.clan_role !== 'administrator' && user.clan_role !== 'owner')) return null
  return user
}

const KEY_PATTERN = /^[a-z0-9_-]{2,50}$/

// PATCH /api/admin2/feature-unlocks/[unlockId]
// Body JSON: { key?, label?, unlock_at? }
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ unlockId: string }> }
) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { unlockId } = await context.params
  const body = await req.json().catch(() => ({}))
  const updates: Record<string, any> = {}

  if (body.key !== undefined) {
    const key = String(body.key).trim().toLowerCase()
    if (!KEY_PATTERN.test(key)) {
      return NextResponse.json({ error: 'Key: 2–50 Zeichen, nur a-z, 0-9, _ und -' }, { status: 400 })
    }
    updates.key = key
  }
  if (body.label !== undefined) {
    const label = String(body.label).trim()
    if (!label) return NextResponse.json({ error: 'Name erforderlich' }, { status: 400 })
    updates.label = label
  }
  if (body.unlock_at !== undefined) {
    const value = String(body.unlock_at)
    if (!value || isNaN(Date.parse(value))) return NextResponse.json({ error: 'Ungültiger Zeitpunkt' }, { status: 400 })
    updates.unlock_at = new Date(value).toISOString()
  }

  if (Object.keys(updates).length === 0) return NextResponse.json({ success: true })

  const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 1}`).join(', ')
  const values = [...Object.values(updates), unlockId]
  try {
    await pool.query(
      `UPDATE feature_unlocks SET ${setClauses}, updated_at = now() WHERE id = $${values.length}`,
      values
    )
    return NextResponse.json({ success: true })
  } catch (err: any) {
    if (err.code === '23505') return NextResponse.json({ error: 'Dieser Key existiert schon' }, { status: 400 })
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/admin2/feature-unlocks/[unlockId]
// NPCs mit dieser Freischaltung werden automatisch wieder ohne Sperre (ON DELETE SET NULL)
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ unlockId: string }> }
) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { unlockId } = await context.params
  await pool.query('DELETE FROM feature_unlocks WHERE id = $1', [unlockId])
  return NextResponse.json({ success: true })
}