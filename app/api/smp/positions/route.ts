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

export async function GET(req: NextRequest) {
  const ownUuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)

  let data
  try {
    const result = ownUuid
      ? await pool.query(
          'SELECT * FROM smp_saved_positions WHERE is_public = true OR uuid = $1 ORDER BY created_at DESC',
          [ownUuid]
        )
      : await pool.query(
          'SELECT * FROM smp_saved_positions WHERE is_public = true ORDER BY created_at DESC'
        )
    data = result.rows
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  return NextResponse.json({ positions: data || [] })
}

export async function PATCH(req: NextRequest) {
  const uuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!uuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const body = await req.json()
  const { id, name, x, y, z, is_public } = body

  if (!id) return NextResponse.json({ error: 'id erforderlich' }, { status: 400 })

  const existingResult = await pool.query(
    'SELECT uuid FROM smp_saved_positions WHERE id = $1',
    [id]
  )
  const existing = existingResult.rows[0]

  if (!existing || existing.uuid !== uuid) {
    return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 })
  }

  const updates: Record<string, any> = {}
  if (name !== undefined) updates.name = name
  if (x !== undefined) updates.x = x
  if (y !== undefined) updates.y = y
  if (z !== undefined) updates.z = z
  if (is_public !== undefined) updates.is_public = is_public

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: true })
  }

  const keys = Object.keys(updates)
  const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ')
  const values = keys.map((key) => updates[key])

  try {
    await pool.query(
      `UPDATE smp_saved_positions SET ${setClause} WHERE id = $${keys.length + 1}`,
      [...values, id]
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const uuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!uuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id erforderlich' }, { status: 400 })

  const existingResult = await pool.query(
    'SELECT uuid FROM smp_saved_positions WHERE id = $1',
    [id]
  )
  const existing = existingResult.rows[0]

  if (!existing || existing.uuid !== uuid) {
    return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 })
  }

  try {
    await pool.query('DELETE FROM smp_saved_positions WHERE id = $1', [id])
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}