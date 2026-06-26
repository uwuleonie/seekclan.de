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

// Setzt die Schutz-Schalter (TNT-Explosion, Feuerausbreitung, Schnee-Akkumulation,
// Wetter-Override) für einen EINZELNEN Claim. Body: { claim_id, ...Schalter }.
// Nur der Owner darf das ändern.
export async function POST(req: NextRequest) {
  const account = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!account) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const body = await req.json()
  const { claim_id, tnt_explosion_protection, fire_spread_protection, snow_accumulation_protection, weather_override } = body

  if (!claim_id) {
    return NextResponse.json({ error: 'claim_id ist erforderlich' }, { status: 400 })
  }

  if (weather_override !== undefined && weather_override !== null && weather_override !== 'clear') {
    return NextResponse.json({ error: 'weather_override muss null oder "clear" sein' }, { status: 400 })
  }

  let claim
  try {
    const claimResult = await pool.query('SELECT owner_uuid FROM claims WHERE id = $1', [claim_id])
    claim = claimResult.rows[0]
  } catch (err: any) {
    return NextResponse.json({ error: `Datenbankfehler: ${err.message}` }, { status: 500 })
  }

  if (!claim) return NextResponse.json({ error: 'Claim nicht gefunden' }, { status: 404 })
  if (claim.owner_uuid !== account) return NextResponse.json({ error: 'Dieser Claim gehört dir nicht' }, { status: 403 })

  const setClauses: string[] = []
  const values: any[] = []
  let paramIndex = 1

  if (tnt_explosion_protection !== undefined) {
    setClauses.push(`tnt_explosion_protection = $${paramIndex++}`)
    values.push(!!tnt_explosion_protection)
  }
  if (fire_spread_protection !== undefined) {
    setClauses.push(`fire_spread_protection = $${paramIndex++}`)
    values.push(!!fire_spread_protection)
  }
  if (snow_accumulation_protection !== undefined) {
    setClauses.push(`snow_accumulation_protection = $${paramIndex++}`)
    values.push(!!snow_accumulation_protection)
  }
  if (weather_override !== undefined) {
    setClauses.push(`weather_override = $${paramIndex++}`)
    values.push(weather_override)
  }

  if (setClauses.length === 0) {
    return NextResponse.json({ error: 'Keine Einstellung zum Aktualisieren übergeben' }, { status: 400 })
  }

  values.push(claim_id)

  try {
    await pool.query(`UPDATE claims SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`, values)
  } catch (err: any) {
    return NextResponse.json({ error: `Einstellung konnte nicht gespeichert werden: ${err.message}` }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}