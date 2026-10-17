// GeoGuessr Afrika: Lernkarten (Hinweise aus Plonk It), Rate das Land, Regionen je Land, Merkmals-Karten und GG-Editionen.
// Lernkarten:      public/geo/items/gg-af-karten.json   (special: 'schrift', Komponente SchriftQuiz)
// Karten-Quizzes:  public/geo/items/gg-af-orte.json
// Steckbriefe:     public/geo/gg-af/…                   (Seiten /geo/geoguessr-afrika und …/<land>)
// Erzeugt von scripts/geo/build-gg-af.mjs (Daten in scripts/geo/gg-af/).

import { GG_AF_COUNTS, GG_AF_MERKMAL_GROUPS, GG_AF_REGIONEN } from '../_data/gg-af'
import type { GroupDef, Kind, LonLat, QuizDef } from '../_lib/types'
import { AFRIKA_QUIZZES } from './afrika'
import { WELT_QUIZZES } from './welt'
import { ggEdition } from './gg-welt'

type Diff = NonNullable<QuizDef['difficulty']>
const n = (slug: string) => GG_AF_COUNTS[slug] ?? 0
const meta = (m: string, slug: string) => m.replace('#', n(slug).toLocaleString('de-DE'))
const AF_FRAME: [LonLat, LonLat] = [[-26, -36], [60, 38]]

const HIN = 'GeoGuessr: Hinweise'
const REG = 'GeoGuessr: Regionen'
const KAR = 'GeoGuessr: Karten'
const EDI = 'GeoGuessr: GG-Edition Afrika'

function deck(slug: string, title: string, m: string, section: string, text: string, difficulty: Diff, country?: string, kind: Kind = 'wissen'): QuizDef {
  return {
    slug, title, meta: meta(m, slug), bereich: 'afrika', kind, section, text, country, difficulty, gg: 'ja',
    special: 'schrift', items: [], itemsFile: 'gg-af-karten', count: n(slug),
    askClick: 'Welches Land?', askName: 'Welches Land?', itemsNoun: 'Karten',
    groups: {}, layers: [], combinable: false,
  }
}

function merkmalKarte(slug: string, title: string, m: string, text: string, ask: [string, string, string], difficulty: Diff, merkmal: QuizDef['merkmal'], tip?: QuizDef['tip']): QuizDef {
  return {
    slug, title, meta: meta(m, slug), bereich: 'afrika', kind: 'wissen', section: KAR, text, difficulty, gg: 'ja',
    items: [], itemsFile: 'gg-af-orte', count: n(slug),
    askClick: ask[0], askName: ask[1], askText: ask[2], itemsNoun: 'Länder',
    groups: (GG_AF_MERKMAL_GROUPS[slug] ?? {}) as Record<string, GroupDef>, layers: ['world', 'gebiete'], frame: AF_FRAME, labelSize: 8, tip,
    intro: 'Lernmodus – die Farben auf der Karte zeigen das Merkmal. Tippe auf ein Land für Details.',
    merkmal, combinable: false,
  }
}

const quelle = (slug: string) => {
  const d = [...AFRIKA_QUIZZES, ...WELT_QUIZZES].find(q => q.slug === slug)
  if (!d) throw new Error(`GG Afrika: Quelle ${slug} fehlt`)
  return d
}
/** GG-Edition eines Afrika-Quiz: nur Länder mit Street View (Liste aus dem Adminpanel) */
const edition = (src: string, slug: string, title: string, text: string, difficulty: Diff) =>
  ggEdition(quelle(src), { slug, title, meta: 'nur Länder mit Street View', text, section: EDI, difficulty, count: 13 })

export const GG_AF_QUIZZES: QuizDef[] = [
  /* ── Hinweise ── */
  deck('gg-af-hinweise', 'GeoGuessr-Hinweise Afrika', '# Hinweise · welches Land?', HIN,
    'Rund 480 Hinweise aus Plonk It zu allen GeoGuessr-Ländern Afrikas – Linien, Kennzeichen, Google-Auto, Landschaft. Lerne sie Kategorie für Kategorie.', 'schwer'),
  deck('gg-af-rate-das-land', 'Rate das Land: drei Hinweise (Afrika)', '# Runden', HIN,
    'Wie in einer echten Runde: drei Hinweise zusammen – welches Land?', 'mittel'),
  deck('gg-af-google-auto', 'Google-Auto & Kamera in Afrika', '# Hinweise', HIN,
    'Ghana-Tape, Namibias schiefe Antenne, Nigerias Polizei-Begleitung, Kenias Schnorchel: In Afrika verrät oft schon das Auto das Land.', 'mittel'),
  deck('gg-af-strasse', 'An der Straße: Linien, Kennzeichen, Schilder', '# Hinweise', HIN,
    'Gelbe Randlinien, N- und R-Straßen, blaue Kennzeichen im Senegal, Masten wie Vogelreihen – alles, was an der Straße steht.', 'mittel'),
  deck('gg-af-landschaft', 'Landschaft, Pflanzen & Häuser in Afrika', '# Hinweise', HIN,
    'Rote Erde, Tafelberge in Lesotho, Baobabs im Senegal, Zuckerrohr in KwaZulu-Natal: Was verrät die Umgebung?', 'schwer'),
  deck('gg-af-vorwahlen', 'Vorwahlen der GeoGuessr-Länder Afrikas', '# Vorwahlen', HIN,
    '+27, +254, +234, +221 – Telefonnummern auf Plakaten und Lieferwagen verraten das Land.', 'leicht', undefined, 'vorwahlen'),
  deck('gg-af-domains', 'Domains der GeoGuessr-Länder Afrikas', '# Domains', HIN,
    '.co.za, .ke, .ng, .gh – Webadressen auf Werbung und Schildern.', 'leicht', undefined, 'domains'),

  /* ── Regionen je Land ── */
  ...GG_AF_REGIONEN.map(([slug, , name, iso]) => deck(slug, `${name}: Wo im Land bist du?`, '# Hinweise · welche Region?', REG,
    `Hinweise, die in ${name} auf eine Region, Provinz oder Stadt zeigen – damit dein Pin nicht nur im richtigen Land landet.`, 'sehr-schwer', iso)),

  /* ── Karten ── */
  merkmalKarte('gg-af-fahrseite-karte', 'Karte: Fahrseite der GG-Länder', '# Länder · links oder rechts',
    'Links im ganzen Süden sowie in Kenia und Uganda – rechts in Ruanda, Westafrika, Madagaskar, Réunion und Tunesien.', ['Wo liegt das Land?', 'Welches Land ist markiert?', 'Links oder rechts?'], 'leicht',
    { alle: 'Fahrseite: {wert}', janein: '{name}: Fährt man {wert}?' }, { title: 'Merkhilfe', text: 'Ruanda ist die Ausnahme: Es fährt rechts, obwohl alle Nachbarn außer der DR Kongo und Burundi links fahren.' }),
  merkmalKarte('gg-af-randlinie-karte', 'Karte: Farbe der Randlinie', '# Länder · gelb oder weiß',
    'Gelbe Randlinien gibt es in Südafrika, Namibia, Botswana, Lesotho und Eswatini. Ostafrika und der Rest: weiß.', ['Wo liegt das Land?', 'Welches Land ist markiert?', 'Welche Farbe?'], 'leicht',
    { alle: 'Randlinie: {wert}', janein: '{name}: Ist die Randlinie {wert}?' }),
  merkmalKarte('gg-af-mittellinie-karte', 'Karte: Farbe der Mittellinie', '# Länder',
    'Gelbe Mitte in Kenia und Uganda – überall sonst weiß.', ['Wo liegt das Land?', 'Welches Land ist markiert?', 'Welche Farbe?'], 'mittel',
    { alle: 'Mittellinie: {wert}', janein: '{name}: Ist die Mittellinie {wert}?' }),
  merkmalKarte('gg-af-kennzeichen-karte', 'Karte: Kennzeichen', '# Länder · weiß, gelb, blau, schwarz',
    'Blau im Senegal, schwarz in Tunesien, gelb in Namibia, vorne weiß und hinten gelb in Kenia, Uganda, Ruanda und Botswana.', ['Wo liegt das Land?', 'Welches Land ist markiert?', 'Wie sehen die Kennzeichen aus?'], 'mittel',
    { alle: 'Kennzeichen: {wert}', janein: '{name}: Kennzeichen {wert}?' }),
  merkmalKarte('gg-af-sprache-karte', 'Karte: Sprache auf den Schildern', '# Länder',
    'Englisch im Süden, Osten und in Ghana und Nigeria – Französisch im Senegal, auf Madagaskar und Réunion, Arabisch in Tunesien.', ['Wo liegt das Land?', 'Welches Land ist markiert?', 'Welche Sprache?'], 'leicht',
    { alle: 'Sprache: {wert}', janein: '{name}: Schilder auf {wert}?' }),

  /* ── GG-Edition Afrika ── */
  edition('afrika-laender', 'gg-afrika-laender', 'Länder Afrikas (GG Edition)', 'Nur die Länder Afrikas, in denen du in GeoGuessr landen kannst.', 'leicht'),
  edition('afrika-flaggen-schwer', 'gg-afrika-flaggen', 'Flaggen Afrikas (GG Edition)', 'Die Flaggen der afrikanischen GeoGuessr-Länder – man sieht sie an Behörden, Schulen und Polizeistationen.', 'leicht'),
  edition('afrika-hauptstaedte', 'gg-afrika-hauptstaedte', 'Hauptstädte Afrikas (GG Edition)', 'Pretoria, Windhoek, Nairobi, Kigali, Accra, Dakar & Co. – die Hauptstädte der GeoGuessr-Länder.', 'leicht'),
]