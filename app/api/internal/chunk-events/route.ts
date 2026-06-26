import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// Schreibt einen ganzen Batch von Chunk-Events auf einmal (gesammelt im Plugin
// über 5 Minuten, dann gemeinsam abgeschickt - siehe ChunkActivityTracker).
// Jeder Eintrag landet sowohl in der Rohdaten-Tabelle (smp_chunk_events, 30 Tage
// Aufbewahrung) als auch in der permanenten Aggregat-Tabelle
// (smp_chunk_activity_totals), die auch nach dem Löschen alter Rohdaten den
// Gesamtstand behält.
export async function POST(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Ungültiger API Key' }, { status: 401 })
  }

  const body = await req.json()
  const { events } = body

  if (!Array.isArray(events) || events.length === 0) {
    return NextResponse.json({ error: 'events (Array) ist erforderlich' }, { status: 400 })
  }

  try {
    for (const event of events) {
      const { claim_id, world, chunk_x, chunk_z, player_uuid, event_type, detail, count } = event

      if (!world || chunk_x === undefined || chunk_z === undefined || !player_uuid || !event_type) {
        continue // ein einzelner fehlerhafter Eintrag soll nicht den ganzen Batch abbrechen
      }

      const amount = count || 1

      // Eine Sammel-Zeile für die letzten 5 Minuten in den Rohdaten - mit der
      // tatsächlichen Anzahl als "detail"-unabhängiges Aggregat würde Granularität
      // verlieren, daher: EIN Rohdaten-Eintrag pro Batch-Position mit occurred_at
      // = jetzt, repräsentiert "amount Vorkommnisse in diesem 5-Minuten-Fenster".
      await pool.query(
        `INSERT INTO smp_chunk_events (claim_id, world, chunk_x, chunk_z, player_uuid, event_type, detail, occurred_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
        [claim_id || null, world, chunk_x, chunk_z, player_uuid, event_type, detail || null]
      )

      await pool.query(
        `INSERT INTO smp_chunk_activity_totals (claim_id, world, chunk_x, chunk_z, player_uuid, event_type, detail, total_count, first_occurred_at, last_occurred_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
         ON CONFLICT (world, chunk_x, chunk_z, player_uuid, event_type, COALESCE(detail, ''))
         DO UPDATE SET total_count = smp_chunk_activity_totals.total_count + $8, last_occurred_at = now(), claim_id = EXCLUDED.claim_id`,
        [claim_id || null, world, chunk_x, chunk_z, player_uuid, event_type, detail || null, amount]
      )
    }
  } catch (err: any) {
    return NextResponse.json({ error: `Chunk-Events konnten nicht gespeichert werden: ${err.message}` }, { status: 500 })
  }

  return NextResponse.json({ success: true, processed: events.length })
}