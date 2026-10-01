import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { deleteFile } from '@/app/lib/local-storage'
import { checkWrite, cleanHref, ICON_PATTERN, rowToTile, storeImage } from '@/app/lib/home-tiles'

// PATCH  /api/admin2/home-tiles/[tileId]
//   JSON:     { move: 'up' | 'down' }  oder  { active: boolean }
//   FormData: title, description, href, icon, active, file? (neues Bild), removeImage? ('true')
// DELETE /api/admin2/home-tiles/[tileId]

type Ctx = { params: Promise<{ tileId: string }> }

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const id = Number((await ctx.params).tileId)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 })

  const cur = await pool.query('SELECT * FROM home_tiles WHERE id = $1', [id])
  const tile = cur.rows[0]
  if (!tile) return NextResponse.json({ error: 'Kachel nicht gefunden' }, { status: 404 })

  // Schnelle Aktionen per JSON
  if ((req.headers.get('content-type') || '').includes('application/json')) {
    const body = await req.json().catch(() => ({})) as { move?: 'up' | 'down'; active?: boolean }
    if (body.move === 'up' || body.move === 'down') {
      // Reihenfolge neu durchnummerieren, dann mit dem Nachbarn tauschen
      const all = (await pool.query('SELECT id FROM home_tiles ORDER BY position ASC, id ASC')).rows.map(r => Number(r.id))
      const i = all.indexOf(id)
      const j = body.move === 'up' ? i - 1 : i + 1
      if (i >= 0 && j >= 0 && j < all.length) {
        ;[all[i], all[j]] = [all[j], all[i]]
        for (let k = 0; k < all.length; k++) {
          await pool.query('UPDATE home_tiles SET position = $1 WHERE id = $2', [k, all[k]])
        }
      }
    }
    if (typeof body.active === 'boolean') {
      await pool.query('UPDATE home_tiles SET active = $1, updated_at = NOW() WHERE id = $2', [body.active, id])
    }
    const r = await pool.query('SELECT * FROM home_tiles WHERE id = $1', [id])
    return NextResponse.json({ tile: rowToTile(r.rows[0]) })
  }

  // Bearbeiten per FormData
  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  const title = String(form.get('title') ?? '').trim().slice(0, 60)
  const description = String(form.get('description') ?? '').trim().slice(0, 160)
  const href = cleanHref(form.get('href'))
  const iconRaw = String(form.get('icon') ?? '').trim()
  const icon = iconRaw ? (ICON_PATTERN.test(iconRaw) ? iconRaw : null) : null
  const active = form.get('active') !== 'false'
  const file = form.get('file')
  const removeImage = form.get('removeImage') === 'true'

  if (!title) return NextResponse.json({ error: 'Titel fehlt' }, { status: 400 })
  if (!href) return NextResponse.json({ error: 'Link muss mit / (Seite auf seekclan.de) oder https:// beginnen' }, { status: 400 })
  if (iconRaw && !icon) return NextResponse.json({ error: 'Icon-Name ungültig (nur a–z, 0–9, _)' }, { status: 400 })

  let filename: string | null = tile.image_filename
  let newFile: string | null = null
  try {
    if (file instanceof File && file.size > 0) { newFile = await storeImage(file); filename = newFile }
    else if (removeImage) filename = null
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }

  try {
    const r = await pool.query(
      `UPDATE home_tiles SET title = $1, description = $2, href = $3, icon = $4, image_filename = $5, active = $6, updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [title, description || null, href, icon, filename, active, id]
    )
    // altes Bild aufräumen
    if (tile.image_filename && tile.image_filename !== filename) {
      await deleteFile('site-content', `home-tiles/${tile.image_filename}`).catch(() => {})
    }
    return NextResponse.json({ tile: rowToTile(r.rows[0]) })
  } catch (err) {
    if (newFile) await deleteFile('site-content', `home-tiles/${newFile}`).catch(() => {})
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const id = Number((await ctx.params).tileId)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 })
  const r = await pool.query('DELETE FROM home_tiles WHERE id = $1 RETURNING image_filename', [id])
  if (!r.rows[0]) return NextResponse.json({ error: 'Kachel nicht gefunden' }, { status: 404 })
  if (r.rows[0].image_filename) await deleteFile('site-content', `home-tiles/${r.rows[0].image_filename}`).catch(() => {})
  return NextResponse.json({ success: true })
}