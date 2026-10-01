import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { deleteFile } from '@/app/lib/local-storage'
import { checkRead, checkWrite, cleanHref, ICON_PATTERN, rowToTile, storeImage } from '@/app/lib/home-tiles'

// Bereichs-Kacheln der Startseite (/admin2/startseite)
// GET  /api/admin2/home-tiles  → alle Kacheln (auch ausgeblendete), für Team lesbar
// POST /api/admin2/home-tiles  → neue Kachel (nur Administrator/Owner)
//      FormData: title, description?, href, icon?, active?, file? (Bild, JPG/PNG/WebP, max. 5 MB)

export async function GET(req: NextRequest) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  try {
    const r = await pool.query('SELECT * FROM home_tiles ORDER BY position ASC, id ASC')
    return NextResponse.json({ tiles: r.rows.map(rowToTile) })
  } catch (err) {
    const e = err as { code?: string; message?: string }
    if (e.code === '42P01') return NextResponse.json({ error: 'Tabelle home_tiles fehlt – bitte zuerst das SQL ausführen' }, { status: 500 })
    return NextResponse.json({ error: e.message || 'Serverfehler' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })

  const title = String(form.get('title') ?? '').trim().slice(0, 60)
  const description = String(form.get('description') ?? '').trim().slice(0, 160)
  const href = cleanHref(form.get('href'))
  const iconRaw = String(form.get('icon') ?? '').trim()
  const icon = iconRaw ? (ICON_PATTERN.test(iconRaw) ? iconRaw : null) : null
  const active = form.get('active') !== 'false'
  const file = form.get('file')

  if (!title) return NextResponse.json({ error: 'Titel fehlt' }, { status: 400 })
  if (!href) return NextResponse.json({ error: 'Link muss mit / (Seite auf seekclan.de) oder https:// beginnen' }, { status: 400 })
  if (iconRaw && !icon) return NextResponse.json({ error: 'Icon-Name ungültig (nur a–z, 0–9, _)' }, { status: 400 })

  let filename: string | null = null
  try {
    if (file instanceof File && file.size > 0) filename = await storeImage(file)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }

  try {
    const max = await pool.query('SELECT COALESCE(MAX(position), -1) AS p FROM home_tiles')
    const r = await pool.query(
      `INSERT INTO home_tiles (title, description, href, icon, image_filename, position, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [title, description || null, href, icon, filename, Number(max.rows[0].p) + 1, active]
    )
    return NextResponse.json({ tile: rowToTile(r.rows[0]) })
  } catch (err) {
    if (filename) await deleteFile('site-content', `home-tiles/${filename}`).catch(() => {})
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}