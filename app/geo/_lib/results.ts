// Bestwerte speichern: immer im Browser (localStorage), zusätzlich im Konto, wenn eingeloggt.

export type QuizMode = 'learn' | 'click' | 'name' | 'type' | 'text' | 'mixed'
export type Variant = 'normal' | 'sprint' | 'leben'

export interface RunResult {
  slug: string
  mode: QuizMode
  variant: Variant
  total: number
  right: number
  wrong: number
  seconds: number
  accuracy: number
}

export interface Best { accuracy: number; seconds: number; right: number; date: string }

const key = (slug: string, mode: QuizMode, variant: Variant) => `geo-best:${slug}:${mode}:${variant}`

/** Besser = mehr Prozent; bei gleichem Prozentwert schneller. Im Sprint zählt die Anzahl richtiger Antworten. */
export function isBetter(r: RunResult, prev: Best | null): boolean {
  if (!prev) return true
  if (r.variant === 'sprint') return r.right > prev.right || (r.right === prev.right && r.accuracy > prev.accuracy)
  return r.accuracy > prev.accuracy || (r.accuracy === prev.accuracy && r.seconds < prev.seconds)
}

export function readBest(slug: string, mode: QuizMode, variant: Variant): Best | null {
  try {
    const raw = localStorage.getItem(key(slug, mode, variant))
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

/** Speichert lokal; gibt true zurück, wenn es ein neuer Bestwert ist */
export function saveLocal(r: RunResult): boolean {
  const prev = readBest(r.slug, r.mode, r.variant)
  if (!isBetter(r, prev)) return false
  try {
    localStorage.setItem(key(r.slug, r.mode, r.variant), JSON.stringify({ accuracy: r.accuracy, seconds: r.seconds, right: r.right, date: new Date().toISOString() }))
  } catch { /* egal */ }
  return true
}

/** Höchster Prozentwert je Quiz aus dem Browser (für die Kacheln) */
export function readLocalBests(): Record<string, number> {
  const out: Record<string, number> = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k?.startsWith('geo-best:')) continue
      const slug = k.split(':')[1]
      const v = JSON.parse(localStorage.getItem(k) || 'null')
      if (v && typeof v.accuracy === 'number') out[slug] = Math.max(out[slug] ?? 0, v.accuracy)
    }
  } catch { /* egal */ }
  return out
}

/** Ergebnis ans Konto schicken (nur wenn eingeloggt). Gibt Bonus-XP zurück (z.B. fehlerfrei durchgespielt). */
export async function saveRemote(r: RunResult): Promise<{ amount: number; label: string }[]> {
  try {
    const res = await fetch('/api/geo/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(r),
    })
    const d = await res.json().catch(() => ({}))
    return Array.isArray(d.parts) ? d.parts : []
  } catch { return [] }
}