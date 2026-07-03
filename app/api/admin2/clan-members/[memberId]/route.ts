import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function checkRead(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT id, username, clan_role FROM users WHERE id = $1', [session.user_id])
  const user = userResult.rows[0]
  if (!user || !['administrator', 'owner', 'teammitglied'].includes(user.clan_role)) return null
  return user
}

async function checkWrite(req: NextRequest) {
  const user = await checkRead(req)
  if (!user || (user.clan_role !== 'administrator' && user.clan_role !== 'owner')) return null
  return user
}

// PATCH /api/admin2/clan-members/[memberId]
// Body: { role?, stufe_override?, join_date?, discord_tag? }
// stufe_override: null setzt zurück auf "Auto" (aus Clan-Dauer berechnet).
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ memberId: string }> }
) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { memberId } = await context.params
  const body = await req.json().catch(() => ({}))
  const { role, stufe_override, join_date, discord_tag } = body as {
    role?: string, stufe_override?: number | null, join_date?: string, discord_tag?: string
  }

  const updates: Record<string, any> = {}
  if (role !== undefined) updates.role = role
  if (stufe_override !== undefined) updates.stufe_override = stufe_override
  if (join_date !== undefined) updates.join_date = join_date
  if (discord_tag !== undefined) updates.discord_tag = discord_tag

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: true })
  }

  const keys = Object.keys(updates)
  const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ')
  const values = keys.map(key => updates[key])

  try {
    await pool.query(
      `UPDATE clan_members SET ${setClause} WHERE id = $${keys.length + 1}`,
      [...values, memberId]
    )
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/admin2/clan-members/[memberId]
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ memberId: string }> }
) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { memberId } = await context.params
  try {
    await pool.query('DELETE FROM clan_members WHERE id = $1', [memberId])
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}