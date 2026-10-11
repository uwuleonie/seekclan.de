// Große Quizzes (z.B. 1.150 Flughäfen) haben ihre Einträge nicht im JavaScript-Bundle,
// sondern in public/geo/items/<datei>.json. Erst beim Öffnen eines Quiz wird die Datei geladen (einmal pro Sitzung).

import type { GeoItem, QuizDef } from './types'

const cache = new Map<string, Promise<Record<string, GeoItem[]>>>()

function loadFile(file: string): Promise<Record<string, GeoItem[]>> {
  let p = cache.get(file)
  if (!p) {
    p = fetch(`/geo/items/${file}.json`).then(r => {
      if (!r.ok) throw new Error(`Einträge "${file}" konnten nicht geladen werden (${r.status})`)
      return r.json()
    })
    p.catch(() => cache.delete(file))
    cache.set(file, p)
  }
  return p
}

/** Braucht mindestens ein Quiz nachgeladene Einträge? */
export const needsItems = (defs: QuizDef[]) => defs.some(d => d.itemsFile && !d.items.length)

/** Füllt die Einträge aller Quizzes, die sie aus einer Datei bekommen */
export async function resolveDefs(defs: QuizDef[]): Promise<QuizDef[]> {
  return Promise.all(defs.map(async d => {
    if (!d.itemsFile || d.items.length) return d
    const all = await loadFile(d.itemsFile)
    const items = all[d.slug]
    if (!items) throw new Error(`Einträge für "${d.title}" fehlen in ${d.itemsFile}.json`)
    return { ...d, items }
  }))
}

/** Anzahl Einträge eines Quiz (auch wenn sie noch nicht geladen sind) */
export const itemCount = (d: QuizDef) => d.items.length || d.count || 0