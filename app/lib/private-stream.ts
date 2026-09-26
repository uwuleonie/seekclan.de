import { NextRequest, NextResponse } from 'next/server'
import { createReadStream, promises as fs, type ReadStream } from 'fs'
import { contentDisposition, filePath, isSafeInline, thumbPath } from '@/app/lib/private-storage'

// Gemeinsame Auslieferung von Quick-Share-Dateien.
// Wird genutzt von:
//  - /api/private/files/[id]/download   (eingeloggt, eigene Dateien)
//  - /api/private/files/[id]/thumb      (eingeloggt, Vorschaubild)
//  - /api/private/leonie/shares/file    (geteilter Notiz-Link, nur Anhänge dieser Notiz)

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

export interface StoredFile {
  userId: string
  storageKey: string
  name: string
  mime: string
}

/**
 * Datei streamen, mit Range-Unterstützung (Videos vorspulen, iPhone-Videos).
 * inline = im Browser anzeigen (nur bei sicheren Typen), sonst immer Download.
 */
export async function serveStoredFile(
  req: NextRequest,
  file: StoredFile,
  opts: { inline: boolean; cache?: string }
): Promise<NextResponse> {
  const p = filePath(file.userId, file.storageKey)
  let size: number
  try {
    size = (await fs.stat(p)).size
  } catch {
    return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  }

  const inline = opts.inline && isSafeInline(file.mime)
  const headers = new Headers({
    'Content-Type': file.mime || 'application/octet-stream',
    'Content-Disposition': contentDisposition(inline ? 'inline' : 'attachment', file.name),
    'Accept-Ranges': 'bytes',
    'Cache-Control': opts.cache ?? 'private, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  })
  // Alles außer PDF zusätzlich in eine Sandbox stecken (PDF-Viewer von Chrome verträgt das nicht)
  if (file.mime !== 'application/pdf') {
    headers.set('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'")
  }

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

/** Vorschaubild (WebP) ausliefern. */
export async function serveThumb(userId: string, storageKey: string, cache = 'private, max-age=604800, immutable') {
  try {
    const buf = await fs.readFile(thumbPath(userId, storageKey))
    return new NextResponse(new Uint8Array(buf), {
      headers: { 'Content-Type': 'image/webp', 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' },
    })
  } catch {
    return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  }
}