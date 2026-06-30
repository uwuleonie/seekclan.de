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

  return new NextResponse(new Uint8Array(file.buffer), {
    status: 200,
    headers: {
      'Content-Type': file.contentType,
      // Bilder ändern sich praktisch nie unter demselben Dateinamen (Zeitstempel im Namen),
      // daher aggressives Caching im Browser/CDN erlaubt.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}