import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// Wird vom Plugin bei Login und bei jeder Claim-Interaktion aufgerufen, um zu
// prüfen, ob ein Spieler offene Sync-Konflikte hat - und setzt dabei
// first_warned_at, falls das die allererste gesehene Warnung für diesen Batch
// ist (die 96h-Frist beginnt erst ab diesem Zeitpunkt zu laufen, nicht ab
// Entstehung des Konflikts).
export async function GET(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Ungültiger API Key' }, { status: 401 })
  }

  const ownerUuid = req.nextUrl.searchParams.get('owner_uuid')
  if (!ownerUuid) {
    return NextResponse.json({ error: 'owner_uuid ist erforderlich' }, { status: 400 })
  }

  let batches
  try {
    const result = await pool.query(
      `SELECT id, first_warned_at FROM claim_sync_conflict_batches
       WHERE owner_uuid = $1 AND resolved_at IS NULL AND expired_at IS NULL`,
      [ownerUuid]
    )
    batches = result.rows

    const unwarned = batches.filter(b => !b.first_warned_at)
    if (unwarned.length > 0) {
      await pool.query(
        `UPDATE claim_sync_conflict_batches SET first_warned_at = now()
         WHERE id = ANY($1)`,
        [unwarned.map(b => b.id)]
      )
    }
  } catch (err: any) {
    return NextResponse.json({ error: `Datenbankfehler: ${err.message}` }, { status: 500 })
  }

  return NextResponse.json({ openBatchCount: batches.length })
}