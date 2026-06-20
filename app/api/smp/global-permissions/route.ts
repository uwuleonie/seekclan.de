import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

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

// Liefert alle globalen Permission-Regeln des eingeloggten Spielers (global_all/global_player).
export async function GET(req: NextRequest) {
  const ownerUuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!ownerUuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { data: rules, error } = await supabaseAdmin
    .from('claim_permissions')
    .select('*')
    .eq('owner_uuid', ownerUuid)
    .in('scope', ['global_all', 'global_player'])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ rules: rules || [] })
}

// Body: { scope: 'global_all' | 'global_player', targetUuid?: string, targetName?: string,
//         permission: string, allowed: boolean | null }
export async function POST(req: NextRequest) {
  const ownerUuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!ownerUuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const body = await req.json()
  const { scope, targetUuid, targetName, permission, allowed } = body

  if (scope !== 'global_all' && scope !== 'global_player') {
    return NextResponse.json({ error: 'Ungültiger scope' }, { status: 400 })
  }
  if (!VALID_PERMISSIONS.includes(permission)) {
    return NextResponse.json({ error: 'Ungültige Permission' }, { status: 400 })
  }
  if (scope === 'global_player' && !targetUuid) {
    return NextResponse.json({ error: 'targetUuid erforderlich für global_player' }, { status: 400 })
  }

  let deleteQuery = supabaseAdmin
    .from('claim_permissions')
    .delete()
    .eq('owner_uuid', ownerUuid)
    .eq('scope', scope)
    .eq('permission', permission)
    .is('claim_id', null)
    .is('group_id', null)

  deleteQuery = scope === 'global_player'
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
    claim_id: null,
    group_id: null,
    target_uuid: scope === 'global_player' ? targetUuid : null,
    target_name: scope === 'global_player' ? targetName : null,
    permission,
    allowed: !!allowed,
  })

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  return NextResponse.json({ success: true })
}