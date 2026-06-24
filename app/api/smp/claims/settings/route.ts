import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

const ALLOWED_KEYS = ['sound_enabled', 'public_build', 'public_break', 'public_containers', 'public_doors', 'public_mobs', 'public_redstone']

export async function POST(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const sessionResult = await pool.query(
    'SELECT user_id, expires_at FROM sessions WHERE token = $1',
    [token]
  )
  const session = sessionResult.rows[0]

  if (!session || new Date(session.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Session abgelaufen' }, { status: 401 })
  }

  const userResult = await pool.query(
    'SELECT minecraft_uuid, minecraft_username FROM users WHERE id = $1',
    [session.user_id]
  )
  const user = userResult.rows[0]

  if (!user?.minecraft_uuid) {
    return NextResponse.json({ error: 'Kein Minecraft-Account verknüpft' }, { status: 400 })
  }

  const body = await req.json()

  const values: Record<string, boolean> = {}
  for (const key of ALLOWED_KEYS) {
    values[key] = key in body ? !!body[key] : false
  }

  try {
    await pool.query(
      `INSERT INTO claim_settings
         (uuid, player_name, sound_enabled, public_build, public_break, public_containers, public_doors, public_mobs, public_redstone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (uuid) DO UPDATE SET
         player_name = EXCLUDED.player_name,
         sound_enabled = CASE WHEN $10 THEN EXCLUDED.sound_enabled ELSE claim_settings.sound_enabled END,
         public_build = CASE WHEN $11 THEN EXCLUDED.public_build ELSE claim_settings.public_build END,
         public_break = CASE WHEN $12 THEN EXCLUDED.public_break ELSE claim_settings.public_break END,
         public_containers = CASE WHEN $13 THEN EXCLUDED.public_containers ELSE claim_settings.public_containers END,
         public_doors = CASE WHEN $14 THEN EXCLUDED.public_doors ELSE claim_settings.public_doors END,
         public_mobs = CASE WHEN $15 THEN EXCLUDED.public_mobs ELSE claim_settings.public_mobs END,
         public_redstone = CASE WHEN $16 THEN EXCLUDED.public_redstone ELSE claim_settings.public_redstone END`,
      [
        user.minecraft_uuid, user.minecraft_username,
        values.sound_enabled, values.public_build, values.public_break,
        values.public_containers, values.public_doors, values.public_mobs, values.public_redstone,
        'sound_enabled' in body, 'public_build' in body, 'public_break' in body,
        'public_containers' in body, 'public_doors' in body, 'public_mobs' in body, 'public_redstone' in body,
      ]
    )
  } catch (err) {
    return NextResponse.json({ error: 'Speichern fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}