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

async function verifyOwnedClaim(claimId: string, ownerUuid: string) {
  const result = await pool.query(
    'SELECT id, owner_uuid FROM claims WHERE id = $1',
    [claimId]
  )
  const claim = result.rows[0]
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

  let rules
  try {
    const result = await pool.query(
      `SELECT * FROM claim_permissions WHERE claim_id = $1 AND scope IN ('chunk_all', 'chunk_player')`,
      [claimId]
    )
    rules = result.rows
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

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

  // Bestehende Regel für diese exakte Kombination löschen (egal ob vorhanden oder nicht).
  // Der target_uuid-Vergleich unterscheidet sich je nach scope: bei chunk_player muss
  // target_uuid exakt übereinstimmen, bei chunk_all muss es NULL sein (daher IS NULL
  // statt = NULL, da NULL-Vergleiche mit = in SQL nie wahr sind).
  try {
    if (scope === 'chunk_player') {
      await pool.query(
        `DELETE FROM claim_permissions WHERE claim_id = $1 AND scope = $2 AND permission = $3 AND target_uuid = $4`,
        [claimId, scope, permission, targetUuid]
      )
    } else {
      await pool.query(
        `DELETE FROM claim_permissions WHERE claim_id = $1 AND scope = $2 AND permission = $3 AND target_uuid IS NULL`,
        [claimId, scope, permission]
      )
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  // allowed === null heißt: nur löschen, keine neue Regel einfügen ("nicht gesetzt")
  if (allowed === null) {
    return NextResponse.json({ success: true, deleted: true })
  }

  try {
    await pool.query(
      `INSERT INTO claim_permissions (owner_uuid, scope, claim_id, target_uuid, target_name, permission, allowed)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        ownerUuid, scope, claimId,
        scope === 'chunk_player' ? targetUuid : null,
        scope === 'chunk_player' ? targetName : null,
        permission, !!allowed,
      ]
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}