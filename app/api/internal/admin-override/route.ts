import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// Erstellt einen Admin-Claim und verschiebt - falls auf diesem Chunk bereits ein
// NORMALER Claim existiert - diesen vorher in den Papierkorb (mit is_admin_override=true,
// damit der ursprüngliche Spieler ihn zwar sehen, aber NICHT selbst wiederherstellen kann).
export async function POST(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Ungültiger API Key' }, { status: 401 })
  }

  const body = await req.json()
  const { owner_uuid, owner_name, world, chunk_x, chunk_z, name } = body

  if (!owner_uuid || !owner_name || !world || chunk_x === undefined || chunk_z === undefined) {
    return NextResponse.json(
      { error: 'owner_uuid, owner_name, world, chunk_x und chunk_z sind erforderlich' },
      { status: 400 }
    )
  }

  let existing
  try {
    const existingResult = await pool.query(
      'SELECT * FROM claims WHERE world = $1 AND chunk_x = $2 AND chunk_z = $3',
      [world, chunk_x, chunk_z]
    )
    existing = existingResult.rows[0]
  } catch (err: any) {
    return NextResponse.json({ error: `Datenbankfehler: ${err.message}` }, { status: 500 })
  }

  if (existing && existing.is_admin_claim) {
    return NextResponse.json({ error: 'Dieser Chunk ist bereits ein Admin-Claim.' }, { status: 409 })
  }

  try {
    if (existing) {
      // Vorhandenen normalen Claim in den Papierkorb verschieben, MIT
      // is_admin_override-Flag - der Spieler bleibt owner_uuid des Trash-Eintrags
      // (er sieht ihn weiterhin in seinem eigenen Papierkorb), kann ihn aber wegen
      // des Flags nicht selbst wiederherstellen.
      const permissionsResult = await pool.query('SELECT * FROM claim_permissions WHERE claim_id = $1', [existing.id])
      const trustsResult = await pool.query('SELECT * FROM claim_trusts WHERE claim_id = $1', [existing.id])

      await pool.query(
        `INSERT INTO claim_trash (owner_uuid, group_name, claims_snapshot, permissions_snapshot, trusts_snapshot, is_admin_override)
         VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, true)`,
        [
          existing.owner_uuid,
          existing.name || `Chunk ${chunk_x},${chunk_z}`,
          JSON.stringify([existing]),
          JSON.stringify(permissionsResult.rows),
          JSON.stringify(trustsResult.rows),
        ]
      )

      await pool.query('DELETE FROM claim_permissions WHERE claim_id = $1', [existing.id])
      await pool.query('DELETE FROM claim_trusts WHERE claim_id = $1', [existing.id])
      await pool.query('DELETE FROM claims WHERE id = $1', [existing.id])

      // Falls der alte Claim in einer Gruppe war und das der letzte verbleibende
      // Chunk war, die jetzt leere Gruppe mitlöschen (gleiches Prinzip wie bei /unclaim).
      if (existing.group_id) {
        const remainingResult = await pool.query('SELECT COUNT(*) AS count FROM claims WHERE group_id = $1', [existing.group_id])
        if (parseInt(remainingResult.rows[0].count, 10) === 0) {
          await pool.query('DELETE FROM claim_groups WHERE id = $1', [existing.group_id])
        }
      }
    }

    const result = await pool.query(
      `INSERT INTO claims (owner_uuid, owner_name, world, chunk_x, chunk_z, name, is_admin_claim)
       VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING *`,
      [owner_uuid, owner_name, world, chunk_x, chunk_z, name || null]
    )

    // Den vorherigen Besitzer (falls vorhanden) per Notification informieren -
    // taucht beim nächsten Login auf der Website auf.
    if (existing) {
      const previousOwnerResult = await pool.query('SELECT id FROM users WHERE minecraft_uuid = $1', [existing.owner_uuid])
      const previousOwnerUser = previousOwnerResult.rows[0]
      if (previousOwnerUser) {
        await pool.query(
          `INSERT INTO notifications (user_id, category, title, body, link) VALUES ($1, $2, $3, $4, $5)`,
          [
            previousOwnerUser.id, 'system',
            `Dein Claim wurde von einem Admin übernommen`,
            `Der Chunk ${chunk_x},${chunk_z} (${existing.name || 'unbenannt'}) wurde zu einem Admin-Claim. Du kannst ihn in deinem Papierkorb einsehen, aber nicht selbst wiederherstellen.`,
            '/smp/claims/trash',
          ]
        )
      }
    }

    return NextResponse.json({ claim: result.rows[0], overwroteExisting: !!existing })
  } catch (err: any) {
    return NextResponse.json({ error: `Admin-Claim konnte nicht erstellt werden: ${err.message}` }, { status: 500 })
  }
}