import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// Findet alle Batches, deren 96h-Frist (ab first_warned_at) abgelaufen ist und
// noch nicht aufgelöst wurden, markiert sie als expired und gibt zurück, für
// welche Spieler eine "Info: ist jetzt automatisch passiert"-Nachricht nötig ist.
// Wird vom Plugin periodisch aufgerufen (z.B. alle 5-10 Minuten).
export async function POST(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Ungültiger API Key' }, { status: 401 })
  }

  let expiredBatches
  try {
    const result = await pool.query(
      `UPDATE claim_sync_conflict_batches
       SET expired_at = now()
       WHERE resolved_at IS NULL
         AND expired_at IS NULL
         AND first_warned_at IS NOT NULL
         AND first_warned_at < now() - interval '96 hours'
       RETURNING id, owner_uuid`
    )
    expiredBatches = result.rows
  } catch (err: any) {
    return NextResponse.json({ error: `Datenbankfehler: ${err.message}` }, { status: 500 })
  }

  return NextResponse.json({ expiredBatches })
}