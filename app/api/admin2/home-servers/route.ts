import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { deleteFile } from '@/app/lib/local-storage'
import { checkRead, checkWrite, cleanAddress, ICON_PATTERN, rowToServer, storeImage } from '@/app/lib/home-tiles'

// Weitere Server-Adressen der Startseite (/admin2/startseite → „Weitere Server“)
// Sie klappen auf, wenn man über die Adresse seekclan.de fährt.
// GET  /api/admin2/home-servers → alle (auch ausgeblendete), für Team lesbar
// POST /api/admin2/home-servers → neu (nur Administrator/Owner)
//      FormData: address, name, description?, version?, icon?, active?, file? (Bild)

export async function GET(req: NextRequest) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  try {
    const r = await pool.query('SELECT * FROM home_servers ORDER BY position ASC, id ASC')
    return NextResponse.json({ servers: r.rows.map(rowToServer) })
  } catch (err) {
    const e = err as { code?: string; message?: string }
    if (e.code === '42P01') return NextResponse.json({ error: 'Tabelle home_servers fehlt – bitte zuerst das SQL ausführen' }, { status: 500 })
    return NextResponse.json({ error: e.message || 'Serverfehler' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

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

  if (!address) return NextResponse.json({ error: 'Adresse ungültig – z. B. modpack.seekclan.de oder play.example.net:25566' }, { status: 400 })
  if (!name) return NextResponse.json({ error: 'Name fehlt' }, { status: 400 })
  if (iconRaw && !icon) return NextResponse.json({ error: 'Icon-Name ungültig (nur a–z, 0–9, _)' }, { status: 400 })

  let filename: string | null = null
  try {
    if (file instanceof File && file.size > 0) filename = await storeImage(file, 'home-servers')
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }

  try {
    const max = await pool.query('SELECT COALESCE(MAX(position), -1) AS p FROM home_servers')
    const r = await pool.query(
      `INSERT INTO home_servers (address, name, description, version, icon, image_filename, position, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [address, name, description || null, version || null, icon, filename, Number(max.rows[0].p) + 1, active]
    )
    return NextResponse.json({ server: rowToServer(r.rows[0]) })
  } catch (err) {
    if (filename) await deleteFile('site-content', `home-servers/${filename}`).catch(() => {})
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}