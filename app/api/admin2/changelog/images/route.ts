import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { saveFile, deleteFile, getPublicUrl } from '@/app/lib/local-storage'

async function checkWrite(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT id, clan_role FROM users WHERE id = $1', [session.user_id])
  const user = userResult.rows[0]
  if (!user || (user.clan_role !== 'administrator' && user.clan_role !== 'owner')) return null
  return user
}

// POST /api/admin2/changelog/images
// FormData: file, entry_id
export async function POST(req: NextRequest) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const formData = await req.formData().catch(() => null)
  if (!formData) return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })

  const file = formData.get('file') as File | null
  const entryId = formData.get('entry_id') as string | null

  if (!file) return NextResponse.json({ error: 'Datei erforderlich' }, { status: 400 })
  if (!entryId) return NextResponse.json({ error: 'entry_id erforderlich' }, { status: 400 })
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
    await saveFile('site-content', `changelog/${filename}`, buffer)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  const maxRowResult = await pool.query(
    'SELECT position FROM changelog_images WHERE entry_id = $1 ORDER BY position DESC LIMIT 1',
    [entryId]
  )
  const nextPosition = (maxRowResult.rows[0]?.position ?? -1) + 1

  try {
    const result = await pool.query(
      'INSERT INTO changelog_images (entry_id, filename, position) VALUES ($1, $2, $3) RETURNING id, filename, position',
      [Number(entryId), filename, nextPosition]
    )
    const url = getPublicUrl('site-content', `changelog/${filename}`)
    return NextResponse.json({ success: true, image: { ...result.rows[0], url } })
  } catch (err: any) {
    await deleteFile('site-content', `changelog/${filename}`)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/admin2/changelog/images
// Body: { id }
export async function DELETE(req: NextRequest) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id erforderlich' }, { status: 400 })

  const rowResult = await pool.query('SELECT filename FROM changelog_images WHERE id = $1', [id])
  const row = rowResult.rows[0]
  if (!row) return NextResponse.json({ error: 'Bild nicht gefunden' }, { status: 404 })

  await deleteFile('site-content', `changelog/${row.filename}`)
  await pool.query('DELETE FROM changelog_images WHERE id = $1', [id])

  return NextResponse.json({ success: true })
}