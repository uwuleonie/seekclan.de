import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('session_token')?.value

    if (!token) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    // Session in Datenbank suchen
    const { data: session, error } = await supabaseAdmin
      .from('sessions')
      .select('user_id, expires_at')
      .eq('token', token)
      .single()

    if (error || !session) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    // Abgelaufen?
    if (new Date(session.expires_at) < new Date()) {
      await supabaseAdmin.from('sessions').delete().eq('token', token)
      return NextResponse.json({ user: null }, { status: 401 })
    }

    // User laden
    const { data: user } = await supabaseAdmin
      .from('users')
     .select('id, username, is_banned, minecraft_username, discord_id, discord_username')
      .eq('id', session.user_id)
      .single()

    if (!user || user.is_banned) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    // last_seen_at aktualisieren
    await supabaseAdmin
      .from('users')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', user.id)

    return NextResponse.json({ user: { id: user.id, username: user.username, minecraft_username: user.minecraft_username, discord_username: user.discord_username } })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ user: null }, { status: 500 })
  }
}