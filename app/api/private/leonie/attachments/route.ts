import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { getLeonieUser } from '@/app/lib/leonie-auth'

// GET /api/private/leonie/attachments — Anzahl Anhänge pro Notiz { [note_id]: anzahl }
// Für das Büroklammer-Symbol in der Notizliste. Gibt {} zurück, falls die Tabelle
// (noch) nicht existiert — die Notizen sollen dann trotzdem ganz normal funktionieren.
export async function GET(req: NextRequest) {
  const user = await getLeonieUser(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  try {
    const r = await pool.query(
      `SELECT a.note_id, COUNT(*)::int AS n
       FROM leonie_note_attachments a
       JOIN private_files f ON f.id = a.file_id AND f.status = 'ready'
       WHERE f.user_id = $1
       GROUP BY a.note_id`,
      [user.id]
    )
    return NextResponse.json(Object.fromEntries(r.rows.map(row => [row.note_id, row.n])))
  } catch (err) {
    console.error('Notiz-Anhänge (Anzahl):', (err as Error)?.message)
    return NextResponse.json({})
  }
}