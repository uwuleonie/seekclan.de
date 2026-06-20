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

async function verifyOwnedClaim(claimId: string, ownerUuid: string) {
  const { data: claim } = await supabaseAdmin
    .from('claims')
    .select('id, owner_uuid')
    .eq('id', claimId)
    .single()
  if (!claim || claim.owner_uuid !== ownerUuid) return null
  return claim
}

// Liefert alle gesetzten Permission-Regeln für diesen Claim (chunk_all und chunk_player).
export async function GET(req: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  const { claimId } = await params
  const ownerUuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!ownerUuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const claim = await verifyOwnedClaim(claimId, ownerUuid)
  if (!claim) return NextResponse.json({ error: 'Claim nicht gefunden oder gehört dir nicht' }, { status: 404 })

  const { data: rules, error } = await supabaseAdmin
    .from('claim_permissions')
    .select('*')
    .eq('claim_id', claimId)
    .in('scope', ['chunk_all', 'chunk_player'])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ rules: rules || [] })
}

// Setzt/aktualisiert/löscht eine einzelne Permission-Regel für diesen Claim.
// Body: { scope: 'chunk_all' | 'chunk_player', targetUuid?: string, targetName?: string,
//         permission: string, allowed: boolean | null }
// allowed === null bedeutet "Regel löschen" (= "nicht gesetzt", nächste Ebene greift wieder).
export async function POST(req: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  const { claimId } = await params
  const ownerUuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!ownerUuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const claim = await verifyOwnedClaim(claimId, ownerUuid)
  if (!claim) return NextResponse.json({ error: 'Claim nicht gefunden oder gehört dir nicht' }, { status: 404 })

  const body = await req.json()
  const { scope, targetUuid, targetName, permission, allowed } = body

  if (scope !== 'chunk_all' && scope !== 'chunk_player') {
    return NextResponse.json({ error: 'Ungültiger scope' }, { status: 400 })
  }
  if (!VALID_PERMISSIONS.includes(permission)) {
    return NextResponse.json({ error: 'Ungültige Permission' }, { status: 400 })
  }
  if (scope === 'chunk_player' && !targetUuid) {
    return NextResponse.json({ error: 'targetUuid erforderlich für chunk_player' }, { status: 400 })
  }

  // Bestehende Regel für diese exakte Kombination löschen (egal ob vorhanden oder nicht)
  let deleteQuery = supabaseAdmin
    .from('claim_permissions')
    .delete()
    .eq('claim_id', claimId)
    .eq('scope', scope)
    .eq('permission', permission)

  deleteQuery = scope === 'chunk_player'
    ? deleteQuery.eq('target_uuid', targetUuid)
    : deleteQuery.is('target_uuid', null)

  const { error: deleteError } = await deleteQuery
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  // allowed === null heißt: nur löschen, keine neue Regel einfügen ("nicht gesetzt")
  if (allowed === null) {
    return NextResponse.json({ success: true, deleted: true })
  }

  const { error: insertError } = await supabaseAdmin.from('claim_permissions').insert({
    owner_uuid: ownerUuid,
    scope,
    claim_id: claimId,
    target_uuid: scope === 'chunk_player' ? targetUuid : null,
    target_name: scope === 'chunk_player' ? targetName : null,
    permission,
    allowed: !!allowed,
  })

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  return NextResponse.json({ success: true })
}