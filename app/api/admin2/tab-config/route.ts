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

export async function GET(req: NextRequest) {
  const pluginKey = req.headers.get('x-plugin-key')
  if (pluginKey) {
    if (!await verifyPluginKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const result = await pool.query('SELECT * FROM lobby_tab_config ORDER BY id DESC LIMIT 1')
    return NextResponse.json({ config: result.rows[0] || null })
  }
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const result = await pool.query('SELECT * FROM lobby_tab_config ORDER BY id DESC LIMIT 1')
  return NextResponse.json({ config: result.rows[0] || null })
}

export async function POST(req: NextRequest) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const { header, footer, header_frames, footer_frames } = body
  await pool.query(
    `UPDATE lobby_tab_config SET header=$1, footer=$2, header_frames=$3, footer_frames=$4, updated_at=now()`,
    [header, footer, JSON.stringify(header_frames || []), JSON.stringify(footer_frames || [])]
  )
  return NextResponse.json({ success: true })
}