import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin } from '@/app/lib/csrf'
import { getLeonieUser } from '@/app/lib/leonie-auth'

// GET /api/private/leonie/notes
// Optional: ?folder_id=5  oder  ?folder_id=null (nur unsortierte)
export async function GET(req: NextRequest) {
  const user = await getLeonieUser(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const folderId = searchParams.get('folder_id')

  let query = `SELECT id, folder_id, title, content, created_at, updated_at
               FROM leonie_notes`
  const values: string[] = []

  if (folderId === 'null') {
    query += ' WHERE folder_id IS NULL'
  } else if (folderId) {
    query += ' WHERE folder_id = $1'
    values.push(folderId)
  }

  query += ' ORDER BY updated_at DESC'

  const result = await pool.query(query, values)
  return NextResponse.json(result.rows)
}

// POST /api/private/leonie/notes
export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  const user = await getLeonieUser(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const body = await req.json()
  const { title, content, folder_id } = body

  const result = await pool.query(
    `INSERT INTO leonie_notes (title, content, folder_id)
     VALUES ($1, $2, $3)
     RETURNING id, folder_id, title, content, created_at, updated_at`,
    [title?.trim() || 'Neue Notiz', content || '', folder_id || null]
  )
  return NextResponse.json(result.rows[0])
}