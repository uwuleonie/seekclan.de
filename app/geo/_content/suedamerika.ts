// Südamerika-Quizzes: Regionen aller Länder, Städte in vier Stufen, Flüsse, Seen, Gebirge, Landschaften, Inseln, Gipfel,
// Flughäfen, Häfen, Amtssprachen, Klima und Vorwahlen von Chile.
// Die Einträge liegen in public/geo/items/suedamerika.json (erzeugt von scripts/geo/build-suedamerika.mjs),
// die Karten-Ebenen in public/geo/layers/sa-*.json, fluesse-sa.json, seen-sa.json, gebirge-sa.json, wuesten-sa.json, gebiete-sa.json.
// Brasiliens Bundesstaaten und Vorwahlen stehen schon in geoguessr.ts.

import { SA_COUNTS, SA_REGIONEN, SA_STAEDTE } from '../_data/suedamerika'
import type { GroupDef, Kind, LonLat, QuizDef } from '../_lib/types'
import { C, CYCLE } from './palette'

const g = (name: string, color: string): GroupDef => ({ name, color })
const cycle = (names: Record<string, string>) => Object.fromEntries(Object.entries(names).map(([k, n], i) => [k, g(n, CYCLE[i % CYCLE.length])]))
/**
 * Hohe, schmale Länder (Chile, Argentinien): Die Karte ist höchstens 1,6-mal so hoch wie breit, sonst wird unten abgeschnitten.
 * Deshalb den Ausschnitt seitlich verbreitern, bis das Verhältnis passt (grob nach Kegelprojektion: Breite × cos(Mittel-Breite)).
 */
function breit([[w, s], [e, n]]: [LonLat, LonLat], max = 1.45): [LonLat, LonLat] {
  const k = Math.cos((((s + n) / 2) * Math.PI) / 180)
  const need = (n - s) / (max * k)
  if (e - w >= need) return [[w, s], [e, n]]
  const m = (w + e) / 2
  return [[m - need / 2, s], [m + need / 2, n]]
}
/** Festland-Chile (ohne Osterinsel und Juan-Fernández-Inseln, sonst wird die Karte winzig) */
const CHILE = breit([[-77, -56], [-65, -17.4]])
const ARGENTINIEN = breit([[-74, -55.5], [-53, -21.5]])
const SA = breit([[-82, -56], [-34, 13]])
const SA_INSELN = breit([[-92, -56], [-34, 13]])

type Diff = NonNullable<QuizDef['difficulty']>
type Opts = Partial<QuizDef> & {
  slug: string; title: string; meta: string; text: string; kind: Kind; noun: string
  ask: [string, string, string?]; groups: Record<string, GroupDef>; layers: string[]
}

function q(o: Opts): QuizDef {
  const { noun, ask, ...rest } = o
  const count = SA_COUNTS[o.slug] ?? 0
  return {
    bereich: 'suedamerika',
    items: [],
    itemsFile: 'suedamerika',
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

const STUFE_NAME: Record<string, string> = { leicht: 'Leicht', mittel: 'Mittel', schwer: 'Schwer', 'sehr-schwer': 'Sehr schwer' }

/* ───────────── Regionen ───────────── */

const REGION_DIFF: Record<string, Diff> = {
  'ar-provinzen': 'mittel', 'cl-regionen': 'leicht', 'co-departamentos': 'schwer', 'pe-regionen': 'mittel', 'bo-departamentos': 'leicht',
  've-staaten': 'mittel', 'ec-provinzen': 'mittel', 'py-departamentos': 'schwer', 'uy-departamentos': 'mittel', 'gy-sr-regionen': 'sehr-schwer',
}
const REGION_TIP: Record<string, QuizDef['tip']> = {
  'ar-provinzen': { title: 'GeoGuessr-Tipp', text: 'Der ISO-Buchstabe der Provinz steht oft auf alten Kennzeichen und in Straßennamen. Patagonien (Neuquén bis Feuerland) ist flach, trocken und windig.' },
  'cl-regionen': { title: 'Gut zu wissen', text: 'Die Regionen hatten früher nur römische Nummern (I bis XII, dazu RM) – auf Schildern und Karten sieht man sie bis heute.' },
  'co-departamentos': { title: 'GeoGuessr-Tipp', text: 'Bogotá ist ein eigener Hauptstadtbezirk und liegt mitten in Cundinamarca.' },
}

const regionQuizzes: QuizDef[] = Object.entries(SA_REGIONEN).map(([slug, r]) => q({
  slug, title: r.title, meta: `# ${r.noun} · mit ${r.capLabel === 'Hauptstadt' ? 'Hauptstädten' : r.capLabel}`, text: r.text,
  country: typeof r.iso === 'string' ? r.iso : undefined, kind: 'regionen', section: 'Länder & Regionen',
  layers: [`sa-${slug}`], groups: cycle(r.groups), noun: r.noun, difficulty: REGION_DIFF[slug], ...(slug === 'cl-regionen' ? { frame: CHILE } : slug === 'ar-provinzen' ? { frame: ARGENTINIEN } : {}),
  ask: [`Wo liegt die ${r.one}?`, `Welche ${r.one} ist markiert?`, `${r.capLabel}?`], tip: REGION_TIP[slug],
}))

/* ───────────── Städte ───────────── */

const POP = { mio: g('über 1 Million', C.rose), gross: g('250.000 bis 1 Million', C.ochre), mittel: g('100.000 bis 250.000', C.blue), klein: g('unter 100.000', C.green) }
const LAND: Record<string, [string, [LonLat, LonLat]]> = {
  ARG: ['Argentinien', ARGENTINIEN], BRA: ['Brasilien', [[-74.5, -34], [-34, 5.5]]], CHL: ['Chile', CHILE],
  COL: ['Kolumbien', [[-80, -4.3], [-66.8, 12.6]]], PER: ['Peru', [[-81.5, -18.5], [-68.5, 0]]], BOL: ['Bolivien', [[-69.8, -23], [-57.4, -9.6]]],
  VEN: ['Venezuela', [[-73.5, 0.6], [-59.8, 12.3]]], ECU: ['Ecuador', [[-81.2, -5.1], [-75.1, 1.5]]], PRY: ['Paraguay', [[-62.7, -27.7], [-54.2, -19.2]]],
  URY: ['Uruguay', [[-58.5, -35], [-53, -30]]],
}
const STAEDTE_TEXT: Record<string, string> = {
  leicht: 'Die größten Städte – der Einstieg.', mittel: 'Alle großen Städte des Landes.', schwer: 'Viele Städte – auch mittelgroße.', 'sehr-schwer': 'Alle Städte aus den Daten – auch kleine Orte.',
}

const staedteQuizzes: QuizDef[] = Object.entries(SA_STAEDTE).flatMap(([iso, tiers]) => tiers.map(t => q({
  slug: t.slug, title: `${LAND[iso][0]} – Städte (${STUFE_NAME[t.diff]})`, meta: `# Städte · ${STUFE_NAME[t.diff]}`,
  text: `${LAND[iso][0]}: ${STAEDTE_TEXT[t.diff]}`, country: iso, kind: 'staedte', section: 'Städte',
  layers: [], frame: breit(LAND[iso][1]), groups: POP, noun: 'Städte', difficulty: t.diff as Diff,
  ask: ['Wo liegt die Stadt?', 'Welche Stadt ist markiert?'],
})))

/* ───────────── Natur ───────────── */

const FLUSS = { gross: g('großer Fluss', C.blue), mittel: g('mittlerer Fluss', C.teal), klein: g('kleiner Fluss', C.sky) }
const naturQuizzes: QuizDef[] = [
  q({
    slug: 'sa-fluesse-leicht', title: 'Flüsse Südamerikas (Leicht)', meta: '# Flüsse · die bekanntesten', kind: 'fluesse', section: 'Natur',
    text: 'Amazonas, Paraná, Orinoco, São Francisco & Co. – die großen Ströme Südamerikas.', difficulty: 'leicht',
    layers: ['fluesse-sa'], frame: SA, groups: FLUSS, noun: 'Flüsse', ask: ['Wo fließt der Fluss?', 'Welcher Fluss ist markiert?'],
    tip: { title: 'Gut zu wissen', text: 'Der Amazonas führt mehr Wasser als die nächsten sieben größten Flüsse der Welt zusammen.' },
  }),
  q({
    slug: 'sa-fluesse-mittel', title: 'Flüsse Südamerikas (Mittel)', meta: '# Flüsse', kind: 'fluesse', section: 'Natur',
    text: 'Dazu die großen Nebenflüsse: Xingu, Tapajós, Juruá, Meta, Apure, Bermejo …', difficulty: 'mittel',
    layers: ['fluesse-sa'], frame: SA, groups: FLUSS, noun: 'Flüsse', ask: ['Wo fließt der Fluss?', 'Welcher Fluss ist markiert?'], labelSize: 7,
  }),
  q({
    slug: 'sa-fluesse-schwer', title: 'Flüsse Südamerikas (Schwer)', meta: '# Flüsse · alle', kind: 'fluesse', section: 'Natur',
    text: 'Alle Flüsse aus den Daten – bis zum Rapel in Chile und dem Gallegos in Patagonien.', difficulty: 'schwer',
    layers: ['fluesse-sa'], frame: SA, groups: FLUSS, noun: 'Flüsse', ask: ['Wo fließt der Fluss?', 'Welcher Fluss ist markiert?'], labelSize: 6,
  }),
  q({
    slug: 'sa-seen', title: 'Seen & Stauseen Südamerikas', meta: '# Seen', kind: 'seen', section: 'Natur',
    text: 'Titicacasee, Lago General Carrera, Nahuel Huapi, Itaipu – natürliche Seen und riesige Stauseen.', difficulty: 'schwer',
    layers: ['seen-sa'], frame: SA, groups: { see: g('natürlicher See', C.sky), stausee: g('Stausee', C.indigo) }, noun: 'Seen',
    ask: ['Wo liegt der See?', 'Welcher See ist markiert?', 'In welchem Land?'], labelSize: 6,
    tip: { title: 'Gut zu wissen', text: 'Der Titicacasee (3.812 m) ist der höchste schiffbare See der Welt. Der Lago General Carrera heißt in Argentinien „Lago Buenos Aires“.' },
  }),
  q({
    slug: 'sa-gebirge', title: 'Gebirge & Hochländer Südamerikas', meta: '# Gebirge', kind: 'berge', section: 'Natur',
    text: 'Anden, Altiplano, Bergland von Guayana, Serra do Mar – die Gebirge und Hochebenen.', difficulty: 'mittel',
    layers: ['gebirge-sa'], frame: SA, groups: { gebirge: g('Gebirge', C.brown), hochland: g('Hochland/Plateau', C.ochre) }, noun: 'Gebirge',
    ask: ['Wo liegt das Gebirge?', 'Welches Gebirge ist markiert?'], labelSize: 6,
    tip: { title: 'Gut zu wissen', text: 'In Kolumbien teilen sich die Anden in drei Ketten: Cordillera Occidental, Central und Oriental.' },
  }),
  q({
    slug: 'sa-landschaften', title: 'Landschaften Südamerikas', meta: '# Landschaften', kind: 'wuesten', section: 'Natur',
    text: 'Atacama, Pampa, Gran Chaco, Pantanal, Llanos, Salar de Uyuni, Patagonien.', difficulty: 'leicht',
    layers: ['wuesten-sa'], frame: SA,
    groups: { wueste: g('Wüste/Salzsee', C.sand), ebene: g('Ebene/Becken', C.olive), feucht: g('Feuchtgebiet/Delta', C.teal), region: g('Landschaft', C.terra), halbinsel: g('Halbinsel', C.plum) },
    noun: 'Landschaften', ask: ['Wo liegt die Landschaft?', 'Welche Landschaft ist markiert?'],
    tip: { title: 'Gut zu wissen', text: 'Der Salar de Uyuni in Bolivien ist die größte Salzpfanne der Welt (über 10.000 km²).' },
  }),
  q({
    slug: 'sa-inseln', title: 'Inseln Südamerikas', meta: '# Inseln', kind: 'gebiete', section: 'Natur',
    text: 'Feuerland, Chiloé, Marajó, Galápagos und die Falklandinseln.', difficulty: 'leicht',
    layers: ['gebiete-sa'], frame: SA_INSELN, groups: { insel: g('Insel(n)', C.teal) }, noun: 'Inseln',
    ask: ['Wo liegt die Insel?', 'Welche Insel ist markiert?'],
  }),
  q({
    slug: 'sa-gipfel-leicht', title: 'Berühmte Berge Südamerikas', meta: '# Gipfel & Vulkane', kind: 'berge', section: 'Natur',
    text: 'Aconcagua, Chimborazo, Cotopaxi, Fitz Roy, Zuckerhut – die bekanntesten Gipfel.', difficulty: 'leicht',
    layers: ['gebirge-sa'], frame: SA, groups: { sechs: g('über 6.000 m', C.rose), vier: g('4.000 bis 6.000 m', C.ochre), klein: g('unter 4.000 m', C.green) }, noun: 'Gipfel',
    ask: ['Wo liegt der Berg?', 'Welcher Berg ist markiert?', 'Wie hoch?'],
    tip: { title: 'Gut zu wissen', text: 'Der Aconcagua (6.959 m) ist der höchste Berg außerhalb Asiens. Der Gipfel des Chimborazo ist der vom Erdmittelpunkt am weitesten entfernte Punkt der Erde.' },
  }),
  q({
    slug: 'sa-gipfel', title: 'Gipfel Südamerikas (Schwer)', meta: '# Gipfel & Vulkane', kind: 'berge', section: 'Natur',
    text: 'Alle Gipfel aus den Daten – Sechstausender der Anden bis zu den Tepuis und Bergen in Brasilien.', difficulty: 'schwer',
    layers: ['gebirge-sa'], frame: SA, groups: { sechs: g('über 6.000 m', C.rose), vier: g('4.000 bis 6.000 m', C.ochre), klein: g('unter 4.000 m', C.green) }, noun: 'Gipfel',
    ask: ['Wo liegt der Berg?', 'Welcher Berg ist markiert?', 'Wie hoch?'], labelSize: 6,
  }),
]

/* ───────────── Verkehr ───────────── */

const AP_GROUPS = { gross: g('Großer Flughafen', C.rose), mittel: g('Mittlerer Flughafen', C.blue) }
const AP_ASK: [string, string, string] = ['Wo liegt der Flughafen?', 'Welcher Flughafen ist markiert?', 'Welcher IATA-Code?']
const verkehrQuizzes: QuizDef[] = [
  q({
    slug: 'sa-flughaefen-gross', title: 'Große Flughäfen Südamerikas', meta: '# Flughäfen · mit IATA-Code', kind: 'flughaefen', section: 'Verkehr',
    text: 'GRU, EZE, SCL, BOG, LIM … die großen Flughäfen mit IATA-Code.', difficulty: 'schwer',
    layers: [], frame: SA, groups: AP_GROUPS, noun: 'Flughäfen', ask: AP_ASK,
  }),
  q({
    slug: 'sa-flughaefen', title: 'Alle Flughäfen Südamerikas', meta: '# Flughäfen · mit IATA-Code', kind: 'flughaefen', section: 'Verkehr',
    text: 'Alle großen und mittleren Flughäfen mit Linienflügen – bis Ushuaia und Leticia.', difficulty: 'sehr-schwer',
    layers: [], frame: SA, groups: AP_GROUPS, noun: 'Flughäfen', ask: AP_ASK, labelSize: 6,
  }),
  q({
    slug: 'sa-haefen', title: 'Häfen Südamerikas', meta: '# Häfen', kind: 'haefen', section: 'Verkehr',
    text: 'Santos, Buenos Aires, Valparaíso, Callao, Cartagena – die See- und Flusshäfen.', difficulty: 'sehr-schwer',
    layers: [], frame: SA, groups: { atlantik: g('Atlantik & Karibik', C.blue), pazifik: g('Pazifik', C.teal), binnen: g('Fluss/Binnen', C.ochre) }, noun: 'Häfen',
    ask: ['Wo liegt der Hafen?', 'Welcher Hafen ist markiert?', 'In welchem Land?'], labelSize: 6,
  }),
]

/* ───────────── Sprachen, Klima, Vorwahlen ───────────── */

const wissenQuizzes: QuizDef[] = [
  q({
    slug: 'sa-sprachen', title: 'Amtssprachen Südamerikas', meta: '# Länder · nach Sprache', kind: 'sprachen', section: 'Sprachen & Codes',
    text: 'Spanisch, Portugiesisch, Niederländisch, Englisch – und Quechua, Aymara, Guaraní als Amtssprachen.', difficulty: 'leicht',
    layers: ['world'], frame: SA,
    groups: { spanisch: g('Spanisch', C.rose), portugiesisch: g('Portugiesisch', C.green), niederlaendisch: g('Niederländisch', C.terra), englisch: g('Englisch', C.blue) },
    noun: 'Länder', ask: ['Wo liegt das Land?', 'Welches Land ist markiert?', 'Welche Amtssprache?'],
    tip: { title: 'GeoGuessr-Tipp', text: 'Portugiesisch erkennt man an ã, õ, ç und „lh/nh“; Spanisch an ñ und „ll“. In Guyana fährt man links!' },
  }),
  q({
    slug: 'cl-klima', title: 'Chile – Klima der Regionen', meta: '# Regionen · Köppen', kind: 'wissen', section: 'Klima', country: 'CHL',
    text: 'Von der trockensten Wüste der Welt bis zum kalten, nassen Süden: welches Klima überwiegt in welcher Region?', difficulty: 'mittel',
    layers: ['sa-cl-regionen'], frame: CHILE,
    groups: {
      BWn: g('Küstennebelwüste (BWn)', C.sand), BSn: g('Steppe mit Küstennebel (BSn)', C.ochre), Csb: g('Mittelmeerklima (Csb)', C.terra),
      Cfb: g('ozeanisch, feucht-mild (Cfb)', C.green), Cfc: g('subpolares Meeresklima (Cfc)', C.sky),
    },
    noun: 'Regionen', ask: ['Wo liegt die Region?', 'Welche Region ist markiert?', 'Welches Klima?'],
    tip: { title: 'GeoGuessr-Tipp', text: 'Sand und kahle Hügel → Norden. Weinberge und trockenes Gras → Zentrum. Sattgrüne Weiden, Vulkane und Holzhäuser → Süden.' },
  }),
  q({
    slug: 'cl-vorwahlen', title: 'Chile – Vorwahlen', meta: '# Regionen · Festnetz-Vorwahlen', kind: 'vorwahlen', section: 'Sprachen & Codes', country: 'CHL',
    text: '2 Santiago, 32 Valparaíso, 41 Concepción, 61 Punta Arenas … welche Region hat welche Vorwahl?', difficulty: 'schwer',
    layers: ['sa-cl-regionen'], frame: CHILE,
    groups: { 2: g('2 (Santiago)', C.rose), 3: g('3x', C.ochre), 4: g('4x', C.green), 5: g('5x', C.terra), 6: g('6x', C.blue), 7: g('7x', C.plum) },
    noun: 'Vorwahlen', ask: ['Welche Region hat diese Vorwahl?', 'Welche Vorwahl hat die markierte Region?', 'Welche Region?'],
    tip: { title: 'GeoGuessr-Tipp', text: 'Faustregel: Norden 5x, Santiago 2, Zentrum 3x und 7x, Süden 4x und 6x. Auf Werbeschildern steht die Nummer oft als (XX) XXX XXXX.' },
  }),
]

export const SUEDAMERIKA_QUIZZES: QuizDef[] = [...regionQuizzes, ...staedteQuizzes, ...naturQuizzes, ...verkehrQuizzes, ...wissenQuizzes]