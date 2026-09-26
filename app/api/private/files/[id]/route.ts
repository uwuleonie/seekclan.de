import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin } from '@/app/lib/csrf'
import { getPrivateUser } from '@/app/lib/private-auth'
import { cleanName, currentSize, detectKind, filePath, normalizeMime, removeStored } from '@/app/lib/private-storage'
import { FILE_COLS, badRequest, forbidden, notFound, parseId, serverError } from '../_shared'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/private/files/[id] — Upload-Stand (wie viele Bytes sind schon da?) → zum Fortsetzen
async function handleGET(req: NextRequest, { params }: Ctx) {
  const user = await getPrivateUser(req)
  if (!user) return forbidden()
  const id = parseId((await params).id)
  if (!id) return notFound()

  const r = await pool.query(
    `SELECT storage_key, size_bytes, status FROM private_files WHERE id = $1 AND user_id = $2`,
    [id, user.id]
  )
  const row = r.rows[0]
  if (!row) return notFound()

  const received = await currentSize(filePath(user.id, row.storage_key))
  return NextResponse.json({ status: row.status, size: row.size_bytes, received })
}

// PATCH /api/private/files/[id] — { name?, folder_id?, seen? }
async function handlePATCH(req: NextRequest, { params }: Ctx) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  const user = await getPrivateUser(req)
  if (!user) return forbidden()
  const id = parseId((await params).id)
  if (!id) return notFound()

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Ungültige Anfrage')

  const fields: string[] = []
  const values: unknown[] = []
  let i = 1

  if (typeof body.name === 'string' && body.name.trim()) {
    const name = cleanName(body.name)
    const mime = normalizeMime(name, null)
    fields.push(`original_name = $${i++}`)
    values.push(name)
    // Endung geändert → Art neu bestimmen (Mime nur übernehmen, wenn eindeutig erkennbar)
    if (mime !== 'application/octet-stream') {
      fields.push(`mime_type = $${i++}`, `kind = $${i++}`)
      values.push(mime, detectKind(name, mime))
    }
  }
  if ('folder_id' in body) {
    const folderId = body.folder_id ? Number(body.folder_id) : null
    if (folderId !== null) {
      const f = await pool.query('SELECT 1 FROM private_file_folders WHERE id = $1 AND user_id = $2', [folderId, user.id])
      if (!f.rows[0]) return badRequest('Ordner nicht gefunden')
    }
    fields.push(`folder_id = $${i++}`)
    values.push(folderId)
  }
  if (body.seen === true) fields.push('seen_at = COALESCE(seen_at, NOW())')
  if (body.seen === false) fields.push('seen_at = NULL')

  if (!fields.length) return badRequest('Nichts zu ändern')
  fields.push('updated_at = NOW()')

  values.push(id, user.id)
  const r = await pool.query(
    `UPDATE private_files SET ${fields.join(', ')}
     WHERE id = $${i++} AND user_id = $${i}
     RETURNING ${FILE_COLS}`,
    values
  )
  if (!r.rows[0]) return notFound()
  return NextResponse.json(r.rows[0])
}

// DELETE /api/private/files/[id] — Datei endgültig löschen (auch abgebrochene Uploads)
async function handleDELETE(req: NextRequest, { params }: Ctx) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  const user = await getPrivateUser(req)
  if (!user) return forbidden()
  const id = parseId((await params).id)
  if (!id) return notFound()

  const r = await pool.query(
    `DELETE FROM private_files WHERE id = $1 AND user_id = $2 RETURNING storage_key`,
    [id, user.id]
  )
  if (!r.rows[0]) return notFound()
  await removeStored(user.id, r.rows[0].storage_key)
  return NextResponse.json({ ok: true })
}


export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    return await handleGET(req, ctx)
  } catch (err) {
    return serverError(err, 'GET /api/private/files/[id]')
  }
}


export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    return await handlePATCH(req, ctx)
  } catch (err) {
    return serverError(err, 'PATCH /api/private/files/[id]')
  }
}


export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    return await handleDELETE(req, ctx)
  } catch (err) {
    return serverError(err, 'DELETE /api/private/files/[id]')
  }
}