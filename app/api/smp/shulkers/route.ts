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

// Liefert alle eigenen Shulker, inkl. aller darauf gesetzten Trusts
// (sowohl 'shulker'-spezifisch als auch die globalen 'all'-Trusts).
export async function GET(req: NextRequest) {
  const ownerUuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!ownerUuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  let shulkers
  try {
    const result = await pool.query(
      'SELECT * FROM shulkers WHERE owner_uuid = $1 ORDER BY placed_at DESC',
      [ownerUuid]
    )
    shulkers = result.rows
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  let trusts
  try {
    const result = await pool.query(
      'SELECT * FROM shulker_trusts WHERE owner_uuid = $1',
      [ownerUuid]
    )
    trusts = result.rows
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  return NextResponse.json({ shulkers: shulkers || [], trusts: trusts || [] })
}