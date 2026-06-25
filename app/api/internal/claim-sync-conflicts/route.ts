import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// Erstellt einen neuen Sync-Konflikt-Batch mit einem oder mehreren Konflikten
// (ein Batch pro /claimarea-Ausführung, die auf alte Einzel-Chunks desselben
// Spielers angrenzt). first_warned_at bleibt zunächst NULL - wird erst beim
// ersten tatsächlich gesehenen Login-Hinweis gesetzt (siehe /mark-warned Route),
// da die 96h-Frist erst ab diesem Zeitpunkt zu laufen beginnt.
export async function POST(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Ungültiger API Key' }, { status: 401 })
  }

  const body = await req.json()
  const { owner_uuid, conflicts } = body

  if (!owner_uuid || !Array.isArray(conflicts) || conflicts.length === 0) {
    return NextResponse.json(
      { error: 'owner_uuid und conflicts (Array von {old_claim_id, new_group_id}) sind erforderlich' },
      { status: 400 }
    )
  }

  for (const conflict of conflicts) {
    if (!conflict.old_claim_id || !conflict.new_group_id) {
      return NextResponse.json(
        { error: 'Jeder Konflikt braucht old_claim_id und new_group_id' },
        { status: 400 }
      )
    }
  }

  let batchId
  try {
    const batchResult = await pool.query(
      `INSERT INTO claim_sync_conflict_batches (owner_uuid) VALUES ($1) RETURNING id`,
      [owner_uuid]
    )
    batchId = batchResult.rows[0].id

    for (const conflict of conflicts) {
      await pool.query(
        `INSERT INTO claim_sync_conflicts (batch_id, old_claim_id, new_group_id)
         VALUES ($1, $2, $3)`,
        [batchId, conflict.old_claim_id, conflict.new_group_id]
      )
    }
  } catch (err: any) {
    return NextResponse.json({ error: `Konflikt-Batch konnte nicht erstellt werden: ${err.message}` }, { status: 500 })
  }

  return NextResponse.json({ batch_id: batchId })
}