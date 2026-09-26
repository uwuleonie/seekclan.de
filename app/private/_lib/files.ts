// Typen und Helfer für Quick Share (nur Frontend)

export type FileKind = 'image' | 'video' | 'audio' | 'pdf' | 'document' | 'archive' | 'other'

export interface PFile {
  id: number
  folder_id: number | null
  original_name: string
  mime_type: string
  size_bytes: number
  kind: FileKind
  has_thumb: boolean
  width: number | null
  height: number | null
  source_device: string | null
  device_id: string | null
  seen_at: string | null
  created_at: string
  completed_at: string | null
  updated_at: string
}

export interface PFolder {
  id: number
  name: string
  created_at: string
  file_count: number
}

export interface PStorage {
  used: number
  free: number | null
  total: number | null
}

export const KIND_LABEL: Record<FileKind | 'all', string> = {
  all: 'Alle',
  image: 'Bilder',
  video: 'Videos',
  audio: 'Audio',
  pdf: 'PDFs',
  document: 'Dokumente',
  archive: 'Archive',
  other: 'Sonstiges',
}

export const KIND_ICON: Record<FileKind, string> = {
  image: 'image',
  video: 'video',
  audio: 'audio',
  pdf: 'pdf',
  document: 'notes',
  archive: 'archive',
  other: 'file',
}

export const fileUrl = (id: number, inline = false) =>
  `/api/private/files/${id}/download${inline ? '?inline=1' : ''}`
export const thumbUrl = (id: number) => `/api/private/files/${id}/thumb`

export function formatBytes(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '–'
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toLocaleString('de-DE', { maximumFractionDigits: v < 10 ? 1 : 0 })} ${units[i]}`
}

export function formatWhen(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = (now.getTime() - d.getTime()) / 1000
  if (diff < 60) return 'gerade eben'
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min.`
  const sameDay = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  if (sameDay) return `heute, ${time}`
  const y = new Date(now); y.setDate(now.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return `gestern, ${time}`
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) + `, ${time}`
}

export function dayGroup(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return 'Heute'
  const y = new Date(now); y.setDate(now.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return 'Gestern'
  const days = (now.getTime() - d.getTime()) / 86400000
  if (days < 7) return 'Diese Woche'
  return d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
}

export function extOf(name: string): string {
  const m = /\.([a-z0-9]{1,6})$/i.exec(name)
  return m ? m[1].toUpperCase() : ''
}

export function formatSpeed(bps: number): string {
  if (!bps || !Number.isFinite(bps)) return ''
  return `${formatBytes(bps)}/s`
}

export function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return ''
  if (seconds < 60) return `noch ${Math.ceil(seconds)} s`
  if (seconds < 3600) return `noch ${Math.ceil(seconds / 60)} Min.`
  return `noch ${(seconds / 3600).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Std.`
}

/** Startet einen Download über einen unsichtbaren Link (funktioniert auch auf dem Handy). */
export function triggerDownload(id: number, name: string) {
  const a = document.createElement('a')
  a.href = fileUrl(id)
  a.download = name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** Kann dieses Gerät Dateien an das System-Teilen-Menü übergeben (z.B. "In Fotos sichern")? */
export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || !navigator.canShare) return false
  try {
    return navigator.canShare({ files: [new File([''], 'x.jpg', { type: 'image/jpeg' })] })
  } catch {
    return false
  }
}

/** Grenze für "In Fotos sichern" — die Datei muss dafür komplett in den Arbeitsspeicher. */
export const SHARE_MAX_BYTES = 250 * 1024 * 1024