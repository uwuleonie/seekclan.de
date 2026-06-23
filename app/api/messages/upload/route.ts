import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getIP, rateLimitResponse } from '@/app/lib/rate-limit'
import { checkOrigin, csrfError } from '@/app/lib/csrf'
import { supabaseAdmin } from '@/app/lib/supabase'

const SUPABASE_URL = 'https://lgvrborqklwfbkgbjnvs.supabase.co/storage/v1/object/public/chat-media'

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const MAX_BYTES = 8 * 1024 * 1024 // 8 MB

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return csrfError()

  const ip = getIP(req)
  const limit = await checkRateLimit(ip, 'upload')
  if (!limit.allowed) return rateLimitResponse(limit)

  const token = req.cookies.get('session_token')?.value
  if (!token) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { data: session } = await supabaseAdmin
    .from('sessions')
    .select('user_id, expires_at')
    .eq('token', token)
    .single()

  if (!session || new Date(session.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Session abgelaufen' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const conversationId = formData.get('conversation_id') as string | null

  if (!file) return NextResponse.json({ error: 'Keine Datei' }, { status: 400 })
  if (!conversationId) return NextResponse.json({ error: 'conversation_id erforderlich' }, { status: 400 })

  // Nur Mitglieder der Konversation dürfen dort Bilder hochladen
  const { data: membership } = await supabaseAdmin
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', session.user_id)
    .maybeSingle()

  if (!membership) return NextResponse.json({ error: 'Kein Zugriff auf diese Konversation' }, { status: 403 })

  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: 'Nur PNG, JPG, WEBP oder GIF erlaubt' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Datei zu groß (max. 8 MB)' }, { status: 400 })
  }

  const ext = file.name.includes('.') ? file.name.split('.').pop()!.replace(/[^a-zA-Z0-9]/g, '') : 'png'
  const fileName = `${conversationId}/${session.user_id}_${Date.now()}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)

  const { error } = await supabaseAdmin.storage
    .from('chat-media')
    .upload(fileName, buffer, {
      contentType: file.type,
      upsert: false,
    })

  if (error) {
    console.error(error)
    return NextResponse.json({ error: 'Upload fehlgeschlagen' }, { status: 500 })
  }

  const url = `${SUPABASE_URL}/${fileName}`
  return NextResponse.json({ url })
}