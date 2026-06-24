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

// Body: { groupId: number | null }
// groupId = null bedeutet: Claim aus seiner aktuellen Gruppe entfernen (wieder einzeln).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  const { claimId } = await params
  const ownerUuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!ownerUuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const claimResult = await pool.query(
    'SELECT id, owner_uuid, group_id FROM claims WHERE id = $1',
    [claimId]
  )
  const claim = claimResult.rows[0]
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
    const groupResult = await pool.query(
      'SELECT id, owner_uuid FROM claim_groups WHERE id = $1',
      [groupId]
    )
    const group = groupResult.rows[0]
    if (!group || group.owner_uuid !== ownerUuid) {
      return NextResponse.json({ error: 'Gruppe nicht gefunden oder gehört dir nicht' }, { status: 404 })
    }
  }

  try {
    await pool.query('UPDATE claims SET group_id = $1 WHERE id = $2', [groupId, claimId])
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}