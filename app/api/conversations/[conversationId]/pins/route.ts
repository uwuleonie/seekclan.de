import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { hasGroupPermission } from '@/app/lib/group-permissions'

// Pins (Konzeptdokument Abschnitt 8): Nachrichten anpinnen, werden bei jedem
// Join/Login erneut angezeigt (Erinnerung). Bewusst KEIN Chatlog-Bestandteil -
// eigene Tabelle, eigene Route, läuft unabhängig von der 30-Minuten-Ansicht.

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

// Pin-Recht: in freien Gruppen (type='group') über das Rollensystem geregelt
// (manage_pins). Bei direct/gc-Konversationen gibt es kein Rollensystem -
// dort darf jedes Mitglied pinnen (analog zu Reaktionen, keine granulare Steuerung nötig).
async function canManagePins(conversationId: string, userId: string): Promise<boolean> {
  const convResult = await pool.query('SELECT type FROM conversations WHERE id = $1', [conversationId])
  const type = convResult.rows[0]?.type
  if (type === 'group') {
    return hasGroupPermission(conversationId, userId, 'manage_pins')
  }
  return true
}

// GET: Liste aller angepinnten Nachrichten dieser Konversation.
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ conversationId: string }> }
) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { conversationId } = await context.params
  if (!(await isMember(conversationId, user.id))) {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }

  const result = await pool.query(
    `SELECT
       mp.id AS pin_id, mp.pinned_at, mp.pinned_by,
       m.id AS message_id, m.content, m.image_url, m.created_at,
       json_build_object(
         'username', COALESCE(u.username, sps.player_name, 'Unbekannter Spieler'),
         'display_name', u.display_name
       ) AS message_sender,
       pinner.username AS pinned_by_username
     FROM message_pins mp
     JOIN messages m ON m.id = mp.message_id
     LEFT JOIN users u ON u.id = m.sender_id
     LEFT JOIN smp_player_stats sps ON sps.uuid = m.sender_minecraft_uuid
     LEFT JOIN users pinner ON pinner.id = mp.pinned_by
     WHERE mp.conversation_id = $1
     ORDER BY mp.pinned_at DESC`,
    [conversationId]
  )

  return NextResponse.json({ pins: result.rows })
}

// POST: Nachricht anpinnen. Body: { message_id }
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ conversationId: string }> }
) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { conversationId } = await context.params
  if (!(await isMember(conversationId, user.id))) {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }
  if (!(await canManagePins(conversationId, user.id))) {
    return NextResponse.json({ error: 'Du darfst hier keine Nachrichten anpinnen' }, { status: 403 })
  }

  const { message_id } = await req.json()
  if (!message_id) return NextResponse.json({ error: 'message_id erforderlich' }, { status: 400 })

  // Gehört die Nachricht wirklich zu dieser Konversation? Verhindert Cross-Conversation-Pins.
  const messageCheck = await pool.query(
    'SELECT id FROM messages WHERE id = $1 AND conversation_id = $2',
    [message_id, conversationId]
  )
  if (messageCheck.rows.length === 0) {
    return NextResponse.json({ error: 'Nachricht nicht gefunden' }, { status: 404 })
  }

  const alreadyPinned = await pool.query(
    'SELECT id FROM message_pins WHERE message_id = $1',
    [message_id]
  )
  if (alreadyPinned.rows.length > 0) {
    return NextResponse.json({ error: 'Nachricht ist bereits angepinnt' }, { status: 409 })
  }

  const result = await pool.query(
    `INSERT INTO message_pins (message_id, conversation_id, pinned_by)
     VALUES ($1, $2, $3) RETURNING id`,
    [message_id, conversationId, user.id]
  )

  return NextResponse.json({ success: true, pin_id: result.rows[0].id })
}

// DELETE: Pin entfernen. Body: { message_id }
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ conversationId: string }> }
) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { conversationId } = await context.params
  if (!(await isMember(conversationId, user.id))) {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }
  if (!(await canManagePins(conversationId, user.id))) {
    return NextResponse.json({ error: 'Du darfst hier keine Pins entfernen' }, { status: 403 })
  }

  const { message_id } = await req.json()
  if (!message_id) return NextResponse.json({ error: 'message_id erforderlich' }, { status: 400 })

  await pool.query(
    'DELETE FROM message_pins WHERE message_id = $1 AND conversation_id = $2',
    [message_id, conversationId]
  )

  return NextResponse.json({ success: true })
}