// Wecker-Logik: wann klingelt ein Wecker als Nächstes?
// days = Wochentage (0 = So … 6 = Sa). Leer = einmalig (nächstes Mal, wenn die Uhrzeit kommt).

import { addDaysYMD, berlinParts, berlinToDate, parseTime } from './berlin-time'

export function nextAlarmFire(timeOfDay: string, days: number[], now = new Date()): Date {
  const [h, m] = parseTime(timeOfDay)
  const today = berlinParts(now)
  for (let i = 0; i <= 7; i++) {
    const ymd = addDaysYMD(today.year, today.month, today.day, i)
    const candidate = berlinToDate(ymd.year, ymd.month, ymd.day, h, m, 0)
    if (candidate <= now) continue
    const wd = (today.weekday + i) % 7
    if (!days.length || days.includes(wd)) return candidate
  }
  // Sollte nie passieren – Sicherheitsnetz
  return new Date(now.getTime() + 24 * 3600 * 1000)
}

export const WEEKDAY_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']