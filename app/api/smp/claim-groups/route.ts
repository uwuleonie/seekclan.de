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

// Body: { name: string }
// Erstellt eine neue, leere, manuelle Gruppe (is_auto = false).
export async function POST(req: NextRequest) {
  const account = await getMinecraftAccount(req.cookies.get('session_token')?.value)
  if (!account?.uuid) return NextResponse.json({ error: 'Nicht eingeloggt oder kein Minecraft-Account verknüpft' }, { status: 401 })

  const body = await req.json()
  const { name } = body
  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Name erforderlich' }, { status: 400 })
  }

  let data
  try {
    const result = await pool.query(
      'INSERT INTO claim_groups (owner_uuid, owner_name, name, is_auto) VALUES ($1, $2, $3, false) RETURNING *',
      [account.uuid, account.username, name.trim()]
    )
    data = result.rows[0]
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, group: data })
}