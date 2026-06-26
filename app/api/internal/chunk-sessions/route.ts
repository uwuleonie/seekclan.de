import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// Schreibt einen Batch abgeschlossener (oder noch laufender) Chunk-Aufenthalte.
// Eine Session pro durchgängigem Aufenthalt in einem Claim - left_at ist NULL,
// solange der Spieler den Chunk beim letzten Sync noch nicht verlassen hatte
// (wird dann beim nächsten Sync nachträglich auf den tatsächlichen Wert gesetzt).
export async function POST(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Ungültiger API Key' }, { status: 401 })
  }

  const body = await req.json()
  const { sessions } = body

  if (!Array.isArray(sessions) || sessions.length === 0) {
    return NextResponse.json({ error: 'sessions (Array) ist erforderlich' }, { status: 400 })
  }

  try {
    for (const session of sessions) {
      const { claim_id, world, chunk_x, chunk_z, player_uuid, entered_at, left_at } = session

      if (!world || chunk_x === undefined || chunk_z === undefined || !player_uuid || !entered_at) {
        continue
      }

      await pool.query(
        `INSERT INTO smp_chunk_sessions (claim_id, world, chunk_x, chunk_z, player_uuid, entered_at, left_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [claim_id || null, world, chunk_x, chunk_z, player_uuid, entered_at, left_at || null]
      )
    }
  } catch (err: any) {
    return NextResponse.json({ error: `Chunk-Sessions konnten nicht gespeichert werden: ${err.message}` }, { status: 500 })
  }

  return NextResponse.json({ success: true, processed: sessions.length })
}