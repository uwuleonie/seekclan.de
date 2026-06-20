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

// Unclaimt alle Chunks einer Gruppe auf einmal. Legt vorher einen Snapshot
// in claim_trash ab (48h wiederherstellbar), bevor die echten Zeilen gelöscht werden.
export async function POST(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params
  const ownerUuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!ownerUuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { data: group } = await supabaseAdmin
    .from('claim_groups')
    .select('id, owner_uuid, name')
    .eq('id', groupId)
    .single()
  if (!group || group.owner_uuid !== ownerUuid) {
    return NextResponse.json({ error: 'Gruppe nicht gefunden oder gehört dir nicht' }, { status: 404 })
  }

  if (await isGroupLockedByTransfer(groupId)) {
    return NextResponse.json({ error: 'Diese Gruppe wird gerade übertragen und ist gesperrt' }, { status: 423 })
  }

  const { data: claimsInGroup, error: claimsError } = await supabaseAdmin
    .from('claims')
    .select('*')
    .eq('group_id', groupId)
  if (claimsError) return NextResponse.json({ error: claimsError.message }, { status: 500 })
  if (!claimsInGroup || claimsInGroup.length === 0) {
    return NextResponse.json({ error: 'Gruppe enthält keine Chunks' }, { status: 400 })
  }

  const claimIds = claimsInGroup.map(c => c.id)

  const { data: permissions } = await supabaseAdmin
    .from('claim_permissions')
    .select('*')
    .or(`claim_id.in.(${claimIds.join(',')}),group_id.eq.${groupId}`)

  const { data: trusts } = await supabaseAdmin
    .from('claim_trusts')
    .select('*')
    .in('claim_id', claimIds)

  // Snapshot anlegen, bevor irgendetwas gelöscht wird
  const { error: trashError } = await supabaseAdmin.from('claim_trash').insert({
    owner_uuid: ownerUuid,
    group_name: group.name,
    claims_snapshot: claimsInGroup,
    permissions_snapshot: permissions || [],
    trusts_snapshot: trusts || [],
  })
  if (trashError) return NextResponse.json({ error: trashError.message }, { status: 500 })

  // Jetzt löschen: erst abhängige Tabellen, dann Claims, dann die Gruppe selbst
  await supabaseAdmin.from('claim_permissions').delete().or(`claim_id.in.(${claimIds.join(',')}),group_id.eq.${groupId}`)
  await supabaseAdmin.from('claim_trusts').delete().in('claim_id', claimIds)
  await supabaseAdmin.from('claims').delete().in('id', claimIds)
  await supabaseAdmin.from('claim_groups').delete().eq('id', groupId)

  return NextResponse.json({ success: true, deletedCount: claimsInGroup.length })
}