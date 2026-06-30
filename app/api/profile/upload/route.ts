import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getIP, rateLimitResponse } from '@/app/lib/rate-limit'
import { checkOrigin, csrfError } from '@/app/lib/csrf'
import { saveFile, getPublicUrl } from '@/app/lib/local-storage'
import { pool } from '@/app/lib/db'

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const MAX_BYTES = 8 * 1024 * 1024 // 8 MB

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
  const kind = (formData.get('kind') as string) || 'media' // avatar | banner | background

  if (!file) return NextResponse.json({ error: 'Keine Datei' }, { status: 400 })
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: 'Nur PNG, JPG, WEBP oder GIF erlaubt' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Datei zu groß (max. 8 MB)' }, { status: 400 })
  }

  const ext = file.name.includes('.') ? file.name.split('.').pop()!.replace(/[^a-zA-Z0-9]/g, '') : 'png'
  const fileName = `${session.user_id}/${kind}_${Date.now()}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  try {
    await saveFile('profile-media', fileName, buffer)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Upload fehlgeschlagen' }, { status: 500 })
  }

  const url = getPublicUrl('profile-media', fileName)
  return NextResponse.json({ url })
}