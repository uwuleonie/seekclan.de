import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { mitRecht } from '@/app/lib/rechte'

async function checkWrite(req: NextRequest) {
  return mitRecht(req, 'admin.verwalten')
}

async function checkRead(req: NextRequest) {
  return mitRecht(req, 'admin.zugang')
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