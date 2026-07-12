import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

async function checkWrite(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const s = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  if (!s.rows[0]) return null
  const u = await pool.query('SELECT id, clan_role FROM users WHERE id = $1', [s.rows[0].user_id])
  const user = u.rows[0]
  if (!user || !['administrator', 'owner'].includes(user.clan_role)) return null
  return user
}

// GET /api/internal/scoreboard-config?server=lobby
export async function GET(req: NextRequest) {
  if (!await verifyPluginKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const server = req.nextUrl.searchParams.get('server') || 'lobby'
  const result = await pool.query(
    'SELECT title, lines FROM lobby_scoreboard_config WHERE server_name = $1 ORDER BY id DESC LIMIT 1',
    [server]
  )
  return NextResponse.json({ config: result.rows[0] || null })
}

// POST /api/admin2/scoreboard-config — Website speichert Config
export async function POST(req: NextRequest) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const { title, lines, server_name = 'lobby' } = body
  if (!title || !lines) return NextResponse.json({ error: 'title und lines erforderlich' }, { status: 400 })
  await pool.query(
    `INSERT INTO lobby_scoreboard_config (title, lines, server_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (server_name) DO UPDATE SET title = $1, lines = $2`,
    [title, JSON.stringify(lines), server_name]
  )
  return NextResponse.json({ success: true })
}