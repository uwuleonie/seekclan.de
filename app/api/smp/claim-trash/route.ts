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

// Liefert alle (nicht abgelaufenen) Papierkorb-Einträge des Owners.
// Räumt nebenbei automatisch alle abgelaufenen Einträge (server-weit) auf.
export async function GET(req: NextRequest) {
  const ownerUuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!ownerUuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  await pool.query('DELETE FROM claim_trash WHERE expires_at < $1', [new Date().toISOString()])

  let data
  try {
    const result = await pool.query(
      `SELECT id, group_name, claims_snapshot, deleted_at, expires_at
       FROM claim_trash WHERE owner_uuid = $1 ORDER BY deleted_at DESC`,
      [ownerUuid]
    )
    data = result.rows
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  const entries = (data || []).map(e => ({
    id: e.id,
    group_name: e.group_name,
    chunk_count: Array.isArray(e.claims_snapshot) ? e.claims_snapshot.length : 0,
    deleted_at: e.deleted_at,
    expires_at: e.expires_at,
  }))

  return NextResponse.json({ entries })
}