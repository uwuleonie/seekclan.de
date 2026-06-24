import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

// WICHTIG (Migration): Diese Tabelle wird auch vom Minecraft-Plugin direkt befüllt
// (Nachrichten aus dem Spiel, source = 'game'), analog zum gleichen Blocker bei
// smp_server_status. Solange das Plugin noch nach Supabase schreibt, sieht die
// Website hier nur die eigenen 'web'-Nachrichten, keine Chat-Nachrichten aus dem Spiel.
//
// AUSSERDEM: Das Frontend hat bisher vermutlich Supabase Realtime genutzt, um neue
// Nachrichten hier sofort ohne Neuladen anzuzeigen — das gibt es mit unserer eigenen
// Postgres-Instanz nicht mehr automatisch. Bis ein eigener Realtime-Mechanismus steht,
// funktioniert dieser Chat nur noch per Polling/Neuladen, nicht live.
export async function GET() {
  const result = await pool.query(
    'SELECT * FROM smp_chat_messages ORDER BY created_at DESC LIMIT 50'
  )

  return NextResponse.json({ messages: (result.rows || []).reverse() })
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const sessionResult = await pool.query(
    'SELECT user_id, expires_at FROM sessions WHERE token = $1',
    [token]
  )
  const session = sessionResult.rows[0]

  if (!session || new Date(session.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Session abgelaufen' }, { status: 401 })
  }

  const userResult = await pool.query(
    'SELECT username, minecraft_username, minecraft_uuid FROM users WHERE id = $1',
    [session.user_id]
  )
  const user = userResult.rows[0]

  if (!user) return NextResponse.json({ error: 'User nicht gefunden' }, { status: 404 })

  const body = await req.json()
  const message = (body.message || '').toString().trim()

  if (!message) return NextResponse.json({ error: 'Nachricht ist leer' }, { status: 400 })
  if (message.length > 256) return NextResponse.json({ error: 'Nachricht zu lang (max. 256 Zeichen)' }, { status: 400 })

  const senderName = user.minecraft_username || user.username

  try {
    await pool.query(
      'INSERT INTO smp_chat_messages (sender_name, sender_uuid, message, source) VALUES ($1, $2, $3, $4)',
      [senderName, user.minecraft_uuid || null, message, 'web']
    )
  } catch (err) {
    return NextResponse.json({ error: 'Senden fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}