import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin } from '@/app/lib/csrf'
import { getLeonieUser } from '@/app/lib/leonie-auth'
import { FOLDER_COLS, notesError } from '../_notes'

// GET /api/private/leonie/folders — alle Ordner (flach, mit parent_id für den Baum)
export async function GET(req: NextRequest) {
  try {
    const user = await getLeonieUser(req)
    if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

    const result = await pool.query(`SELECT ${FOLDER_COLS} FROM leonie_folders ORDER BY sort_order ASC, name ASC`)
    return NextResponse.json(result.rows, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return notesError(err, 'GET folders')
  }
}

// POST /api/private/leonie/folders — { name, color?, parent_id? }
export async function POST(req: NextRequest) {
  try {
    if (!checkOrigin(req)) return NextResponse.json({ error: 'CSRF' }, { status: 403 })
    const user = await getLeonieUser(req)
    if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : ''
    if (!name) return NextResponse.json({ error: 'Name fehlt' }, { status: 400 })
    const color = typeof body.color === 'string' && /^#[0-9a-f]{6}$/i.test(body.color) ? body.color : '#d93690'
    const parentId = Number.isSafeInteger(Number(body.parent_id)) && body.parent_id !== null && body.parent_id !== '' ? Number(body.parent_id) : null

    const result = await pool.query(
      `INSERT INTO leonie_folders (name, color, parent_id, sort_order)
       VALUES ($1, $2, $3, COALESCE((SELECT MAX(sort_order) + 1 FROM leonie_folders), 0))
       RETURNING ${FOLDER_COLS}`,
      [name, color, parentId]
    )
    return NextResponse.json(result.rows[0])
  } catch (err) {
    return notesError(err, 'POST folders')
  }
}