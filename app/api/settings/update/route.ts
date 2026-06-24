import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkRateLimit, getIP, rateLimitResponse } from '@/app/lib/rate-limit'
import { checkOrigin, csrfError } from '@/app/lib/csrf'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    if (!checkOrigin(req)) return csrfError()

    const ip = getIP(req)
    const limit = await checkRateLimit(ip, 'settings')
    if (!limit.allowed) return rateLimitResponse(limit)
    const token = req.cookies.get('session_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
    }

    const sessionResult = await pool.query(
      'SELECT user_id, expires_at FROM sessions WHERE token = $1',
      [token]
    )
    const session = sessionResult.rows[0]

    if (!session || new Date(session.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Session abgelaufen' }, { status: 401 })
    }

    const body = await req.json()
    const { type } = body

    if (type === 'password') {
      const { current_password, new_password } = body

      if (!current_password || !new_password) {
        return NextResponse.json({ error: 'Alle Felder erforderlich' }, { status: 400 })
      }

      if (new_password.length < 6) {
        return NextResponse.json({ error: 'Passwort muss mindestens 6 Zeichen lang sein' }, { status: 400 })
      }

      const userResult = await pool.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [session.user_id]
      )
      const user = userResult.rows[0]

      if (!user) return NextResponse.json({ error: 'User nicht gefunden' }, { status: 404 })

      const valid = await bcrypt.compare(current_password, user.password_hash)
      if (!valid) return NextResponse.json({ error: 'Aktuelles Passwort falsch' }, { status: 401 })

      const password_hash = await bcrypt.hash(new_password, 12)
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, session.user_id])

      return NextResponse.json({ success: true, message: 'Passwort erfolgreich geändert' })
    }

    if (type === 'biography') {
      const { biography } = body
      await pool.query('UPDATE users SET biography = $1 WHERE id = $2', [biography, session.user_id])
      return NextResponse.json({ success: true, message: 'Biografie gespeichert' })
    }

    if (type === 'display_name') {
      const { display_name } = body
      if (typeof display_name !== 'string' || display_name.length > 32) {
        return NextResponse.json({ error: 'Ungültiger Spitzname' }, { status: 400 })
      }
      await pool.query('UPDATE users SET display_name = $1 WHERE id = $2', [display_name.trim() || null, session.user_id])
      return NextResponse.json({ success: true, message: 'Spitzname gespeichert' })
    }
    if (type === 'discord_id') {
      const { discord_id } = body
      if (discord_id && !/^\d{17,19}$/.test(discord_id)) {
        return NextResponse.json({ error: 'Ungültige Discord-ID (nur Zahlen, 17-19 Stellen)' }, { status: 400 })
      }
      await pool.query('UPDATE users SET discord_id = $1 WHERE id = $2', [discord_id || null, session.user_id])
      return NextResponse.json({ success: true, message: 'Discord-ID gespeichert' })
    }

    if (type === 'language') {
      const { language } = body
      if (!['de', 'en', 'es', 'fr'].includes(language)) {
        return NextResponse.json({ error: 'Ungültige Sprache' }, { status: 400 })
      }
      await pool.query('UPDATE users SET language = $1 WHERE id = $2', [language, session.user_id])
      return NextResponse.json({ success: true, message: 'Sprache gespeichert' })
    }

    if (type === 'darkmode') {
      const { darkmode } = body
      await pool.query('UPDATE users SET darkmode = $1 WHERE id = $2', [darkmode, session.user_id])
      return NextResponse.json({ success: true })
    }

    if (type === 'deactivate') {
      await pool.query('UPDATE users SET is_deactivated = true WHERE id = $1', [session.user_id])
      await pool.query('DELETE FROM sessions WHERE user_id = $1', [session.user_id])
      const response = NextResponse.json({ success: true })
      response.cookies.delete('session_token')
      return response
    }

    if (type === 'delete') {
      const { password } = body
      const userResult = await pool.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [session.user_id]
      )
      const user = userResult.rows[0]

      if (!user) return NextResponse.json({ error: 'User nicht gefunden' }, { status: 404 })

      const valid = await bcrypt.compare(password, user.password_hash)
      if (!valid) return NextResponse.json({ error: 'Passwort falsch' }, { status: 401 })

      await pool.query('DELETE FROM users WHERE id = $1', [session.user_id])
      const response = NextResponse.json({ success: true })
      response.cookies.delete('session_token')
      return response
    }

    if (type === 'privacy') {
      const { field, value } = body
      const allowed = ['privacy_friend_requests', 'privacy_profile', 'privacy_last_active', 'privacy_stats', 'privacy_leaderboard']
      if (!allowed.includes(field)) {
        return NextResponse.json({ error: 'Ungültiges Feld' }, { status: 400 })
      }
      await pool.query(`UPDATE users SET ${field} = $1 WHERE id = $2`, [value, session.user_id])
      return NextResponse.json({ success: true, message: 'Privatsphäre gespeichert' })
    }
    return NextResponse.json({ error: 'Unbekannter Typ' }, { status: 400 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}