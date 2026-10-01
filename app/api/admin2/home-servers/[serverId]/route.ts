import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { deleteFile } from '@/app/lib/local-storage'
import { checkWrite, cleanAddress, ICON_PATTERN, rowToServer, storeImage } from '@/app/lib/home-tiles'

// PATCH  /api/admin2/home-servers/[serverId]
//   JSON:     { move: 'up' | 'down' }  oder  { active: boolean }
//   FormData: address, name, description, version, icon, active, file? (neues Bild), removeImage? ('true')
// DELETE /api/admin2/home-servers/[serverId]

type Ctx = { params: Promise<{ serverId: string }> }

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const id = Number((await ctx.params).serverId)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 })

  const cur = await pool.query('SELECT * FROM home_servers WHERE id = $1', [id])
  const row = cur.rows[0]
  if (!row) return NextResponse.json({ error: 'Server nicht gefunden' }, { status: 404 })

  // Schnelle Aktionen per JSON
  if ((req.headers.get('content-type') || '').includes('application/json')) {
    const body = await req.json().catch(() => ({})) as { move?: 'up' | 'down'; active?: boolean }
    if (body.move === 'up' || body.move === 'down') {
      const all = (await pool.query('SELECT id FROM home_servers ORDER BY position ASC, id ASC')).rows.map(r => Number(r.id))
      const i = all.indexOf(id)
      const j = body.move === 'up' ? i - 1 : i + 1
      if (i >= 0 && j >= 0 && j < all.length) {
        ;[all[i], all[j]] = [all[j], all[i]]
        for (let k = 0; k < all.length; k++) await pool.query('UPDATE home_servers SET position = $1 WHERE id = $2', [k, all[k]])
      }
    }
    if (typeof body.active === 'boolean') {
      await pool.query('UPDATE home_servers SET active = $1, updated_at = NOW() WHERE id = $2', [body.active, id])
    }
    const r = await pool.query('SELECT * FROM home_servers WHERE id = $1', [id])
    return NextResponse.json({ server: rowToServer(r.rows[0]) })
  }

  // Bearbeiten per FormData
  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  const address = cleanAddress(form.get('address'))
  const name = String(form.get('name') ?? '').trim().slice(0, 60)
  const description = String(form.get('description') ?? '').trim().slice(0, 140)
  const version = String(form.get('version') ?? '').trim().slice(0, 30)
  const iconRaw = String(form.get('icon') ?? '').trim()
  const icon = iconRaw && ICON_PATTERN.test(iconRaw) ? iconRaw : null
  const active = form.get('active') !== 'false'
  const file = form.get('file')
  const removeImage = form.get('removeImage') === 'true'

  if (!address) return NextResponse.json({ error: 'Adresse ungültig – z. B. modpack.seekclan.de oder play.example.net:25566' }, { status: 400 })
  if (!name) return NextResponse.json({ error: 'Name fehlt' }, { status: 400 })
  if (iconRaw && !icon) return NextResponse.json({ error: 'Icon-Name ungültig (nur a–z, 0–9, _)' }, { status: 400 })

  let filename: string | null = row.image_filename
  let newFile: string | null = null
  try {
    if (file instanceof File && file.size > 0) { newFile = await storeImage(file, 'home-servers'); filename = newFile }
    else if (removeImage) filename = null
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }

  try {
    const r = await pool.query(
      `UPDATE home_servers SET address = $1, name = $2, description = $3, version = $4, icon = $5, image_filename = $6, active = $7, updated_at = NOW()
       WHERE id = $8 RETURNING *`,
      [address, name, description || null, version || null, icon, filename, active, id]
    )
    if (row.image_filename && row.image_filename !== filename) {
      await deleteFile('site-content', `home-servers/${row.image_filename}`).catch(() => {})
    }
    return NextResponse.json({ server: rowToServer(r.rows[0]) })
  } catch (err) {
    if (newFile) await deleteFile('site-content', `home-servers/${newFile}`).catch(() => {})
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const id = Number((await ctx.params).serverId)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 })
  const r = await pool.query('DELETE FROM home_servers WHERE id = $1 RETURNING image_filename', [id])
  if (!r.rows[0]) return NextResponse.json({ error: 'Server nicht gefunden' }, { status: 404 })
  if (r.rows[0].image_filename) await deleteFile('site-content', `home-servers/${r.rows[0].image_filename}`).catch(() => {})
  return NextResponse.json({ success: true })
}