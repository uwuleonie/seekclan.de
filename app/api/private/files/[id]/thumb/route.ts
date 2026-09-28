import { NextRequest } from 'next/server'
import { promises as fs } from 'fs'
import { pool } from '@/app/lib/db'
import { getPrivateUser } from '@/app/lib/private-auth'
import { makeThumbnail, thumbPath } from '@/app/lib/private-storage'
import { serveThumb } from '@/app/lib/private-stream'
import { forbidden, notFound, parseId, serverError } from '../../_shared'

type Ctx = { params: Promise<{ id: string }> }

// Bilder, bei denen das Nacherzeugen gerade fehlgeschlagen ist → 1 Stunde nicht erneut versuchen
const FAILED = new Map<number, number>()
const RETRY_MS = 60 * 60 * 1000

async function exists(p: string) {
  try { await fs.access(p); return true } catch { return false }
}

// GET /api/private/files/[id]/thumb — kleines WebP-Vorschaubild (nur für Bilder)
// Fehlt das Vorschaubild (älterer Upload, Fehler beim Hochladen, Datei gelöscht),
// wird es hier einmal nacherzeugt und in der Datenbank vermerkt.
async function handleGET(req: NextRequest, { params }: Ctx) {
  const user = await getPrivateUser(req)
  if (!user) return forbidden()
  const id = parseId((await params).id)
  if (!id) return notFound()

  const r = await pool.query(
    `SELECT storage_key, has_thumb, kind FROM private_files WHERE id = $1 AND user_id = $2 AND status = 'ready'`,
    [id, user.id]
  )
  const row = r.rows[0]
  if (!row || row.kind !== 'image') return notFound()

  if (row.has_thumb && (await exists(thumbPath(user.id, row.storage_key)))) {
    return serveThumb(user.id, row.storage_key)
  }

  const failedAt = FAILED.get(id)
  if (failedAt && Date.now() - failedAt < RETRY_MS) return notFound()

  const t = await makeThumbnail(user.id, row.storage_key)
  if (!t.ok) {
    FAILED.set(id, Date.now())
    if (row.has_thumb) await pool.query('UPDATE private_files SET has_thumb = FALSE WHERE id = $1', [id])
    return notFound()
  }
  FAILED.delete(id)
  await pool.query(
    `UPDATE private_files SET has_thumb = TRUE, width = COALESCE($2, width), height = COALESCE($3, height) WHERE id = $1`,
    [id, t.width ?? null, t.height ?? null]
  )
  return serveThumb(user.id, row.storage_key)
}

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    return await handleGET(req, ctx)
  } catch (err) {
    return serverError(err, 'GET /api/private/files/[id]/thumb')
  }
}