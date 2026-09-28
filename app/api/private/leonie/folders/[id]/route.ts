import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin } from '@/app/lib/csrf'
import { getLeonieUser } from '@/app/lib/leonie-auth'
import { FOLDER_COLS, folderDescendants, notesError, parseId } from '../../_notes'

type Ctx = { params: Promise<{ id: string }> }

// PATCH /api/private/leonie/folders/[id] — { name?, color?, sort_order?, parent_id? }
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    if (!checkOrigin(req)) return NextResponse.json({ error: 'CSRF' }, { status: 403 })
    const user = await getLeonieUser(req)
    if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
    const id = parseId((await params).id)
    if (!id) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

    const body = await req.json().catch(() => ({}))
    const fields: string[] = []
    const values: unknown[] = []
    const add = (sql: string, v: unknown) => { values.push(v); fields.push(`${sql} = $${values.length}`) }

    if (typeof body.name === 'string' && body.name.trim()) add('name', body.name.trim().slice(0, 80))
    if (typeof body.color === 'string' && /^#[0-9a-f]{6}$/i.test(body.color)) add('color', body.color)
    if (typeof body.sort_order === 'number' && Number.isSafeInteger(body.sort_order)) add('sort_order', body.sort_order)
    if ('parent_id' in body) {
      const parent = body.parent_id === null || body.parent_id === '' ? null : Number(body.parent_id)
      if (parent !== null) {
        if (!Number.isSafeInteger(parent)) return NextResponse.json({ error: 'Ungültiger Oberordner' }, { status: 400 })
        // Ein Ordner darf nicht in sich selbst oder einen eigenen Unterordner wandern
        if ((await folderDescendants(id)).includes(parent)) {
          return NextResponse.json({ error: 'Ein Ordner kann nicht in sich selbst oder seinen Unterordner verschoben werden' }, { status: 400 })
        }
      }
      add('parent_id', parent)
    }
    if (!fields.length) return NextResponse.json({ error: 'Nichts zu ändern' }, { status: 400 })

    values.push(id)
    const result = await pool.query(
      `UPDATE leonie_folders SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING ${FOLDER_COLS}`,
      values
    )
    if (!result.rows[0]) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
    return NextResponse.json(result.rows[0])
  } catch (err) {
    return notesError(err, 'PATCH folder')
  }
}

// DELETE /api/private/leonie/folders/[id]
// Nichts geht verloren: Notizen und Unterordner rutschen eine Ebene nach oben
// (in den Oberordner, bzw. nach "Ohne Ordner", wenn es ein Hauptordner war).
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const client = await pool.connect()
  try {
    if (!checkOrigin(req)) return NextResponse.json({ error: 'CSRF' }, { status: 403 })
    const user = await getLeonieUser(req)
    if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
    const id = parseId((await params).id)
    if (!id) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

    await client.query('BEGIN')
    const r = await client.query('SELECT parent_id FROM leonie_folders WHERE id = $1 FOR UPDATE', [id])
    if (!r.rows[0]) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 }) }
    const parent = r.rows[0].parent_id ?? null
    const notes = await client.query('UPDATE leonie_notes SET folder_id = $2 WHERE folder_id = $1', [id, parent])
    const subs = await client.query('UPDATE leonie_folders SET parent_id = $2 WHERE parent_id = $1', [id, parent])
    await client.query('DELETE FROM leonie_folders WHERE id = $1', [id])
    await client.query('COMMIT')
    return NextResponse.json({ ok: true, movedNotes: notes.rowCount, movedFolders: subs.rowCount, to: parent })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    return notesError(err, 'DELETE folder')
  } finally {
    client.release()
  }
}