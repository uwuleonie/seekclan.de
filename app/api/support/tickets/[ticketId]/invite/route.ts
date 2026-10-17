import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { darf, mitRecht } from '@/app/lib/rechte'

async function getUser(req: NextRequest) {
  return mitRecht(req)
}

// POST: Nutzer per Invite ins Ticket einladen
// Jeder Ticket-Teilnehmer (Ersteller oder bestehender Teilnehmer) kann einladen
// Der Eingeladene bekommt eine Notification
export async function POST(req: NextRequest, { params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  // Zugriff prüfen: muss Ersteller oder Teilnehmer sein
  const ticketRes = await pool.query('SELECT * FROM support_tickets WHERE id = $1', [ticketId])
  const ticket = ticketRes.rows[0]
  if (!ticket) return NextResponse.json({ error: 'Ticket nicht gefunden' }, { status: 404 })

  const isStaff = darf(user, 'support.team')
  const isOwner = ticket.user_id === user.id
  const partRes = await pool.query('SELECT 1 FROM support_ticket_participants WHERE ticket_id = $1 AND user_id = $2', [ticketId, user.id])
  if (!isStaff && !isOwner && partRes.rows.length === 0) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  if (ticket.status === 'closed') {
    return NextResponse.json({ error: 'Geschlossene Tickets können nicht erweitert werden' }, { status: 400 })
  }

  const { username } = await req.json()
  if (!username?.trim()) return NextResponse.json({ error: 'Username erforderlich' }, { status: 400 })

  const targetRes = await pool.query('SELECT id, username, COALESCE(anzeigename, username) AS name FROM users WHERE username = $1', [username.trim()])
  const target = targetRes.rows[0]
  if (!target) return NextResponse.json({ error: 'Spieler nicht gefunden' }, { status: 404 })

  if (target.id === user.id) return NextResponse.json({ error: 'Du kannst dich nicht selbst einladen' }, { status: 400 })
  if (target.id === ticket.user_id) return NextResponse.json({ error: 'Der Ersteller ist bereits im Ticket' }, { status: 400 })

  try {
    await pool.query(
      'INSERT INTO support_ticket_participants (ticket_id, user_id, added_at, invited_by) VALUES ($1, $2, NOW(), $3)',
      [ticketId, target.id, user.id]
    )
  } catch {
    return NextResponse.json({ error: 'Spieler ist bereits Teilnehmer' }, { status: 400 })
  }

  // Notification an eingeladenen Nutzer
  await pool.query(
    `INSERT INTO notifications (user_id, category, title, body, link) VALUES ($1, $2, $3, $4, $5)`,
    [
      target.id,
      'support',
      `${user.name} hat dich zu einem Ticket eingeladen`,
      ticket.subject,
      `/support/${ticketId}`,
    ]
  )

  return NextResponse.json({ success: true, invited: target.username, invitedName: target.name })
}