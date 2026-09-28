import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin } from '@/app/lib/csrf'
import { getLeonieUser } from '@/app/lib/leonie-auth'
import { notesError } from '../_notes'

// Gespeicherte Unterschriften (gezeichnet mit Finger/Maus, als PNG)
// GET    /api/private/leonie/signatures        → Liste
// POST   /api/private/leonie/signatures        → { name?, data_url, width, height }
// DELETE /api/private/leonie/signatures?id=3   → löschen (bereits eingefügte bleiben in den Notizen)

const MAX_BYTES = 400 * 1024
const PNG_RE = /^data:image\/png;base64,[a-z0-9+/=]+$/i

export async function GET(req: NextRequest) {
  try {
    const user = await getLeonieUser(req)
    if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
    const r = await pool.query('SELECT id, name, data_url, width, height, created_at FROM leonie_signatures ORDER BY created_at DESC')
    return NextResponse.json(r.rows, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return notesError(err, 'GET signatures')
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!checkOrigin(req)) return NextResponse.json({ error: 'CSRF' }, { status: 403 })
    const user = await getLeonieUser(req)
    if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

    const b = await req.json().catch(() => ({}))
    const dataUrl = typeof b.data_url === 'string' ? b.data_url : ''
    if (!PNG_RE.test(dataUrl)) return NextResponse.json({ error: 'Ungültiges Bild' }, { status: 400 })
    if (dataUrl.length > MAX_BYTES) return NextResponse.json({ error: 'Unterschrift ist zu groß' }, { status: 400 })
    const name = typeof b.name === 'string' && b.name.trim() ? b.name.trim().slice(0, 60) : 'Unterschrift'
    const w = Math.max(1, Math.min(4000, Math.round(Number(b.width) || 0))) || null
    const h = Math.max(1, Math.min(4000, Math.round(Number(b.height) || 0))) || null

    const r = await pool.query(
      `INSERT INTO leonie_signatures (name, data_url, width, height) VALUES ($1, $2, $3, $4)
       RETURNING id, name, data_url, width, height, created_at`,
      [name, dataUrl, w, h]
    )
    return NextResponse.json(r.rows[0])
  } catch (err) {
    return notesError(err, 'POST signatures')
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!checkOrigin(req)) return NextResponse.json({ error: 'CSRF' }, { status: 403 })
    const user = await getLeonieUser(req)
    if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
    const id = Number(req.nextUrl.searchParams.get('id'))
    if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })
    await pool.query('DELETE FROM leonie_signatures WHERE id = $1', [id])
    return NextResponse.json({ ok: true })
  } catch (err) {
    return notesError(err, 'DELETE signatures')
  }
}