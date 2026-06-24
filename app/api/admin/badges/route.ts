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

  if (!user || user.clan_role !== 'admin') return null
  return user
}

// Alle Badges laden (mit Kategorie)
export async function GET(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  let badges
  try {
    const result = await pool.query(
      `SELECT
         cb.*,
         CASE WHEN bc.id IS NOT NULL THEN json_build_object('id', bc.id, 'name', bc.name, 'color', bc.color) ELSE NULL END AS badge_categories
       FROM clan_badges cb
       LEFT JOIN badge_categories bc ON bc.id = cb.category_id
       ORDER BY cb.name ASC`
    )
    badges = result.rows
  } catch (err) {
    return NextResponse.json({ error: 'Fehler beim Laden' }, { status: 500 })
  }

  return NextResponse.json({ badges: badges || [] })
}

// Badge erstellen
export async function POST(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { name, icon_url, erreichbar, category_id, description } = await req.json()
  if (!name || !icon_url) return NextResponse.json({ error: 'Name und Icon-URL erforderlich' }, { status: 400 })

  try {
    await pool.query(
      `INSERT INTO clan_badges (name, icon_url, erreichbar, category_id, description)
       VALUES ($1, $2, $3, $4, $5)`,
      [name, icon_url, erreichbar ?? true, category_id || null, description || null]
    )
  } catch (err) {
    return NextResponse.json({ error: 'Fehler beim Erstellen' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// Badge bearbeiten
export async function PATCH(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { id, name, description, category_id, erreichbar } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID erforderlich' }, { status: 400 })

  try {
    await pool.query(
      `UPDATE clan_badges SET name = $1, description = $2, category_id = $3, erreichbar = $4 WHERE id = $5`,
      [name, description || null, category_id || null, erreichbar, id]
    )
  } catch (err) {
    return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// Badge löschen
export async function DELETE(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID erforderlich' }, { status: 400 })

  try {
    await pool.query('DELETE FROM clan_badges WHERE id = $1', [id])
  } catch (err) {
    return NextResponse.json({ error: 'Fehler beim Löschen' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}