import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

// Protokolliert einen Admin-Zugriff auf eine Konversation (Konzeptdokument
// Abschnitt 10 + 13.7): Begründung ist Pflicht, alle Teilnehmer werden sofort
// benachrichtigt. Bei wiederholtem Öffnen derselben Konversation durch denselben
// Admin muss explizit "gleicher Grund" oder "neuer Grund" gewählt werden.

async function checkAdmin(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT id, username, clan_role FROM users WHERE id = $1', [session.user_id])
  const user = userResult.rows[0]
  if (!user || (user.clan_role !== 'administrator' && user.clan_role !== 'owner')) return null
  return user
}

// POST /api/admin/chatlogs/[conversationId]/view
// Body: { reason: string, same_as_last?: boolean }
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ conversationId: string }> }
) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { conversationId } = await context.params
  const { reason, same_as_last } = await req.json()

  // Letzte eigene Ansicht dieser Konversation finden, um "Wiederholung" zu erkennen.
  const lastViewResult = await pool.query(
    `SELECT id, reason FROM admin_chatlog_views
     WHERE conversation_id = $1 AND admin_id = $2
     ORDER BY viewed_at DESC LIMIT 1`,
    [conversationId, admin.id]
  )
  const lastView = lastViewResult.rows[0]

  // Erste Ansicht ODER "neuer Grund" gewählt: Begründung ist Pflicht.
  const isRepeat = !!lastView
  const effectiveReason = isRepeat && same_as_last ? lastView.reason : reason?.trim()

  if (!effectiveReason) {
    return NextResponse.json({ error: 'Begründung erforderlich' }, { status: 400 })
  }

  let newView
  try {
    const result = await pool.query(
      `INSERT INTO admin_chatlog_views (conversation_id, admin_id, reason, is_repeat_same_reason)
       VALUES ($1, $2, $3, $4) RETURNING id, viewed_at`,
      [conversationId, admin.id, effectiveReason, isRepeat && !!same_as_last]
    )
    newView = result.rows[0]
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  // Alle Teilnehmer benachrichtigen (Konzept: "sofort beim Öffnen").
  try {
    const membersResult = await pool.query(
      'SELECT user_id FROM conversation_members WHERE conversation_id = $1 AND user_id IS NOT NULL',
      [conversationId]
    )
    for (const member of membersResult.rows) {
      await pool.query(
        `INSERT INTO notifications (user_id, category, title, body, link)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          member.user_id,
          'system',
          'Ein Admin hat eure Konversation eingesehen',
          `${admin.username} hat diese Konversation eingesehen. Begründung: „${effectiveReason}"`,
          `/chat?conversation=${conversationId}&dispute_view=${newView.id}`,
        ]
      )
    }
  } catch (notifyErr: any) {
    console.error('Benachrichtigung fehlgeschlagen:', notifyErr)
    return NextResponse.json({ error: `Benachrichtigung fehlgeschlagen: ${notifyErr.message}` }, { status: 500 })
  }

  return NextResponse.json({ success: true, view_id: newView.id, is_repeat: isRepeat, reason: effectiveReason })
}