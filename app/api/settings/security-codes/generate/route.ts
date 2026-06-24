import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

export async function POST(req: NextRequest) {
  try {
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

    const { password } = await req.json()

    if (!password) {
      return NextResponse.json({ error: 'Passwort erforderlich' }, { status: 400 })
    }

    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [session.user_id]
    )
    const user = userResult.rows[0]

    if (!user) {
      return NextResponse.json({ error: 'User nicht gefunden' }, { status: 404 })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return NextResponse.json({ error: 'Passwort falsch' }, { status: 401 })
    }

    await pool.query('DELETE FROM security_codes WHERE user_id = $1', [session.user_id])

    const codes = Array.from({ length: 8 }, () =>
      randomBytes(4).toString('hex').toUpperCase()
    )
    const codeHashes = await Promise.all(codes.map(code => bcrypt.hash(code, 10)))

    const values = codeHashes.map((_, i) => `($1, $${i + 2})`).join(', ')
    await pool.query(
      `INSERT INTO security_codes (user_id, code_hash) VALUES ${values}`,
      [session.user_id, ...codeHashes]
    )

    return NextResponse.json({ success: true, codes })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}