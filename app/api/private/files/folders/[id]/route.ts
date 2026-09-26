import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin } from '@/app/lib/csrf'
import { getPrivateUser } from '@/app/lib/private-auth'
import { badRequest, forbidden, notFound, parseId, serverError } from '../../_shared'

type Ctx = { params: Promise<{ id: string }> }

// PATCH /api/private/files/folders/[id] — { name }
async function handlePATCH(req: NextRequest, { params }: Ctx) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  const user = await getPrivateUser(req)
  if (!user) return forbidden()
  const id = parseId((await params).id)
  if (!id) return notFound()

  const body = await req.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 80) : ''
  if (!name) return badRequest('Name fehlt')

  const r = await pool.query(
    `UPDATE private_file_folders SET name = $3, updated_at = NOW()
     WHERE id = $1 AND user_id = $2 RETURNING id, name, created_at`,
    [id, user.id, name]
  )
  if (!r.rows[0]) return notFound()
  return NextResponse.json(r.rows[0])
}

// DELETE /api/private/files/folders/[id] — Ordner löschen, Dateien darin bleiben erhalten
// (landen wieder in "Alle Dateien", siehe ON DELETE SET NULL in der Tabelle)
async function handleDELETE(req: NextRequest, { params }: Ctx) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  const user = await getPrivateUser(req)
  if (!user) return forbidden()
  const id = parseId((await params).id)
  if (!id) return notFound()

  const r = await pool.query('DELETE FROM private_file_folders WHERE id = $1 AND user_id = $2', [id, user.id])
  if (!r.rowCount) return notFound()
  return NextResponse.json({ ok: true })
}


export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    return await handlePATCH(req, ctx)
  } catch (err) {
    return serverError(err, 'PATCH /api/private/files/folders/[id]')
  }
}


export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    return await handleDELETE(req, ctx)
  } catch (err) {
    return serverError(err, 'DELETE /api/private/files/folders/[id]')
  }
}