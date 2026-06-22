import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('session_token')?.value
    if (!token) return NextResponse.json({ user: null })

    const { data: session } = await supabaseAdmin
      .from('sessions')
      .select('user_id')
      .eq('token', token)
      .single()

    if (!session) return NextResponse.json({ user: null })
      // last_seen_at aktualisieren
    await supabaseAdmin.from('users').update({ last_seen_at: new Date().toISOString() }).eq('id', session.user_id)

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, username, display_name, minecraft_username, clan_role, discord_username, discord_id, spotify_access_token, biography, banner_url, background_url, background_blur, profile_picture_url, accent_color, card_opacity, profile_theme, steam_id, steam_username, steam_avatar, favorite_games, last_seen_at, minecraft_uuid')
      .eq('id', session.user_id)
      .single()

    if (!user) return NextResponse.json({ user: null })

    // Das eigentliche Spotify-Access-Token nie an den Client senden — es wird nur
    // server-seitig für API-Calls an Spotify gebraucht. Das Frontend braucht nur zu
    // wissen, ob eine Verknüpfung besteht.
    const { spotify_access_token, ...safeUser } = user

    return NextResponse.json({ user: { ...safeUser, spotify_connected: !!spotify_access_token } })
  } catch {
    return NextResponse.json({ user: null })
  }
}