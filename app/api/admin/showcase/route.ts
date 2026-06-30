import { NextRequest, NextResponse } from 'next/server'
import { saveFile, deleteFile, getPublicUrl } from '@/app/lib/local-storage'
import { pool } from '@/app/lib/db'

async function getStaffUser(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT id, clan_role FROM users WHERE id = $1', [session.user_id])
  const user = userResult.rows[0]
  if (!user) return null
  const staff = user.clan_role?.toLowerCase() === 'admin' || user.clan_role?.toLowerCase() === 'mod'
  return staff ? user : null
}

export async function GET() {
  let data
  try {
    const result = await pool.query(
      'SELECT id, filename, caption, position FROM showcase_images ORDER BY position ASC'
    )
    data = result.rows
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  const images = (data || []).map(row => ({
    id: row.id,
    filename: row.filename,
    caption: row.caption,
    position: row.position,
    url: getPublicUrl('site-content', `showcase/${row.filename}`),
  }))

  return NextResponse.json({ images })
}

export async function POST(req: NextRequest) {
  const staffUser = await getStaffUser(req)
  if (!staffUser) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const formData = await req.formData()
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

  const maxRowResult = await pool.query(
    'SELECT position FROM showcase_images ORDER BY position DESC LIMIT 1'
  )
  const maxRow = maxRowResult.rows[0]

  const nextPosition = (maxRow?.position ?? -1) + 1

  let inserted
  try {
    const result = await pool.query(
      'INSERT INTO showcase_images (filename, caption, position) VALUES ($1, $2, $3) RETURNING id, filename, caption, position',
      [filename, caption?.trim() || null, nextPosition]
    )
    inserted = result.rows[0]
  } catch (err: any) {
    await deleteFile('site-content', `showcase/${filename}`)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  const url = getPublicUrl('site-content', `showcase/${filename}`)

  return NextResponse.json({ success: true, image: { ...inserted, url } })
}

export async function DELETE(req: NextRequest) {
  const staffUser = await getStaffUser(req)
  if (!staffUser) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const body = await req.json()
  const { id } = body
  if (!id) return NextResponse.json({ error: 'id erforderlich' }, { status: 400 })

  const rowResult = await pool.query('SELECT filename FROM showcase_images WHERE id = $1', [id])
  const row = rowResult.rows[0]

  if (!row) return NextResponse.json({ error: 'Bild nicht gefunden' }, { status: 404 })

  await deleteFile('site-content', `showcase/${row.filename}`)
  await pool.query('DELETE FROM showcase_images WHERE id = $1', [id])

  return NextResponse.json({ success: true })
}