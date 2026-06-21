import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

async function getStaffUser(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const { data: session } = await supabaseAdmin.from('sessions').select('user_id').eq('token', token).single()
  if (!session) return null
  const { data: user } = await supabaseAdmin.from('users').select('id, clan_role').eq('id', session.user_id).single()
  if (!user) return null
  const staff = user.clan_role?.toLowerCase() === 'admin' || user.clan_role?.toLowerCase() === 'mod'
  return staff ? user : null
}

// Liefert alle Showcase-Bilder, sortiert nach Position.
export async function GET() {
  const { data, error } = await supabaseAdmin.storage.from('site-content').list('showcase', {
    sortBy: { column: 'name', order: 'asc' },
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const images = (data || [])
    .filter(f => f.name !== '.emptyFolderPlaceholder')
    .map(f => ({
      name: f.name,
      url: supabaseAdmin.storage.from('site-content').getPublicUrl(`showcase/${f.name}`).data.publicUrl,
    }))

  return NextResponse.json({ images })
}

// Body: FormData mit "file" (Bild) und "caption" (Text)
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

  const { error: uploadError } = await supabaseAdmin.storage
    .from('site-content')
    .upload(`showcase/${filename}`, buffer, { contentType: file.type })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  // Caption als kleine Begleitdatei mit gleichem Namen speichern (einfacher als eine eigene DB-Tabelle)
  if (caption) {
    await supabaseAdmin.storage
      .from('site-content')
      .upload(`showcase/${filename}.caption.txt`, Buffer.from(caption, 'utf8'), { contentType: 'text/plain' })
  }

  const url = supabaseAdmin.storage.from('site-content').getPublicUrl(`showcase/${filename}`).data.publicUrl

  return NextResponse.json({ success: true, url, filename })
}

// Body: { filename: string }
export async function DELETE(req: NextRequest) {
  const staffUser = await getStaffUser(req)
  if (!staffUser) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const body = await req.json()
  const { filename } = body
  if (!filename) return NextResponse.json({ error: 'filename erforderlich' }, { status: 400 })

  await supabaseAdmin.storage.from('site-content').remove([`showcase/${filename}`, `showcase/${filename}.caption.txt`])

  return NextResponse.json({ success: true })
}