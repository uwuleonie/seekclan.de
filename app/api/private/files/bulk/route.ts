import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin } from '@/app/lib/csrf'
import { getPrivateUser } from '@/app/lib/private-auth'
import { removeStored } from '@/app/lib/private-storage'
import { badRequest, forbidden, serverError } from '../_shared'

// POST /api/private/files/bulk
// Body: { action: 'delete' | 'move' | 'seen', ids: number[], folder_id?: number | null }
async function handlePOST(req: NextRequest) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  const user = await getPrivateUser(req)
  if (!user) return forbidden()

  const body = await req.json().catch(() => null)
  const ids: number[] = Array.isArray(body?.ids)
    ? body.ids.map(Number).filter((n: number) => Number.isSafeInteger(n) && n > 0).slice(0, 5000)
    : []
  if (!ids.length) return badRequest('Keine Dateien gewählt')

  if (body.action === 'delete') {
    const r = await pool.query(
      `DELETE FROM private_files WHERE user_id = $1 AND id = ANY($2::bigint[]) RETURNING storage_key`,
      [user.id, ids]
    )
    for (const row of r.rows) await removeStored(user.id, row.storage_key)
    return NextResponse.json({ ok: true, count: r.rowCount })
  }

  if (body.action === 'move') {
    const folderId = body.folder_id ? Number(body.folder_id) : null
    if (folderId !== null) {
      const f = await pool.query('SELECT 1 FROM private_file_folders WHERE id = $1 AND user_id = $2', [folderId, user.id])
      if (!f.rows[0]) return badRequest('Ordner nicht gefunden')
    }
    const r = await pool.query(
      `UPDATE private_files SET folder_id = $3, updated_at = NOW()
       WHERE user_id = $1 AND id = ANY($2::bigint[])`,
      [user.id, ids, folderId]
    )
    return NextResponse.json({ ok: true, count: r.rowCount })
  }

  if (body.action === 'seen') {
    const r = await pool.query(
      `UPDATE private_files SET seen_at = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND id = ANY($2::bigint[]) AND seen_at IS NULL`,
      [user.id, ids]
    )
    return NextResponse.json({ ok: true, count: r.rowCount })
  }

  return badRequest('Unbekannte Aktion')
}


export async function POST(req: NextRequest) {
  try {
    return await handlePOST(req)
  } catch (err) {
    return serverError(err, 'POST /api/private/files/bulk')
  }
}