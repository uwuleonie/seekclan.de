import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

async function getMinecraftAccount(token: string | undefined) {
  if (!token) return null
  const { data: session } = await supabaseAdmin
    .from('sessions')
    .select('user_id, expires_at')
    .eq('token', token)
    .single()
  if (!session || new Date(session.expires_at) < new Date()) return null

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('minecraft_uuid, minecraft_username')
    .eq('id', session.user_id)
    .single()
  return user ? { uuid: user.minecraft_uuid as string | null, username: user.minecraft_username as string | null } : null
}

// Body: { name: string }
// Erstellt eine neue, leere, manuelle Gruppe (is_auto = false).
export async function POST(req: NextRequest) {
  const account = await getMinecraftAccount(req.cookies.get('session_token')?.value)
  if (!account?.uuid) return NextResponse.json({ error: 'Nicht eingeloggt oder kein Minecraft-Account verknüpft' }, { status: 401 })

  const body = await req.json()
  const { name } = body
  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Name erforderlich' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('claim_groups')
    .insert({
      owner_uuid: account.uuid,
      owner_name: account.username,
      name: name.trim(),
      is_auto: false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, group: data })
}