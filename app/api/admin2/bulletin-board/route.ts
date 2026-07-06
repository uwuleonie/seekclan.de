import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function checkWrite(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const s = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  if (!s.rows[0]) return null
  const u = await pool.query('SELECT id, clan_role FROM users WHERE id = $1', [s.rows[0].user_id])
  const user = u.rows[0]
  if (!user || (user.clan_role !== 'administrator' && user.clan_role !== 'owner')) return null
  return user
}

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

// GET — aktuellen Inhalt laden
export async function GET(req: NextRequest) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const result = await pool.query('SELECT id, title, bullets FROM lobby_bulletin_board ORDER BY id DESC LIMIT 1')
  return NextResponse.json({ board: result.rows[0] || null })
}

// POST — Inhalt speichern (nur Text, kein Rendering)
export async function POST(req: NextRequest) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { title, bullets } = await req.json().catch(() => ({})) as { title?: string, bullets?: string[] }
  if (!title?.trim()) return NextResponse.json({ error: 'Titel erforderlich' }, { status: 400 })

  const validBullets = (bullets || []).filter((b: string) => b.trim()).slice(0, 8)

  await pool.query('DELETE FROM lobby_bulletin_board')
  const result = await pool.query(
    'INSERT INTO lobby_bulletin_board (title, bullets) VALUES ($1, $2) RETURNING id',
    [title.trim(), JSON.stringify(validBullets)]
  )
  return NextResponse.json({ id: result.rows[0].id, success: true })
}