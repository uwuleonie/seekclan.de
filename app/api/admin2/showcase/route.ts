import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { saveFile, deleteFile, getPublicUrl } from '@/app/lib/local-storage'
import { mitRecht } from '@/app/lib/rechte'

async function checkRead(req: NextRequest) {
  return mitRecht(req, 'admin.zugang')
}

async function checkWrite(req: NextRequest) {
  return mitRecht(req, 'admin.verwalten')
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