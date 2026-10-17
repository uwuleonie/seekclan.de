// Große Quizzes (z.B. 1.150 Flughäfen) haben ihre Einträge nicht im JavaScript-Bundle,
// sondern in public/geo/items/<datei>.json. Erst beim Öffnen eines Quiz wird die Datei geladen (einmal pro Sitzung).

import type { GeoItem, QuizDef } from './types'
import { ggEintraege, ggListe } from './gg'

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

/** Braucht mindestens ein Quiz nachgeladene Einträge? (GG-Editionen werden immer erst hier gefiltert) */
export const needsItems = (defs: QuizDef[]) => defs.some(d => d.ggQuelle || (d.itemsFile && !d.items.length))

/** Füllt die Einträge aller Quizzes, die sie aus einer Datei bekommen – GG-Editionen mit der aktuellen GG-Länderliste */
export async function resolveDefs(defs: QuizDef[]): Promise<QuizDef[]> {
  return Promise.all(defs.map(async d => {
    if (d.ggQuelle) {
      let src = d.items
      if (!src.length && d.itemsFile) {
        const all = await loadFile(d.itemsFile)
        src = all[d.ggQuelle.slug] ?? []
      }
      const items = ggEintraege(src, d.ggQuelle, ggListe())
      if (!items.length) throw new Error(`Für "${d.title}" sind keine Länder mit GeoGuessr-Abdeckung eingetragen`)
      return { ...d, items, ggQuelle: undefined }
    }
    if (!d.itemsFile || d.items.length) return d
    const all = await loadFile(d.itemsFile)
    const items = all[d.slug]
    if (!items) throw new Error(`Einträge für "${d.title}" fehlen in ${d.itemsFile}.json`)
    return { ...d, items }
  }))
}

/** Anzahl Einträge eines Quiz (auch wenn sie noch nicht geladen sind) */
export const itemCount = (d: QuizDef) => d.items.length || d.count || 0

/**
 * Merkmals-Quiz mit Nicht-Mitgliedern (z.B. EU): Länder aus merkmal.rest, deren Fläche im Quiz fehlt, kommen als Gruppe „nein“ dazu –
 * damit „Alle finden“ und „Ja oder Nein?“ auch falsche Antworten haben.
 */
export function withRest(d: QuizDef): QuizDef {
  const rest = d.merkmal?.rest
  if (!rest || !d.items.length || d.items.some(i => i.group === 'nein')) return d
  const have = new Set(d.items.flatMap(i => i.areas ?? []))
  const extra = rest.items
    .filter(i => i.areas?.length && !i.areas.some(a => have.has(a)))
    .map(i => ({ key: `nein:${i.areas![0]}`, label: i.label, group: 'nein', areas: i.areas, flag: i.flag, aliases: i.aliases, details: i.details }))
  return { ...d, items: [...d.items, ...extra], groups: { ...d.groups, nein: { name: rest.name, color: '#6b7280' } } }
}