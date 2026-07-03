import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function checkAdmin(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null

  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null

  const userResult = await pool.query(
    'SELECT username, clan_role FROM users WHERE id = $1',
    [session.user_id]
  )
  const user = userResult.rows[0]

  if (!user || (user.clan_role !== 'administrator' && user.clan_role !== 'owner')) return null
  return user
}

// Alle Kategorien laden
export async function GET(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const result = await pool.query('SELECT * FROM badge_categories ORDER BY created_at ASC')

  return NextResponse.json({ categories: result.rows || [] })
}

// Kategorie erstellen
export async function POST(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { name, color } = await req.json()
  if (!name) return NextResponse.json({ error: 'Name erforderlich' }, { status: 400 })

  try {
    await pool.query(
      'INSERT INTO badge_categories (name, color) VALUES ($1, $2)',
      [name, color || '#888780']
    )
  } catch (err) {
    return NextResponse.json({ error: 'Fehler beim Erstellen' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// Kategorie löschen
export async function DELETE(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID erforderlich' }, { status: 400 })

  try {
    await pool.query('DELETE FROM badge_categories WHERE id = $1', [id])
  } catch (err) {
    return NextResponse.json({ error: 'Fehler beim Löschen' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}