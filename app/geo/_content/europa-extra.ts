// Zusätzliche Europa-Quizzes (Phase 3): Flaggen der Regionen, ähnliche Flaggen, EU/Euro/Schengen/NATO,
// Kfz-Länderkennzeichen, Amtssprachen, Inseln, Gebirge, Seen, Meere, Millionenstädte, Vorwahlen, Domains.
// Die Einträge liegen in public/geo/items/europa-extra.json (erzeugt von scripts/geo/build-europa-extra.mjs).
// Alle Quizzes mit Europa-Ausschnitt bekommen automatisch die feinen Grenzen (siehe scene.ts, world-eu).

import { EUROPA_EXTRA_COUNTS } from '../_data/europa-extra'
import type { Bereich, GroupDef, Kind, LonLat, ProjectionKind, QuizDef } from '../_lib/types'
import { C } from './palette'

const g = (name: string, color: string): GroupDef => ({ name, color })
const ALLE = (name: string, color: string = C.ochre) => ({ alle: g(name, color) })
const EUROPA: [LonLat, LonLat] = [[-25, 34], [45, 71.5]]
const WELT: [LonLat, LonLat] = [[-180, -58], [180, 84]]

type Opts = Partial<QuizDef> & {
  slug: string; title: string; meta: string; text: string; kind: Kind; noun: string
  ask: [string, string, string?]; groups: Record<string, GroupDef>; layers: string[]
  bereich?: Bereich; projection?: ProjectionKind
}

function q(o: Opts): QuizDef {
  const { noun, ask, ...rest } = o
  const count = EUROPA_EXTRA_COUNTS[o.slug] ?? 0
  return {
    bereich: 'europa',
    items: [],
    itemsFile: 'europa-extra',
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

/* ───────────── Flaggen der Regionen ───────────── */

// [slug, Titel, Land, Ebene, Mehrzahl, Text]
type RegionFlagRow = [string, string, string, string, string, string, { tip?: QuizDef['tip'] }?]
const REGION_FLAGS: RegionFlagRow[] = [
  ['de-bundeslaender-flaggen', 'Deutschland – Flaggen der Bundesländer', 'DEU', 'adm1-DEU', 'Landesflaggen', 'Die Flaggen aller 16 Bundesländer – von Bayerns Rauten bis zum Bremer „Speck“.',
    { tip: { title: 'Gut zu wissen', text: 'Bayern hat zwei offizielle Flaggen: weiß-blau gestreift und die Rautenflagge. Hier wird die gestreifte gezeigt.' } }],
  ['at-bundeslaender-flaggen', 'Österreich – Flaggen der Bundesländer', 'AUT', 'adm1-AUT', 'Landesflaggen', 'Die neun Landesflaggen Österreichs.',
    { tip: { title: 'Achtung, Falle', text: 'Wien, Salzburg und Vorarlberg haben dieselben Landesfarben Rot-Weiß – erkennbar sind sie nur an der Lage.' } }],
  ['ch-kantone-flaggen', 'Schweiz – Flaggen der Kantone', 'CHE', 'eu-ch-kantone', 'Kantonsflaggen', 'Alle 26 Kantonsflaggen – quadratisch wie die Schweizer Flagge.'],
  ['pl-woiwodschaften-flaggen', 'Polen – Flaggen der Woiwodschaften', 'POL', 'eu-pl-woiwodschaften', 'Flaggen', 'Die Flaggen der 16 Woiwodschaften Polens.'],
  ['cz-regionen-flaggen', 'Tschechien – Flaggen der Regionen', 'CZE', 'eu-cz-regionen', 'Flaggen', 'Die Flaggen der 14 Regionen (Kraje) Tschechiens.'],
  ['sk-regionen-flaggen', 'Slowakei – Flaggen der Regionen', 'SVK', 'eu-sk-regionen', 'Flaggen', 'Die Flaggen der acht slowakischen Regionen.'],
  ['hu-komitate-flaggen', 'Ungarn – Flaggen der Komitate', 'HUN', 'eu-hu-komitate', 'Flaggen', 'Die Flaggen der 19 Komitate und von Budapest.'],
  ['nl-provinzen-flaggen', 'Niederlande – Provinzflaggen', 'NLD', 'nl-provinzen', 'Provinzflaggen', 'Die Flaggen der zwölf niederländischen Provinzen – Friesland mit den Seerosenblättern.'],
  ['be-provinzen-flaggen', 'Belgien – Provinzflaggen', 'BEL', 'eu-be-provinzen', 'Provinzflaggen', 'Die Flaggen der zehn Provinzen und der Region Brüssel.'],
  ['it-regionen-flaggen', 'Italien – Flaggen der Regionen', 'ITA', 'it-regionen', 'Regionsflaggen', 'Die Flaggen der 20 Regionen Italiens – Sizilien mit der Triskele, Sardinien mit den vier Mohren.'],
  ['es-regionen-flaggen', 'Spanien – Flaggen der Regionen', 'ESP', 'es-regionen', 'Regionsflaggen', 'Die Flaggen der 17 Autonomen Gemeinschaften und von Ceuta und Melilla.',
    { tip: { title: 'GeoGuessr-Tipp', text: 'Regionsflaggen hängen in Spanien oft an Rathäusern neben der Landesflagge – z.B. die Senyera in Katalonien.' } }],
  ['fr-regionen-flaggen', 'Frankreich – Flaggen der Regionen', 'FRA', 'fr-regionen', 'Regionsflaggen', 'Die Flaggen der französischen Regionen – von der Bretagne (Gwenn ha Du) bis Korsika.',
    { tip: { title: 'Gut zu wissen', text: 'Grand Est hat keine eigene Flagge und fehlt deshalb. Viele Regionsflaggen sind historische Wappenbanner.' } }],
  ['uk-laender-flaggen', 'Vereinigtes Königreich – Flaggen der Landesteile', 'GBR', 'uk-laender', 'Flaggen', 'England, Schottland und Wales – die Kreuze im Union Jack.',
    { tip: { title: 'Gut zu wissen', text: 'Nordirland hat seit 1972 keine offizielle eigene Flagge mehr und fehlt deshalb.' } }],
  ['no-fylker-flaggen', 'Norwegen – Flaggen der Fylker', 'NOR', 'no-fylker', 'Flaggen', 'Die Wappenflaggen der norwegischen Fylker (Stand 2024).'],
  ['se-provinzen-flaggen', 'Schweden – Flaggen der Län', 'SWE', 'eu-se-provinzen', 'Flaggen', 'Die Wappenflaggen der schwedischen Län.'],
  ['fi-landschaften-flaggen', 'Finnland – Flaggen der Landschaften', 'FIN', 'eu-fi-landschaften', 'Flaggen', 'Die Flaggen der finnischen Landschaften (Maakunnat).'],
  ['dk-regionen-flaggen', 'Dänemark – Flaggen der Regionen', 'DNK', 'eu-dk-regionen', 'Flaggen', 'Die Flaggen der fünf dänischen Regionen.'],
  ['hr-gespanschaften-flaggen', 'Kroatien – Flaggen der Gespanschaften', 'HRV', 'eu-hr-gespanschaften', 'Flaggen', 'Die Flaggen der 20 Gespanschaften und von Zagreb.'],
  ['ee-kreise-flaggen', 'Estland – Flaggen der Kreise', 'EST', 'eu-ee-kreise', 'Flaggen', 'Die Flaggen der 15 estnischen Kreise.'],
  ['lt-bezirke-flaggen', 'Litauen – Flaggen der Bezirke', 'LTU', 'eu-lt-bezirke', 'Flaggen', 'Die Flaggen der zehn litauischen Bezirke.'],
  ['ua-oblaste-flaggen', 'Ukraine – Flaggen der Oblaste', 'UKR', 'eu-ua-oblaste', 'Flaggen', 'Die Flaggen der 24 Oblaste, von Kyjiw, der Krim und Sewastopol.'],
  ['by-woblasze-flaggen', 'Belarus – Flaggen der Woblasze', 'BLR', 'eu-by-woblasze', 'Flaggen', 'Die Flaggen der sechs Woblasze und der Hauptstadt Minsk.'],
  ['al-qarqe-flaggen', 'Albanien – Flaggen der Qarqe', 'ALB', 'eu-al-qarqe', 'Flaggen', 'Die Flaggen der albanischen Qarqe.'],
]

const regionFlagQuizzes: QuizDef[] = REGION_FLAGS.map(([slug, title, country, lay, noun, text, extra]) => q({
  slug, title, meta: '# Flaggen', text, country, kind: 'flaggen', section: 'Flaggen',
  layers: [lay], contextLayer: 'world-eu', groups: ALLE(title.split(' – ')[0], C.ochre), noun,
  ask: ['Wo weht diese Flagge?', 'Welche Flagge gehört zur markierten Region?', 'Flagge erkennen'],
  intro: 'Lernmodus – tippe auf eine Region, um ihre Flagge zu sehen.',
  ...extra,
}))

/* ───────────── Quizzes für ganz Europa ───────────── */

const BUND_GROUPS = { alt: g('vor 1990', C.blue), mitte: g('1990 bis 2003', C.teal), ost: g('2004 bis 2009', C.ochre), neu: g('ab 2010', C.rose) }

const europaQuizzes: QuizDef[] = [
  /* ── Flaggen ── */
  q({
    slug: 'europa-flaggen-schwer', title: 'Flaggen Europas (schwer)', meta: '# Flaggen · mit Gebieten', kind: 'flaggen', section: 'Flaggen',
    text: 'Alle Staaten Europas plus Färöer, Gibraltar, Åland, Jersey, Guernsey und die Isle of Man.',
    layers: ['world', 'gebiete'], frame: EUROPA, groups: { staat: g('Staat', C.ochre), gebiet: g('Gebiet', C.teal) },
    noun: 'Flaggen', ask: ['Wo weht diese Flagge?', 'Welche Flagge gehört zum markierten Land?', 'Welches Land hat diese Flagge?'],
  }),
  q({
    slug: 'flaggen-aehnlich', title: 'Verwechslungsgefahr: ähnliche Flaggen', meta: '# Flaggen · 13 Gruppen', kind: 'flaggen', section: 'Flaggen & Codes', bereich: 'welt',
    text: 'Rumänien oder Tschad? Monaco oder Indonesien? Flaggen, die sich zum Verwechseln ähnlich sehen – nach Gruppen sortiert.',
    layers: ['world'], frame: WELT, projection: 'naturalEarth', labelSize: 6,
    groups: {
      rotweiss: g('Rot-Weiß', C.rose), blaugelbrot: g('Blau-Gelb-Rot', C.ochre), gruenweissorange: g('Grün-Weiß-Orange', C.green), slawisch: g('Weiß-Blau-Rot', C.blue),
      kreuz: g('Skandinavisches Kreuz', C.sky), schwarzrotgold: g('Schwarz-Gelb-Rot', C.brown), rwr: g('Rot-Weiß-Rot', C.wine), weissgruenrot: g('Rot-Weiß-Grün', C.moss),
      halbmond: g('Halbmond & Stern', C.coral), panafrika: g('Grün-Gelb-Rot', C.olive), suedkreuz: g('Kreuz des Südens', C.indigo), andin: g('Gelb-Blau-Rot', C.sand), zentralamerika: g('Blau-Weiß-Blau', C.teal),
    },
    noun: 'Flaggen', ask: ['Wo weht diese Flagge?', 'Welche Flagge gehört zum markierten Land?', 'Welches Land hat diese Flagge?'],
    tip: { title: 'Merkhilfen', text: 'Tschad hat ein dunkleres Blau als Rumänien. Monaco ist 4:5, Indonesien 2:3. Die Elfenbeinküste ist Orange-Weiß-Grün – also „umgekehrt Irland“.' },
  }),

  /* ── Politik & Bündnisse ── */
  q({
    slug: 'europa-eu', title: 'EU-Mitgliedstaaten', meta: '# Staaten · mit Beitrittsjahr', kind: 'wissen', section: 'Politik & Bündnisse',
    text: 'Alle 27 Mitglieder der Europäischen Union – und seit wann sie dabei sind.',
    layers: ['world'], frame: EUROPA, groups: BUND_GROUPS, noun: 'Staaten', ask: ['Wo liegt das EU-Land?', 'Welches EU-Land ist markiert?', 'Seit wann in der EU?'],
    tip: { title: 'Gut zu wissen', text: 'Das Vereinigte Königreich war von 1973 bis 2020 Mitglied (Brexit).' },
  }),
  q({
    slug: 'europa-euro', title: 'Euro-Länder', meta: '# Länder · Euroraum & Euro-Nutzer', kind: 'wissen', section: 'Politik & Bündnisse',
    text: 'Die 21 Länder des Euroraums (Bulgarien seit 2026) – und sechs Länder, die den Euro ohne EU-Mitgliedschaft nutzen.',
    layers: ['world'], frame: EUROPA,
    groups: { ...BUND_GROUPS, abkommen: g('Euro per Abkommen', C.plum), einseitig: g('Euro einseitig eingeführt', C.slate) },
    noun: 'Länder', ask: ['Wo liegt das Euro-Land?', 'Welches Euro-Land ist markiert?', 'Seit wann mit Euro?'],
    tip: { title: 'Gut zu wissen', text: 'Dänemark und Schweden sind in der EU, haben aber keinen Euro. Montenegro und Kosovo nutzen ihn ohne Abkommen.' },
  }),
  q({
    slug: 'europa-schengen', title: 'Schengen-Raum', meta: '# Staaten · mit Beitrittsjahr', kind: 'wissen', section: 'Politik & Bündnisse',
    text: 'Alle 29 Staaten im Schengen-Raum – auch Norwegen, Island, die Schweiz und Liechtenstein.',
    layers: ['world'], frame: EUROPA, groups: BUND_GROUPS, noun: 'Staaten', ask: ['Wo liegt das Schengen-Land?', 'Welches Schengen-Land ist markiert?', 'Seit wann im Schengen-Raum?'],
    tip: { title: 'Gut zu wissen', text: 'Irland und Zypern sind EU-Mitglieder, aber (noch) nicht im Schengen-Raum.' },
  }),
  q({
    slug: 'europa-nato', title: 'NATO in Europa', meta: '# Staaten · mit Beitrittsjahr', kind: 'wissen', section: 'Politik & Bündnisse',
    text: 'Die 30 europäischen NATO-Mitglieder – von den Gründern 1949 bis Schweden 2024.',
    layers: ['world'], frame: EUROPA, groups: BUND_GROUPS, noun: 'Staaten', ask: ['Wo liegt das NATO-Land?', 'Welches NATO-Land ist markiert?', 'Seit wann in der NATO?'],
    tip: { title: 'Gut zu wissen', text: 'Dazu kommen die USA und Kanada – zusammen 32 Mitglieder.' },
  }),

  /* ── Sprachen & Codes ── */
  q({
    slug: 'europa-kfz', title: 'Kfz-Länderkennzeichen Europas', meta: '# Kennzeichen · D, F, CH …', kind: 'kennzeichen', section: 'Sprachen & Codes',
    text: 'Das ovale Schild oder der Buchstabe im blauen EU-Streifen: D, A, CH, NL, RSM … – welches Land ist das?',
    layers: ['world'], frame: EUROPA, groups: { eins: g('ein Buchstabe', C.blue), zwei: g('zwei Buchstaben', C.ochre), drei: g('drei Buchstaben', C.rose) },
    noun: 'Kennzeichen', ask: ['Welches Land hat dieses Kennzeichen?', 'Welches Kennzeichen hat das markierte Land?', 'Welches Kfz-Zeichen?'],
    tip: { title: 'GeoGuessr-Tipp', text: 'Im blauen EU-Streifen links auf dem Nummernschild steht das Länderzeichen – das lässt sich oft auch verschwommen noch lesen.' },
  }),
  q({
    slug: 'europa-sprachen', title: 'Amtssprachen Europas', meta: '# Länder · nach Sprachfamilie', kind: 'sprachen', section: 'Sprachen & Codes',
    text: 'Welche Sprache spricht man wo? Alle Länder Europas mit ihren Amtssprachen – gefärbt nach Sprachfamilie.',
    layers: ['world'], frame: EUROPA,
    groups: { germ: g('Germanisch', C.blue), rom: g('Romanisch', C.rose), slaw: g('Slawisch', C.ochre), balt: g('Baltisch', C.teal), ural: g('Finno-ugrisch', C.plum), andere: g('Andere', C.slate) },
    noun: 'Länder', ask: ['Wo liegt das Land?', 'Welches Land ist markiert?', 'Welche Amtssprache?'],
    tip: { title: 'Gut zu wissen', text: 'Ungarisch, Finnisch und Estnisch sind nicht indogermanisch – sie gehören zur uralischen Sprachfamilie.' },
  }),
  q({
    slug: 'europa-vorwahlen', title: 'Telefon-Vorwahlen Europas', meta: '# Vorwahlen', kind: 'vorwahlen', section: 'Sprachen & Codes',
    text: '+49, +43, +41 … die Ländervorwahlen Europas.',
    layers: ['world'], frame: EUROPA, groups: ALLE('Europa'), noun: 'Vorwahlen',
    ask: ['Welches Land hat diese Vorwahl?', 'Welche Vorwahl hat das markierte Land?', 'Welche Vorwahl?'],
    tip: { title: 'Tipp', text: 'Fast ganz Europa beginnt mit 3 oder 4 – nur Russland hat die +7.' },
  }),
  q({
    slug: 'europa-domains', title: 'Länderdomains Europas', meta: '# Domains', kind: 'domains', section: 'Sprachen & Codes',
    text: '.de, .at, .ch, .fo … die Länderdomains der Staaten und Gebiete Europas.',
    layers: ['world', 'gebiete'], frame: EUROPA, groups: ALLE('Europa'), noun: 'Domains',
    ask: ['Zu welchem Land gehört die Domain?', 'Welche Domain hat das markierte Gebiet?', 'Welche Domain?'],
  }),

  /* ── Länder & Städte ── */
  q({
    slug: 'europa-hauptstaedte-schwer', title: 'Hauptstädte Europas (schwer)', meta: '# Hauptstädte · nur Punkte', kind: 'hauptstaedte', section: 'Länder',
    text: 'Ohne Landesgrenzen als Hilfe: den Punkt der Hauptstadt selbst treffen.',
    layers: ['world'], frame: EUROPA, groups: ALLE('Europa'), noun: 'Hauptstädte',
    ask: ['Wo liegt die Hauptstadt?', 'Welche Hauptstadt ist markiert?', 'Welche Hauptstadt?'],
  }),
  q({
    slug: 'europa-millionenstaedte', title: 'Millionenstädte Europas', meta: '# Städte · ab 1 Mio.', kind: 'staedte', section: 'Länder',
    text: 'Alle Städte Europas mit mehr als einer Million Einwohnern – von Istanbul bis Oslo.',
    layers: [], frame: EUROPA, groups: ALLE('Europa', C.rose), noun: 'Städte',
    ask: ['Wo liegt die Stadt?', 'Welche Stadt ist markiert?', 'In welchem Land?'],
  }),
  q({
    slug: 'europa-binnenstaaten', title: 'Binnenstaaten Europas', meta: '# Länder ohne Meer', kind: 'laender', section: 'Länder',
    text: 'Österreich, Schweiz, Ungarn & Co. – alle Länder Europas ohne Zugang zum Meer.',
    layers: ['world'], frame: EUROPA, groups: ALLE('Europa'), noun: 'Binnenstaaten', ask: ['Wo liegt das Land?', 'Wie heißt das markierte Land?'],
    tip: { title: 'Wusstest du?', text: 'Liechtenstein ist ein doppelter Binnenstaat: Auch seine Nachbarn Schweiz und Österreich haben kein Meer.' },
  }),

  /* ── Natur ── */
  q({
    slug: 'europa-inseln', title: 'Inseln Europas', meta: '# Inseln & Inselgruppen', kind: 'gebiete', section: 'Natur',
    text: 'Von Island bis Zypern: die großen Inseln und Inselgruppen Europas.',
    layers: ['eu-inseln'], frame: [[-32, 34], [36, 71.5]],
    groups: { atlantik: g('Atlantik & Nordsee', C.blue), ostsee: g('Ostsee', C.teal), mittelmeer: g('Mittelmeer', C.ochre) },
    noun: 'Inseln', ask: ['Wo liegt die Insel?', 'Welche Insel ist markiert?', 'Zu welchem Land?'],
  }),
  q({
    slug: 'europa-gebirge', title: 'Gebirge Europas', meta: '# Gebirge', kind: 'berge', section: 'Natur',
    text: 'Alpen, Pyrenäen, Karpaten, Ural – die großen Gebirge Europas.',
    layers: ['gebirge'], frame: EUROPA, groups: ALLE('Europa', C.brown), noun: 'Gebirge', ask: ['Wo liegt das Gebirge?', 'Welches Gebirge ist markiert?'],
  }),
  q({
    slug: 'europa-gebirge-schwer', title: 'Gebirge Europas (schwer)', meta: '# Gebirge & Höhenzüge', kind: 'berge', section: 'Natur',
    text: 'Auch die kleinen Gebirge: Harz, Vogesen, Sudeten, Dinariden, Tatra und viele mehr.',
    layers: ['gebirge'], frame: EUROPA, groups: ALLE('Europa', C.brown), noun: 'Gebirge', ask: ['Wo liegt das Gebirge?', 'Welches Gebirge ist markiert?'], labelSize: 6,
  }),
  q({
    slug: 'europa-gipfel', title: 'Höchste Berge Europas', meta: '# Gipfel', kind: 'berge', section: 'Natur',
    text: 'Elbrus, Montblanc, Zugspitze … die bekanntesten Gipfel Europas.',
    layers: ['gebirge'], frame: EUROPA, groups: ALLE('Europa', C.brown), noun: 'Gipfel', ask: ['Wo liegt der Berg?', 'Welcher Berg ist markiert?'],
  }),
  q({
    slug: 'europa-seen', title: 'Seen Europas', meta: '# Seen', kind: 'seen', section: 'Natur',
    text: 'Ladogasee, Bodensee, Plattensee, Genfer See – die Seen Europas.',
    layers: ['seen'], frame: EUROPA, groups: ALLE('Europa', C.sky), noun: 'Seen', ask: ['Wo liegt der See?', 'Welcher See ist markiert?', 'In welchem Land?'], labelSize: 6,
  }),
  q({
    slug: 'europa-meere', title: 'Meere & Meerengen Europas', meta: '# Meere, Buchten, Meerengen', kind: 'meere', section: 'Natur',
    text: 'Nordsee, Ostsee, Adria, Skagerrak, Bosporus … alle Meere, Buchten, Fjorde und Meerengen rund um Europa.',
    layers: ['meere-3'], frame: EUROPA,
    groups: { atlantik: g('Atlantik & Nordsee', C.blue), ostsee: g('Ostsee', C.teal), mittelmeer: g('Mittelmeer', C.ochre), schwarz: g('Schwarzes Meer', C.plum), arktis: g('Nordpolarmeer', C.sky) },
    noun: 'Meere', ask: ['Wo liegt das Meer?', 'Welches Meer ist markiert?', 'Zu welchem Ozean?'], labelSize: 6,
  }),
]

export const EUROPA_EXTRA_QUIZZES: QuizDef[] = [...europaQuizzes, ...regionFlagQuizzes]