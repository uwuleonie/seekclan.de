// Zeit-Helfer für Europe/Berlin — funktionieren auf dem Server UND im Browser.
//
// Warum? Der Server läuft in UTC. Ein Wecker "jeden Montag 07:00" meint aber 07:00
// deutscher Zeit, auch nach der Zeitumstellung. Deshalb wird immer über die
// Wanduhrzeit in Berlin gerechnet und erst am Ende in einen UTC-Zeitpunkt umgewandelt.

export const TZ = 'Europe/Berlin'

export interface ZonedParts {
  year: number
  month: number // 1–12
  day: number
  hour: number
  minute: number
  second: number
  weekday: number // 0 = Sonntag … 6 = Samstag
}

const dtf = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  weekday: 'short',
})
const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

/** UTC-Zeitpunkt → Wanduhrzeit in Berlin */
export function berlinParts(date: Date): ZonedParts {
  const p: Record<string, string> = {}
  for (const x of dtf.formatToParts(date)) p[x.type] = x.value
  return {
    year: Number(p.year), month: Number(p.month), day: Number(p.day),
    hour: Number(p.hour) % 24, minute: Number(p.minute), second: Number(p.second),
    weekday: WD[p.weekday] ?? 0,
  }
}

/** Wanduhrzeit in Berlin → UTC-Zeitpunkt (berücksichtigt Sommer-/Winterzeit) */
export function berlinToDate(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): Date {
  // Erst so tun, als wäre es UTC, dann den Versatz Berlins zu diesem Zeitpunkt abziehen.
  const guess = Date.UTC(year, month - 1, day, hour, minute, second)
  const offset1 = offsetAt(guess)
  let ts = guess - offset1
  const offset2 = offsetAt(ts)
  if (offset2 !== offset1) ts = guess - offset2 // Umstellungsnacht
  return new Date(ts)
}

function offsetAt(ts: number): number {
  const p = berlinParts(new Date(ts))
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(ts / 1000) * 1000
}

/** "YYYY-MM-DD" des Tages in Berlin */
export function berlinDateKey(date: Date): string {
  const p = berlinParts(date)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** Kalendertage addieren (reine Datumsrechnung, ohne Zeitzonen-Effekte) */
export function addDaysYMD(year: number, month: number, day: number, days: number) {
  const d = new Date(Date.UTC(year, month - 1, day + days))
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

/** Monate addieren; 31. + 1 Monat → letzter Tag des Folgemonats */
export function addMonthsYMD(year: number, month: number, day: number, months: number) {
  const first = new Date(Date.UTC(year, month - 1 + months, 1))
  const y = first.getUTCFullYear()
  const m = first.getUTCMonth() + 1
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { year: y, month: m, day: Math.min(day, last) }
}

/** "HH:MM" oder "HH:MM:SS" → [h, m] */
export function parseTime(t: string | null | undefined): [number, number] {
  const m = /^(\d{1,2}):(\d{2})/.exec(t || '')
  return m ? [Math.min(23, Number(m[1])), Math.min(59, Number(m[2]))] : [0, 0]
}

/** "YYYY-MM-DD" → {year, month, day} */
export function parseDateKey(s: string): { year: number; month: number; day: number } {
  const [y, m, d] = s.split('-').map(Number)
  return { year: y, month: m, day: d }
}