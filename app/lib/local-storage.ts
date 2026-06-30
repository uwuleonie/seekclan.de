import { promises as fs } from 'fs'
import path from 'path'

// Zentrale Datei-Speicherung auf dem eigenen Hetzner-Server.
// Ersetzt Supabase Storage (Buckets: badge-icons, site-content, profile-media, chat-media),
// nachdem Supabase mit "402 Payment Required" den Storage-Zugriff blockiert hat.
//
// Alle Dateien landen unter /vm_hdd/uploads/<bucket>/<dateiname>.
// Ausgeliefert werden sie über die eigene Route app/api/uploads/[bucket]/[...filename]/route.ts,
// NICHT über den Next.js public/-Ordner (der wird beim Build eingefroren und ist für
// zur Laufzeit hochgeladene Dateien ungeeignet).
//
// "bucket" entspricht dem alten Supabase-Bucket-Namen, "site-content" wird dabei intern
// weiter in die Unterordner changelog/ und showcase/ aufgeteilt, genau wie vorher.

function uploadRoot(): string {
  // turbopackIgnore verhindert, dass der Next.js-Build-Tracer beim Build versucht,
  // diesen Pfad statisch aufzulösen und dabei (weil er dynamisch aus process.env kommt)
  // versehentlich das gesamte Dateisystem mit-tracet. Rein zur Build-Zeit relevant,
  // hat keinen Effekt auf das Laufzeitverhalten.
  return process.env.UPLOAD_ROOT || /* turbopackIgnore: true */ '/vm_hdd/uploads'
}

const UPLOAD_ROOT = uploadRoot()

export type Bucket = 'badge-icons' | 'site-content' | 'profile-media' | 'chat-media'

// Erlaubte Bucket-Namen streng prüfen, damit niemand über den bucket-Parameter
// aus dem Upload-Ordner ausbrechen kann.
const ALLOWED_BUCKETS: Bucket[] = ['badge-icons', 'site-content', 'profile-media', 'chat-media']

function assertSafeRelativePath(relativePath: string) {
  // Verhindert Path-Traversal (../../etc/passwd) und absolute Pfade.
  const normalized = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, '')
  if (normalized.includes('..') || path.isAbsolute(normalized)) {
    throw new Error('Ungültiger Dateipfad')
  }
  return normalized
}

/**
 * Speichert eine Datei lokal unter UPLOAD_ROOT/<bucket>/<relativePath>.
 * relativePath darf Unterordner enthalten (z.B. "userId/avatar_123.png"),
 * diese werden automatisch angelegt — genau wie es Supabase Storage auch gemacht hat.
 */
export async function saveFile(bucket: Bucket, relativePath: string, buffer: Buffer): Promise<{ path: string }> {
  if (!ALLOWED_BUCKETS.includes(bucket)) throw new Error(`Unbekannter Bucket: ${bucket}`)

  const safePath = assertSafeRelativePath(relativePath)
  const fullPath = path.join(/* turbopackIgnore: true */ UPLOAD_ROOT, bucket, safePath)
  const dir = path.dirname(fullPath)

  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(fullPath, buffer)

  return { path: safePath }
}

/**
 * Löscht eine Datei. Wirft absichtlich keinen Fehler, wenn die Datei nicht existiert
 * (gleiches Verhalten wie supabaseAdmin.storage.remove() vorher — "best effort").
 */
export async function deleteFile(bucket: Bucket, relativePath: string): Promise<void> {
  if (!ALLOWED_BUCKETS.includes(bucket)) return

  const safePath = assertSafeRelativePath(relativePath)
  const fullPath = path.join(/* turbopackIgnore: true */ UPLOAD_ROOT, bucket, safePath)

  try {
    await fs.unlink(fullPath)
  } catch (err: any) {
    if (err?.code !== 'ENOENT') console.error('Fehler beim Löschen von', fullPath, err)
  }
}

/**
 * Liest eine Datei und gibt Inhalt + Content-Type zurück.
 * Wird von der Auslieferungs-Route app/api/uploads/[bucket]/[...filename]/route.ts genutzt.
 */
export async function readFile(bucket: string, relativePath: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (!ALLOWED_BUCKETS.includes(bucket as Bucket)) return null

  let safePath: string
  try {
    safePath = assertSafeRelativePath(relativePath)
  } catch {
    return null
  }

  const fullPath = path.join(/* turbopackIgnore: true */ UPLOAD_ROOT, bucket, safePath)

  try {
    const buffer = await fs.readFile(fullPath)
    return { buffer, contentType: getContentType(fullPath) }
  } catch {
    return null
  }
}

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case '.png': return 'image/png'
    case '.jpg':
    case '.jpeg': return 'image/jpeg'
    case '.webp': return 'image/webp'
    case '.gif': return 'image/gif'
    case '.svg': return 'image/svg+xml'
    default: return 'application/octet-stream'
  }
}

/**
 * Baut die öffentliche URL für eine gespeicherte Datei (analog zu Supabase's getPublicUrl()).
 * NEXT_PUBLIC_SITE_URL wird optional gesetzt; ohne sie wird eine relative URL erzeugt,
 * was im Browser ebenfalls korrekt funktioniert.
 */
export function getPublicUrl(bucket: Bucket, relativePath: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || ''
  // encodeURIComponent NICHT auf den ganzen Pfad anwenden (würde "/" mit-escapen),
  // sondern pro Segment, damit Unterordner wie "userId/avatar.png" erhalten bleiben.
  const encodedPath = relativePath.split('/').map(encodeURIComponent).join('/')
  return `${base}/api/uploads/${bucket}/${encodedPath}`
}   