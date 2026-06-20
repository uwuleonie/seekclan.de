import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'
import { isGroupLockedByTransfer } from '@/app/lib/claim-transfer-lock'

const VALID_PERMISSIONS = [
  'BLOCK_BREAK', 'BLOCK_PLACE', 'BUCKET_USE',
  'CONTAINER_OPEN', 'ITEM_PICKUP', 'ITEM_FRAME',
  'DOOR_USE', 'BUTTON_LEVER_USE', 'REDSTONE_USE', 'CROP_HARVEST', 'ANIMAL_INTERACT',
  'MOB_KILL', 'VEHICLE_USE', 'MOUNT_USE',
] as const

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

async function verifyOwnedGroup(groupId: string, ownerUuid: string) {
  const { data: group } = await supabaseAdmin
    .from('claim_groups')
    .select('id, owner_uuid')
    .eq('id', groupId)
    .single()
  if (!group || group.owner_uuid !== ownerUuid) return null
  return group
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params
  const ownerUuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!ownerUuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const group = await verifyOwnedGroup(groupId, ownerUuid)
  if (!group) return NextResponse.json({ error: 'Gruppe nicht gefunden oder gehört dir nicht' }, { status: 404 })

  const { data: rules, error } = await supabaseAdmin
    .from('claim_permissions')
    .select('*')
    .eq('group_id', groupId)
    .in('scope', ['group_all', 'group_player'])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ rules: rules || [] })
}
// Body: { name: string }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params
  const ownerUuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!ownerUuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const group = await verifyOwnedGroup(groupId, ownerUuid)
  if (!group) return NextResponse.json({ error: 'Gruppe nicht gefunden oder gehört dir nicht' }, { status: 404 })

  if (await isGroupLockedByTransfer(groupId)) {
    return NextResponse.json({ error: 'Diese Gruppe wird gerade übertragen und ist gesperrt' }, { status: 423 })
  }

  const body = await req.json()
  const { name } = body
  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Name erforderlich' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('claim_groups')
    .update({ name: name.trim() })
    .eq('id', groupId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
// Body: { scope: 'group_all' | 'group_player', targetUuid?: string, targetName?: string,
//         permission: string, allowed: boolean | null }
export async function POST(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params
  const ownerUuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!ownerUuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const group = await verifyOwnedGroup(groupId, ownerUuid)
  if (!group) return NextResponse.json({ error: 'Gruppe nicht gefunden oder gehört dir nicht' }, { status: 404 })

  if (await isGroupLockedByTransfer(groupId)) {
    return NextResponse.json({ error: 'Diese Gruppe wird gerade übertragen und ist gesperrt' }, { status: 423 })
  }

  const body = await req.json()
  const { scope, targetUuid, targetName, permission, allowed } = body

  if (scope !== 'group_all' && scope !== 'group_player') {
    return NextResponse.json({ error: 'Ungültiger scope' }, { status: 400 })
  }
  if (!VALID_PERMISSIONS.includes(permission)) {
    return NextResponse.json({ error: 'Ungültige Permission' }, { status: 400 })
  }
  if (scope === 'group_player' && !targetUuid) {
    return NextResponse.json({ error: 'targetUuid erforderlich für group_player' }, { status: 400 })
  }

  let deleteQuery = supabaseAdmin
    .from('claim_permissions')
    .delete()
    .eq('group_id', groupId)
    .eq('scope', scope)
    .eq('permission', permission)

  deleteQuery = scope === 'group_player'
    ? deleteQuery.eq('target_uuid', targetUuid)
    : deleteQuery.is('target_uuid', null)

  const { error: deleteError } = await deleteQuery
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  if (allowed === null) {
    return NextResponse.json({ success: true, deleted: true })
  }

  const { error: insertError } = await supabaseAdmin.from('claim_permissions').insert({
    owner_uuid: ownerUuid,
    scope,
    group_id: groupId,
    target_uuid: scope === 'group_player' ? targetUuid : null,
    target_name: scope === 'group_player' ? targetName : null,
    permission,
    allowed: !!allowed,
  })

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  return NextResponse.json({ success: true })
}