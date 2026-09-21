import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function checkAccess(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query(
    'SELECT id, username, clan_role FROM users WHERE id = $1',
    [session.user_id]
  )
  const user = userResult.rows[0]
  if (!user || !['administrator', 'owner', 'teammitglied'].includes(user.clan_role)) return null
  return user
}

// GET /api/admin2/admin-items/templates
// Gibt alle Item-Templates zurück
export async function GET(req: NextRequest) {
  const user = await checkAccess(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const result = await pool.query(
    `SELECT id, name, item_data, uploaded_by, uploaded_at
     FROM admin_item_templates
     ORDER BY uploaded_at DESC`
  )

  return NextResponse.json({ templates: result.rows })
}

// DELETE /api/admin2/admin-items/templates
// Löscht ein Template
export async function DELETE(req: NextRequest) {
  const user = await checkAccess(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  await pool.query('DELETE FROM admin_item_templates WHERE id = $1', [id])

  return NextResponse.json({ ok: true })
}