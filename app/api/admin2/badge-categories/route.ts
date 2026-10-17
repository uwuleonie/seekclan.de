import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { mitRecht } from '@/app/lib/rechte'

// /api/admin2/badge-categories – Kategorien der Clan-Abzeichen (Tabelle badge_categories)
//   GET alle · POST {name, color} · DELETE {id} (Abzeichen der Kategorie bleiben, ohne Kategorie)

export async function GET(req: NextRequest) {
  if (!(await mitRecht(req, 'admin.zugang'))) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const r = await pool.query('SELECT * FROM badge_categories ORDER BY created_at ASC')
  return NextResponse.json({ categories: r.rows })
}

export async function POST(req: NextRequest) {
  if (!(await mitRecht(req, 'clan.verwalten'))) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const name = String(b.name ?? '').trim().slice(0, 60)
  const color = /^#[0-9a-f]{6}$/i.test(String(b.color ?? '')) ? String(b.color) : '#888780'
  if (!name) return NextResponse.json({ error: 'Name fehlt' }, { status: 400 })
  const r = await pool.query('INSERT INTO badge_categories (name, color) VALUES ($1, $2) RETURNING *', [name, color])
  return NextResponse.json({ category: r.rows[0] })
}

export async function DELETE(req: NextRequest) {
  if (!(await mitRecht(req, 'clan.verwalten'))) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })
  await pool.query('UPDATE clan_badges SET category_id = NULL WHERE category_id = $1', [id])
  await pool.query('DELETE FROM badge_categories WHERE id = $1', [id])
  return NextResponse.json({ success: true })
}
