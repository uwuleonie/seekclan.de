import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { pool } from '@/app/lib/db'
import { checkOrigin } from '@/app/lib/csrf'
import { getPrivateUser } from '@/app/lib/private-auth'
import { currentSize, filePath, makeThumbnail } from '@/app/lib/private-storage'
import { FILE_COLS, badRequest, forbidden, notFound, parseId, serverError } from '../../_shared'

type Ctx = { params: Promise<{ id: string }> }

// POST /api/private/files/[id]/complete — Upload abschließen, Vorschaubild erzeugen
async function handlePOST(req: NextRequest, { params }: Ctx) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  const user = await getPrivateUser(req)
  if (!user) return forbidden()
  const id = parseId((await params).id)
  if (!id) return notFound()

  const r = await pool.query(
    `SELECT storage_key, size_bytes, status, kind FROM private_files WHERE id = $1 AND user_id = $2`,
    [id, user.id]
  )
  const row = r.rows[0]
  if (!row) return notFound()

  if (row.status === 'uploading') {
    const target = filePath(user.id, row.storage_key)
    // Leere Dateien (0 Byte) bekommen nie ein Teilstück → Datei hier anlegen
    if (row.size_bytes === 0) await fs.writeFile(target, '', { flag: 'a' })
    const have = await currentSize(target)
    if (have !== row.size_bytes) {
      return NextResponse.json({ error: 'Datei unvollständig', received: have }, { status: 409 })
    }

    let thumb: { ok: boolean; width?: number; height?: number } = { ok: false }
    if (row.kind === 'image') thumb = await makeThumbnail(user.id, row.storage_key)

    await pool.query(
      `UPDATE private_files
       SET status = 'ready', completed_at = NOW(), updated_at = NOW(),
           has_thumb = $2, width = $3, height = $4
       WHERE id = $1`,
      [id, thumb.ok, thumb.width ?? null, thumb.height ?? null]
    )
  } else if (row.status !== 'ready') {
    return badRequest('Unbekannter Status')
  }

  const done = await pool.query(`SELECT ${FILE_COLS} FROM private_files WHERE id = $1`, [id])
  return NextResponse.json(done.rows[0])
}


export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    return await handlePOST(req, ctx)
  } catch (err) {
    return serverError(err, 'POST /api/private/files/[id]/complete')
  }
}