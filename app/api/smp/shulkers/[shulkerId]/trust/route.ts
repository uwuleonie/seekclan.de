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

// Body: { targetUuid: string, targetName: string, permission: 'OPEN' | 'BREAK', trusted: boolean }
export async function POST(req: NextRequest, { params }: { params: Promise<{ shulkerId: string }> }) {
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
  const { targetUuid, targetName, permission, trusted } = body

  if (permission !== 'OPEN' && permission !== 'BREAK') {
    return NextResponse.json({ error: 'Ungültige Permission' }, { status: 400 })
  }
  if (!targetUuid) {
    return NextResponse.json({ error: 'targetUuid erforderlich' }, { status: 400 })
  }

  // Bestehenden Eintrag für diese exakte Kombination immer erst löschen
  await supabaseAdmin
    .from('shulker_trusts')
    .delete()
    .eq('owner_uuid', ownerUuid)
    .eq('scope', 'shulker')
    .eq('shulker_id', shulkerId)
    .eq('trusted_uuid', targetUuid)
    .eq('permission', permission)

  if (!trusted) {
    return NextResponse.json({ success: true, deleted: true })
  }

  const { error } = await supabaseAdmin.from('shulker_trusts').insert({
    owner_uuid: ownerUuid,
    trusted_uuid: targetUuid,
    trusted_name: targetName,
    scope: 'shulker',
    shulker_id: Number(shulkerId),
    permission,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}