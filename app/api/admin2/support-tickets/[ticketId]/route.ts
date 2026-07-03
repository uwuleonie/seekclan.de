import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function checkAccess(req: NextRequest) {
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

// GET /api/admin2/support-tickets/[ticketId]
// Liefert ein Ticket mit allen Nachrichten.
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ ticketId: string }> }
) {
  const user = await checkAccess(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { ticketId } = await context.params

  try {
    const ticketResult = await pool.query(
      `SELECT
         st.id, st.category, st.subject, st.priority, st.status, st.created_at,
         creator.username AS creator_username,
         tu.username AS target_username,
         tb.name AS target_badge_name
       FROM support_tickets st
       JOIN users creator ON creator.id = st.user_id
       LEFT JOIN users tu ON tu.id = st.target_user_id
       LEFT JOIN clan_badges tb ON tb.id = st.target_badge_id
       WHERE st.id = $1`,
      [ticketId]
    )
    const ticket = ticketResult.rows[0]
    if (!ticket) return NextResponse.json({ error: 'Ticket nicht gefunden' }, { status: 404 })

    const messagesResult = await pool.query(
      `SELECT sm.id, sm.is_staff, sm.body, sm.created_at, sm.is_template, u.username AS sender_username
       FROM support_messages sm
       LEFT JOIN users u ON u.id = sm.sender_id
       WHERE sm.ticket_id = $1
       ORDER BY sm.created_at ASC`,
      [ticketId]
    )

    return NextResponse.json({ ticket, messages: messagesResult.rows })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH /api/admin2/support-tickets/[ticketId]
// Body: { status?, priority? }
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ ticketId: string }> }
) {
  const user = await checkAccess(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { ticketId } = await context.params
  const body = await req.json().catch(() => ({}))
  const { status, priority } = body as { status?: string, priority?: string }

  if (status !== undefined && !['open', 'in_progress', 'closed'].includes(status)) {
    return NextResponse.json({ error: 'Ungültiger Status' }, { status: 400 })
  }
  if (priority !== undefined && !['low', 'normal', 'high'].includes(priority)) {
    return NextResponse.json({ error: 'Ungültige Priorität' }, { status: 400 })
  }

  const updates: Record<string, any> = {}
  if (status !== undefined) updates.status = status
  if (priority !== undefined) updates.priority = priority
  if (Object.keys(updates).length === 0) return NextResponse.json({ success: true })

  const keys = Object.keys(updates)
  const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ')
  const values = keys.map(key => updates[key])

  try {
    await pool.query(`UPDATE support_tickets SET ${setClause} WHERE id = $${keys.length + 1}`, [...values, ticketId])
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}