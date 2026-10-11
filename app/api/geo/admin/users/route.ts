import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin, csrfError } from '@/app/lib/csrf'
import { canReadGeoAdmin, getGeoUser, isGeoAdmin } from '@/app/lib/geo-server'
import { addXp, loadConfig } from '@/app/lib/geo-data'
import { levelOf } from '@/app/geo/_lib/xp'

// Nutzer im Geo-Adminpanel
// GET  /api/geo/admin/users?q=<Name>  → Nutzer mit XP, Level, Faktor, ausgeblendet, letzte XP-Buchungen
// POST /api/geo/admin/users  Body: { action, ... }
//   xp      { userId, amount, note }   XP geben (+) oder abziehen (−)
//   xpAll   { amount, note }           allen Spielern mit Geo-Profil XP geben
//   factor  { userId, factor }         persönlicher XP-Faktor (1 = normal)
//   hidden  { userId, hidden }         aus Ranglisten aus-/einblenden
//   reset   { userId, what }           what: "xp" | "progress" | "all"

export async function GET(req: NextRequest) {
  const user = await getGeoUser(req).catch(() => null)
  if (!canReadGeoAdmin(user)) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 40)
  try {
    const cfg = await loadConfig()
    const r = await pool.query(
      `SELECT u.id, u.username, u.clan_role, COALESCE(p.xp, 0) AS xp, COALESCE(p.hidden, false) AS hidden, COALESCE(p.xp_factor, 1) AS xp_factor,
              (SELECT count(*)::int FROM geo_item_progress g WHERE g.user_id = u.id) AS solved
       FROM users u LEFT JOIN geo_profile p ON p.user_id = u.id
       WHERE ($1 = '' AND p.user_id IS NOT NULL) OR ($1 <> '' AND u.username ILIKE '%' || $1 || '%')
       ORDER BY COALESCE(p.xp, 0) DESC, u.username LIMIT 60`,
      [q],
    )
    const ids = r.rows.map(x => x.id)
    const log = ids.length
      ? await pool.query(
        `SELECT * FROM (SELECT l.user_id, l.amount, l.reason, l.slug, l.note, l.created_at,
                row_number() OVER (PARTITION BY l.user_id ORDER BY l.created_at DESC) AS rn
         FROM geo_xp_log l WHERE l.user_id = ANY($1)) t WHERE rn <= 8`,
        [ids],
      )
      : { rows: [] as Record<string, unknown>[] }
    return NextResponse.json({
      users: r.rows.map(x => ({
        id: x.id, username: x.username, role: x.clan_role, xp: Number(x.xp), level: levelOf(Number(x.xp), cfg).level,
        hidden: x.hidden, factor: Number(x.xp_factor), solved: x.solved,
        log: log.rows.filter(l => l.user_id === x.id).map(l => ({ amount: l.amount, reason: l.reason, slug: l.slug, note: l.note, at: l.created_at })),
      })),
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: unknown) {
    console.error('geo/admin/users', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Fehler' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return csrfError()
  const admin = await getGeoUser(req).catch(() => null)
  if (!isGeoAdmin(admin)) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const userId = String(b.userId ?? '')
  const note = typeof b.note === 'string' ? b.note.trim().slice(0, 200) : null
  try {
    switch (b.action) {
      case 'xp': {
        const amount = Math.round(Number(b.amount))
        if (!userId || !Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 10_000_000) return NextResponse.json({ error: 'Ungültige Menge' }, { status: 400 })
        await pool.query(`INSERT INTO geo_xp_log (user_id, amount, reason, note, created_by) VALUES ($1, $2, 'admin', $3, $4)`, [userId, amount, note, admin!.id])
        await addXp(userId, amount)
        break
      }
      case 'xpAll': {
        const amount = Math.round(Number(b.amount))
        if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 1_000_000) return NextResponse.json({ error: 'Ungültige Menge' }, { status: 400 })
        await pool.query(`INSERT INTO geo_xp_log (user_id, amount, reason, note, created_by) SELECT user_id, $1, 'admin', $2, $3 FROM geo_profile`, [amount, note, admin!.id])
        await pool.query('UPDATE geo_profile SET xp = GREATEST(0, xp + $1), updated_at = now()', [amount])
        break
      }
      case 'factor': {
        const f = Number(b.factor)
        if (!userId || !(f >= 0 && f <= 20)) return NextResponse.json({ error: 'Ungültiger Faktor' }, { status: 400 })
        await pool.query(
          `INSERT INTO geo_profile (user_id, xp_factor) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET xp_factor = EXCLUDED.xp_factor, updated_at = now()`,
          [userId, f],
        )
        break
      }
      case 'hidden':
        await pool.query(
          `INSERT INTO geo_profile (user_id, hidden) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET hidden = EXCLUDED.hidden, updated_at = now()`,
          [userId, !!b.hidden],
        )
        break
      case 'reset': {
        const what = String(b.what)
        if (what === 'xp' || what === 'all') {
          await pool.query('UPDATE geo_profile SET xp = 0, updated_at = now() WHERE user_id = $1', [userId])
          await pool.query('DELETE FROM geo_xp_log WHERE user_id = $1', [userId])
        }
        if (what === 'progress' || what === 'all') await pool.query('DELETE FROM geo_item_progress WHERE user_id = $1', [userId])
        if (what === 'all') await pool.query('DELETE FROM geo_results WHERE user_id = $1', [userId])
        break
      }
      default:
        return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('geo/admin/users POST', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Fehler' }, { status: 500 })
  }
}