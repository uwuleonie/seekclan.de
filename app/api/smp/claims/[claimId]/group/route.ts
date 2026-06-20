import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'
import { isGroupLockedByTransfer } from '@/app/lib/claim-transfer-lock'

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

// Body: { groupId: number | null }
// groupId = null bedeutet: Claim aus seiner aktuellen Gruppe entfernen (wieder einzeln).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  const { claimId } = await params
  const ownerUuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!ownerUuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { data: claim } = await supabaseAdmin
    .from('claims')
    .select('id, owner_uuid, group_id')
    .eq('id', claimId)
    .single()
  if (!claim || claim.owner_uuid !== ownerUuid) {
    return NextResponse.json({ error: 'Claim nicht gefunden oder gehört dir nicht' }, { status: 404 })
  }

  if (claim.group_id && await isGroupLockedByTransfer(claim.group_id)) {
    return NextResponse.json({ error: 'Die aktuelle Gruppe dieses Claims wird gerade übertragen und ist gesperrt' }, { status: 423 })
  }

  const body = await req.json()
  const { groupId } = body

  if (groupId !== null) {
    if (await isGroupLockedByTransfer(groupId)) {
      return NextResponse.json({ error: 'Die Zielgruppe wird gerade übertragen und ist gesperrt' }, { status: 423 })
    }
    const { data: group } = await supabaseAdmin
      .from('claim_groups')
      .select('id, owner_uuid')
      .eq('id', groupId)
      .single()
    if (!group || group.owner_uuid !== ownerUuid) {
      return NextResponse.json({ error: 'Gruppe nicht gefunden oder gehört dir nicht' }, { status: 404 })
    }
  }

  const { error } = await supabaseAdmin
    .from('claims')
    .update({ group_id: groupId })
    .eq('id', claimId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}