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

    if (username.length < 3) {
      return NextResponse.json({ error: 'Username muss mindestens 3 Zeichen lang sein' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Passwort muss mindestens 6 Zeichen lang sein' }, { status: 400 })
    }

    // Prüfen ob Username schon existiert
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('username', username)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Username bereits vergeben' }, { status: 409 })
    }

    // Passwort hashen
    const password_hash = await bcrypt.hash(password, 12)

    // User erstellen
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .insert({ username, password_hash })
      .select('id, username')
      .single()

    if (error || !user) {
      return NextResponse.json({ error: 'Registrierung fehlgeschlagen' }, { status: 500 })
    }

    // 8 Security Codes generieren
    const codes = Array.from({ length: 8 }, () => randomBytes(4).toString('hex').toUpperCase())
    const codeHashes = await Promise.all(codes.map(code => bcrypt.hash(code, 10)))

    await supabaseAdmin.from('security_codes').insert(
      codeHashes.map(code_hash => ({ user_id: user.id, code_hash }))
    )

    // Session Token erstellen
    const token = randomBytes(64).toString('hex')
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    await supabaseAdmin.from('sessions').insert({
      user_id: user.id,
      token,
      expires_at: expires.toISOString(),
    })

    const response = NextResponse.json({ 
      success: true, 
      username: user.username,
      security_codes: codes // Einmalig anzeigen!
    })

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