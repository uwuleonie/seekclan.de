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

    const { id, role, join_date, discord_tag } = await req.json()

    if (!id) return NextResponse.json({ error: 'ID erforderlich' }, { status: 400 })

    const updates: Record<string, any> = {}
    if (role) updates.role = role
    if (join_date) updates.join_date = join_date
    if (discord_tag !== undefined) updates.discord_tag = discord_tag

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: true })
    }

    const keys = Object.keys(updates)
    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ')
    const values = keys.map((key) => updates[key])

    try {
      await pool.query(
        `UPDATE clan_members SET ${setClause} WHERE id = $${keys.length + 1}`,
        [...values, id]
      )
    } catch (err) {
      return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}