import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function getUser(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const s = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  if (!s.rows[0]) return null
  const u = await pool.query('SELECT id, username, clan_role FROM users WHERE id = $1', [s.rows[0].user_id])
  return u.rows[0] || null
}

// POST /api/support/tickets/[ticketId]/archive — archiviert oder de-archiviert ein Ticket
// Nur der Ticket-Ersteller oder Staff darf archivieren (Ticket muss geschlossen sein)
export async function POST(req: NextRequest, { params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const ticketRes = await pool.query('SELECT * FROM support_tickets WHERE id = $1', [ticketId])
  const ticket = ticketRes.rows[0]
  if (!ticket) return NextResponse.json({ error: 'Ticket nicht gefunden' }, { status: 404 })

  const isStaff = ['admin', 'mod', 'administrator', 'owner', 'teammitglied'].includes(ticket.clan_role?.toLowerCase() ?? '')
  const isOwner = ticket.user_id === user.id

  if (!isOwner && !isStaff) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  if (ticket.status !== 'closed') return NextResponse.json({ error: 'Nur geschlossene Tickets können archiviert werden' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const unarchive = body.unarchive === true

  await pool.query(
    'UPDATE support_tickets SET archived_at = $1, updated_at = NOW() WHERE id = $2',
    [unarchive ? null : new Date().toISOString(), ticketId]
  )

  return NextResponse.json({ success: true, archived: !unarchive })
}