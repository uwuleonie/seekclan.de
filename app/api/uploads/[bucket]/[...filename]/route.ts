import { NextRequest, NextResponse } from 'next/server'
import { readFile } from '@/app/lib/local-storage'

// Liefert Dateien aus, die über das neue lokale Storage-System gespeichert wurden
// (siehe app/lib/local-storage.ts). Ersetzt die öffentlichen Supabase-Storage-URLs.
//
// URL-Schema: /api/uploads/<bucket>/<dateiname-mit-evtl-unterordnern>
// z.B. /api/uploads/badge-icons/badge_123_poty.png
//      /api/uploads/profile-media/<userId>/avatar_123.png
//
// [...filename] ist ein "Catch-all"-Segment, damit auch Pfade mit Unterordnern
// (z.B. userId/avatar.png) in einer einzigen Route funktionieren.
//
// Unterstützt „Range“-Anfragen (Teilstücke einer Datei). Die braucht vor allem Safari auf
// iPhone/iPad, um Musik und Videos abzuspielen (z. B. die Halloween-Musik).

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bucket: string; filename: string[] }> }
) {
  const { bucket, filename } = await params
  const relativePath = filename.join('/')

  const file = await readFile(bucket, relativePath)
  if (!file) {
    return NextResponse.json({ error: 'Datei nicht gefunden' }, { status: 404 })
  }

  const size = file.buffer.length
  const baseHeaders = {
    'Content-Type': file.contentType,
    'Accept-Ranges': 'bytes',
    // Bilder ändern sich praktisch nie unter demselben Dateinamen (Zeitstempel im Namen),
    // daher aggressives Caching im Browser/CDN erlaubt.
    'Cache-Control': 'public, max-age=31536000, immutable',
  }

  const range = req.headers.get('range')
  const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null
  if (m && (m[1] || m[2])) {
    let start: number
    let end: number
    if (m[1]) {
      start = Number(m[1])
      end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1
    } else {
      // „bytes=-500“ = die letzten 500 Bytes
      start = Math.max(0, size - Number(m[2]))
      end = size - 1
    }
    if (start >= size || start > end) {
      return new NextResponse(null, { status: 416, headers: { ...baseHeaders, 'Content-Range': `bytes */${size}` } })
    }
    return new NextResponse(new Uint8Array(file.buffer.subarray(start, end + 1)), {
      status: 206,
      headers: { ...baseHeaders, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) },
    })
  }

  return new NextResponse(new Uint8Array(file.buffer), {
    status: 200,
    headers: { ...baseHeaders, 'Content-Length': String(size) },
  })
}