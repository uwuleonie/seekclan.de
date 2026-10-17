import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { mitRecht } from '@/app/lib/rechte'

async function checkWrite(req: NextRequest) {
  return mitRecht(req, 'admin.verwalten')
}

async function fetchMojangUuid(username: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`)
    if (!res.ok) return null
    const data = await res.json()
    const raw = data.id as string
    return `${raw.slice(0,8)}-${raw.slice(8,12)}-${raw.slice(12,16)}-${raw.slice(16,20)}-${raw.slice(20)}`
  } catch {
    return null
  }
}

// PATCH /api/admin2/lobby-npcs/[npcId]
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ npcId: string }> }
) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { npcId } = await context.params
  const body = await req.json().catch(() => ({}))

  const allowed = ['name', 'display_name', 'action_type', 'action_value', 'dialog', 'bubble_text',
                   'world', 'pos_x', 'pos_y', 'pos_z', 'yaw', 'pitch', 'unlock_id']
  const updates: Record<string, any> = {}

  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key] === '' ? null : body[key]
  }

  // Wenn skin_username geändert wird, UUID neu holen
  if (body.skin_username !== undefined) {
    const username = body.skin_username?.trim()
    if (username) {
      const uuid = await fetchMojangUuid(username)
      if (!uuid) {
        return NextResponse.json({ error: `Minecraft-Account "${username}" nicht gefunden` }, { status: 400 })
      }
      updates['skin_username'] = username
      updates['skin_uuid'] = uuid
    } else {
      updates['skin_username'] = null
      updates['skin_uuid'] = null
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: true })
  }

  const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 1}`).join(', ')
  const values = [...Object.values(updates), npcId]
  await pool.query(`UPDATE lobby_npcs SET ${setClauses} WHERE id = $${values.length}`, values)

  return NextResponse.json({ success: true })
}

// DELETE /api/admin2/lobby-npcs/[npcId]
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ npcId: string }> }
) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { npcId } = await context.params
  const rowResult = await pool.query('SELECT id FROM lobby_npcs WHERE id = $1', [npcId])
  if (!rowResult.rows[0]) return NextResponse.json({ error: 'NPC nicht gefunden' }, { status: 404 })

  await pool.query('DELETE FROM lobby_npcs WHERE id = $1', [npcId])
  return NextResponse.json({ success: true })
}