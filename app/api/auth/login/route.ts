import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkRateLimit, getIP, rateLimitResponse } from '@/app/lib/rate-limit'
import { checkOrigin, csrfError } from '@/app/lib/csrf'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

// Echter, fest hinterlegter bcrypt-Hash (Cost-Faktor 12, wie bei echten Passwörtern)
// ohne zugehöriges Klartext-Passwort — dient nur als Dummy-Vergleichsziel, damit ein
// nicht existierender Username ungefähr genauso lange braucht wie ein existierender
// mit falschem Passwort (siehe Kommentar unten bei der Verwendung).
const DUMMY_HASH = '$2a$12$CwTycUXWue0Thq9StjUM0uJ8qFvFAtVdfHj4HSj1qVgwlqLfWdQqq'

export async function POST(req: NextRequest) {
  try {
    if (!checkOrigin(req)) return csrfError()

    const ip = getIP(req)
    const limit = await checkRateLimit(ip, 'login')
    if (!limit.allowed) return rateLimitResponse(limit)

    const { username, password } = await req.json()

    if (!username || !password) {
      return NextResponse.json({ error: 'Username und Passwort erforderlich' }, { status: 400 })
    }

    const userResult = await pool.query(
      'SELECT id, username, password_hash, is_banned, banned_reason FROM users WHERE username = $1',
      [username]
    )
    const user = userResult.rows[0]

    if (!user) {
      // Dummy-Vergleich mit ungefähr gleicher Laufzeit wie bcrypt.compare unten -
      // verhindert, dass ein Angreifer durch Messen der Antwortzeit erkennen kann,
      // ob ein Username existiert (existierende Accounts brauchen wegen des echten
      // bcrypt.compare spürbar länger als ein sofortiges "nicht gefunden").
      await bcrypt.compare(password, DUMMY_HASH)
      return NextResponse.json({ error: 'Ungültige Zugangsdaten' }, { status: 401 })
    }

    if (user.is_banned) {
      return NextResponse.json({ error: `Account gesperrt: ${user.banned_reason || 'Kein Grund angegeben'}` }, { status: 403 })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return NextResponse.json({ error: 'Ungültige Zugangsdaten' }, { status: 401 })
    }

    const token = randomBytes(64).toString('hex')
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    await pool.query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expires.toISOString()]
    )

    // Für die "Letzter Login"-Anzeige und Login-Historie in Seek Accounts (admin2)
    const loginIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null
    await pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id])
    await pool.query(
      'INSERT INTO login_history (user_id, ip_address) VALUES ($1, $2)',
      [user.id, loginIp]
    )

    const ipLog = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unbekannt'
    await pool.query(
      'INSERT INTO login_history (user_id, ip_address) VALUES ($1, $2)',
      [user.id, ipLog]
    )

    await pool.query('UPDATE users SET last_seen_at = $1 WHERE id = $2', [new Date().toISOString(), user.id])

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