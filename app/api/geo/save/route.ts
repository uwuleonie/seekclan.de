import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin, csrfError } from '@/app/lib/csrf'
import { getGeoUser } from '@/app/lib/geo-server'

// Spielstände zum Fortsetzen (nur eingeloggt; Gäste speichern im Browser)
// GET    /api/geo/save            → { saves: [{ slug, state, updatedAt }] } (neueste zuerst)
// PUT    /api/geo/save  { slug, state }
// DELETE /api/geo/save  { slug }

const SLUG = /^(mix:)?[a-z0-9-]{2,60}(\+[a-z0-9-]{2,60}){0,11}$/

export async function GET(req: NextRequest) {
  const user = await getGeoUser(req).catch(() => null)
  if (!user) return NextResponse.json({ saves: [] }, { status: 401 })
  try {
    const r = await pool.query('SELECT slug, state, updated_at FROM geo_saves WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 20', [user.id])
    return NextResponse.json({ saves: r.rows.map(x => ({ slug: x.slug, state: x.state, updatedAt: new Date(x.updated_at).toISOString() })) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: unknown) {
    console.error('geo/save GET', err)
    return NextResponse.json({ saves: [] })
  }
}

export async function PUT(req: NextRequest) {
  if (!checkOrigin(req)) return csrfError()
  const user = await getGeoUser(req).catch(() => null)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const slug = String(b.slug ?? '')
  const state = b.state
  const size = JSON.stringify(state ?? null).length
  if (!SLUG.test(slug) || !state || typeof state !== 'object' || size > 200000) return NextResponse.json({ error: 'Ungültige Daten' }, { status: 400 })
  try {
    await pool.query(
      `INSERT INTO geo_saves (user_id, slug, state, updated_at) VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id, slug) DO UPDATE SET state = EXCLUDED.state, updated_at = now()`,
      [user.id, slug, JSON.stringify(state)],
    )
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('geo/save PUT', err)
    return NextResponse.json({ error: 'Speichern fehlgeschlagen' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  if (!checkOrigin(req)) return csrfError()
  const user = await getGeoUser(req).catch(() => null)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const slug = String(b.slug ?? '')
  if (!SLUG.test(slug)) return NextResponse.json({ error: 'Ungültige Daten' }, { status: 400 })
  try {
    await pool.query('DELETE FROM geo_saves WHERE user_id = $1 AND slug = $2', [user.id, slug])
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('geo/save DELETE', err)
    return NextResponse.json({ error: 'Löschen fehlgeschlagen' }, { status: 500 })
  }
}