// Freischalt-Plan: Quizzes ohne Datum automatisch nach einem Rhythmus freischalten.
//
// Rhythmus = "X Quizzes an einem Freischalt-Tag, danach Y Tage Pause", z.B. 2 Quizzes · 3 Tage Pause:
//   Mo 2 Quizzes · Di, Mi, Do Pause · Fr 2 Quizzes · Sa, So, Mo Pause · Di 2 Quizzes …
// Alle Zeiten gelten in deutscher Zeit (Europe/Berlin), auch über die Zeitumstellung.
// Hand-gesetzte Termine werden nie angefasst – der Plan füllt nur Quizzes ohne Datum.
// Wird von Adminpanel (Vorschau) und Server (Termine schreiben) gleich benutzt.

import type { CatalogEntry } from './types'
import { ALWAYS_OPEN } from './catalog'

export interface PlanConfig {
  /** Automatik an: neue Quizzes ohne Datum werden von selbst hinten angehängt */
  active: boolean
  /** Quizzes pro Freischalt-Tag (1–4) */
  perDay: number
  /** Pausetage nach jedem Freischalt-Tag (0–6) */
  pause: number
  /** Uhrzeit der ersten Freischaltung am Tag, "HH:MM" */
  time: string
  /** Mehrere am selben Tag: Abstand in Stunden (0 = alle gleichzeitig) */
  spread: number
  /** Erster möglicher Freischalt-Tag "YYYY-MM-DD" (leer = ab morgen) */
  start: string
  /** Reihenfolge: wie im Adminpanel sortiert, oder abwechselnd nach Bereich und Thema gemischt */
  order: 'reihenfolge' | 'gemischt'
  /** Nur diese Bereiche (leer = alle) */
  bereiche: string[]
  /** Diese Quizzes nie automatisch planen */
  skip: string[]
}

export const PLAN_DEFAULT: PlanConfig = {
  active: false, perDay: 2, pause: 1, time: '18:00', spread: 0, start: '', order: 'gemischt', bereiche: [], skip: [],
}

export const PLAN_PRESETS: { key: string; label: string; perDay: number; pause: number; hint: string }[] = [
  { key: 'taeglich', label: 'Jeden Tag eins', perDay: 1, pause: 0, hint: 'Ruhig und regelmäßig – 7 pro Woche' },
  { key: 'jeden2', label: 'Jeden 2. Tag', perDay: 1, pause: 1, hint: 'Gemütlich – 3 bis 4 pro Woche' },
  { key: 'doppel', label: 'Täglich zwei', perDay: 2, pause: 0, hint: 'Schnell – 14 pro Woche' },
  { key: 'doppel2', label: 'Zwei, Pause, zwei', perDay: 2, pause: 1, hint: 'Ausgewogen – 7 pro Woche' },
  { key: 'paket', label: 'Zwei, drei Tage Pause', perDay: 2, pause: 3, hint: 'Mit Vorfreude – 3 bis 4 pro Woche' },
  { key: 'drei', label: 'Drei alle drei Tage', perDay: 3, pause: 2, hint: 'Kleine Pakete – 7 pro Woche' },
  { key: 'woche', label: 'Wochen-Paket', perDay: 4, pause: 6, hint: 'Einmal pro Woche vier neue' },
  { key: 'gross', label: 'Vier, vier Tage Pause', perDay: 4, pause: 4, hint: 'Große Pakete – 5 bis 6 pro Woche' },
]

export function cleanPlan(v: unknown): PlanConfig {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<PlanConfig>
  const int = (x: unknown, lo: number, hi: number, d: number) => (Number.isFinite(Number(x)) ? Math.max(lo, Math.min(hi, Math.round(Number(x)))) : d)
  return {
    active: o.active === true,
    perDay: int(o.perDay, 1, 4, PLAN_DEFAULT.perDay),
    pause: int(o.pause, 0, 6, PLAN_DEFAULT.pause),
    time: typeof o.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(o.time) ? o.time : PLAN_DEFAULT.time,
    spread: [0, 1, 2, 3, 4, 6].includes(Number(o.spread)) ? Number(o.spread) : 0,
    start: typeof o.start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.start) ? o.start : '',
    order: o.order === 'reihenfolge' ? 'reihenfolge' : 'gemischt',
    bereiche: Array.isArray(o.bereiche) ? o.bereiche.map(String).slice(0, 20) : [],
    skip: Array.isArray(o.skip) ? [...new Set(o.skip.map(String))].slice(0, 3000) : [],
  }
}

/** Quizzes pro Woche (Durchschnitt) */
export const perWeek = (p: Pick<PlanConfig, 'perDay' | 'pause'>) => (p.perDay * 7) / (p.pause + 1)

/* ───────────── Deutsche Zeit ───────────── */

const TZ = 'Europe/Berlin'
/** Minuten, die Berlin zu diesem Zeitpunkt vor UTC liegt (60 oder 120) */
function offsetMin(d: Date): number {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(d).map(p => [p.type, p.value]))
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute)
  return Math.round((asUtc - Math.floor(d.getTime() / 60000) * 60000) / 60000)
}
/** Kalendertag in deutscher Zeit als Zahl (Tage seit 1970) */
export function berlinDay(d: Date): number {
  return Math.floor((d.getTime() + offsetMin(d) * 60000) / 86400000)
}
/** Tag (Tage seit 1970) + Uhrzeit in deutscher Zeit → echter Zeitpunkt */
export function berlinAt(day: number, minutes: number): Date {
  const guess = day * 86400000 + minutes * 60000
  let t = guess - offsetMin(new Date(guess)) * 60000
  const o2 = offsetMin(new Date(t))
  t = guess - o2 * 60000
  return new Date(t)
}
const dayOfYmd = (ymd: string) => Math.floor(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) / 86400000)
const minutesOf = (hhmm: string) => +hhmm.slice(0, 2) * 60 + +hhmm.slice(3, 5)

/**
 * Freie Termine nach dem Rhythmus.
 * after: letzter bereits automatisch geplanter Termin (dann wird daran angeschlossen) – sonst ab Startdatum bzw. morgen.
 */
export function planSlots(p: PlanConfig, count: number, now: Date, after?: { at: Date; sameDay: number } | null): Date[] {
  const out: Date[] = []
  if (count <= 0) return out
  const base = minutesOf(p.time)
  const timeOf = (day: number, i: number) => berlinAt(day, base + i * p.spread * 60)
  let day: number, i: number
  if (after && after.at.getTime() > now.getTime()) {
    day = berlinDay(after.at)
    i = after.sameDay
    if (i >= p.perDay) { day += p.pause + 1; i = 0 }
  } else {
    const today = berlinDay(now)
    day = Math.max(today + 1, p.start ? dayOfYmd(p.start) : today + 1)
    i = 0
  }
  while (out.length < count) {
    const at = timeOf(day, i)
    if (at.getTime() > now.getTime()) out.push(at)
    i++
    if (i >= p.perDay) { day += p.pause + 1; i = 0 }
  }
  return out
}

/** Reihum aus mehreren Listen nehmen: a1 b1 c1 a2 b2 c2 … */
function roundRobin<T>(lists: T[][]): T[] {
  const qs = lists.map(l => [...l])
  const out: T[] = []
  while (qs.some(q => q.length)) for (const q of qs) { const e = q.shift(); if (e) out.push(e) }
  return out
}
const groupBy = <T,>(list: T[], key: (x: T) => string) => {
  const m = new Map<string, T[]>()
  for (const x of list) m.set(key(x), [...(m.get(key(x)) ?? []), x])
  return [...m.values()]
}

/**
 * Abwechslungsreich: reihum aus den Bereichen (Europa, Asien, Sprachen …), innerhalb eines Bereichs reihum nach Thema –
 * so kommen nie zwei Quizzes aus demselben Bereich direkt hintereinander, solange es noch andere gibt.
 */
function mix<T extends CatalogEntry>(list: T[]): T[] {
  // Große Bereiche öfter drannehmen: Anteil nach Größe statt strikt reihum
  const perBereich = groupBy(list, e => e.bereich).map(es => roundRobin(groupBy(es, e => e.kind)))
  const out: T[] = []
  const pos = perBereich.map(() => 0)
  const total = list.length
  while (out.length < total) {
    // Der Bereich, der im Verhältnis zu seiner Größe am weitesten zurückliegt, ist dran
    let best = -1, bestScore = Infinity
    perBereich.forEach((es, i) => {
      if (pos[i] >= es.length) return
      const score = (pos[i] + 1) / es.length
      if (score < bestScore - 1e-9 || (Math.abs(score - bestScore) < 1e-9 && out.at(-1)?.bereich !== es[0].bereich)) { best = i; bestScore = score }
    })
    out.push(perBereich[best][pos[best]++])
  }
  // Benachbarte gleiche Bereiche oder Länder möglichst auseinanderziehen
  for (let i = 1; i < out.length; i++) {
    const same = (a: T, b: T) => a.bereich === b.bereich || (!!a.country && a.country === b.country)
    if (same(out[i], out[i - 1])) {
      const j = out.findIndex((e, k) => k > i && !same(e, out[i - 1]) && (k + 1 >= out.length || !same(out[i], out[k + 1])))
      if (j > 0) [out[i], out[j]] = [out[j], out[i]]
    }
  }
  return out
}

/**
 * Warteschlange: gebaute Quizzes ohne Termin, in Plan-Reihenfolge.
 * list muss schon in Admin-Reihenfolge sortiert sein. hasDate = Quiz hat einen Termin (Hand oder Plan).
 */
export function planQueue<T extends CatalogEntry>(list: T[], p: PlanConfig, hasDate: (slug: string) => boolean): T[] {
  const skip = new Set(p.skip)
  const open = list.filter(e => !e.planned && !ALWAYS_OPEN.has(e.slug) && !hasDate(e.slug) && !skip.has(e.slug) && (!p.bereiche.length || p.bereiche.includes(e.bereich)))
  return p.order === 'gemischt' ? mix(open) : open
}