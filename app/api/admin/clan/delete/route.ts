import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('session_token')?.value
    if (!token) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

    const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
    const session = sessionResult.rows[0]

    if (!session) return NextResponse.json({ error: 'Session abgelaufen' }, { status: 401 })

    const userResult = await pool.query(
      'SELECT username, clan_role FROM users WHERE id = $1',
      [session.user_id]
    )
    const user = userResult.rows[0]

    if (!user || user.clan_role !== 'admin') {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
    }

    const { id } = await req.json()

    if (!id) return NextResponse.json({ error: 'ID erforderlich' }, { status: 400 })

    try {
      await pool.query('DELETE FROM clan_members WHERE id = $1', [id])
    } catch (err) {
      return NextResponse.json({ error: 'Fehler beim Löschen' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}