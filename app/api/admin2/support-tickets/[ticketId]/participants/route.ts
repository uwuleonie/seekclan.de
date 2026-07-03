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

// POST /api/admin2/support-tickets/[ticketId]/participants
// Body: { username }
// Fügt einen weiteren Spieler zum Ticket hinzu (er sieht/beantwortet es dann
// mit) und benachrichtigt ihn.
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ ticketId: string }> }
) {
  const user = await checkAccess(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { ticketId } = await context.params
  const body = await req.json().catch(() => ({}))
  const { username } = body as { username?: string }

  if (!username?.trim()) {
    return NextResponse.json({ error: 'Username erforderlich' }, { status: 400 })
  }

  const targetResult = await pool.query('SELECT id, username FROM users WHERE username = $1', [username.trim()])
  const target = targetResult.rows[0]
  if (!target) return NextResponse.json({ error: 'Spieler nicht gefunden' }, { status: 404 })

  try {
    await pool.query(
      'INSERT INTO support_ticket_participants (ticket_id, user_id) VALUES ($1, $2)',
      [ticketId, target.id]
    )
  } catch (err) {
    return NextResponse.json({ error: 'Spieler ist bereits Teilnehmer oder ein Fehler ist aufgetreten' }, { status: 400 })
  }

  const ticketResult = await pool.query('SELECT subject FROM support_tickets WHERE id = $1', [ticketId])
  const ticket = ticketResult.rows[0]

  await pool.query(
    `INSERT INTO notifications (user_id, category, title, body, link) VALUES ($1, $2, $3, $4, $5)`,
    [target.id, 'leadership', 'Du wurdest zu einem Ticket hinzugefügt', ticket?.subject || null, `/support/${ticketId}`]
  )

  return NextResponse.json({ success: true, username: target.username })
}