import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function getUser(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query(
    'SELECT id, username, clan_role FROM users WHERE id = $1',
    [session.user_id]
  )
  return userResult.rows[0] || null
}

const isStaff = (user: { clan_role: string | null }) =>
  user.clan_role?.toLowerCase() === 'admin' || user.clan_role?.toLowerCase() === 'mod'

async function canAccessTicket(ticketId: string, userId: string, staff: boolean) {
  if (staff) return true
  const ticketResult = await pool.query('SELECT user_id FROM support_tickets WHERE id = $1', [ticketId])
  const ticket = ticketResult.rows[0]
  if (ticket?.user_id === userId) return true

  const participantResult = await pool.query(
    'SELECT id FROM support_ticket_participants WHERE ticket_id = $1 AND user_id = $2',
    [ticketId, userId]
  )
  return participantResult.rows.length > 0
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const staff = isStaff(user)
  if (!(await canAccessTicket(ticketId, user.id, staff))) {
    return NextResponse.json({ error: 'Kein Zugriff auf dieses Ticket' }, { status: 403 })
  }

  let messages
  try {
    const result = await pool.query(
      `SELECT
         sm.*,
         json_build_object('username', u.username, 'clan_role', u.clan_role) AS sender
       FROM support_messages sm
       JOIN users u ON u.id = sm.sender_id
       WHERE sm.ticket_id = $1
       ORDER BY sm.created_at ASC`,
      [ticketId]
    )
    messages = result.rows
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  const ROLE_DISPLAY: Record<string, string> = {
    owner: 'Leitung', administrator: 'Admin', teammitglied: 'Team',
  }
  const sanitized = (messages || []).map(m => {
    if (!m.is_staff) return m
    const role = ROLE_DISPLAY[m.sender?.clan_role?.toLowerCase()] || 'Team'
    return { ...m, sender: { username: role, clan_role: null } }
  })

  return NextResponse.json({ messages: sanitized })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const staff = isStaff(user)
  if (!(await canAccessTicket(ticketId, user.id, staff))) {
    return NextResponse.json({ error: 'Kein Zugriff auf dieses Ticket' }, { status: 403 })
  }

  const body = await req.json()
  const { message } = body
  if (!message?.trim()) return NextResponse.json({ error: 'Nachricht erforderlich' }, { status: 400 })

  let newMessage
  try {
    const result = await pool.query(
      'INSERT INTO support_messages (ticket_id, sender_id, is_staff, body) VALUES ($1, $2, $3, $4) RETURNING *',
      [ticketId, user.id, staff, message.trim()]
    )
    newMessage = result.rows[0]
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  await pool.query('UPDATE support_tickets SET updated_at = $1 WHERE id = $2', [new Date().toISOString(), ticketId])

  if (staff) {
    const ticketResult = await pool.query('SELECT user_id, subject FROM support_tickets WHERE id = $1', [ticketId])
    const ticket = ticketResult.rows[0]

    const participantsResult = await pool.query(
      'SELECT user_id FROM support_ticket_participants WHERE ticket_id = $1',
      [ticketId]
    )
    const participants = participantsResult.rows

    const recipientIds = new Set<string>()
    if (ticket?.user_id) recipientIds.add(ticket.user_id)
    for (const p of participants || []) recipientIds.add(p.user_id)
    recipientIds.delete(user.id)

    for (const recipientId of recipientIds) {
      await pool.query(
        `INSERT INTO notifications (user_id, category, title, body, link) VALUES ($1, $2, $3, $4, $5)`,
        [recipientId, 'leadership', `Neue Antwort zu "${ticket?.subject || 'deinem Ticket'}"`, message.trim().slice(0, 100), `/support/${ticketId}`]
      )
    }
  }

  return NextResponse.json({ success: true, message: newMessage })
}