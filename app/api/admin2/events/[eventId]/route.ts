import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { deleteFile } from '@/app/lib/local-storage'
import { checkWrite, storeImage } from '@/app/lib/home-tiles'
import { parseEventForm, rowToEvent } from '@/app/lib/site-events'

// PATCH  /api/admin2/events/[eventId]
//   JSON:     { active: boolean }   → z. B. „Sofort beenden“ (active = false) oder wieder einschalten
//   FormData: alle Felder wie beim Anlegen, dazu file? (neues Bild) und removeImage? ('true')
// DELETE /api/admin2/events/[eventId]

type Ctx = { params: Promise<{ eventId: string }> }

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const id = Number((await ctx.params).eventId)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 })

  const cur = await pool.query('SELECT * FROM site_events WHERE id = $1', [id])
  const row = cur.rows[0]
  if (!row) return NextResponse.json({ error: 'Event nicht gefunden' }, { status: 404 })

  if ((req.headers.get('content-type') || '').includes('application/json')) {
    const body = await req.json().catch(() => ({})) as { active?: boolean }
    if (typeof body.active !== 'boolean') return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
    const r = await pool.query('UPDATE site_events SET active = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [body.active, id])
    return NextResponse.json({ event: rowToEvent(r.rows[0]) })
  }

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  const parsed = parseEventForm(form)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const v = parsed

  let filename: string | null = row.image_filename
  let newFile: string | null = null
  try {
    const file = form.get('file')
    if (file instanceof File && file.size > 0) { newFile = await storeImage(file, 'site-events'); filename = newFile }
    else if (form.get('removeImage') === 'true') filename = null
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }

  try {
    const r = await pool.query(
      `UPDATE site_events SET slug = $1, title = $2, subtitle = $3, href = $4, accent = $5, image_filename = $6,
         starts_at = $7, ends_at = $8, countdown_from = $9, active = $10, updated_at = NOW()
       WHERE id = $11 RETURNING *`,
      [v.slug, v.title, v.subtitle, v.href, v.accent, filename, v.startsAt, v.endsAt, v.countdownFrom, v.active, id]
    )
    if (row.image_filename && row.image_filename !== filename) {
      await deleteFile('site-content', `site-events/${row.image_filename}`).catch(() => {})
    }
    return NextResponse.json({ event: rowToEvent(r.rows[0]) })
  } catch (err) {
    if (newFile) await deleteFile('site-content', `site-events/${newFile}`).catch(() => {})
    const e = err as { code?: string; message?: string }
    if (e.code === '23505') return NextResponse.json({ error: 'Dieses Kürzel gibt es schon – bitte ein anderes wählen' }, { status: 400 })
    return NextResponse.json({ error: e.message || 'Serverfehler' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const id = Number((await ctx.params).eventId)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 })
  const r = await pool.query('DELETE FROM site_events WHERE id = $1 RETURNING image_filename', [id])
  if (!r.rows[0]) return NextResponse.json({ error: 'Event nicht gefunden' }, { status: 404 })
  if (r.rows[0].image_filename) await deleteFile('site-content', `site-events/${r.rows[0].image_filename}`).catch(() => {})
  return NextResponse.json({ success: true })
}