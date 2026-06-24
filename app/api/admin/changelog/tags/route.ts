import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function checkStaff(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT id, clan_role FROM users WHERE id = $1', [session.user_id])
  const user = userResult.rows[0]
  if (!user) return null
  const staff = user.clan_role?.toLowerCase() === 'admin' || user.clan_role?.toLowerCase() === 'mod'
  return staff ? user : null
}

// Alle Tags laden (öffentlich lesbar, damit die /changelog-Seite Farben anzeigen kann)
export async function GET() {
  let tags
  try {
    const result = await pool.query('SELECT * FROM changelog_tags ORDER BY created_at ASC')
    tags = result.rows
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
  return NextResponse.json({ tags: tags || [] })
}

// Body: { name: string, color: string, requires_version?: boolean }
export async function POST(req: NextRequest) {
  const staff = await checkStaff(req)
  if (!staff) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { name, color, requires_version } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name erforderlich' }, { status: 400 })

  let data
  try {
    const result = await pool.query(
      'INSERT INTO changelog_tags (name, color, requires_version) VALUES ($1, $2, $3) RETURNING *',
      [name.trim(), color || '#7C3AED', !!requires_version]
    )
    data = result.rows[0]
  } catch (err: any) {
    return NextResponse.json({ error: 'Fehler beim Erstellen (Name evtl. schon vorhanden)' }, { status: 500 })
  }

  return NextResponse.json({ success: true, tag: data })
}

// Body: { id: number }
export async function DELETE(req: NextRequest) {
  const staff = await checkStaff(req)
  if (!staff) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID erforderlich' }, { status: 400 })

  try {
    await pool.query('DELETE FROM changelog_tags WHERE id = $1', [id])
  } catch (err: any) {
    return NextResponse.json({ error: 'Fehler beim Löschen' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}