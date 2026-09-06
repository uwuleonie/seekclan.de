import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getIP, rateLimitResponse } from '@/app/lib/rate-limit'
import { checkOrigin, csrfError } from '@/app/lib/csrf'
import { saveFile } from '@/app/lib/local-storage'
import { pool } from '@/app/lib/db'

const ALLOWED_IMAGE = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const ALLOWED_VIDEO = ['video/mp4']
const MAX_IMAGE_BYTES = 10 * 1024 * 1024  // 10 MB (Komprimierung passiert clientseitig)
const MAX_VIDEO_BYTES = 20 * 1024 * 1024  // 20 MB für MP4

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return csrfError()

  const ip = getIP(req)
  const limit = await checkRateLimit(ip, 'upload')
  if (!limit.allowed) return rateLimitResponse(limit)

  const token = req.cookies.get('session_token')?.value
  if (!token) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const sessionResult = await pool.query(
    'SELECT user_id, expires_at FROM sessions WHERE token = $1',
    [token]
  )
  const session = sessionResult.rows[0]
  if (!session || new Date(session.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Session abgelaufen' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const kind = (formData.get('kind') as string) || 'media'

  if (!file) return NextResponse.json({ error: 'Keine Datei' }, { status: 400 })

  const isVideo = ALLOWED_VIDEO.includes(file.type)
  const isImage = ALLOWED_IMAGE.includes(file.type)

  if (!isImage && !isVideo) {
    return NextResponse.json({ error: 'Erlaubt: JPG, PNG, WEBP, GIF, MP4' }, { status: 400 })
  }

  // MP4 nur für Banner und Hintergrund erlauben, nicht für Profilbild
  if (isVideo && kind === 'avatar') {
    return NextResponse.json({ error: 'MP4 nicht als Profilbild erlaubt' }, { status: 400 })
  }

  const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
  if (file.size > maxBytes) {
    return NextResponse.json({
      error: isVideo ? 'Video zu groß (max. 20 MB)' : 'Bild zu groß (max. 10 MB)'
    }, { status: 400 })
  }

  const ext = file.name.includes('.') ? file.name.split('.').pop()!.replace(/[^a-zA-Z0-9]/g, '') : (isVideo ? 'mp4' : 'png')
  const fileName = `${session.user_id}/${kind}_${Date.now()}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  try {
    await saveFile('profile-media', fileName, buffer)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Upload fehlgeschlagen' }, { status: 500 })
  }

  const url = `/api/uploads/profile-media/${fileName}`
  return NextResponse.json({ url })
}