import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin, csrfError } from '@/app/lib/csrf'
import { getGeoUser } from '@/app/lib/geo-server'
import { nextState, SAFE_BOX, type CardState } from '@/app/geo/_lib/srs'

// Lernkartei (Wiederholen mit Abständen, 5 Fächer) – pro Nutzer; Gäste speichern im Browser
// GET  /api/geo/srs?deck=kyrillisch → { cards: { [key]: { box, due, right, wrong } } }
// GET  /api/geo/srs                  → { decks: { [deck]: { due, safe, seen } } }   (Übersicht „Heute fällig“)
// POST /api/geo/srs  { deck, key, ok } oder { deck, items: [{ key, ok }] }  → Antwort(en) eintragen
// POST /api/geo/srs  { import: { [deck]: { [key]: CardState } } }          → Browser-Stand beim Einloggen übernehmen

const DECK = /^[a-z0-9-]{2,60}$/
const KEY = /^[^\s]{1,120}$/

export async function GET(req: NextRequest) {
  const user = await getGeoUser(req).catch(() => null)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const deck = req.nextUrl.searchParams.get('deck')
  try {
    if (deck) {
      if (!DECK.test(deck)) return NextResponse.json({ error: 'Ungültiges Deck' }, { status: 400 })
      const r = await pool.query('SELECT key, box, due, n_right, n_wrong FROM geo_srs WHERE user_id = $1 AND deck = $2', [user.id, deck])
      const cards: Record<string, CardState> = {}
      for (const x of r.rows) cards[x.key] = { box: x.box, due: new Date(x.due).toISOString(), right: x.n_right, wrong: x.n_wrong }
      return NextResponse.json({ cards }, { headers: { 'Cache-Control': 'no-store' } })
    }
    const r = await pool.query(
      `SELECT deck, count(*) FILTER (WHERE due <= now())::int AS due, count(*) FILTER (WHERE box >= $2)::int AS safe, count(*)::int AS seen
       FROM geo_srs WHERE user_id = $1 GROUP BY deck`,
      [user.id, SAFE_BOX],
    )
    return NextResponse.json({ decks: Object.fromEntries(r.rows.map(x => [x.deck, { due: x.due, safe: x.safe, seen: x.seen }])) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: unknown) {
    console.error('geo/srs GET', err)
    return NextResponse.json({ error: 'Fehler' }, { status: 500 })
  }
}

async function save(userId: string, deck: string, key: string, s: CardState) {
  await pool.query(
    `INSERT INTO geo_srs (user_id, deck, key, box, due, n_right, n_wrong, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (user_id, key) DO UPDATE SET deck = EXCLUDED.deck, box = EXCLUDED.box, due = EXCLUDED.due,
       n_right = EXCLUDED.n_right, n_wrong = EXCLUDED.n_wrong, updated_at = now()`,
    [userId, deck, key, s.box, s.due, s.right, s.wrong],
  )
}

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return csrfError()
  const user = await getGeoUser(req).catch(() => null)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  try {
    if (b.import && typeof b.import === 'object') {
      let n = 0
      for (const [deck, cards] of Object.entries(b.import as Record<string, Record<string, CardState>>)) {
        if (!DECK.test(deck) || !cards || typeof cards !== 'object') continue
        for (const [key, s] of Object.entries(cards)) {
          if (!KEY.test(key) || n++ > 5000) continue
          const box = Math.max(1, Math.min(5, Math.round(Number(s?.box) || 1)))
          const due = isNaN(Date.parse(String(s?.due))) ? new Date().toISOString() : new Date(String(s.due)).toISOString()
          await pool.query(
            `INSERT INTO geo_srs (user_id, deck, key, box, due, n_right, n_wrong, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, now())
             ON CONFLICT (user_id, key) DO NOTHING`,
            [user.id, deck, key, box, due, Math.max(0, Number(s?.right) || 0), Math.max(0, Number(s?.wrong) || 0)],
          )
        }
      }
      return NextResponse.json({ ok: true })
    }
    const deck = String(b.deck ?? '')
    const items: { key: string; ok: boolean }[] = Array.isArray(b.items) ? b.items.slice(0, 100) : [{ key: b.key, ok: b.ok }]
    if (!DECK.test(deck)) return NextResponse.json({ error: 'Ungültiges Deck' }, { status: 400 })
    const out: Record<string, CardState> = {}
    for (const it of items) {
      const key = String(it?.key ?? '')
      if (!KEY.test(key)) continue
      const prev = await pool.query('SELECT box, due, n_right, n_wrong FROM geo_srs WHERE user_id = $1 AND key = $2', [user.id, key])
      const p = prev.rows[0]
      const s = nextState(p ? { box: p.box, due: new Date(p.due).toISOString(), right: p.n_right, wrong: p.n_wrong } : undefined, !!it.ok)
      await save(user.id, deck, key, s)
      out[key] = s
    }
    return NextResponse.json({ ok: true, cards: out })
  } catch (err: unknown) {
    console.error('geo/srs POST', err)
    return NextResponse.json({ error: 'Speichern fehlgeschlagen' }, { status: 500 })
  }
}