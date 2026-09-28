import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin } from '@/app/lib/csrf'
import { getLeonieUser } from '@/app/lib/leonie-auth'
import { parseId, serverError } from '@/app/api/private/files/_shared'

type Ctx = { params: Promise<{ id: string }> }

// Anhänge einer Notiz = Verknüpfungen auf Dateien aus Quick Share (keine Kopie).
// Wird die Datei in Quick Share gelöscht, verschwindet sie automatisch auch aus der Notiz.

const ATTACH_COLS = `
  a.id AS attachment_id, a.sort_order, a.created_at AS attached_at,
  f.id, f.folder_id, f.original_name, f.mime_type, f.size_bytes, f.kind, f.has_thumb, f.width, f.height,
  f.source_device, f.device_id, f.seen_at, f.created_at, f.completed_at, f.updated_at`

async function listFor(noteId: number, userId: string | number) {
  const r = await pool.query(
    `SELECT ${ATTACH_COLS}
     FROM leonie_note_attachments a
     JOIN private_files f ON f.id = a.file_id
     WHERE a.note_id = $1 AND f.user_id = $2 AND f.status = 'ready'
     ORDER BY a.sort_order ASC, a.id ASC`,
    [noteId, userId]
  )
  return r.rows
}

// GET /api/private/leonie/notes/[id]/attachments
async function handleGET(req: NextRequest, { params }: Ctx) {
  const user = await getLeonieUser(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const noteId = parseId((await params).id)
  if (!noteId) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  return NextResponse.json(await listFor(noteId, user.id))
}

// POST /api/private/leonie/notes/[id]/attachments — { file_ids: number[] }
async function handlePOST(req: NextRequest, { params }: Ctx) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  const user = await getLeonieUser(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const noteId = parseId((await params).id)
  if (!noteId) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const fileIds: number[] = Array.isArray(body?.file_ids)
    ? body.file_ids.map(Number).filter((n: number) => Number.isSafeInteger(n) && n > 0).slice(0, 200)
    : []
  if (!fileIds.length) return NextResponse.json({ error: 'Keine Dateien gewählt' }, { status: 400 })

  const note = await pool.query('SELECT 1 FROM leonie_notes WHERE id = $1', [noteId])
  if (!note.rows[0]) return NextResponse.json({ error: 'Notiz nicht gefunden' }, { status: 404 })

  // Nur eigene, fertig hochgeladene Dateien; Reihenfolge wie ausgewählt, hinten angehängt
  await pool.query(
    `INSERT INTO leonie_note_attachments (note_id, file_id, sort_order)
     SELECT $1, f.id,
            COALESCE((SELECT MAX(sort_order) FROM leonie_note_attachments WHERE note_id = $1), 0) + x.ord
     FROM unnest($2::bigint[]) WITH ORDINALITY AS x(file_id, ord)
     JOIN private_files f ON f.id = x.file_id AND f.user_id = $3 AND f.status = 'ready'
     ON CONFLICT (note_id, file_id) DO NOTHING`,
    [noteId, fileIds, user.id]
  )
  await pool.query('UPDATE leonie_notes SET updated_at = NOW() WHERE id = $1', [noteId])

  return NextResponse.json(await listFor(noteId, user.id))
}

// PATCH /api/private/leonie/notes/[id]/attachments — { order: attachment_id[] } (neue Reihenfolge)
async function handlePATCH(req: NextRequest, { params }: Ctx) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  const user = await getLeonieUser(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const noteId = parseId((await params).id)
  if (!noteId) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const order: number[] = Array.isArray(body?.order)
    ? body.order.map(Number).filter((n: number) => Number.isSafeInteger(n) && n > 0)
    : []
  if (!order.length) return NextResponse.json({ error: 'Reihenfolge fehlt' }, { status: 400 })

  await pool.query(
    `UPDATE leonie_note_attachments a SET sort_order = x.ord
     FROM unnest($2::bigint[]) WITH ORDINALITY AS x(id, ord)
     WHERE a.id = x.id AND a.note_id = $1`,
    [noteId, order]
  )
  return NextResponse.json(await listFor(noteId, user.id))
}

// DELETE /api/private/leonie/notes/[id]/attachments?attachment_id=X — nur aus der Notiz entfernen
// (die Datei selbst bleibt in Quick Share)
async function handleDELETE(req: NextRequest, { params }: Ctx) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  const user = await getLeonieUser(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const noteId = parseId((await params).id)
  const attachmentId = parseId(req.nextUrl.searchParams.get('attachment_id') || '')
  if (!noteId || !attachmentId) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  await pool.query('DELETE FROM leonie_note_attachments WHERE id = $1 AND note_id = $2', [attachmentId, noteId])
  return NextResponse.json(await listFor(noteId, user.id))
}

export async function GET(req: NextRequest, ctx: Ctx) {
  try { return await handleGET(req, ctx) } catch (err) { return serverError(err, 'GET notes/[id]/attachments') }
}
export async function POST(req: NextRequest, ctx: Ctx) {
  try { return await handlePOST(req, ctx) } catch (err) { return serverError(err, 'POST notes/[id]/attachments') }
}
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try { return await handlePATCH(req, ctx) } catch (err) { return serverError(err, 'PATCH notes/[id]/attachments') }
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try { return await handleDELETE(req, ctx) } catch (err) { return serverError(err, 'DELETE notes/[id]/attachments') }
}