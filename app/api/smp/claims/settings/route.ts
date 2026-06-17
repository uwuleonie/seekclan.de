import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

export async function POST(req: NextRequest) {
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

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('minecraft_uuid, minecraft_username')
    .eq('id', session.user_id)
    .single()

  if (!user?.minecraft_uuid) {
    return NextResponse.json({ error: 'Kein Minecraft-Account verknüpft' }, { status: 400 })
  }

  const body = await req.json()
  const update: Record<string, any> = {
    uuid: user.minecraft_uuid,
    player_name: user.minecraft_username,
  }

  const allowed = ['sound_enabled', 'public_build', 'public_break', 'public_containers', 'public_doors', 'public_mobs', 'public_redstone']
  for (const key of allowed) {
    if (key in body) update[key] = !!body[key]
  }

  const { error } = await supabaseAdmin
    .from('claim_settings')
    .upsert(update, { onConflict: 'uuid' })

  if (error) return NextResponse.json({ error: 'Speichern fehlgeschlagen' }, { status: 500 })

  return NextResponse.json({ success: true })
}