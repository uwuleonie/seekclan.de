import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

async function checkStaff(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const { data: session } = await supabaseAdmin.from('sessions').select('user_id').eq('token', token).single()
  if (!session) return null
  const { data: user } = await supabaseAdmin.from('users').select('id, clan_role').eq('id', session.user_id).single()
  if (!user) return null
  const staff = user.clan_role?.toLowerCase() === 'admin' || user.clan_role?.toLowerCase() === 'mod'
  return staff ? user : null
}

// Body: FormData mit "file" (Bild) und "entry_id" (Zahl)
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

  const { data: maxRow } = await supabaseAdmin
    .from('changelog_images')
    .select('position')
    .eq('entry_id', entryId)
    .order('position', { ascending: false })
    .limit(1)
    .single()

  const nextPosition = (maxRow?.position ?? -1) + 1

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('changelog_images')
    .insert({ entry_id: Number(entryId), filename, position: nextPosition })
    .select('id, filename, position')
    .single()

  if (insertError) {
    await supabaseAdmin.storage.from('site-content').remove([`changelog/${filename}`])
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  const url = supabaseAdmin.storage.from('site-content').getPublicUrl(`changelog/${filename}`).data.publicUrl

  return NextResponse.json({ success: true, image: { ...inserted, url } })
}

// Body: { id: number }
export async function DELETE(req: NextRequest) {
  const staff = await checkStaff(req)
  if (!staff) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id erforderlich' }, { status: 400 })

  const { data: row } = await supabaseAdmin
    .from('changelog_images')
    .select('filename')
    .eq('id', id)
    .single()

  if (!row) return NextResponse.json({ error: 'Bild nicht gefunden' }, { status: 404 })

  await supabaseAdmin.storage.from('site-content').remove([`changelog/${row.filename}`])
  await supabaseAdmin.from('changelog_images').delete().eq('id', id)

  return NextResponse.json({ success: true })
}