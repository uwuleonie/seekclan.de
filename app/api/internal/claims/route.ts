import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// Erstellt einen einzelnen Claim (ersetzt den alten SupabaseClient.insertReturning("claims", ...)
// Aufruf aus dem Plugin). Im Gegensatz zur alten Architektur wird hier JEDER Fehlerfall
// erkannt und mit einer konkreten, für den Spieler verständlichen Meldung beantwortet -
// kein "Fehler beim Speichern" mehr ohne erkennbaren Grund.
export async function POST(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Ungültiger API Key' }, { status: 401 })
  }

  const body = await req.json()
  const { owner_uuid, owner_name, world, chunk_x, chunk_z, name, is_admin_claim } = body

  if (!owner_uuid || !owner_name || !world || chunk_x === undefined || chunk_z === undefined) {
    return NextResponse.json(
      { error: 'owner_uuid, owner_name, world, chunk_x und chunk_z sind erforderlich' },
      { status: 400 }
    )
  }

  if (name && name.toLowerCase() === 'all') {
    return NextResponse.json({ error: 'Ein Claim darf nicht "all" genannt werden' }, { status: 400 })
  }

  // Vor-Check, damit wir bei einem bereits geclaimten Chunk eine konkrete,
  // hilfreiche Meldung geben können (wem der Chunk gehört) - statt erst beim
  // INSERT in einen Unique-Constraint-Fehler zu laufen und das interpretieren zu müssen.
  let existing
  try {
    const existingResult = await pool.query(
      'SELECT owner_name, is_admin_claim FROM claims WHERE world = $1 AND chunk_x = $2 AND chunk_z = $3',
      [world, chunk_x, chunk_z]
    )
    existing = existingResult.rows[0]
  } catch (err: any) {
    return NextResponse.json({ error: `Datenbankfehler bei der Prüfung: ${err.message}` }, { status: 500 })
  }

  if (existing) {
    const ownerLabel = existing.is_admin_claim ? `Admin-Claim von ${existing.owner_name}` : existing.owner_name
    return NextResponse.json(
      { error: `Dieser Chunk ist bereits geclaimt (${ownerLabel}).` },
      { status: 409 }
    )
  }

  let claim
  try {
    const result = await pool.query(
      `INSERT INTO claims (owner_uuid, owner_name, world, chunk_x, chunk_z, name, is_admin_claim)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [owner_uuid, owner_name, world, chunk_x, chunk_z, name || null, is_admin_claim || false]
    )
    claim = result.rows[0]
  } catch (err: any) {
    // Falls trotz Vor-Check noch ein Unique-Constraint-Konflikt auftritt (z.B. durch
    // ein zeitgleiches /claimarea auf demselben Chunk - "race condition"), geben wir
    // das exakt wieder, statt es zu verschlucken.
    if (err.code === '23505') {
      return NextResponse.json(
        { error: 'Dieser Chunk wurde gerade eben von jemand anderem geclaimt.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: `Claim konnte nicht erstellt werden: ${err.message}` }, { status: 500 })
  }

  return NextResponse.json({ claim })
}