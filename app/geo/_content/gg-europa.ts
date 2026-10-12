// GeoGuessr Europa (Phase 6): Lernkarten und Karten-Quizzes zu den Hinweisen aus Plonk It und dem GeoGuessr-Guide.
// Lernkarten:      public/geo/items/gg-karten.json   (special: 'schrift', Komponente SchriftQuiz – mit Bildern)
// Karten-Quizzes:  public/geo/items/gg-orte.json     (Kennzeichen-Regionen, Ortsschild-/Wegweiser-/Kennzeichen-Farben)
// Steckbriefe:     public/geo/gg/…                   (Seiten /geo/geoguessr und /geo/geoguessr/<land>)
// Erzeugt von scripts/geo/build-gg.mjs (Daten in scripts/geo/gg/ und scripts/geo/gg-daten.mjs).

import { GG_COUNTS, GG_MERKMAL_GROUPS } from '../_data/gg'
import type { GroupDef, Kind, LonLat, QuizDef } from '../_lib/types'
import { EUROPA_QUIZZES } from './europa'

const n = (slug: string) => GG_COUNTS[slug] ?? 0
const meta = (m: string, slug: string) => m.replace('#', n(slug).toLocaleString('de-DE'))
const EUROPA_FRAME: [LonLat, LonLat] = [[-25, 34], [45, 71.5]]

const SCH = 'GeoGuessr: Schilder'
const HIN = 'GeoGuessr: Hinweise'
const KAR = 'GeoGuessr: Karten'

/** Lernkarten (Bild oder Hinweis → Land) */
function deck(slug: string, title: string, m: string, section: string, text: string, kind: Kind = 'wissen'): QuizDef {
  return {
    slug, title, meta: meta(m, slug), bereich: 'europa', kind, section, text,
    special: 'schrift', items: [], itemsFile: 'gg-karten', count: n(slug),
    askClick: 'Welches Land?', askName: 'Welches Land?', itemsNoun: 'Karten',
    groups: {}, layers: [], combinable: false,
  }
}

/** Kennzeichen-Regionen: gleiche Karte wie das Regionen-Quiz des Landes */
function regionen(slug: string, base: string, title: string, m: string, text: string, ask: [string, string, string], tip?: QuizDef['tip']): QuizDef {
  const b = EUROPA_QUIZZES.find(q => q.slug === base)
  if (!b) throw new Error(`Basis-Quiz fehlt: ${base}`)
  return {
    ...b, slug, title, meta: meta(m, slug), text, kind: 'kennzeichen', section: KAR, country: undefined,
    items: [], itemsFile: 'gg-orte', count: n(slug),
    askClick: ask[0], askName: ask[1], askText: ask[2], itemsNoun: 'Regionen', tip,
    intro: 'Lernmodus – tippe auf eine Region: Kennzeichen-Code und Name.',
  }
}

/** Europa nach einem Merkmal gefärbt */
function merkmalKarte(slug: string, title: string, m: string, text: string, ask: [string, string, string], tip?: QuizDef['tip']): QuizDef {
  return {
    slug, title, meta: meta(m, slug), bereich: 'europa', kind: 'wissen', section: KAR, text,
    items: [], itemsFile: 'gg-orte', count: n(slug),
    askClick: ask[0], askName: ask[1], askText: ask[2], itemsNoun: 'Länder',
    groups: (GG_MERKMAL_GROUPS[slug] ?? {}) as Record<string, GroupDef>, layers: ['world'], frame: EUROPA_FRAME, contextLayer: 'world-eu', labelSize: 8, tip,
    intro: 'Lernmodus – die Farben auf der Karte zeigen das Merkmal. Tippe auf ein Land für Details.',
  }
}

export const GG_QUIZZES: QuizDef[] = [
  /* ── Schilder ── */
  deck('gg-ortsschilder', 'Ortsschilder Europas', '# Schilder · welches Land?', SCH,
    'Gelb, blau, weiß mit rotem Rand: An der Ortstafel erkennst du viele Länder sofort. Die offiziellen Schilder aus ganz Europa.'),
  deck('gg-zebrastreifen', 'Zebrastreifen-Schilder', '# Schilder · für Profis', SCH,
    'Fast überall blau mit weißem Dreieck – und trotzdem alle verschieden. Blauton, Dreieck und Figur verraten das Land.'),
  deck('gg-strassennummern', 'Straßennummern Europas', '# Nummernschilder', SCH,
    'A 12 rot, B 27 gelb, M62 blau: Farbe und Form der Straßennummer verraten das Land oft schon von weitem.'),
  deck('gg-poller', 'Poller Europas', '# Poller · welches Land?', SCH,
    'Roter, oranger oder gelber Reflektor, schwarzer Kopf oder Band, dreieckig oder rund: Am Poller erkennst du sehr viele Länder.'),
  deck('gg-wegweiser', 'Wegweiser Europas', '# Wegweiser · welches Land?', SCH,
    'Gelb, blau, grün oder weiß, pfeilförmig oder rechteckig, eine oder zwei Schriften: Woher kommt dieser Wegweiser?'),

  /* ── Hinweise ── */
  deck('gg-hinweise', 'GeoGuessr-Hinweise: welches Land?', '# Hinweise · nach Kategorie', HIN,
    'Poller, Kennzeichen, Strommasten, Google-Auto: rund 750 Hinweise aus Plonk It – lerne sie Kategorie für Kategorie mit der Lernkartei.'),
  deck('gg-rate-das-land', 'Rate das Land: drei Hinweise', '# Runden', HIN,
    'Wie in einer echten Runde: drei Hinweise zusammen – welches Land ist es?'),

  /* ── Karten ── */
  regionen('gg-ru-kennzeichen', 'ru-subjekte', 'Russland: Kennzeichen-Regionen', '# Regionen · 77, 50, 16 …',
    'Die Zahl rechts auf dem russischen Kennzeichen verrät die Region: 77 Moskau, 78 Sankt Petersburg, 16 Tatarstan …',
    ['Wo ist die Region mit diesem Code?', 'Welche Region ist markiert?', 'Welche Region hat diesen Code?'],
    { title: 'GeoGuessr-Tipp', text: 'Dreistellige Codes (z. B. 116, 750) kamen dazu, als die zweistelligen aufgebraucht waren – sie gehören zur selben Region.' }),
  regionen('gg-pl-kennzeichen', 'pl-woiwodschaften', 'Polen: Kennzeichen-Buchstaben', '# Woiwodschaften · W, K, S …',
    'Der erste Buchstabe auf dem polnischen Kennzeichen zeigt die Woiwodschaft: W Masowien, K Kleinpolen, S Schlesien …',
    ['Wo ist die Woiwodschaft mit diesem Buchstaben?', 'Welche Woiwodschaft ist markiert?', 'Welche Woiwodschaft?']),
  regionen('gg-ua-kennzeichen', 'ua-oblaste', 'Ukraine: Kennzeichen-Buchstaben', '# Oblaste · AA, BC, AX …',
    'Die zwei Buchstaben vorne auf dem ukrainischen Kennzeichen verraten die Oblast: AA Kyjiw, BC Lwiw, AX Charkiw …',
    ['Wo ist die Oblast mit diesen Buchstaben?', 'Welche Oblast ist markiert?', 'Welche Oblast?'],
    { title: 'Gut zu wissen', text: 'Neuere Kennzeichen nutzen zusätzliche Buchstabenpaare (z. B. KA statt AA für Kyjiw).' }),
  merkmalKarte('gg-ortsschild-karte', 'Karte: Farbe der Ortsschilder', '# Länder · gelb, blau, weiß …',
    'Ganz Europa nach der Farbe der Ortsschilder gefärbt – merke dir die Muster.',
    ['Wo liegt das Land?', 'Welches Land ist markiert?', 'Welche Farbe?'],
    { title: 'GeoGuessr-Tipp', text: '„gemischt“ heißt: Es gibt mehrere Varianten, z. B. blau an Hauptstraßen und weiß an Nebenstraßen (Schweiz).' }),
  merkmalKarte('gg-wegweiser-karte', 'Karte: Farbe der Wegweiser', '# Länder',
    'Gelbe Wegweiser in Skandinavien und auf dem Balkan, blaue im Osten, grüne in Polen und Ungarn: die Wegweiser-Farben Europas.',
    ['Wo liegt das Land?', 'Welches Land ist markiert?', 'Welche Farbe?']),
  merkmalKarte('gg-linien-karte', 'Karte: Linienfarben', '# Länder · weiß, gelb …',
    'Fast überall weiß – aber Norwegen hat gelbe Mittellinien, Irland gelbe Ränder und Finnland, Griechenland, Türkei und Schweiz teils gelbe Linien.',
    ['Wo liegt das Land?', 'Welches Land ist markiert?', 'Welche Linienfarben?'],
    { title: 'GeoGuessr-Tipp', text: 'Grau = keine Angabe in den Quellen. In den meisten Ländern Europas sind alle Linien weiß.' }),
  merkmalKarte('gg-kennzeichen-karte', 'Karte: Gelbe Kennzeichen hinten', '# Länder',
    'Wo ist das hintere Kennzeichen gelb? Ein schneller Hinweis, den man oft schon von weitem sieht.',
    ['Wo liegt das Land?', 'Welches Land ist markiert?', 'Welche Farbe hat das hintere Kennzeichen?']),
]