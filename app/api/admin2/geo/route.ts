import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin, csrfError } from '@/app/lib/csrf'
import { canReadGeoAdmin, getGeoUser, isGeoAdmin } from '@/app/lib/geo-server'
import { CATALOG_BY_SLUG, isBuilt } from '@/app/geo/_lib/catalog'

// Freischaltungen für seekclan.de/geo (Tabelle geo_quiz_releases)
// Kein Eintrag = "Bald verfügbar" ohne Datum. Eintrag mit Zeitpunkt in der Zukunft = "Ab <Datum>". Vergangenheit = offen.

// GET /api/admin2/geo → { releases: [{ slug, release_at, updated_at, updated_by_name }] }
export async function GET(req: NextRequest) {
  const user = await getGeoUser(req).catch(() => null)
  if (!canReadGeoAdmin(user)) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  try {
    const r = await pool.query(
      `SELECT g.slug, g.release_at, g.updated_at, u.username AS updated_by_name
       FROM geo_quiz_releases g LEFT JOIN users u ON u.id = g.updated_by
       ORDER BY g.release_at ASC`,
    )
    return NextResponse.json({ releases: r.rows, now: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Fehler' }, { status: 500 })
  }
}

function parseSlugs(v: unknown): string[] | null {
  if (!Array.isArray(v) || !v.length || v.length > 200) return null
  const slugs = [...new Set(v.map(s => String(s)))]
  return slugs.every(s => isBuilt(CATALOG_BY_SLUG[s])) ? slugs : null
}

// PUT /api/admin2/geo  Body: { slugs: string[], release_at: ISO-Zeitpunkt } → freischalten (sofort oder geplant)
export async function PUT(req: NextRequest) {
  if (!checkOrigin(req)) return csrfError()
  const user = await getGeoUser(req).catch(() => null)
  if (!isGeoAdmin(user)) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const b = await req.json().catch(() => ({}))
  const slugs = parseSlugs(b.slugs)
  if (!slugs) return NextResponse.json({ error: 'Unbekanntes oder noch nicht gebautes Quiz' }, { status: 400 })
  const at = String(b.release_at ?? '')
  if (!at || isNaN(Date.parse(at))) return NextResponse.json({ error: 'Ungültiger Zeitpunkt' }, { status: 400 })

  try {
    for (const slug of slugs) {
      await pool.query(
        `INSERT INTO geo_quiz_releases (slug, release_at, updated_at, updated_by)
         VALUES ($1, $2, NOW(), $3)
         ON CONFLICT (slug) DO UPDATE SET release_at = EXCLUDED.release_at, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
        [slug, new Date(at).toISOString(), user!.id],
      )
    }
    return NextResponse.json({ ok: true, count: slugs.length })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Fehler' }, { status: 500 })
  }
}

// DELETE /api/admin2/geo  Body: { slugs: string[] } → wieder sperren ("Bald verfügbar")
export async function DELETE(req: NextRequest) {
  if (!checkOrigin(req)) return csrfError()
  const user = await getGeoUser(req).catch(() => null)
  if (!isGeoAdmin(user)) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const b = await req.json().catch(() => ({}))
  const slugs = parseSlugs(b.slugs)
  if (!slugs) return NextResponse.json({ error: 'Unbekanntes Quiz' }, { status: 400 })
  try {
    await pool.query('DELETE FROM geo_quiz_releases WHERE slug = ANY($1::text[])', [slugs])
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Fehler' }, { status: 500 })
  }
}
