import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

const VALID_PERMISSIONS = [
  'BLOCK_BREAK', 'BLOCK_PLACE', 'BUCKET_USE',
  'CONTAINER_OPEN', 'ITEM_PICKUP', 'ITEM_FRAME',
  'DOOR_USE', 'BUTTON_LEVER_USE', 'REDSTONE_USE', 'CROP_HARVEST', 'ANIMAL_INTERACT',
  'MOB_KILL', 'VEHICLE_USE', 'MOUNT_USE',
] as const

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

// Liefert alle eigenen gespeicherten Permission-Vorlagen.
export async function GET(req: NextRequest) {
  const ownerUuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!ownerUuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  let templates
  try {
    const result = await pool.query(
      'SELECT * FROM permission_templates WHERE owner_uuid = $1 ORDER BY created_at DESC',
      [ownerUuid]
    )
    templates = result.rows
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  return NextResponse.json({ templates: templates || [] })
}

// Body: { name: string, permissions: Record<string, boolean | null> }
export async function POST(req: NextRequest) {
  const ownerUuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!ownerUuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const body = await req.json()
  const { name, permissions } = body

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Name erforderlich' }, { status: 400 })
  }
  if (!permissions || typeof permissions !== 'object') {
    return NextResponse.json({ error: 'Permissions erforderlich' }, { status: 400 })
  }

  // Nur valide Keys übernehmen, alles andere ignorieren
  const cleanPermissions: Record<string, boolean | null> = {}
  for (const key of VALID_PERMISSIONS) {
    cleanPermissions[key] = permissions[key] ?? null
  }

  let template
  try {
    // permissions ist eine jsonb-Spalte — explizit als JSON-String übergeben
    const result = await pool.query(
      `INSERT INTO permission_templates (owner_uuid, name, permissions)
       VALUES ($1, $2, $3::jsonb) RETURNING *`,
      [ownerUuid, name.trim(), JSON.stringify(cleanPermissions)]
    )
    template = result.rows[0]
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, template })
}

// Body: { id: number }
export async function DELETE(req: NextRequest) {
  const ownerUuid = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!ownerUuid) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const body = await req.json()
  const { id } = body
  if (!id) return NextResponse.json({ error: 'id erforderlich' }, { status: 400 })

  try {
    await pool.query(
      'DELETE FROM permission_templates WHERE id = $1 AND owner_uuid = $2',
      [id, ownerUuid]
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}