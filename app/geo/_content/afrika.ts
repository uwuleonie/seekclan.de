// Afrika-Quizzes: Länder, Hauptstädte, Flaggen und Umrisse in vier Stufen, Regionen, Provinzen aller 54 Länder mit Hauptorten,
// Kreise der GeoGuessr-Länder, Flüsse, Seen, Berge, Wüsten, Inseln, Nationalparks, Welterbe, Städte, Sprachen, Geschichte,
// Klima, Wirtschaft, Tiere und Pflanzen.
// Die Definitionen erzeugt scripts/geo/build-afrika.mjs (app/geo/_data/afrika.ts), die Einträge liegen in public/geo/items/afrika-*.json,
// die Karten-Ebenen in public/geo/layers/af-*.json.

import { AF_DEFS } from '../_data/afrika'
import type { GroupDef, Kind, QuizDef } from '../_lib/types'
import { C } from './palette'

type Farbe = keyof typeof C

export const AFRIKA_QUIZZES: QuizDef[] = AF_DEFS.map(d => {
  const groups: Record<string, GroupDef> = Object.fromEntries(Object.entries(d.groups).map(([k, [name, farbe]]) => [k, { name, color: C[farbe as Farbe] ?? farbe }]))
  return {
    slug: d.slug, title: d.title, meta: d.meta, text: d.text, bereich: 'afrika', kind: d.kind as Kind, section: d.section,
    country: d.country, difficulty: d.difficulty as QuizDef['difficulty'], gg: d.gg,
    items: [], itemsFile: d.file, count: d.count,
    itemsNoun: d.noun, askClick: d.ask[0], askName: d.ask[1], askText: d.ask[2],
    groups, layers: d.layers, frame: d.frame, labelSize: d.labelSize ?? 8,
    tip: d.tip, intro: d.intro, combinable: d.combinable, merkmal: d.merkmal, rang: d.rang, special: d.special,
  }
})