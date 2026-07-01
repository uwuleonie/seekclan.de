import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { editMessage } from '@/app/lib/message-edit'

// Bearbeiten einer eigenen Nachricht + Historie ansehen (Konzeptdokument Abschnitt 6 + 13.2).

async function getUser(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT id FROM users WHERE id = $1', [session.user_id])
  return userResult.rows[0] || null
}

async function isMember(conversationId: string, userId: string) {
  const result = await pool.query(
    'SELECT user_id FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
    [conversationId, userId]
  )
  return result.rows.length > 0
}

// PATCH: Eigene Nachricht bearbeiten. Body: { content }
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ conversationId: string; messageId: string }> }
) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { conversationId, messageId } = await context.params
  if (!(await isMember(conversationId, user.id))) {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }

  // Nur die eigene Nachricht darf bearbeitet werden.
  const ownerCheck = await pool.query(
    'SELECT sender_id FROM messages WHERE id = $1 AND conversation_id = $2',
    [messageId, conversationId]
  )
  const message = ownerCheck.rows[0]
  if (!message) return NextResponse.json({ error: 'Nachricht nicht gefunden' }, { status: 404 })
  if (message.sender_id !== user.id) {
    return NextResponse.json({ error: 'Du kannst nur eigene Nachrichten bearbeiten' }, { status: 403 })
  }

  const { content } = await req.json()
  if (typeof content !== 'string') {
    return NextResponse.json({ error: 'content erforderlich' }, { status: 400 })
  }

  const result = await editMessage(messageId, content, { userId: user.id, minecraftUuid: null })
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}

// GET: Bearbeitungshistorie einer Nachricht.
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ conversationId: string; messageId: string }> }
) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { conversationId, messageId } = await context.params
  if (!(await isMember(conversationId, user.id))) {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }

  const result = await pool.query(
    `SELECT me.id, me.previous_content, me.new_content, me.edited_at,
            COALESCE(u.username, sps.player_name, me.edited_by_minecraft_uuid, 'Unbekannt') AS edited_by_username
     FROM message_edits me
     LEFT JOIN users u ON u.id = me.edited_by
     LEFT JOIN smp_player_stats sps ON sps.uuid = me.edited_by_minecraft_uuid
     WHERE me.message_id = $1
     ORDER BY me.edited_at ASC`,
    [messageId]
  )

  return NextResponse.json({ edits: result.rows })
}