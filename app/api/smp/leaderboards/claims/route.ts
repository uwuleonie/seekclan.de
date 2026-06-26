import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

// Top 10 Claims oder Gruppen nach insgesamt verbrachter Zeit (aus smp_chunk_sessions).
// ?mode=chunks (Standard) liefert Top 10 Einzelchunks, ?mode=groups liefert Top 10
// Gruppen (Zeit über alle Chunks der Gruppe summiert).
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('mode') === 'groups' ? 'groups' : 'chunks'

  try {
    if (mode === 'chunks') {
      const result = await pool.query(`
        SELECT
          c.id AS claim_id,
          c.name,
          c.world,
          c.chunk_x,
          c.chunk_z,
          c.owner_uuid,
          c.owner_name,
          c.claimed_at,
          c.group_id,
          COALESCE(SUM(EXTRACT(EPOCH FROM (s.left_at - s.entered_at))), 0) AS total_seconds
        FROM claims c
        LEFT JOIN smp_chunk_sessions s ON s.claim_id = c.id AND s.left_at IS NOT NULL
        WHERE c.is_admin_claim = false
        GROUP BY c.id
        ORDER BY total_seconds DESC
        LIMIT 10
      `)
      return NextResponse.json({ mode, entries: result.rows })
    }

    const result = await pool.query(`
      SELECT
        g.id AS group_id,
        g.name,
        g.owner_uuid,
        g.owner_name,
        g.created_at,
        COUNT(DISTINCT c.id) AS chunk_count,
        COALESCE(SUM(EXTRACT(EPOCH FROM (s.left_at - s.entered_at))), 0) AS total_seconds
      FROM claim_groups g
      JOIN claims c ON c.group_id = g.id AND c.is_admin_claim = false
      LEFT JOIN smp_chunk_sessions s ON s.claim_id = c.id AND s.left_at IS NOT NULL
      GROUP BY g.id
      ORDER BY total_seconds DESC
      LIMIT 10
    `)
    return NextResponse.json({ mode, entries: result.rows })
  } catch (err: any) {
    return NextResponse.json({ error: `Datenbankfehler: ${err.message}` }, { status: 500 })
  }
}