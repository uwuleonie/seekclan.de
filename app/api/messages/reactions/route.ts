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

// Prüft, ob der Nutzer Mitglied der Konversation ist, zu der die Nachricht gehört —
// verhindert, dass jemand auf Nachrichten in Konversationen reagiert, in denen er
// gar kein Mitglied ist.
async function canAccessMessage(messageId: string, userId: string) {
  const { data: message } = await supabaseAdmin
    .from('messages')
    .select('conversation_id')
    .eq('id', messageId)
    .single()
  if (!message) return false

  const { data: membership } = await supabaseAdmin
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', message.conversation_id)
    .eq('user_id', userId)
    .maybeSingle()

  return !!membership
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

  const { data: existing } = await supabaseAdmin
    .from('message_reactions')
    .select('id')
    .eq('message_id', message_id)
    .eq('user_id', user.id)
    .eq('emoji', emoji)
    .maybeSingle()

  if (existing) {
    await supabaseAdmin.from('message_reactions').delete().eq('id', existing.id)
    return NextResponse.json({ success: true, reacted: false })
  }

  await supabaseAdmin.from('message_reactions').insert({ message_id, user_id: user.id, emoji })
  return NextResponse.json({ success: true, reacted: true })
}