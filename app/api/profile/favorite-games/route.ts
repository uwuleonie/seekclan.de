import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

export async function POST(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const sessionResult = await pool.query(
    'SELECT user_id, expires_at FROM sessions WHERE token = $1',
    [token]
  )
  const session = sessionResult.rows[0]

  if (!session || new Date(session.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Session abgelaufen' }, { status: 401 })
  }

  const body = await req.json()
  const games = body.games

  if (!Array.isArray(games) || games.length > 5) {
    return NextResponse.json({ error: 'Max. 5 Spiele erlaubt' }, { status: 400 })
  }

  // Nur appid + name + icon speichern
  const cleaned = games.map((g: any) => ({
    appid: Number(g.appid),
    name: String(g.name).slice(0, 100),
    icon: String(g.icon),
  }))

  try {
    // favorite_games ist eine jsonb-Spalte — wir übergeben das Array daher
    // explizit als JSON-String, damit pg es korrekt als jsonb einträgt.
    await pool.query(
      'UPDATE users SET favorite_games = $1::jsonb WHERE id = $2',
      [JSON.stringify(cleaned), session.user_id]
    )
  } catch (err) {
    return NextResponse.json({ error: 'Speichern fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}