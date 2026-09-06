import { NextRequest, NextResponse } from 'next/server'
import { saveFile, getPublicUrl } from '@/app/lib/local-storage'
import { pool } from '@/app/lib/db'

const MAX_BYTES = 20 * 1024 * 1024 // 20 MB (upscaled 4K can be large)

export async function POST(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  // Only owner/admin
  const sessionResult = await pool.query(
    `SELECT u.clan_role FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token]
  )
  const session = sessionResult.rows[0]
  if (!session || !['administrator', 'owner'].includes(session.clan_role)) {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const tool = (formData.get('tool') as string) || 'unknown'

  if (!file) return NextResponse.json({ error: 'Keine Datei' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Datei zu groß (max. 20 MB)' }, { status: 400 })

  const ext = file.type === 'image/png' ? 'png' : 'jpg'
  const filename = `leonie-images/${tool}_${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    await saveFile('profile-media', filename, buffer)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Speichern fehlgeschlagen' }, { status: 500 })
  }

  const url = getPublicUrl('profile-media', filename)

  await pool.query(
    `INSERT INTO leonie_images (tool, filename, url) VALUES ($1, $2, $3)`,
    [tool, filename, url]
  )

  return NextResponse.json({ url })
}