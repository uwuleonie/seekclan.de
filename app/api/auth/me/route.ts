import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('session_token')?.value
    if (!token) return NextResponse.json({ user: null })

    const sessionResult = await pool.query(
      'SELECT user_id FROM sessions WHERE token = $1',
      [token]
    )
    const session = sessionResult.rows[0]

    if (!session) return NextResponse.json({ user: null })
      // last_seen_at aktualisieren
    await pool.query('UPDATE users SET last_seen_at = $1 WHERE id = $2', [new Date().toISOString(), session.user_id])

    const userResult = await pool.query(
      `SELECT id, username, display_name, minecraft_username, clan_role, discord_username, discord_id,
              spotify_access_token, biography, banner_url, background_url, background_blur,
              profile_picture_url, accent_color, card_opacity, profile_theme, steam_id, steam_username,
              steam_avatar, favorite_games, last_seen_at, minecraft_uuid
       FROM users WHERE id = $1`,
      [session.user_id]
    )
    const user = userResult.rows[0]

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