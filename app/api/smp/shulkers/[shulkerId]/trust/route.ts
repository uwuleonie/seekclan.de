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

// Body: { targetUuid: string, targetName: string, permission: 'OPEN' | 'BREAK', trusted: boolean }
export async function POST(req: NextRequest, { params }: { params: Promise<{ shulkerId: string }> }) {
  const { shulkerId } = await params
  const ownerUuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!ownerUuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const shulkerResult = await pool.query(
    'SELECT id, owner_uuid FROM shulkers WHERE id = $1',
    [shulkerId]
  )
  const shulker = shulkerResult.rows[0]
  if (!shulker || shulker.owner_uuid !== ownerUuid) {
    return NextResponse.json({ error: 'Shulker nicht gefunden oder gehört dir nicht' }, { status: 404 })
  }

  const body = await req.json()
  const { targetUuid, targetName, permission, trusted } = body

  if (permission !== 'OPEN' && permission !== 'BREAK') {
    return NextResponse.json({ error: 'Ungültige Permission' }, { status: 400 })
  }
  if (!targetUuid) {
    return NextResponse.json({ error: 'targetUuid erforderlich' }, { status: 400 })
  }

  await pool.query(
    `DELETE FROM shulker_trusts
     WHERE owner_uuid = $1 AND scope = 'shulker' AND shulker_id = $2 AND trusted_uuid = $3 AND permission = $4`,
    [ownerUuid, shulkerId, targetUuid, permission]
  )

  if (!trusted) {
    return NextResponse.json({ success: true, deleted: true })
  }

  try {
    await pool.query(
      `INSERT INTO shulker_trusts (owner_uuid, trusted_uuid, trusted_name, scope, shulker_id, permission)
       VALUES ($1, $2, $3, 'shulker', $4, $5)`,
      [ownerUuid, targetUuid, targetName, Number(shulkerId), permission]
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}