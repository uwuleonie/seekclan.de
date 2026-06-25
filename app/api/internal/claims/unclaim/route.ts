import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// Unclaimt einen einzelnen Claim (für /unclaim im Spiel). Legt vorher einen
// Snapshot in claim_trash ab (48h wiederherstellbar, gleiches Pattern wie beim
// Website-Gruppen-Unclaim), bevor die echten Zeilen gelöscht werden. Falls der
// Claim Teil einer Gruppe war und dadurch der letzte verbleibende Chunk dieser
// Gruppe gelöscht wird, wird die jetzt leere Gruppe automatisch mitgelöscht.
export async function POST(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Ungültiger API Key' }, { status: 401 })
  }

  const body = await req.json()
  const { claim_id, owner_uuid } = body

  if (!claim_id || !owner_uuid) {
    return NextResponse.json({ error: 'claim_id und owner_uuid sind erforderlich' }, { status: 400 })
  }

  let claim
  try {
    const claimResult = await pool.query('SELECT * FROM claims WHERE id = $1', [claim_id])
    claim = claimResult.rows[0]
  } catch (err: any) {
    return NextResponse.json({ error: `Datenbankfehler: ${err.message}` }, { status: 500 })
  }

  if (!claim) {
    return NextResponse.json({ error: 'Claim nicht gefunden' }, { status: 404 })
  }
  if (claim.owner_uuid !== owner_uuid) {
    return NextResponse.json({ error: 'Dieser Claim gehört dir nicht' }, { status: 403 })
  }

  let permissions, trusts
  try {
    const permissionsResult = await pool.query(
      'SELECT * FROM claim_permissions WHERE claim_id = $1',
      [claim_id]
    )
    permissions = permissionsResult.rows

    const trustsResult = await pool.query(
      'SELECT * FROM claim_trusts WHERE claim_id = $1',
      [claim_id]
    )
    trusts = trustsResult.rows
  } catch (err: any) {
    return NextResponse.json({ error: `Datenbankfehler beim Sammeln der Daten: ${err.message}` }, { status: 500 })
  }

  try {
    await pool.query(
      `INSERT INTO claim_trash (owner_uuid, group_name, claims_snapshot, permissions_snapshot, trusts_snapshot)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb)`,
      [
        owner_uuid,
        claim.name || `Chunk ${claim.chunk_x},${claim.chunk_z}`,
        JSON.stringify([claim]),
        JSON.stringify(permissions || []),
        JSON.stringify(trusts || []),
      ]
    )
  } catch (err: any) {
    return NextResponse.json({ error: `Snapshot konnte nicht erstellt werden: ${err.message}` }, { status: 500 })
  }

  try {
    await pool.query('DELETE FROM claim_permissions WHERE claim_id = $1', [claim_id])
    await pool.query('DELETE FROM claim_trusts WHERE claim_id = $1', [claim_id])
    await pool.query('DELETE FROM claims WHERE id = $1', [claim_id])

    // Falls der Claim einer Gruppe gehörte: prüfen, ob die Gruppe jetzt leer ist,
    // und falls ja, direkt mitlöschen statt einen verwaisten Gruppen-Datensatz zu hinterlassen.
    let groupDeleted = false
    if (claim.group_id) {
      const remainingResult = await pool.query(
        'SELECT COUNT(*) AS count FROM claims WHERE group_id = $1',
        [claim.group_id]
      )
      if (parseInt(remainingResult.rows[0].count, 10) === 0) {
        await pool.query('DELETE FROM claim_groups WHERE id = $1', [claim.group_id])
        groupDeleted = true
      }
    }

    return NextResponse.json({ success: true, groupDeleted })
  } catch (err: any) {
    return NextResponse.json({ error: `Löschen fehlgeschlagen: ${err.message}` }, { status: 500 })
  }
}