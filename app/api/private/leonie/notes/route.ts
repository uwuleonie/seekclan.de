import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin } from '@/app/lib/csrf'
import { getLeonieUser } from '@/app/lib/leonie-auth'
import { NOTE_FULL_COLS, NOTE_LIST_COLS, notesError, readNoteFields } from '../_notes'

// GET /api/private/leonie/notes — alle Notizen (ohne formatierten Inhalt, der kommt über /notes/[id])
//     Optional: ?folder_id=5  oder  ?folder_id=null (nur unsortierte)
export async function GET(req: NextRequest) {
  try {
    const user = await getLeonieUser(req)
    if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

    const folderId = req.nextUrl.searchParams.get('folder_id')
    const values: unknown[] = []
    let where = ''
    if (folderId === 'null') where = ' WHERE folder_id IS NULL'
    else if (folderId && /^\d+$/.test(folderId)) { where = ' WHERE folder_id = $1'; values.push(Number(folderId)) }

    const result = await pool.query(
      `SELECT ${NOTE_LIST_COLS}, (content_html IS NOT NULL) AS rich FROM leonie_notes${where}
       ORDER BY pinned DESC, updated_at DESC`,
      values
    )
    return NextResponse.json(result.rows, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return notesError(err, 'GET notes')
  }
}

// POST /api/private/leonie/notes — { title?, content?, content_html?, folder_id?, paper?, pinned? }
export async function POST(req: NextRequest) {
  try {
    if (!checkOrigin(req)) return NextResponse.json({ error: 'CSRF' }, { status: 403 })
    const user = await getLeonieUser(req)
    if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const f = readNoteFields(body)
    const result = await pool.query(
      `INSERT INTO leonie_notes (title, content, content_html, folder_id, paper, pinned)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${NOTE_FULL_COLS}`,
      [f.title ?? 'Neue Notiz', f.content ?? '', f.content_html ?? null, f.folder_id ?? null, f.paper ?? 'plain', f.pinned ?? false]
    )
    return NextResponse.json(result.rows[0])
  } catch (err) {
    return notesError(err, 'POST notes')
  }
}