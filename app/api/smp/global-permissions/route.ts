import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

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

// Liefert alle globalen Permission-Regeln des eingeloggten Spielers (global_all/global_player).
export async function GET(req: NextRequest) {
  const ownerUuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!ownerUuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  let rules
  try {
    const result = await pool.query(
      `SELECT * FROM claim_permissions WHERE owner_uuid = $1 AND scope IN ('global_all', 'global_player')`,
      [ownerUuid]
    )
    rules = result.rows
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

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

  // claim_id und group_id müssen für globale Regeln beide NULL sein — daher IS NULL
  // statt = NULL (NULL-Vergleiche mit = liefern in SQL nie TRUE).
  try {
    if (scope === 'global_player') {
      await pool.query(
        `DELETE FROM claim_permissions
         WHERE owner_uuid = $1 AND scope = $2 AND permission = $3
           AND claim_id IS NULL AND group_id IS NULL AND target_uuid = $4`,
        [ownerUuid, scope, permission, targetUuid]
      )
    } else {
      await pool.query(
        `DELETE FROM claim_permissions
         WHERE owner_uuid = $1 AND scope = $2 AND permission = $3
           AND claim_id IS NULL AND group_id IS NULL AND target_uuid IS NULL`,
        [ownerUuid, scope, permission]
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
      `INSERT INTO claim_permissions (owner_uuid, scope, claim_id, group_id, target_uuid, target_name, permission, allowed)
       VALUES ($1, $2, NULL, NULL, $3, $4, $5, $6)`,
      [
        ownerUuid, scope,
        scope === 'global_player' ? targetUuid : null,
        scope === 'global_player' ? targetName : null,
        permission, !!allowed,
      ]
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}