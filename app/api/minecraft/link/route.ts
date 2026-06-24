import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

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

    const { code } = await req.json()

    if (!code) {
      return NextResponse.json({ error: 'Code erforderlich' }, { status: 400 })
    }

    const linkCodeResult = await pool.query(
      'SELECT * FROM minecraft_link_codes WHERE code = $1',
      [code.toUpperCase()]
    )
    const linkCode = linkCodeResult.rows[0]

    if (!linkCode) {
      return NextResponse.json({ error: 'Ungültiger Code' }, { status: 404 })
    }

    if (new Date(linkCode.expires_at) < new Date()) {
      await pool.query('DELETE FROM minecraft_link_codes WHERE id = $1', [linkCode.id])
      return NextResponse.json({ error: 'Code abgelaufen – bitte neu generieren mit /link' }, { status: 400 })
    }

    const existingResult = await pool.query(
      'SELECT id, username FROM users WHERE minecraft_uuid = $1',
      [linkCode.minecraft_uuid]
    )
    const existing = existingResult.rows[0]

    if (existing && existing.id !== session.user_id) {
      return NextResponse.json({ error: 'Dieser Minecraft Account ist bereits mit einem anderen Account verknüpft' }, { status: 409 })
    }

    await pool.query(
      'UPDATE users SET minecraft_username = $1, minecraft_uuid = $2 WHERE id = $3',
      [linkCode.minecraft_username, linkCode.minecraft_uuid, session.user_id]
    )

    await pool.query('DELETE FROM minecraft_link_codes WHERE id = $1', [linkCode.id])

    return NextResponse.json({
      success: true,
      minecraft_username: linkCode.minecraft_username
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}