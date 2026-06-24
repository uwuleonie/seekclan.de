import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'
import { pool } from '@/app/lib/db'

async function checkStaff(req: NextRequest) {
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

export async function POST(req: NextRequest) {
  const staff = await checkStaff(req)
  if (!staff) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const formData = await req.formData()
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

  const { error: uploadError } = await supabaseAdmin.storage
    .from('site-content')
    .upload(`changelog/${filename}`, buffer, { contentType: file.type })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const maxRowResult = await pool.query(
    'SELECT position FROM changelog_images WHERE entry_id = $1 ORDER BY position DESC LIMIT 1',
    [entryId]
  )
  const maxRow = maxRowResult.rows[0]

  const nextPosition = (maxRow?.position ?? -1) + 1

  let inserted
  try {
    const result = await pool.query(
      'INSERT INTO changelog_images (entry_id, filename, position) VALUES ($1, $2, $3) RETURNING id, filename, position',
      [Number(entryId), filename, nextPosition]
    )
    inserted = result.rows[0]
  } catch (err: any) {
    await supabaseAdmin.storage.from('site-content').remove([`changelog/${filename}`])
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  const url = supabaseAdmin.storage.from('site-content').getPublicUrl(`changelog/${filename}`).data.publicUrl

  return NextResponse.json({ success: true, image: { ...inserted, url } })
}

export async function DELETE(req: NextRequest) {
  const staff = await checkStaff(req)
  if (!staff) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id erforderlich' }, { status: 400 })

  const rowResult = await pool.query('SELECT filename FROM changelog_images WHERE id = $1', [id])
  const row = rowResult.rows[0]

  if (!row) return NextResponse.json({ error: 'Bild nicht gefunden' }, { status: 404 })

  await supabaseAdmin.storage.from('site-content').remove([`changelog/${row.filename}`])
  await pool.query('DELETE FROM changelog_images WHERE id = $1', [id])

  return NextResponse.json({ success: true })
}