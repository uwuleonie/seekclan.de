import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

export async function GET() {
  const { data: messages } = await supabaseAdmin
    .from('smp_chat_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ messages: (messages || []).reverse() })
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { data: session } = await supabaseAdmin
    .from('sessions')
    .select('user_id, expires_at')
    .eq('token', token)
    .single()

  if (!session || new Date(session.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Session abgelaufen' }, { status: 401 })
  }

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('username, minecraft_username, minecraft_uuid')
    .eq('id', session.user_id)
    .single()

  if (!user) return NextResponse.json({ error: 'User nicht gefunden' }, { status: 404 })

  const body = await req.json()
  const message = (body.message || '').toString().trim()

  if (!message) return NextResponse.json({ error: 'Nachricht ist leer' }, { status: 400 })
  if (message.length > 256) return NextResponse.json({ error: 'Nachricht zu lang (max. 256 Zeichen)' }, { status: 400 })

  const senderName = user.minecraft_username || user.username

  const { error } = await supabaseAdmin.from('smp_chat_messages').insert({
    sender_name: senderName,
    sender_uuid: user.minecraft_uuid || null,
    message,
    source: 'web',
  })

  if (error) return NextResponse.json({ error: 'Senden fehlgeschlagen' }, { status: 500 })

  return NextResponse.json({ success: true })
}