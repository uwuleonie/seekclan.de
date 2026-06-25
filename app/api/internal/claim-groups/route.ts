import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// Erstellt eine neue, automatisch generierte Claim-Gruppe (ersetzt den alten
// SupabaseClient.insertReturning("claim_groups", ...) Aufruf aus
// ClaimGroupingService.createAutoGroup im Plugin).
export async function POST(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Ungültiger API Key' }, { status: 401 })
  }

  const body = await req.json()
  const { owner_uuid, owner_name } = body

  if (!owner_uuid || !owner_name) {
    return NextResponse.json({ error: 'owner_uuid und owner_name sind erforderlich' }, { status: 400 })
  }

  let group
  try {
    const result = await pool.query(
      'INSERT INTO claim_groups (owner_uuid, owner_name, is_auto) VALUES ($1, $2, true) RETURNING *',
      [owner_uuid, owner_name]
    )
    group = result.rows[0]
  } catch (err: any) {
    return NextResponse.json({ error: `Gruppe konnte nicht erstellt werden: ${err.message}` }, { status: 500 })
  }

  return NextResponse.json({ group })
}