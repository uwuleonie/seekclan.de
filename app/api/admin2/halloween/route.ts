import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin, csrfError } from '@/app/lib/csrf'
import { checkRead, checkWrite } from '@/app/lib/home-tiles'
import { rowToEvent } from '@/app/lib/site-events'

// /admin2/halloween – Übersicht aller Halloween-Events (Kürzel halloween-JAHR)
// GET  → alle Events mit Kürzel halloween-…, ob Halloween dafür eingeschaltet ist, kurze Zahlen
// POST → JSON
//   { eventId }                     → Halloween für ein bestehendes Event einschalten
//   { create: { year, copyFrom?, copyQuestions?, copyItems?, copyPumpkins? } }
//                                   → Event halloween-JAHR anlegen (15.10.–01.11.) + Halloween einschalten,
//                                     optional Fragen / Shop / Kürbisse aus einem älteren Jahr übernehmen

export async function GET(req: NextRequest) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  try {
    const r = await pool.query(
      `SELECT e.*, (c.event_id IS NOT NULL) AS has_config, c.enabled,
              (SELECT COUNT(*) FROM hw_pumpkins p WHERE p.event_id = e.id AND p.active)::int AS pumpkins,
              (SELECT COUNT(*) FROM hw_questions q WHERE q.event_id = e.id AND q.active)::int AS questions,
              (SELECT COUNT(*) FROM hw_items i WHERE i.event_id = e.id AND i.active)::int AS items,
              (SELECT COUNT(DISTINCT f.user_id) FROM hw_finds f WHERE f.event_id = e.id)::int AS players
       FROM site_events e LEFT JOIN hw_config c ON c.event_id = e.id
       WHERE e.slug LIKE 'halloween-%'
       ORDER BY e.starts_at DESC`
    )
    return NextResponse.json({
      events: r.rows.map(x => ({
        ...rowToEvent(x),
        halloween: x.has_config ? { enabled: x.enabled, pumpkins: x.pumpkins, questions: x.questions, items: x.items, players: x.players } : null,
      })),
    })
  } catch (err) {
    const e = err as { code?: string; message?: string }
    if (e.code === '42P01') return NextResponse.json({ error: 'Tabellen fehlen – bitte zuerst das Halloween-SQL ausführen' }, { status: 500 })
    return NextResponse.json({ error: e.message || 'Serverfehler' }, { status: 500 })
  }
}

type CreateBody = { year?: number; copyFrom?: number; copyQuestions?: boolean; copyItems?: boolean; copyPumpkins?: boolean }

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return csrfError()
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const body = await req.json().catch(() => ({})) as { eventId?: number; create?: CreateBody }

  // Bestehendes Event einschalten
  if (body.eventId !== undefined) {
    const id = Number(body.eventId)
    const ev = (await pool.query('SELECT slug FROM site_events WHERE id = $1', [id])).rows[0]
    if (!ev) return NextResponse.json({ error: 'Event nicht gefunden' }, { status: 404 })
    if (!/^halloween-\d{4}$/.test(ev.slug)) return NextResponse.json({ error: 'Das Kürzel muss halloween-JAHR sein, z. B. halloween-2026' }, { status: 400 })
    await pool.query('INSERT INTO hw_config (event_id) VALUES ($1) ON CONFLICT (event_id) DO NOTHING', [id])
    return NextResponse.json({ ok: true, eventId: id })
  }

  // Neues Jahr anlegen
  const c = body.create || {}
  const year = Number(c.year)
  if (!Number.isInteger(year) || year < 2024 || year > 2100) return NextResponse.json({ error: 'Jahr ungültig' }, { status: 400 })
  const slug = `halloween-${year}`

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const exists = (await client.query('SELECT id FROM site_events WHERE slug = $1', [slug])).rows[0]
    if (exists) { await client.query('ROLLBACK'); return NextResponse.json({ error: `${slug} gibt es schon` }, { status: 400 }) }

    // Start 15.10. 00:00, Ende 01.11. 23:59 (deutsche Zeit) – lässt sich danach unter Events & Countdown ändern
    const ev = (await client.query(
      `INSERT INTO site_events (slug, title, subtitle, href, accent, starts_at, ends_at, active)
       VALUES ($1, $2, $3, $4, '#f97316',
               ($5::text || '-10-15 00:00')::timestamp AT TIME ZONE 'Europe/Berlin',
               ($5::text || '-11-01 23:59')::timestamp AT TIME ZONE 'Europe/Berlin', TRUE)
       RETURNING id`,
      [slug, `Halloween ${year}`, 'Finde die versteckten Kürbisse auf der Website', `/halloween/${year}`, String(year)]
    )).rows[0]
    const id = Number(ev.id)

    const from = c.copyFrom ? Number(c.copyFrom) : null
    if (from) {
      await client.query(
        `INSERT INTO hw_config (event_id, enabled, candy_find, candy_easy, candy_medium, candy_hard, music_filename)
         SELECT $1, TRUE, candy_find, candy_easy, candy_medium, candy_hard, music_filename FROM hw_config WHERE event_id = $2`,
        [id, from]
      )
      if (c.copyQuestions) await client.query(
        `INSERT INTO hw_questions (event_id, difficulty, question, answers, correct_index, time_limit, active)
         SELECT $1, difficulty, question, answers, correct_index, time_limit, active FROM hw_questions WHERE event_id = $2 ORDER BY id`,
        [id, from]
      )
      if (c.copyItems) await client.query(
        `INSERT INTO hw_items (event_id, name, description, image_filename, price, stock, per_user_limit, reward_type, template_id, position, active)
         SELECT $1, name, description, image_filename, price, stock, per_user_limit, reward_type, template_id, position, active FROM hw_items WHERE event_id = $2 ORDER BY id`,
        [id, from]
      )
      if (c.copyPumpkins) await client.query(
        `INSERT INTO hw_pumpkins (event_id, page_path, anchor, x, y, size, difficulty, active)
         SELECT $1, page_path, anchor, x, y, size, difficulty, active FROM hw_pumpkins WHERE event_id = $2 ORDER BY id`,
        [id, from]
      )
    }
    await client.query('INSERT INTO hw_config (event_id) VALUES ($1) ON CONFLICT (event_id) DO NOTHING', [id])
    await client.query('COMMIT')
    return NextResponse.json({ ok: true, eventId: id })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    return NextResponse.json({ error: (err as Error).message || 'Serverfehler' }, { status: 500 })
  } finally {
    client.release()
  }
}