import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { isGroupLockedByTransfer } from '@/app/lib/claim-transfer-lock'

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

// Unclaimt alle Chunks einer Gruppe auf einmal. Legt vorher einen Snapshot
// in claim_trash ab (48h wiederherstellbar), bevor die echten Zeilen gelöscht werden.
export async function POST(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params
  const ownerUuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!ownerUuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const groupResult = await pool.query(
    'SELECT id, owner_uuid, name FROM claim_groups WHERE id = $1',
    [groupId]
  )
  const group = groupResult.rows[0]
  if (!group || group.owner_uuid !== ownerUuid) {
    return NextResponse.json({ error: 'Gruppe nicht gefunden oder gehört dir nicht' }, { status: 404 })
  }

  if (await isGroupLockedByTransfer(groupId)) {
    return NextResponse.json({ error: 'Diese Gruppe wird gerade übertragen und ist gesperrt' }, { status: 423 })
  }

  let claimsInGroup
  try {
    const result = await pool.query('SELECT * FROM claims WHERE group_id = $1', [groupId])
    claimsInGroup = result.rows
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  if (!claimsInGroup || claimsInGroup.length === 0) {
    return NextResponse.json({ error: 'Gruppe enthält keine Chunks' }, { status: 400 })
  }

  const claimIds = claimsInGroup.map(c => c.id)

  const permissionsResult = await pool.query(
    'SELECT * FROM claim_permissions WHERE claim_id = ANY($1) OR group_id = $2',
    [claimIds, groupId]
  )
  const permissions = permissionsResult.rows

  const trustsResult = await pool.query(
    'SELECT * FROM claim_trusts WHERE claim_id = ANY($1)',
    [claimIds]
  )
  const trusts = trustsResult.rows

  try {
    await pool.query(
      `INSERT INTO claim_trash (owner_uuid, group_name, claims_snapshot, permissions_snapshot, trusts_snapshot)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb)`,
      [
        ownerUuid, group.name,
        JSON.stringify(claimsInGroup),
        JSON.stringify(permissions || []),
        JSON.stringify(trusts || []),
      ]
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  await pool.query('DELETE FROM claim_permissions WHERE claim_id = ANY($1) OR group_id = $2', [claimIds, groupId])
  await pool.query('DELETE FROM claim_trusts WHERE claim_id = ANY($1)', [claimIds])
  await pool.query('DELETE FROM claims WHERE id = ANY($1)', [claimIds])
  await pool.query('DELETE FROM claim_groups WHERE id = $1', [groupId])

  return NextResponse.json({ success: true, deletedCount: claimsInGroup.length })
}