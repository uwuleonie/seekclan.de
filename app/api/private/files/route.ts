import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { pool } from '@/app/lib/db'
import { checkOrigin } from '@/app/lib/csrf'
import { getPrivateUser } from '@/app/lib/private-auth'
import {
  CHUNK_SIZE, cleanName, detectKind, diskInfo, ensureUserDir, normalizeMime, removeStored,
} from '@/app/lib/private-storage'
import { FILE_COLS, badRequest, forbidden, serverError } from './_shared'

// GET /api/private/files — alle fertigen Dateien + Ordner + Speicherinfo des eingeloggten Accounts
async function handleGET(req: NextRequest) {
  const user = await getPrivateUser(req)
  if (!user) return forbidden()

  // Abgebrochene Uploads aufräumen (länger als 24 h nicht weitergeführt)
  const stale = await pool.query(
    `DELETE FROM private_files
     WHERE user_id = $1 AND status = 'uploading' AND updated_at < NOW() - INTERVAL '24 hours'
     RETURNING storage_key`,
    [user.id]
  )
  for (const row of stale.rows) await removeStored(user.id, row.storage_key)

  const [files, folders, usage, disk] = await Promise.all([
    pool.query(
      `SELECT ${FILE_COLS} FROM private_files
       WHERE user_id = $1 AND status = 'ready'
       ORDER BY created_at DESC`,
      [user.id]
    ),
    pool.query(
      `SELECT f.id, f.name, f.created_at, COUNT(p.id)::int AS file_count
       FROM private_file_folders f
       LEFT JOIN private_files p ON p.folder_id = f.id AND p.status = 'ready'
       WHERE f.user_id = $1
       GROUP BY f.id
       ORDER BY f.name ASC`,
      [user.id]
    ),
    pool.query(
      `SELECT COALESCE(SUM(size_bytes), 0)::bigint AS used FROM private_files WHERE user_id = $1`,
      [user.id]
    ),
    diskInfo(),
  ])

  return NextResponse.json({
    files: files.rows,
    folders: folders.rows,
    storage: { used: Number(usage.rows[0].used), free: disk.free, total: disk.total },
  })
}

// POST /api/private/files — neuen Upload anlegen (danach Teilstücke per PUT .../[id]/chunk)
// Body: { name, size, mime, folder_id?, device_id?, source_device? }
async function handlePOST(req: NextRequest) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  const user = await getPrivateUser(req)
  if (!user) return forbidden()

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Ungültige Anfrage')

  const name = cleanName(body.name)
  const size = Number(body.size)
  if (!Number.isSafeInteger(size) || size < 0) return badRequest('Ungültige Dateigröße')

  const mime = normalizeMime(name, body.mime)
  const kind = detectKind(name, mime)
  const folderId = body.folder_id ? Number(body.folder_id) : null
  const deviceId = typeof body.device_id === 'string' ? body.device_id.slice(0, 64) : null
  const sourceDevice = ['Handy', 'Tablet', 'PC'].includes(body.source_device) ? body.source_device : null

  if (folderId !== null) {
    const f = await pool.query('SELECT 1 FROM private_file_folders WHERE id = $1 AND user_id = $2', [folderId, user.id])
    if (!f.rows[0]) return badRequest('Ordner nicht gefunden')
  }

  await ensureUserDir(user.id)
  const storageKey = randomUUID()

  const result = await pool.query(
    `INSERT INTO private_files
       (user_id, folder_id, storage_key, original_name, mime_type, size_bytes, kind, source_device, device_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [user.id, folderId, storageKey, name, mime, size, kind, sourceDevice, deviceId]
  )

  return NextResponse.json({ id: result.rows[0].id, chunkSize: CHUNK_SIZE, received: 0 })
}


export async function GET(req: NextRequest) {
  try {
    return await handleGET(req)
  } catch (err) {
    return serverError(err, 'GET /api/private/files')
  }
}


export async function POST(req: NextRequest) {
  try {
    return await handlePOST(req)
  } catch (err) {
    return serverError(err, 'POST /api/private/files')
  }
}