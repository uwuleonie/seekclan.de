import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin } from '@/app/lib/csrf'
import { getLeonieUser } from '@/app/lib/leonie-auth'

// PATCH /api/private/leonie/notes/[id]
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

  if (typeof body.title === 'string') {
    fields.push(`title = $${i++}`)
    values.push(body.title.trim() || 'Ohne Titel')
  }
  if (typeof body.content === 'string') {
    fields.push(`content = $${i++}`)
    values.push(body.content)
  }
  // folder_id = null ist gewollt erlaubt (Notiz aus Ordner rausnehmen)
  if ('folder_id' in body) {
    fields.push(`folder_id = $${i++}`)
    values.push(body.folder_id ?? null)
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: 'Nichts zu ändern' }, { status: 400 })
  }

  fields.push('updated_at = NOW()')
  values.push(id)

  const result = await pool.query(
    `UPDATE leonie_notes SET ${fields.join(', ')}
     WHERE id = $${i}
     RETURNING id, folder_id, title, content, created_at, updated_at`,
    values
  )

  if (!result.rows[0]) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  return NextResponse.json(result.rows[0])
}

// DELETE /api/private/leonie/notes/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  const user = await getLeonieUser(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { id } = await params
  await pool.query('DELETE FROM leonie_notes WHERE id = $1', [id])
  return NextResponse.json({ ok: true })
}