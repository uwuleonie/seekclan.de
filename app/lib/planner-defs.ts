// Tabellen-Beschreibungen für den Planer (Kalender, Reminder, Wecker, Stundenplan).
// Daraus erzeugt app/lib/private-crud.ts die API-Routen.

import { pool } from '@/app/lib/db'
import { nextAlarmFire } from '@/app/lib/alarms'
import { RECURRENCES, isRecurrence, nextAfter } from '@/app/lib/recurrence'
import { ValidationError, type ResourceDef } from '@/app/lib/private-crud'

const REPEATS = RECURRENCES

/* ── Kalender ───────────────────────────────────────────────────────────── */
export const eventsDef: ResourceDef = {
  table: 'planner_events',
  label: 'Termin',
  orderBy: 'start_at ASC',
  fields: {
    title: { type: 'text', max: 200, required: true },
    description: { type: 'text', max: 5000 },
    location: { type: 'text', max: 300 },
    color: { type: 'color' },
    start_at: { type: 'ts', required: true },
    end_at: { type: 'ts' },
    all_day: { type: 'bool' },
    recurrence: { type: 'enum', values: REPEATS },
    recurrence_until: { type: 'date' },
    remind_minutes: { type: 'int', min: 0, max: 60 * 24 * 14, nullable: true },
  },
  // ?from=ISO&to=ISO → nur Termine, die in den Zeitraum fallen können (Serien immer mitnehmen)
  listFilter: (sp, next) => {
    const out: string[] = []
    const from = sp.get('from')
    const to = sp.get('to')
    if (to && !Number.isNaN(Date.parse(to))) out.push(`start_at < ${next(new Date(to).toISOString())}`)
    if (from && !Number.isNaN(Date.parse(from))) {
      const f = next(new Date(from).toISOString())
      out.push(`(recurrence <> 'none' OR COALESCE(end_at, start_at) >= ${f})`)
      out.push(`(recurrence_until IS NULL OR recurrence_until >= (${f})::date - 1)`)
    }
    return out
  },
  prepare: (data, { existing }) => {
    if (data.recurrence === null) data.recurrence = existing?.recurrence ?? 'none'
    const start = (data.start_at ?? existing?.start_at) as string | Date
    const end = (data.end_at ?? existing?.end_at) as string | Date | null
    if (end && start && new Date(end) < new Date(start)) data.end_at = start
    return data
  },
}

/* ── Reminder-Listen ────────────────────────────────────────────────────── */
export const listsDef: ResourceDef = {
  table: 'planner_lists',
  label: 'Liste',
  orderBy: 'sort_order ASC, id ASC',
  fields: {
    name: { type: 'text', max: 80, required: true },
    color: { type: 'color' },
    sort_order: { type: 'int', min: 0, max: 100000, default: 0 },
  },
}

/* ── Reminder & To-dos ──────────────────────────────────────────────────── */
export const tasksDef: ResourceDef = {
  table: 'planner_tasks',
  label: 'Reminder',
  orderBy: 'done ASC, COALESCE(remind_at, due_at) ASC NULLS LAST, sort_order ASC, id ASC',
  fields: {
    list_id: { type: 'fk', table: 'planner_lists' },
    parent_id: { type: 'fk', table: 'planner_tasks' },
    title: { type: 'text', max: 300, required: true },
    notes: { type: 'text', max: 5000 },
    due_at: { type: 'ts' },
    remind_at: { type: 'ts' },
    repeat: { type: 'enum', values: REPEATS },
    done: { type: 'bool' },
    priority: { type: 'int', min: 0, max: 3, default: 0 },
    sort_order: { type: 'int', min: 0, max: 1000000, default: 0 },
  },
  prepare: async (data, { existing }) => {
    if (data.repeat === null) data.repeat = existing?.repeat ?? 'none'
    // Neue Erinnerungszeit → darf wieder benachrichtigen
    if ('remind_at' in data && String(data.remind_at) !== String(existing?.remind_at ?? null)) data.notified_at = null

    const becameDone = data.done === true && !existing?.done
    if ('done' in data) data.done_at = data.done ? new Date().toISOString() : null

    // Wiederholender Reminder abgehakt → nicht erledigt, sondern auf den nächsten Termin schieben
    const repeat = String(data.repeat ?? existing?.repeat ?? 'none')
    if (becameDone && isRecurrence(repeat) && repeat !== 'none') {
      const now = new Date()
      const remind = (data.remind_at ?? existing?.remind_at) as string | Date | null
      const due = (data.due_at ?? existing?.due_at) as string | Date | null
      const anchor = remind ?? due
      if (anchor) {
        // Nächster Termin NACH dem aktuellen (auch wenn man vorzeitig abhakt)
        const anchorDate = new Date(anchor)
        const nextAnchor = nextAfter(anchorDate, repeat, anchorDate > now ? anchorDate : now)
        if (nextAnchor) {
          const shift = nextAnchor.getTime() - new Date(anchor).getTime()
          if (remind) data.remind_at = new Date(new Date(remind).getTime() + shift).toISOString()
          if (due) data.due_at = new Date(new Date(due).getTime() + shift).toISOString()
          data.done = false
          data.done_at = null
          data.notified_at = null
          // Unterpunkte (To-do-Liste im Reminder) für die nächste Runde wieder zurücksetzen
          if (existing?.id) {
            await pool.query('UPDATE planner_tasks SET done = FALSE, done_at = NULL WHERE parent_id = $1', [existing.id])
          }
        }
      }
    }
    return data
  },
}

/* ── Wecker & Timer ─────────────────────────────────────────────────────── */
export const alarmsDef: ResourceDef = {
  table: 'planner_alarms',
  label: 'Wecker',
  orderBy: `kind ASC, time_of_day ASC NULLS LAST, next_fire_at ASC NULLS LAST, id ASC`,
  fields: {
    kind: { type: 'enum', values: ['alarm', 'timer'] as const },
    label: { type: 'text', max: 120 },
    time_of_day: { type: 'time' },
    days: { type: 'intarr', min: 0, max: 6 },
    duration_seconds: { type: 'int', min: 1, max: 60 * 60 * 48, nullable: true },
    enabled: { type: 'bool', default: true },
  },
  prepare: (data, { existing }) => {
    const kind = String(data.kind ?? existing?.kind ?? 'alarm')
    data.kind = kind
    const enabled = 'enabled' in data ? data.enabled : existing ? existing.enabled : true
    if (kind === 'timer') {
      const dur = Number(data.duration_seconds ?? existing?.duration_seconds ?? 0)
      if (!dur) throw new ValidationError('Timer braucht eine Dauer')
      // Timer startet beim Anlegen bzw. beim erneuten Einschalten
      if (!existing || (data.enabled === true && !existing.enabled)) {
        data.next_fire_at = new Date(Date.now() + dur * 1000).toISOString()
        data.enabled = true
      } else if (enabled === false) {
        data.next_fire_at = null
      }
    } else {
      const time = String(data.time_of_day ?? existing?.time_of_day ?? '')
      if (!time) throw new ValidationError('Wecker braucht eine Uhrzeit')
      const days = (data.days ?? existing?.days ?? []) as number[]
      data.next_fire_at = enabled ? nextAlarmFire(time, days).toISOString() : null
    }
    return data
  },
}

/* ── Stundenplan ────────────────────────────────────────────────────────── */
export const subjectsDef: ResourceDef = {
  table: 'timetable_subjects',
  label: 'Fach',
  orderBy: 'name ASC',
  fields: {
    name: { type: 'text', max: 80, required: true },
    short: { type: 'text', max: 8 },
    color: { type: 'color' },
    room: { type: 'text', max: 40 },
    teacher: { type: 'text', max: 80 },
  },
}

export const periodsDef: ResourceDef = {
  table: 'timetable_periods',
  label: 'Stunde',
  orderBy: 'period_no ASC',
  fields: {
    period_no: { type: 'int', min: 1, max: 20, required: true },
    start_time: { type: 'time', required: true },
    end_time: { type: 'time', required: true },
  },
}

export const homeworkDef: ResourceDef = {
  table: 'timetable_homework',
  label: 'Hausaufgabe',
  orderBy: 'done ASC, due_date ASC NULLS LAST, id ASC',
  fields: {
    subject_id: { type: 'fk', table: 'timetable_subjects' },
    title: { type: 'text', max: 500, required: true },
    notes: { type: 'text', max: 3000 },
    due_date: { type: 'date' },
    done: { type: 'bool' },
  },
}

export const examsDef: ResourceDef = {
  table: 'timetable_exams',
  label: 'Klausur',
  orderBy: 'exam_date ASC, start_time ASC NULLS LAST',
  fields: {
    subject_id: { type: 'fk', table: 'timetable_subjects' },
    kind: { type: 'enum', values: ['klausur', 'test', 'praesentation', 'abgabe', 'sonstiges'] as const },
    exam_date: { type: 'date', required: true },
    start_time: { type: 'time' },
    topic: { type: 'text', max: 300 },
    notes: { type: 'text', max: 3000 },
  },
  prepare: data => {
    if (data.kind === null) data.kind = 'klausur'
    return data
  },
}