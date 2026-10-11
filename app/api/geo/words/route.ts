import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin, csrfError } from '@/app/lib/csrf'
import { getGeoUser } from '@/app/lib/geo-server'
import { cleanWord } from '@/app/geo/_lib/words'

// Merkliste „Meine Wörter“ (pro Nutzer; Gäste speichern im Browser)
// GET    /api/geo/words           → { words: SavedWord[] } (neueste zuerst)
// POST   /api/geo/words  { words } → merken (ein oder mehrere, z.B. beim Einloggen alles aus dem Browser übernehmen)
// DELETE /api/geo/words  { key }   → vergessen

const MAX = 2000

export async function GET(req: NextRequest) {
  const user = await getGeoUser(req).catch(() => null)
  if (!user) return NextResponse.json({ words: [] }, { status: 401 })
  try {
    const r = await pool.query('SELECT data FROM geo_saved_words WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2', [user.id, MAX])
    return NextResponse.json({ words: r.rows.map(x => x.data) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: unknown) {
    console.error('geo/words GET', err)
    return NextResponse.json({ words: [] })
  }
}

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return csrfError()
  const user = await getGeoUser(req).catch(() => null)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const words = (Array.isArray(b.words) ? b.words : []).slice(0, 500).map(cleanWord).filter(Boolean)
  if (!words.length) return NextResponse.json({ error: 'Ungültige Daten' }, { status: 400 })
  try {
    const n = await pool.query('SELECT count(*)::int AS n FROM geo_saved_words WHERE user_id = $1', [user.id])
    if (n.rows[0].n + words.length > MAX) return NextResponse.json({ error: `Höchstens ${MAX} Einträge in der Merkliste` }, { status: 400 })
    for (const w of words) {
      await pool.query(
        `INSERT INTO geo_saved_words (user_id, key, slug, data) VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, key) DO UPDATE SET data = EXCLUDED.data, slug = EXCLUDED.slug`,
        [user.id, w!.key, w!.slug, JSON.stringify(w)],
      )
    }
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('geo/words POST', err)
    return NextResponse.json({ error: 'Speichern fehlgeschlagen' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  if (!checkOrigin(req)) return csrfError()
  const user = await getGeoUser(req).catch(() => null)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const key = String(b.key ?? '').slice(0, 120)
  if (!key) return NextResponse.json({ error: 'Ungültige Daten' }, { status: 400 })
  try {
    await pool.query('DELETE FROM geo_saved_words WHERE user_id = $1 AND key = $2', [user.id, key])
    await pool.query('DELETE FROM geo_srs WHERE user_id = $1 AND deck = $2 AND key = $3', [user.id, 'meine-woerter', `mw:${key}`]).catch(() => {})
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('geo/words DELETE', err)
    return NextResponse.json({ error: 'Löschen fehlgeschlagen' }, { status: 500 })
  }
}