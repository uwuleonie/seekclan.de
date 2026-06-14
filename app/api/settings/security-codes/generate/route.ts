import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('session_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
    }

    const { data: session } = await supabaseAdmin
      .from('sessions')
      .select('user_id, expires_at')
      .eq('token', token)
      .single()

    if (!session || new Date(session.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Session abgelaufen' }, { status: 401 })
    }

    const { password } = await req.json()

    if (!password) {
      return NextResponse.json({ error: 'Passwort erforderlich' }, { status: 400 })
    }

    // Passwort prüfen
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('password_hash')
      .eq('id', session.user_id)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User nicht gefunden' }, { status: 404 })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return NextResponse.json({ error: 'Passwort falsch' }, { status: 401 })
    }

    // Alte Codes löschen
    await supabaseAdmin
      .from('security_codes')
      .delete()
      .eq('user_id', session.user_id)

    // 8 neue Codes generieren
    const codes = Array.from({ length: 8 }, () => 
      randomBytes(4).toString('hex').toUpperCase()
    )
    const codeHashes = await Promise.all(codes.map(code => bcrypt.hash(code, 10)))

    await supabaseAdmin.from('security_codes').insert(
      codeHashes.map(code_hash => ({ user_id: session.user_id, code_hash }))
    )

    return NextResponse.json({ success: true, codes })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}