// Baut die zusätzlichen Europa-Quizzes von seekclan.de/geo (Phase 3):
// Regionsflaggen, ähnliche Flaggen, EU/Euro/Schengen/NATO, Kfz-Länderkennzeichen, Amtssprachen,
// Inseln, Gebirge, Seen, Meere, Millionenstädte, Vorwahlen, Domains, Binnenstaaten Europas.
//
// Nur für Entwicklung – wird NICHT beim normalen `npm run build` ausgeführt.
// Ergebnis liegt fertig im Repo:
//   public/geo/items/europa-extra.json   Einträge aller Quizzes
//   public/geo/layers/eu-inseln.json      Inseln Europas (Natural Earth 1:10m)
//   app/geo/_data/europa-extra.ts         Anzahl Einträge je Quiz
//   app/geo/_data/flaggen-regionen.ts     Fläche → Regionsflagge (für die Kartenansicht „Flaggen“)
//
// Benötigt: vorher build-welt.mjs, build-laender.mjs, build-europa.mjs (deren Einträge werden gefiltert/weiterverwendet),
// scripts/geo/flaggen-regionen.json (Fläche → ISO-3166-2, aus build-flaggen-regionen.py) und mapshaper.
// Danach:  node scripts/geo/build-europa-extra.mjs
//
// Quellen:
//  - Natural Earth 1:10m geography_regions_polys (gemeinfrei): Inseln
//  - Beitrittsjahre EU/Euro/Schengen/NATO, Kfz-Zeichen, Amtssprachen: siehe Kommentare an den Tabellen

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { geoArea, geoBounds, geoCentroid, geoContains } from 'd3-geo'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const SRC = process.env.GEO_SRC || path.join(here, '.src')
const TMP = path.join(SRC, 'tmp-europa-extra')
fs.mkdirSync(TMP, { recursive: true })
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'))
const items = f => readJson(path.join(root, 'public/geo/items', `${f}.json`))
const layer = id => readJson(path.join(root, 'public/geo/layers', `${id}.json`))
function slug(s) {
  return String(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x'
}
function rewind(g) {
  if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) return g
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  const fixed = polys.map(rings => (geoArea({ type: 'Polygon', coordinates: rings }) > 2 * Math.PI ? rings.map(r => [...r].reverse()) : rings))
  return g.type === 'Polygon' ? { type: 'Polygon', coordinates: fixed[0] } : { type: 'MultiPolygon', coordinates: fixed }
}

const OUT = {}
const add = (slugName, list) => { OUT[slugName] = list; console.log(`  ${slugName}: ${list.length}`) }

/* ───────────── Länder Europas (Namen, Flaggen) ───────────── */

const WL = items('welt-laender')
const LAND = Object.fromEntries(WL['welt-flaggen'].map(x => [x.key.split(':')[1], { name: x.label, flag: x.flag, aliases: x.aliases ?? [] }]))
const land = (id, extra = {}) => {
  const c = LAND[id]
  if (!c) throw new Error(`Land fehlt: ${id}`)
  return { label: c.name, aliases: c.aliases, areas: [`world:${id}`], flag: c.flag, ...extra }
}

/* ───────────── Regionsflaggen ───────────── */

// Fläche → ISO-3166-2 (Abgleich über die Koordinate des Wikidata-Eintrags, siehe build-flaggen-regionen.py)
const CODES = readJson(path.join(here, 'flaggen-regionen.json'))
const DE_NAMES = { 'DE-BW': 'Baden-Württemberg', 'DE-BY': 'Bayern', 'DE-BE': 'Berlin', 'DE-BB': 'Brandenburg', 'DE-HB': 'Bremen', 'DE-HH': 'Hamburg', 'DE-HE': 'Hessen', 'DE-MV': 'Mecklenburg-Vorpommern', 'DE-NI': 'Niedersachsen', 'DE-NW': 'Nordrhein-Westfalen', 'DE-RP': 'Rheinland-Pfalz', 'DE-SL': 'Saarland', 'DE-SN': 'Sachsen', 'DE-ST': 'Sachsen-Anhalt', 'DE-SH': 'Schleswig-Holstein', 'DE-TH': 'Thüringen' }
const AT_NAMES = { 'AT-1': 'Burgenland', 'AT-2': 'Kärnten', 'AT-3': 'Niederösterreich', 'AT-4': 'Oberösterreich', 'AT-5': 'Salzburg', 'AT-6': 'Steiermark', 'AT-7': 'Tirol', 'AT-8': 'Vorarlberg', 'AT-9': 'Wien' }

// [Quiz-Slug, Ebene, Quelle der Namen (Datei/Quiz) oder feste Namen, Wort für die Frage]
const REGION_FLAGS = [
  ['de-bundeslaender-flaggen', 'adm1-DEU', DE_NAMES, 'Bundesland'],
  ['at-bundeslaender-flaggen', 'adm1-AUT', AT_NAMES, 'Bundesland'],
  ['ch-kantone-flaggen', 'eu-ch-kantone', ['europa', 'ch-kantone'], 'Kanton'],
  ['pl-woiwodschaften-flaggen', 'eu-pl-woiwodschaften', ['europa', 'pl-woiwodschaften'], 'Woiwodschaft'],
  ['cz-regionen-flaggen', 'eu-cz-regionen', ['europa', 'cz-regionen'], 'Region'],
  ['sk-regionen-flaggen', 'eu-sk-regionen', ['europa', 'sk-regionen'], 'Region'],
  ['hu-komitate-flaggen', 'eu-hu-komitate', ['europa', 'hu-komitate'], 'Komitat'],
  ['nl-provinzen-flaggen', 'nl-provinzen', ['laender', 'nl-provinzen'], 'Provinz'],
  ['be-provinzen-flaggen', 'eu-be-provinzen', ['europa', 'be-provinzen'], 'Provinz'],
  ['it-regionen-flaggen', 'it-regionen', ['laender', 'it-regionen'], 'Region'],
  ['es-regionen-flaggen', 'es-regionen', ['laender', 'es-regionen'], 'Region'],
  ['fr-regionen-flaggen', 'fr-regionen', ['laender', 'fr-regionen'], 'Region'],
  ['uk-laender-flaggen', 'uk-laender', ['laender', 'uk-laender'], 'Landesteil'],
  ['no-fylker-flaggen', 'no-fylker', ['laender', 'no-fylker'], 'Fylke'],
  ['se-provinzen-flaggen', 'eu-se-provinzen', ['europa', 'se-provinzen'], 'Provinz'],
  ['fi-landschaften-flaggen', 'eu-fi-landschaften', ['europa', 'fi-landschaften'], 'Landschaft'],
  ['dk-regionen-flaggen', 'eu-dk-regionen', ['europa', 'dk-regionen'], 'Region'],
  ['hr-gespanschaften-flaggen', 'eu-hr-gespanschaften', ['europa', 'hr-gespanschaften'], 'Gespanschaft'],
  ['ee-kreise-flaggen', 'eu-ee-kreise', ['europa', 'ee-kreise'], 'Kreis'],
  ['lt-bezirke-flaggen', 'eu-lt-bezirke', ['europa', 'lt-bezirke'], 'Bezirk'],
  ['ua-oblaste-flaggen', 'eu-ua-oblaste', ['europa', 'ua-oblaste'], 'Oblast'],
  ['by-woblasze-flaggen', 'eu-by-woblasze', ['europa', 'by-woblasze'], 'Woblasz'],
  ['al-qarqe-flaggen', 'eu-al-qarqe', ['europa', 'al-qarqe'], 'Qark'],
]
const cache = {}
for (const [slugName, lay, src, noun] of REGION_FLAGS) {
  let byArea = {}
  if (Array.isArray(src)) {
    const [file, quiz] = src
    cache[file] ??= items(file)
    for (const it of cache[file][quiz]) for (const a of it.areas ?? []) byArea[a] ??= it
  }
  const list = []
  for (const [ref, code] of Object.entries(CODES)) {
    if (!ref.startsWith(`${lay}:`)) continue
    const src0 = byArea[ref]
    const label = Array.isArray(src) ? src0?.label : src[code]
    if (!label) { console.warn('  ! kein Name für', ref); continue }
    list.push({
      key: `rfl:${code}`, label, aliases: src0?.aliases ?? [], group: 'alle', areas: [ref], flag: `r:${code}`, flagPrompt: true,
      details: [...(src0?.details ?? []).filter(d => d.label !== 'Flagge'), { label: 'ISO-Code', value: code }],
      text: { prompt: `Welche${noun === 'Kanton' || noun === 'Bezirk' || noun === 'Kreis' || noun === 'Landesteil' || noun === 'Oblast' || noun === 'Qark' || noun === 'Woblasz' ? 'r' : noun === 'Bundesland' || noun === 'Komitat' || noun === 'Fylke' ? 's' : ''} ${noun} hat diese Flagge?`, answer: label },
    })
  }
  add(slugName, list.sort((a, b) => a.label.localeCompare(b.label, 'de')))
}

/* ───────────── Ähnliche Flaggen (weltweit, Schwerpunkt Europa) ───────────── */

const AEHNLICH = {
  rotweiss: ['Rot-Weiß', ['POL', 'IDN', 'MCO']],
  blaugelbrot: ['Blau-Gelb-Rot', ['ROU', 'TCD', 'AND', 'MDA']],
  gruenweissorange: ['Grün-Weiß-Orange/Rot', ['IRL', 'CIV', 'ITA', 'MEX']],
  slawisch: ['Weiß-Blau-Rot', ['RUS', 'SVK', 'SVN', 'SRB', 'HRV', 'NLD', 'LUX']],
  kreuz: ['Skandinavisches Kreuz', ['NOR', 'ISL', 'DNK', 'SWE', 'FIN']],
  schwarzrotgold: ['Schwarz-Gelb-Rot', ['DEU', 'BEL']],
  rwr: ['Rot-Weiß-Rot', ['AUT', 'LVA', 'LBN']],
  weissgruenrot: ['Rot-Weiß-Grün', ['HUN', 'BGR', 'TJK', 'IRN']],
  halbmond: ['Halbmond & Stern', ['TUR', 'TUN', 'AZE']],
  panafrika: ['Grün-Gelb-Rot', ['SEN', 'MLI', 'GIN', 'CMR', 'GHA']],
  suedkreuz: ['Kreuz des Südens', ['AUS', 'NZL']],
  andin: ['Gelb-Blau-Rot', ['COL', 'ECU', 'VEN']],
  zentralamerika: ['Blau-Weiß-Blau', ['HND', 'NIC', 'SLV']],
}
const FLAG_ITEM = Object.fromEntries(WL['welt-flaggen'].map(x => [x.key.split(':')[1], x]))
add('flaggen-aehnlich', Object.entries(AEHNLICH).flatMap(([g, [name, ids]]) => ids.map(id => {
  const x = FLAG_ITEM[id]
  if (!x) throw new Error(`Flagge fehlt: ${id}`)
  return { ...x, key: `aeh:${id}`, group: g, details: [...x.details, { label: 'Verwechslungsgefahr mit', value: ids.filter(o => o !== id).map(o => FLAG_ITEM[o].label).join(', ') }], text: { prompt: `Welches Land hat diese Flagge? (${name})`, answer: x.label } }
})))
// Flaggen Europas mit Gebieten (Färöer, Gibraltar, Åland …)
const GEB = items('welt-gebiete')
add('europa-flaggen-schwer', [
  ...WL['welt-flaggen'].filter(x => x.group === 'europa').map(x => ({ ...x, group: 'staat' })),
  ...GEB['welt-flaggen-gebiete'].filter(x => x.group === 'europa').map(x => ({ ...x, group: 'gebiet' })),
].sort((a, b) => a.label.localeCompare(b.label, 'de')))

/* ───────────── EU · Euro · Schengen · NATO ───────────── */

// Beitrittsjahre – Quelle: europa.eu (Länderprofile), ezb.europa.eu, ec.europa.eu (Schengen), nato.int
const EU = { 1958: 'BEL DEU FRA ITA LUX NLD', 1973: 'DNK IRL', 1981: 'GRC', 1986: 'ESP PRT', 1995: 'AUT FIN SWE', 2004: 'CYP CZE EST HUN LVA LTU MLT POL SVK SVN', 2007: 'BGR ROU', 2013: 'HRV' }
const EURO = { 1999: 'AUT BEL DEU ESP FIN FRA IRL ITA LUX NLD PRT', 2001: 'GRC', 2007: 'SVN', 2008: 'CYP MLT', 2009: 'SVK', 2011: 'EST', 2014: 'LVA', 2015: 'LTU', 2023: 'HRV', 2026: 'BGR' }
const EURO_OHNE_EU = { abkommen: 'AND MCO SMR VAT', einseitig: 'MNE KOS' }
const SCHENGEN = { 1995: 'BEL DEU ESP FRA LUX NLD PRT', 1997: 'AUT ITA', 2000: 'GRC', 2001: 'DNK FIN ISL NOR SWE', 2007: 'CZE EST HUN LVA LTU MLT POL SVK SVN', 2008: 'CHE', 2011: 'LIE', 2023: 'HRV', 2025: 'BGR ROU' }
const NATO = { 1949: 'BEL DNK FRA GBR ISL ITA LUX NLD NOR PRT', 1952: 'GRC TUR', 1955: 'DEU', 1982: 'ESP', 1999: 'CZE HUN POL', 2004: 'BGR EST LVA LTU ROU SVK SVN', 2009: 'ALB HRV', 2017: 'MNE', 2020: 'MKD', 2023: 'FIN', 2024: 'SWE' }
const wave = y => (y < 1990 ? 'alt' : y < 2004 ? 'mitte' : y < 2010 ? 'ost' : 'neu')
function bundItems(prefix, table, what, extra = () => []) {
  return Object.entries(table).flatMap(([y, ids]) => ids.split(' ').map(id => land(id, {
    key: `${prefix}:${id}`, group: wave(+y),
    details: [{ label: what, value: y, big: true }, ...extra(id, +y)],
    text: { prompt: `Seit wann ist ${LAND[id].name} ${prefix === 'nato' ? 'in der NATO' : prefix === 'euro' ? 'beim Euro' : prefix === 'schengen' ? 'im Schengen-Raum' : 'in der EU'}?`, answer: y },
  })))
}
add('europa-eu', bundItems('eu', EU, 'EU-Mitglied seit', id => (id === 'DEU' ? [{ label: 'Hinweis', value: 'Seit 1958 (EWG), die neuen Länder seit 1990' }] : [])))
add('europa-euro', [
  ...bundItems('euro', EURO, 'Euro seit'),
  ...Object.entries(EURO_OHNE_EU).flatMap(([g, ids]) => ids.split(' ').map(id => land(id, {
    key: `euro:${id}`, group: g,
    details: [{ label: 'Euro', value: g === 'abkommen' ? 'Mit Abkommen mit der EU (eigene Münzen)' : 'Ohne Abkommen eingeführt', big: true }],
    text: { prompt: `Wie nutzt ${LAND[id].name} den Euro?`, answer: g === 'abkommen' ? 'Mit Abkommen' : 'Einseitig' },
  }))),
])
add('europa-schengen', bundItems('schengen', SCHENGEN, 'Im Schengen-Raum seit', (id, y) => [
  ...(['ISL', 'NOR', 'CHE', 'LIE'].includes(id) ? [{ label: 'Hinweis', value: 'Kein EU-Mitglied' }] : []),
  ...(y === 2025 ? [{ label: 'Hinweis', value: 'Luft- und Seegrenzen seit März 2024, Landgrenzen seit 1. Januar 2025' }] : []),
]))
add('europa-nato', bundItems('nato', NATO, 'NATO-Mitglied seit', id => (id === 'DEU' ? [{ label: 'Hinweis', value: '1955 die Bundesrepublik, seit 1990 das vereinte Deutschland' }] : [])))

/* ───────────── Kfz-Länderkennzeichen ───────────── */

// Internationale Unterscheidungszeichen (Wiener Übereinkommen) – Quelle: de.wikipedia.org/wiki/Liste_der_Kfz-Nationalitätszeichen
const KFZ = {
  DEU: 'D', AUT: 'A', CHE: 'CH', LIE: 'FL', FRA: 'F', ITA: 'I', ESP: 'E', PRT: 'P', GBR: 'UK', IRL: 'IRL', NLD: 'NL', BEL: 'B', LUX: 'L',
  DNK: 'DK', SWE: 'S', NOR: 'N', FIN: 'FIN', ISL: 'IS', POL: 'PL', CZE: 'CZ', SVK: 'SK', HUN: 'H', ROU: 'RO', BGR: 'BG', GRC: 'GR',
  SVN: 'SLO', HRV: 'HR', BIH: 'BIH', SRB: 'SRB', MNE: 'MNE', MKD: 'NMK', ALB: 'AL', KOS: 'RKS', MDA: 'MD', UKR: 'UA', BLR: 'BY',
  RUS: 'RUS', EST: 'EST', LVA: 'LV', LTU: 'LT', MLT: 'M', CYP: 'CY', AND: 'AND', MCO: 'MC', SMR: 'RSM', VAT: 'V', TUR: 'TR',
}
const KFZ_HINT = { GBR: 'Bis 2021 „GB“', MKD: 'Bis 2019 „MK“', LIE: 'Von „Fürstentum Liechtenstein“', SMR: 'Von „Repubblica di San Marino“', KOS: 'Von „Republika e Kosovës“', ESP: 'Von „España“', CHE: 'Von „Confoederatio Helvetica“' }
add('europa-kfz', Object.entries(KFZ).map(([id, z]) => land(id, {
  key: `kfz:${id}`, label: z, prompt: z, aliases: [], group: z.length === 1 ? 'eins' : z.length === 2 ? 'zwei' : 'drei',
  details: [{ label: 'Land', value: LAND[id].name, big: true }, ...(KFZ_HINT[id] ? [{ label: 'Gut zu wissen', value: KFZ_HINT[id] }] : [])],
  text: { prompt: `Kfz-Zeichen von ${LAND[id].name}?`, answer: z },
})))

/* ───────────── Amtssprachen ───────────── */

// Amtssprachen auf Staatsebene – Quelle: Verfassungen bzw. de.wikipedia.org/wiki/Liste_der_Amtssprachen
const SPRACHEN = {
  DEU: ['Deutsch', 'germ'], AUT: ['Deutsch', 'germ'], CHE: ['Deutsch, Französisch, Italienisch, Rätoromanisch', 'germ'], LIE: ['Deutsch', 'germ'],
  LUX: ['Luxemburgisch, Französisch, Deutsch', 'germ'], BEL: ['Niederländisch, Französisch, Deutsch', 'germ'], NLD: ['Niederländisch', 'germ'],
  GBR: ['Englisch', 'germ'], ISL: ['Isländisch', 'germ'], NOR: ['Norwegisch', 'germ'], SWE: ['Schwedisch', 'germ'], DNK: ['Dänisch', 'germ'],
  FRA: ['Französisch', 'rom'], MCO: ['Französisch', 'rom'], ITA: ['Italienisch', 'rom'], SMR: ['Italienisch', 'rom'], VAT: ['Italienisch, Latein', 'rom'],
  ESP: ['Spanisch', 'rom'], AND: ['Katalanisch', 'rom'], PRT: ['Portugiesisch', 'rom'], ROU: ['Rumänisch', 'rom'], MDA: ['Rumänisch', 'rom'],
  POL: ['Polnisch', 'slaw'], CZE: ['Tschechisch', 'slaw'], SVK: ['Slowakisch', 'slaw'], SVN: ['Slowenisch', 'slaw'], HRV: ['Kroatisch', 'slaw'],
  BIH: ['Bosnisch, Kroatisch, Serbisch', 'slaw'], SRB: ['Serbisch', 'slaw'], MNE: ['Montenegrinisch', 'slaw'], MKD: ['Mazedonisch, Albanisch', 'slaw'],
  BGR: ['Bulgarisch', 'slaw'], UKR: ['Ukrainisch', 'slaw'], BLR: ['Belarussisch, Russisch', 'slaw'], RUS: ['Russisch', 'slaw'],
  LVA: ['Lettisch', 'balt'], LTU: ['Litauisch', 'balt'],
  FIN: ['Finnisch, Schwedisch', 'ural'], EST: ['Estnisch', 'ural'], HUN: ['Ungarisch', 'ural'],
  IRL: ['Irisch, Englisch', 'andere'], MLT: ['Maltesisch, Englisch', 'andere'], GRC: ['Griechisch', 'andere'], CYP: ['Griechisch, Türkisch', 'andere'],
  ALB: ['Albanisch', 'andere'], KOS: ['Albanisch, Serbisch', 'andere'], TUR: ['Türkisch', 'andere'],
}
const SCHRIFT = { BGR: 'Kyrillisch', UKR: 'Kyrillisch', BLR: 'Kyrillisch', RUS: 'Kyrillisch', MKD: 'Kyrillisch', SRB: 'Kyrillisch und Lateinisch', MNE: 'Lateinisch und Kyrillisch', BIH: 'Lateinisch und Kyrillisch', GRC: 'Griechisch', CYP: 'Griechisch (Süden), Lateinisch (Türkisch)' }
add('europa-sprachen', Object.entries(SPRACHEN).map(([id, [s, fam]]) => land(id, {
  key: `spr:${id}`, group: fam,
  details: [{ label: s.includes(',') ? 'Amtssprachen' : 'Amtssprache', value: s, big: true }, { label: 'Schrift', value: SCHRIFT[id] ?? 'Lateinisch' }],
  text: { prompt: `Amtssprache${s.includes(',') ? 'n' : ''} von ${LAND[id].name}?`, answer: s },
})))

/* ───────────── Aus den Welt-Quizzes: Europa-Teil ───────────── */

const NAT = items('welt-natur'), ORTE = items('welt-orte')
const eu = list => list.filter(x => x.group === 'europa')
add('europa-gebirge', eu(NAT['welt-gebirge-schwer']).map(x => ({ ...x, group: 'alle' })))
add('europa-gebirge-schwer', eu(NAT['welt-gebirge-sehr-schwer']).map(x => ({ ...x, group: 'alle' })))
add('europa-gipfel', eu(NAT['welt-gebirge']).map(x => ({ ...x, group: 'alle' })))
add('europa-seen', eu(NAT['welt-seen-schwer']).map(x => ({ ...x, group: 'alle' })))
add('europa-millionenstaedte', eu(ORTE['welt-millionenstaedte']).map(x => ({ ...x, group: 'alle' })))
add('europa-hauptstaedte-schwer', eu(WL['welt-hauptstaedte-schwer']).map(x => ({ ...x, group: 'alle' })))
add('europa-vorwahlen', eu(WL['welt-vorwahlen']).map(x => ({ ...x, group: 'alle' })))
add('europa-domains', eu(WL['welt-domains']).map(x => ({ ...x, group: 'alle' })))
add('europa-binnenstaaten', eu(WL['welt-binnenstaaten']).map(x => ({ ...x, group: 'alle' })))

// Meere: alle Meere/Buchten der feinsten Stufe, deren Mitte im Europa-Ausschnitt liegt
const MEERE = layer('meere-3')
const meerMitte = Object.fromEntries(MEERE.f.map(f => [f.i, f.c ?? geoCentroid(f.g)]))
const inEuropa = ([x, y]) => x > -25 && x < 45 && y > 34 && y < 72
add('europa-meere', NAT['welt-ozeane-sehr-schwer'].filter(x => {
  const id = x.areas?.[0]?.split(':')[1]
  return id && id !== 'kangertittivaq' && meerMitte[id] && inEuropa(meerMitte[id])
}).map(x => {
  const [lon, lat] = meerMitte[x.areas[0].split(':')[1]]
  const group = lat > 66 ? 'arktis' : lon > 27 && lat > 40 && lat < 48 ? 'schwarz' : lat < 46.5 && lon > -6 && !(lat > 43 && lon < 0) ? 'mittelmeer' : lon > 9.5 && lon < 32 && lat > 53 ? 'ostsee' : 'atlantik'
  return { ...x, group }
}))

/* ───────────── Inseln (Natural Earth) ───────────── */

const SKIP = new Set(['Britische Inseln', 'Balearische Inseln', 'Pico', 'Terceira', 'Santa Maria', 'São Miguel', 'Flores', 'Jan Mayen'])
const RAW = readJson(path.join(SRC, 'ne_10m_geography_regions_polys.geojson')).features.filter(f => {
  const p = Object.fromEntries(Object.entries(f.properties).map(([k, v]) => [k.toLowerCase(), v]))
  if (!['Island', 'Island group'].includes(p.featurecla)) return false
  const [x, y] = geoCentroid(f.geometry)
  return x > -32 && x < 45 && y > 34 && y < 72 && !SKIP.has(p.name_de || p.name)
})
const inp = path.join(TMP, 'inseln-in.json'), out = path.join(TMP, 'inseln-out.json')
fs.writeFileSync(inp, JSON.stringify({ type: 'FeatureCollection', features: RAW.map(f => {
  const p = Object.fromEntries(Object.entries(f.properties).map(([k, v]) => [k.toLowerCase(), v]))
  return { type: 'Feature', properties: { id: slug(p.name_de || p.name), name: p.name_de || p.name, en: p.name_en || p.name, kind: p.featurecla }, geometry: f.geometry }
}) }))
// Inselgruppen sind in Natural Earth Umriss-Flächen inkl. Meer → mit der Landfläche beschneiden
const landEu = path.join(TMP, 'land-eu.json')
if (!fs.existsSync(landEu)) execSync(`mapshaper "${path.join(SRC, 'ne_10m_land.geojson')}" -clip bbox=-35,30,45,75 -o "${landEu}" format=geojson`, { stdio: ['ignore', 'ignore', 'inherit'] })
execSync(`mapshaper "${inp}" -clip "${landEu}" -simplify 25% weighted keep-shapes -o "${out}" format=geojson precision=0.001`, { stdio: ['ignore', 'ignore', 'inherit'] })
const ISL = readJson(out).features.map(f => ({ ...f, geometry: rewind(f.geometry) }))
const WEU = layer('world-eu')
const landAt = pt => WEU.f.find(f => geoContains(f.g, pt))?.i
fs.writeFileSync(path.join(root, 'public/geo/layers/eu-inseln.json'), JSON.stringify({ id: 'eu-inseln', f: ISL.map(f => ({ i: f.properties.id, g: rewind(f.geometry) })) }))
add('europa-inseln', ISL.map(f => {
  const g = f.geometry, [x, y] = geoCentroid(g)
  let owner = landAt([x, y])
  if (!owner) { const b = geoBounds(g); owner = landAt([(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2]) }
  // Inselgruppen: Mittelpunkt liegt oft im Meer
  const FEST = { 'Färöer': 'DNK', 'Fasta Åland': 'FIN', Azoren: 'PRT', 'Ionische Inseln': 'GRC', Kykladen: 'GRC', Lesbos: 'GRC', Orkney: 'GBR' }
  owner = FEST[f.properties.name] ?? owner
  const meer = y < 46.5 && x > -6 ? 'mittelmeer' : y > 53.5 && x > 9.5 && x < 30 && y < 66 ? 'ostsee' : 'atlantik'
  const ownerName = f.properties.name === 'Friesische Inseln' ? 'Niederlande, Deutschland, Dänemark' : owner ? (LAND[owner]?.name ?? owner) : null
  return {
    key: `insel:${f.properties.id}`, label: f.properties.name, aliases: f.properties.en !== f.properties.name ? [f.properties.en] : [], group: meer,
    areas: [`eu-inseln:${f.properties.id}`],
    details: [{ label: 'Art', value: f.properties.kind === 'Island group' ? 'Inselgruppe' : 'Insel' }, ...(ownerName ? [{ label: 'Gehört zu', value: ownerName, big: true }] : [])],
    ...(ownerName ? { text: { prompt: `Zu welchem Land gehört: ${f.properties.name}?`, answer: ownerName } } : {}),
  }
}).sort((a, b) => a.label.localeCompare(b.label, 'de')))

/* ───────────── Schreiben ───────────── */

fs.writeFileSync(path.join(root, 'public/geo/items/europa-extra.json'), JSON.stringify(OUT))
const counts = Object.fromEntries(Object.entries(OUT).map(([k, v]) => [k, v.length]))
fs.writeFileSync(path.join(root, 'app/geo/_data/europa-extra.ts'),
  `// Erzeugt von scripts/geo/build-europa-extra.mjs – nicht von Hand bearbeiten.\n\nexport const EUROPA_EXTRA_COUNTS: Record<string, number> = ${JSON.stringify(counts, null, 2)}\n`)
fs.writeFileSync(path.join(root, 'app/geo/_data/flaggen-regionen.ts'),
  `// Erzeugt von scripts/geo/build-europa-extra.mjs – nicht von Hand bearbeiten.\n\n/** Fläche ("ebene:id") → Schlüssel der Regionsflagge in public/geo/flags-regions.json */\nexport const REGION_FLAG_OF: Record<string, string> = ${JSON.stringify(Object.fromEntries(Object.entries(CODES).map(([k, v]) => [k, `r:${v}`])))}\n`)
console.log(`items/europa-extra.json ${(fs.statSync(path.join(root, 'public/geo/items/europa-extra.json')).size / 1024).toFixed(0)} KB`)
