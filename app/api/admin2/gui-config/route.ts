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

// GET /api/admin2/gui-config?id=daily_reward
export async function GET(req: NextRequest) {
  const pluginKey = req.headers.get('x-plugin-key')
  if (pluginKey) {
    if (!await verifyPluginKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const result = await pool.query('SELECT * FROM lobby_gui_config')
    return NextResponse.json({ configs: result.rows })
  }
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const id = new URL(req.url).searchParams.get('id')
  if (id) {
    const result = await pool.query('SELECT * FROM lobby_gui_config WHERE id = $1', [id])
    return NextResponse.json({ config: result.rows[0] || null })
  }
  const result = await pool.query('SELECT * FROM lobby_gui_config ORDER BY id')
  return NextResponse.json({ configs: result.rows })
}

// POST /api/admin2/gui-config
export async function POST(req: NextRequest) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const { id, title, rows, slots } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id erforderlich' }, { status: 400 })
  await pool.query(
    `INSERT INTO lobby_gui_config (id, title, rows, slots)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET title=$2, rows=$3, slots=$4, updated_at=now()`,
    [id, title, rows || 3, JSON.stringify(slots || [])]
  )
  return NextResponse.json({ success: true })
}