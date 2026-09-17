import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin } from '@/app/lib/csrf'
import { getLeonieUser } from '@/app/lib/leonie-auth'

// GET /api/private/leonie/shares — alle Shares auflisten
export async function GET(req: NextRequest) {
  const user = await getLeonieUser(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const result = await pool.query(
    `SELECT s.id, s.token, s.note_id, s.share_all, s.label,
            s.created_at, s.expires_at,
            n.title AS note_title
     FROM leonie_note_shares s
     LEFT JOIN leonie_notes n ON n.id = s.note_id
     ORDER BY s.created_at DESC`
  )
  return NextResponse.json(result.rows)
}

// POST /api/private/leonie/shares — neuen Zugriff erstellen
export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  const user = await getLeonieUser(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const body = await req.json()
  const { note_id, share_all, label, expires_at } = body

  if (!share_all && !note_id) {
    return NextResponse.json({ error: 'note_id oder share_all erforderlich' }, { status: 400 })
  }

  const result = await pool.query(
    `INSERT INTO leonie_note_shares (note_id, share_all, label, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id, token, note_id, share_all, label, created_at, expires_at`,
    [
      share_all ? null : note_id,
      share_all || false,
      label?.trim() || null,
      expires_at || null,
    ]
  )
  return NextResponse.json(result.rows[0])
}

// DELETE /api/private/leonie/shares?id=X — Zugriff widerrufen
export async function DELETE(req: NextRequest) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  const user = await getLeonieUser(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  await pool.query('DELETE FROM leonie_note_shares WHERE id = $1', [id])
  return NextResponse.json({ ok: true })
}