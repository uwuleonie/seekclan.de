import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { pool } from '@/app/lib/db'
import { checkOrigin, csrfError } from '@/app/lib/csrf'
import { getGeoUser } from '@/app/lib/geo-server'

// Mehrspieler: gemeinsam ein Quiz spielen (per Einladungslink seekclan.de/geo/mehrspieler/<id>)
// Alle bekommen dieselben Fragen in derselben Reihenfolge (gleicher "seed"). Der Stand wird alle paar Sekunden abgefragt.
//
// GET  /api/geo/room?id=<id>                    → { room, players, me }
// POST /api/geo/room  { action: 'create', slug, mode, variant }        → { id }
//                     { action: 'join', id }
//                     { action: 'start', id }                          (nur Gastgeber)
//                     { action: 'progress', id, right, wrong, answered, total, done?, seconds? }
//                     { action: 'leave', id }
//                     { action: 'again', id }                          (nur Gastgeber: neue Runde, gleiche Leute)

const SLUG = /^(mix:)?[a-z0-9-]{2,60}(\+[a-z0-9-]{2,60}){0,11}$/
const ID = /^[A-Za-z0-9_-]{6,16}$/
const MODES = ['click', 'name', 'type', 'text', 'mixed']
const VARIANTS = ['normal', 'leben']
const MAX_PLAYERS = 12
const int = (v: unknown, max: number) => { const n = Number(v); return Number.isInteger(n) && n >= 0 && n <= max ? n : 0 }

async function roomState(id: string, userId: string | null) {
  const r = await pool.query(
    `SELECT r.id, r.slug, r.mode, r.variant, r.seed, r.status, r.created_at, r.started_at, r.host_id, COALESCE(u.anzeigename, u.username) AS host_name
     FROM geo_rooms r JOIN users u ON u.id = r.host_id WHERE r.id = $1`,
    [id],
  )
  const room = r.rows[0]
  if (!room) return null
  const p = await pool.query(
    `SELECT p.user_id, u.username, COALESCE(u.anzeigename, u.username) AS name, p.right_count, p.wrong_count, p.answered, p.total, p.seconds, p.finished_at, p.last_seen
     FROM geo_room_players p JOIN users u ON u.id = p.user_id WHERE p.room_id = $1 ORDER BY p.joined_at`,
    [id],
  )
  const now = Date.now()
  return {
    room: {
      id: room.id, slug: room.slug, mode: room.mode, variant: room.variant, seed: room.seed, status: room.status,
      hostId: room.host_id, hostName: room.host_name,
      createdAt: new Date(room.created_at).toISOString(), startedAt: room.started_at ? new Date(room.started_at).toISOString() : null,
    },
    players: p.rows.map(x => ({
      id: x.user_id, username: x.username, name: x.name, right: x.right_count, wrong: x.wrong_count, answered: x.answered, total: x.total,
      seconds: x.seconds, finished: !!x.finished_at, online: now - new Date(x.last_seen).getTime() < 20000, me: x.user_id === userId,
    })),
    me: userId,
    isHost: room.host_id === userId,
  }
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') ?? ''
  if (!ID.test(id)) return NextResponse.json({ error: 'Ungültiger Link' }, { status: 400 })
  const user = await getGeoUser(req).catch(() => null)
  try {
    if (user) await pool.query('UPDATE geo_room_players SET last_seen = now() WHERE room_id = $1 AND user_id = $2', [id, user.id])
    const st = await roomState(id, user?.id ?? null)
    if (!st) return NextResponse.json({ error: 'Raum nicht gefunden' }, { status: 404 })
    return NextResponse.json(st, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: unknown) {
    console.error('geo/room GET', err)
    return NextResponse.json({ error: 'Fehler' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return csrfError()
  const user = await getGeoUser(req).catch(() => null)
  if (!user) return NextResponse.json({ error: 'Zum Mitspielen bitte einloggen' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const id = String(b.id ?? '')

  try {
    if (b.action === 'create') {
      const slug = String(b.slug ?? ''), mode = String(b.mode ?? 'click'), variant = String(b.variant ?? 'normal')
      if (!SLUG.test(slug) || !MODES.includes(mode) || !VARIANTS.includes(variant)) return NextResponse.json({ error: 'Ungültige Daten' }, { status: 400 })
      const newId = randomBytes(5).toString('base64url')
      const seed = randomBytes(4).readUInt32BE(0) & 0x7fffffff
      await pool.query('INSERT INTO geo_rooms (id, slug, host_id, mode, variant, seed) VALUES ($1, $2, $3, $4, $5, $6)', [newId, slug, user.id, mode, variant, seed])
      await pool.query('INSERT INTO geo_room_players (room_id, user_id) VALUES ($1, $2)', [newId, user.id])
      return NextResponse.json({ id: newId })
    }

    if (!ID.test(id)) return NextResponse.json({ error: 'Ungültiger Link' }, { status: 400 })
    const r = await pool.query('SELECT host_id, status FROM geo_rooms WHERE id = $1', [id])
    const room = r.rows[0]
    if (!room) return NextResponse.json({ error: 'Raum nicht gefunden' }, { status: 404 })
    const isHost = room.host_id === user.id

    switch (b.action) {
      case 'join': {
        const n = await pool.query('SELECT count(*)::int AS n FROM geo_room_players WHERE room_id = $1', [id])
        const already = await pool.query('SELECT 1 FROM geo_room_players WHERE room_id = $1 AND user_id = $2', [id, user.id])
        if (!already.rowCount) {
          if (room.status !== 'lobby') return NextResponse.json({ error: 'Die Runde läuft schon – warte auf die nächste' }, { status: 409 })
          if (n.rows[0].n >= MAX_PLAYERS) return NextResponse.json({ error: `Der Raum ist voll (${MAX_PLAYERS})` }, { status: 409 })
          await pool.query('INSERT INTO geo_room_players (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, user.id])
        }
        break
      }
      case 'start':
        if (!isHost) return NextResponse.json({ error: 'Nur der Gastgeber kann starten' }, { status: 403 })
        await pool.query(`UPDATE geo_rooms SET status = 'running', started_at = now() WHERE id = $1 AND status = 'lobby'`, [id])
        break
      case 'again':
        if (!isHost) return NextResponse.json({ error: 'Nur der Gastgeber kann neu starten' }, { status: 403 })
        await pool.query(`UPDATE geo_rooms SET status = 'lobby', started_at = NULL, seed = $2 WHERE id = $1`, [id, randomBytes(4).readUInt32BE(0) & 0x7fffffff])
        await pool.query('UPDATE geo_room_players SET right_count = 0, wrong_count = 0, answered = 0, total = 0, seconds = NULL, finished_at = NULL WHERE room_id = $1', [id])
        break
      case 'progress': {
        if (room.status !== 'running') break
        await pool.query(
          `UPDATE geo_room_players SET right_count = $3, wrong_count = $4, answered = $5, total = $6, last_seen = now(),
             seconds = CASE WHEN $7 THEN $8 ELSE seconds END,
             finished_at = CASE WHEN $7 AND finished_at IS NULL THEN now() ELSE finished_at END
           WHERE room_id = $1 AND user_id = $2`,
          [id, user.id, int(b.right, 100000), int(b.wrong, 100000), int(b.answered, 100000), int(b.total, 10000), !!b.done, int(b.seconds, 86400)],
        )
        // Alle fertig → Runde vorbei
        await pool.query(
          `UPDATE geo_rooms SET status = 'done' WHERE id = $1 AND status = 'running'
             AND NOT EXISTS (SELECT 1 FROM geo_room_players WHERE room_id = $1 AND finished_at IS NULL AND last_seen > now() - interval '60 seconds')`,
          [id],
        )
        break
      }
      case 'leave':
        await pool.query('DELETE FROM geo_room_players WHERE room_id = $1 AND user_id = $2', [id, user.id])
        // Gastgeber weg → ältester Mitspieler übernimmt; niemand mehr da → Raum löschen
        if (isHost) {
          const next = await pool.query('SELECT user_id FROM geo_room_players WHERE room_id = $1 ORDER BY joined_at LIMIT 1', [id])
          if (next.rows[0]) await pool.query('UPDATE geo_rooms SET host_id = $2 WHERE id = $1', [id, next.rows[0].user_id])
          else await pool.query('DELETE FROM geo_rooms WHERE id = $1', [id])
        }
        break
      default:
        return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
    }
    const st = await roomState(id, user.id)
    return NextResponse.json(st ?? { gone: true })
  } catch (err: unknown) {
    console.error('geo/room POST', err)
    return NextResponse.json({ error: 'Fehler' }, { status: 500 })
  }
}