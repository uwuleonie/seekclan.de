import { NextRequest, NextResponse } from 'next/server'
import { createReadStream, promises as fs, type ReadStream } from 'fs'
import { pool } from '@/app/lib/db'
import { getPrivateUser } from '@/app/lib/private-auth'
import { contentDisposition, filePath, isSafeInline } from '@/app/lib/private-storage'
import { forbidden, notFound, parseId } from '../../_shared'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Node-Dateistream → Web-Stream, mit sauberem Abbruch.
 * (Readable.toWeb() wirft "Controller is already closed", wenn der Browser mitten im
 * Video-Laden abbricht — das passiert bei Videos ständig und würde den Prozess stören.)
 */
function toWebStream(stream: ReadStream): ReadableStream<Uint8Array> {
  let closed = false
  return new ReadableStream<Uint8Array>({
    start(controller) {
      stream.on('data', chunk => {
        if (closed) return
        controller.enqueue(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : new Uint8Array(chunk))
        if ((controller.desiredSize ?? 1) <= 0) stream.pause()
      })
      stream.on('end', () => { if (!closed) { closed = true; controller.close() } })
      stream.on('error', err => { if (!closed) { closed = true; controller.error(err) } })
    },
    pull() { stream.resume() },
    cancel() { closed = true; stream.destroy() },
  })
}

// GET /api/private/files/[id]/download          → als Download
// GET /api/private/files/[id]/download?inline=1 → im Browser anzeigen (nur sichere Typen)
//
// Unterstützt "Range"-Anfragen: Videos lassen sich dadurch vorspulen und iPhones
// spielen Videos überhaupt erst ab, wenn der Server Range beherrscht.
// Die Datei wird gestreamt — auch mehrere GB belegen kaum Arbeitsspeicher.
export async function GET(req: NextRequest, { params }: Ctx) {
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

  const p = filePath(user.id, row.storage_key)
  let size: number
  try {
    size = (await fs.stat(p)).size
  } catch {
    return notFound()
  }

  const wantsInline = req.nextUrl.searchParams.get('inline') === '1'
  const inline = wantsInline && isSafeInline(row.mime_type)

  const headers = new Headers({
    'Content-Type': inline ? row.mime_type : row.mime_type || 'application/octet-stream',
    'Content-Disposition': contentDisposition(inline ? 'inline' : 'attachment', row.original_name),
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  })
  // Alles außer PDF zusätzlich in eine Sandbox stecken (PDF-Viewer von Chrome verträgt das nicht)
  if (row.mime_type !== 'application/pdf') headers.set('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'")

  let start = 0
  let end = size - 1
  let status = 200

  const range = req.headers.get('range')
  if (range && size > 0) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim())
    if (m) {
      if (m[1] === '' && m[2] !== '') {
        // "bytes=-500" = die letzten 500 Bytes
        start = Math.max(0, size - Number(m[2]))
      } else {
        start = Number(m[1])
        if (m[2] !== '') end = Math.min(Number(m[2]), size - 1)
      }
      if (start > end || start >= size) {
        return new NextResponse(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
      }
      status = 206
      headers.set('Content-Range', `bytes ${start}-${end}/${size}`)
    }
  }

  headers.set('Content-Length', String(size === 0 ? 0 : end - start + 1))
  if (size === 0) return new NextResponse(null, { status: 200, headers })

  const stream = createReadStream(p, { start, end, highWaterMark: 1024 * 1024 })
  // Browser bricht ab (z.B. Video geschlossen) → Datei-Handle sofort freigeben
  req.signal.addEventListener('abort', () => stream.destroy())

  return new NextResponse(toWebStream(stream), { status, headers })
}