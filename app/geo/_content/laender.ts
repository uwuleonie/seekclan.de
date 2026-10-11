// Länder-Quizzes: Regionen, Städte, Gebirge und Flüsse einzelner Länder (Europa).
// Die Einträge liegen in public/geo/items/laender.json (erzeugt von scripts/geo/build-laender.mjs).

import { LAENDER_COUNTS } from '../_data/laender'
import type { GroupDef, Kind, LonLat, QuizDef } from '../_lib/types'
import { C, CYCLE } from './palette'

type Opts = Partial<QuizDef> & {
  slug: string; title: string; meta: string; text: string; country?: string; kind: Kind; layers: string[]
  noun: string; ask: [string, string, string?]; groups: Record<string, GroupDef>
}

function l(o: Opts): QuizDef {
  const { noun, ask, ...rest } = o
  const count = LAENDER_COUNTS[o.slug] ?? 0
  return {
    bereich: 'europa',
    items: [],
    itemsFile: 'laender',
    count,
    itemsNoun: noun,
    askClick: ask[0],
    askName: ask[1],
    askText: ask[2],
    labelSize: 8,
    ...rest,
    meta: o.meta.replace('#', count.toLocaleString('de-DE')),
  }
}

const g = (name: string, color: string): GroupDef => ({ name, color })
const ALLE = (name: string) => ({ alle: g(name, C.ochre) })
/** Städte nach Einwohnern */
const POP = { mio: g('über 1 Million', C.rose), gross: g('250.000 bis 1 Million', C.ochre), mittel: g('100.000 bis 250.000', C.blue), klein: g('unter 100.000', C.green) }
const STADT_ASK: [string, string] = ['Wo liegt die Stadt?', 'Welche Stadt ist markiert?']
const DE_FRAME: [LonLat, LonLat] = [[5.6, 47.2], [15.3, 55.1]]

const BY_BEZIRKE = ['oberbayern', 'niederbayern', 'oberpfalz', 'oberfranken', 'mittelfranken', 'unterfranken', 'schwaben']
const BY_NAMEN: Record<string, string> = { oberbayern: 'Oberbayern', niederbayern: 'Niederbayern', oberpfalz: 'Oberpfalz', oberfranken: 'Oberfranken', mittelfranken: 'Mittelfranken', unterfranken: 'Unterfranken', schwaben: 'Schwaben' }
const FR_NAMEN: Record<string, string> = {
  'auvergne-rhone-alpes': 'Auvergne-Rhône-Alpes', 'bourgogne-franche-comte': 'Bourgogne-Franche-Comté', bretagne: 'Bretagne', 'centre-val-de-loire': 'Centre-Val de Loire', corse: 'Korsika',
  'grand-est': 'Grand Est', 'hauts-de-france': 'Hauts-de-France', 'ile-de-france': 'Île-de-France', normandie: 'Normandie', 'nouvelle-aquitaine': 'Nouvelle-Aquitaine', occitanie: 'Okzitanien',
  'pays-de-la-loire': 'Pays de la Loire', 'provence-alpes-cote-d-azur': "Provence-Alpes-Côte d'Azur",
}
const ES_REG: Record<string, string> = {
  andalucia: 'Andalusien', aragon: 'Aragonien', asturias: 'Asturien', 'islas-baleares': 'Balearen', 'canary-is': 'Kanarische Inseln', cantabria: 'Kantabrien',
  'castilla-y-leon': 'Kastilien und León', 'castilla-la-mancha': 'Kastilien-La Mancha', cataluna: 'Katalonien', extremadura: 'Extremadura', galicia: 'Galicien',
  'la-rioja': 'La Rioja', madrid: 'Madrid', murcia: 'Murcia', 'foral-de-navarra': 'Navarra', 'pais-vasco': 'Baskenland', valenciana: 'Valencia',
}
const groupsOf = (names: Record<string, string>) => Object.fromEntries(Object.entries(names).map(([k, n], i) => [k, g(n, CYCLE[i % CYCLE.length])]))

export const LAENDER_QUIZZES: QuizDef[] = [
  /* ── Europa ── */
  l({
    slug: 'europa-flaggen', title: 'Flaggen Europas', meta: '# Flaggen', kind: 'flaggen', section: 'Länder',
    text: 'Flaggen erkennen, eintippen oder die richtige Flagge anklicken – alle Staaten Europas.',
    layers: ['world'], groups: ALLE('Europa'), frame: [[-25, 34], [45, 71.5]],
    noun: 'Flaggen', ask: ['Wo weht diese Flagge?', 'Welche Flagge gehört zum markierten Land?', 'Welches Land hat diese Flagge?'],
    tip: { title: 'Tipp', text: 'Viele Flaggen im Norden haben ein Kreuz (Skandinavisches Kreuz), im Osten dominieren Weiß-Blau-Rot.' },
  }),
  l({
    slug: 'europa-fluesse', title: 'Flüsse Europas', meta: '# Flüsse', kind: 'fluesse', section: 'Natur',
    text: 'Wolga, Donau, Rhein & Co. – die wichtigsten Flüsse Europas auf der Karte finden.',
    layers: ['fluesse-alle'], groups: ALLE('Europa'), frame: [[-11, 35], [60, 70]],
    noun: 'Flüsse', ask: ['Wo fließt der Fluss?', 'Welcher Fluss ist markiert?', 'Durch welches Land fließt er?'],
    tip: { title: 'Wusstest du?', text: 'Die Wolga ist mit rund 3.500 km der längste Fluss Europas – die Donau fließt durch zehn Länder.' },
  }),

  /* ── Deutschland ── */
  l({
    slug: 'de-grossstaedte', title: 'Großstädte Deutschlands', meta: '# Großstädte · ab 100.000', country: 'DEU', kind: 'staedte',
    text: 'Alle Großstädte mit mehr als 100.000 Einwohnern – von Berlin bis Kaiserslautern.',
    layers: [], groups: POP, frame: DE_FRAME, noun: 'Großstädte', ask: [...STADT_ASK, 'In welchem Bundesland?'],
    tip: { title: 'Wusstest du?', text: 'Allein in Nordrhein-Westfalen liegen fast 30 der rund 80 Großstädte.' },
  }),
  l({
    slug: 'de-gebirge', title: 'Gebirge Deutschlands', meta: '# Gebirge · mit Relief', country: 'DEU', kind: 'berge',
    text: 'Mit Relief-Karte: Harz, Schwarzwald, Erzgebirge & Co. – jedes Gebirge mit seinem höchsten Gipfel.',
    layers: [], groups: { alpen: g('Alpen', C.slate), sued: g('Süden', C.terra), mitte: g('Mitte', C.green), west: g('Westen', C.blue), ost: g('Osten', C.plum) },
    frame: DE_FRAME, noun: 'Gebirge', ask: ['Wo liegt das Gebirge?', 'Welches Gebirge ist markiert?', 'Höchster Gipfel?'],
    intro: 'Lernmodus – das Dreieck markiert jeweils den höchsten Gipfel des Gebirges.',
  }),
  l({
    slug: 'by-regionen', title: 'Bayern – Regierungsbezirke', meta: '# Bezirke', country: 'DEU', kind: 'regionen',
    text: 'Oberbayern, Franken, Schwaben & Co. – die sieben Regierungsbezirke Bayerns.',
    layers: ['by-bezirke'], groups: ALLE('Bayern'), noun: 'Bezirke', ask: ['Wo liegt der Bezirk?', 'Welcher Bezirk ist markiert?', 'Bezirkshauptstadt?'], labelSize: 10,
  }),
  l({
    slug: 'by-landkreise', title: 'Bayern – Landkreise & Städte', meta: '# Kreise · mit Kennzeichen', country: 'DEU', kind: 'kennzeichen',
    text: 'Alle 71 Landkreise und 25 kreisfreien Städte Bayerns – mit Kfz-Kennzeichen.',
    layers: ['by-kreise'], groups: Object.fromEntries(BY_BEZIRKE.map((b, i) => [b, g(BY_NAMEN[b], CYCLE[i])])),
    noun: 'Kreise', ask: ['Wo liegt der Kreis?', 'Welcher Kreis ist markiert?', 'Kfz-Kennzeichen?'], labelSize: 6,
    tip: { title: 'Tipp', text: 'Kreisfreie Städte liegen oft mitten im gleichnamigen Landkreis – z.B. Stadt und Landkreis Passau.' },
  }),

  /* ── Frankreich ── */
  l({
    slug: 'fr-regionen', title: 'Frankreich – Regionen', meta: '# Regionen', country: 'FRA', kind: 'regionen',
    text: 'Die 13 Regionen des französischen Festlands und Korsika – seit der Reform von 2016.',
    layers: ['fr-regionen'], groups: ALLE('Frankreich'), noun: 'Regionen', ask: ['Wo liegt die Region?', 'Welche Region ist markiert?', 'Hauptstadt?'],
    tip: { title: 'Gut zu wissen', text: 'Dazu kommen fünf Überseeregionen: Guadeloupe, Martinique, Französisch-Guayana, Réunion und Mayotte.' },
  }),
  l({
    slug: 'fr-departements', title: 'Frankreich – Départements', meta: '# Départements · mit Nummern', country: 'FRA', kind: 'regionen',
    text: 'Alle 96 Départements des Festlands und Korsikas – mit ihren Nummern (die stehen auch auf Kennzeichen und in Postleitzahlen).',
    layers: ['fr-departements'], groups: groupsOf(FR_NAMEN), noun: 'Départements', ask: ['Wo liegt das Département?', 'Welches Département ist markiert?', 'Welche Nummer?'], labelSize: 6,
    tip: { title: 'Tipp', text: 'Die Nummern sind fast alphabetisch: 01 Ain, 02 Aisne … 75 Paris. Korsika hat 2A und 2B.' },
  }),

  /* ── Vereinigtes Königreich & Irland ── */
  l({
    slug: 'uk-laender', title: 'Vereinigtes Königreich – Landesteile', meta: '# Landesteile', country: 'GBR', kind: 'regionen',
    text: 'England, Schottland, Wales und Nordirland.',
    layers: ['uk-laender'], groups: ALLE('Vereinigtes Königreich'), noun: 'Landesteile', ask: ['Wo liegt der Landesteil?', 'Welcher Landesteil ist markiert?', 'Hauptstadt?'], labelSize: 11,
  }),
  l({
    slug: 'uk-regionen', title: 'Vereinigtes Königreich – Regionen', meta: '# Regionen', country: 'GBR', kind: 'regionen',
    text: 'Die neun Regionen Englands plus Schottland, Wales und Nordirland.',
    layers: ['uk-regionen'], groups: { england: g('England', C.rose), land: g('Schottland, Wales, Nordirland', C.blue) },
    noun: 'Regionen', ask: ['Wo liegt die Region?', 'Welche Region ist markiert?'],
    tip: { title: 'Gut zu wissen', text: 'Die Grafschaften (Counties) sind sehr kleinteilig und kommen später als eigenes Quiz.' },
  }),
  l({
    slug: 'uk-grossstaedte', title: 'Vereinigtes Königreich – Großstädte', meta: '# Städte · ab 100.000', country: 'GBR', kind: 'staedte',
    text: 'Von London bis Aberdeen: alle Städte mit mehr als 100.000 Einwohnern.',
    layers: [], groups: POP, noun: 'Städte', ask: STADT_ASK,
    tip: { title: 'Gut zu wissen', text: 'Londoner Stadtteile wie Croydon oder Islington zählen hier nicht als eigene Städte.' },
  }),
  l({
    slug: 'ie-staedte', title: 'Irland – Städte', meta: '# Städte · ab 10.000', country: 'IRL', kind: 'staedte',
    text: 'Dublin, Cork, Galway und alle Städte Irlands ab 10.000 Einwohnern.',
    layers: [], groups: POP, noun: 'Städte', ask: STADT_ASK,
  }),

  /* ── Benelux ── */
  l({
    slug: 'nl-provinzen', title: 'Niederlande – Provinzen', meta: '# Provinzen', country: 'NLD', kind: 'regionen',
    text: 'Die zwölf Provinzen der Niederlande – mit ihren Hauptstädten.',
    layers: ['nl-provinzen'], groups: ALLE('Niederlande'), noun: 'Provinzen', ask: ['Wo liegt die Provinz?', 'Welche Provinz ist markiert?', 'Hauptstadt?'], labelSize: 10,
    tip: { title: 'Wusstest du?', text: '„Holland“ sind eigentlich nur die beiden Provinzen Nord- und Südholland.' },
  }),
  l({
    slug: 'nl-staedte', title: 'Niederlande – Städte', meta: '# Städte · ab 50.000', country: 'NLD', kind: 'staedte',
    text: 'Amsterdam, Rotterdam, Den Haag und alle Städte ab 50.000 Einwohnern.',
    layers: [], groups: POP, noun: 'Städte', ask: STADT_ASK,
  }),
  l({
    slug: 'benelux-staedte', title: 'Benelux – Städte', meta: '# Städte', country: 'BEL', kind: 'staedte',
    text: 'Belgien, Niederlande, Luxemburg: die großen Städte der drei Länder – und in welchem Land sie liegen.',
    layers: [], groups: { BE: g('Belgien', C.ochre), NL: g('Niederlande', C.terra), LU: g('Luxemburg', C.blue) },
    noun: 'Städte', ask: [...STADT_ASK, 'In welchem Land?'],
  }),

  /* ── Norden ── */
  l({
    slug: 'no-fylker', title: 'Norwegen – Fylker', meta: '# Fylker · Stand 2024', country: 'NOR', kind: 'regionen',
    text: 'Die 15 Provinzen (Fylker) Norwegens – seit der Reform von 2024.',
    layers: ['no-fylker'], groups: ALLE('Norwegen'), frame: [[4, 57.8], [31.5, 71.3]], noun: 'Fylker', ask: ['Wo liegt das Fylke?', 'Welches Fylke ist markiert?', 'Verwaltungssitz?'],
    tip: { title: 'Gut zu wissen', text: '2020 wurden viele Fylker zusammengelegt, 2024 wurden Viken, Vestfold og Telemark und Troms og Finnmark wieder geteilt.' },
  }),
  l({
    slug: 'no-staedte', title: 'Norwegen – Städte', meta: '# Städte · ab 15.000', country: 'NOR', kind: 'staedte',
    text: 'Oslo, Bergen, Trondheim, Tromsø – die Städte Norwegens.', layers: [], groups: POP, noun: 'Städte', ask: STADT_ASK,
  }),
  l({
    slug: 'baltikum-staedte', title: 'Baltikum – Städte', meta: '# Städte · ab 30.000', country: 'LVA', kind: 'staedte',
    text: 'Die größten Städte Estlands, Lettlands und Litauens – und in welchem Land sie liegen.',
    layers: [], groups: { EE: g('Estland', C.blue), LV: g('Lettland', C.wine), LT: g('Litauen', C.olive) },
    noun: 'Städte', ask: [...STADT_ASK, 'In welchem Land?'],
    tip: { title: 'Tipp', text: 'Viele Städte hatten früher deutsche Namen: Tartu = Dorpat, Klaipėda = Memel, Jelgava = Mitau. Die werden beim Eintippen auch akzeptiert.' },
  }),
  l({ slug: 'ee-staedte', title: 'Estland – Städte', meta: '# Städte', country: 'EST', kind: 'staedte', text: 'Tallinn, Tartu, Narva, Pärnu – alle Städte Estlands ab 9.000 Einwohnern.', layers: [], groups: POP, noun: 'Städte', ask: STADT_ASK }),
  l({ slug: 'lv-staedte', title: 'Lettland – Städte', meta: '# Städte', country: 'LVA', kind: 'staedte', text: 'Riga, Daugavpils, Liepāja – alle Städte Lettlands ab 9.000 Einwohnern.', layers: [], groups: POP, noun: 'Städte', ask: STADT_ASK }),
  l({ slug: 'lt-staedte', title: 'Litauen – Städte', meta: '# Städte', country: 'LTU', kind: 'staedte', text: 'Vilnius, Kaunas, Klaipėda – alle Städte Litauens ab 14.000 Einwohnern.', layers: [], groups: POP, noun: 'Städte', ask: STADT_ASK }),

  /* ── Süden ── */
  l({
    slug: 'it-regionen', title: 'Italien – Regionen', meta: '# Regionen', country: 'ITA', kind: 'regionen',
    text: 'Die 20 Regionen Italiens – fünf davon mit Sonderstatus.',
    layers: ['it-regionen'], groups: { normal: g('Region', C.green), auto: g('Region mit Sonderstatus', C.terra) },
    noun: 'Regionen', ask: ['Wo liegt die Region?', 'Welche Region ist markiert?', 'Hauptstadt?'],
  }),
  l({
    slug: 'it-staedte', title: 'Italien – Städte', meta: '# Städte · ab 100.000', country: 'ITA', kind: 'staedte',
    text: 'Rom, Mailand, Neapel und alle Städte Italiens ab 100.000 Einwohnern.', layers: [], groups: POP, noun: 'Städte', ask: STADT_ASK,
  }),
  l({
    slug: 'es-regionen', title: 'Spanien – Autonome Gemeinschaften', meta: '# Regionen', country: 'ESP', kind: 'regionen',
    text: '17 Autonome Gemeinschaften und die zwei autonomen Städte Ceuta und Melilla.',
    layers: ['es-regionen'], groups: { gemeinschaft: g('Autonome Gemeinschaft', C.ochre), stadt: g('Autonome Stadt', C.rose) },
    noun: 'Regionen', ask: ['Wo liegt die Region?', 'Welche Region ist markiert?', 'Hauptstadt?'],
  }),
  l({
    slug: 'es-provinzhauptstaedte', title: 'Spanien – Provinzhauptstädte', meta: '# Provinzen', country: 'ESP', kind: 'hauptstaedte',
    text: 'Zu jeder der 50 Provinzhauptstädte die richtige Provinz finden.',
    layers: ['es-provinzen'], groups: groupsOf(ES_REG), noun: 'Provinzhauptstädte', ask: ['In welcher Provinz liegt die Stadt?', 'Welche Hauptstadt hat die markierte Provinz?', 'Hauptstadt der Provinz?'], labelSize: 6,
  }),
  l({
    slug: 'es-staedte', title: 'Spanien – Städte', meta: '# Städte · ab 100.000', country: 'ESP', kind: 'staedte',
    text: 'Madrid, Barcelona, Valencia und alle Städte Spaniens ab 100.000 Einwohnern.', layers: [], groups: POP, noun: 'Städte', ask: STADT_ASK,
  }),
]