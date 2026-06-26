import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// Liefert die persönliche Wetter-Präferenz ALLER Spieler für den Cache-Sync im
// Plugin (WeatherIllusionManager). Nur Spieler mit einer abweichenden
// Präferenz (nicht 'default') werden zurückgegeben, der Rest gilt implizit als 'default'.
export async function GET(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Ungültiger API Key' }, { status: 401 })
  }

  let users
  try {
    const result = await pool.query(
      `SELECT minecraft_uuid, weather_preference FROM users WHERE weather_preference != 'default' AND minecraft_uuid IS NOT NULL`
    )
    users = result.rows
  } catch (err: any) {
    return NextResponse.json({ error: `Datenbankfehler: ${err.message}` }, { status: 500 })
  }

  return NextResponse.json({ users: users || [] })
}