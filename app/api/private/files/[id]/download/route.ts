import { NextRequest } from 'next/server'
import { pool } from '@/app/lib/db'
import { getPrivateUser } from '@/app/lib/private-auth'
import { serveStoredFile } from '@/app/lib/private-stream'
import { forbidden, notFound, parseId, serverError } from '../../_shared'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/private/files/[id]/download          → als Download
// GET /api/private/files/[id]/download?inline=1 → im Browser anzeigen (nur sichere Typen)
//
// Unterstützt "Range"-Anfragen: Videos lassen sich dadurch vorspulen und iPhones
// spielen Videos überhaupt erst ab, wenn der Server Range beherrscht.
// Die Datei wird gestreamt — auch mehrere GB belegen kaum Arbeitsspeicher.
async function handleGET(req: NextRequest, { params }: Ctx) {
  const user = await getPrivateUser(req)
  if (!user) return forbidden()
  const id = parseId((await params).id)
  if (!id) return notFound()

  const r = await pool.query(
    `SELECT storage_key, original_name, mime_type FROM private_files
     WHERE id = $1 AND user_id = $2 AND status = 'ready'`,
    [id, user.id]
  )
  const row = r.rows[0]
  if (!row) return notFound()

  return serveStoredFile(
    req,
    { userId: user.id, storageKey: row.storage_key, name: row.original_name, mime: row.mime_type },
    { inline: req.nextUrl.searchParams.get('inline') === '1' }
  )
}

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    return await handleGET(req, ctx)
  } catch (err) {
    return serverError(err, 'GET /api/private/files/[id]/download')
  }
}