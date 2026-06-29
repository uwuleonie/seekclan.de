import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { hasGroupPermission, countGroupMembers } from '@/app/lib/group-permissions'

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

const MAX_GROUP_MEMBERS = 10

// POST: Fügt ein neues Mitglied zu einer bestehenden freien Gruppe hinzu.
// Nur möglich für type='group' (nicht 'gc'/'global'/'direct') und nur für
// Nutzer mit dem invite_members-Recht (siehe Konzept Abschnitt 2/2.1).
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ conversationId: string }> }
) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { conversationId } = await context.params
  const { user_id: newMemberId } = await req.json()
  if (!newMemberId) return NextResponse.json({ error: 'user_id erforderlich' }, { status: 400 })

  const convResult = await pool.query('SELECT type FROM conversations WHERE id = $1', [conversationId])
  const conversation = convResult.rows[0]
  if (!conversation) return NextResponse.json({ error: 'Konversation nicht gefunden' }, { status: 404 })
  if (conversation.type !== 'group') {
    return NextResponse.json({ error: 'Mitglieder können nur bei frei erstellten Gruppen hinzugefügt werden' }, { status: 400 })
  }

  if (!(await hasGroupPermission(conversationId, user.id, 'invite_members'))) {
    return NextResponse.json({ error: 'Du darfst keine Mitglieder einladen' }, { status: 403 })
  }

  if (!(await areFriends(user.id, newMemberId))) {
    return NextResponse.json({ error: 'Du kannst nur Freunde in eine Gruppe einladen' }, { status: 403 })
  }

  const alreadyMemberResult = await pool.query(
    'SELECT user_id FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
    [conversationId, newMemberId]
  )
  if (alreadyMemberResult.rows.length > 0) {
    return NextResponse.json({ error: 'Dieser Nutzer ist schon Mitglied' }, { status: 400 })
  }

  const currentCount = await countGroupMembers(conversationId)
  if (currentCount >= MAX_GROUP_MEMBERS) {
    return NextResponse.json({ error: `Diese Gruppe hat bereits das Mitgliederlimit von ${MAX_GROUP_MEMBERS} erreicht` }, { status: 400 })
  }

  await pool.query(
    'INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2)',
    [conversationId, newMemberId]
  )

  return NextResponse.json({ success: true })
}

// DELETE: Entfernt ein Mitglied aus der Gruppe (Kick). Body: { user_id }
// Nur möglich mit kick_members-Recht. Ein Mitglied kann sich auch SELBST
// entfernen (Gruppe verlassen) - dafür ist kein Recht nötig.
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ conversationId: string }> }
) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { conversationId } = await context.params
  const { user_id: targetUserId } = await req.json()
  if (!targetUserId) return NextResponse.json({ error: 'user_id erforderlich' }, { status: 400 })

  const isSelf = targetUserId === user.id
  if (!isSelf && !(await hasGroupPermission(conversationId, user.id, 'kick_members'))) {
    return NextResponse.json({ error: 'Du darfst keine Mitglieder entfernen' }, { status: 403 })
  }

  // Der Owner kann die Gruppe nicht einfach verlassen/gekickt werden, solange
  // er die einzige Owner-Rolle trägt - sonst gibt's eine Gruppe ohne Owner.
  // (Eine "Owner-Übergabe"-Funktion ist hier bewusst noch nicht enthalten -
  // siehe Konzept-Offene-Punkte, kann später ergänzt werden.)
  const targetRoleResult = await pool.query(
    `SELECT cr.is_owner_role
     FROM conversation_role_members crm
     JOIN conversation_roles cr ON cr.id = crm.role_id
     WHERE crm.user_id = $1 AND cr.conversation_id = $2`,
    [targetUserId, conversationId]
  )
  if (targetRoleResult.rows[0]?.is_owner_role) {
    return NextResponse.json({ error: 'Der Owner kann die Gruppe nicht verlassen, solange er Owner ist' }, { status: 400 })
  }

  await pool.query(
    'DELETE FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
    [conversationId, targetUserId]
  )
  await pool.query(
    `DELETE FROM conversation_role_members
     WHERE user_id = $1 AND role_id IN (SELECT id FROM conversation_roles WHERE conversation_id = $2)`,
    [targetUserId, conversationId]
  )

  return NextResponse.json({ success: true })
}