import { promises as fs } from 'fs'
import path from 'path'

// Speicherort für Quick Share (privater Bereich).
//
// Liegt bewusst NICHT in einem der öffentlichen Buckets aus app/lib/local-storage.ts:
// Die Route /api/uploads/<bucket>/... liefert nur Buckets aus ALLOWED_BUCKETS aus,
// "private-files" steht dort nicht drin. Dateien hier sind also nur über die
// geschützten Routen unter /api/private/files/... erreichbar (Login + eigener Account).
//
// Aufbau auf der Platte:
//   <UPLOAD_ROOT>/private-files/<userId>/<storageKey>            ← die Datei selbst
//   <UPLOAD_ROOT>/private-files/<userId>/thumbs/<storageKey>.webp ← Vorschaubild (nur Bilder)

function uploadRoot(): string {
  return process.env.UPLOAD_ROOT || /* turbopackIgnore: true */ '/vm_hdd/uploads'
}

export const PRIVATE_ROOT = path.join(/* turbopackIgnore: true */ uploadRoot(), 'private-files')

/** Größe eines einzelnen Upload-Teilstücks. Klein genug für jeden Proxy (Caddy, Cloudflare). */
export const CHUNK_SIZE = 8 * 1024 * 1024
/** Obergrenze pro Teilstück auf dem Server (etwas Luft für abweichende Clients). */
export const MAX_CHUNK_BYTES = 16 * 1024 * 1024

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function safeSegment(value: string, what: string): string {
  if (!UUID_RE.test(value)) throw new Error(`Ungültige ${what}`)
  return value.toLowerCase()
}

export function userDir(userId: string): string {
  return path.join(/* turbopackIgnore: true */ PRIVATE_ROOT, safeSegment(userId, 'User-ID'))
}

export function filePath(userId: string, storageKey: string): string {
  return path.join(/* turbopackIgnore: true */ userDir(userId), safeSegment(storageKey, 'Datei-ID'))
}

export function thumbPath(userId: string, storageKey: string): string {
  return path.join(/* turbopackIgnore: true */ userDir(userId), 'thumbs', `${safeSegment(storageKey, 'Datei-ID')}.webp`)
}

export async function ensureUserDir(userId: string) {
  await fs.mkdir(path.join(/* turbopackIgnore: true */ userDir(userId), 'thumbs'), { recursive: true })
}

export async function currentSize(p: string): Promise<number> {
  try {
    return (await fs.stat(p)).size
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return 0
    throw err
  }
}

export async function removeStored(userId: string, storageKey: string) {
  for (const p of [filePath(userId, storageKey), thumbPath(userId, storageKey)]) {
    try {
      await fs.unlink(p)
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') console.error('Quick Share: Löschen fehlgeschlagen', p, err)
    }
  }
}

/* ── Dateiarten ─────────────────────────────────────────────────────────── */

export type FileKind = 'image' | 'video' | 'audio' | 'pdf' | 'document' | 'archive' | 'other'

const EXT_KIND: Record<string, FileKind> = {
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', avif: 'image',
  heic: 'image', heif: 'image', bmp: 'image', tif: 'image', tiff: 'image', svg: 'image', dng: 'image', raw: 'image',
  mp4: 'video', mov: 'video', m4v: 'video', webm: 'video', mkv: 'video', avi: 'video', '3gp': 'video',
  mp3: 'audio', m4a: 'audio', wav: 'audio', ogg: 'audio', opus: 'audio', flac: 'audio', aac: 'audio',
  pdf: 'pdf',
  doc: 'document', docx: 'document', odt: 'document', rtf: 'document', txt: 'document', md: 'document',
  xls: 'document', xlsx: 'document', ods: 'document', csv: 'document',
  ppt: 'document', pptx: 'document', odp: 'document', pages: 'document', numbers: 'document', key: 'document',
  json: 'document', xml: 'document', log: 'document',
  zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive', tgz: 'archive', bz2: 'archive', xz: 'archive',
  jar: 'archive', mcpack: 'archive', mcworld: 'archive', apk: 'archive',
}

const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif',
  heic: 'image/heic', heif: 'image/heif', bmp: 'image/bmp', tif: 'image/tiff', tiff: 'image/tiff', svg: 'image/svg+xml',
  mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/x-m4v', webm: 'video/webm', mkv: 'video/x-matroska',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', opus: 'audio/ogg', flac: 'audio/flac', aac: 'audio/aac',
  pdf: 'application/pdf', txt: 'text/plain', md: 'text/plain', csv: 'text/csv', log: 'text/plain', json: 'application/json',
  zip: 'application/zip', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

export function extensionOf(name: string): string {
  const m = /\.([a-z0-9]{1,10})$/i.exec(name)
  return m ? m[1].toLowerCase() : ''
}

export function detectKind(name: string, mime: string): FileKind {
  const ext = extensionOf(name)
  if (EXT_KIND[ext]) return EXT_KIND[ext]
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime === 'application/pdf') return 'pdf'
  if (mime.startsWith('text/')) return 'document'
  return 'other'
}

export function normalizeMime(name: string, mime: string | null | undefined): string {
  const m = (mime || '').trim().toLowerCase()
  if (m && m !== 'application/octet-stream' && /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(m)) return m
  return EXT_MIME[extensionOf(name)] || 'application/octet-stream'
}

/**
 * Nur diese Typen dürfen direkt im Browser angezeigt werden. Alles andere
 * (HTML, SVG, JS, …) wird immer als Download ausgeliefert, damit hochgeladene
 * Dateien niemals als Webseite unter seekclan.de laufen können.
 */
export function isSafeInline(mime: string): boolean {
  if (mime === 'image/svg+xml') return false
  return (
    /^image\/(jpeg|png|gif|webp|avif|bmp|heic|heif)$/.test(mime) ||
    mime.startsWith('video/') ||
    mime.startsWith('audio/') ||
    mime === 'application/pdf' ||
    mime === 'text/plain' ||
    mime === 'text/csv'
  )
}

/** Dateiname säubern (keine Pfade, keine Steuerzeichen), Länge begrenzen. */
export function cleanName(name: unknown): string {
  const raw = typeof name === 'string' ? name : ''
  const base = raw.split(/[\\/]/).pop()!.replace(/[\u0000-\u001f\u007f]/g, '').trim()
  const safe = base || 'Datei'
  if (safe.length <= 200) return safe
  const ext = extensionOf(safe)
  return ext ? `${safe.slice(0, 190)}.${ext}` : safe.slice(0, 200)
}

/** Content-Disposition mit Umlauten korrekt (RFC 5987). */
export function contentDisposition(type: 'inline' | 'attachment', name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`
}

/* ── Vorschaubilder ─────────────────────────────────────────────────────── */

/**
 * Erstellt ein kleines WebP-Vorschaubild. HEIC/RAW kann sharp je nach Server-Build
 * nicht lesen — dann gibt es eben kein Vorschaubild (Datei bleibt trotzdem voll nutzbar).
 */
export async function makeThumbnail(userId: string, storageKey: string): Promise<{ ok: boolean; width?: number; height?: number }> {
  try {
    const sharp = (await import('sharp')).default
    const src = filePath(userId, storageKey)
    const image = sharp(src, { failOn: 'none', limitInputPixels: 400_000_000 }).rotate()
    const meta = await image.metadata()
    await image
      .resize(480, 480, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 74 })
      .toFile(thumbPath(userId, storageKey))
    // Nach .rotate() sind Breite/Höhe bei Handyfotos evtl. vertauscht (EXIF-Orientation 5–8)
    const swap = (meta.orientation ?? 1) >= 5
    return { ok: true, width: swap ? meta.height : meta.width, height: swap ? meta.width : meta.height }
  } catch (err) {
    console.warn('Quick Share: kein Vorschaubild möglich für', storageKey, (err as Error)?.message)
    return { ok: false }
  }
}

/* ── Speicherplatz ──────────────────────────────────────────────────────── */

export async function diskInfo(): Promise<{ free: number | null; total: number | null }> {
  try {
    await fs.mkdir(PRIVATE_ROOT, { recursive: true })
    const s = await fs.statfs(PRIVATE_ROOT)
    return { free: s.bavail * s.bsize, total: s.blocks * s.bsize }
  } catch {
    return { free: null, total: null }
  }
}