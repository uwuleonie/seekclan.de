import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { isGroupLockedByTransfer } from '@/app/lib/claim-transfer-lock'

async function getMinecraftAccount(token: string | undefined) {
  if (!token) return null
  const sessionResult = await pool.query(
    'SELECT user_id, expires_at FROM sessions WHERE token = $1',
    [token]
  )
  const session = sessionResult.rows[0]
  if (!session || new Date(session.expires_at) < new Date()) return null

  const userResult = await pool.query(
    'SELECT minecraft_uuid, minecraft_username FROM users WHERE id = $1',
    [session.user_id]
  )
  const user = userResult.rows[0]
  return user ? { uuid: user.minecraft_uuid as string | null, username: user.minecraft_username as string | null } : null
}

// Body: { receiverUuid: string, receiverName: string }
// Erstellt eine neue Übertragungsanfrage für eine Gruppe.
export async function POST(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params
  const account = await getMinecraftAccount(req.cookies.get('session_token')?.value)
  if (!account?.uuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const groupResult = await pool.query(
    'SELECT id, owner_uuid FROM claim_groups WHERE id = $1',
    [groupId]
  )
  const group = groupResult.rows[0]
  if (!group || group.owner_uuid !== account.uuid) {
    return NextResponse.json({ error: 'Gruppe nicht gefunden oder gehört dir nicht' }, { status: 404 })
  }

  if (await isGroupLockedByTransfer(groupId)) {
    return NextResponse.json({ error: 'Für diese Gruppe läuft bereits eine Übertragung' }, { status: 409 })
  }

  const body = await req.json()
  const { receiverUuid, receiverName } = body
  if (!receiverUuid || !receiverName) {
    return NextResponse.json({ error: 'Empfänger erforderlich' }, { status: 400 })
  }
  if (receiverUuid === account.uuid) {
    return NextResponse.json({ error: 'Du kannst nicht an dich selbst übertragen' }, { status: 400 })
  }

  const countResult = await pool.query(
    'SELECT COUNT(*) AS count FROM claims WHERE group_id = $1',
    [groupId]
  )
  const chunkCount = parseInt(countResult.rows[0]?.count || '0', 10)

  let transfer
  try {
    const result = await pool.query(
      `INSERT INTO claim_transfers (group_id, sender_uuid, sender_name, receiver_uuid, receiver_name, chunk_count)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [Number(groupId), account.uuid, account.username, receiverUuid, receiverName, chunkCount]
    )
    transfer = result.rows[0]
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  const receiverUserResult = await pool.query(
    'SELECT id FROM users WHERE minecraft_uuid = $1',
    [receiverUuid]
  )
  const receiverUser = receiverUserResult.rows[0]

  if (receiverUser) {
    await pool.query(
      `INSERT INTO notifications (user_id, category, title, body, link) VALUES ($1, $2, $3, $4, $5)`,
      [
        receiverUser.id, 'system',
        `${account.username} möchte dir eine Gruppe übertragen`,
        `${chunkCount} Chunk${chunkCount === 1 ? '' : 's'} warten auf deine Antwort.`,
        '/smp/claims/transfers',
      ]
    )
  }

  return NextResponse.json({ success: true, transfer })
}

// Sender zieht eine offene Anfrage selbst zurück.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params
  const account = await getMinecraftAccount(req.cookies.get('session_token')?.value)
  if (!account?.uuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  try {
    await pool.query(
      `UPDATE claim_transfers SET status = 'cancelled'
       WHERE group_id = $1 AND sender_uuid = $2 AND status = 'pending'`,
      [groupId, account.uuid]
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}