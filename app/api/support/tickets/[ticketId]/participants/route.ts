import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { mitRecht } from '@/app/lib/rechte'

async function getStaffUser(req: NextRequest) {
  return mitRecht(req, 'support.team')
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params
  const staffUser = await getStaffUser(req)
  if (!staffUser) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const body = await req.json()
  const { username } = body
  if (!username) return NextResponse.json({ error: 'Username erforderlich' }, { status: 400 })

  const targetResult = await pool.query('SELECT id, username FROM users WHERE username = $1', [username])
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
    [target.id, 'leadership', `Du wurdest zu einem Ticket hinzugefügt`, ticket?.subject || null, `/support/${ticketId}`]
  )

  return NextResponse.json({ success: true })
}