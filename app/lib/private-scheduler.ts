// Hintergrund-Uhr für den privaten Bereich.
// Läuft im Next.js-Server (gestartet über instrumentation.ts) und prüft alle 30 Sekunden:
//  - Wecker & Timer, die jetzt klingeln müssen
//  - Reminder, deren Erinnerungszeit erreicht ist
//  - Kalendertermine mit "Erinnern … vorher"
//  - Klausuren morgen / Hausaufgaben für morgen (am Vorabend um 17 Uhr)
// Jede Meldung geht in die Glocke und als Push an die Geräte.
//
// Ein Postgres-"Advisory Lock" sorgt dafür, dass bei mehreren Server-Prozessen
// trotzdem nur einer gleichzeitig prüft (keine doppelten Weckrufe).

import { pool } from '@/app/lib/db'
import { notify } from '@/app/lib/private-notify'
import { nextAlarmFire } from '@/app/lib/alarms'
import { addDaysYMD, berlinParts } from '@/app/lib/berlin-time'
import { expandOccurrences, isRecurrence } from '@/app/lib/recurrence'
import { toDateKey } from '@/app/lib/private-crud'

const LOCK_ID = 7_310_442
const TICK_MS = 30_000

const g = globalThis as unknown as { __pvScheduler?: NodeJS.Timeout; __pvRunning?: boolean }

export function startPrivateScheduler() {
  if (g.__pvScheduler) return
  if (process.env.PRIVATE_SCHEDULER === 'off') {
    console.log('Privat-Planer: Hintergrund-Uhr ist per PRIVATE_SCHEDULER=off ausgeschaltet')
    return
  }
  console.log('Privat-Planer: Hintergrund-Uhr gestartet')
  g.__pvScheduler = setInterval(() => { tick().catch(err => console.error('Privat-Planer:', err)) }, TICK_MS)
  setTimeout(() => { tick().catch(err => console.error('Privat-Planer:', err)) }, 5_000)
}

async function tick() {
  if (g.__pvRunning) return
  g.__pvRunning = true
  const client = await pool.connect()
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [LOCK_ID])
    if (!lock.rows[0]?.ok) return
    try {
      await runChecks()
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID])
    }
  } catch (err) {
    // Tabellen noch nicht angelegt → leise bleiben, statt das Log zu fluten
    if ((err as { code?: string }).code === '42P01') return
    throw err
  } finally {
    client.release()
    g.__pvRunning = false
  }
}

async function safe(name: string, fn: () => Promise<void>) {
  try {
    await fn()
  } catch (err) {
    if ((err as { code?: string }).code === '42P01') return // Tabelle fehlt noch
    console.error(`Privat-Planer (${name}):`, err)
  }
}

async function runChecks() {
  const now = new Date()
  await safe('Wecker', () => checkAlarms(now))
  await safe('Reminder', () => checkTasks(now))
  await safe('Termine', () => checkEvents(now))
  await safe('Schule', () => checkSchool(now))
  // Einmal pro Stunde aufräumen
  if (now.getUTCMinutes() === 0 && now.getUTCSeconds() < TICK_MS / 1000) await safe('Aufräumen', cleanup)
}

const fmtTime = (d: Date) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })

/* ── Wecker & Timer ─────────────────────────────────────────────────────── */
async function checkAlarms(now: Date) {
  const due = await pool.query(
    `SELECT * FROM planner_alarms WHERE enabled = TRUE AND next_fire_at IS NOT NULL AND next_fire_at <= $1`,
    [now.toISOString()]
  )
  for (const a of due.rows) {
    const fireAt = new Date(a.next_fire_at)
    const late = now.getTime() - fireAt.getTime() > 15 * 60_000 // Server war aus → nicht nachträglich klingeln
    if (!late) {
      await notify(String(a.user_id), {
        kind: a.kind === 'timer' ? 'timer' : 'alarm',
        title: a.kind === 'timer' ? `Timer abgelaufen${a.label ? `: ${a.label}` : ''}` : `Wecker ${fmtTime(fireAt)}`,
        body: a.kind === 'timer' ? 'Die Zeit ist um.' : a.label || 'Aufstehen!',
        url: `/private/planer/wecker?ring=${a.id}`,
        urgent: true,
        dedupeKey: `alarm:${a.id}:${fireAt.toISOString()}`,
      })
    }
    const days: number[] = a.days ?? []
    if (a.kind === 'timer' || !days.length) {
      await pool.query('UPDATE planner_alarms SET enabled = FALSE, next_fire_at = NULL, last_fired_at = $2, updated_at = NOW() WHERE id = $1', [a.id, fireAt.toISOString()])
    } else {
      const next = nextAlarmFire(String(a.time_of_day), days, now)
      await pool.query('UPDATE planner_alarms SET next_fire_at = $2, last_fired_at = $3, updated_at = NOW() WHERE id = $1', [a.id, next.toISOString(), fireAt.toISOString()])
    }
  }
}

/* ── Reminder ───────────────────────────────────────────────────────────── */
async function checkTasks(now: Date) {
  const due = await pool.query(
    `SELECT t.*, l.name AS list_name,
            (SELECT COUNT(*)::int FROM planner_tasks c WHERE c.parent_id = t.id) AS child_count,
            (SELECT COUNT(*)::int FROM planner_tasks c WHERE c.parent_id = t.id AND c.done) AS child_done
     FROM planner_tasks t
     LEFT JOIN planner_lists l ON l.id = t.list_id
     WHERE t.done = FALSE AND t.remind_at IS NOT NULL AND t.remind_at <= $1 AND t.notified_at IS NULL`,
    [now.toISOString()]
  )
  for (const t of due.rows) {
    const late = now.getTime() - new Date(t.remind_at).getTime() > 24 * 3600_000
    if (!late) {
      const checklist = t.child_count ? ` · ${t.child_done}/${t.child_count} erledigt` : ''
      await notify(String(t.user_id), {
        kind: 'reminder',
        title: t.title,
        body: `${t.list_name ? `${t.list_name} · ` : ''}Erinnerung${checklist}${t.notes ? `\n${String(t.notes).slice(0, 140)}` : ''}`,
        url: `/private/planer/reminder?task=${t.id}`,
        dedupeKey: `task:${t.id}:${new Date(t.remind_at).toISOString()}`,
      })
    }
    await pool.query('UPDATE planner_tasks SET notified_at = NOW() WHERE id = $1', [t.id])
  }
}

/* ── Kalendertermine ────────────────────────────────────────────────────── */
async function checkEvents(now: Date) {
  const horizon = new Date(now.getTime() + 15 * 24 * 3600_000)
  const rows = await pool.query(
    `SELECT * FROM planner_events
     WHERE remind_minutes IS NOT NULL
       AND start_at < $2
       AND (recurrence <> 'none' OR start_at >= $1::timestamptz - INTERVAL '1 day')`,
    [now.toISOString(), horizon.toISOString()]
  )
  const windowStart = new Date(now.getTime() - 10 * 60_000)
  for (const e of rows.rows) {
    const rule = isRecurrence(e.recurrence) ? e.recurrence : 'none'
    const untilKey = toDateKey(e.recurrence_until)
    const until = untilKey ? new Date(`${untilKey}T23:59:59Z`) : null
    const occ = expandOccurrences(new Date(e.start_at), e.end_at ? new Date(e.end_at) : null, rule, until, windowStart, horizon, 60)
    for (const o of occ) {
      // Ganztägig: Erinnerung bezieht sich auf 08:00 Uhr des Tages
      const base = e.all_day ? new Date(o.start.getTime() + 8 * 3600_000) : o.start
      const fireAt = new Date(base.getTime() - Number(e.remind_minutes) * 60_000)
      if (fireAt > now || fireAt < windowStart) continue
      const when = e.all_day
        ? o.start.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Berlin' })
        : `${o.start.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Berlin' })}, ${fmtTime(o.start)} Uhr`
      await notify(String(e.user_id), {
        kind: 'event',
        title: e.title,
        body: `${when}${e.location ? ` · ${e.location}` : ''}`,
        url: `/private/planer?date=${o.start.toISOString().slice(0, 10)}`,
        dedupeKey: `event:${e.id}:${o.start.toISOString()}`,
      })
    }
  }
}

/* ── Schule: Klausuren & Hausaufgaben am Vorabend ───────────────────────── */
async function checkSchool(now: Date) {
  const p = berlinParts(now)
  if (p.hour < 17) return
  const t = addDaysYMD(p.year, p.month, p.day, 1)
  const tomorrow = `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`

  const exams = await pool.query(
    `SELECT e.*, s.name AS subject_name FROM timetable_exams e
     LEFT JOIN timetable_subjects s ON s.id = e.subject_id
     WHERE e.exam_date = $1`,
    [tomorrow]
  )
  const KIND: Record<string, string> = { klausur: 'Klausur', test: 'Test', praesentation: 'Präsentation', abgabe: 'Abgabe', sonstiges: 'Termin' }
  for (const e of exams.rows) {
    await notify(String(e.user_id), {
      kind: 'exam',
      title: `Morgen: ${KIND[e.kind] ?? 'Klausur'} ${e.subject_name ?? ''}`.trim(),
      body: [e.start_time ? `${String(e.start_time).slice(0, 5)} Uhr` : null, e.topic].filter(Boolean).join(' · ') || 'Viel Erfolg!',
      url: '/private/planer/stundenplan',
      dedupeKey: `exam:${e.id}:${tomorrow}`,
    })
  }

  const hw = await pool.query(
    `SELECT h.user_id, COUNT(*)::int AS n, STRING_AGG(COALESCE(s.name, 'Allgemein') || ': ' || h.title, ' · ' ORDER BY s.name) AS list
     FROM timetable_homework h
     LEFT JOIN timetable_subjects s ON s.id = h.subject_id
     WHERE h.done = FALSE AND h.due_date = $1
     GROUP BY h.user_id`,
    [tomorrow]
  )
  for (const row of hw.rows) {
    await notify(String(row.user_id), {
      kind: 'homework',
      title: row.n === 1 ? '1 Hausaufgabe für morgen' : `${row.n} Hausaufgaben für morgen`,
      body: String(row.list).slice(0, 300),
      url: '/private/planer/stundenplan',
      dedupeKey: `hw:${row.user_id}:${tomorrow}`,
    })
  }
}

async function cleanup() {
  await pool.query(`DELETE FROM private_notifications WHERE created_at < NOW() - INTERVAL '60 days'`)
  await pool.query(`DELETE FROM private_notify_sent WHERE sent_at < NOW() - INTERVAL '30 days'`)
}