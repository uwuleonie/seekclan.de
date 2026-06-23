import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

async function getUser(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const { data: session } = await supabaseAdmin.from('sessions').select('user_id').eq('token', token).single()
  if (!session) return null
  const { data: user } = await supabaseAdmin.from('users').select('id, username').eq('id', session.user_id).single()
  return user || null
}

async function areFriends(userIdA: string, userIdB: string) {
  const { data } = await supabaseAdmin
    .from('friendships')
    .select('id')
    .eq('status', 'accepted')
    .or(`and(sender_id.eq.${userIdA},receiver_id.eq.${userIdB}),and(sender_id.eq.${userIdB},receiver_id.eq.${userIdA})`)
    .maybeSingle()
  return !!data
}

async function isBlocked(userIdA: string, userIdB: string) {
  const { data } = await supabaseAdmin
    .from('blocked_users')
    .select('blocker_id')
    .or(`and(blocker_id.eq.${userIdA},blocked_id.eq.${userIdB}),and(blocker_id.eq.${userIdB},blocked_id.eq.${userIdA})`)
    .maybeSingle()
  return !!data
}

// Liste aller Konversationen des eingeloggten Nutzers, inkl. letzter Nachricht und
// ungelesen-Status, neueste Aktivität zuerst.
// Hinweis: lädt pro Konversation einzeln die letzte Nachricht + den Ungelesen-Zähler
// (N+1-artig). Für Phase 1 mit überschaubarer Konversationsanzahl pro Nutzer unkritisch;
// bei Bedarf später durch eine einzige aggregierte SQL-Abfrage ersetzbar.
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { data: memberships } = await supabaseAdmin
    .from('conversation_members')
    .select('conversation_id, last_read_at')
    .eq('user_id', user.id)

  const conversationIds = (memberships || []).map(m => m.conversation_id)
  if (conversationIds.length === 0) return NextResponse.json({ conversations: [] })

  const lastReadMap = new Map((memberships || []).map(m => [m.conversation_id, m.last_read_at]))

  const { data: conversations } = await supabaseAdmin
    .from('conversations')
    .select('id, type, name, created_at')
    .in('id', conversationIds)

  // Alle Mitglieder aller Konversationen auf einmal laden (für Anzeigenamen bei direct-Chats)
  const { data: allMembers } = await supabaseAdmin
    .from('conversation_members')
    .select('conversation_id, user_id, users ( id, username, display_name, minecraft_username, profile_picture_url )')
    .in('conversation_id', conversationIds)

  // Letzte Nachricht + ungelesen-Zähler pro Konversation
  const result = await Promise.all((conversations || []).map(async (conv) => {
    const { data: lastMessage } = await supabaseAdmin
      .from('messages')
      .select('id, content, image_url, sender_id, created_at')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const lastReadAt = lastReadMap.get(conv.id)
    const { count: unreadCount } = await supabaseAdmin
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conv.id)
      .gt('created_at', lastReadAt || '1970-01-01')
      .neq('sender_id', user.id)

    const members = (allMembers || [])
      .filter(m => m.conversation_id === conv.id)
      .map(m => m.users)

    return {
      ...conv,
      members,
      lastMessage: lastMessage || null,
      unreadCount: unreadCount || 0,
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
    const { data: myConversations } = await supabaseAdmin
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', user.id)

    const myConvIds = (myConversations || []).map(c => c.conversation_id)

    if (myConvIds.length > 0) {
      const { data: targetConversations } = await supabaseAdmin
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', target_user_id)
        .in('conversation_id', myConvIds)

      const sharedConvIds = (targetConversations || []).map(c => c.conversation_id)

      if (sharedConvIds.length > 0) {
        const { data: existingDirectList } = await supabaseAdmin
          .from('conversations')
          .select('id')
          .eq('type', 'direct')
          .in('id', sharedConvIds)
          .limit(1)

        if (existingDirectList && existingDirectList.length > 0) {
          return NextResponse.json({ conversation_id: existingDirectList[0].id, existed: true })
        }
      }
    }

    const { data: newConv, error: convError } = await supabaseAdmin
      .from('conversations')
      .insert({ type: 'direct', created_by: user.id })
      .select('id')
      .single()

    if (convError || !newConv) return NextResponse.json({ error: 'Fehler beim Erstellen' }, { status: 500 })

    await supabaseAdmin.from('conversation_members').insert([
      { conversation_id: newConv.id, user_id: user.id },
      { conversation_id: newConv.id, user_id: target_user_id },
    ])

    return NextResponse.json({ conversation_id: newConv.id, existed: false })
  }

  if (type === 'group') {
    const { name, member_ids } = body
    if (!name?.trim()) return NextResponse.json({ error: 'Gruppenname erforderlich' }, { status: 400 })
    if (!Array.isArray(member_ids) || member_ids.length === 0) {
      return NextResponse.json({ error: 'Mindestens ein Mitglied erforderlich' }, { status: 400 })
    }

    // Nur Freunde dürfen in eine Gruppe eingeladen werden
    for (const memberId of member_ids) {
      if (memberId === user.id) continue
      if (!(await areFriends(user.id, memberId))) {
        return NextResponse.json({ error: 'Du kannst nur Freunde in eine Gruppe einladen' }, { status: 403 })
      }
    }

    const { data: newConv, error: convError } = await supabaseAdmin
      .from('conversations')
      .insert({ type: 'group', name: name.trim(), created_by: user.id })
      .select('id')
      .single()

    if (convError || !newConv) return NextResponse.json({ error: 'Fehler beim Erstellen' }, { status: 500 })

    const uniqueMemberIds = Array.from(new Set([user.id, ...member_ids]))
    await supabaseAdmin.from('conversation_members').insert(
      uniqueMemberIds.map(id => ({ conversation_id: newConv.id, user_id: id }))
    )

    return NextResponse.json({ conversation_id: newConv.id })
  }

  return NextResponse.json({ error: 'Ungültiger type' }, { status: 400 })
}