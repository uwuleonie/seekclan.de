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

// Setzt die Schutz-Schalter für ALLE eigenen Claims UND alle eigenen Gruppen
// auf einmal (höchste Priorität "All" - überschreibt direkt alle Einzel-Werte,
// kein Fallback-Mechanismus wie bei den Gruppen-Overrides).
export async function POST(req: NextRequest) {
  const account = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!account) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const body = await req.json()
  const { tnt_explosion_protection, fire_spread_protection, snow_accumulation_protection, weather_override } = body

  if (weather_override !== undefined && weather_override !== null && weather_override !== 'clear') {
    return NextResponse.json({ error: 'weather_override muss null oder "clear" sein' }, { status: 400 })
  }

  const claimSetClauses: string[] = []
  const claimValues: any[] = []
  let claimParamIndex = 1

  if (tnt_explosion_protection !== undefined) {
    claimSetClauses.push(`tnt_explosion_protection = $${claimParamIndex++}`)
    claimValues.push(!!tnt_explosion_protection)
  }
  if (fire_spread_protection !== undefined) {
    claimSetClauses.push(`fire_spread_protection = $${claimParamIndex++}`)
    claimValues.push(!!fire_spread_protection)
  }
  if (snow_accumulation_protection !== undefined) {
    claimSetClauses.push(`snow_accumulation_protection = $${claimParamIndex++}`)
    claimValues.push(!!snow_accumulation_protection)
  }
  if (weather_override !== undefined) {
    claimSetClauses.push(`weather_override = $${claimParamIndex++}`)
    claimValues.push(weather_override)
  }

  if (claimSetClauses.length === 0) {
    return NextResponse.json({ error: 'Keine Einstellung zum Aktualisieren übergeben' }, { status: 400 })
  }

  try {
    claimValues.push(account)
    await pool.query(`UPDATE claims SET ${claimSetClauses.join(', ')} WHERE owner_uuid = $${claimParamIndex}`, claimValues)

    // Gruppen-Overrides ebenfalls zurücksetzen/setzen, damit "All" tatsächlich
    // überall greift, auch wenn einzelne Gruppen vorher einen abweichenden
    // Override hatten (sonst würde der Gruppen-Override weiterhin Vorrang haben).
    const groupSetClauses = claimSetClauses.map((_, i) => claimSetClauses[i]) // gleiche Spaltennamen
    await pool.query(`UPDATE claim_groups SET ${groupSetClauses.join(', ')} WHERE owner_uuid = $${claimParamIndex}`, claimValues)
  } catch (err: any) {
    return NextResponse.json({ error: `Einstellung konnte nicht gespeichert werden: ${err.message}` }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}