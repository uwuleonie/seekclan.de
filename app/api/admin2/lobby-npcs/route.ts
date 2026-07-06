import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { saveFile, getPublicUrl } from '@/app/lib/local-storage'

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

// GET /api/admin2/lobby-npcs
export async function GET(req: NextRequest) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  try {
    const result = await pool.query(
      `SELECT id, name, display_name, skin_filename, world, pos_x, pos_y, pos_z, yaw, pitch,
              action_type, action_value, dialog, bubble_text, created_at
       FROM lobby_npcs ORDER BY id ASC`
    )
    const npcs = result.rows.map(row => ({
      ...row,
      skin_url: row.skin_filename
        ? getPublicUrl('site-content', `lobby-skins/${row.skin_filename}`)
        : null,
    }))
    return NextResponse.json({ npcs })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/admin2/lobby-npcs
// FormData: name, display_name, action_type, action_value?, dialog?, bubble_text?, skin? (file)
export async function POST(req: NextRequest) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const formData = await req.formData().catch(() => null)
  if (!formData) return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })

  const name = (formData.get('name') as string)?.trim()
  const display_name = (formData.get('display_name') as string)?.trim()
  const action_type = (formData.get('action_type') as string) || 'server_switch'
  const action_value = (formData.get('action_value') as string)?.trim() || null
  const dialog = (formData.get('dialog') as string)?.trim() || null
  const bubble_text = (formData.get('bubble_text') as string)?.trim() || null
  const skinFile = formData.get('skin') as File | null

  if (!name || !display_name) {
    return NextResponse.json({ error: 'Name und Anzeigename erforderlich' }, { status: 400 })
  }

  let skin_filename: string | null = null

  if (skinFile && skinFile.size > 0) {
    if (!['image/png', 'image/jpeg'].includes(skinFile.type)) {
      return NextResponse.json({ error: 'Nur PNG oder JPG für Skin erlaubt' }, { status: 400 })
    }
    if (skinFile.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Skin zu groß (max. 2 MB)' }, { status: 400 })
    }
    const ext = skinFile.name.split('.').pop()
    skin_filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const buffer = Buffer.from(await skinFile.arrayBuffer())
    await saveFile('site-content', `lobby-skins/${skin_filename}`, buffer)
  }

  try {
    const result = await pool.query(
      `INSERT INTO lobby_npcs (name, display_name, skin_filename, action_type, action_value, dialog, bubble_text)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [name, display_name, skin_filename, action_type, action_value, dialog, bubble_text]
    )
    return NextResponse.json({ id: result.rows[0].id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}