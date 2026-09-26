// Kleine Helfer rund um "welches Gerät bin ich?" für Quick Share.
// Jedes Gerät bekommt eine zufällige ID (nur im Browser gespeichert). So kann der PC
// erkennen, dass eine Datei vom Handy kam, und nur dann "Neu" anzeigen.

const KEY = 'pv-device-id'
let memoryId: string | null = null

export function getDeviceId(): string {
  if (memoryId) return memoryId
  let id: string | null = null
  try {
    id = localStorage.getItem(KEY)
  } catch {
    // privater Modus o.ä. — dann gilt die ID nur für diese Sitzung
  }
  if (!id) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
    try {
      localStorage.setItem(KEY, id)
    } catch {
      /* egal */
    }
  }
  memoryId = id
  return id
}

export function getDeviceLabel(): 'Handy' | 'Tablet' | 'PC' {
  if (typeof navigator === 'undefined') return 'PC'
  const ua = navigator.userAgent
  if (/iPad|Tablet/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'Tablet'
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return 'Handy'
  return 'PC'
}

export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(pointer: coarse)').matches
}