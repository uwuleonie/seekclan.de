import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { mitRecht } from '@/app/lib/rechte'

// /api/admin2/badges – Clan-Abzeichen (Tabelle clan_badges) verwalten. Lesen: admin.zugang, Ändern: clan.verwalten
//   GET     alle Abzeichen mit Kategorie
//   POST    {name, icon_url, erreichbar, category_id, description}
//   PATCH   {id, name, description, category_id, erreichbar}
//   DELETE  {id}  (Zuordnungen zu Mitgliedern werden mit gelöscht)

export async function GET(req: NextRequest) {
  if (!(await mitRecht(req, 'admin.zugang'))) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const r = await pool.query(
    `SELECT cb.*, CASE WHEN bc.id IS NOT NULL THEN json_build_object('id', bc.id, 'name', bc.name, 'color', bc.color) ELSE NULL END AS badge_categories
     FROM clan_badges cb LEFT JOIN badge_categories bc ON bc.id = cb.category_id ORDER BY cb.name ASC`
  )
  return NextResponse.json({ badges: r.rows })
}

export async function POST(req: NextRequest) {
  if (!(await mitRecht(req, 'clan.verwalten'))) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const name = String(b.name ?? '').trim().slice(0, 80)
  const icon = String(b.icon_url ?? '').trim().slice(0, 500)
  if (!name || !icon) return NextResponse.json({ error: 'Name und Bild fehlen' }, { status: 400 })
  const r = await pool.query(
    'INSERT INTO clan_badges (name, icon_url, erreichbar, category_id, description) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [name, icon, b.erreichbar !== false, b.category_id || null, b.description ? String(b.description).slice(0, 500) : null]
  )
  return NextResponse.json({ badge: r.rows[0] })
}

export async function PATCH(req: NextRequest) {
  if (!(await mitRecht(req, 'clan.verwalten'))) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  if (!b.id || !String(b.name ?? '').trim()) return NextResponse.json({ error: 'id und Name fehlen' }, { status: 400 })
  const r = await pool.query(
    'UPDATE clan_badges SET name = $1, description = $2, category_id = $3, erreichbar = $4 WHERE id = $5 RETURNING *',
    [String(b.name).trim().slice(0, 80), b.description ? String(b.description).slice(0, 500) : null, b.category_id || null, b.erreichbar !== false, b.id]
  )
  return NextResponse.json({ badge: r.rows[0] ?? null })
}

export async function DELETE(req: NextRequest) {
  if (!(await mitRecht(req, 'clan.verwalten'))) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })
  await pool.query('DELETE FROM clan_member_badges WHERE badge_id = $1', [id])
  await pool.query('DELETE FROM clan_badges WHERE id = $1', [id])
  return NextResponse.json({ success: true })
}
