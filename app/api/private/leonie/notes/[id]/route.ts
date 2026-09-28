import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin } from '@/app/lib/csrf'
import { getLeonieUser } from '@/app/lib/leonie-auth'
import { NOTE_FULL_COLS, notesError, parseId, readNoteFields } from '../../_notes'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/private/leonie/notes/[id] — eine Notiz mit formatiertem Inhalt
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const user = await getLeonieUser(req)
    if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
    const id = parseId((await params).id)
    if (!id) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

    const r = await pool.query(`SELECT ${NOTE_FULL_COLS} FROM leonie_notes WHERE id = $1`, [id])
    if (!r.rows[0]) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
    return NextResponse.json(r.rows[0], { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return notesError(err, 'GET note')
  }
}

// PATCH /api/private/leonie/notes/[id] — { title?, content?, content_html?, folder_id?, paper?, pinned? }
// Nur Anheften / Vorlage ändern zählt nicht als "bearbeitet" (updated_at bleibt).
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    if (!checkOrigin(req)) return NextResponse.json({ error: 'CSRF' }, { status: 403 })
    const user = await getLeonieUser(req)
    if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
    const id = parseId((await params).id)
    if (!id) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

    const f = readNoteFields(await req.json().catch(() => ({})))
    const keys = Object.keys(f)
    if (!keys.length) return NextResponse.json({ error: 'Nichts zu ändern' }, { status: 400 })

    const sets = keys.map((k, i) => `${k} = $${i + 1}`)
    if (keys.some(k => k === 'title' || k === 'content' || k === 'content_html' || k === 'folder_id')) sets.push('updated_at = NOW()')

    const result = await pool.query(
      `UPDATE leonie_notes SET ${sets.join(', ')} WHERE id = $${keys.length + 1} RETURNING ${NOTE_FULL_COLS}`,
      [...keys.map(k => f[k]), id]
    )
    if (!result.rows[0]) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
    return NextResponse.json(result.rows[0])
  } catch (err) {
    return notesError(err, 'PATCH note')
  }
}

// DELETE /api/private/leonie/notes/[id]
export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    if (!checkOrigin(req)) return NextResponse.json({ error: 'CSRF' }, { status: 403 })
    const user = await getLeonieUser(req)
    if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
    const id = parseId((await params).id)
    if (!id) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

    await pool.query('DELETE FROM leonie_notes WHERE id = $1', [id])
    return NextResponse.json({ ok: true })
  } catch (err) {
    return notesError(err, 'DELETE note')
  }
}