import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin } from '@/app/lib/csrf'
import { getLeonieUser } from '@/app/lib/leonie-auth'

// PATCH /api/private/leonie/folders/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  const user = await getLeonieUser(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { id } = await params
  const body = await req.json()

  const fields: string[] = []
  const values: unknown[] = []
  let i = 1

  if (typeof body.name === 'string' && body.name.trim()) {
    fields.push(`name = $${i++}`)
    values.push(body.name.trim())
  }
  if (typeof body.color === 'string') {
    fields.push(`color = $${i++}`)
    values.push(body.color)
  }
  if (typeof body.sort_order === 'number') {
    fields.push(`sort_order = $${i++}`)
    values.push(body.sort_order)
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: 'Nichts zu ändern' }, { status: 400 })
  }

  values.push(id)
  const result = await pool.query(
    `UPDATE leonie_folders SET ${fields.join(', ')}
     WHERE id = $${i}
     RETURNING id, name, color, sort_order, created_at`,
    values
  )

  if (!result.rows[0]) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  return NextResponse.json(result.rows[0])
}

// DELETE /api/private/leonie/folders/[id]
// Notizen im Ordner bleiben erhalten (ON DELETE SET NULL in der DB)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  const user = await getLeonieUser(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { id } = await params
  await pool.query('DELETE FROM leonie_folders WHERE id = $1', [id])
  return NextResponse.json({ ok: true })
}