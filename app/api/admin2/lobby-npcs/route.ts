import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function checkRead(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT id, clan_role FROM users WHERE id = $1', [session.user_id])
  const user = userResult.rows[0]
  if (!user || !['administrator', 'owner', 'teammitglied'].includes(user.clan_role)) return null
  return user
}

async function checkWrite(req: NextRequest) {
  const user = await checkRead(req)
  if (!user || (user.clan_role !== 'administrator' && user.clan_role !== 'owner')) return null
  return user
}

// Holt UUID von Mojang anhand des Usernamens
async function fetchMojangUuid(username: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`)
    if (!res.ok) return null
    const data = await res.json()
    // UUID kommt ohne Bindestriche, wir formatieren sie
    const raw = data.id as string
    return `${raw.slice(0,8)}-${raw.slice(8,12)}-${raw.slice(12,16)}-${raw.slice(16,20)}-${raw.slice(20)}`
  } catch {
    return null
  }
}

// GET /api/admin2/lobby-npcs
export async function GET(req: NextRequest) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  try {
    const result = await pool.query(
      `SELECT id, name, display_name, skin_username, skin_uuid,
              world, pos_x, pos_y, pos_z, yaw, pitch,
              action_type, action_value, dialog, bubble_text, created_at
       FROM lobby_npcs ORDER BY id ASC`
    )
    return NextResponse.json({ npcs: result.rows })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/admin2/lobby-npcs
// Body JSON: { name, display_name, skin_username?, action_type, action_value?, dialog?, bubble_text? }
export async function POST(req: NextRequest) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { name, display_name, skin_username, action_type, action_value, dialog, bubble_text } = body as {
    name?: string
    display_name?: string
    skin_username?: string
    action_type?: string
    action_value?: string
    dialog?: string
    bubble_text?: string
  }

  if (!name?.trim() || !display_name?.trim()) {
    return NextResponse.json({ error: 'Name und Anzeigename erforderlich' }, { status: 400 })
  }

  // UUID von Mojang holen
  let skin_uuid: string | null = null
  if (skin_username?.trim()) {
    skin_uuid = await fetchMojangUuid(skin_username.trim())
    if (!skin_uuid) {
      return NextResponse.json({ error: `Minecraft-Account "${skin_username}" nicht gefunden` }, { status: 400 })
    }
  }

  try {
    const result = await pool.query(
      `INSERT INTO lobby_npcs (name, display_name, skin_username, skin_uuid, action_type, action_value, dialog, bubble_text)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [name.trim(), display_name.trim(), skin_username?.trim() || null, skin_uuid, action_type || 'server_switch', action_value?.trim() || null, dialog?.trim() || null, bubble_text?.trim() || null]
    )
    return NextResponse.json({ id: result.rows[0].id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}