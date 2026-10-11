import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin, csrfError } from '@/app/lib/csrf'
import { getGeoUser } from '@/app/lib/geo-server'

// Angepinnte Quizzes und Kategorien (pro Nutzer; Gäste speichern im Browser)
// GET  /api/geo/pins → { pins: [{ kind, key }] }  (neueste zuerst)
// POST /api/geo/pins  Body: { kind, key, pinned: boolean }
//   kind: quiz (slug) | country (ISO3) | section ("europa/Natur") | bereich ("europa")

const KINDS = ['quiz', 'country', 'section', 'bereich']

export async function GET(req: NextRequest) {
  const user = await getGeoUser(req).catch(() => null)
  if (!user) return NextResponse.json({ pins: [] }, { status: 401 })
  try {
    const r = await pool.query('SELECT kind, key FROM geo_pins WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200', [user.id])
    return NextResponse.json({ pins: r.rows }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: unknown) {
    console.error('geo/pins GET', err)
    return NextResponse.json({ pins: [] })
  }
}

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return csrfError()
  const user = await getGeoUser(req).catch(() => null)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const kind = String(b.kind ?? ''), key = String(b.key ?? '').slice(0, 120)
  if (!KINDS.includes(kind) || !key) return NextResponse.json({ error: 'Ungültige Daten' }, { status: 400 })
  try {
    if (b.pinned) await pool.query('INSERT INTO geo_pins (user_id, kind, key) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [user.id, kind, key])
    else await pool.query('DELETE FROM geo_pins WHERE user_id = $1 AND kind = $2 AND key = $3', [user.id, kind, key])
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('geo/pins POST', err)
    return NextResponse.json({ error: 'Speichern fehlgeschlagen' }, { status: 500 })
  }
}