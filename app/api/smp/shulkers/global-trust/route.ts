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
export async function POST(req: NextRequest) {
  const ownerUuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!ownerUuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const body = await req.json()
  const { targetUuid, targetName, permission, trusted } = body

  if (permission !== 'OPEN' && permission !== 'BREAK') {
    return NextResponse.json({ error: 'Ungültige Permission' }, { status: 400 })
  }
  if (!targetUuid) {
    return NextResponse.json({ error: 'targetUuid erforderlich' }, { status: 400 })
  }

  await pool.query(
    `DELETE FROM shulker_trusts WHERE owner_uuid = $1 AND scope = 'all' AND trusted_uuid = $2 AND permission = $3`,
    [ownerUuid, targetUuid, permission]
  )

  if (!trusted) {
    return NextResponse.json({ success: true, deleted: true })
  }

  try {
    await pool.query(
      `INSERT INTO shulker_trusts (owner_uuid, trusted_uuid, trusted_name, scope, shulker_id, permission)
       VALUES ($1, $2, $3, 'all', NULL, $4)`,
      [ownerUuid, targetUuid, targetName, permission]
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}