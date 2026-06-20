import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

async function getMinecraftUuid(token: string | undefined) {
  if (!token) return null
  const { data: session } = await supabaseAdmin
    .from('sessions')
    .select('user_id, expires_at')
    .eq('token', token)
    .single()
  if (!session || new Date(session.expires_at) < new Date()) return null

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('minecraft_uuid')
    .eq('id', session.user_id)
    .single()
  return user?.minecraft_uuid as string | null
}

// Body: { name: string }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ shulkerId: string }> }) {
  const { shulkerId } = await params
  const ownerUuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!ownerUuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { data: shulker } = await supabaseAdmin
    .from('shulkers')
    .select('id, owner_uuid')
    .eq('id', shulkerId)
    .single()
  if (!shulker || shulker.owner_uuid !== ownerUuid) {
    return NextResponse.json({ error: 'Shulker nicht gefunden oder gehört dir nicht' }, { status: 404 })
  }

  const body = await req.json()
  const { name } = body
  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Name erforderlich' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('shulkers')
    .update({ name: name.trim() })
    .eq('id', shulkerId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}