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

async function areFriends(userIdA: string, userIdB: string) {
  const result = await pool.query(
    `SELECT id FROM friendships
     WHERE status = 'accepted'
       AND ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1))
     LIMIT 1`,
    [userIdA, userIdB]
  )
  return result.rows.length > 0
}

async function isBlocked(userIdA: string, userIdB: string) {
  const result = await pool.query(
    `SELECT blocker_id FROM blocked_users
     WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)
     LIMIT 1`,
    [userIdA, userIdB]
  )
  return result.rows.length > 0
}

// Liste aller Konversationen des eingeloggten Nutzers, inkl. letzter Nachricht und
// ungelesen-Status, neueste Aktivität zuerst.
// Hinweis: lädt pro Konversation einzeln die letzte Nachricht + den Ungelesen-Zähler
// (N+1-artig). Für Phase 1 mit überschaubarer Konversationsanzahl pro Nutzer unkritisch;
// bei Bedarf später durch eine einzige aggregierte SQL-Abfrage ersetzbar.
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const membershipsResult = await pool.query(
    'SELECT conversation_id, last_read_at FROM conversation_members WHERE user_id = $1',
    [user.id]
  )
  const memberships = membershipsResult.rows

  const conversationIds = memberships.map(m => m.conversation_id)
  if (conversationIds.length === 0) return NextResponse.json({ conversations: [] })

  const lastReadMap = new Map(memberships.map(m => [m.conversation_id, m.last_read_at]))

  const conversationsResult = await pool.query(
    'SELECT id, type, name, created_at, avatar_url, max_members, claim_group_id FROM conversations WHERE id = ANY($1)',
    [conversationIds]
  )
  const conversations = conversationsResult.rows

  // Alle Mitglieder aller Konversationen auf einmal laden (für Anzeigenamen bei direct-Chats)
  const allMembersResult = await pool.query(
    `SELECT
       cm.conversation_id, cm.user_id,
       json_build_object(
         'id', u.id, 'username', u.username, 'display_name', u.display_name,
         'minecraft_username', u.minecraft_username, 'profile_picture_url', u.profile_picture_url
       ) AS users
     FROM conversation_members cm
     JOIN users u ON u.id = cm.user_id
     WHERE cm.conversation_id = ANY($1)`,
    [conversationIds]
  )
  const allMembers = allMembersResult.rows

  // Letzte Nachricht + ungelesen-Zähler pro Konversation
  const result = await Promise.all(conversations.map(async (conv) => {
    const lastMessageResult = await pool.query(
      `SELECT id, content, image_url, sender_id, created_at FROM messages
       WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [conv.id]
    )
    const lastMessage = lastMessageResult.rows[0] || null

    const lastReadAt = lastReadMap.get(conv.id) || '1970-01-01'
    const unreadResult = await pool.query(
      `SELECT COUNT(*) AS count FROM messages
       WHERE conversation_id = $1 AND created_at > $2 AND sender_id != $3`,
      [conv.id, lastReadAt, user.id]
    )
    const unreadCount = parseInt(unreadResult.rows[0]?.count || '0', 10)

    const members = allMembers
      .filter(m => m.conversation_id === conv.id)
      .map(m => m.users)

    return {
      ...conv,
      members,
      lastMessage,
      unreadCount,
    }
  }))

  // Neueste Aktivität zuerst
  result.sort((a, b) => {
    const aTime = a.lastMessage?.created_at || a.created_at
    const bTime = b.lastMessage?.created_at || b.created_at
    return new Date(bTime).getTime() - new Date(aTime).getTime()
  })

  return NextResponse.json({ conversations: result })
}

// Body: { type: 'direct', target_user_id } ODER { type: 'group', name, member_ids: [] }
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const body = await req.json()
  const { type } = body

  if (type === 'direct') {
    const { target_user_id } = body
    if (!target_user_id) return NextResponse.json({ error: 'target_user_id erforderlich' }, { status: 400 })
    if (target_user_id === user.id) return NextResponse.json({ error: 'Nicht möglich mit dir selbst' }, { status: 400 })

    if (await isBlocked(user.id, target_user_id)) {
      return NextResponse.json({ error: 'Nicht möglich' }, { status: 403 })
    }

    // Nur Freunde dürfen direkt eine Konversation starten — Nicht-Freunde laufen
    // über message_requests (siehe /api/message-requests).
    if (!(await areFriends(user.id, target_user_id))) {
      return NextResponse.json({ error: 'Ihr müsst befreundet sein. Sende stattdessen eine Nachrichtenanfrage.' }, { status: 403 })
    }

    // Prüfen, ob schon eine direct-Konversation zwischen beiden existiert
    const myConversationsResult = await pool.query(
      'SELECT conversation_id FROM conversation_members WHERE user_id = $1',
      [user.id]
    )
    const myConvIds = myConversationsResult.rows.map(c => c.conversation_id)

    if (myConvIds.length > 0) {
      const targetConversationsResult = await pool.query(
        'SELECT conversation_id FROM conversation_members WHERE user_id = $1 AND conversation_id = ANY($2)',
        [target_user_id, myConvIds]
      )
      const sharedConvIds = targetConversationsResult.rows.map(c => c.conversation_id)

      if (sharedConvIds.length > 0) {
        const existingDirectResult = await pool.query(
          `SELECT id FROM conversations WHERE type = 'direct' AND id = ANY($1) LIMIT 1`,
          [sharedConvIds]
        )

        if (existingDirectResult.rows.length > 0) {
          return NextResponse.json({ conversation_id: existingDirectResult.rows[0].id, existed: true })
        }
      }
    }

    const newConvResult = await pool.query(
      `INSERT INTO conversations (type, created_by) VALUES ('direct', $1) RETURNING id`,
      [user.id]
    )
    const newConv = newConvResult.rows[0]

    if (!newConv) return NextResponse.json({ error: 'Fehler beim Erstellen' }, { status: 500 })

    await pool.query(
      `INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2), ($1, $3)`,
      [newConv.id, user.id, target_user_id]
    )

    return NextResponse.json({ conversation_id: newConv.id, existed: false })
  }

  if (type === 'group') {
    const { name, member_ids, avatar_url } = body
    if (!name?.trim()) return NextResponse.json({ error: 'Gruppenname erforderlich' }, { status: 400 })
    if (!Array.isArray(member_ids) || member_ids.length === 0) {
      return NextResponse.json({ error: 'Mindestens ein Mitglied erforderlich' }, { status: 400 })
    }

    // Größenlimit (vorerst 10, siehe Konzept Abschnitt 2 - wird später mit dem
    // Levelsystem dynamisch anpassbar). +1 für den Ersteller selbst.
    const uniqueMemberIds = Array.from(new Set([user.id, ...member_ids]))
    const MAX_GROUP_MEMBERS = 10
    if (uniqueMemberIds.length > MAX_GROUP_MEMBERS) {
      return NextResponse.json({ error: `Eine Gruppe darf maximal ${MAX_GROUP_MEMBERS} Mitglieder haben.` }, { status: 400 })
    }

    // Nur Freunde dürfen in eine Gruppe eingeladen werden
    for (const memberId of member_ids) {
      if (memberId === user.id) continue
      if (!(await areFriends(user.id, memberId))) {
        return NextResponse.json({ error: 'Du kannst nur Freunde in eine Gruppe einladen' }, { status: 403 })
      }
    }

    const newConvResult = await pool.query(
      `INSERT INTO conversations (type, name, created_by, avatar_url) VALUES ('group', $1, $2, $3) RETURNING id`,
      [name.trim(), user.id, avatar_url || null]
    )
    const newConv = newConvResult.rows[0]

    if (!newConv) return NextResponse.json({ error: 'Fehler beim Erstellen' }, { status: 500 })

    const values = uniqueMemberIds.map((_, i) => `($1, $${i + 2})`).join(', ')
    await pool.query(
      `INSERT INTO conversation_members (conversation_id, user_id) VALUES ${values}`,
      [newConv.id, ...uniqueMemberIds]
    )

    // Owner-Rolle automatisch anlegen: alle Rechte, nicht entziehbar
    // (is_owner_role = true), und dem Ersteller direkt zuweisen.
    const ownerRoleResult = await pool.query(
      `INSERT INTO conversation_roles (conversation_id, name, color, permissions, is_owner_role)
       VALUES ($1, 'Owner', '#C026D3', $2::jsonb, true) RETURNING id`,
      [newConv.id, JSON.stringify({
        invite_members: true,
        manage_roles: true,
        pin_messages: true,
        request_delete: true,
        edit_group_info: true,
        kick_members: true,
      })]
    )
    const ownerRole = ownerRoleResult.rows[0]

    await pool.query(
      `INSERT INTO conversation_role_members (role_id, user_id) VALUES ($1, $2)`,
      [ownerRole.id, user.id]
    )

    return NextResponse.json({ conversation_id: newConv.id })
  }

  return NextResponse.json({ error: 'Ungültiger type' }, { status: 400 })
}