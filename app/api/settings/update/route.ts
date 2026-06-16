import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'
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

    // Session prüfen
    const { data: session } = await supabaseAdmin
      .from('sessions')
      .select('user_id, expires_at')
      .eq('token', token)
      .single()

    if (!session || new Date(session.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Session abgelaufen' }, { status: 401 })
    }

    const body = await req.json()
    const { type } = body

    // Passwort ändern
    if (type === 'password') {
      const { current_password, new_password } = body

      if (!current_password || !new_password) {
        return NextResponse.json({ error: 'Alle Felder erforderlich' }, { status: 400 })
      }

      if (new_password.length < 6) {
        return NextResponse.json({ error: 'Passwort muss mindestens 6 Zeichen lang sein' }, { status: 400 })
      }

      const { data: user } = await supabaseAdmin
        .from('users')
        .select('password_hash')
        .eq('id', session.user_id)
        .single()

      if (!user) return NextResponse.json({ error: 'User nicht gefunden' }, { status: 404 })

      const valid = await bcrypt.compare(current_password, user.password_hash)
      if (!valid) return NextResponse.json({ error: 'Aktuelles Passwort falsch' }, { status: 401 })

      const password_hash = await bcrypt.hash(new_password, 12)
      await supabaseAdmin.from('users').update({ password_hash }).eq('id', session.user_id)

      return NextResponse.json({ success: true, message: 'Passwort erfolgreich geändert' })
    }

    // Biografie ändern
    if (type === 'biography') {
      const { biography } = body
      await supabaseAdmin.from('users').update({ biography }).eq('id', session.user_id)
      return NextResponse.json({ success: true, message: 'Biografie gespeichert' })
    }

    // Spitzname
    if (type === 'display_name') {
      const { display_name } = body
      if (typeof display_name !== 'string' || display_name.length > 32) {
        return NextResponse.json({ error: 'Ungültiger Spitzname' }, { status: 400 })
      }
      await supabaseAdmin.from('users').update({ display_name: display_name.trim() || null }).eq('id', session.user_id)
      return NextResponse.json({ success: true, message: 'Spitzname gespeichert' })
    }
    if (type === 'discord_id') {
      const { discord_id } = body
      if (discord_id && !/^\d{17,19}$/.test(discord_id)) {
        return NextResponse.json({ error: 'Ungültige Discord-ID (nur Zahlen, 17-19 Stellen)' }, { status: 400 })
      }
      await supabaseAdmin.from('users').update({ discord_id: discord_id || null }).eq('id', session.user_id)
      return NextResponse.json({ success: true, message: 'Discord-ID gespeichert' })
    }

    // Sprache ändern
    if (type === 'language') {
      const { language } = body
      if (!['de', 'en', 'es', 'fr'].includes(language)) {
        return NextResponse.json({ error: 'Ungültige Sprache' }, { status: 400 })
      }
      await supabaseAdmin.from('users').update({ language }).eq('id', session.user_id)
      return NextResponse.json({ success: true, message: 'Sprache gespeichert' })
    }

    // Darkmode ändern
    if (type === 'darkmode') {
      const { darkmode } = body
      await supabaseAdmin.from('users').update({ darkmode }).eq('id', session.user_id)
      return NextResponse.json({ success: true })
    }

    // Account deaktivieren
    if (type === 'deactivate') {
      await supabaseAdmin.from('users').update({ is_deactivated: true }).eq('id', session.user_id)
      await supabaseAdmin.from('sessions').delete().eq('user_id', session.user_id)
      const response = NextResponse.json({ success: true })
      response.cookies.delete('session_token')
      return response
    }

    // Account löschen
    if (type === 'delete') {
      const { password } = body
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('password_hash')
        .eq('id', session.user_id)
        .single()

      if (!user) return NextResponse.json({ error: 'User nicht gefunden' }, { status: 404 })

      const valid = await bcrypt.compare(password, user.password_hash)
      if (!valid) return NextResponse.json({ error: 'Passwort falsch' }, { status: 401 })

      await supabaseAdmin.from('users').delete().eq('id', session.user_id)
      const response = NextResponse.json({ success: true })
      response.cookies.delete('session_token')
      return response
    }

   // Privatsphäre ändern
if (type === 'privacy') {
  const { field, value } = body
  const allowed = ['privacy_friend_requests', 'privacy_profile', 'privacy_last_active', 'privacy_stats', 'privacy_leaderboard']
  if (!allowed.includes(field)) {
    return NextResponse.json({ error: 'Ungültiges Feld' }, { status: 400 })
  }
  await supabaseAdmin.from('users').update({ [field]: value }).eq('id', session.user_id)
  return NextResponse.json({ success: true, message: 'Privatsphäre gespeichert' })
}
    return NextResponse.json({ error: 'Unbekannter Typ' }, { status: 400 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}