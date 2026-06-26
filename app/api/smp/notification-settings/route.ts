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

// Liefert die Ingame-Benachrichtigungs-Einstellung des eingeloggten Spielers
// (gleiche Tabelle, die auch /claim messages im Spiel umschaltet).
export async function GET(req: NextRequest) {
  const account = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!account) return NextResponse.json({ error: 'Nicht eingeloggt oder kein verknüpfter Minecraft-Account' }, { status: 401 })

  let enabled = false
  try {
    const result = await pool.query(
      `SELECT ingame_messages_enabled FROM claim_notification_settings WHERE uuid = $1`,
      [account]
    )
    enabled = result.rows[0]?.ingame_messages_enabled ?? false
  } catch (err: any) {
    return NextResponse.json({ error: `Datenbankfehler: ${err.message}` }, { status: 500 })
  }

  return NextResponse.json({ ingame_messages_enabled: enabled })
}

// Body: { ingame_messages_enabled: boolean }
export async function POST(req: NextRequest) {
  const account = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!account) return NextResponse.json({ error: 'Nicht eingeloggt oder kein verknüpfter Minecraft-Account' }, { status: 401 })

  const body = await req.json()
  const { ingame_messages_enabled } = body

  if (typeof ingame_messages_enabled !== 'boolean') {
    return NextResponse.json({ error: 'ingame_messages_enabled (boolean) ist erforderlich' }, { status: 400 })
  }

  try {
    await pool.query(
      `INSERT INTO claim_notification_settings (uuid, ingame_messages_enabled)
       VALUES ($1, $2)
       ON CONFLICT (uuid) DO UPDATE SET ingame_messages_enabled = EXCLUDED.ingame_messages_enabled`,
      [account, ingame_messages_enabled]
    )
  } catch (err: any) {
    return NextResponse.json({ error: `Einstellung konnte nicht gespeichert werden: ${err.message}` }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}