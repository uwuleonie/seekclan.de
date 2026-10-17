import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { mitRecht } from '@/app/lib/rechte'

async function checkAccess(req: NextRequest) {
  return mitRecht(req, 'support.team')
}

// POST /api/admin2/support-tickets/[ticketId]/messages
// Body: { body: string }
// Sendet eine Staff-Antwort (is_staff=true). Setzt das Ticket automatisch auf
// "in_progress", falls es noch "open" war - eine beantwortete Anfrage soll
// nicht weiter als unbearbeitet in der Liste stehen bleiben.
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ ticketId: string }> }
) {
  const user = await checkAccess(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { ticketId } = await context.params
  const body = await req.json().catch(() => ({}))
  const { body: messageBody, is_template } = body as { body?: string, is_template?: boolean }

  if (!messageBody?.trim()) {
    return NextResponse.json({ error: 'Nachricht darf nicht leer sein' }, { status: 400 })
  }

  try {
    const result = await pool.query(
      `INSERT INTO support_messages (ticket_id, sender_id, is_staff, body, is_template)
       VALUES ($1, $2, true, $3, $4)
       RETURNING id, is_staff, body, created_at, is_template`,
      [ticketId, user.id, messageBody.trim(), is_template === true]
    )

    await pool.query(
      `UPDATE support_tickets SET status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END WHERE id = $1`,
      [ticketId]
    )

    return NextResponse.json({ message: { ...result.rows[0], sender_username: user.username, sender_name: user.name } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}