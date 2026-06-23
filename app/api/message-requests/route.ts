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

async function isBlocked(userIdA: string, userIdB: string) {
  const { data } = await supabaseAdmin
    .from('blocked_users')
    .select('blocker_id')
    .or(`and(blocker_id.eq.${userIdA},blocked_id.eq.${userIdB}),and(blocker_id.eq.${userIdB},blocked_id.eq.${userIdA})`)
    .maybeSingle()
  return !!data
}

// GET: Lädt eingehende (für mich) und ausgehende (von mir) Anfragen.
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { data: incoming } = await supabaseAdmin
    .from('message_requests')
    .select('id, sender_id, first_message, status, created_at, users:sender_id ( username, display_name, profile_picture_url )')
    .eq('receiver_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  const { data: outgoing } = await supabaseAdmin
    .from('message_requests')
    .select('id, receiver_id, first_message, status, created_at, users:receiver_id ( username, display_name, profile_picture_url )')
    .eq('sender_id', user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ incoming: incoming || [], outgoing: outgoing || [] })
}

// POST: Sendet eine einmalige Nachrichtenanfrage an einen Nicht-Freund.
// Body: { receiver_username, message }
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { receiver_username, message } = await req.json()
  if (!receiver_username || !message?.trim()) {
    return NextResponse.json({ error: 'Empfänger und Nachricht erforderlich' }, { status: 400 })
  }

  const { data: receiver } = await supabaseAdmin
    .from('users')
    .select('id, username')
    .eq('username', receiver_username)
    .single()

  if (!receiver) return NextResponse.json({ error: 'Nutzer nicht gefunden' }, { status: 404 })
  if (receiver.id === user.id) return NextResponse.json({ error: 'Nicht möglich mit dir selbst' }, { status: 400 })

  if (await isBlocked(user.id, receiver.id)) {
    return NextResponse.json({ error: 'Nicht möglich' }, { status: 403 })
  }

  const { error } = await supabaseAdmin.from('message_requests').insert({
    sender_id: user.id,
    receiver_id: receiver.id,
    first_message: message.trim(),
  })

  // unique(sender_id, receiver_id) verhindert Mehrfach-Anfragen an dieselbe Person
  if (error) return NextResponse.json({ error: 'Du hast dieser Person bereits eine Anfrage gesendet' }, { status: 400 })

  await supabaseAdmin.from('notifications').insert({
    user_id: receiver.id,
    category: 'friends',
    title: `${user.username} möchte dir eine Nachricht senden`,
    body: message.trim().slice(0, 100),
    link: '/nachrichten/anfragen',
  })

  return NextResponse.json({ success: true })
}

// PATCH: Anfrage annehmen oder ablehnen. Bei "accept" wird eine echte Konversation
// erstellt und die Erstnachricht dort eingefügt.
// Body: { id, action: 'accept' | 'decline' }
export async function PATCH(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { id, action } = await req.json()
  if (!id || !['accept', 'decline'].includes(action)) {
    return NextResponse.json({ error: 'id und gültige action erforderlich' }, { status: 400 })
  }

  const { data: request } = await supabaseAdmin
    .from('message_requests')
    .select('id, sender_id, receiver_id, first_message, status')
    .eq('id', id)
    .eq('receiver_id', user.id) // nur der Empfänger darf annehmen/ablehnen
    .single()

  if (!request) return NextResponse.json({ error: 'Anfrage nicht gefunden' }, { status: 404 })
  if (request.status !== 'pending') return NextResponse.json({ error: 'Anfrage bereits bearbeitet' }, { status: 400 })

  if (action === 'decline') {
    await supabaseAdmin.from('message_requests').update({ status: 'declined' }).eq('id', id)
    return NextResponse.json({ success: true })
  }

  // accept: Konversation erstellen, Erstnachricht übernehmen, Anfrage als angenommen markieren
  const { data: newConv, error: convError } = await supabaseAdmin
    .from('conversations')
    .insert({ type: 'direct', created_by: request.sender_id })
    .select('id')
    .single()

  if (convError || !newConv) return NextResponse.json({ error: 'Fehler beim Erstellen der Konversation' }, { status: 500 })

  await supabaseAdmin.from('conversation_members').insert([
    { conversation_id: newConv.id, user_id: request.sender_id },
    { conversation_id: newConv.id, user_id: request.receiver_id },
  ])

  await supabaseAdmin.from('messages').insert({
    conversation_id: newConv.id,
    sender_id: request.sender_id,
    content: request.first_message,
  })

  await supabaseAdmin.from('message_requests').update({ status: 'accepted' }).eq('id', id)

  await supabaseAdmin.from('notifications').insert({
    user_id: request.sender_id,
    category: 'friends',
    title: `${user.username} hat deine Nachrichtenanfrage angenommen`,
    body: null,
    link: `/nachrichten/${newConv.id}`,
  })

  return NextResponse.json({ success: true, conversation_id: newConv.id })
}