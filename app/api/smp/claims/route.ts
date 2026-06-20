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
    .select('minecraft_uuid, minecraft_username')
    .eq('id', session.user_id)
    .single()
  return user ? { uuid: user.minecraft_uuid as string | null, username: user.minecraft_username as string | null } : null
}

// Liefert alle Claims des eingeloggten Spielers, inkl. Gruppen-Info.
export async function GET(req: NextRequest) {
  const account = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!account) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  if (!account.uuid) return NextResponse.json({ claims: [], groups: [], linked: false })

  const { data: claims, error: claimsError } = await supabaseAdmin
    .from('claims')
    .select('*')
    .eq('owner_uuid', account.uuid)
    .order('claimed_at', { ascending: false })

  if (claimsError) return NextResponse.json({ error: claimsError.message }, { status: 500 })

  const { data: groups, error: groupsError } = await supabaseAdmin
    .from('claim_groups')
    .select('*')
    .eq('owner_uuid', account.uuid)
    .order('created_at', { ascending: false })

  if (groupsError) return NextResponse.json({ error: groupsError.message }, { status: 500 })

  return NextResponse.json({
    claims: claims || [],
    groups: groups || [],
    linked: true,
    minecraft_uuid: account.uuid,
    minecraft_username: account.username,
  })
}