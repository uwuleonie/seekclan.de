import { NextRequest } from 'next/server'
import { pool } from '@/app/lib/db'
import { saveFile } from '@/app/lib/local-storage'

// Gemeinsame Helfer für die Startseiten-Kacheln (/api/admin2/home-tiles)

// Bild-Adresse OHNE Domain (/api/uploads/...), damit sie auf jeder Domain funktioniert:
// seekclan.de, www.seekclan.de und localhost beim Testen.
export function uploadPath(bucket: string, relativePath: string): string {
  return `/api/uploads/${bucket}/${relativePath.split('/').map(encodeURIComponent).join('/')}`
}

export async function checkRead(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const s = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  if (!s.rows[0]) return null
  const u = await pool.query('SELECT id, username, clan_role FROM users WHERE id = $1', [s.rows[0].user_id])
  const user = u.rows[0]
  if (!user || !['administrator', 'owner', 'teammitglied'].includes(user.clan_role)) return null
  return user
}

export async function checkWrite(req: NextRequest) {
  const user = await checkRead(req)
  if (!user || (user.clan_role !== 'administrator' && user.clan_role !== 'owner')) return null
  return user
}

export const ICON_PATTERN = /^[a-z0-9_]{1,60}$/
export const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

// Link: interne Seite (/…) oder https-Adresse
export function cleanHref(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : ''
  if (/^\/(?!\/)[^\s]*$/.test(s)) return s.slice(0, 300)
  if (/^https:\/\/[^\s]+$/i.test(s)) return s.slice(0, 500)
  return null
}

export function rowToTile(x: Record<string, unknown>) {
  return {
    id: Number(x.id),
    title: x.title,
    description: x.description || '',
    href: x.href,
    icon: x.icon || null,
    image: x.image_filename ? uploadPath('site-content', `home-tiles/${x.image_filename}`) : null,
    position: x.position,
    active: x.active,
  }
}

export async function storeImage(file: File, folder: 'home-tiles' | 'home-servers' | 'site-events' = 'home-tiles'): Promise<string> {
  const ext = IMAGE_TYPES[file.type]
  if (!ext) throw new Error('Nur JPG, PNG oder WebP erlaubt')
  if (file.size > 5 * 1024 * 1024) throw new Error('Bild zu groß (max. 5 MB)')
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  await saveFile('site-content', `${folder}/${filename}`, Buffer.from(await file.arrayBuffer()))
  return filename
}

// ── Weitere Server-Adressen (klappen auf der Startseite unter seekclan.de auf) ──

// Server-Adresse: Domain oder IP, optional mit Port (z. B. modpack.seekclan.de oder play.example.net:25566)
export function cleanAddress(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : ''
  if (s.length < 3 || s.length > 100) return null
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:\d{1,5})?$/.test(s) ? s : null
}

export function rowToServer(x: Record<string, unknown>) {
  return {
    id: Number(x.id),
    address: x.address,
    name: x.name,
    description: x.description || '',
    version: x.version || '',
    icon: x.icon || null,
    image: x.image_filename ? uploadPath('site-content', `home-servers/${x.image_filename}`) : null,
    position: x.position,
    active: x.active,
  }
}