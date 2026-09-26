import { NextRequest, NextResponse } from 'next/server'
import { createWriteStream, promises as fs } from 'fs'
import { Readable, Transform } from 'stream'
import { pipeline } from 'stream/promises'
import { pool } from '@/app/lib/db'
import { checkOrigin } from '@/app/lib/csrf'
import { getPrivateUser } from '@/app/lib/private-auth'
import { MAX_CHUNK_BYTES, currentSize, filePath } from '@/app/lib/private-storage'
import { badRequest, forbidden, notFound, parseId, serverError } from '../../_shared'

type Ctx = { params: Promise<{ id: string }> }

// PUT /api/private/files/[id]/chunk?offset=<byte>
// Body: rohe Bytes eines Teilstücks (application/octet-stream).
//
// Warum Teilstücke? So gibt es praktisch kein Größenlimit: Jede einzelne Anfrage ist
// nur ~8 MB groß (passt durch jeden Proxy), der Server schreibt sie direkt auf die Platte
// (nichts landet komplett im Arbeitsspeicher) und bei Funkloch am Handy geht der Upload
// an der letzten bestätigten Stelle weiter statt von vorn.
async function handlePUT(req: NextRequest, { params }: Ctx) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  const user = await getPrivateUser(req)
  if (!user) return forbidden()
  const id = parseId((await params).id)
  if (!id) return notFound()

  const offset = Number(req.nextUrl.searchParams.get('offset'))
  if (!Number.isSafeInteger(offset) || offset < 0) return badRequest('Ungültiger Offset')

  const r = await pool.query(
    `SELECT storage_key, size_bytes, status FROM private_files WHERE id = $1 AND user_id = $2`,
    [id, user.id]
  )
  const row = r.rows[0]
  if (!row) return notFound()
  if (row.status !== 'uploading') return badRequest('Upload ist bereits abgeschlossen')
  if (!req.body) return badRequest('Kein Inhalt')

  const target = filePath(user.id, row.storage_key)
  const have = await currentSize(target)

  // Client ist weiter als der Server → er soll ab unserem Stand weitermachen
  if (offset > have) return NextResponse.json({ error: 'Offset passt nicht', received: have }, { status: 409 })
  // Client wiederholt ein Teilstück (z.B. nach Abbruch) → alten Rest abschneiden
  if (offset < have) await fs.truncate(target, offset)

  let written = 0
  const limit = Math.min(MAX_CHUNK_BYTES, row.size_bytes - offset)
  const guard = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      written += chunk.length
      if (written > limit) cb(new Error('Teilstück zu groß'))
      else cb(null, chunk)
    },
  })

  try {
    await pipeline(
      Readable.fromWeb(req.body as unknown as import('stream/web').ReadableStream<Uint8Array>),
      guard,
      createWriteStream(target, { flags: 'a' })
    )
  } catch (err) {
    // Halbes Teilstück wieder entfernen, damit die Datei sauber bleibt
    await fs.truncate(target, offset).catch(() => {})
    const msg = (err as Error)?.message === 'Teilstück zu groß' ? 'Teilstück zu groß' : 'Übertragung abgebrochen'
    return NextResponse.json({ error: msg, received: offset }, { status: 400 })
  }

  await pool.query('UPDATE private_files SET updated_at = NOW() WHERE id = $1', [id])
  return NextResponse.json({ received: offset + written })
}


export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    return await handlePUT(req, ctx)
  } catch (err) {
    return serverError(err, 'PUT /api/private/files/[id]/chunk')
  }
}