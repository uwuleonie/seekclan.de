import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { deleteFile } from '@/app/lib/local-storage'
import { checkRead, checkWrite, storeImage } from '@/app/lib/home-tiles'
import { parseEventForm, rowToEvent } from '@/app/lib/site-events'

// Events mit Countdown auf der Startseite (/admin2/events)
// GET  /api/admin2/events → alle Events (Team darf lesen)
// POST /api/admin2/events → neues Event (nur Administrator/Owner)
//      FormData: slug, title, subtitle?, href?, accent?, startsAt, endsAt, countdownFrom?, active?, file? (Bild)

export async function GET(req: NextRequest) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  try {
    const r = await pool.query('SELECT * FROM site_events ORDER BY starts_at DESC, id DESC')
    return NextResponse.json({ events: r.rows.map(rowToEvent) })
  } catch (err) {
    const e = err as { code?: string; message?: string }
    if (e.code === '42P01') return NextResponse.json({ error: 'Tabelle site_events fehlt – bitte zuerst das SQL ausführen' }, { status: 500 })
    return NextResponse.json({ error: e.message || 'Serverfehler' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })

  const parsed = parseEventForm(form)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const v = parsed

  let filename: string | null = null
  try {
    const file = form.get('file')
    if (file instanceof File && file.size > 0) filename = await storeImage(file, 'site-events')
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }

  try {
    const r = await pool.query(
      `INSERT INTO site_events (slug, title, subtitle, href, accent, image_filename, starts_at, ends_at, countdown_from, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [v.slug, v.title, v.subtitle, v.href, v.accent, filename, v.startsAt, v.endsAt, v.countdownFrom, v.active]
    )
    return NextResponse.json({ event: rowToEvent(r.rows[0]) })
  } catch (err) {
    if (filename) await deleteFile('site-content', `site-events/${filename}`).catch(() => {})
    const e = err as { code?: string; message?: string }
    if (e.code === '23505') return NextResponse.json({ error: 'Dieses Kürzel gibt es schon – bitte ein anderes wählen' }, { status: 400 })
    return NextResponse.json({ error: e.message || 'Serverfehler' }, { status: 500 })
  }
}