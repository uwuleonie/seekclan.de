// Welt-Quizzes: Flaggen, Vorwahlen, Domains, Rekorde, Kontinente, Meere, Gebirge, Flüsse, Seen, Wüsten,
// Millionenstädte, Flughäfen und Überseegebiete.
// Die Einträge sind groß und liegen deshalb in public/geo/items/*.json (erzeugt von scripts/geo/build-welt.mjs).

import { ITEM_COUNTS } from '../_data/welt-extra'
import type { GroupDef, Kind, LonLat, QuizDef } from '../_lib/types'

const KONT: Record<string, GroupDef> = {
  europa: { name: 'Europa', color: '#5b9bd5' },
  asien: { name: 'Asien', color: '#e0a84f' },
  afrika: { name: 'Afrika', color: '#d9774b' },
  nordamerika: { name: 'Nordamerika', color: '#c9637a' },
  suedamerika: { name: 'Südamerika', color: '#5fb07a' },
  ozeanien: { name: 'Ozeanien', color: '#3fa7a8' },
  antarktis: { name: 'Antarktis', color: '#9fb6c8' },
}
const OZEANE: Record<string, GroupDef> = {
  atlantik: { name: 'Atlantischer Ozean', color: '#3b82f6' },
  pazifik: { name: 'Pazifischer Ozean', color: '#14b8a6' },
  indik: { name: 'Indischer Ozean', color: '#eab308' },
  arktis: { name: 'Arktischer Ozean', color: '#38bdf8' },
  suedpolar: { name: 'Südlicher Ozean', color: '#a855f7' },
  binnen: { name: 'Binnenmeer', color: '#f97316' },
}

const WELT: [LonLat, LonLat] = [[-180, -58], [180, 84]]
const MIT_ANTARKTIS: [LonLat, LonLat] = [[-180, -84], [180, 85]]

type Opts = Partial<QuizDef> & {
  slug: string; title: string; meta: string; text: string; kind: Kind; section: string
  file: string; layers: string[]; noun: string; ask: [string, string, string?]
}

function q(o: Opts): QuizDef {
  const { file, noun, ask, ...rest } = o
  const count = ITEM_COUNTS[o.slug] ?? 0
  return {
    bereich: 'welt',
    groups: KONT,
    items: [],
    itemsFile: file,
    count,
    itemsNoun: noun,
    askClick: ask[0],
    askName: ask[1],
    askText: ask[2],
    frame: WELT,
    projection: 'naturalEarth',
    labelSize: 6,
    ...rest,
    meta: o.meta.replace('#', count.toLocaleString('de-DE')),
  }
}

const L = 'Länder & Hauptstädte'
const F = 'Flaggen & Codes'
const R = 'Rekorde'
const KM = 'Kontinente & Meere'
const GW = 'Gebirge & Wüsten'
const FS = 'Flüsse & Seen'
const SF = 'Städte & Flughäfen'
const UG = 'Überseegebiete'

export const WELT_EXTRA_QUIZZES: QuizDef[] = [
  /* ── Länder & Hauptstädte ── */
  q({
    slug: 'welt-hauptstaedte-schwer', title: 'Hauptstädte der Welt (schwer)', meta: '# Hauptstädte · nur Punkte', section: L, kind: 'hauptstaedte',
    text: 'Keine Landesgrenzen als Hilfe: Du musst den Punkt der Hauptstadt selbst treffen.',
    file: 'welt-laender', layers: ['world'], noun: 'Hauptstädte', ask: ['Wo liegt die Hauptstadt?', 'Welche Hauptstadt ist markiert?', 'Welche Hauptstadt?'],
    intro: 'Lernmodus – tippe auf einen Punkt, um die Hauptstadt zu sehen.',
    tip: { title: 'Tipp', text: 'In Europa und der Karibik liegen die Punkte dicht – reinzoomen hilft.' },
  }),
  q({
    slug: 'welt-binnenstaaten', title: 'Binnenstaaten', meta: '# Länder ohne Meer', section: L, kind: 'laender',
    text: 'Alle Staaten ohne Zugang zum offenen Meer – von Österreich bis Bolivien.',
    file: 'welt-laender', layers: ['world'], noun: 'Binnenstaaten', ask: ['Wo liegt das Land?', 'Wie heißt das markierte Land?'],
    tip: { title: 'Wusstest du?', text: 'Liechtenstein und Usbekistan sind doppelte Binnenstaaten: Auch alle ihre Nachbarn haben kein Meer.' },
  }),

  /* ── Flaggen & Codes ── */
  q({
    slug: 'welt-flaggen', title: 'Flaggen der Welt', meta: '# Flaggen', section: F, kind: 'flaggen',
    text: 'Flagge zum Land auf der Karte finden, die richtige Flagge wählen oder den Namen eintippen.',
    file: 'welt-laender', layers: ['world'], noun: 'Flaggen',
    ask: ['Zu welchem Land gehört die Flagge?', 'Welche Flagge hat das markierte Land?', 'Flagge erkennen'],
    intro: 'Lernmodus – tippe auf ein Land, um seine Flagge zu sehen.',
    tip: { title: 'Tipp', text: 'Viele Flaggen sehen sich ähnlich: Tschad & Rumänien, Indonesien & Monaco, Irland & Elfenbeinküste. Achte auf Details!' },
  }),
  q({
    slug: 'welt-vorwahlen', title: 'Telefon-Vorwahlen der Welt', meta: '# Ländervorwahlen', section: F, kind: 'vorwahlen',
    text: '+49, +33, +1 876 … Zu jeder Ländervorwahl das Land finden – oder umgekehrt.',
    file: 'welt-laender', layers: ['world'], noun: 'Vorwahlen',
    ask: ['Welches Land hat diese Vorwahl?', 'Welche Vorwahl hat das markierte Land?', 'Welche Vorwahl?'],
    tip: { title: 'Tipp', text: 'Die erste Ziffer verrät die Weltregion: 1 Nordamerika & Karibik, 2 Afrika, 3–4 Europa, 5 Lateinamerika, 6 Südostasien & Ozeanien, 7 Russland & Kasachstan, 8 Ostasien, 9 West-, Süd- und Zentralasien.' },
  }),
  q({
    slug: 'welt-domains', title: 'Länderdomains', meta: '# Domains · .de .br .tv …', section: F, kind: 'domains',
    text: 'Welches Land steckt hinter .tv, .io oder .ai? Alle Länderdomains der Staaten und Überseegebiete.',
    file: 'welt-laender', layers: ['world', 'gebiete'], noun: 'Domains',
    ask: ['Zu welchem Land gehört die Domain?', 'Welche Domain hat das markierte Gebiet?', 'Welche Domain?'],
    tip: { title: 'Tipp', text: 'Fast immer ist die Domain der zweistellige ISO-Code. Ausnahme: Großbritannien hat .uk statt .gb.' },
  }),

  /* ── Rekorde ── */
  q({
    slug: 'welt-flaeche-gross', title: 'Die 100 größten Länder', meta: 'nach Fläche', section: R, kind: 'rekorde',
    text: 'Von Russland bis zu Platz 100 – die flächenmäßig größten Staaten der Erde.',
    file: 'welt-laender', layers: ['world'], noun: 'Länder', ask: ['Wo liegt das Land?', 'Wie heißt das markierte Land?', 'Welches Land ist auf diesem Platz?'],
    intro: 'Lernmodus – tippe auf ein Land, um seinen Platz und seine Fläche zu sehen.',
  }),
  q({
    slug: 'welt-flaeche-klein', title: 'Die 100 kleinsten Länder', meta: 'nach Fläche', section: R, kind: 'rekorde',
    text: 'Vatikanstadt, Monaco, Nauru … die winzigsten Staaten der Welt – viele davon Inseln.',
    file: 'welt-laender', layers: ['world'], noun: 'Länder', ask: ['Wo liegt das Land?', 'Wie heißt das markierte Land?', 'Welches Land ist auf diesem Platz?'],
    tip: { title: 'Tipp', text: 'Die meisten Kleinstaaten sind Inseln in Karibik und Pazifik. Die Kreise zum Antippen helfen – und Reinzoomen.' },
  }),
  q({
    slug: 'welt-einwohner-gross', title: 'Die 100 bevölkerungsreichsten Länder', meta: 'nach Einwohnern', section: R, kind: 'rekorde',
    text: 'Indien, China, USA … die Staaten mit den meisten Menschen.',
    file: 'welt-laender', layers: ['world'], noun: 'Länder', ask: ['Wo liegt das Land?', 'Wie heißt das markierte Land?', 'Welches Land ist auf diesem Platz?'],
  }),
  q({
    slug: 'welt-einwohner-klein', title: 'Die 100 bevölkerungsärmsten Länder', meta: 'nach Einwohnern', section: R, kind: 'rekorde',
    text: 'Vatikanstadt, Tuvalu, Nauru … die Staaten mit den wenigsten Menschen.',
    file: 'welt-laender', layers: ['world'], noun: 'Länder', ask: ['Wo liegt das Land?', 'Wie heißt das markierte Land?', 'Welches Land ist auf diesem Platz?'],
  }),

  /* ── Kontinente & Meere ── */
  q({
    slug: 'welt-kontinente', title: 'Kontinente der Welt', meta: '# Kontinente', section: KM, kind: 'kontinente',
    text: 'Die sieben Kontinente – zum Einstieg.',
    file: 'welt-natur', layers: ['kontinente'], noun: 'Kontinente', ask: ['Wo liegt der Kontinent?', 'Welcher Kontinent ist markiert?', 'Welcher Kontinent?'],
    frame: MIT_ANTARKTIS, context: false, labelSize: 9,
    tip: { title: 'Hinweis', text: 'Die Grenze Europa/Asien verläuft hier entlang von Ural, Uralfluss und Bosporus; Ägypten zählt ganz zu Afrika, Indonesien zu Asien.' },
  }),
  q({
    slug: 'welt-ozeane', title: 'Ozeane der Welt', meta: '# Ozeane & Meere', section: KM, kind: 'meere',
    text: 'Die fünf Ozeane und die großen Meere – vom Mittelmeer bis zum Rossmeer.',
    file: 'welt-natur', layers: ['meere-1'], noun: 'Gewässer', ask: ['Wo liegt das Gewässer?', 'Welches Gewässer ist markiert?', 'Zu welchem Ozean gehört es?'],
    groups: OZEANE, frame: MIT_ANTARKTIS,
  }),
  q({
    slug: 'welt-ozeane-schwer', title: 'Ozeane der Welt (schwer)', meta: '# Meere, Golfe & Straßen', section: KM, kind: 'meere',
    text: 'Alles aus "normal" – plus Nebenmeere, Buchten, Golfe und Meerengen.',
    file: 'welt-natur', layers: ['meere-2'], noun: 'Gewässer', ask: ['Wo liegt das Gewässer?', 'Welches Gewässer ist markiert?', 'Zu welchem Ozean gehört es?'],
    groups: OZEANE, frame: MIT_ANTARKTIS,
  }),
  q({
    slug: 'welt-ozeane-sehr-schwer', title: 'Ozeane der Welt (sehr schwer)', meta: '# Gewässer – alles', section: KM, kind: 'meere',
    text: 'Jeder Sund, jeder Fjord, jede Lagune: alle benannten Meeresgebiete der Erde.',
    file: 'welt-natur', layers: ['meere-3'], noun: 'Gewässer', ask: ['Wo liegt das Gewässer?', 'Welches Gewässer ist markiert?', 'Zu welchem Ozean gehört es?'],
    groups: OZEANE, frame: MIT_ANTARKTIS,
    tip: { title: 'Viel Glück', text: 'Mehr als 280 Gewässer – viele davon winzig. Reinzoomen ist hier Pflicht.' },
  }),

  /* ── Gebirge & Wüsten ── */
  q({
    slug: 'welt-gebirge', title: 'Gebirge der Welt', meta: '# Gebirge & Gipfel', section: GW, kind: 'berge',
    text: 'Die großen Gebirge und die berühmtesten Gipfel – Seven Summits inklusive.',
    file: 'welt-natur', layers: ['gebirge'], noun: 'Gebirge & Gipfel', ask: ['Wo liegt es?', 'Was ist markiert?', 'Wie hoch ist der Gipfel?'],
    frame: MIT_ANTARKTIS,
    tip: { title: 'Tipp', text: 'Dreiecke sind einzelne Gipfel, braune Flächen ganze Gebirge.' },
  }),
  q({
    slug: 'welt-gebirge-schwer', title: 'Gebirge der Welt (schwer)', meta: '# Gebirge & Gipfel', section: GW, kind: 'berge',
    text: 'Alles aus "normal" – plus fast alle benannten Gebirge, alle 14 Achttausender und viele weitere Gipfel.',
    file: 'welt-natur', layers: ['gebirge'], noun: 'Gebirge & Gipfel', ask: ['Wo liegt es?', 'Was ist markiert?', 'Wie hoch ist der Gipfel?'],
    frame: MIT_ANTARKTIS,
  }),
  q({
    slug: 'welt-gebirge-sehr-schwer', title: 'Gebirge der Welt (sehr schwer)', meta: '# Gebirge & Gipfel', section: GW, kind: 'berge',
    text: 'Jedes Gebirge und jeder Gipfel, den es im Atlas gibt – über 800 Einträge.',
    file: 'welt-natur', layers: ['gebirge'], noun: 'Gebirge & Gipfel', ask: ['Wo liegt es?', 'Was ist markiert?', 'Wie hoch ist der Gipfel?'],
    frame: MIT_ANTARKTIS,
    tip: { title: 'Viel Glück', text: 'Im Himalaya liegen Dutzende Gipfel auf engstem Raum. Reinzoomen ist Pflicht.' },
  }),
  q({
    slug: 'welt-wuesten', title: 'Wüsten der Welt', meta: '# Wüsten', section: GW, kind: 'wuesten',
    text: 'Sahara, Gobi, Atacama – und die Ergs und Hammadas dazwischen.',
    file: 'welt-natur', layers: ['wuesten'], noun: 'Wüsten', ask: ['Wo liegt die Wüste?', 'Welche Wüste ist markiert?'],
  }),

  /* ── Flüsse & Seen ── */
  q({
    slug: 'welt-fluesse', title: 'Flüsse der Welt', meta: '# Flüsse', section: FS, kind: 'fluesse',
    text: 'Nil, Amazonas, Jangtsekiang, Donau … die großen Ströme der Erde.',
    file: 'welt-natur', layers: ['fluesse'], noun: 'Flüsse', ask: ['Wo fließt der Fluss?', 'Welcher Fluss ist markiert?', 'Durch welches Land fließt er?'],
    frame: [[-180, -56], [180, 78]],
  }),
  q({
    slug: 'welt-fluesse-schwer', title: 'Flüsse der Welt (schwer)', meta: '# Flüsse', section: FS, kind: 'fluesse',
    text: 'Alles aus "normal" – plus über tausend weitere Flüsse. Richtig gottlos.',
    file: 'welt-natur', layers: ['fluesse-alle'], noun: 'Flüsse', ask: ['Wo fließt der Fluss?', 'Welcher Fluss ist markiert?', 'Durch welches Land fließt er?'],
    frame: [[-180, -56], [180, 78]],
    tip: { title: 'Viel Glück', text: 'Kleine Flüsse sind kurze Linien – reinzoomen und auf die Linie tippen.' },
  }),
  q({
    slug: 'welt-seen', title: 'Seen der Welt', meta: '# Seen', section: FS, kind: 'seen',
    text: 'Die größten und bekanntesten Seen – vom Baikalsee bis zum Bodensee.',
    file: 'welt-natur', layers: ['seen'], noun: 'Seen', ask: ['Wo liegt der See?', 'Welcher See ist markiert?', 'In welchem Land liegt er?'],
  }),
  q({
    slug: 'welt-seen-schwer', title: 'Seen der Welt (schwer)', meta: '# Seen & Stauseen', section: FS, kind: 'seen',
    text: 'Alle benannten Seen und Stauseen im Atlas.',
    file: 'welt-natur', layers: ['seen'], noun: 'Seen', ask: ['Wo liegt der See?', 'Welcher See ist markiert?', 'In welchem Land liegt er?'],
  }),

  /* ── Städte & Flughäfen ── */
  q({
    slug: 'welt-millionenstaedte', title: 'Millionenstädte der Welt', meta: '# Städte über 1 Mio.', section: SF, kind: 'staedte',
    text: 'Alle Städte mit mehr als einer Million Einwohnern im Stadtgebiet.',
    file: 'welt-orte', layers: ['world'], noun: 'Städte', ask: ['Wo liegt die Stadt?', 'Welche Stadt ist markiert?', 'In welchem Land liegt sie?'],
    tip: { title: 'Hinweis', text: 'Gezählt werden die Einwohner im Stadtgebiet (nicht im Ballungsraum) – Quelle: GeoNames bzw. aktuelle Volkszählungen.' },
  }),
  q({
    slug: 'welt-flughaefen', title: 'Flughäfen der Welt', meta: 'Die # größten', section: SF, kind: 'flughaefen',
    text: 'Die 50 Flughäfen mit den meisten Passagieren (2024) – mit IATA-Code.',
    file: 'welt-orte', layers: ['world'], noun: 'Flughäfen', ask: ['Wo liegt der Flughafen?', 'Welcher Flughafen ist markiert?', 'Welcher IATA-Code?'],
  }),
  q({
    slug: 'welt-flughaefen-schwer', title: 'Flughäfen der Welt (schwer)', meta: '# Flughäfen · nur IATA-Code', section: SF, kind: 'flughaefen',
    text: 'Alle großen Flughäfen der Erde – gefragt wird nur der dreistellige Code. FRA, LHR, … und 1.100 weitere.',
    file: 'welt-orte', layers: ['world'], noun: 'Flughäfen', ask: ['Wo liegt dieser Flughafen?', 'Welcher Code gehört zum markierten Flughafen?', 'Welche Stadt?'],
    tip: { title: 'Viel Glück', text: 'Manche Codes sind logisch (MUC, BER), andere historisch: ORD (Orchard Field), LAX, YYZ …' },
  }),

  /* ── Überseegebiete ── */
  q({
    slug: 'welt-ueberseegebiete', title: 'Überseegebiete & abhängige Gebiete', meta: '# Gebiete', section: UG, kind: 'gebiete',
    text: 'Grönland, Kokosinseln, Réunion, Bermuda … alle Gebiete, die zu einem anderen Staat gehören.',
    file: 'welt-gebiete', layers: ['gebiete'], noun: 'Gebiete', ask: ['Wo liegt das Gebiet?', 'Welches Gebiet ist markiert?', 'Zu welchem Staat gehört es?'],
    tip: { title: 'Tipp', text: 'Die meisten Gebiete sind winzige Inseln – tippe auf die Kreise und zoome hinein.' },
  }),
  q({
    slug: 'welt-flaggen-gebiete', title: 'Flaggen der Überseegebiete', meta: '# Flaggen', section: UG, kind: 'flaggen',
    text: 'Grönland, Färöer, Bermuda, Hongkong … Gebiete mit eigener Flagge.',
    file: 'welt-gebiete', layers: ['gebiete'], noun: 'Flaggen',
    ask: ['Zu welchem Gebiet gehört die Flagge?', 'Welche Flagge hat das markierte Gebiet?', 'Flagge erkennen'],
    tip: { title: 'Tipp', text: 'Viele britische Gebiete haben den Union Jack oben links – das Wappen rechts verrät, welches Gebiet es ist.' },
  }),
]