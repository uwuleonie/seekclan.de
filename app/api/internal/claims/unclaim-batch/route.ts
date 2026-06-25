import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// Unclaimt mehrere Claims auf einmal (für /unclaimarea im Spiel). Legt vorher
// einen gemeinsamen Snapshot in claim_trash ab (48h wiederherstellbar als ein
// zusammenhängender Vorgang, nicht einzeln pro Chunk), bevor die echten Zeilen
// gelöscht werden. Leere Gruppen werden danach automatisch mitgelöscht.
export async function POST(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Ungültiger API Key' }, { status: 401 })
  }

  const body = await req.json()
  const { claim_ids, owner_uuid } = body

  if (!Array.isArray(claim_ids) || claim_ids.length === 0 || !owner_uuid) {
    return NextResponse.json({ error: 'claim_ids (Array) und owner_uuid sind erforderlich' }, { status: 400 })
  }

  let claims
  try {
    const claimsResult = await pool.query(
      'SELECT * FROM claims WHERE id = ANY($1)',
      [claim_ids]
    )
    claims = claimsResult.rows
  } catch (err: any) {
    return NextResponse.json({ error: `Datenbankfehler: ${err.message}` }, { status: 500 })
  }

  const foreignClaims = claims.filter(c => c.owner_uuid !== owner_uuid)
  if (foreignClaims.length > 0) {
    return NextResponse.json(
      { error: `${foreignClaims.length} Chunk(s) gehören dir nicht und wurden nicht entfernt.` },
      { status: 403 }
    )
  }

  if (claims.length === 0) {
    return NextResponse.json({ error: 'Keine deiner Chunks im angegebenen Bereich gefunden' }, { status: 400 })
  }

  const actualClaimIds = claims.map(c => c.id)
  const affectedGroupIds = [...new Set(claims.map(c => c.group_id).filter(Boolean))]

  let permissions, trusts
  try {
    const permissionsResult = await pool.query(
      'SELECT * FROM claim_permissions WHERE claim_id = ANY($1)',
      [actualClaimIds]
    )
    permissions = permissionsResult.rows

    const trustsResult = await pool.query(
      'SELECT * FROM claim_trusts WHERE claim_id = ANY($1)',
      [actualClaimIds]
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
        `${claims.length} Chunks (Bereich)`,
        JSON.stringify(claims),
        JSON.stringify(permissions || []),
        JSON.stringify(trusts || []),
      ]
    )
  } catch (err: any) {
    return NextResponse.json({ error: `Snapshot konnte nicht erstellt werden: ${err.message}` }, { status: 500 })
  }

  try {
    await pool.query('DELETE FROM claim_permissions WHERE claim_id = ANY($1)', [actualClaimIds])
    await pool.query('DELETE FROM claim_trusts WHERE claim_id = ANY($1)', [actualClaimIds])
    await pool.query('DELETE FROM claims WHERE id = ANY($1)', [actualClaimIds])

    // Jede betroffene Gruppe prüfen, ob sie jetzt leer ist, und falls ja mitlöschen.
    let deletedGroups = 0
    for (const groupId of affectedGroupIds) {
      const remainingResult = await pool.query(
        'SELECT COUNT(*) AS count FROM claims WHERE group_id = $1',
        [groupId]
      )
      if (parseInt(remainingResult.rows[0].count, 10) === 0) {
        await pool.query('DELETE FROM claim_groups WHERE id = $1', [groupId])
        deletedGroups++
      }
    }

    return NextResponse.json({ success: true, unclaimedCount: claims.length, deletedGroups })
  } catch (err: any) {
    return NextResponse.json({ error: `Löschen fehlgeschlagen: ${err.message}` }, { status: 500 })
  }
}