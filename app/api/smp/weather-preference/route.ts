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

// Body: { weather_preference: 'default' | 'clear' }
export async function POST(req: NextRequest) {
  const account = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!account) return NextResponse.json({ error: 'Nicht eingeloggt oder kein verknüpfter Minecraft-Account' }, { status: 401 })

  const body = await req.json()
  const { weather_preference } = body

  if (weather_preference !== 'default' && weather_preference !== 'clear') {
    return NextResponse.json({ error: 'weather_preference muss "default" oder "clear" sein' }, { status: 400 })
  }

  try {
    await pool.query(
      `UPDATE users SET weather_preference = $1 WHERE minecraft_uuid = $2`,
      [weather_preference, account]
    )
  } catch (err: any) {
    return NextResponse.json({ error: `Einstellung konnte nicht gespeichert werden: ${err.message}` }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function GET(req: NextRequest) {
  const account = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!account) return NextResponse.json({ error: 'Nicht eingeloggt oder kein verknüpfter Minecraft-Account' }, { status: 401 })

  let preference = 'default'
  try {
    const result = await pool.query(`SELECT weather_preference FROM users WHERE minecraft_uuid = $1`, [account])
    preference = result.rows[0]?.weather_preference || 'default'
  } catch (err: any) {
    return NextResponse.json({ error: `Datenbankfehler: ${err.message}` }, { status: 500 })
  }

  return NextResponse.json({ weather_preference: preference })
}