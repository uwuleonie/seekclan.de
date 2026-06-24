import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

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

// Liefert alle offenen, eingehenden Übertragungsanfragen für den eingeloggten Spieler.
// Markiert nebenbei abgelaufene Anfragen (server-weit) als 'expired'.
export async function GET(req: NextRequest) {
  const myUuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!myUuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  await pool.query(
    `UPDATE claim_transfers SET status = 'expired' WHERE status = 'pending' AND expires_at < $1`,
    [new Date().toISOString()]
  )

  let data
  try {
    const result = await pool.query(
      `SELECT
         ct.*,
         json_build_object('name', cg.name) AS claim_groups
       FROM claim_transfers ct
       LEFT JOIN claim_groups cg ON cg.id = ct.group_id
       WHERE ct.receiver_uuid = $1 AND ct.status = 'pending'
       ORDER BY ct.created_at DESC`,
      [myUuid]
    )
    data = result.rows
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  const transfers = (data || []).map((t: any) => ({
    id: t.id,
    groupId: t.group_id,
    groupName: t.claim_groups?.name || `Gruppe #${t.group_id}`,
    senderName: t.sender_name,
    chunkCount: t.chunk_count,
    createdAt: t.created_at,
    expiresAt: t.expires_at,
  }))

  return NextResponse.json({ transfers })
}