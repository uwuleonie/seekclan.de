import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { saveFile, deleteFile, getPublicUrl } from '@/app/lib/local-storage'

async function checkRead(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT id, username, clan_role FROM users WHERE id = $1', [session.user_id])
  const user = userResult.rows[0]
  if (!user || !['administrator', 'owner', 'teammitglied'].includes(user.clan_role)) return null
  return user
}

async function checkWrite(req: NextRequest) {
  const user = await checkRead(req)
  if (!user || (user.clan_role !== 'administrator' && user.clan_role !== 'owner')) return null
  return user
}

// GET /api/admin2/showcase
export async function GET(req: NextRequest) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  try {
    const result = await pool.query(
      'SELECT id, filename, caption, position FROM showcase_images ORDER BY position ASC'
    )
    const images = result.rows.map(row => ({
      ...row,
      url: getPublicUrl('site-content', `showcase/${row.filename}`),
    }))
    return NextResponse.json({ images })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/admin2/showcase
// FormData: file, caption?
export async function POST(req: NextRequest) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const formData = await req.formData().catch(() => null)
  if (!formData) return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })

  const file = formData.get('file') as File | null
  const caption = formData.get('caption') as string | null

  if (!file) return NextResponse.json({ error: 'Datei erforderlich' }, { status: 400 })
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return NextResponse.json({ error: 'Nur JPG, PNG oder WebP erlaubt' }, { status: 400 })
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Datei zu groß (max. 5 MB)' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    await saveFile('site-content', `showcase/${filename}`, buffer)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Upload fehlgeschlagen' }, { status: 500 })
  }

  const maxRowResult = await pool.query('SELECT position FROM showcase_images ORDER BY position DESC LIMIT 1')
  const nextPosition = (maxRowResult.rows[0]?.position ?? -1) + 1

  try {
    const result = await pool.query(
      'INSERT INTO showcase_images (filename, caption, position) VALUES ($1, $2, $3) RETURNING id, filename, caption, position',
      [filename, caption?.trim() || null, nextPosition]
    )
    const url = getPublicUrl('site-content', `showcase/${filename}`)
    return NextResponse.json({ success: true, image: { ...result.rows[0], url } })
  } catch (err: any) {
    await deleteFile('site-content', `showcase/${filename}`)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}