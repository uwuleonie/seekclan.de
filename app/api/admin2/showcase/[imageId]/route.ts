import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { deleteFile } from '@/app/lib/local-storage'

async function checkWrite(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT id, clan_role FROM users WHERE id = $1', [session.user_id])
  const user = userResult.rows[0]
  if (!user || (user.clan_role !== 'administrator' && user.clan_role !== 'owner')) return null
  return user
}

// PATCH /api/admin2/showcase/[imageId]
// Body: { caption?: string } zum Umbenennen der Bildunterschrift, oder
//       { move: 'up' | 'down' } zum Vertauschen der Position mit dem
// jeweiligen Nachbarn in der Reihenfolge (einfacher als Drag&Drop, aber
// erreicht dasselbe Ergebnis für eine Galerie mit überschaubar vielen Bildern).
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ imageId: string }> }
) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { imageId } = await context.params
  const { caption, move } = await req.json().catch(() => ({})) as { caption?: string, move?: 'up' | 'down' }

  try {
    if (caption !== undefined) {
      await pool.query('UPDATE showcase_images SET caption = $1 WHERE id = $2', [caption.trim() || null, imageId])
    }

    if (move === 'up' || move === 'down') {
      const currentResult = await pool.query('SELECT id, position FROM showcase_images WHERE id = $1', [imageId])
      const current = currentResult.rows[0]
      if (!current) return NextResponse.json({ error: 'Bild nicht gefunden' }, { status: 404 })

      const neighborResult = await pool.query(
        move === 'up'
          ? 'SELECT id, position FROM showcase_images WHERE position < $1 ORDER BY position DESC LIMIT 1'
          : 'SELECT id, position FROM showcase_images WHERE position > $1 ORDER BY position ASC LIMIT 1',
        [current.position]
      )
      const neighbor = neighborResult.rows[0]
      if (neighbor) {
        await pool.query('UPDATE showcase_images SET position = $1 WHERE id = $2', [neighbor.position, current.id])
        await pool.query('UPDATE showcase_images SET position = $1 WHERE id = $2', [current.position, neighbor.id])
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/admin2/showcase/[imageId]
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ imageId: string }> }
) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { imageId } = await context.params

  const rowResult = await pool.query('SELECT filename FROM showcase_images WHERE id = $1', [imageId])
  const row = rowResult.rows[0]
  if (!row) return NextResponse.json({ error: 'Bild nicht gefunden' }, { status: 404 })

  await deleteFile('site-content', `showcase/${row.filename}`)
  await pool.query('DELETE FROM showcase_images WHERE id = $1', [imageId])

  return NextResponse.json({ success: true })
}