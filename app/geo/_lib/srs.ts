// Lernkartei (Wiederholen mit Abständen): 5 Fächer.
// Richtig → ein Fach weiter, wieder fällig nach dem Abstand des neuen Fachs. Falsch → zurück in Fach 1 und sofort wieder fällig.
// Eingeloggt im Konto (Tabelle geo_srs), sonst im Browser (localStorage „geo-srs“).

export interface CardState { box: number; due: string; right: number; wrong: number }
export type DeckState = Record<string, CardState>

/** Abstand je Fach in Tagen (nach einer richtigen Antwort): Fach 1 = morgen, Fach 5 = in einem Monat */
export const BOX_DAYS = [0, 1, 3, 7, 14, 30]
export const BOXES = 5
/** Neue Karten pro Tag und Deck */
export const NEW_PER_DAY = 10
/** Ab diesem Fach gilt eine Karte als „sicher“ */
export const SAFE_BOX = 4

export function nextState(prev: CardState | undefined, ok: boolean, now = Date.now()): CardState {
  const box = ok ? Math.min(BOXES, (prev?.box ?? 0) + 1) : 1
  const due = new Date(now + (ok ? BOX_DAYS[box] : 0) * 86400000).toISOString()
  return { box, due, right: (prev?.right ?? 0) + (ok ? 1 : 0), wrong: (prev?.wrong ?? 0) + (ok ? 0 : 1) }
}

export const isDue = (s: CardState | undefined, now = Date.now()) => !!s && Date.parse(s.due) <= now

/* ── Browser-Speicher (Gäste) ── */

const LS = 'geo-srs'
export function readLocal(): Record<string, DeckState> {
  try { return JSON.parse(localStorage.getItem(LS) || '{}') } catch { return {} }
}
export function writeLocal(all: Record<string, DeckState>) {
  try { localStorage.setItem(LS, JSON.stringify(all)) } catch { /* egal */ }
}

/** Wie viele neue Karten heute in diesem Deck schon dran waren (Browser, auch für Eingeloggte) */
export function newToday(deck: string): number {
  try {
    const o = JSON.parse(localStorage.getItem('geo-srs-new') || '{}')
    return o.day === new Date().toDateString() ? o[deck] ?? 0 : 0
  } catch { return 0 }
}
export function countNew(deck: string) {
  try {
    const day = new Date().toDateString()
    const o = JSON.parse(localStorage.getItem('geo-srs-new') || '{}')
    const next = o.day === day ? o : { day }
    next[deck] = (next[deck] ?? 0) + 1
    localStorage.setItem('geo-srs-new', JSON.stringify(next))
  } catch { /* egal */ }
}