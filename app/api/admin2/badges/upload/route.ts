import { NextRequest, NextResponse } from 'next/server'
import { mitRecht } from '@/app/lib/rechte'
import { getPublicUrl, saveFile } from '@/app/lib/local-storage'

// /api/admin2/badges/upload – Bild für ein Abzeichen hochladen (Ordner badge-icons). Antwort: {url}

const ERLAUBT: Record<string, string> = { 'image/png': 'png', 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/gif': 'gif' }

export async function POST(req: NextRequest) {
  if (!(await mitRecht(req, 'clan.verwalten'))) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Keine Datei' }, { status: 400 })
  const ext = ERLAUBT[file.type]
  if (!ext) return NextResponse.json({ error: 'Nur PNG, WebP, JPG oder GIF' }, { status: 400 })
  if (file.size > 2 * 1024 * 1024) return NextResponse.json({ error: 'Höchstens 2 MB' }, { status: 400 })
  const name = `badge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
  await saveFile('badge-icons', name, Buffer.from(await file.arrayBuffer()))
  return NextResponse.json({ url: getPublicUrl('badge-icons', name) })
}
