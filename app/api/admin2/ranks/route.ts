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
  if (!user || !['administrator', 'owner'].includes(user.clan_role)) return null
  return user
}

export async function GET(req: NextRequest) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const result = await pool.query('SELECT * FROM mc_ranks ORDER BY priority DESC, id ASC')
  return NextResponse.json({ ranks: result.rows })
}

export async function POST(req: NextRequest) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const { name, display_name, chat_prefix, tab_prefix, tab_suffix, color, name_color, priority, is_default } = body
  if (!name || !display_name) return NextResponse.json({ error: 'name und display_name erforderlich' }, { status: 400 })
  if (is_default) await pool.query('UPDATE mc_ranks SET is_default = false')
  const result = await pool.query(
    `INSERT INTO mc_ranks (name, display_name, chat_prefix, tab_prefix, tab_suffix, color, name_color, priority, is_default)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [name, display_name, chat_prefix || '', tab_prefix || '', tab_suffix || '', color || '§7', name_color || '', priority ?? 0, is_default ?? false]
  )
  return NextResponse.json({ rank: result.rows[0] })
}

export async function PUT(req: NextRequest) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const { id, name, display_name, chat_prefix, tab_prefix, tab_suffix, color, name_color, priority, is_default } = body
  if (!id) return NextResponse.json({ error: 'id erforderlich' }, { status: 400 })
  if (is_default) await pool.query('UPDATE mc_ranks SET is_default = false WHERE id != $1', [id])
  const result = await pool.query(
    `UPDATE mc_ranks SET name=$1, display_name=$2, chat_prefix=$3, tab_prefix=$4, tab_suffix=$5,
     color=$6, name_color=$7, priority=$8, is_default=$9, updated_at=now() WHERE id=$10 RETURNING *`,
    [name, display_name, chat_prefix || '', tab_prefix || '', tab_suffix || '', color || '§7', name_color || '', priority ?? 0, is_default ?? false, id]
  )
  if (!result.rows[0]) return NextResponse.json({ error: 'Rang nicht gefunden' }, { status: 404 })
  return NextResponse.json({ rank: result.rows[0] })
}

export async function DELETE(req: NextRequest) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id erforderlich' }, { status: 400 })
  const rank = await pool.query('SELECT is_default FROM mc_ranks WHERE id = $1', [id])
  if (rank.rows[0]?.is_default) return NextResponse.json({ error: 'Standard-Rang kann nicht gelöscht werden' }, { status: 400 })
  await pool.query('DELETE FROM mc_ranks WHERE id = $1', [id])
  return NextResponse.json({ success: true })
}