import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function getUser(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT id, username FROM users WHERE id = $1', [session.user_id])
  return userResult.rows[0] || null
}

// Prüft, ob der Nutzer Mitglied der Konversation ist, zu der die Nachricht gehört —
// verhindert, dass jemand auf Nachrichten in Konversationen reagiert, in denen er
// gar kein Mitglied ist.
async function canAccessMessage(messageId: string, userId: string) {
  const messageResult = await pool.query('SELECT conversation_id FROM messages WHERE id = $1', [messageId])
  const message = messageResult.rows[0]
  if (!message) return false

  const membershipResult = await pool.query(
    'SELECT user_id FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
    [message.conversation_id, userId]
  )

  return membershipResult.rows.length > 0
}

// POST: Reaktion hinzufügen (oder, falls schon vorhanden, entfernen — Toggle).
// Body: { message_id, emoji }
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { message_id, emoji } = await req.json()
  if (!message_id || !emoji) return NextResponse.json({ error: 'message_id und emoji erforderlich' }, { status: 400 })

  if (!(await canAccessMessage(message_id, user.id))) {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }

  const existingResult = await pool.query(
    'SELECT id FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
    [message_id, user.id, emoji]
  )
  const existing = existingResult.rows[0]

  if (existing) {
    await pool.query('DELETE FROM message_reactions WHERE id = $1', [existing.id])
    return NextResponse.json({ success: true, reacted: false })
  }

  await pool.query(
    'INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)',
    [message_id, user.id, emoji]
  )
  return NextResponse.json({ success: true, reacted: true })
}