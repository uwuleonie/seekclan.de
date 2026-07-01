import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

// Anfechtung einer Admin-Einsicht (Konzeptdokument Abschnitt 10 + 13.7):
// Ein Teilnehmer der eingesehenen Konversation kann eine bestimmte Admin-Ansicht
// anfechten. Erstellt automatisch ein Support-Ticket mit allen Konversations-
// teilnehmern als Ticket-Teilnehmer.

async function getUser(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT id, username FROM users WHERE id = $1', [session.user_id])
  return userResult.rows[0] || null
}

// POST /api/admin-chatlog-views/[viewId]/dispute
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ viewId: string }> }
) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { viewId } = await context.params

  const viewResult = await pool.query(
    `SELECT acv.id, acv.conversation_id, acv.reason, acv.disputed,
            adminUser.username AS admin_username
     FROM admin_chatlog_views acv
     JOIN users adminUser ON adminUser.id = acv.admin_id
     WHERE acv.id = $1`,
    [viewId]
  )
  const view = viewResult.rows[0]
  if (!view) return NextResponse.json({ error: 'Einsicht nicht gefunden' }, { status: 404 })

  // Nur Mitglieder der betroffenen Konversation dürfen anfechten.
  const memberCheck = await pool.query(
    'SELECT user_id FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
    [view.conversation_id, user.id]
  )
  if (memberCheck.rows.length === 0) {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }

  if (view.disputed) {
    return NextResponse.json({ error: 'Diese Einsicht wurde bereits angefochten' }, { status: 409 })
  }

  let ticket;
  try {
    const ticketResult = await pool.query(
      `INSERT INTO support_tickets (user_id, category, subject, priority)
       VALUES ($1, 'other', $2, 'normal') RETURNING id`,
      [user.id, `Chatlog-Einsicht angefochten (Admin: ${view.admin_username})`]
    )
    ticket = ticketResult.rows[0]

    // Erste Nachricht im Ticket mit dem Kontext, damit das Support-Team direkt
    // weiß worum es geht, ohne dass der Nutzer es nochmal manuell abtippen muss.
    await pool.query(
      `INSERT INTO support_messages (ticket_id, sender_id, is_staff, body) VALUES ($1, $2, false, $3)`,
      [ticket.id, user.id, `Die Begründung "${view.reason}" für die Einsicht in unsere Konversation wird angefochten.`]
    )

    // Alle Konversationsteilnehmer als Ticket-Teilnehmer hinzufügen.
    const membersResult = await pool.query(
      'SELECT user_id FROM conversation_members WHERE conversation_id = $1 AND user_id IS NOT NULL',
      [view.conversation_id]
    )
    for (const member of membersResult.rows) {
      await pool.query(
        'INSERT INTO support_ticket_participants (ticket_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [ticket.id, member.user_id]
      )
    }

    await pool.query(
      'UPDATE admin_chatlog_views SET disputed = true, dispute_ticket_id = $1 WHERE id = $2',
      [ticket.id, viewId]
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, ticket_id: ticket.id })
}