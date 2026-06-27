import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkRateLimit, getIP, rateLimitResponse } from '@/app/lib/rate-limit'
import { checkOrigin, csrfError } from '@/app/lib/csrf'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

export async function POST(req: NextRequest) {
  try {
    if (!checkOrigin(req)) return csrfError()

    const ip = getIP(req)
    const limit = await checkRateLimit(ip, 'register')
    if (!limit.allowed) return rateLimitResponse(limit)

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

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json({ error: 'Username darf nur Buchstaben, Zahlen und _ enthalten' }, { status: 400 })
    }

    const existingResult = await pool.query('SELECT id FROM users WHERE username = $1', [username])
    const existing = existingResult.rows[0]

    if (existing) {
      return NextResponse.json({ error: 'Username bereits vergeben' }, { status: 409 })
    }

    const password_hash = await bcrypt.hash(password, 12)
    const insertResult = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
      [username, password_hash]
    )
    const newUser = insertResult.rows[0]

    if (!newUser) {
      return NextResponse.json({ error: 'Registrierung fehlgeschlagen' }, { status: 500 })
    }

    // Security Codes direkt bei der Registrierung erzeugen, analog zu
    // /api/settings/security-codes/generate (gleiches Format: 8 Codes,
    // je 8 Hex-Zeichen, gehasht in security_codes gespeichert).
    const securityCodes = Array.from({ length: 8 }, () =>
      randomBytes(4).toString('hex').toUpperCase()
    )
    const codeHashes = await Promise.all(securityCodes.map(code => bcrypt.hash(code, 10)))

    const codeValues = codeHashes.map((_, i) => `($1, $${i + 2})`).join(', ')
    await pool.query(
      `INSERT INTO security_codes (user_id, code_hash) VALUES ${codeValues}`,
      [newUser.id, ...codeHashes]
    )

    const token = randomBytes(64).toString('hex')
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    await pool.query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [newUser.id, token, expires.toISOString()]
    )

    const response = NextResponse.json({
      success: true,
      username: newUser.username,
      security_codes: securityCodes,
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