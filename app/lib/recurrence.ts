// Wiederholungen für Kalendertermine, Reminder und Wecker.
// Gerechnet wird in Berliner Wanduhrzeit: "jeden Montag 08:00" bleibt 08:00,
// auch nach der Zeitumstellung. Wird im Browser (Anzeige) und auf dem Server
// (Benachrichtigungen) gleich verwendet.

import { addDaysYMD, addMonthsYMD, berlinParts, berlinToDate } from './berlin-time'

export type Recurrence = 'none' | 'daily' | 'weekdays' | 'weekly' | 'biweekly' | 'monthly' | 'yearly'

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  none: 'Nicht wiederholen',
  daily: 'Täglich',
  weekdays: 'Werktags (Mo–Fr)',
  weekly: 'Wöchentlich',
  biweekly: 'Alle 2 Wochen',
  monthly: 'Monatlich',
  yearly: 'Jährlich',
}

export const RECURRENCES = Object.keys(RECURRENCE_LABEL) as Recurrence[]

export function isRecurrence(v: unknown): v is Recurrence {
  return typeof v === 'string' && v in RECURRENCE_LABEL
}

/** Nächster Termin einer Serie nach `start` (ein Schritt). */
export function stepOnce(start: Date, rule: Recurrence): Date | null {
  if (rule === 'none') return null
  const p = berlinParts(start)
  let ymd = { year: p.year, month: p.month, day: p.day }
  switch (rule) {
    case 'daily': ymd = addDaysYMD(ymd.year, ymd.month, ymd.day, 1); break
    case 'weekly': ymd = addDaysYMD(ymd.year, ymd.month, ymd.day, 7); break
    case 'biweekly': ymd = addDaysYMD(ymd.year, ymd.month, ymd.day, 14); break
    case 'monthly': ymd = addMonthsYMD(ymd.year, ymd.month, ymd.day, 1); break
    case 'yearly': ymd = addMonthsYMD(ymd.year, ymd.month, ymd.day, 12); break
    case 'weekdays': {
      // Freitag → Montag, Samstag → Montag
      const add = p.weekday === 5 ? 3 : p.weekday === 6 ? 2 : 1
      ymd = addDaysYMD(ymd.year, ymd.month, ymd.day, add)
      break
    }
  }
  return berlinToDate(ymd.year, ymd.month, ymd.day, p.hour, p.minute, p.second)
}

export interface Occurrence {
  start: Date
  end: Date
}

/**
 * Alle Vorkommen einer Serie, die den Zeitraum [from, to) berühren.
 * Für monatlich/jährlich wird vom Serienbeginn aus gezählt (sonst "wandert" der 31.).
 */
export function expandOccurrences(
  startAt: Date,
  endAt: Date | null,
  rule: Recurrence,
  until: Date | null,
  from: Date,
  to: Date,
  max = 500
): Occurrence[] {
  const duration = Math.max(0, (endAt?.getTime() ?? startAt.getTime()) - startAt.getTime())
  const out: Occurrence[] = []
  if (rule === 'none') {
    const end = new Date(startAt.getTime() + duration)
    if (startAt < to && (end > from || startAt >= from)) out.push({ start: startAt, end })
    return out
  }

  const base = berlinParts(startAt)
  let current: Date | null = startAt
  let n = 0
  let guard = 0
  while (current && current < to && guard++ < 5000) {
    if (until && current > until) break
    const end = new Date(current.getTime() + duration)
    if (end > from || current >= from) {
      out.push({ start: current, end })
      if (out.length >= max) break
    }
    n++
    if (rule === 'monthly' || rule === 'yearly') {
      const ymd = addMonthsYMD(base.year, base.month, base.day, rule === 'monthly' ? n : n * 12)
      current = berlinToDate(ymd.year, ymd.month, ymd.day, base.hour, base.minute, base.second)
    } else {
      current = stepOnce(current, rule)
    }
  }
  return out
}

/** Nächstes Vorkommen ab `after` (für Reminder mit Wiederholung). */
export function nextAfter(startAt: Date, rule: Recurrence, after: Date): Date | null {
  if (rule === 'none') return startAt > after ? startAt : null
  let current: Date | null = startAt
  let guard = 0
  while (current && current <= after && guard++ < 5000) current = stepOnce(current, rule)
  return current
}