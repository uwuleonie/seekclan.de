// Anhänge für geteilte Notiz-Links — bewusst OHNE Login, der Token ist der Zugang.
// Es wird streng geprüft, dass die Datei wirklich an einer Notiz hängt, die dieser
// Link freigibt. Andere Quick-Share-Dateien sind darüber NICHT erreichbar.
//
// GET /api/private/leonie/shares/file?token=…&file=<id>            → Download
// GET /api/private/leonie/shares/file?token=…&file=<id>&inline=1   → anzeigen
// GET /api/private/leonie/shares/file?token=…&file=<id>&thumb=1    → Vorschaubild

import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { serveStoredFile, serveThumb } from '@/app/lib/private-stream'
import { parseId, serverError } from '@/app/api/private/files/_shared'

async function handleGET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const token = sp.get('token')
  const fileId = parseId(sp.get('file') || '')
  if (!token || !fileId) return NextResponse.json({ error: 'Ungültiger Link' }, { status: 400 })

  const r = await pool.query(
    `SELECT f.user_id, f.storage_key, f.original_name, f.mime_type, f.has_thumb
     FROM leonie_note_shares s
     JOIN leonie_note_attachments a ON (s.share_all OR a.note_id = s.note_id)
     JOIN private_files f ON f.id = a.file_id AND f.status = 'ready'
     WHERE s.token = $1
       AND (s.expires_at IS NULL OR s.expires_at > NOW())
       AND a.file_id = $2
     LIMIT 1`,
    [token, fileId]
  )
  const row = r.rows[0]
  if (!row) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const userId = String(row.user_id)
  if (sp.get('thumb') === '1') {
    if (!row.has_thumb) return NextResponse.json({ error: 'Kein Vorschaubild' }, { status: 404 })
    return serveThumb(userId, row.storage_key, 'private, max-age=3600')
  }
  return serveStoredFile(
    req,
    { userId, storageKey: row.storage_key, name: row.original_name, mime: row.mime_type },
    { inline: sp.get('inline') === '1', cache: 'private, max-age=600' }
  )
}

export async function GET(req: NextRequest) {
  try {
    return await handleGET(req)
  } catch (err) {
    return serverError(err, 'GET /api/private/leonie/shares/file')
  }
}