import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { isGroupLockedByTransfer } from '@/app/lib/claim-transfer-lock'

const VALID_PERMISSIONS = [
  'BLOCK_BREAK', 'BLOCK_PLACE', 'BUCKET_USE',
  'CONTAINER_OPEN', 'ITEM_PICKUP', 'ITEM_FRAME',
  'DOOR_USE', 'BUTTON_LEVER_USE', 'REDSTONE_USE', 'CROP_HARVEST', 'ANIMAL_INTERACT',
  'MOB_KILL', 'VEHICLE_USE', 'MOUNT_USE',
] as const

async function getMinecraftUuid(token: string | undefined) {
  if (!token) return null
  const sessionResult = await pool.query(
    'SELECT user_id, expires_at FROM sessions WHERE token = $1',
    [token]
  )
  const session = sessionResult.rows[0]
  if (!session || new Date(session.expires_at) < new Date()) return null

  const userResult = await pool.query(
    'SELECT minecraft_uuid FROM users WHERE id = $1',
    [session.user_id]
  )
  return userResult.rows[0]?.minecraft_uuid as string | null
}

async function verifyOwnedGroup(groupId: string, ownerUuid: string) {
  const result = await pool.query(
    'SELECT id, owner_uuid FROM claim_groups WHERE id = $1',
    [groupId]
  )
  const group = result.rows[0]
  if (!group || group.owner_uuid !== ownerUuid) return null
  return group
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params
  const ownerUuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!ownerUuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const group = await verifyOwnedGroup(groupId, ownerUuid)
  if (!group) return NextResponse.json({ error: 'Gruppe nicht gefunden oder gehört dir nicht' }, { status: 404 })

  let rules
  try {
    const result = await pool.query(
      `SELECT * FROM claim_permissions WHERE group_id = $1 AND scope IN ('group_all', 'group_player')`,
      [groupId]
    )
    rules = result.rows
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

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

  try {
    await pool.query('UPDATE claim_groups SET name = $1 WHERE id = $2', [name.trim(), groupId])
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

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

  try {
    if (scope === 'group_player') {
      await pool.query(
        `DELETE FROM claim_permissions WHERE group_id = $1 AND scope = $2 AND permission = $3 AND target_uuid = $4`,
        [groupId, scope, permission, targetUuid]
      )
    } else {
      await pool.query(
        `DELETE FROM claim_permissions WHERE group_id = $1 AND scope = $2 AND permission = $3 AND target_uuid IS NULL`,
        [groupId, scope, permission]
      )
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  if (allowed === null) {
    return NextResponse.json({ success: true, deleted: true })
  }

  try {
    await pool.query(
      `INSERT INTO claim_permissions (owner_uuid, scope, group_id, target_uuid, target_name, permission, allowed)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        ownerUuid, scope, groupId,
        scope === 'group_player' ? targetUuid : null,
        scope === 'group_player' ? targetName : null,
        permission, !!allowed,
      ]
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}