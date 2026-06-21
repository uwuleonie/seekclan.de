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

// Freundesliste + offene Anfragen laden
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { data: friends } = await supabaseAdmin
    .from('friendships')
    .select(`
      id, status, created_at,
      sender:sender_id ( id, username ),
      receiver:receiver_id ( id, username )
    `)
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  return NextResponse.json({ friends: friends || [], userId: user.id })
}

// Anfrage senden
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { receiver_username } = await req.json()
  if (!receiver_username) return NextResponse.json({ error: 'Username erforderlich' }, { status: 400 })

  const { data: receiver } = await supabaseAdmin.from('users').select('id, username').eq('username', receiver_username).single()
  if (!receiver) return NextResponse.json({ error: 'Nutzer nicht gefunden' }, { status: 404 })
  if (receiver.id === user.id) return NextResponse.json({ error: 'Du kannst dir selbst keine Anfrage senden' }, { status: 400 })

  const { error } = await supabaseAdmin.from('friendships').insert({ sender_id: user.id, receiver_id: receiver.id })
  if (error) return NextResponse.json({ error: 'Anfrage bereits gesendet oder ihr seid bereits Freunde' }, { status: 400 })

  await supabaseAdmin.from('notifications').insert({
    user_id: receiver.id,
    category: 'friends',
    title: `${user.username} möchte mit dir befreundet sein`,
    body: null,
    link: '/freunde',
  })

  return NextResponse.json({ success: true })
}

// Anfrage annehmen/ablehnen oder Freund entfernen
export async function PATCH(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { id, action } = await req.json()
  if (!id || !action) return NextResponse.json({ error: 'ID und Aktion erforderlich' }, { status: 400 })

  if (action === 'accept') {
    const { data: friendship, error } = await supabaseAdmin
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', id)
      .eq('receiver_id', user.id)
      .select('sender_id')
      .single()
    if (error) return NextResponse.json({ error: 'Fehler' }, { status: 500 })

    if (friendship) {
      await supabaseAdmin.from('notifications').insert({
        user_id: friendship.sender_id,
        category: 'friends',
        title: `${user.username} hat deine Freundschaftsanfrage angenommen`,
        body: null,
        link: '/freunde',
      })
    }
  } else if (action === 'decline' || action === 'remove') {
    const { error } = await supabaseAdmin.from('friendships').delete().eq('id', id).or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    if (error) return NextResponse.json({ error: 'Fehler' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}