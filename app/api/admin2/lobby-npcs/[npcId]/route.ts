import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { saveFile, deleteFile, getPublicUrl } from '@/app/lib/local-storage'

async function checkWrite(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT id, clan_role FROM users WHERE id = $1', [session.user_id])
  const user = userResult.rows[0]
  if (!user || (user.clan_role !== 'administrator' && user.clan_role !== 'owner')) return null
  return user
}

// PATCH /api/admin2/lobby-npcs/[npcId]
// FormData oder JSON: beliebige Felder des NPCs
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ npcId: string }> }
) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { npcId } = await context.params

  const contentType = req.headers.get('content-type') || ''

  if (contentType.includes('multipart/form-data')) {
    // FormData mit optionalem neuem Skin
    const formData = await req.formData().catch(() => null)
    if (!formData) return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })

    const updates: Record<string, any> = {}
    for (const key of ['name', 'display_name', 'action_type', 'action_value', 'dialog', 'bubble_text',
                        'world', 'pos_x', 'pos_y', 'pos_z', 'yaw', 'pitch']) {
      const val = formData.get(key)
      if (val !== null) updates[key] = (val as string).trim() || null
    }

    const skinFile = formData.get('skin') as File | null
    if (skinFile && skinFile.size > 0) {
      const oldResult = await pool.query('SELECT skin_filename FROM lobby_npcs WHERE id = $1', [npcId])
      const old = oldResult.rows[0]
      if (old?.skin_filename) {
        await deleteFile('site-content', `lobby-skins/${old.skin_filename}`)
      }
      const ext = skinFile.name.split('.').pop()
      const skin_filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const buffer = Buffer.from(await skinFile.arrayBuffer())
      await saveFile('site-content', `lobby-skins/${skin_filename}`, buffer)
      updates['skin_filename'] = skin_filename
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: true })
    }

    const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 1}`).join(', ')
    const values = [...Object.values(updates), npcId]
    await pool.query(
      `UPDATE lobby_npcs SET ${setClauses} WHERE id = $${values.length}`,
      values
    )
  } else {
    // JSON Update (z.B. Position nach /setnpchere)
    const body = await req.json().catch(() => ({}))
    const allowed = ['name', 'display_name', 'action_type', 'action_value', 'dialog', 'bubble_text',
                     'world', 'pos_x', 'pos_y', 'pos_z', 'yaw', 'pitch']
    const updates: Record<string, any> = {}
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key]
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: true })
    }
    const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 1}`).join(', ')
    const values = [...Object.values(updates), npcId]
    await pool.query(
      `UPDATE lobby_npcs SET ${setClauses} WHERE id = $${values.length}`,
      values
    )
  }

  // Rückgabe mit skin_url
  const result = await pool.query('SELECT * FROM lobby_npcs WHERE id = $1', [npcId])
  const row = result.rows[0]
  return NextResponse.json({
    success: true,
    npc: {
      ...row,
      skin_url: row?.skin_filename
        ? getPublicUrl('site-content', `lobby-skins/${row.skin_filename}`)
        : null,
    },
  })
}

// DELETE /api/admin2/lobby-npcs/[npcId]
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ npcId: string }> }
) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { npcId } = await context.params

  const rowResult = await pool.query('SELECT skin_filename FROM lobby_npcs WHERE id = $1', [npcId])
  const row = rowResult.rows[0]
  if (!row) return NextResponse.json({ error: 'NPC nicht gefunden' }, { status: 404 })

  if (row.skin_filename) {
    await deleteFile('site-content', `lobby-skins/${row.skin_filename}`)
  }

  await pool.query('DELETE FROM lobby_npcs WHERE id = $1', [npcId])
  return NextResponse.json({ success: true })
}