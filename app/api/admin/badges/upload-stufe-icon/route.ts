import { NextRequest, NextResponse } from 'next/server'
import { saveFile, getPublicUrl } from '@/app/lib/local-storage'
import { pool } from '@/app/lib/db'

// Eigene Upload-Route speziell für die 6 Clandauer-Stufen-Icons.
// Im Gegensatz zur normalen Badge-Upload-Route (die immer "badge_<timestamp>_..."
// voranstellt) speichert diese Route die Datei unter dem exakten Namen "stufeN.png",
// weil mehrere Seiten (app/abzeichen, app/[username]/abzeichen, app/clan, app/[username])
// genau diesen festen Dateinamen direkt aus dem Code heraus erwarten — ohne DB-Eintrag.

async function checkAdmin(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null

  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null

  const userResult = await pool.query(
    'SELECT username, clan_role FROM users WHERE id = $1',
    [session.user_id]
  )
  const user = userResult.rows[0]

  if (!user || user.clan_role !== 'admin') return null
  return user
}

export async function POST(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const stufeIndexRaw = formData.get('stufe_index') as string | null

  if (!file) return NextResponse.json({ error: 'Keine Datei' }, { status: 400 })
  if (stufeIndexRaw === null) return NextResponse.json({ error: 'stufe_index erforderlich' }, { status: 400 })

  const stufeIndex = Number(stufeIndexRaw)
  if (!Number.isInteger(stufeIndex) || stufeIndex < 0 || stufeIndex > 5) {
    return NextResponse.json({ error: 'stufe_index muss zwischen 0 und 5 liegen' }, { status: 400 })
  }

  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    return NextResponse.json({ error: 'Nur PNG, JPG oder WebP erlaubt' }, { status: 400 })
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Datei zu groß (max. 5 MB)' }, { status: 400 })
  }

  // Fester Dateiname, immer .png — der Code auf den Stufen-Seiten erwartet exakt
  // "stufe0.png" bis "stufe5.png", unabhängig vom ursprünglichen Dateiformat.
  const fileName = `stufe${stufeIndex}.png`
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  try {
    await saveFile('badge-icons', fileName, buffer)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Upload fehlgeschlagen' }, { status: 500 })
  }

  const url = getPublicUrl('badge-icons', fileName)
  return NextResponse.json({ url, stufe_index: stufeIndex })
}