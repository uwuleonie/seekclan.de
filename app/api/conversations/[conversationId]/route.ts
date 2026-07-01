import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { hasGroupPermission } from '@/app/lib/group-permissions'
import { indexLinksInMessage } from '@/app/lib/link-detection'

async function getUser(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT id, username FROM users WHERE id = $1', [session.user_id])
  return userResult.rows[0] || null
}

// Prüft, ob der Nutzer Mitglied dieser Konversation ist — Grundvoraussetzung für
// jeden Zugriff (lesen, schreiben, als gelesen markieren).
async function isMember(conversationId: string, userId: string) {
  const result = await pool.query(
    'SELECT user_id FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
    [conversationId, userId]
  )
  return result.rows.length > 0
}

// image_url darf NUR auf unseren eigenen lokalen Storage-Bucket "chat-media" zeigen
// (analog zur gleichen Absicherung bei Profilbild/Banner/Hintergrund) — niemals eine
// beliebige externe URL, die sonst per direktem API-Aufruf untergeschoben werden könnte.
// Seit der Migration weg von Supabase Storage zeigt das auf unsere eigene Auslieferungs-
// route statt der alten supabase.co-URL.
function isValidMediaUrl(url: string): boolean {
  return url.startsWith('/api/uploads/chat-media/') || url.includes('/api/uploads/chat-media/')
}

// GET: Lädt alle Nachrichten einer Konversation (inkl. Reaktionen), und markiert sie
// gleichzeitig als gelesen (last_read_at wird aktualisiert).
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

  let messages
  try {
    // Reaktionen sind eine 1-zu-viele-Beziehung pro Nachricht — wir aggregieren sie
    // über LEFT JOIN + json_agg zu einem Array pro Nachricht (leeres Array statt
    // [null], falls eine Nachricht keine Reaktionen hat, daher der FILTER-Zusatz).
    const result = await pool.query(
      `SELECT
         m.id, m.sender_id, m.content, m.image_url, m.created_at,
         m.location_label, m.location_chunk_x, m.location_chunk_z, m.edited_at,
         json_build_object(
           'username', COALESCE(u.username, sps.player_name, 'Unbekannter Spieler'),
           'display_name', u.display_name,
           'profile_picture_url', u.profile_picture_url
         ) AS users,
         COALESCE(
           json_agg(
             json_build_object('id', mr.id, 'user_id', mr.user_id, 'emoji', mr.emoji)
           ) FILTER (WHERE mr.id IS NOT NULL),
           '[]'
         ) AS message_reactions
       FROM messages m
       LEFT JOIN users u ON u.id = m.sender_id
       LEFT JOIN smp_player_stats sps ON sps.uuid = m.sender_minecraft_uuid
       LEFT JOIN message_reactions mr ON mr.message_id = m.id
       WHERE m.conversation_id = $1 AND m.is_deleted = false
       GROUP BY m.id, m.sender_id, m.content, m.image_url, m.created_at, m.location_label, m.location_chunk_x, m.location_chunk_z, m.edited_at, u.username, u.display_name, u.profile_picture_url, sps.player_name
       ORDER BY m.created_at ASC`,
      [conversationId]
    )
    messages = result.rows
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  // Als gelesen markieren
  await pool.query(
    'UPDATE conversation_members SET last_read_at = $1 WHERE conversation_id = $2 AND user_id = $3',
    [new Date().toISOString(), conversationId, user.id]
  )

  return NextResponse.json({ messages: messages || [] })
}

// POST: Neue Nachricht senden. Body: { content?, image_url? } (mind. eines erforderlich)
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

  const { content, image_url } = await req.json()
  if (!content?.trim() && !image_url) {
    return NextResponse.json({ error: 'Nachricht oder Bild erforderlich' }, { status: 400 })
  }
  if (image_url && (typeof image_url !== 'string' || !isValidMediaUrl(image_url))) {
    return NextResponse.json({ error: 'Ungültiges Bild' }, { status: 400 })
  }

  let message
  try {
    const result = await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, content, image_url)
       VALUES ($1, $2, $3, $4)
       RETURNING id, sender_id, content, image_url, created_at`,
      [conversationId, user.id, content?.trim() || null, image_url || null]
    )
    message = result.rows[0]
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  await indexLinksInMessage(message.id, conversationId, message.content, {
    userId: user.id, minecraftUuid: null, minecraftUsername: null,
  })

  // Eigene last_read_at sofort mitziehen, damit die eigene Nachricht nicht als
  // "ungelesen" in der eigenen Konversationsliste auftaucht.
  await pool.query(
    'UPDATE conversation_members SET last_read_at = $1 WHERE conversation_id = $2 AND user_id = $3',
    [new Date().toISOString(), conversationId, user.id]
  )

  return NextResponse.json({ message })
}

// PATCH: Standardmäßig markiert dieser Aufruf die Konversation als gelesen,
// ohne neue Nachricht zu senden (z. B. wenn man den Chat nur öffnet, ohne
// dass GET erneut aufgerufen wird). Werden zusätzlich name/avatar_url im
// Body mitgeschickt, wird (nur bei type='group' und edit_group_info-Recht)
// auch die Gruppe selbst umbenannt/das Bild geändert.
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ conversationId: string }> }
) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { conversationId } = await context.params
  if (!(await isMember(conversationId, user.id))) {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { name, avatar_url } = body

  if (name !== undefined || avatar_url !== undefined) {
    const convResult = await pool.query('SELECT type FROM conversations WHERE id = $1', [conversationId])
    const conversation = convResult.rows[0]
    if (!conversation || conversation.type !== 'group') {
      return NextResponse.json({ error: 'Nur freie Gruppen können bearbeitet werden' }, { status: 400 })
    }

    if (!(await hasGroupPermission(conversationId, user.id, 'edit_group_info'))) {
      return NextResponse.json({ error: 'Du darfst die Gruppe nicht bearbeiten' }, { status: 403 })
    }

    if (name !== undefined && !name?.trim()) {
      return NextResponse.json({ error: 'Gruppenname darf nicht leer sein' }, { status: 400 })
    }
    if (avatar_url !== undefined && avatar_url !== null && !isValidMediaUrl(avatar_url)) {
      return NextResponse.json({ error: 'Ungültiges Bild' }, { status: 400 })
    }

    await pool.query(
      `UPDATE conversations SET
         name = COALESCE($1, name),
         avatar_url = CASE WHEN $2::boolean THEN $3 ELSE avatar_url END
       WHERE id = $4`,
      [name?.trim() || null, avatar_url !== undefined, avatar_url || null, conversationId]
    )
  }

  await pool.query(
    'UPDATE conversation_members SET last_read_at = $1 WHERE conversation_id = $2 AND user_id = $3',
    [new Date().toISOString(), conversationId, user.id]
  )

  return NextResponse.json({ success: true })
}