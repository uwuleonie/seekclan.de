import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

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

// Body: { action: 'accept' | 'decline', keepPermissions?: boolean }
export async function POST(req: NextRequest, { params }: { params: Promise<{ transferId: string }> }) {
  const { transferId } = await params
  const account = await getMinecraftAccount(req.cookies.get('session_token')?.value)
  if (!account?.uuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const transferResult = await pool.query(
    'SELECT * FROM claim_transfers WHERE id = $1',
    [transferId]
  )
  const transfer = transferResult.rows[0]
  if (!transfer || transfer.receiver_uuid !== account.uuid) {
    return NextResponse.json({ error: 'Anfrage nicht gefunden oder gehört dir nicht' }, { status: 404 })
  }
  if (transfer.status !== 'pending') {
    return NextResponse.json({ error: 'Diese Anfrage ist nicht mehr offen' }, { status: 409 })
  }
  if (new Date(transfer.expires_at) < new Date()) {
    await pool.query(`UPDATE claim_transfers SET status = 'expired' WHERE id = $1`, [transferId])
    return NextResponse.json({ error: 'Diese Anfrage ist abgelaufen' }, { status: 410 })
  }

  const body = await req.json()
  const { action, keepPermissions } = body

  if (action === 'decline') {
    await pool.query(`UPDATE claim_transfers SET status = 'declined' WHERE id = $1`, [transferId])

    const senderUserResult = await pool.query(
      'SELECT id FROM users WHERE minecraft_uuid = $1',
      [transfer.sender_uuid]
    )
    const senderUser = senderUserResult.rows[0]
    if (senderUser) {
      await pool.query(
        `INSERT INTO notifications (user_id, category, title, body, link) VALUES ($1, $2, $3, $4, $5)`,
        [senderUser.id, 'system', `${account.username} hat deine Übertragung abgelehnt`, null, null]
      )
    }

    return NextResponse.json({ success: true, status: 'declined' })
  }

  if (action !== 'accept') {
    return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 })
  }

  const groupId = transfer.group_id

  let claimsInGroup
  try {
    const result = await pool.query('SELECT id FROM claims WHERE group_id = $1', [groupId])
    claimsInGroup = result.rows
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
  const claimIds = (claimsInGroup || []).map(c => c.id)

  try {
    await pool.query(
      'UPDATE claim_groups SET owner_uuid = $1, owner_name = $2 WHERE id = $3',
      [account.uuid, account.username, groupId]
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  try {
    await pool.query(
      'UPDATE claims SET owner_uuid = $1, owner_name = $2 WHERE group_id = $3',
      [account.uuid, account.username, groupId]
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  if (keepPermissions === false) {
    if (claimIds.length > 0) {
      await pool.query(
        'DELETE FROM claim_permissions WHERE claim_id = ANY($1) OR group_id = $2',
        [claimIds, groupId]
      )
      await pool.query('DELETE FROM claim_trusts WHERE claim_id = ANY($1)', [claimIds])
    }
  } else {
    if (claimIds.length > 0) {
      await pool.query(
        'UPDATE claim_permissions SET owner_uuid = $1 WHERE claim_id = ANY($2) OR group_id = $3',
        [account.uuid, claimIds, groupId]
      )
      await pool.query(
        'UPDATE claim_trusts SET owner_uuid = $1, owner_name = $2 WHERE claim_id = ANY($3)',
        [account.uuid, account.username, claimIds]
      )
    }
  }

  await pool.query(`UPDATE claim_transfers SET status = 'accepted' WHERE id = $1`, [transferId])

  const senderUserResult = await pool.query(
    'SELECT id FROM users WHERE minecraft_uuid = $1',
    [transfer.sender_uuid]
  )
  const senderUser = senderUserResult.rows[0]
  if (senderUser) {
    await pool.query(
      `INSERT INTO notifications (user_id, category, title, body, link) VALUES ($1, $2, $3, $4, $5)`,
      [senderUser.id, 'system', `${account.username} hat deine Übertragung angenommen`, null, null]
    )
  }

  return NextResponse.json({ success: true, status: 'accepted' })
}