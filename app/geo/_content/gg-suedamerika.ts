// GeoGuessr Südamerika: Lernkarten mit eigenen Zeichnungen und Fotos, Hinweis-Karten und Karten-Quizzes.
// Lernkarten:      public/geo/items/gg-sa-karten.json   (special: 'schrift', Komponente SchriftQuiz – mit Bildern)
// Karten-Quizzes:  public/geo/items/gg-sa-orte.json     (Taxis Argentinien, Straßenbuchstaben Chile, Merkmals-Karten)
// Steckbriefe:     public/geo/gg-sa/…                   (Seiten /geo/geoguessr-suedamerika und …/<land>)
// Erzeugt von scripts/geo/build-gg-sa.mjs (Daten in scripts/geo/gg-sa/ und scripts/geo/gg-sa-daten.mjs).

import { GG_SA_COUNTS, GG_SA_MERKMAL_GROUPS } from '../_data/gg-sa'
import type { GroupDef, Kind, LonLat, QuizDef } from '../_lib/types'
import { C } from './palette'
import { SUEDAMERIKA_QUIZZES } from './suedamerika'

type Diff = NonNullable<QuizDef['difficulty']>
const n = (slug: string) => GG_SA_COUNTS[slug] ?? 0
const meta = (m: string, slug: string) => m.replace('#', n(slug).toLocaleString('de-DE'))
const SA_FRAME: [LonLat, LonLat] = [[-92, -56], [-30, 13]]

const BIL = 'GeoGuessr: Bilder'
const HIN = 'GeoGuessr: Hinweise'
const REG = 'GeoGuessr: Regionen'
const KAR = 'GeoGuessr: Karten'

function deck(slug: string, title: string, m: string, section: string, text: string, difficulty: Diff, country?: string, kind: Kind = 'wissen'): QuizDef {
  return {
    slug, title, meta: meta(m, slug), bereich: 'suedamerika', kind, section, text, country, difficulty,
    special: 'schrift', items: [], itemsFile: 'gg-sa-karten', count: n(slug),
    askClick: 'Welches Land?', askName: 'Welches Land?', itemsNoun: 'Karten',
    groups: {}, layers: [], combinable: false,
  }
}

function merkmalKarte(slug: string, title: string, m: string, text: string, ask: [string, string, string], difficulty: Diff, tip?: QuizDef['tip']): QuizDef {
  return {
    slug, title, meta: meta(m, slug), bereich: 'suedamerika', kind: 'wissen', section: KAR, text, difficulty,
    items: [], itemsFile: 'gg-sa-orte', count: n(slug),
    askClick: ask[0], askName: ask[1], askText: ask[2], itemsNoun: 'Länder',
    groups: (GG_SA_MERKMAL_GROUPS[slug] ?? {}) as Record<string, GroupDef>, layers: ['world'], frame: SA_FRAME, labelSize: 8, tip,
    intro: 'Lernmodus – die Farben auf der Karte zeigen das Merkmal. Tippe auf ein Land für Details.',
  }
}

const clRegionen = SUEDAMERIKA_QUIZZES.find(q => q.slug === 'cl-regionen')!

export const GG_SA_QUIZZES: QuizDef[] = [
  /* ── Bilder ── */
  deck('gg-sa-kennzeichen', 'Kennzeichen Südamerikas', '# Kennzeichen · welches Land?', BIL,
    'Mercosur-Balken, schwarz, gelb, orange oder kurz mit blauer Schrift: Am Kennzeichen erkennst du fast jedes Land.', 'leicht'),
  deck('gg-sa-taxis-argentinien', 'Argentinien: Taxis der Städte', '# Taxis · welche Stadt?', BIL,
    'Schwarz mit gelbem Dach in Buenos Aires, rot in Salta, gelb in Neuquén: Argentiniens Taxis verraten die Stadt.', 'mittel', 'ARG'),
  deck('gg-sa-taxis', 'Taxis & Mototaxis', '# Bilder · welches Land?', BIL,
    'Pastellgelb in Kolumbien, kräftig gelb in Ecuador, rot-weiße Streifen und Tuk-Tuks in Peru.', 'leicht'),
  deck('gg-sa-poller', 'Poller & Kilometersteine', '# Bilder · welches Land?', BIL,
    'Rote Ringe in Ecuador, gelbe Seite in Uruguay, „Pr“ in Kolumbien, „Km“ in Bolivien – Poller und Steine am Straßenrand.', 'mittel'),
  deck('gg-sa-masten', 'Strommasten Südamerikas', '# Masten · welches Land?', BIL,
    'Leiter in Brasilien, Einbuchtung in Chile, Dreizack in Uruguay, Streifen in Kolumbien und Peru.', 'schwer'),
  deck('gg-sa-schilder', 'Chevrons, Leitplanken & Schilder', '# Bilder · welches Land?', BIL,
    'Weiß-rote Chevrons in Argentinien, schwarz-gelbe in Brasilien – und Leitplanken, die Peru von Bolivien trennen.', 'mittel'),
  deck('gg-sa-linien', 'Fahrbahn-Linien Südamerikas', '# Linien · welches Land?', BIL,
    'Chile: alles weiß oder alles gelb. Uruguay: dreifach. Brasilien: doppelt gelb.', 'mittel'),
  deck('gg-sa-zaeune', 'Zäune, Mauern & Tore', '# Bilder · welches Land?', BIL,
    'Holzzäune und bunte spitze Pfähle in Kolumbien, Lehmmauern in der Atacama, Farbverlauf-Tore in El Alto.', 'leicht'),
  deck('gg-sa-pflanzen', 'Palmen, Bäume & Felder', '# Fotos · welche Pflanze?', BIL,
    'Araukarie, Carnaúba, Açaí, Cardón-Kaktus, Pampasgras, Lupinen: Fotos der Pflanzen, die in GeoGuessr die Region verraten.', 'schwer'),

  /* ── Hinweise ── */
  deck('gg-sa-hinweise', 'GeoGuessr-Hinweise Südamerika', '# Hinweise · welches Land?', HIN,
    'Rund 230 Hinweise aus Plonk It – Masten, Kennzeichen, Google-Auto, Landschaft – lerne sie Kategorie für Kategorie.', 'schwer'),
  deck('gg-sa-rate-das-land', 'Rate das Land: drei Hinweise', '# Runden', HIN,
    'Wie in einer echten Runde: drei Hinweise zusammen – welches Land?', 'mittel'),
  deck('gg-sa-vorwahlen', 'Ländervorwahlen Südamerikas', '# Vorwahlen · +54, +55 …', HIN,
    '+54 Argentinien, +55 Brasilien, +56 Chile: Telefonnummern auf Plakaten und Lieferwagen verraten das Land.', 'leicht', undefined, 'vorwahlen'),
  deck('gg-sa-domains', 'Länderdomains Südamerikas', '# Domains · .ar, .br …', HIN,
    '.ar, .br, .cl, .co – Webadressen auf Werbung und Schildern.', 'leicht', undefined, 'domains'),

  /* ── Regionen ── */
  deck('gg-sa-regionen-argentinien', 'Argentinien: Welche Region?', '# Hinweise · welche Region?', REG,
    'Cardón-Kakteen in Salta, Pappelreihen in Neuquén, Buchenwälder in Feuerland: Wo in Argentinien bist du?', 'sehr-schwer', 'ARG'),
  deck('gg-sa-regionen-brasilien', 'Brasilien: Welcher Bundesstaat?', '# Hinweise · welche Region?', REG,
    'Mast-IDs, Isolatoren, Lampen, Palmen und Felder: die Hinweise auf die Bundesstaaten Brasiliens.', 'experte', 'BRA'),
  deck('gg-sa-regionen-chile', 'Chile: Welche Region?', '# Hinweise · welche Region?', REG,
    'Atacama, Weinberge im Maule, Araukarien, Chiloé und Magallanes: Wo in Chile bist du?', 'sehr-schwer', 'CHL'),
  deck('gg-sa-regionen-peru', 'Peru: Welche Region?', '# Hinweise · welche Region?', REG,
    'Küstenwüste, Anden, Amazonas, Cusco, Titicacasee: Wo in Peru bist du?', 'sehr-schwer', 'PER'),
  deck('gg-sa-regionen-bolivien', 'Bolivien: Welche Region?', '# Hinweise · welche Region?', REG,
    'La Paz oder El Alto, Altiplano oder Tiefland: Wo in Bolivien bist du?', 'sehr-schwer', 'BOL'),

  /* ── Karten ── */
  {
    slug: 'gg-sa-ar-taxis', title: 'Karte: Taxi-Farben Argentiniens', meta: meta('# Städte · schwarz, rot, gelb …', 'gg-sa-ar-taxis'), bereich: 'suedamerika', kind: 'staedte', section: KAR,
    country: 'ARG', difficulty: 'mittel', text: 'Wo fahren schwarze Taxis mit gelbem Dach, wo rote, wo grüne? Die Taxi-Städte Argentiniens auf der Karte.',
    items: [], itemsFile: 'gg-sa-orte', count: n('gg-sa-ar-taxis'), askClick: 'Wo liegt die Stadt?', askName: 'Welche Stadt ist markiert?', askText: 'Welche Taxi-Farbe?', itemsNoun: 'Städte',
    groups: { schwarz: { name: 'schwarz', color: '#3a3a3a' }, rot: { name: 'rot', color: C.rose }, weiss: { name: 'weiß', color: '#e8e4da' }, gruen: { name: 'grün', color: C.green }, gelb: { name: 'gelb', color: C.ochre } },
    layers: ['sa-ar-provinzen'], frame: [[-80, -55.5], [-47, -21.5]], labelSize: 8,
    tip: { title: 'GeoGuessr-Tipp', text: 'Schwarz mit gelbem Dach gibt es in Buenos Aires, Rosario und Mendoza – Berge im Hintergrund sprechen für Mendoza.' },
  },
  {
    ...clRegionen, slug: 'gg-sa-cl-strassen', title: 'Chile: Straßenbuchstaben A bis Y', meta: meta('# Regionen · A, B, C …', 'gg-sa-cl-strassen'), kind: 'strassen', section: KAR,
    country: 'CHL', difficulty: 'mittel', text: 'Regionalstraßen tragen einen Buchstaben vor der Nummer – von A im Norden bis Y im Süden. So weißt du sofort, in welcher Region du bist.',
    items: [], itemsFile: 'gg-sa-orte', count: n('gg-sa-cl-strassen'), askClick: 'Wo ist die Region mit diesem Buchstaben?', askName: 'Welche Region ist markiert?', askText: 'Welche Region?', itemsNoun: 'Regionen',
    intro: 'Lernmodus – tippe auf eine Region: Straßenbuchstabe(n) und Provinzen.',
    tip: { title: 'Merkhilfe', text: 'Das Alphabet läuft von Norden nach Süden: A Arica/Tarapacá, G Santiago, N Ñuble, T Los Ríos, X Aysén, Y Magallanes.' },
  },
  merkmalKarte('gg-sa-kennzeichen-karte', 'Karte: Kennzeichen', '# Länder · Mercosur, gelb, weiß',
    'Mercosur im Osten und Süden, gelb in Kolumbien, weiß in den Anden.', ['Wo liegt das Land?', 'Welches Land ist markiert?', 'Wie sehen die Kennzeichen aus?'], 'leicht'),
  merkmalKarte('gg-sa-chevron-karte', 'Karte: Chevron-Farben', '# Länder',
    'Weiß-rot nur in Argentinien, schwarz-gelb nur in Brasilien, sonst gelb-schwarz.', ['Wo liegt das Land?', 'Welches Land ist markiert?', 'Welche Chevrons?'], 'leicht'),
  merkmalKarte('gg-sa-mittellinie-karte', 'Karte: Farbe der Mittellinie', '# Länder',
    'Gelbe Mitte in Brasilien, Kolumbien und Peru, weiß in Chile – gemischt in Argentinien, Uruguay und Bolivien.', ['Wo liegt das Land?', 'Welches Land ist markiert?', 'Welche Farbe?'], 'mittel'),
  merkmalKarte('gg-sa-auto-karte', 'Karte: Google-Auto (Gen 3)', '# Länder · schwarz oder weiß',
    'Schwarz in Argentinien, Uruguay und Peru, weiß in Chile, Bolivien, Brasilien und Ecuador.', ['Wo liegt das Land?', 'Welches Land ist markiert?', 'Welche Farbe hat das Auto?'], 'mittel',
    { title: 'Gut zu wissen', text: 'Peru hat beide Farben. Kolumbien: schwarz, weiß oder grau mit kurzer, dicker Antenne.' }),
]