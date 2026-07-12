import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

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

// GET — Plugin oder Website holt Config für einen Server
export async function GET(req: NextRequest) {
  const pluginKey = req.headers.get('x-plugin-key')
  const server = req.nextUrl.searchParams.get('server') || 'lobby'

  if (pluginKey) {
    if (!await verifyPluginKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const result = await pool.query(
      'SELECT * FROM lobby_tab_config WHERE server_name = $1 ORDER BY id DESC LIMIT 1',
      [server]
    )
    // Fallback auf lobby wenn kein Eintrag für diesen Server
    if (!result.rows[0] && server !== 'lobby') {
      const fallback = await pool.query('SELECT * FROM lobby_tab_config WHERE server_name = $1 ORDER BY id DESC LIMIT 1', ['lobby'])
      return NextResponse.json({ config: fallback.rows[0] || null })
    }
    return NextResponse.json({ config: result.rows[0] || null })
  }

  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  // Website: alle Server-Configs auf einmal laden
  const result = await pool.query('SELECT * FROM lobby_tab_config ORDER BY server_name, id DESC')
  // Neueste Config pro Server
  const byServer: Record<string, any> = {}
  for (const row of result.rows) {
    if (!byServer[row.server_name]) byServer[row.server_name] = row
  }
  return NextResponse.json({ configs: byServer })
}

// POST — Website speichert Config für einen Server
export async function POST(req: NextRequest) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const { header, footer, header_frames, footer_frames, server_name = 'lobby' } = body

  // Upsert per server_name
  const existing = await pool.query('SELECT id FROM lobby_tab_config WHERE server_name = $1', [server_name])
  if (existing.rows[0]) {
    await pool.query(
      `UPDATE lobby_tab_config SET header=$1, footer=$2, header_frames=$3, footer_frames=$4, updated_at=now() WHERE server_name=$5`,
      [header, footer, JSON.stringify(header_frames || []), JSON.stringify(footer_frames || []), server_name]
    )
  } else {
    await pool.query(
      `INSERT INTO lobby_tab_config (header, footer, header_frames, footer_frames, server_name) VALUES ($1, $2, $3, $4, $5)`,
      [header, footer, JSON.stringify(header_frames || []), JSON.stringify(footer_frames || []), server_name]
    )
  }
  return NextResponse.json({ success: true })
}