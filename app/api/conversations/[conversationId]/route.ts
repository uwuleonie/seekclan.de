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

// Prüft, ob der Nutzer Mitglied dieser Konversation ist — Grundvoraussetzung für
// jeden Zugriff (lesen, schreiben, als gelesen markieren).
async function isMember(conversationId: string, userId: string) {
  const { data } = await supabaseAdmin
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .maybeSingle()
  return !!data
}

// image_url darf NUR auf den eigenen Supabase Storage-Bucket "chat-media" zeigen
// (analog zur gleichen Absicherung bei Profilbild/Banner/Hintergrund) — niemals eine
// beliebige externe URL, die sonst per direktem API-Aufruf untergeschoben werden könnte.
const ALLOWED_MEDIA_PREFIX = 'https://lgvrborqklwfbkgbjnvs.supabase.co/storage/v1/object/public/chat-media/'

function isValidMediaUrl(url: string): boolean {
  return url.startsWith(ALLOWED_MEDIA_PREFIX)
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

  const { data: messages, error } = await supabaseAdmin
    .from('messages')
    .select(`
      id, sender_id, content, image_url, created_at,
      users:sender_id ( username, display_name, profile_picture_url ),
      message_reactions ( id, user_id, emoji )
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Als gelesen markieren
  await supabaseAdmin
    .from('conversation_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)

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

  const { data: message, error } = await supabaseAdmin
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: content?.trim() || null,
      image_url: image_url || null,
    })
    .select('id, sender_id, content, image_url, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Eigene last_read_at sofort mitziehen, damit die eigene Nachricht nicht als
  // "ungelesen" in der eigenen Konversationsliste auftaucht.
  await supabaseAdmin
    .from('conversation_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)

  return NextResponse.json({ message })
}

// PATCH: Markiert die Konversation als gelesen, ohne neue Nachricht zu senden
// (z. B. wenn man den Chat nur öffnet, ohne dass GET erneut aufgerufen wird).
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

  await supabaseAdmin
    .from('conversation_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)

  return NextResponse.json({ success: true })
}