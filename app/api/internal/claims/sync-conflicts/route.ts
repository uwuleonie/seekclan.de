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
    'SELECT minecraft_uuid, minecraft_username FROM users WHERE id = $1',
    [session.user_id]
  )
  const user = userResult.rows[0]
  return user ? { uuid: user.minecraft_uuid as string | null, username: user.minecraft_username as string | null } : null
}

// Liefert alle offenen Sync-Konflikte des eingeloggten Spielers, mit den Namen/
// Details der betroffenen Chunks und Gruppen, damit das Modal direkt anzeigen
// kann "Chunk X grenzt an Gruppe Y" ohne weitere Anfragen.
export async function GET(req: NextRequest) {
  const account = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!account) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  if (!account.uuid) return NextResponse.json({ batches: [] })

  let batches
  try {
    const batchResult = await pool.query(
      `SELECT id, created_at, first_warned_at FROM claim_sync_conflict_batches
       WHERE owner_uuid = $1 AND resolved_at IS NULL AND expired_at IS NULL
       ORDER BY created_at ASC`,
      [account.uuid]
    )

    batches = []
    for (const batch of batchResult.rows) {
      const conflictsResult = await pool.query(
        `SELECT
           c.id,
           c.old_claim_id,
           c.new_group_id,
           c.resolution,
           c.sync_trusts,
           claims.name AS old_claim_name,
           claims.chunk_x AS old_claim_chunk_x,
           claims.chunk_z AS old_claim_chunk_z,
           groups.name AS new_group_name
         FROM claim_sync_conflicts c
         JOIN claims ON claims.id = c.old_claim_id
         JOIN claim_groups groups ON groups.id = c.new_group_id
         WHERE c.batch_id = $1 AND c.resolution IS NULL`,
        [batch.id]
      )
      batches.push({ ...batch, conflicts: conflictsResult.rows })
    }
  } catch (err: any) {
    return NextResponse.json({ error: `Datenbankfehler: ${err.message}` }, { status: 500 })
  }

  return NextResponse.json({ batches })
}

// Löst einen einzelnen Konflikt auf (oder mehrere auf einmal, siehe conflict_ids).
// Body: { conflict_ids: number[], resolution: 'group_to_chunk' | 'chunk_to_group' | 'keep_separate', sync_trusts?: boolean }
export async function POST(req: NextRequest) {
  const account = await getMinecraftUuid(req.cookies.get('session_token')?.value)
  if (!account) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  if (!account.uuid) return NextResponse.json({ error: 'Kein verknüpfter Minecraft-Account' }, { status: 400 })

  const body = await req.json()
  const { conflict_ids, resolution, sync_trusts } = body

  if (!Array.isArray(conflict_ids) || conflict_ids.length === 0) {
    return NextResponse.json({ error: 'conflict_ids (Array) ist erforderlich' }, { status: 400 })
  }
  if (!['group_to_chunk', 'chunk_to_group', 'keep_separate'].includes(resolution)) {
    return NextResponse.json({ error: 'resolution muss group_to_chunk, chunk_to_group oder keep_separate sein' }, { status: 400 })
  }

  let conflicts
  try {
    const result = await pool.query(
      `SELECT c.*, claims.owner_uuid AS claim_owner_uuid
       FROM claim_sync_conflicts c
       JOIN claims ON claims.id = c.old_claim_id
       WHERE c.id = ANY($1)`,
      [conflict_ids]
    )
    conflicts = result.rows
  } catch (err: any) {
    return NextResponse.json({ error: `Datenbankfehler: ${err.message}` }, { status: 500 })
  }

  const foreignConflicts = conflicts.filter(c => c.claim_owner_uuid !== account.uuid)
  if (foreignConflicts.length > 0) {
    return NextResponse.json({ error: 'Einer oder mehrere Konflikte gehören dir nicht' }, { status: 403 })
  }

  try {
    for (const conflict of conflicts) {
      if (resolution === 'chunk_to_group') {
        // Den Chunk wirklich in die Gruppe eingliedern - die bestehende
        // Permission-Hierarchie (group_* greift dann automatisch, da keine
        // chunk_*-Regeln mehr existieren, die Vorrang hätten) übernimmt den Rest.
        await pool.query('UPDATE claims SET group_id = $1 WHERE id = $2', [conflict.new_group_id, conflict.old_claim_id])
      }
      // Bei group_to_chunk und keep_separate bleibt group_id unverändert (NULL) -
      // der Chunk bleibt technisch ein Einzelgänger. Der Unterschied zwischen
      // beiden liegt nur darin, OB vorher Gruppen-Permissions auf den Chunk
      // kopiert wurden (siehe unten) - group_to_chunk kopiert, keep_separate nicht.

      if (resolution === 'group_to_chunk') {
        // Bestehende Gruppen-Permissions als neue chunk_*-Regeln auf den
        // Einzel-Chunk kopieren. Der Spieler wurde vorab über die Hierarchie
        // gewarnt (chunk_* hat immer Vorrang, bereits bestehende chunk_*-Regeln
        // auf diesem Claim bleiben unverändert bestehen und könnten die frisch
        // kopierten Gruppen-Regeln überstimmen).
        const groupRules = await pool.query(
          `SELECT * FROM claim_permissions WHERE scope IN ('group_all', 'group_player') AND group_id = $1`,
          [conflict.new_group_id]
        )
        for (const rule of groupRules.rows) {
          const chunkScope = rule.scope === 'group_all' ? 'chunk_all' : 'chunk_player'
          await pool.query(
            `INSERT INTO claim_permissions (owner_uuid, scope, claim_id, target_uuid, target_name, permission, allowed)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT DO NOTHING`,
            [account.uuid, chunkScope, conflict.old_claim_id, rule.target_uuid, rule.target_name, rule.permission, rule.allowed]
          )
        }
      }

      if (sync_trusts) {
        // Trusts der Gruppe (claim_id = NULL, global) betreffen automatisch
        // schon den ganzen Account - hier geht es nur um claim-spezifische
        // Trusts, die explizit auf andere Claims der Gruppe gesetzt wurden.
        const groupClaimsResult = await pool.query(
          'SELECT id FROM claims WHERE group_id = $1 LIMIT 1',
          [conflict.new_group_id]
        )
        const sampleClaimId = groupClaimsResult.rows[0]?.id
        if (sampleClaimId) {
          const trustsResult = await pool.query(
            `SELECT * FROM claim_trusts WHERE scope = 'claim' AND claim_id = $1`,
            [sampleClaimId]
          )
          for (const trust of trustsResult.rows) {
            await pool.query(
              `INSERT INTO claim_trusts (owner_uuid, owner_name, trusted_uuid, trusted_name, scope, claim_id)
               VALUES ($1, $2, $3, $4, 'claim', $5)
               ON CONFLICT DO NOTHING`,
              [account.uuid, trust.owner_name, trust.trusted_uuid, trust.trusted_name, conflict.old_claim_id]
            )
          }
        }
      }

      await pool.query(
        `UPDATE claim_sync_conflicts SET resolution = $1, sync_trusts = $2, resolved_at = now() WHERE id = $3`,
        [resolution, !!sync_trusts, conflict.id]
      )
    }

    // Falls das der letzte offene Konflikt im Batch war, den Batch als gelöst markieren.
    const batchIds = [...new Set(conflicts.map(c => c.batch_id))]
    for (const batchId of batchIds) {
      const remaining = await pool.query(
        `SELECT COUNT(*) AS count FROM claim_sync_conflicts WHERE batch_id = $1 AND resolution IS NULL`,
        [batchId]
      )
      if (parseInt(remaining.rows[0].count, 10) === 0) {
        await pool.query(`UPDATE claim_sync_conflict_batches SET resolved_at = now() WHERE id = $1`, [batchId])
      }
    }
  } catch (err: any) {
    return NextResponse.json({ error: `Auflösung fehlgeschlagen: ${err.message}` }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}