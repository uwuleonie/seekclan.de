import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()

    if (!username || !password) {
      return NextResponse.json({ error: 'Username und Passwort erforderlich' }, { status: 400 })
    }

    // User in Datenbank suchen
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, username, password_hash, is_banned, banned_reason')
      .eq('username', username)
      .single()

    if (error || !user) {
      return NextResponse.json({ error: 'Ungültige Zugangsdaten' }, { status: 401 })
    }

    // Gesperrt?
    if (user.is_banned) {
      return NextResponse.json({ error: `Account gesperrt: ${user.banned_reason || 'Kein Grund angegeben'}` }, { status: 403 })
    }

    // Passwort prüfen
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return NextResponse.json({ error: 'Ungültige Zugangsdaten' }, { status: 401 })
    }

    // Session Token erstellen
    const token = randomBytes(64).toString('hex')
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 Tage

    await supabaseAdmin.from('sessions').insert({
      user_id: user.id,
      token,
      expires_at: expires.toISOString(),
    })

    // Login History speichern
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unbekannt'
    await supabaseAdmin.from('login_history').insert({
      user_id: user.id,
      ip_address: ip,
    })

    // last_seen_at aktualisieren
    await supabaseAdmin.from('users').update({ last_seen_at: new Date().toISOString() }).eq('id', user.id)

    // Cookie setzen
    const response = NextResponse.json({ success: true, username: user.username })
    response.cookies.set('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires,
    })

    return response
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}