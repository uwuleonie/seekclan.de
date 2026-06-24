import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function getStaffUser(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query(
    'SELECT id, username, clan_role FROM users WHERE id = $1',
    [session.user_id]
  )
  const user = userResult.rows[0]
  if (!user) return null
  const staff = user.clan_role?.toLowerCase() === 'admin' || user.clan_role?.toLowerCase() === 'mod'
  return staff ? user : null
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params
  const staffUser = await getStaffUser(req)
  if (!staffUser) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const body = await req.json()
  const update: Record<string, any> = { updated_at: new Date().toISOString() }
  if (body.status && ['open', 'in_progress', 'closed'].includes(body.status)) update.status = body.status
  if (body.priority && ['low', 'normal', 'high'].includes(body.priority)) update.priority = body.priority

  const keys = Object.keys(update)
  const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ')
  const values = keys.map((key) => update[key])

  try {
    await pool.query(
      `UPDATE support_tickets SET ${setClause} WHERE id = $${keys.length + 1}`,
      [...values, ticketId]
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}