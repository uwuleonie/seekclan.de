import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const result = await pool.query(
    `SELECT u.clan_role FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token]
  )
  const row = result.rows[0]
  if (!row || !['administrator', 'owner', 'teammitglied'].includes(row.clan_role)) return null
  return row
}

// GET all rules
export async function GET(req: NextRequest) {
  const user = await requireAdmin(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const result = await pool.query(
    'SELECT id, sort_order, category, title, content, updated_at FROM rules ORDER BY sort_order ASC, id ASC'
  )
  return NextResponse.json({ rules: result.rows })
}

// POST create rule
export async function POST(req: NextRequest) {
  const user = await requireAdmin(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const { category, title, content, sort_order } = await req.json()
  if (!title?.trim() || !content?.trim()) return NextResponse.json({ error: 'Titel und Inhalt erforderlich' }, { status: 400 })
  const result = await pool.query(
    `INSERT INTO rules (category, title, content, sort_order) VALUES ($1, $2, $3, $4) RETURNING *`,
    [category?.trim() || 'Allgemein', title.trim(), content.trim(), sort_order ?? 0]
  )
  return NextResponse.json({ rule: result.rows[0] })
}

// PUT update rule
export async function PUT(req: NextRequest) {
  const user = await requireAdmin(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const { id, category, title, content, sort_order } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID fehlt' }, { status: 400 })
  const result = await pool.query(
    `UPDATE rules SET category=$1, title=$2, content=$3, sort_order=$4, updated_at=NOW() WHERE id=$5 RETURNING *`,
    [category?.trim() || 'Allgemein', title.trim(), content.trim(), sort_order ?? 0, id]
  )
  return NextResponse.json({ rule: result.rows[0] })
}

// DELETE rule
export async function DELETE(req: NextRequest) {
  const user = await requireAdmin(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID fehlt' }, { status: 400 })
  await pool.query('DELETE FROM rules WHERE id=$1', [id])
  return NextResponse.json({ ok: true })
}