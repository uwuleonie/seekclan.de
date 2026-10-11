// Merkliste „Meine Wörter“: Orte, Länder und Wörter aus allen Quizzes merken und im Sprachen-Lerntool üben.
// Eingeloggt im Konto (Tabelle geo_saved_words), sonst im Browser (localStorage „geo-words“).

import type { Say } from './audio'
import type { GeoItem } from './types'

export interface SavedWord {
  /** Schlüssel des Eintrags (wie im Quiz, z.B. "sp:524901" oder "land:DEU") */
  key: string
  /** Quiz, aus dem der Eintrag stammt */
  slug: string
  /** Name des Quiz (für die Gruppen in der Merkliste) */
  quiz: string
  /** Vorderseite: Name, wie er im Quiz steht (z.B. Москва) */
  c: string
  /** Rückseite: Bedeutung bzw. Antwort (z.B. Moskau, Hauptstadt, Land) */
  a: string
  /** Kleine Zeile (z.B. „Welche Stadt ist das?“ oder „Hauptstadt von …“) */
  sub?: string
  say?: Say
  flag?: string
  /** Gemerkt am (ISO-Zeit) */
  at: string
}

/** Aus einem Quiz-Eintrag eine Merkkarte machen */
export function wordFromItem(item: GeoItem, slug: string, quiz: string): SavedWord {
  const detail = item.details?.find(d => d.big)?.value ?? item.details?.[0]?.value
  return {
    key: item.key, slug, quiz,
    c: item.label,
    a: item.text?.answer && item.text.answer !== item.label ? item.text.answer : detail ?? item.label,
    sub: item.text?.sub ?? item.text?.prompt,
    say: item.say,
    flag: item.flag,
    at: new Date().toISOString(),
  }
}

/** Nur erlaubte Felder, gekürzt (Server und Browser) */
export function cleanWord(w: unknown): SavedWord | null {
  if (!w || typeof w !== 'object') return null
  const o = w as Record<string, unknown>
  const str = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : undefined)
  const key = str(o.key, 120), slug = str(o.slug, 120), c = str(o.c, 200)
  if (!key || !slug || !c) return null
  const say = o.say && typeof o.say === 'object' ? o.say as Record<string, unknown> : null
  return {
    key, slug, c,
    quiz: str(o.quiz, 160) ?? slug,
    a: str(o.a, 300) ?? '',
    sub: str(o.sub, 200),
    flag: str(o.flag, 12),
    say: say && typeof say.t === 'string' && typeof say.l === 'string'
      ? { t: say.t.slice(0, 200), l: say.l.slice(0, 16), a: Array.isArray(say.a) ? say.a.filter((u): u is string => typeof u === 'string' && u.startsWith('https://upload.wikimedia.org/')).slice(0, 3) : undefined }
      : undefined,
    at: str(o.at, 40) ?? new Date().toISOString(),
  }
}