// Spielstände zum Fortsetzen: Wer ein Quiz mittendrin verlässt, kann später weitermachen,
// das Ergebnis so speichern, wie es ist, oder den Stand verwerfen.
// Immer im Browser (localStorage), zusätzlich im Konto, wenn eingeloggt (Tabelle geo_saves).

import type { QuizMode, Variant } from './results'

export interface SaveState {
  v: 1
  /** Schlüssel des Quiz (bei Mixen "mix:a+b") */
  slug: string
  title: string
  /** Adresse zum Fortsetzen */
  href: string
  mode: QuizMode
  variant: Variant
  queue: string[]
  solved: string[]
  mistakes: string[]
  score: { right: number; wrong: number; streak: number; bestStreak: number }
  lives: number
  /** Bisher gespielte Zeit in Sekunden */
  elapsed: number
  onlyKeys: string[] | null
  total: number
  savedAt: string
}

const LKEY = (slug: string) => `geo-save:${slug}`

export function readLocalSave(slug: string): SaveState | null {
  try {
    const raw = localStorage.getItem(LKEY(slug))
    const s = raw ? (JSON.parse(raw) as SaveState) : null
    return s?.v === 1 ? s : null
  } catch { return null }
}

export function listLocalSaves(): SaveState[] {
  const out: SaveState[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k?.startsWith('geo-save:')) continue
      const s = readLocalSave(k.slice(9))
      if (s) out.push(s)
    }
  } catch { /* egal */ }
  return out
}

export function writeLocalSave(s: SaveState) {
  try { localStorage.setItem(LKEY(s.slug), JSON.stringify(s)) } catch { /* voll oder gesperrt – egal */ }
}

export function removeLocalSave(slug: string) {
  try { localStorage.removeItem(LKEY(slug)) } catch { /* egal */ }
}

/* ── Konto ── */

const timers = new Map<string, ReturnType<typeof setTimeout>>()
/** Im Konto speichern – gebündelt, höchstens alle paar Sekunden */
export function pushRemoteSave(s: SaveState, delay = 2500) {
  const old = timers.get(s.slug)
  if (old) clearTimeout(old)
  timers.set(s.slug, setTimeout(() => {
    timers.delete(s.slug)
    fetch('/api/geo/save', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: s.slug, state: s }), keepalive: true }).catch(() => {})
  }, delay))
}

export function deleteRemoteSave(slug: string) {
  const old = timers.get(slug)
  if (old) { clearTimeout(old); timers.delete(slug) }
  fetch('/api/geo/save', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug }) }).catch(() => {})
}

export async function listRemoteSaves(): Promise<SaveState[]> {
  try {
    const r = await fetch('/api/geo/save', { cache: 'no-store' })
    if (!r.ok) return []
    const d = await r.json()
    return (d.saves ?? []).map((x: { state: SaveState }) => x.state).filter((s: SaveState) => s?.v === 1)
  } catch { return [] }
}

/** Alle offenen Spielstände (Browser + Konto, der neuere gewinnt), neueste zuerst */
export async function listAllSaves(loggedIn: boolean): Promise<SaveState[]> {
  const map = new Map<string, SaveState>()
  for (const s of [...listLocalSaves(), ...(loggedIn ? await listRemoteSaves() : [])]) {
    const old = map.get(s.slug)
    if (!old || old.savedAt < s.savedAt) map.set(s.slug, s)
  }
  return [...map.values()].filter(s => s.queue.length > 0).sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

export function dropSave(slug: string, loggedIn: boolean) {
  removeLocalSave(slug)
  if (loggedIn) deleteRemoteSave(slug)
}

/** Fortschritt eines Spielstands für die Anzeige */
export const saveProgress = (s: SaveState) => {
  const done = Math.max(0, s.total - s.queue.length)
  const answered = s.score.right + s.score.wrong
  return { done, total: s.total, accuracy: answered ? Math.round((s.score.right / answered) * 100) : 0 }
}