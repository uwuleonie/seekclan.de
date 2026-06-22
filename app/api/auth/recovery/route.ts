import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'
import { checkRateLimit, getIP, rateLimitResponse } from '@/app/lib/rate-limit'
import { checkOrigin, csrfError } from '@/app/lib/csrf'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

export async function POST(req: NextRequest) {
  try {
    if (!checkOrigin(req)) return csrfError()

    const ip = getIP(req)
    const limit = await checkRateLimit(ip, 'recovery')
    if (!limit.allowed) return rateLimitResponse(limit)

    const { username, security_code, new_password } = await req.json()

    if (!username || !security_code || !new_password) {
      return NextResponse.json({ error: 'Alle Felder erforderlich' }, { status: 400 })
    }

    if (new_password.length < 6) {
      return NextResponse.json({ error: 'Passwort muss mindestens 6 Zeichen lang sein' }, { status: 400 })
    }

    // Zusätzliches Limit pro Username (nicht nur pro IP) — verhindert, dass ein
    // verteilter Angriff (viele IPs) das IP-basierte Limit umgeht, um denselben
    // Account gezielt mit Codes zu bombardieren.
    const usernameLimit = await checkRateLimit(`user:${username.toLowerCase()}`, 'recovery')
    if (!usernameLimit.allowed) return rateLimitResponse(usernameLimit)

    // User suchen
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('username', username)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'Ungültige Zugangsdaten' }, { status: 401 })
    }

    // Unbenutzte Security Codes laden
    const { data: codes } = await supabaseAdmin
      .from('security_codes')
      .select('id, code_hash')
      .eq('user_id', user.id)
      .eq('is_used', false)

    if (!codes || codes.length === 0) {
      return NextResponse.json({ error: 'Keine gültigen Security Codes vorhanden' }, { status: 401 })
    }

    // Code prüfen
    let matchedCode = null
    for (const code of codes) {
      const match = await bcrypt.compare(security_code.toUpperCase(), code.code_hash)
      if (match) {
        matchedCode = code
        break
      }
    }

    if (!matchedCode) {
      return NextResponse.json({ error: 'Ungültiger Security Code' }, { status: 401 })
    }

    // Code als benutzt markieren
    await supabaseAdmin
      .from('security_codes')
      .update({ is_used: true })
      .eq('id', matchedCode.id)

    // Neues Passwort setzen
    const password_hash = await bcrypt.hash(new_password, 12)
    await supabaseAdmin
      .from('users')
      .update({ password_hash })
      .eq('id', user.id)

    // Alle Sessions löschen (Sicherheit)
    await supabaseAdmin.from('sessions').delete().eq('user_id', user.id)

    // Neue Session erstellen
    const token = randomBytes(64).toString('hex')
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    await supabaseAdmin.from('sessions').insert({
      user_id: user.id,
      token,
      expires_at: expires.toISOString(),
    })

    const response = NextResponse.json({ success: true })
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