'use client'

// Typen, API-Zugriff und Datums-Helfer für den Planer (Browser-Seite).

import { expandOccurrences, isRecurrence, type Recurrence } from '@/app/lib/recurrence'

/* ── Typen (entsprechen den Datenbank-Tabellen) ─────────────────────────── */
export interface PEvent {
  id: number
  title: string
  description: string | null
  location: string | null
  color: string | null
  start_at: string
  end_at: string | null
  all_day: boolean
  recurrence: Recurrence
  recurrence_until: string | null
  remind_minutes: number | null
}
export interface PList { id: number; name: string; color: string | null; sort_order: number }
export interface PTask {
  id: number
  list_id: number | null
  parent_id: number | null
  title: string
  notes: string | null
  due_at: string | null
  remind_at: string | null
  repeat: Recurrence
  done: boolean
  done_at: string | null
  priority: number
  sort_order: number
  created_at: string
}
export interface PAlarm {
  id: number
  kind: 'alarm' | 'timer'
  label: string | null
  time_of_day: string | null
  days: number[]
  duration_seconds: number | null
  enabled: boolean
  next_fire_at: string | null
  last_fired_at: string | null
}
export interface PSubject { id: number; name: string; short: string | null; color: string | null; room: string | null; teacher: string | null }
export interface PPeriod { id: number; period_no: number; start_time: string; end_time: string }
export interface PSlot { id: number; weekday: number; period_no: number; subject_id: number; room: string | null }
export interface PHomework { id: number; subject_id: number | null; title: string; notes: string | null; due_date: string | null; done: boolean }
export interface PExam {
  id: number
  subject_id: number | null
  kind: 'klausur' | 'test' | 'praesentation' | 'abgabe' | 'sonstiges'
  exam_date: string
  start_time: string | null
  topic: string | null
  notes: string | null
}

export const EXAM_KIND: Record<PExam['kind'], string> = {
  klausur: 'Klausur', test: 'Test', praesentation: 'Präsentation', abgabe: 'Abgabe', sonstiges: 'Sonstiges',
}

/* ── API ────────────────────────────────────────────────────────────────── */
export class ApiError extends Error {}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {}
  const res = await fetch(`/api/private/${path}`, {
    cache: 'no-store',
    ...rest,
    headers: json !== undefined ? { 'Content-Type': 'application/json', ...(rest.headers ?? {}) } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError((data as { error?: string }).error || `Fehler ${res.status}`)
  return data as T
}

/* ── Datum (Browser-Zeit = Berlin für Leonie) ───────────────────────────── */
export const pad = (n: number) => String(n).padStart(2, '0')
export const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const timeKey = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
export function fromKeys(date: string, time = '00:00'): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  return new Date(y, m - 1, d, h || 0, mi || 0)
}
export function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }
export function addDays(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes()) }
export function startOfWeek(d: Date) {
  const day = (d.getDay() + 6) % 7 // Montag = 0
  return startOfDay(addDays(d, -day))
}
export function sameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate() }

export const WEEKDAYS_MO = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
export const WEEKDAYS_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']

export const fmtTime = (d: Date) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
export const fmtDay = (d: Date) => d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })
export const fmtDayLong = (d: Date) => d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })

export function relDay(d: Date, now = new Date()): string {
  const diff = Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / 86400000)
  if (diff === 0) return 'Heute'
  if (diff === 1) return 'Morgen'
  if (diff === -1) return 'Gestern'
  if (diff > 1 && diff < 7) return WEEKDAYS_LONG[d.getDay()]
  return fmtDay(d)
}

/* ── Termine aufklappen (Serien → einzelne Vorkommen) ───────────────────── */
export interface Occ {
  key: string
  event: PEvent
  start: Date
  end: Date
}

export function occurrencesIn(events: PEvent[], from: Date, to: Date): Occ[] {
  const out: Occ[] = []
  for (const e of events) {
    const rule = isRecurrence(e.recurrence) ? e.recurrence : 'none'
    const until = e.recurrence_until ? fromKeys(e.recurrence_until, '23:59') : null
    const list = expandOccurrences(new Date(e.start_at), e.end_at ? new Date(e.end_at) : null, rule, until, from, to, 400)
    for (const o of list) out.push({ key: `${e.id}:${o.start.toISOString()}`, event: e, start: o.start, end: o.end })
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime() || Number(b.event.all_day) - Number(a.event.all_day))
}

/** Nächstes Datum, an dem ein Fach laut Stundenplan stattfindet (für "Hausaufgabe zur nächsten Stunde") */
export function nextLessonDate(subjectId: number, slots: PSlot[], from = new Date(), skip = 0): string | null {
  const days = new Set(slots.filter(s => s.subject_id === subjectId).map(s => s.weekday)) // 1 = Mo … 6 = Sa
  if (!days.size) return null
  let found = 0
  for (let i = 1; i <= 60; i++) {
    const d = addDays(startOfDay(from), i)
    const wd = d.getDay() === 0 ? 7 : d.getDay()
    if (days.has(wd)) {
      if (found === skip) return dateKey(d)
      found++
    }
  }
  return null
}

export const EVENT_COLORS = ['#d93690', '#a93bc9', '#7c4ae0', '#5b6ee8', '#3f9bb5', '#25845c', '#e0913a', '#c0344f']
export const REMIND_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'Keine Erinnerung' },
  { value: 0, label: 'Zum Beginn' },
  { value: 5, label: '5 Min. vorher' },
  { value: 10, label: '10 Min. vorher' },
  { value: 15, label: '15 Min. vorher' },
  { value: 30, label: '30 Min. vorher' },
  { value: 60, label: '1 Std. vorher' },
  { value: 120, label: '2 Std. vorher' },
  { value: 1440, label: '1 Tag vorher' },
  { value: 2880, label: '2 Tage vorher' },
  { value: 10080, label: '1 Woche vorher' },
]