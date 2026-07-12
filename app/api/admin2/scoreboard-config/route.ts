import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function checkRead(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const s = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  if (!s.rows[0]) return null
  const u = await pool.query('SELECT id, clan_role FROM users WHERE id = $1', [s.rows[0].user_id])
  const user = u.rows[0]
  if (!user || !['administrator', 'owner', 'teammitglied'].includes(user.clan_role)) return null
  return user
}

async function checkWrite(req: NextRequest) {
  const user = await checkRead(req)
  if (!user || (user.clan_role !== 'administrator' && user.clan_role !== 'owner')) return null
  return user
}

// GET — alle Server-Configs laden
export async function GET(req: NextRequest) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const result = await pool.query('SELECT * FROM lobby_scoreboard_config ORDER BY server_name, id DESC')
  // Neueste Config pro Server
  const byServer: Record<string, any> = {}
  for (const row of result.rows) {
    if (!byServer[row.server_name]) byServer[row.server_name] = row
  }
  return NextResponse.json({ configs: byServer })
}

// POST — Config für einen Server speichern
export async function POST(req: NextRequest) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const { title, lines, server_name = 'lobby' } = await req.json().catch(() => ({}))
  if (!title) return NextResponse.json({ error: 'Titel erforderlich' }, { status: 400 })

  const existing = await pool.query('SELECT id FROM lobby_scoreboard_config WHERE server_name = $1', [server_name])
  if (existing.rows[0]) {
    await pool.query(
      `UPDATE lobby_scoreboard_config SET title = $1, lines = $2, updated_at = now() WHERE server_name = $3`,
      [title, JSON.stringify(lines || []), server_name]
    )
  } else {
    await pool.query(
      `INSERT INTO lobby_scoreboard_config (title, lines, server_name) VALUES ($1, $2, $3)`,
      [title, JSON.stringify(lines || []), server_name]
    )
  }
  return NextResponse.json({ success: true })
}