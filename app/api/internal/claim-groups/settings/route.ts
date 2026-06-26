import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// Liefert die claim-übergreifenden Einstellungen aller Gruppen für den
// Cache-Sync im Plugin (ClaimGroupSettingsManager.loadAllAsync).
export async function GET(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Ungültiger API Key' }, { status: 401 })
  }

  let groups
  try {
    const result = await pool.query(
      `SELECT id, tnt_explosion_protection, fire_spread_protection, snow_accumulation_protection, weather_override
       FROM claim_groups
       WHERE tnt_explosion_protection IS NOT NULL
          OR fire_spread_protection IS NOT NULL
          OR snow_accumulation_protection IS NOT NULL
          OR weather_override IS NOT NULL`
    )
    groups = result.rows
  } catch (err: any) {
    return NextResponse.json({ error: `Datenbankfehler: ${err.message}` }, { status: 500 })
  }

  return NextResponse.json({ groups: groups || [] })
}