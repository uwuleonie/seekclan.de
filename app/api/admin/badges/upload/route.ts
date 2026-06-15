import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

async function checkAdmin(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null

  const { data: session } = await supabaseAdmin
    .from('sessions')
    .select('user_id')
    .eq('token', token)
    .single()

  if (!session) return null

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('username, clan_role')
    .eq('id', session.user_id)
    .single()

  if (!user || user.clan_role !== 'admin') return null
  return user
}

export async function POST(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  if (!file) return NextResponse.json({ error: 'Keine Datei' }, { status: 400 })

  const fileName = `badge_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '')}`
  const arrayBuffer = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)

  const { error } = await supabaseAdmin.storage
    .from('badge-icons')
    .upload(fileName, buffer, {
      contentType: file.type,
      upsert: false,
    })

  if (error) return NextResponse.json({ error: 'Upload fehlgeschlagen' }, { status: 500 })

  const url = `https://lgvrborqklwfbkgbjnvs.supabase.co/storage/v1/object/public/badge-icons/${fileName}`
  return NextResponse.json({ url })
}