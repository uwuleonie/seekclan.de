// Diese Route ist bewusst OHNE Login-Check — sie ist der Zugang für
// Leute, denen Leonie einen Link gegeben hat. Der Token ist das Passwort.
import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

// GET /api/private/leonie/shares/validate?token=XYZ
// content_html ist bereits beim Speichern gereinigt (app/lib/rich-html.ts)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Kein Token angegeben.' }, { status: 400 })

  const shareResult = await pool.query(
    `SELECT id, note_id, share_all, label, expires_at
     FROM leonie_note_shares
     WHERE token = $1`,
    [token]
  )
  const share = shareResult.rows[0]
  if (!share) {
    return NextResponse.json({ error: 'Dieser Link ist ungültig.' }, { status: 404 })
  }

  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Dieser Link ist abgelaufen.' }, { status: 410 })
  }

  let notes
  if (share.share_all) {
    const result = await pool.query(
      `SELECT n.id, n.title, n.content, n.content_html, n.paper, n.created_at, n.updated_at,
              f.name AS folder_name, f.color AS folder_color
       FROM leonie_notes n
       LEFT JOIN leonie_folders f ON f.id = n.folder_id
       ORDER BY n.pinned DESC, n.updated_at DESC`
    )
    notes = result.rows
  } else {
    const result = await pool.query(
      `SELECT n.id, n.title, n.content, n.content_html, n.paper, n.created_at, n.updated_at,
              f.name AS folder_name, f.color AS folder_color
       FROM leonie_notes n
       LEFT JOIN leonie_folders f ON f.id = n.folder_id
       WHERE n.id = $1`,
      [share.note_id]
    )
    notes = result.rows
  }

  // Anhänge (Dateien aus Quick Share) dazuholen. Fehlt die Tabelle noch,
  // funktionieren geteilte Links trotzdem — nur eben ohne Anhänge.
  try {
    const ids = notes.map((n: { id: number }) => n.id)
    if (ids.length) {
      const att = await pool.query(
        `SELECT a.note_id, f.id, f.original_name, f.mime_type, f.kind, f.size_bytes, f.has_thumb, f.width, f.height
         FROM leonie_note_attachments a
         JOIN private_files f ON f.id = a.file_id AND f.status = 'ready'
         WHERE a.note_id = ANY($1::bigint[])
         ORDER BY a.sort_order ASC, a.id ASC`,
        [ids]
      )
      for (const n of notes) {
        n.attachments = att.rows.filter(a => String(a.note_id) === String(n.id)).map(({ note_id: _omit, ...rest }) => rest)
      }
    }
  } catch (err) {
    console.error('Geteilte Notiz: Anhänge nicht ladbar', (err as Error)?.message)
  }

  return NextResponse.json({
    share_all: share.share_all,
    label: share.label,
    notes,
  })
}