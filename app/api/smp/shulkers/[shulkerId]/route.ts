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

// Body: { name: string }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ shulkerId: string }> }) {
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
  const { name } = body
  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Name erforderlich' }, { status: 400 })
  }

  try {
    await pool.query('UPDATE shulkers SET name = $1 WHERE id = $2', [name.trim(), shulkerId])
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}