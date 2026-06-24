import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

const PRESETS = ['default', 'sunset', 'ocean', 'forest', 'rose', 'gold', 'mono', 'custom']
const HEX = /^#[0-9a-fA-F]{6}$/

// Profilbild/Banner/Hintergrund dürfen NUR auf den eigenen Supabase Storage-Bucket
// zeigen, in den die normale Upload-Route (app/api/profile/upload/route.ts) schreibt —
// niemals auf eine beliebige externe URL. Ohne diese Prüfung könnte ein Nutzer über
// einen direkten API-Aufruf jede beliebige URL eintragen (z. B. zu Tracking-Zwecken
// oder unangemessenen Inhalten), die dann auf seinem für alle sichtbaren Profil
// geladen wird.
const ALLOWED_MEDIA_PREFIX = 'https://lgvrborqklwfbkgbjnvs.supabase.co/storage/v1/object/public/profile-media/'

function isValidMediaUrl(url: string): boolean {
  return url.startsWith(ALLOWED_MEDIA_PREFIX)
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const sessionResult = await pool.query(
    'SELECT user_id, expires_at FROM sessions WHERE token = $1',
    [token]
  )
  const session = sessionResult.rows[0]

  if (!session || new Date(session.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Session abgelaufen' }, { status: 401 })
  }

  const body = await req.json()
  const update: Record<string, any> = {}

  // Profilbild
  if ('profile_picture_url' in body) {
    const v = body.profile_picture_url
    if (v !== null && (typeof v !== 'string' || !isValidMediaUrl(v))) {
      return NextResponse.json({ error: 'Ungültiges Profilbild' }, { status: 400 })
    }
    update.profile_picture_url = v || null
  }

  // Banner
  if ('banner_url' in body) {
    const v = body.banner_url
    if (v !== null && (typeof v !== 'string' || !isValidMediaUrl(v))) {
      return NextResponse.json({ error: 'Ungültiger Banner' }, { status: 400 })
    }
    update.banner_url = v || null
  }

  // Hintergrundbild
  if ('background_url' in body) {
    const v = body.background_url
    if (v !== null && (typeof v !== 'string' || !isValidMediaUrl(v))) {
      return NextResponse.json({ error: 'Ungültiger Hintergrund' }, { status: 400 })
    }
    update.background_url = v || null
  }

  // Hintergrund-Blur (0–40 px)
  if ('background_blur' in body) {
    const n = Number(body.background_blur)
    if (isNaN(n) || n < 0 || n > 40) return NextResponse.json({ error: 'Blur ungültig' }, { status: 400 })
    update.background_blur = Math.round(n)
  }

  // Akzentfarbe
  if ('accent_color' in body) {
    if (!HEX.test(body.accent_color)) return NextResponse.json({ error: 'Farbe ungültig' }, { status: 400 })
    update.accent_color = body.accent_color
  }

  // Karten-Transparenz (0–1)
  if ('card_opacity' in body) {
    const n = Number(body.card_opacity)
    if (isNaN(n) || n < 0 || n > 1) return NextResponse.json({ error: 'Transparenz ungültig' }, { status: 400 })
    update.card_opacity = Math.round(n * 100) / 100
  }

  // Preset-Theme
  if ('profile_theme' in body) {
    if (!PRESETS.includes(body.profile_theme)) return NextResponse.json({ error: 'Theme ungültig' }, { status: 400 })
    update.profile_theme = body.profile_theme
  }

  // Spitzname
  if ('display_name' in body) {
    const v = body.display_name
    if (typeof v !== 'string') return NextResponse.json({ error: 'Ungültiger Spitzname' }, { status: 400 })
    if (v.length > 32) return NextResponse.json({ error: 'Spitzname max. 32 Zeichen' }, { status: 400 })
    update.display_name = v.trim() || null
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nichts zu speichern' }, { status: 400 })
  }

  // Dynamische SET-Klausel aufbauen — die Spaltennamen (Schlüssel von `update`)
  // stammen ausschließlich aus der oben hart codierten, geprüften Liste, NIEMALS
  // direkt aus dem Request-Body, daher ist hier keine SQL-Injection-Gefahr über
  // die Spaltennamen möglich. Die eigentlichen Werte werden immer als Parameter
  // ($1, $2, ...) übergeben.
  const keys = Object.keys(update)
  const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ')
  const values = keys.map((key) => update[key])

  try {
    await pool.query(
      `UPDATE users SET ${setClause} WHERE id = $${keys.length + 1}`,
      [...values, session.user_id]
    )
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Speichern fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: 'Profil gespeichert' })
}