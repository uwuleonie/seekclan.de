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
    'SELECT minecraft_uuid, minecraft_username FROM users WHERE id = $1',
    [session.user_id]
  )
  const user = userResult.rows[0]
  return user ? { uuid: user.minecraft_uuid as string | null, username: user.minecraft_username as string | null } : null
}

// Liefert alle Claims des eingeloggten Spielers, inkl. Gruppen-Info.
export async function GET(req: NextRequest) {
  const account = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!account) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  if (!account.uuid) return NextResponse.json({ claims: [], groups: [], linked: false })

  let claims
  try {
    const result = await pool.query(
      'SELECT * FROM claims WHERE owner_uuid = $1 ORDER BY claimed_at DESC',
      [account.uuid]
    )
    claims = result.rows
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  let groups
  try {
    const result = await pool.query(
      'SELECT * FROM claim_groups WHERE owner_uuid = $1 ORDER BY created_at DESC',
      [account.uuid]
    )
    groups = result.rows
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  return NextResponse.json({
    claims: claims || [],
    groups: groups || [],
    linked: true,
    minecraft_uuid: account.uuid,
    minecraft_username: account.username,
  })
}