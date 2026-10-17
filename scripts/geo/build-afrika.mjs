// Baut die Afrika-Quizzes von seekclan.de/geo: Länder, Hauptstädte, Flaggen und Umrisse in vier Stufen, alle Regionen,
// Provinzen aller 54 Länder (dazu Hauptorte), zweite Verwaltungsebene der GeoGuessr-Länder, Flüsse, Seen, Berge, Gebirge,
// Wüsten, Inseln, Vulkane, Wasserfälle, Nationalparks, Welterbe, Städte und Millionenstädte, Wissens- und Geschichts-Quizzes.
//
// Nur für Entwicklung – wird NICHT beim normalen `npm run build` ausgeführt. Ergebnis liegt fertig im Repo:
//   public/geo/layers/af-*.json                Karten-Ebenen
//   public/geo/items/afrika-*.json             Einträge (je Bereich eine Datei)
//   public/geo/afrika/umrisse/<ISO3>.svg       Umrisse der Länder (eigene Zeichnung aus Natural Earth)
//   app/geo/_data/afrika.ts                    Alle Quiz-Definitionen (Titel, Texte, Ebenen, Gruppen, Anzahl)
//
// Benötigt (einmalig):  npm i -g mapshaper
// Quellen (Ordner GEO_SRC, Standard /home/claude/geo-src):
//  - Natural Earth 1:10m (gemeinfrei): admin_0 (deu), admin_1, populated_places, rivers_lake_centerlines, lakes,
//    geography_regions_polys, geography_regions_elevation_points, geography_marine_polys
//  - geoBoundaries gbOpen ADM1/ADM2 (CC BY 4.0, github.com/wmgeolab/geoBoundaries) → af/gb/<ISO3>-ADM1.geojson
//  - Wikidata (CC0): ISO-3166-2-Codes, deutsche Namen und Hauptorte der Provinzen → af/wd/adm-codes.json;
//    Nationalparks, Wasserfälle, Vulkane, UNESCO-Welterbe → af/wd/nat.json
//  - Wikipedia „List of cities in Africa by population“ (Stand 2026, CC BY-SA 4.0) → af/wp/staedte.json
//  - Von Hand: scripts/geo/afrika-daten.mjs
// Danach:  node scripts/geo/build-afrika.mjs

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { geoArea, geoCentroid, geoLength, geoBounds } from 'd3-geo'
import * as D from './afrika-daten.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const SRC = process.env.GEO_SRC || '/home/claude/geo-src'
const AF = path.join(SRC, 'af')
const TMP = path.join(SRC, 'tmp-afrika')
const OUT_LAYERS = path.join(root, 'public/geo/layers')
const OUT_ITEMS = path.join(root, 'public/geo/items')
const OUT_SVG = path.join(root, 'public/geo/afrika/umrisse')
for (const d of [TMP, OUT_LAYERS, OUT_ITEMS, OUT_SVG]) fs.mkdirSync(d, { recursive: true })

const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'))
const ms = args => execSync(`mapshaper ${args}`, { stdio: ['ignore', 'ignore', 'inherit'] })
const warn = (...a) => console.warn('  !', ...a)
const de = n => Math.round(n).toLocaleString('de-DE')
const r4 = n => Math.round(n * 1e4) / 1e4
function slug(s) {
  return String(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x'
}
const norm = s => slug(s).replace(/-/g, '')
/** Ähnlichkeit zweier Wörter (1 = gleich), nach Levenshtein */
function sim(a, b) {
  const m = a.length, n = b.length
  if (!m || !n) return 0
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return 1 - prev[n] / Math.max(m, n)
}
function rewind(g) {
  if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) return g
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  const fixed = polys.map(rings => (geoArea({ type: 'Polygon', coordinates: rings }) > 2 * Math.PI ? rings.map(r => [...r].reverse()) : rings))
  return g.type === 'Polygon' ? { type: 'Polygon', coordinates: fixed[0] } : { type: 'MultiPolygon', coordinates: fixed }
}
function writeLayer(id, features) {
  const file = path.join(OUT_LAYERS, `${id}.json`)
  fs.writeFileSync(file, JSON.stringify({ id, f: features.map(f => ({ ...f, g: rewind(f.g) })) }))
  return fs.statSync(file).size
}
const F = (id, geometry) => ({ type: 'Feature', properties: { id }, geometry })
let layerBytes = 0
/** Flächen mit gleicher id verschmelzen und vereinfachen → Ebene (overlap: Flächen dürfen sich überlappen) */
function dissolveLayer(id, features, interval = 600, overlap = false, erase = null) {
  const inp = path.join(TMP, `${id}-in.json`), out = path.join(TMP, `${id}-out.json`)
  fs.writeFileSync(inp, JSON.stringify({ type: 'FeatureCollection', features }))
  const er = erase ? ` -erase "${erase}"` : ''
  if (!overlap) ms(`"${inp}" -dissolve id gap-width=1km${er} -simplify interval=${interval} keep-shapes -o "${out}" format=geojson precision=0.0001`)
  else ms(`"${inp}"${er} -simplify interval=${interval} keep-shapes no-repair -o "${out}" format=geojson precision=0.0001`)
  const byId = new Map()
  for (const f of readJson(out).features) {
    if (!f.geometry) continue
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
    byId.set(f.properties.id, [...(byId.get(f.properties.id) ?? []), ...polys])
  }
  const res = [...byId].map(([i, polys]) => ({ i, g: polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys } }))
  layerBytes += writeLayer(id, res)
  return new Map(res.map(f => [f.i, f.g]))
}
function lineLayer(id, features, interval = 500) {
  const inp = path.join(TMP, `${id}-in.json`), out = path.join(TMP, `${id}-out.json`)
  fs.writeFileSync(inp, JSON.stringify({ type: 'FeatureCollection', features }))
  ms(`"${inp}" -simplify interval=${interval} -o "${out}" format=geojson precision=0.0001`)
  const byId = new Map()
  for (const f of readJson(out).features) {
    if (!f.geometry) continue
    const lines = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates
    byId.set(f.properties.id, [...(byId.get(f.properties.id) ?? []), ...lines])
  }
  const feats = [...byId].map(([i, lines]) => ({ i, g: { type: 'MultiLineString', coordinates: lines } }))
  layerBytes += writeLayer(id, feats)
  return new Map(feats.map(f => [f.i, f.g]))
}
function bbox(g) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  const walk = c => { if (!c?.length) return; if (typeof c[0] === 'number') { x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]); y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]) } else c.forEach(walk) }
  walk(g.coordinates ?? g)
  return [x0, y0, x1, y1]
}
/** Kartenausschnitt mit Rand; hohe, schmale Länder seitlich verbreitern (höchstens 1,45-mal so hoch wie breit) */
function frameOf([x0, y0, x1, y1], pad = 0.06) {
  const w = x1 - x0, h = y1 - y0
  let a = [x0 - w * pad, y0 - h * pad], b = [x1 + w * pad, y1 + h * pad]
  const k = Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180)
  const need = (b[1] - a[1]) / (1.45 * k)
  if (b[0] - a[0] < need) { const m = (a[0] + b[0]) / 2; a = [m - need / 2, a[1]]; b = [m + need / 2, b[1]] }
  return [[r4(a[0]), r4(a[1])], [r4(b[0]), r4(b[1])]]
}

/* ───────────── Quellen ───────────── */

const ADM0 = readJson(path.join(SRC, 'ne_10m_admin_0_countries_deu.geojson')).features
const NE1 = readJson(path.join(SRC, 'ne_10m_admin_1_states_provinces.geojson')).features
const PLACES = readJson(path.join(SRC, 'ne_10m_populated_places.geojson')).features.map(f => f.properties)
const RIVERS = readJson(path.join(SRC, 'ne_10m_rivers_lake_centerlines.geojson')).features
const LAKES = readJson(path.join(SRC, 'ne_10m_lakes.geojson')).features
const GEO = readJson(path.join(SRC, 'ne_10m_geography_regions_polys.geojson')).features
const MARINE = readJson(path.join(SRC, 'ne_10m_geography_marine_polys.geojson')).features
const WD = readJson(path.join(AF, 'wd/adm-codes.json'))
const NAT = readJson(path.join(AF, 'wd/nat.json'))
const WP_STAEDTE = readJson(path.join(AF, 'wp/staedte.json'))
const CC = readJson(path.join(SRC, 'countries.json'))
const WORLD = readJson(path.join(root, 'public/geo/layers/world.json'))
const FLAGS = readJson(path.join(root, 'public/geo/flags.json'))

// Länder (Namen, Regionen, Hauptstädte) aus app/geo/_data/world.ts
const worldTs = fs.readFileSync(path.join(root, 'app/geo/_data/world.ts'), 'utf8')
const COUNTRIES = JSON.parse(worldTs.match(/export const COUNTRIES: WorldCountry\[\] = (\[.*\])/)[1])
const AFR = COUNTRIES.filter(c => c.continents.includes('afrika'))
const ISOS = AFR.map(c => c.id)
const C3 = Object.fromEntries(AFR.map(c => [c.id, c]))
const NAME = Object.fromEntries(AFR.map(c => [c.id, c.name]))
const ISO2 = Object.fromEntries(CC.map(c => [c.cca3, c.cca2.toLowerCase()]))
ISO2.SDS = 'ss'
const flagOf = iso => (FLAGS[ISO2[iso]] ? ISO2[iso] : undefined)
const REGION = { nord: 'Nordafrika', west: 'Westafrika', zentral: 'Zentralafrika', ost: 'Ostafrika', sued: 'Südliches Afrika' }
const REGION_COLOR = { nord: 'ochre', west: 'terra', zentral: 'green', ost: 'teal', sued: 'indigo' }
const REG_GROUPS = Object.fromEntries(Object.entries(REGION).map(([k, n]) => [k, [n, REGION_COLOR[k]]]))
const WORLD_G = Object.fromEntries(WORLD.f.map(f => [f.i, f.g]))
const AF_FRAME = [[-26, -36], [60, 38]]

// Punkt-in-Land über Natural Earth admin_0 (mit Westsahara und Somalia inkl. Somaliland)
const ADM0_AF = ADM0.filter(f => [...ISOS, 'SAH'].includes(f.properties.ADM0_A3)).map(f => ({ iso: f.properties.ADM0_A3, g: f.geometry, b: bbox(f.geometry) }))
function inPoly(lon, lat, g) {
  const inRing = ring => {
    let inside = false
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j]
      if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
    }
    return inside
  }
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  return polys.some(p => inRing(p[0]) && !p.slice(1).some(inRing))
}
function countryAt(lon, lat) {
  for (const c of ADM0_AF) if (lon >= c.b[0] && lon <= c.b[2] && lat >= c.b[1] && lat <= c.b[3] && inPoly(lon, lat, c.g)) return c.iso
  return null
}
const nearCountry = (lon, lat) => countryAt(lon, lat) ?? countryAt(lon + 0.05, lat) ?? countryAt(lon - 0.05, lat) ?? countryAt(lon, lat + 0.05) ?? countryAt(lon, lat - 0.05)
const SAH_FILE = path.join(TMP, 'sah.json')
fs.writeFileSync(SAH_FILE, JSON.stringify({ type: 'FeatureCollection', features: ADM0.filter(f => f.properties.ADM0_A3 === 'SAH') }))
const inAfrica = b => b[2] > -26 && b[0] < 64 && b[3] > -47 && b[1] < 38

/* ───────────── Sammeln ───────────── */

const ITEMS = {}
const DEFS = []
const STATS = {}
/**
 * Quiz anlegen. file = Datei unter public/geo/items (afrika-<file>.json).
 * groups: { key: [Name, Farbname aus palette.ts] } · ask: [Klick, Name, Text?]
 */
function quiz(d, items, file) {
  if (!items.length) { warn('leer – übersprungen:', d.slug); return }
  if (DEFS.some(x => x.slug === d.slug)) throw new Error(`doppelter slug ${d.slug}`)
  const keys = new Set()
  for (const it of items) { if (keys.has(it.key)) throw new Error(`${d.slug}: doppelter key ${it.key}`); keys.add(it.key) }
  const f = `afrika-${file}`
  ITEMS[f] = ITEMS[f] ?? {}
  ITEMS[f][d.slug] = items
  DEFS.push({ ...d, file: f, count: items.length, meta: d.meta.replace('#', items.length.toLocaleString('de-DE')) })
  STATS[d.section] = (STATS[d.section] ?? 0) + 1
}
/** Lernkarten-Deck (special 'schrift') */
const DECK_META = {}
function deck(d, cards, meta, file = 'karten') {
  if (!cards.length) { warn('leeres Deck:', d.slug); return }
  const f = `afrika-${file}`
  ITEMS[f] = ITEMS[f] ?? {}
  ITEMS[f][d.slug] = cards
  ;(DECK_META[f] = DECK_META[f] ?? {})[d.slug] = meta
  DEFS.push({ ...d, special: 'schrift', file: f, count: cards.length, combinable: false, meta: d.meta.replace('#', cards.length.toLocaleString('de-DE')), layers: [], groups: {}, ask: ['Welches Land?', 'Welches Land?'], noun: 'Karten' })
  STATS[d.section] = (STATS[d.section] ?? 0) + 1
}

/* ════════════════════════ 1. Grundgerüst ════════════════════════ */

console.log('Grundgerüst')
const S_LH = 'Länder & Hauptstädte'
const S_FL = 'Flaggen & Umrisse'
const S_REG = 'Regionen Afrikas'
const STUFEN = [['leicht', 'Leicht'], ['mittel', 'Mittel'], ['schwer', 'Schwer'], ['sehr-schwer', 'Sehr schwer']]
const byArea = [...AFR].sort((a, b) => geoArea(WORLD_G[b.id] ?? { type: 'Polygon', coordinates: [] }) - geoArea(WORLD_G[a.id] ?? { type: 'Polygon', coordinates: [] }))
const byPop = [...AFR].sort((a, b) => (b.pop ?? 0) - (a.pop ?? 0))
/** Rang aus Fläche + Einwohner, die bekannten zuerst */
const bekannt = [...AFR].sort((a, b) => {
  const s = c => (D.LAENDER_LEICHT.includes(c.id) ? -100 : 0) + byArea.indexOf(c) + byPop.indexOf(c)
  return s(a) - s(b)
})
const STUFE_N = { leicht: 20, mittel: 36, schwer: 54 }
const countryDetails = c => {
  const L = D.LAND[c.id]
  return [
    { label: 'Hauptstadt', value: c.capital },
    { label: 'Region', value: REGION[c.region] },
    { label: 'Einwohner', value: c.pop ? (c.pop >= 1e6 ? `${(c.pop / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio.` : de(c.pop)) : '–' },
    { label: 'Amtssprache', value: L.sp.join(', ') },
  ]
}
const landItem = (c, prefix = 'land') => ({
  key: `${prefix}:${c.id}`, label: c.name, group: c.region, areas: [`world:${c.id}`], aliases: c.aliases, flag: flagOf(c.id), iso: c.id,
  details: countryDetails(c), text: { prompt: `Hauptstadt von ${c.name}?`, answer: c.capital },
})
const W = { layers: ['world'], frame: AF_FRAME, groups: REG_GROUPS }

for (const [st, name] of STUFEN) {
  const list = st === 'sehr-schwer' ? AFR : bekannt.slice(0, STUFE_N[st])
  const txt = {
    leicht: 'Die 20 bekanntesten und größten Länder Afrikas – der Einstieg.',
    mittel: '36 Länder – dazu die mittelgroßen Staaten West- und Ostafrikas.',
    schwer: 'Alle 54 Staaten Afrikas – auch die kleinen wie Eswatini, Dschibuti oder Gambia.',
    'sehr-schwer': 'Alle 54 Staaten ohne Hilfe: nur Eintippen und Karte – dazu die Inselgebiete Réunion, Mayotte und St. Helena.',
  }[st]
  if (st !== 'schwer') {
    const items = list.map(c => landItem(c))
    if (st === 'sehr-schwer') {
      for (const [id, layer, n, owner, fl] of D.GEBIETE) items.push({ key: `gebiet:${id}`, label: n, group: 'gebiet', areas: [`${layer}:${id}`], flag: FLAGS[fl] ? fl : undefined, details: [{ label: 'Gehört zu', value: owner }] })
    }
    quiz({
      slug: `afrika-laender-${st}`, title: `Länder Afrikas (${name})`, meta: `# Länder · ${name}`, text: txt, kind: 'laender', section: S_LH, difficulty: st,
      ...W, ...(st === 'sehr-schwer' ? { layers: ['world', 'gebiete'], groups: { ...REG_GROUPS, gebiet: ['Überseegebiet', 'slate'] } } : {}),
      noun: 'Länder', ask: ['Wo liegt das Land?', 'Welches Land ist markiert?', 'Welche Hauptstadt?'],
      intro: 'Lernmodus – tippe auf ein Land für Hauptstadt, Region und Sprache.',
    }, items, 'grund')
  }
  // Hauptstädte (Stufe Schwer = das schon vorhandene Quiz „Hauptstädte Afrikas“)
  const caps = list.filter(c => c.cap)
  if (st !== 'schwer') quiz({
    slug: `afrika-hauptstaedte-${st}`, title: `Hauptstädte Afrikas (${name})`, meta: `# Hauptstädte · ${name}`, kind: 'hauptstaedte', section: S_LH, difficulty: st,
    text: {
      leicht: 'Kairo, Nairobi, Pretoria & Co. – die Hauptstädte der 20 bekanntesten Länder.',
      mittel: '36 Hauptstädte – von Rabat bis Maputo.',
      schwer: 'Alle 54 Hauptstädte – auch Gitega, Yamoussoukro und Porto-Novo.',
      'sehr-schwer': 'Alle 54 Hauptstädte nur als Punkte – keine Landesgrenzen als Hilfe.',
    }[st],
    ...W, noun: 'Hauptstädte', ask: ['Wo liegt die Hauptstadt?', 'Welche Hauptstadt ist markiert?', 'Welches Land?'],
    tip: st === 'schwer' ? { title: 'Vorsicht', text: 'Nicht immer ist die größte Stadt die Hauptstadt: Lagos, Abidjan, Daressalam, Casablanca, Douala und Cotonou sind es nicht.' } : undefined,
  }, caps.map(c => ({
    key: st === 'sehr-schwer' ? `hsp:${c.id}` : `hs:${c.id}`, label: c.capital, prompt: c.capital, group: c.region, iso: c.id,
    ...(st === 'sehr-schwer' ? { point: [r4(c.cap[0]), r4(c.cap[1])] } : { areas: [`world:${c.id}`], point: [r4(c.cap[0]), r4(c.cap[1])], promptSub: 'Tippe auf das Land' }),
    details: [{ label: 'Land', value: c.name, big: true }, { label: 'Region', value: REGION[c.region] }],
    text: { prompt: `${c.capital} ist die Hauptstadt von …`, answer: c.name },
  })), 'grund')
  // Flaggen
  quiz({
    slug: `afrika-flaggen-${st}`, title: `Flaggen Afrikas (${name})`, meta: `# Flaggen · ${name}`, kind: 'flaggen', section: S_FL, difficulty: st,
    text: {
      leicht: 'Die Flaggen der 20 bekanntesten Länder Afrikas.',
      mittel: '36 Flaggen – viele mit Grün, Gelb und Rot.',
      schwer: 'Alle 54 Flaggen Afrikas – Mali oder Guinea? Tschad oder … ?',
      'sehr-schwer': 'Alle 54 Flaggen nur zum Eintippen – Verwechslungsgefahr: Mali/Guinea/Senegal, Tschad, Niger/Indien-ähnlich, Kongo.',
    }[st],
    ...W, noun: 'Flaggen', ask: ['Zu welchem Land gehört die Flagge?', 'Welche Flagge hat das markierte Land?', 'Flagge erkennen'],
    tip: st === 'mittel' ? { title: 'Panafrikanische Farben', text: 'Grün, Gelb und Rot gehen auf die Flagge Äthiopiens zurück – des einzigen Landes, das nie Kolonie war. Ghana hat sie 1957 als erstes übernommen.' } : undefined,
  }, list.filter(c => flagOf(c.id)).map(c => ({
    key: `flagge:${c.id}`, label: c.name, aliases: c.aliases, group: c.region, areas: [`world:${c.id}`], flag: flagOf(c.id), flagPrompt: true, iso: c.id,
    details: [{ label: 'Hauptstadt', value: c.capital }, { label: 'Region', value: REGION[c.region] }],
    text: { prompt: 'Welches Land hat diese Flagge?', answer: c.name },
  })), 'grund')
}

// Regionen Afrikas: Länder, Hauptstädte, Flaggen je Region
for (const [rk, rn] of Object.entries(REGION)) {
  const list = AFR.filter(c => c.region === rk)
  const b = list.reduce((acc, c) => { const x = bbox(WORLD_G[c.id]); return [Math.min(acc[0], x[0]), Math.min(acc[1], x[1]), Math.max(acc[2], x[2]), Math.max(acc[3], x[3])] }, [Infinity, Infinity, -Infinity, -Infinity])
  // Inseln weit draußen (Kap Verde, Seychellen, Mauritius) machen die Karte winzig → Rahmen nur wenig weiten
  const frame = frameOf(b, 0.04)
  const base = { layers: ['world'], frame, groups: { [rk]: [rn, REGION_COLOR[rk]] }, section: S_REG, labelSize: 8 }
  quiz({ ...base, slug: `afrika-${rk}-laender`, title: `${rn} – Länder`, meta: '# Länder', kind: 'laender', difficulty: 'leicht', text: `Alle Länder von ${rn}: ${list.slice(0, 4).map(c => c.name).join(', ')} …`, noun: 'Länder', ask: ['Wo liegt das Land?', 'Welches Land ist markiert?', 'Welche Hauptstadt?'] },
    list.map(c => ({ ...landItem(c), group: rk })), 'grund')
  quiz({ ...base, slug: `afrika-${rk}-hauptstaedte`, title: `${rn} – Hauptstädte`, meta: '# Hauptstädte', kind: 'hauptstaedte', difficulty: 'mittel', text: `Die Hauptstädte von ${rn}.`, noun: 'Hauptstädte', ask: ['Wo liegt die Hauptstadt?', 'Welche Hauptstadt ist markiert?', 'Welches Land?'] },
    list.filter(c => c.cap).map(c => ({ key: `hs:${c.id}`, label: c.capital, prompt: c.capital, group: rk, areas: [`world:${c.id}`], point: [r4(c.cap[0]), r4(c.cap[1])], iso: c.id, details: [{ label: 'Land', value: c.name, big: true }], text: { prompt: `${c.capital} ist die Hauptstadt von …`, answer: c.name } })), 'grund')
  quiz({ ...base, slug: `afrika-${rk}-flaggen`, title: `${rn} – Flaggen`, meta: '# Flaggen', kind: 'flaggen', difficulty: 'mittel', text: `Die Flaggen von ${rn}.`, noun: 'Flaggen', ask: ['Zu welchem Land gehört die Flagge?', 'Welche Flagge hat das markierte Land?', 'Flagge erkennen'] },
    list.filter(c => flagOf(c.id)).map(c => ({ key: `flagge:${c.id}`, label: c.name, aliases: c.aliases, group: rk, areas: [`world:${c.id}`], flag: flagOf(c.id), flagPrompt: true, iso: c.id, details: [{ label: 'Hauptstadt', value: c.capital }], text: { prompt: 'Welches Land hat diese Flagge?', answer: c.name } })), 'grund')
}

// Umrisse (eigene SVG-Zeichnungen aus der Welt-Ebene)
console.log('Umrisse')
function silhouette(iso) {
  const g = WORLD_G[iso]
  if (!g) return null
  let polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  // weit entfernte Inseln weglassen (außer bei Inselstaaten)
  if (!D.LAND[iso].insel && polys.length > 1) {
    const big = polys.reduce((a, p) => (geoArea({ type: 'Polygon', coordinates: p }) > geoArea({ type: 'Polygon', coordinates: a }) ? p : a))
    const [cx, cy] = geoCentroid({ type: 'Polygon', coordinates: big })
    polys = polys.filter(p => { const [x, y] = geoCentroid({ type: 'Polygon', coordinates: p }); return Math.hypot(x - cx, y - cy) < 12 })
  }
  const [x0, y0, x1, y1] = bbox(polys)
  const k = Math.cos((((y0 + y1) / 2) * Math.PI) / 180)
  const w = (x1 - x0) * k, h = y1 - y0
  const s = 180 / Math.max(w, h)
  const pts = polys.map(rings => rings.map(r => 'M' + r.map(([x, y]) => `${((x - x0) * k * s + 10).toFixed(1)},${((y1 - y) * s + 10).toFixed(1)}`).join('L') + 'Z').join('')).join('')
  const W2 = Math.round(w * s + 20), H2 = Math.round(h * s + 20)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W2} ${H2}" width="${W2}" height="${H2}"><path d="${pts}" fill="#d9774b" fill-rule="evenodd" stroke="#f3c9a8" stroke-width="1.5" stroke-linejoin="round"/></svg>`
}
for (const c of AFR) { const svg = silhouette(c.id); if (svg) fs.writeFileSync(path.join(OUT_SVG, `${c.id}.svg`), svg) }
const umrissCard = (c, slugName) => ({ key: `${slugName}:${c.id}`, c: `Umriss ${c.name}`, a: c.name, g: c.region, flag: flagOf(c.id), img: `/geo/afrika/umrisse/${c.id}.svg`, n: `${REGION[c.region]} · Hauptstadt ${c.capital}` })
const UMRISS_META = { kind: 'words', withFlags: true, noWrite: true, imgDeck: true, ask: 'Welches Land hat diesen Umriss?', groups: Object.entries(REGION).map(([k, name]) => ({ k, name })), tips: ['Achte auf Küsten, gerade Grenzlinien und Inseln.', 'Gambia steckt wie ein Finger im Senegal – Lesotho liegt mitten in Südafrika.'] }
for (const [st, name] of STUFEN) {
  const list = st === 'sehr-schwer' ? AFR : bekannt.slice(0, STUFE_N[st])
  const s = `afrika-umrisse-${st}`
  deck({ slug: s, title: `Umrisse Afrikas (${name})`, meta: `# Umrisse · ${name}`, kind: 'laender', section: S_FL, difficulty: st, text: `Welches Land hat diesen Umriss? ${st === 'sehr-schwer' ? 'Alle 54 – auch die kleinen Inselstaaten.' : `${list.length} Länder.`}` },
    list.filter(c => WORLD_G[c.id]).map(c => umrissCard(c, s)), UMRISS_META)
}

for (const [rk, rn] of Object.entries(REGION)) {
  const s = `afrika-${rk}-umrisse`
  deck({ slug: s, title: `${rn} – Umrisse`, meta: '# Umrisse', kind: 'laender', section: S_REG, difficulty: 'mittel', text: `Welches Land von ${rn} hat diesen Umriss?` },
    AFR.filter(c => c.region === rk && WORLD_G[c.id]).map(c => umrissCard(c, s)), UMRISS_META)
}

/* ════════════════════════ 2. Provinzen (ADM1) ════════════════════════ */

console.log('Provinzen')
const S_ADM = 'Provinzen & Regionen'
const wdByCode = new Map()
for (const r of WD) {
  const [q, code, de, en, capDe, capEn, coord, end] = r
  const old = wdByCode.get(code)
  if (!old || (old.end && !end) || (!old.capDe && capDe)) wdByCode.set(code, { q, code, de, en, capDe, capEn, coord, end })
}
const PREFIX = /^(Gouvernorat|Gouvernement|Bezirk|Governorate|Provinz|Province|Wilaya|Region|Région|Distrikt|District|Departement|Département|Department|Bundesstaat|Präfektur|Préfecture|Sha'biyah|Munizip|Kreis)\s+(of\s+|de\s+|du\s+|d'|de la\s+)?/i
const SUFFIX = /(\s+|-)(Governorate|Gouvernement|County|Region|Province|Provinz|District|Distrikt|Department|Prefecture|Municipality|Regional State)$/i
function cleanName(n) {
  const orig = String(n ?? '').trim()
  if (D.NAME_FIX[orig]) return D.NAME_FIX[orig]
  let s = orig.replace(/\s*\((Region|Provinz|Distrikt|County|Ghana|Kenia|Namibia|Bundesstaat|Präfektur)\)$/i, '')
  for (let i = 0; i < 2; i++) s = s.replace(PREFIX, '').replace(SUFFIX, '')
  s = s.trim()
  // „Region der südlichen …“ → nicht kleingeschrieben beginnen lassen
  if (!s || /^[a-zäöü]/.test(s) && !/^(al|an|ad|as|asch|az|ar|at|el)-/.test(s)) return orig
  return D.NAME_FIX[s] ?? s
}
/** Hauptort aus Natural-Earth-Orten (Admin-1-Hauptstädte in der Fläche, sonst größter Ort) */
function capFromPlaces(iso, g) {
  const b = bbox(g)
  const cand = PLACES.filter(p => p.ADM0_A3 === iso && p.LONGITUDE >= b[0] && p.LONGITUDE <= b[2] && p.LATITUDE >= b[1] && p.LATITUDE <= b[3] && inPoly(p.LONGITUDE, p.LATITUDE, g))
  const caps = cand.filter(p => p.FEATURECLA === 'Admin-1 capital' || p.ADM0CAP)
  const best = (caps.length ? caps : []).sort((a, z) => z.POP_MAX - a.POP_MAX)[0]
  return best ? { name: best.NAME_DE || best.NAME, ll: [r4(best.LONGITUDE), r4(best.LATITUDE)] } : null
}
const ADM_SHAPES = {}
const ADM_ITEMS = {}
for (const iso of ISOS) {
  const cfg = D.ADM[iso]
  if (!cfg) { warn('keine ADM-Einstellung für', iso); continue }
  let raw
  if (cfg.src === 'gb') {
    const file = path.join(AF, 'gb', `${cfg.gb ?? iso}-ADM1.geojson`)
    const fixCode = c => {
      if (!c || c === 'N/A') return ''
      if (/^[A-Z]{2}-/.test(c)) return c
      if (/^[A-Z0-9]{1,3}$/.test(c)) return D.CODE_FIX[iso]?.[c] ?? `${ISO2[iso].toUpperCase()}-${c}`
      return ''
    }
    raw = readJson(file).features.map(f => ({ name: f.properties.shapeName, code: fixCode(f.properties.shapeISO), g: f.geometry }))
  } else {
    raw = NE1.filter(f => f.properties.adm0_a3 === iso).map(f => ({ name: f.properties.name, code: f.properties.iso_3166_2, deNe: f.properties.name_de, g: f.geometry }))
  }
  raw = raw.filter(r => r.g && !/abyei/i.test(r.name))
  // gleiche Codes bei verschiedenen Namen → Name in die id
  const dupCode = new Set(raw.map(r => r.code).filter((c, i, a) => c && a.indexOf(c) !== i))
  const parts = [], meta = new Map()
  for (const r of raw) {
    const id = slug(r.code && !dupCode.has(r.code) ? r.code : `${iso}-${r.name}`)
    parts.push(F(id, r.g))
    if (!meta.has(id)) meta.set(id, r)
  }
  const layerId = `af-adm1-${iso}`
  const shapes = dissolveLayer(layerId, parts, iso === 'SYC' || iso === 'MUS' || iso === 'CPV' || iso === 'COM' || iso === 'STP' ? 150 : 500, false, iso === 'MAR' ? SAH_FILE : null)
  ADM_SHAPES[iso] = shapes
  const items = []
  for (const [id, r] of meta) {
    const g = shapes.get(id)
    if (!g) { warn(iso, 'Fläche fehlt nach dem Zuschneiden:', r.name); continue }
    // Wikidata nur, wenn der Name passt (sonst gehört der Code zu einer anderen Fläche – z. B. alte Codes in Uganda)
    const w0 = r.code && !dupCode.has(r.code) ? wdByCode.get(r.code) : null
    const near = (a, b) => { const x = norm(cleanName(a ?? '')), y = norm(cleanName(b ?? '')); return !!x && !!y && (x === y || x.includes(y) || y.includes(x) || x.slice(0, 5) === y.slice(0, 5) || sim(x, y) >= 0.7) }
    const w = w0 && (near(w0.en, r.name) || near(w0.de, r.name) || near(w0.de, r.deNe) || near(w0.en, r.deNe)) ? w0 : null
    if (w0 && !w) warn(iso, 'Wikidata passt nicht:', r.code, r.name, '≠', w0.en || w0.de)
    let label = cleanName(w?.de || r.deNe || r.name)
    if (!label || /^Q\d+$/.test(label)) label = cleanName(r.name)
    const aliases = [...new Set([r.name, cleanName(r.name), w?.en, w?.en && cleanName(w.en), w?.de].filter(a => a && a !== label))]
    // Hauptort
    let cap = null
    if (r.code && r.code in D.CAP_FIX) cap = D.CAP_FIX[r.code] ? { name: D.CAP_FIX[r.code], ll: null } : null
    else if (w?.capDe || w?.capEn) {
      const m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(w.coord ?? '')
      cap = { name: w.capDe || w.capEn, ll: m ? [r4(+m[1]), r4(+m[2])] : null }
    } else cap = capFromPlaces(iso, g)
    if (cap) cap.name = cap.name.replace(/,\s.*$/, '').replace(/\s*\((Distrito|Stadt|town)\)$/i, '').replace(/ town$/, '')
    if (cap && norm(cap.name) === norm(label)) cap = { ...cap, same: true }
    if (cap && !cap.ll) {
      const p = PLACES.find(p => p.ADM0_A3 === iso && (norm(p.NAME_DE || '') === norm(cap.name) || norm(p.NAME) === norm(cap.name)))
      if (p) cap.ll = [r4(p.LONGITUDE), r4(p.LATITUDE)]
    }
    // Plausibel? Der Hauptort muss in der Fläche liegen (oder höchstens ~25 km daneben, z. B. an der Küste)
    if (cap?.ll && !inPoly(cap.ll[0], cap.ll[1], g)) {
      const [bx0, by0, bx1, by1] = bbox(g)
      const dx = Math.max(bx0 - cap.ll[0], 0, cap.ll[0] - bx1), dy = Math.max(by0 - cap.ll[1], 0, cap.ll[1] - by1)
      if (Math.hypot(dx, dy) > 0.3) { warn(iso, 'Hauptort liegt nicht in', label, '→', cap.name, '(verworfen)'); cap = null }
    }
    items.push({
      key: `${layerId}:${id}`, label, group: 'alle', areas: [`${layerId}:${id}`], iso, ...(aliases.length ? { aliases } : {}),
      details: [
        ...(cap ? [{ label: 'Hauptort', value: cap.name }] : []),
        ...(r.code ? [{ label: 'ISO-Code', value: r.code }] : []),
      ],
      ...(cap && !cap.same ? { text: { prompt: label, sub: 'Hauptort?', answer: cap.name } } : {}),
      _cap: cap,
    })
  }
  // Nach dem Zuschneiden (Westsahara) nur noch Splitter? → weglassen
  const maxA = Math.max(...items.map(i => geoArea(rewind(shapes.get(i.key.split(':')[1])))))
  for (const i of [...items]) if (geoArea(rewind(shapes.get(i.key.split(':')[1]))) < maxA * 0.03 && iso === 'MAR') { warn(iso, 'nur noch ein Splitter, weggelassen:', i.label); items.splice(items.indexOf(i), 1) }
  items.sort((a, b) => a.label.localeCompare(b.label, 'de'))
  ADM_ITEMS[iso] = items
  const n = items.length
  const diff = n <= 8 ? 'leicht' : n <= 16 ? 'mittel' : n <= 32 ? 'schwer' : 'sehr-schwer'
  const allG = [...shapes.values()]
  const b = allG.reduce((acc, g) => { const x = bbox(g); return [Math.min(acc[0], x[0]), Math.min(acc[1], x[1]), Math.max(acc[2], x[2]), Math.max(acc[3], x[3])] }, [Infinity, Infinity, -Infinity, -Infinity])
  const frame = iso === 'MAR' ? frameOf(bbox(WORLD_G.MAR)) : frameOf(b)
  const name = NAME[iso]
  quiz({
    slug: `${slug(name)}-${slug(cfg.noun)}`, title: `${name} – ${cfg.noun}`, meta: `# ${cfg.noun}`, country: iso, kind: 'regionen', section: S_ADM, difficulty: diff,
    text: `Alle ${n} ${cfg.noun} von ${name}${items.some(i => i._cap) ? ' – mit Hauptorten' : ''}.`,
    layers: [layerId], frame, groups: { alle: [cfg.noun, REGION_COLOR[C3[iso].region]] }, noun: cfg.noun,
    ask: [`Wo liegt ${cfg.one.startsWith('Provinz') || cfg.one.startsWith('Region') || cfg.one.startsWith('Präfektur') || cfg.one.startsWith('Gemeinde') || cfg.one.startsWith('Insel') ? 'die' : cfg.one === 'County' ? 'das' : 'der'} ${cfg.one.replace(/ \(.*\)/, '')}?`, `Wie heißt das markierte Gebiet?`, 'Hauptort?'],
    ...(cfg.note ? { tip: { title: 'Stand der Karte', text: cfg.note } } : {}),
    gg: D.GG.includes(iso) ? 'ja' : undefined,
  }, items.map(({ _cap, ...r }) => r), 'provinzen')
  // Hauptorte als eigenes Quiz (Punkte)
  {
    const caps = items.filter(i => i._cap?.ll)
    if (caps.length >= 5 && caps.length >= n * 0.6) {
      quiz({
        slug: `${slug(name)}-hauptorte`, title: `${name} – Hauptorte der ${cfg.noun}`, meta: `# Hauptorte`, country: iso, kind: 'hauptstaedte', section: S_ADM, difficulty: diff === 'leicht' ? 'mittel' : diff,
        text: `Die Hauptorte der ${cfg.noun} von ${name} als Punkte auf der Karte.`,
        layers: [layerId], frame, groups: { alle: ['Hauptort', REGION_COLOR[C3[iso].region]] }, noun: 'Hauptorte',
        ask: ['Wo liegt der Ort?', 'Welcher Ort ist markiert?', `Hauptort welcher ${cfg.one.replace(/ \(.*\)/, '')}?`], gg: D.GG.includes(iso) ? 'ja' : undefined,
      }, caps.map(i => ({
        key: `af-cap:${iso}:${slug(i._cap.name)}`, label: i._cap.name, prompt: i._cap.name, group: 'alle', point: i._cap.ll, iso,
        details: [{ label: cfg.one.replace(/ \(.*\)/, ''), value: i.label, big: true }],
        text: { prompt: i._cap.name, sub: `Hauptort welcher ${cfg.one.replace(/ \(.*\)/, '')}?`, answer: i.label },
      })).filter((x, k, a) => a.findIndex(y => y.key === x.key) === k), 'provinzen')
    }
  }
}

// Provinzen je Region und ganz Afrika (große Mixe)
for (const [rk, rn] of [...Object.entries(REGION), ['alle', 'ganz Afrika']]) {
  const isos = ISOS.filter(i => (rk === 'alle' || C3[i].region === rk) && ADM_ITEMS[i]?.length)
  const items = isos.flatMap(i => ADM_ITEMS[i].map(({ _cap, ...it }) => ({ ...it, group: i, details: [{ label: 'Land', value: NAME[i], big: true }, ...it.details] })))
  const groups = Object.fromEntries(isos.map((i, k) => [i, [NAME[i], ['teal', 'terra', 'indigo', 'ochre', 'rose', 'green', 'plum', 'blue', 'coral', 'olive', 'brown', 'wine', 'sky', 'slate', 'moss', 'sand'][k % 16]]]))
  quiz({
    slug: rk === 'alle' ? 'afrika-alle-provinzen' : `afrika-${rk}-provinzen`, title: rk === 'alle' ? 'Alle Provinzen Afrikas' : `${rn} – alle Provinzen`, meta: '# Gebiete',
    kind: 'regionen', section: S_ADM, difficulty: rk === 'alle' ? 'experte' : 'sehr-schwer',
    text: rk === 'alle' ? `Die oberste Verwaltungsebene aller 54 Länder auf einer Karte – ${items.length} Gebiete. Für echte Profis.` : `Alle Provinzen, Regionen und Bundesstaaten von ${rn} – ${isos.length} Länder.`,
    layers: isos.map(i => `af-adm1-${i}`), frame: rk === 'alle' ? AF_FRAME : undefined, groups, noun: 'Gebiete', labelSize: 6,
    ask: ['Wo liegt das Gebiet?', 'Wie heißt das markierte Gebiet?', 'In welchem Land?'],
  }, items, 'provinzen-mix')
}
// Provinzen der GeoGuessr-Länder
{
  const isos = D.GG.filter(i => ADM_ITEMS[i]?.length)
  quiz({
    slug: 'afrika-gg-provinzen', title: 'Provinzen der GeoGuessr-Länder Afrikas', meta: '# Gebiete', kind: 'regionen', section: S_ADM, difficulty: 'sehr-schwer', gg: 'ja',
    text: 'Alle Provinzen, Regionen und Countys der Länder, in denen du in GeoGuessr landen kannst – von Tunesien bis Südafrika.',
    layers: isos.map(i => `af-adm1-${i}`), frame: AF_FRAME, groups: Object.fromEntries(isos.map((i, k) => [i, [NAME[i], ['teal', 'terra', 'indigo', 'ochre', 'rose', 'green', 'plum', 'blue', 'coral', 'olive', 'brown', 'wine', 'sky'][k % 13]]])),
    noun: 'Gebiete', labelSize: 6, ask: ['Wo liegt das Gebiet?', 'Wie heißt das markierte Gebiet?', 'In welchem Land?'],
  }, isos.flatMap(i => ADM_ITEMS[i].map(({ _cap, ...it }) => ({ ...it, group: i, details: [{ label: 'Land', value: NAME[i], big: true }, ...it.details] }))), 'provinzen-mix')
}

/* ════════════════════════ 3. Zweite Ebene (nur GeoGuessr-Länder) ════════════════════════ */

console.log('Zweite Ebene')
const S_ADM2 = 'GeoGuessr: Kreise & Distrikte'
for (const [iso, cfg] of Object.entries(D.ADM2)) {
  const file = path.join(AF, 'gb', `${iso}-ADM2.geojson`)
  if (!fs.existsSync(file)) { warn('ADM2 fehlt', iso); continue }
  const raw = readJson(file).features.filter(f => f.geometry && f.properties.shapeName)
  const seen = new Map()
  const parts = []
  for (const f of raw) {
    let name = String(f.properties.shapeName).replace(/\s+/g, ' ').trim()
    if (iso === 'SWZ') name = name.replace(/^Inkhundla\s+/i, '')
    const base = slug(name)
    const id = seen.has(base) && seen.get(base) !== name ? `${base}-${seen.size}` : base
    seen.set(base, name)
    parts.push({ ...F(id, f.geometry), _name: name })
  }
  const layerId = `af-adm2-${iso}`
  const shapes = dissolveLayer(layerId, parts.map(({ _name, ...p }) => p), raw.length > 300 ? 300 : 400)
  // zu welcher Provinz gehört der Kreis? (Mittelpunkt in ADM1)
  const adm1 = ADM_ITEMS[iso] ?? []
  const adm1Shapes = ADM_SHAPES[iso]
  const provOf = g => {
    const [x, y] = geoCentroid(g)
    for (const it of adm1) { const sg = adm1Shapes.get(it.key.split(':')[1]); if (sg && inPoly(x, y, sg)) return it.label }
    return null
  }
  const items = []
  const names = new Map()
  for (const p of parts) {
    const g = shapes.get(p.properties.id)
    if (!g || items.some(i => i.key === `${layerId}:${p.properties.id}`)) continue
    const prov = provOf(g)
    names.set(p._name, (names.get(p._name) ?? 0) + 1)
    items.push({ key: `${layerId}:${p.properties.id}`, label: p._name, group: 'alle', areas: [`${layerId}:${p.properties.id}`], iso, details: prov ? [{ label: 'Provinz/Region', value: prov }] : [], _prov: prov })
  }
  // gleiche Namen unterscheiden
  for (const it of items) if (names.get(it.label) > 1 && it._prov) it.label = `${it.label} (${it._prov})`
  const name = NAME[iso]
  const b = [...shapes.values()].reduce((acc, g) => { const x = bbox(g); return [Math.min(acc[0], x[0]), Math.min(acc[1], x[1]), Math.max(acc[2], x[2]), Math.max(acc[3], x[3])] }, [Infinity, Infinity, -Infinity, -Infinity])
  const n = items.length
  quiz({
    slug: `${slug(name)}-${slug(cfg.noun)}-adm2`, title: `${name} – ${cfg.title}`, meta: `# ${cfg.noun}`, country: iso, kind: 'regionen', section: S_ADM2,
    difficulty: n <= 60 ? 'schwer' : n <= 200 ? 'sehr-schwer' : 'experte', gg: 'ja',
    text: `Die zweite Verwaltungsebene von ${name}: ${n} ${cfg.noun}. Für GeoGuessr-Profis, die ihren Pin auf den Distrikt genau setzen wollen.`,
    layers: [layerId], frame: frameOf(b), groups: { alle: [cfg.noun, REGION_COLOR[C3[iso].region]] }, noun: cfg.noun, labelSize: n > 200 ? 5 : 6,
    ask: [`Wo liegt das Gebiet?`, 'Wie heißt das markierte Gebiet?', 'In welcher Provinz?'],
  }, items.map(({ _prov, ...r }) => ({ ...r, ...(_prov ? { text: { prompt: r.label, sub: 'In welcher Provinz/Region?', answer: _prov } } : {}) })).sort((a, b) => a.label.localeCompare(b.label, 'de')), 'kreise')
}

/* ════════════════════════ 4. Natur ════════════════════════ */

console.log('Natur')
const S_NAT = 'Natur'
const S_FLUSS = 'Flüsse & Seen'
// Flüsse
let RIVER_ITEMS = []
{
  const segs = RIVERS.filter(f => f.properties.name && f.geometry && /^(River|Lake Centerline)/.test(f.properties.featurecla ?? '') && inAfrica(bbox(f.geometry)))
    .filter(f => { const [x, y] = geoCentroid(f.geometry); return x > -20 && !(x > 34 && y > 30) && !(x > 43 && y > 12) })
  const ends = g => (g.type === 'LineString' ? [g.coordinates] : g.coordinates).flatMap(l => [l[0], l.at(-1)])
  const parent = segs.map((_, i) => i)
  const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    if (segs[i].properties.name !== segs[j].properties.name) continue
    const a = ends(segs[i].geometry), b = ends(segs[j].geometry)
    if (a.some(p => b.some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.35))) parent[find(i)] = find(j)
  }
  const groups = new Map()
  segs.forEach((s, i) => { const r = find(i); groups.set(r, [...(groups.get(r) ?? []), s]) })
  let rivers = []
  for (const g of groups.values()) {
    const raw = g[0].properties.name.replace(/\s+/g, ' ').trim()
    const geom = { type: 'MultiLineString', coordinates: g.flatMap(s => (s.geometry.type === 'LineString' ? [s.geometry.coordinates] : s.geometry.coordinates)) }
    const len = geoLength(geom) * 6371
    if (len < 120) continue
    const rank = Math.min(...g.map(s => s.properties.scalerank))
    const lands = [...new Set(geom.coordinates.flatMap(l => l.filter((_, k) => k % 6 === 0)).map(([x, y]) => countryAt(x, y)).filter(c => c && c !== 'SAH'))]
    if (!lands.length) continue
    rivers.push({ raw, geom, len, rank, lands, nameDe: g.find(s => s.properties.name_de)?.properties.name_de })
  }
  const merged = []
  for (const r of rivers.sort((a, b) => a.rank - b.rank || b.len - a.len)) {
    const nm = D.FLUSS_DE[r.raw] ?? r.nameDe ?? r.raw
    const ends2 = g => g.coordinates.flatMap(l => [l[0], l.at(-1)])
    const o = merged.find(m => m.nm === nm && (m.lands.some(l => r.lands.includes(l)) || ends2(m.geom).some(p => ends2(r.geom).some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1))))
    if (!o) { merged.push({ ...r, nm }); continue }
    o.geom = { type: 'MultiLineString', coordinates: [...o.geom.coordinates, ...r.geom.coordinates] }
    o.len += r.len; o.lands = [...new Set([...o.lands, ...r.lands])]; o.rank = Math.min(o.rank, r.rank)
  }
  const cnt = n => merged.filter(r => r.nm === n).length
  const feats = [], items = []
  for (const r of merged.sort((a, b) => a.rank - b.rank || b.len - a.len)) {
    let name = r.nm
    if (cnt(r.nm) > 1) name = `${name} (${NAME[r.lands[0]]})`
    const id = slug(name)
    if (items.some(i => i.key === `af-fluss:${id}`)) continue
    feats.push(F(id, r.geom))
    items.push({
      key: `af-fluss:${id}`, label: name, group: r.rank <= 3 ? 'gross' : r.rank <= 6 ? 'mittel' : 'klein', areas: [`af-fluesse:${id}`],
      ...(r.raw !== name && r.raw !== r.nm ? { aliases: [r.raw] } : {}),
      details: [{ label: 'Länge auf der Karte', value: `ca. ${de(Math.round(r.len / 10) * 10)} km` }, { label: 'Fließt durch', value: r.lands.map(l => NAME[l]).join(', ') }],
      _rank: r.rank, _lands: r.lands,
    })
  }
  lineLayer('af-fluesse', feats, 900)
  RIVER_ITEMS = items
  const strip = it => { const { _rank, _lands, ...rest } = it; return rest }
  const FL = { gross: ['großer Fluss', 'blue'], mittel: ['mittlerer Fluss', 'teal'], klein: ['kleiner Fluss', 'sky'] }
  const base = { kind: 'fluesse', section: S_FLUSS, layers: ['af-fluesse'], frame: AF_FRAME, groups: FL, noun: 'Flüsse', ask: ['Wo fließt der Fluss?', 'Welcher Fluss ist markiert?'] }
  const leicht = items.filter(i => D.FLUSS_LEICHT.includes(i.label))
  const fehlt = D.FLUSS_LEICHT.filter(n => !leicht.some(i => i.label === n))
  if (fehlt.length) warn('leichte Flüsse nicht gefunden:', fehlt.join(', '))
  quiz({ ...base, slug: 'afrika-fluesse-leicht', title: 'Flüsse Afrikas (Leicht)', meta: '# Flüsse · die bekanntesten', difficulty: 'leicht', text: 'Nil, Kongo, Niger, Sambesi, Oranje – die großen Ströme Afrikas.',
    tip: { title: 'Gut zu wissen', text: 'Der Nil ist mit rund 6.650 km einer der beiden längsten Flüsse der Erde. Der Kongo ist der tiefste Fluss der Welt und führt nach dem Amazonas das meiste Wasser.' } }, leicht.map(strip), 'natur')
  quiz({ ...base, slug: 'afrika-fluesse-mittel', title: 'Flüsse Afrikas (Mittel)', meta: '# Flüsse', difficulty: 'mittel', labelSize: 7, text: 'Dazu die großen Nebenflüsse: Benue, Kasai, Ubangi, Kafue, Luangwa, Atbara …' }, items.filter(i => i._rank <= 5 || D.FLUSS_LEICHT.includes(i.label)).map(strip), 'natur')
  quiz({ ...base, slug: 'afrika-fluesse-schwer', title: 'Flüsse Afrikas (Schwer)', meta: '# Flüsse', difficulty: 'schwer', labelSize: 6, text: 'Fast alle Flüsse aus den Daten – auch Tana, Cuanza, Sanaga und Ogooué.' }, items.filter(i => i._rank <= 7 || D.FLUSS_LEICHT.includes(i.label)).map(strip), 'natur')
  quiz({ ...base, slug: 'afrika-fluesse-sehr-schwer', title: 'Flüsse Afrikas (Sehr schwer)', meta: '# Flüsse · alle', difficulty: 'sehr-schwer', labelSize: 5, text: 'Alle Flüsse aus den Daten – bis zum kleinsten Nebenfluss.' }, items.map(strip), 'natur')
  // je Region
  for (const [rk, rn] of Object.entries(REGION)) {
    const list = items.filter(i => i._lands.some(l => C3[l]?.region === rk))
    if (list.length < 5) continue
    const b = list.flatMap(i => i._lands).filter(l => C3[l]?.region === rk)
    const bb = [...new Set(b)].reduce((acc, c) => { const x = bbox(WORLD_G[c]); return [Math.min(acc[0], x[0]), Math.min(acc[1], x[1]), Math.max(acc[2], x[2]), Math.max(acc[3], x[3])] }, [Infinity, Infinity, -Infinity, -Infinity])
    quiz({ ...base, slug: `afrika-${rk}-fluesse`, title: `${rn} – Flüsse`, meta: '# Flüsse', section: S_REG, difficulty: 'schwer', frame: frameOf(bb, 0.02), labelSize: 6, text: `Alle Flüsse von ${rn}.` }, list.map(strip), 'natur')
  }
}
// Seen
{
  const feats = [], items = [], seen = new Set()
  for (const f of LAKES.filter(f => f.properties.name && inAfrica(bbox(f.geometry)))) {
    const p = f.properties
    const [x, y] = geoCentroid(f.geometry)
    if (x < -20 || (x > 34 && y > 30)) continue
    const land = nearCountry(x, y)
    const lands = [...new Set((f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).flatMap(pl => pl[0].filter((_, k) => k % 10 === 0)).map(([a, b]) => nearCountry(a, b)).filter(Boolean))]
    if (!land && !lands.length) continue
    const name = (p.name_de || p.name).replace(/\s+/g, ' ')
    const id = slug(name)
    feats.push(F(id, f.geometry))
    if (seen.has(id)) continue
    seen.add(id)
    const stau = /stausee|talsperre|dam\b|reservoir|barrage|lake volta|kariba|cahora|nasser|kainji|kossou|akosombo/i.test(`${p.name} ${p.name_de}`)
    items.push({
      key: `af-see:${id}`, label: name, group: stau ? 'stausee' : 'see', areas: [`af-seen:${id}`], ...(p.name !== name ? { aliases: [p.name] } : {}),
      details: [{ label: 'Art', value: stau ? 'Stausee' : 'natürlicher See' }, { label: 'Land', value: (lands.length ? lands : [land]).map(l => NAME[l] ?? l).join(', ') }],
      _rank: p.scalerank ?? 9,
    })
  }
  dissolveLayer('af-seen', feats, 300)
  const SEE = { see: ['natürlicher See', 'sky'], stausee: ['Stausee', 'indigo'] }
  const base = { kind: 'seen', section: S_FLUSS, layers: ['af-seen'], frame: AF_FRAME, groups: SEE, noun: 'Seen', ask: ['Wo liegt der See?', 'Welcher See ist markiert?'] }
  const strip = ({ _rank, ...r }) => r
  quiz({ ...base, slug: 'afrika-seen-leicht', title: 'Seen Afrikas (Leicht)', meta: '# Seen', difficulty: 'leicht', text: 'Victoriasee, Tanganjikasee, Malawisee, Tschadsee – die großen Seen.',
    tip: { title: 'Gut zu wissen', text: 'Der Victoriasee ist der größte See Afrikas, der Tanganjikasee der zweittiefste See der Welt (fast 1.500 m).' } }, items.filter(i => i._rank <= 2).map(strip), 'natur')
  quiz({ ...base, slug: 'afrika-seen', title: 'Seen & Stauseen Afrikas', meta: '# Seen', difficulty: 'schwer', labelSize: 6, text: 'Alle Seen und Stauseen aus den Daten – vom Nasser-Stausee bis zum Kivusee.' }, items.map(strip), 'natur')
}
// Gebirge, Wüsten & Landschaften, Inseln
{
  const DROP = ['AFRICA', 'Negev Desert', 'Jabal bin Ghunaymah', 'Libyan Plateau']
  const CLASS = { 'Range/mtn': 'gebirge', Plateau: 'hochland', Desert: 'wueste', Depression: 'wueste', Plain: 'ebene', Basin: 'ebene', Delta: 'feucht', Geoarea: 'region', Valley: 'graben', 'Pen/cape': 'region', Coast: 'kueste', Island: 'insel', 'Island group': 'insel' }
  const raw = GEO.filter(f => f.properties.REGION === 'Africa' && !DROP.includes(f.properties.NAME) && CLASS[f.properties.FEATURECLA])
  const prepared = raw.map(f => {
    const p = f.properties
    const [x, y] = geoCentroid(f.geometry)
    let name = p.NAME_DE && p.NAME_DE !== p.NAME_DE.toUpperCase() ? p.NAME_DE : p.NAME_DE ? p.NAME_DE.toLowerCase().replace(/(^|[\s-])\p{L}/gu, m => m.toUpperCase()) : p.NAME
    if (name === 'Danakil-Somalia') name = 'Danakil-Wüste'
    if (name === 'Gold Coast') name = 'Goldküste'
    if (name === 'Wild Coast') name = 'Wild Coast'
    if (name === 'Sahel') name = 'Sahel'
    return { f, p, land: nearCountry(x, y), name, cls: CLASS[p.FEATURECLA], rank: p.SCALERANK }
  })
  const LABEL = { gebirge: 'Gebirge', hochland: 'Hochland/Plateau', wueste: 'Wüste/Senke', ebene: 'Ebene/Becken', feucht: 'Delta', region: 'Landschaft', graben: 'Grabenbruch', kueste: 'Küste', insel: 'Insel(n)' }
  const mk = (list, layer) => {
    const feats = [], items = []
    for (const r of list) {
      const id = slug(r.name)
      feats.push(F(id, r.f.geometry))
      if (items.some(i => i.key === `${layer}:${id}`)) continue
      items.push({
        key: `${layer}:${id}`, label: r.name, group: r.cls, areas: [`${layer}:${id}`], ...(r.p.NAME && r.p.NAME !== r.name ? { aliases: [r.p.NAME.replace(/\b(Mts|Plat)\./g, '')] } : {}),
        details: [{ label: 'Art', value: LABEL[r.cls] }, ...(r.land && NAME[r.land] ? [{ label: 'Land (Mitte)', value: NAME[r.land] }] : [])], _rank: r.rank,
      })
    }
    dissolveLayer(layer, feats, 2000, true)
    return items
  }
  const strip = ({ _rank, ...r }) => r
  const geb = mk(prepared.filter(r => ['gebirge', 'hochland', 'graben'].includes(r.cls)), 'af-gebirge')
  const GG = { gebirge: ['Gebirge', 'brown'], hochland: ['Hochland/Plateau', 'ochre'], graben: ['Grabenbruch', 'rose'] }
  quiz({ slug: 'afrika-gebirge-leicht', title: 'Gebirge Afrikas (Leicht)', meta: '# Gebirge', kind: 'berge', section: S_NAT, difficulty: 'leicht', layers: ['af-gebirge'], frame: AF_FRAME, groups: GG, noun: 'Gebirge',
    text: 'Atlas, Äthiopisches Hochland, Drakensberge, Ahaggar, Tibesti und der Große Afrikanische Grabenbruch.', ask: ['Wo liegt das Gebirge?', 'Welches Gebirge ist markiert?'] }, geb.filter(i => i._rank <= 3).map(strip), 'natur')
  quiz({ slug: 'afrika-gebirge', title: 'Gebirge & Hochländer Afrikas', meta: '# Gebirge', kind: 'berge', section: S_NAT, difficulty: 'schwer', layers: ['af-gebirge'], frame: AF_FRAME, groups: GG, noun: 'Gebirge', labelSize: 6,
    text: 'Alle Gebirge und Hochebenen aus den Daten – vom Rif bis zu den Karasbergen.', ask: ['Wo liegt das Gebirge?', 'Welches Gebirge ist markiert?'] }, geb.map(strip), 'natur')
  const lan = mk(prepared.filter(r => ['wueste', 'ebene', 'feucht', 'region', 'kueste'].includes(r.cls)), 'af-landschaften')
  const LG = { wueste: ['Wüste/Senke', 'sand'], ebene: ['Ebene/Becken', 'olive'], feucht: ['Delta', 'teal'], region: ['Landschaft', 'terra'], kueste: ['Küste', 'blue'] }
  quiz({ slug: 'afrika-wuesten-leicht', title: 'Wüsten Afrikas (Leicht)', meta: '# Wüsten', kind: 'wuesten', section: S_NAT, difficulty: 'leicht', layers: ['af-landschaften'], frame: AF_FRAME, groups: LG, noun: 'Wüsten',
    text: 'Sahara, Namib, Kalahari, Libysche und Nubische Wüste – die großen Wüsten.', ask: ['Wo liegt die Wüste?', 'Welche Wüste ist markiert?'],
    tip: { title: 'Gut zu wissen', text: 'Die Sahara ist die größte Trockenwüste der Erde – fast so groß wie die USA. Die Namib gilt als älteste Wüste der Welt.' } }, lan.filter(i => i.group === 'wueste' && i._rank <= 3).map(strip), 'natur')
  quiz({ slug: 'afrika-wuesten', title: 'Wüsten & Ergs der Sahara', meta: '# Wüsten', kind: 'wuesten', section: S_NAT, difficulty: 'sehr-schwer', layers: ['af-landschaften'], frame: AF_FRAME, groups: LG, noun: 'Wüsten', labelSize: 6,
    text: 'Alle Wüsten, Sandmeere (Ergs) und Senken: Ténéré, Erg Chech, Grand Erg Oriental, Bodélé …', ask: ['Wo liegt die Wüste?', 'Welche Wüste ist markiert?'] }, lan.filter(i => i.group === 'wueste').map(strip), 'natur')
  quiz({ slug: 'afrika-landschaften', title: 'Landschaften Afrikas', meta: '# Landschaften', kind: 'wuesten', section: S_NAT, difficulty: 'mittel', layers: ['af-landschaften'], frame: AF_FRAME, groups: LG, noun: 'Landschaften', labelSize: 6,
    text: 'Sahel, Kongobecken, Serengeti, Nildelta, Okavango, Skelettküste, Ogaden – Landschaften und Küsten.', ask: ['Wo liegt die Landschaft?', 'Welche Landschaft ist markiert?'] }, lan.filter(i => i.group !== 'wueste').map(strip), 'natur')
  const ins = mk(prepared.filter(r => r.cls === 'insel'), 'af-inseln')
  quiz({ slug: 'afrika-inseln', title: 'Inseln Afrikas', meta: '# Inseln', kind: 'gebiete', section: S_NAT, difficulty: 'mittel', layers: ['af-inseln'], frame: [[-26, -36], [60, 38]], groups: { insel: ['Insel(n)', 'teal'] }, noun: 'Inseln', labelSize: 6,
    text: 'Madagaskar, Sansibar, Bioko, die Kanaren, Kap Verde und die Komoren.', ask: ['Wo liegt die Insel?', 'Welche Insel ist markiert?'],
    tip: { title: 'Gut zu wissen', text: 'Die Kanaren und Madeira liegen vor Afrika, gehören aber zu Spanien bzw. Portugal – politisch also zu Europa.' } }, ins.map(strip), 'natur')
}
// Meere, Golfe, Kaps
{
  const raw = MARINE.filter(f => { const b = bbox(f.geometry); const [x, y] = geoCentroid(f.geometry); return f.properties.name && inAfrica(b) && x > -30 && x < 65 && y > -50 && y < 37 && !/Mediterranean Sea|Indian Ocean|Atlantic|Southern Ocean/.test(f.properties.name) || /^(Red Sea|Gulf of Aden|Gulf of Guinea|Mozambique Channel|Gulf of Sidra|Gulf of Gabès|Bight of Benin|Bight of Biafra|Strait of Gibraltar|Bab-el-Mandeb|Gulf of Suez|Gulf of Aqaba|Gulf of Hammamet|Gulf of Tunis|Alboran Sea|Somali Sea|Arabian Sea)$/.test(f.properties.name ?? '') })
  const DE = { 'Red Sea': 'Rotes Meer', 'Gulf of Aden': 'Golf von Aden', 'Gulf of Guinea': 'Golf von Guinea', 'Mozambique Channel': 'Straße von Mosambik', 'Gulf of Sidra': 'Große Syrte', 'Gulf of Gabès': 'Kleine Syrte (Golf von Gabès)',
    'Bight of Benin': 'Bucht von Benin', 'Bight of Biafra': 'Bucht von Biafra', 'Strait of Gibraltar': 'Straße von Gibraltar', 'Bab-el-Mandeb': 'Bab al-Mandab', 'Gulf of Suez': 'Golf von Sues', 'Gulf of Aqaba': 'Golf von Akaba',
    'Gulf of Hammamet': 'Golf von Hammamet', 'Gulf of Tunis': 'Golf von Tunis', 'Alboran Sea': 'Alborán-Meer', 'Arabian Sea': 'Arabisches Meer', 'Somali Sea': 'Somalisches Meer', 'False Bay': 'False Bay', 'Walvis Bay': 'Walvisbucht', 'Table Bay': 'Tafelbucht' }
  const feats = [], items = []
  const WEG = ['Persian Gulf', 'Gulf of Oman', 'Gulf of Masira', 'Sea of Crete', 'Ionian Sea', 'Aegean Sea', 'Tyrrhenian Sea', 'Balearic Sea', 'Levantine Sea', 'Gulf of Aqaba']
  for (const f of raw.filter(f => !WEG.includes(f.properties.name) && !/Persischer|Oman|Masira|Kretisch/.test(f.properties.name_de ?? ''))) {
    const name = (f.properties.name === 'Saint Helenba Bay' ? 'St.-Helena-Bucht' : null) || f.properties.name_de || DE[f.properties.name] || f.properties.name
    const id = slug(name)
    feats.push(F(id, f.geometry))
    if (items.some(i => i.key === `af-meer:${id}`)) continue
    items.push({ key: `af-meer:${id}`, label: name, group: /Straße|Strait|Kanal|Channel|Mandab/.test(name) ? 'strasse' : /Bucht|Bay|Bight/.test(name) ? 'bucht' : /Golf|Gulf|Syrte/.test(name) ? 'golf' : 'meer', areas: [`af-meer:${id}`], ...(f.properties.name !== name ? { aliases: [f.properties.name] } : {}) })
  }
  dissolveLayer('af-meer', feats, 2500, true)
  quiz({ slug: 'afrika-meere-golfe', title: 'Meere, Golfe & Meerengen um Afrika', meta: '# Gewässer', kind: 'meere', section: S_NAT, difficulty: 'mittel', layers: ['af-meer'], frame: [[-30, -42], [64, 38]],
    groups: { meer: ['Meer', 'blue'], golf: ['Golf', 'teal'], bucht: ['Bucht', 'sky'], strasse: ['Meerenge', 'indigo'] }, noun: 'Gewässer', labelSize: 6,
    text: 'Rotes Meer, Golf von Guinea, Straße von Mosambik, Bab al-Mandab, Große Syrte – die Gewässer rund um Afrika.', ask: ['Wo liegt das Gewässer?', 'Welches Gewässer ist markiert?'] }, items, 'natur')
}
// Gipfel
{
  const add = (arr, name, ele, lon, lat, land, note) => {
    const id = slug(name)
    if (arr.some(i => i.key === `af-gipfel:${id}`)) return
    arr.push({
      key: `af-gipfel:${id}`, label: name, group: ele >= 4000 ? 'vier' : ele >= 2500 ? 'zwei' : 'klein', point: [r4(lon), r4(lat)], pointShape: 'tri', iso: land ?? undefined,
      details: [{ label: 'Höhe', value: `${de(ele)} m`, big: true }, ...(land && NAME[land] ? [{ label: 'Land', value: NAME[land] }] : land === 'REU' ? [{ label: 'Gebiet', value: 'Réunion (Frankreich)' }] : []), ...(note ? [{ label: 'Gut zu wissen', value: note }] : [])],
      text: { prompt: name, sub: 'Wie hoch ungefähr?', answer: `${de(Math.round(ele / 100) * 100)} m` }, _ele: ele,
    })
  }
  const all = []
  for (const g of D.GIPFEL_EXTRA) add(all, ...g)
  // Vulkane und Berge aus Wikidata mit Höhe
  for (const [q, nde, nen, coord, cc, sl, h] of NAT.vu) {
    const m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(coord); if (!m || !h || h < 500 || sl < 8) continue
    const name = nde || nen
    if (all.some(i => norm(i.label).includes(norm(name)) || norm(name).includes(norm(i.label.split(' (')[0])))) continue
    add(all, name, Math.round(h), +m[1], +m[2], cc, 'Vulkan')
  }
  const sorted = all.filter(i => i.point[1] > -36).sort((a, b) => b._ele - a._ele).map(({ _ele, ...r }) => r)
  const PG = { vier: ['über 4.000 m', 'rose'], zwei: ['2.500 bis 4.000 m', 'ochre'], klein: ['unter 2.500 m', 'green'] }
  const base = { kind: 'berge', section: S_NAT, layers: [], frame: AF_FRAME, groups: PG, noun: 'Berge', ask: ['Wo liegt der Berg?', 'Welcher Berg ist markiert?', 'Wie hoch?'] }
  quiz({ ...base, slug: 'afrika-berge-leicht', title: 'Berühmte Berge Afrikas', meta: '# Berge', difficulty: 'leicht', text: 'Kilimandscharo, Mount Kenya, Ruwenzori, Toubkal, Kamerunberg, Tafelberg – die bekanntesten Gipfel.',
    tip: { title: 'Gut zu wissen', text: 'Der Kilimandscharo (5.895 m) ist der höchste Berg Afrikas und einer der „Seven Summits“.' } }, sorted.filter(i => D.GIPFEL_LEICHT.includes(i.label)), 'natur')
  quiz({ ...base, slug: 'afrika-berge', title: 'Berge & Vulkane Afrikas', meta: '# Gipfel', difficulty: 'schwer', labelSize: 6, text: 'Alle Gipfel und Vulkane – mit Höhe.' }, sorted, 'natur')
  const vulk = []
  for (const [q, nde, nen, coord, cc, sl, h] of NAT.vu) {
    const m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(coord); if (!m || sl < 10 || +m[2] < -36) continue
    const name = nde || nen
    const id = slug(name)
    if (vulk.some(v => v.key === `af-vulkan:${id}`)) continue
    vulk.push({ key: `af-vulkan:${id}`, label: name, group: 'vulkan', point: [r4(+m[1]), r4(+m[2])], pointShape: 'tri', iso: cc, details: [...(h ? [{ label: 'Höhe', value: `${de(h)} m` }] : []), { label: 'Land', value: NAME[cc] ?? cc }] })
  }
  quiz({ slug: 'afrika-vulkane', title: 'Vulkane Afrikas', meta: '# Vulkane', kind: 'berge', section: S_NAT, difficulty: 'schwer', layers: [], frame: AF_FRAME, groups: { vulkan: ['Vulkan', 'rose'] }, noun: 'Vulkane', labelSize: 6,
    text: 'Nyiragongo, Erta Ale, Kamerunberg, Pico do Fogo, Karthala – die Vulkane Afrikas, viele im Großen Grabenbruch.', ask: ['Wo liegt der Vulkan?', 'Welcher Vulkan ist markiert?'] }, vulk, 'natur')
}
// Wasserfälle, Nationalparks, Welterbe (Wikidata)
const natPoints = (rows, prefix, minSl, nameFix = n => n) => {
  const out = []
  for (const [q, nde, nen, coord, cc, sl] of rows.sort((a, b) => b[5] - a[5])) {
    const m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(coord); if (!m || sl < minSl) continue
    const name = nameFix(nde || nen)
    if (!name || /^Q\d+$/.test(name)) continue
    const id = slug(name)
    const old = out.find(o => o.key === `${prefix}:${id}`)
    if (old) { if (!old._lands.includes(cc)) old._lands.push(cc); continue }
    out.push({ key: `${prefix}:${id}`, label: name, group: 'alle', point: [r4(+m[1]), r4(+m[2])], iso: cc, ...(nen && nen !== name ? { aliases: [nen] } : {}), _lands: [cc], _sl: sl })
  }
  return out.map(({ _lands, _sl, ...r }) => ({ ...r, details: [{ label: 'Land', value: _lands.map(l => NAME[l] ?? l).join(', ') }] }))
}
{
  const wf = natPoints(NAT.wf, 'af-wf', 12)
  quiz({ slug: 'afrika-wasserfaelle', title: 'Wasserfälle Afrikas', meta: '# Wasserfälle', kind: 'fluesse', section: S_FLUSS, difficulty: 'schwer', layers: [], frame: AF_FRAME, groups: { alle: ['Wasserfall', 'sky'] }, noun: 'Wasserfälle', labelSize: 6,
    text: 'Victoriafälle, Tugela, Murchison, Blaue-Nil-Fälle, Ouzoud – die großen Wasserfälle.', ask: ['Wo liegt der Wasserfall?', 'Welcher Wasserfall ist markiert?'],
    tip: { title: 'Gut zu wissen', text: 'Die Victoriafälle sind der breiteste durchgehende Wasserfall der Erde. Die Tugela-Fälle in Südafrika gelten als einer der höchsten.' } }, wf, 'natur')
  const np = natPoints(NAT.np, 'af-np', 15, n => n.replace(/^Fort Jesus$/, ''))
  const S_NP = 'Nationalparks & Welterbe'
  quiz({ slug: 'afrika-nationalparks-leicht', title: 'Berühmte Nationalparks Afrikas', meta: '# Nationalparks', kind: 'gebiete', section: S_NP, difficulty: 'mittel', layers: [], frame: AF_FRAME, groups: { alle: ['Nationalpark', 'green'] }, noun: 'Nationalparks',
    text: 'Serengeti, Kruger, Masai Mara, Etosha, Virunga, Bwindi – die bekanntesten Parks.', ask: ['Wo liegt der Nationalpark?', 'Welcher Nationalpark ist markiert?'] }, np.slice(0, 30), 'natur')
  quiz({ slug: 'afrika-nationalparks', title: 'Nationalparks Afrikas', meta: '# Nationalparks', kind: 'gebiete', section: S_NP, difficulty: 'sehr-schwer', layers: [], frame: AF_FRAME, groups: { alle: ['Nationalpark', 'green'] }, noun: 'Nationalparks', labelSize: 5,
    text: 'Über hundert Nationalparks und Schutzgebiete – vom Banc d’Arguin bis zum Addo-Elefantenpark.', ask: ['Wo liegt der Nationalpark?', 'Welcher Nationalpark ist markiert?'] }, np.slice(0, 160), 'natur')
  const un = natPoints(NAT.unesco, 'af-unesco', 8)
  quiz({ slug: 'afrika-welterbe', title: 'UNESCO-Welterbe in Afrika', meta: '# Welterbestätten', kind: 'wissen', section: S_NP, difficulty: 'schwer', layers: [], frame: AF_FRAME, groups: { alle: ['Welterbe', 'ochre'] }, noun: 'Welterbestätten', labelSize: 6,
    text: 'Timbuktu, Aksum, Lalibela, Groß-Simbabwe, Robben Island, die Medinas Nordafrikas – und Naturerbe wie die Serengeti.', ask: ['Wo liegt die Stätte?', 'Welche Stätte ist markiert?'] }, un.slice(0, 120), 'natur')
  quiz({ slug: 'afrika-bauwerke', title: 'Bauwerke & Wahrzeichen Afrikas', meta: '# Wahrzeichen', kind: 'wissen', section: S_NP, difficulty: 'leicht', layers: [], frame: AF_FRAME,
    groups: Object.fromEntries(Object.entries(D.BAUWERK_GRUPPEN).map(([k, n], i) => [k, [n, ['ochre', 'plum', 'terra', 'rose', 'green'][i]]])), noun: 'Wahrzeichen',
    text: 'Pyramiden, Lalibela, die Lehmmoschee von Djenné, Groß-Simbabwe, Tafelberg, Victoriafälle – die großen Wahrzeichen.', ask: ['Wo liegt das Wahrzeichen?', 'Welches Wahrzeichen ist markiert?', 'In welchem Land?'] },
  D.BAUWERKE.map(([n, lon, lat, iso, grp, txt]) => ({ key: `af-bau:${slug(n)}`, label: n, group: grp, point: [lon, lat], iso, details: [{ label: 'Land', value: NAME[iso], big: true }, { label: 'Gut zu wissen', value: txt }], text: { prompt: n, sub: 'In welchem Land?', answer: NAME[iso] } })), 'wissen')
}

/* ════════════════════════ 5. Städte ════════════════════════ */

console.log('Städte')
const S_ST = 'Städte'
const WP_LAND = {
  Egypt: 'EGY', Nigeria: 'NGA', 'Democratic Republic of the Congo': 'COD', Kenya: 'KEN', 'South Africa': 'ZAF', Angola: 'AGO', Sudan: 'SDN', 'Ivory Coast': 'CIV', Ghana: 'GHA',
  Tanzania: 'TZA', Mali: 'MLI', Uganda: 'UGA', Ethiopia: 'ETH', Morocco: 'MAR', Algeria: 'DZA', Senegal: 'SEN', Guinea: 'GIN', Cameroon: 'CMR', 'Burkina Faso': 'BFA',
  Madagascar: 'MDG', Zambia: 'ZMB', Tunisia: 'TUN', Togo: 'TGO', Zimbabwe: 'ZWE', Mozambique: 'MOZ', 'Republic of the Congo': 'COG', Somalia: 'SOM', Benin: 'BEN', Rwanda: 'RWA',
  Chad: 'TCD', Liberia: 'LBR', Libya: 'LBY', 'Central African Republic': 'CAF', Niger: 'NER', Mauritania: 'MRT', 'Sierra Leone': 'SLE', Burundi: 'BDI', Malawi: 'MWI', Gambia: 'GMB', Eritrea: 'ERI',
}
const WP_DE = { 'City of Tshwane (Pretoria)': 'Pretoria', Ekurhuleni: 'Ekurhuleni (East Rand)', Zanzibar: 'Sansibar-Stadt', Gqeberha: 'Gqeberha (Port Elizabeth)', 'Shubra el-Kheima': 'Schubra al-Chaima', Misratah: 'Misrata', 'Bobo Dioulasso': 'Bobo-Dioulasso' }
const AF_PLACES = PLACES.filter(p => ISOS.includes(p.ADM0_A3) && p.FEATURECLA !== 'Admin-0 region capital')
/** Ort in Natural Earth suchen (Name oder deutscher Name, im Land) */
function findPlace(name, iso) {
  const n = norm(name.replace(/ \(.*\)/, ''))
  return AF_PLACES.find(p => p.ADM0_A3 === iso && [p.NAME, p.NAME_DE, p.NAMEASCII, p.NAMEALT, ...(p.NAMEALT ?? '').split('|')].some(x => x && norm(x) === n))
}
const MANUAL_LL = { Mansoura: [31.3807, 31.0364], Ekurhuleni: [28.35, -26.2], Touba: [-15.883, 14.85], 'Abomey-Calavi': [2.35, 6.45], Nnewi: [6.917, 6.017], Matola: [32.456, -25.962], Tshikapa: [20.8, -6.416], Ikorodu: [3.504, 6.619], Goma: [29.228, -1.679], Gqeberha: [25.6, -33.96], Zanzibar: [39.19, -6.165], 'Shubra el-Kheima': [31.244, 30.128], Hargeisa: [44.065, 9.56], Banjul: [-16.578, 13.454], Agadir: [-9.598, 30.42], Sousse: [10.637, 35.825], Arusha: [36.683, -3.367], Bukavu: [28.86, -2.5], Nyala: [24.88, 12.05], Misratah: [15.09, 32.375], Warri: [5.75, 5.517], Benguela: [13.4, -12.583], Kananga: [22.417, -5.897] }
const MIO = []
for (const [en, land, popS, year] of WP_STAEDTE) {
  const iso = WP_LAND[land]
  if (!iso) { warn('Land unbekannt', land); continue }
  const pop = Number(popS.replace(/,/g, ''))
  const p = findPlace(WP_DE[en] ?? en, iso) ?? findPlace(en, iso)
  const ll = p ? [r4(p.LONGITUDE), r4(p.LATITUDE)] : MANUAL_LL[en]
  if (!ll) { warn('Stadt ohne Koordinaten:', en); continue }
  const label = WP_DE[en] ?? (p?.NAME_DE || en)
  MIO.push({ label, en, iso, pop, year, ll, cap: !!(p?.ADM0CAP) || C3[iso].capital === label })
}
const popG = p => (p >= 5e6 ? 'mega' : p >= 2e6 ? 'gross' : p >= 1e6 ? 'mio' : 'unter')
const STADT_G = { mega: ['über 5 Millionen', 'rose'], gross: ['2 bis 5 Millionen', 'terra'], mio: ['1 bis 2 Millionen', 'ochre'], unter: ['unter 1 Million', 'blue'] }
const mioItem = (c, prefix = 'af-stadt') => ({
  key: `${prefix}:${c.iso}:${slug(c.label)}`, label: c.label, group: popG(c.pop), point: c.ll, iso: c.iso, ...(c.en !== c.label ? { aliases: [c.en] } : {}),
  details: [{ label: 'Einwohner (Ballungsraum)', value: `ca. ${(c.pop / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio. (${c.year})`, big: true }, { label: 'Land', value: NAME[c.iso] }, ...(c.cap ? [{ label: 'Hauptstadt', value: 'ja' }] : [])],
  text: { prompt: c.label, sub: 'In welchem Land?', answer: NAME[c.iso] },
})
{
  const base = { kind: 'staedte', section: S_ST, layers: [], frame: AF_FRAME, groups: STADT_G, noun: 'Städte', ask: ['Wo liegt die Stadt?', 'Welche Stadt ist markiert?', 'In welchem Land?'] }
  const mio = MIO.filter(c => c.pop >= 1e6)
  quiz({ ...base, slug: 'afrika-millionenstaedte', title: 'Millionenstädte Afrikas', meta: '# Städte über 1 Mio.', difficulty: 'schwer', labelSize: 6,
    text: `Alle ${mio.length} Ballungsräume mit über einer Million Einwohnern – von Kairo (über 23 Mio.) bis Enugu.`,
    tip: { title: 'Gut zu wissen', text: 'Kairo, Lagos und Kinshasa sind die größten Städte Afrikas. Kinshasa ist die größte französischsprachige Stadt der Welt.' } }, mio.map(c => mioItem(c)), 'staedte')
  quiz({ ...base, slug: 'afrika-staedte-leicht', title: 'Großstädte Afrikas (Leicht)', meta: '# Städte', difficulty: 'leicht', text: 'Die 25 größten Städte Afrikas.' }, MIO.slice(0, 25).map(c => mioItem(c)), 'staedte')
  quiz({ ...base, slug: 'afrika-staedte-mittel', title: 'Großstädte Afrikas (Mittel)', meta: '# Städte', difficulty: 'mittel', labelSize: 7, text: 'Die 50 größten Städte Afrikas.' }, MIO.slice(0, 50).map(c => mioItem(c)), 'staedte')
  // größere Liste aus Natural Earth (Orte ab 300.000 / ab 100.000)
  const extra = AF_PLACES.filter(p => p.POP_MAX >= 100000).sort((a, b) => b.POP_MAX - a.POP_MAX)
  const neItems = (min, prefix) => {
    const out = MIO.map(c => mioItem(c, prefix))
    for (const p of extra.filter(p => p.POP_MAX >= min)) {
      const name = p.NAME_DE || p.NAME
      if (out.some(o => o.iso === p.ADM0_A3 && (norm(o.label) === norm(name) || o.aliases?.some(a => norm(a) === norm(p.NAME)))) || MIO.some(m => m.iso === p.ADM0_A3 && Math.hypot(m.ll[0] - p.LONGITUDE, m.ll[1] - p.LATITUDE) < 0.08)) continue
      const key = `${prefix}:${p.ADM0_A3}:${slug(name)}`
      if (out.some(o => o.key === key)) continue
      out.push({ key, label: name, group: 'unter', point: [r4(p.LONGITUDE), r4(p.LATITUDE)], iso: p.ADM0_A3, ...(p.NAME !== name ? { aliases: [p.NAME] } : {}),
        details: [{ label: 'Einwohner (ältere Schätzung)', value: `ca. ${de(p.POP_MAX)}` }, { label: 'Land', value: NAME[p.ADM0_A3] }], text: { prompt: name, sub: 'In welchem Land?', answer: NAME[p.ADM0_A3] } })
    }
    return out
  }
  quiz({ ...base, slug: 'afrika-staedte-schwer', title: 'Großstädte Afrikas (Schwer)', meta: '# Städte', difficulty: 'schwer', labelSize: 6, text: 'Alle Städte ab etwa 300.000 Einwohnern.' }, neItems(300000, 'af-stadt'), 'staedte')
  quiz({ ...base, slug: 'afrika-staedte-sehr-schwer', title: 'Großstädte Afrikas (Sehr schwer)', meta: '# Städte', difficulty: 'sehr-schwer', labelSize: 5, text: 'Alle Städte ab etwa 100.000 Einwohnern – über 400 Orte.' }, neItems(100000, 'af-stadt'), 'staedte')
  // je Region
  for (const [rk, rn] of Object.entries(REGION)) {
    const list = neItems(150000, 'af-stadt').filter(i => C3[i.iso]?.region === rk)
    const bb = AFR.filter(c => c.region === rk && !D.LAND[c.id].insel).reduce((acc, c) => { const x = bbox(WORLD_G[c.id]); return [Math.min(acc[0], x[0]), Math.min(acc[1], x[1]), Math.max(acc[2], x[2]), Math.max(acc[3], x[3])] }, [Infinity, Infinity, -Infinity, -Infinity])
    quiz({ ...base, slug: `afrika-${rk}-staedte`, title: `${rn} – Städte`, meta: '# Städte', section: S_REG, difficulty: 'schwer', frame: frameOf(bb, 0.03), labelSize: 6, text: `Die großen Städte von ${rn}.` }, list, 'staedte')
  }
  // je Land (in Stufen)
  const LAND_STAEDTE = ISOS.filter(iso => AF_PLACES.filter(p => p.ADM0_A3 === iso).length >= 10 || (D.GG.includes(iso) && AF_PLACES.filter(p => p.ADM0_A3 === iso).length >= 6))
  for (const iso of LAND_STAEDTE) {
    const list = AF_PLACES.filter(p => p.ADM0_A3 === iso).sort((a, b) => b.POP_MAX - a.POP_MAX)
    const seenN = new Set()
    const uniq = list.filter(p => { const k = norm(p.NAME_DE || p.NAME); if (seenN.has(k)) return false; seenN.add(k); return true })
    const mk = p => {
      const name = p.NAME_DE || p.NAME
      const m = MIO.find(c => c.iso === iso && (norm(c.label) === norm(name) || norm(c.en) === norm(p.NAME)))
      return {
        key: `af-ort:${iso}:${slug(name)}`, label: name, group: p.POP_MAX >= 1e6 || m ? 'mio' : p.POP_MAX >= 250000 ? 'gross' : p.POP_MAX >= 100000 ? 'mittel' : 'klein', point: [r4(p.LONGITUDE), r4(p.LATITUDE)], iso,
        ...(p.NAME !== name ? { aliases: [p.NAME] } : {}),
        details: [{ label: 'Einwohner', value: m ? `ca. ${(m.pop / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio. (${m.year}, Ballungsraum)` : `ca. ${de(p.POP_MAX)} (ältere Schätzung)` }, ...(p.ADM1NAME ? [{ label: 'Region', value: p.ADM1NAME }] : []), ...(p.ADM0CAP ? [{ label: 'Hauptstadt', value: 'ja' }] : [])],
      }
    }
    const PG = { mio: ['über 1 Million', 'rose'], gross: ['250.000 bis 1 Million', 'ochre'], mittel: ['100.000 bis 250.000', 'blue'], klein: ['unter 100.000', 'green'] }
    const name = NAME[iso]
    const frame = frameOf(bbox(WORLD_G[iso]), 0.05)
    const tiers = uniq.length >= 40 ? [[12, 'leicht'], [uniq.length, 'schwer']] : [[uniq.length, 'mittel']]
    for (const [n, diff] of tiers) {
      const st = diff === 'leicht' ? 'Leicht' : diff === 'schwer' ? 'Schwer' : 'alle'
      quiz({ ...base, slug: `${slug(name)}-staedte${tiers.length > 1 ? `-${diff}` : ''}`, title: `${name} – Städte${tiers.length > 1 ? ` (${st})` : ''}`, meta: '# Städte', country: iso, groups: PG, frame, difficulty: diff,
        text: diff === 'leicht' ? `Die 12 größten Städte von ${name}.` : `Alle ${Math.min(n, uniq.length)} Orte aus den Daten – auch kleinere Städte.`, labelSize: 7, gg: D.GG.includes(iso) ? 'ja' : undefined,
        ask: ['Wo liegt die Stadt?', 'Welche Stadt ist markiert?'] }, uniq.slice(0, n).map(mk), 'staedte')
    }
  }
  // Hauptstädte, die umgezogen sind
  quiz({ slug: 'afrika-hauptstadt-umzuege', title: 'Neue Hauptstädte: Abuja, Dodoma & Co.', meta: '# Hauptstädte', kind: 'hauptstaedte', section: S_ST, difficulty: 'mittel', layers: ['world'], frame: AF_FRAME, groups: { neu: ['neue Hauptstadt', 'rose'] }, noun: 'Hauptstädte',
    text: 'Nigeria, Tansania, Burundi, Elfenbeinküste, Malawi, Ägypten: Wo ist die Hauptstadt hingezogen – und von wo?', ask: ['Wo liegt die neue Hauptstadt?', 'Welche Hauptstadt ist markiert?', 'Frühere Hauptstadt?'] },
  D.HAUPTSTADT_UMZUG.map(([iso, alt, neu, jahr, lon, lat, txt]) => ({ key: `af-umzug:${iso}`, label: neu, prompt: neu, group: 'neu', point: [lon, lat], iso,
    details: [{ label: 'Land', value: NAME[iso], big: true }, { label: 'Früher', value: alt }, { label: 'Seit', value: String(jahr) }, { label: 'Gut zu wissen', value: txt }],
    text: { prompt: `${NAME[iso]}: früher ${alt}, heute …?`, answer: neu } })), 'staedte')
}

/* ════════════════════════ 6. Wissen (Karten mit Merkmal) ════════════════════════ */

console.log('Wissen')
const S_SPR = 'Sprachen & Geschichte'
const S_TP = 'Tiere & Pflanzen'
const S_WI = 'Wissen: Klima, Wirtschaft & Natur'
/** Merkmals-Quiz über die 54 Länder: group = Funktion(iso) */
/**
 * Ja/Nein-Karten mit weniger als 8 Ja-Ländern ergeben auf einer Afrika-Karte keinen Sinn (z.B. Okapi = nur DR Kongo)
 * und werden nicht gebaut. Ausnahmen: feste, bekannte Gruppen.
 */
const JN_MIN = 8
const JN_AUSNAHMEN = ['afrika-deutsche-kolonien', 'afrika-inselstaaten', 'afrika-portugiesisch']
const GELOESCHT = []
function merkmal(d, groupOf, groups, detail, mk, file = d.section === S_TP || /anbau|rohstoff/.test(d.slug) ? 'themen' : 'wissen') {
  const items = AFR.map(c => {
    const g = groupOf(c.id)
    if (!g) return null
    return { key: `${d.slug}:${c.id}`, label: c.name, group: g, areas: [`world:${c.id}`], flag: flagOf(c.id), iso: c.id, aliases: c.aliases, details: detail(c.id, g), text: { prompt: c.name, sub: d.ask?.[2] ?? 'Welche Gruppe?', answer: groups[g][0] } }
  }).filter(Boolean)
  const ja = items.filter(it => it.group === 'ja').length
  if (Object.keys(groups).join() === 'ja,nein' && ja < JN_MIN && !JN_AUSNAHMEN.includes(d.slug)) { GELOESCHT.push(`${d.slug} (${ja})`); return }
  quiz({ layers: ['world'], frame: AF_FRAME, noun: 'Länder', combinable: false, intro: 'Lernmodus – die Farben auf der Karte zeigen das Merkmal. Tippe auf ein Land für Details.', merkmal: mk, ...d, groups }, items, file)
}
const L = iso => D.LAND[iso]
const JN = (ja, nein, cj = 'green') => ({ ja: [ja, cj], nein: [nein, 'slate'] })

merkmal({ slug: 'afrika-amtssprachen', title: 'Amtssprachen Afrikas', meta: 'Französisch, Englisch, Portugiesisch, Arabisch …', kind: 'sprachen', section: S_SPR, difficulty: 'leicht',
  text: 'In welchen Ländern spricht man Französisch, Englisch, Portugiesisch, Arabisch oder Spanisch als Amtssprache?', ask: ['Wo liegt das Land?', 'Welches Land ist markiert?', 'Welche Hauptsprache?'],
  tip: { title: 'GeoGuessr-Tipp', text: 'Senegal: Französisch. Ghana, Nigeria, Kenia, Uganda, Südafrika: Englisch. Tunesien: Arabisch und Französisch auf Schildern.' } },
  iso => L(iso).spG, { fr: ['Französisch', 'blue'], en: ['Englisch', 'rose'], pt: ['Portugiesisch', 'green'], ar: ['Arabisch', 'ochre'], es: ['Spanisch', 'terra'], andere: ['eigene Sprachen', 'plum'] },
  iso => [{ label: 'Amtssprachen', value: L(iso).sp.join(', '), big: true }, ...(L(iso).spNote ? [{ label: 'Hinweis', value: L(iso).spNote }] : [])],
  { alle: 'Amtssprache: {wert}', janein: '{name}: Hauptsprache {wert}?' })
for (const [k, lang, pre, col] of [['fr', 'Französisch', 'franzoesisch', 'blue'], ['en', 'Englisch', 'englisch', 'rose'], ['pt', 'Portugiesisch', 'portugiesisch', 'green'], ['ar', 'Arabisch', 'arabisch', 'ochre'], ['sw', 'Swahili', 'swahili', 'teal']]) {
  const has = iso => L(iso).sp.some(s => s.includes(lang)) || (lang === 'Französisch' && ['MLI', 'NER'].includes(iso)) || (lang === 'Englisch' && ['ZAF', 'ZWE', 'MUS'].includes(iso))
  merkmal({ slug: `afrika-${pre}`, title: `Wo ist ${lang} Amtssprache?`, meta: `${lang} · ja oder nein`, kind: 'sprachen', section: S_SPR, difficulty: 'mittel',
    text: `Alle Länder Afrikas, in denen ${lang} Amts- oder Arbeitssprache ist.`, ask: ['Wo liegt das Land?', 'Welches Land ist markiert?', `${lang} Amtssprache?`], gg: k === 'sw' ? 'ja' : undefined },
  iso => (has(iso) ? 'ja' : 'nein'), JN(`${lang} ist Amtssprache`, `kein ${lang}`, col), iso => [{ label: 'Amtssprachen', value: L(iso).sp.join(', ') }],
  { alle: `Finde alle Länder mit ${lang} als Amtssprache`, janein: `{name}: Ist ${lang} Amtssprache?` })
}
merkmal({ slug: 'afrika-kolonialmaechte', title: 'Kolonialmächte in Afrika', meta: 'Frankreich, Großbritannien, Portugal …', kind: 'historisch', section: S_SPR, difficulty: 'mittel',
  text: 'Wer hat welches Land zuletzt beherrscht? Nur Äthiopien und Liberia waren nie Kolonie.', ask: ['Wo liegt das Land?', 'Welches Land ist markiert?', 'Welche Kolonialmacht?'] },
  iso => L(iso).kolG, { frankreich: ['Frankreich', 'blue'], uk: ['Großbritannien', 'rose'], portugal: ['Portugal', 'green'], belgien: ['Belgien', 'ochre'], italien: ['Italien', 'teal'], spanien: ['Spanien', 'terra'], suedafrika: ['Südafrika (Mandat)', 'plum'], keine: ['nie Kolonie', 'slate'] },
  iso => [{ label: 'Kolonialgeschichte', value: L(iso).kol, big: true }, ...(L(iso).un ? [{ label: 'Unabhängig', value: L(iso).unText ?? String(L(iso).un) }] : [])],
  { alle: 'Kolonialmacht: {wert}', janein: '{name}: Kolonie von {wert}?' })
merkmal({ slug: 'afrika-deutsche-kolonien', title: 'Ehemalige deutsche Kolonien', meta: '6 Länder · ja oder nein', kind: 'historisch', section: S_SPR, difficulty: 'leicht',
  text: 'Togo, Kamerun, Deutsch-Südwestafrika und Deutsch-Ostafrika: Welche heutigen Länder waren bis 1919 ganz oder teilweise deutsche Kolonie?', ask: ['Wo liegt das Land?', 'Welches Land ist markiert?', 'Deutsche Kolonie?'],
  tip: { title: 'Gut zu wissen', text: 'Deutsch-Ostafrika umfasste Tansania (ohne Sansibar), Ruanda und Burundi. Teile von Ghana (Volta-Region) gehörten zu Togo.' } },
  iso => (['TGO', 'CMR', 'NAM', 'TZA', 'RWA', 'BDI'].includes(iso) ? 'ja' : 'nein'), JN('deutsche Kolonie', 'nicht deutsch', 'ochre'), iso => [{ label: 'Kolonialgeschichte', value: L(iso).kol }],
  { alle: 'Finde alle ehemaligen deutschen Kolonien', janein: '{name}: War es deutsche Kolonie?' })
const decade = iso => { const u = L(iso).un; return u == null ? 'nie' : u < 1950 ? 'vor1950' : u < 1960 ? 'j50' : u === 1960 ? 'j1960' : u < 1970 ? 'j60' : u < 1980 ? 'j70' : 'ab1980' }
merkmal({ slug: 'afrika-unabhaengigkeit', title: 'Unabhängigkeit: Wann wurde welches Land frei?', meta: 'nach Jahrzehnt', kind: 'historisch', section: S_SPR, difficulty: 'schwer',
  text: '1960 war das „Afrikanische Jahr“: 17 Länder wurden unabhängig. Wer war früher dran, wer später?', ask: ['Wo liegt das Land?', 'Welches Land ist markiert?', 'Wann unabhängig?'] },
  decade, { nie: ['nie Kolonie', 'slate'], vor1950: ['vor 1950', 'plum'], j50: ['1950–1959', 'blue'], j1960: ['1960', 'rose'], j60: ['1961–1969', 'ochre'], j70: ['1970–1979', 'green'], ab1980: ['ab 1980', 'teal'] },
  iso => [{ label: 'Unabhängig seit', value: L(iso).unText ?? (L(iso).un ? String(L(iso).un) : 'nie Kolonie'), big: true }, { label: 'Von', value: L(iso).kol }],
  { alle: 'Unabhängig: {wert}', janein: '{name}: Unabhängig {wert}?' })
merkmal({ slug: 'afrika-cfa-franc', title: 'Der CFA-Franc', meta: 'West- und Zentralafrika', kind: 'wissen', section: S_WI, difficulty: 'mittel',
  text: '14 Länder zahlen mit dem CFA-Franc – in zwei Varianten für West- und Zentralafrika, fest an den Euro gebunden.', ask: ['Wo liegt das Land?', 'Welches Land ist markiert?', 'Welche Währung?'] },
  iso => L(iso).cfa ?? 'nein', { west: ['CFA-Franc (Westafrika)', 'ochre'], zentral: ['CFA-Franc (Zentralafrika)', 'green'], nein: ['eigene Währung', 'slate'] },
  iso => [{ label: 'Währung', value: L(iso).cur, big: true }], { alle: 'Währung: {wert}', janein: '{name}: Zahlt man mit {wert}?' })
merkmal({ slug: 'afrika-linksverkehr', title: 'Linksverkehr in Afrika', meta: 'links oder rechts', kind: 'wissen', section: S_WI, difficulty: 'leicht', gg: 'ja',
  text: 'Fast das ganze östliche und südliche Afrika fährt links – ein wichtiger Hinweis in GeoGuessr.', ask: ['Wo liegt das Land?', 'Welches Land ist markiert?', 'Links oder rechts?'],
  tip: { title: 'GeoGuessr-Tipp', text: 'Linksverkehr bei den GG-Ländern: Südafrika, Namibia, Botswana, Lesotho, Eswatini, Kenia, Uganda. Rechts: Ruanda, Ghana, Nigeria, Senegal, Tunesien, Madagaskar.' } },
  iso => (L(iso).links ? 'links' : 'rechts'), { links: ['Linksverkehr', 'rose'], rechts: ['Rechtsverkehr', 'slate'] }, iso => [{ label: 'Fahrseite', value: L(iso).links ? 'links' : 'rechts', big: true }],
  { alle: 'Fahrseite: {wert}', janein: '{name}: {wert}?' })
merkmal({ slug: 'afrika-binnenstaaten', title: 'Binnenstaaten Afrikas', meta: '16 Länder ohne Meer', kind: 'laender', section: S_WI, difficulty: 'mittel',
  text: '16 Länder Afrikas haben keinen Zugang zum Meer – so viele wie auf keinem anderen Kontinent.', ask: ['Wo liegt das Land?', 'Welches Land ist markiert?', 'Binnenstaat?'] },
  iso => (L(iso).binnen ? 'ja' : 'nein'), JN('ohne Meer', 'mit Meer', 'terra'), iso => [{ label: 'Hauptstadt', value: C3[iso].capital }],
  { alle: 'Finde alle Binnenstaaten', janein: '{name}: Binnenstaat ohne Meer?' })
merkmal({ slug: 'afrika-inselstaaten', title: 'Inselstaaten Afrikas', meta: '6 Inselstaaten', kind: 'laender', section: S_WI, difficulty: 'leicht',
  text: 'Kap Verde, São Tomé und Príncipe, Madagaskar, Komoren, Mauritius und Seychellen.', ask: ['Wo liegt das Land?', 'Welches Land ist markiert?', 'Inselstaat?'] },
  iso => (L(iso).insel ? 'ja' : 'nein'), JN('Inselstaat', 'Festland', 'teal'), iso => [{ label: 'Hauptstadt', value: C3[iso].capital }],
  { alle: 'Finde alle Inselstaaten', janein: '{name}: Inselstaat?' })
merkmal({ slug: 'afrika-zeitzonen', title: 'Zeitzonen Afrikas', meta: 'UTC−1 bis UTC+4', kind: 'wissen', section: S_WI, difficulty: 'schwer',
  text: 'Von Kap Verde (UTC−1) bis Mauritius und Seychellen (UTC+4): Wie spät ist es wo?', ask: ['Wo liegt das Land?', 'Welches Land ist markiert?', 'Welche Zeitzone?'] },
  iso => `u${L(iso).utc + 1}`, { u0: ['UTC−1', 'sky'], u1: ['UTC±0', 'blue'], u2: ['UTC+1', 'green'], u3: ['UTC+2', 'ochre'], u4: ['UTC+3', 'terra'], u5: ['UTC+4', 'rose'] },
  iso => [{ label: 'Zeitzone', value: `UTC${L(iso).utc >= 0 ? '+' : '−'}${Math.abs(L(iso).utc)}`, big: true }, ...(L(iso).utcNote ? [{ label: 'Hinweis', value: L(iso).utcNote }] : [])],
  { alle: 'Zeitzone {wert}', janein: '{name}: Zeitzone {wert}?' })
{
  const AEQ = ['STP', 'GAB', 'COG', 'COD', 'UGA', 'KEN', 'SOM']
  const KREBS = ['MRT', 'MLI', 'DZA', 'NER', 'LBY', 'EGY']
  const STEINBOCK = ['NAM', 'BWA', 'ZAF', 'MOZ', 'MDG']
  merkmal({ slug: 'afrika-aequator', title: 'Äquator und Wendekreise', meta: 'Welche Länder liegen auf den Linien?', kind: 'wissen', section: S_WI, difficulty: 'mittel',
    text: 'Afrika ist der einzige Kontinent, durch den der Äquator und beide Wendekreise laufen. Welche Länder liegen auf welcher Linie?', ask: ['Wo liegt das Land?', 'Welches Land ist markiert?', 'Welche Linie?'],
    tip: { title: 'Gut zu wissen', text: 'Den Wendekreis des Krebses kreuzt auch die Westsahara.' } },
  iso => (AEQ.includes(iso) ? 'aequator' : KREBS.includes(iso) ? 'krebs' : STEINBOCK.includes(iso) ? 'steinbock' : 'keine'),
  { aequator: ['Äquator', 'rose'], krebs: ['Wendekreis des Krebses', 'ochre'], steinbock: ['Wendekreis des Steinbocks', 'teal'], keine: ['keine Linie', 'slate'] },
  (iso, g) => [{ label: 'Linie', value: g === 'keine' ? 'keine' : { aequator: 'Äquator', krebs: 'Wendekreis des Krebses (23,4° N)', steinbock: 'Wendekreis des Steinbocks (23,4° S)' }[g], big: true }],
  { alle: 'Auf der Linie: {wert}', janein: '{name}: Liegt es auf dem {wert}?' })
  const SUED = ['AGO', 'BDI', 'COM', 'MWI', 'MDG', 'MUS', 'MOZ', 'NAM', 'RWA', 'SYC', 'ZAF', 'LSO', 'SWZ', 'BWA', 'ZMB', 'ZWE', 'TZA']
  merkmal({ slug: 'afrika-sonne', title: 'Wo steht die Sonne? Nord- oder Südhalbkugel', meta: 'GeoGuessr-Wissen', kind: 'wissen', section: S_WI, difficulty: 'mittel', gg: 'ja',
    text: 'Auf der Südhalbkugel steht die Mittagssonne im Norden, auf der Nordhalbkugel im Süden. In GeoGuessr verrät dir der Schatten so die Halbkugel.', ask: ['Wo liegt das Land?', 'Welches Land ist markiert?', 'Welche Halbkugel?'],
    tip: { title: 'GeoGuessr-Tipp', text: 'Schatten zeigen mittags von der Sonne weg: Auf der Südhalbkugel fallen sie nach Süden. In Äquatornähe (Kenia, Uganda) steht die Sonne fast senkrecht.' } },
  iso => (AEQ.includes(iso) ? 'beide' : SUED.includes(iso) ? 'sued' : 'nord'),
  { nord: ['Nordhalbkugel – Sonne im Süden', 'ochre'], sued: ['Südhalbkugel – Sonne im Norden', 'indigo'], beide: ['auf dem Äquator – beides', 'rose'] },
  (iso, g) => [{ label: 'Mittagssonne', value: g === 'nord' ? 'im Süden' : g === 'sued' ? 'im Norden' : 'je nach Ort und Jahreszeit', big: true }],
  { alle: '{wert}', janein: '{name}: {wert}?' })
  merkmal({ slug: 'afrika-street-view', title: 'Street View in Afrika', meta: 'GeoGuessr · ja oder nein', kind: 'wissen', section: S_WI, difficulty: 'leicht', gg: 'ja',
    text: 'In welchen Ländern Afrikas kannst du in GeoGuessr landen? Wer das weiß, schließt sofort 40 Länder aus.', ask: ['Wo liegt das Land?', 'Welches Land ist markiert?', 'Street View?'],
    tip: { title: 'Gut zu wissen', text: 'Dazu kommt Réunion (Frankreich). In Ägypten, Tansania, Mali und São Tomé gibt es nur einzelne Orte oder inoffizielle Aufnahmen.' } },
  iso => (D.GG.includes(iso) ? 'ja' : 'nein'), JN('Street View in GeoGuessr', 'kein Street View'), iso => [{ label: 'GeoGuessr', value: D.GG.includes(iso) ? 'ja – offizielle Abdeckung' : 'nein', big: true }],
  { alle: 'Finde alle Länder mit Street View', janein: '{name}: Gibt es dort Street View?' })
}
// Anbau und Rohstoffe – je Produkt ein Quiz
for (const [prod, isos, txt] of D.ANBAU) {
  merkmal({ slug: `afrika-anbau-${slug(prod)}`, title: `Wo wächst ${prod.replace(/ \(.*\)/, '')}?`, meta: 'die größten Produzenten Afrikas', kind: 'wissen', section: S_WI, difficulty: 'mittel',
    text: txt, ask: ['Wo liegt das Land?', 'Welches Land ist markiert?', `${prod}?`] },
  iso => (isos.includes(iso) ? 'ja' : 'nein'), JN(`großer Produzent: ${prod}`, 'nicht unter den größten', 'green'),
  (iso, g) => (g === 'ja' ? [{ label: 'Rang in Afrika', value: `Nr. ${isos.indexOf(iso) + 1}`, big: true }] : []),
  { alle: `Finde die größten Produzenten: ${prod}`, janein: `{name}: Großer Produzent von ${prod}?` })
}
for (const [stoff, isos, txt] of D.ROHSTOFFE) {
  merkmal({ slug: `afrika-rohstoff-${slug(stoff)}`, title: `Rohstoffe: ${stoff}`, meta: 'die größten Förderländer Afrikas', kind: 'wissen', section: S_WI, difficulty: 'mittel',
    text: txt, ask: ['Wo liegt das Land?', 'Welches Land ist markiert?', `${stoff}?`] },
  iso => (isos.includes(iso) ? 'ja' : 'nein'), JN(`fördert ${stoff}`, 'nicht unter den größten', 'ochre'),
  (iso, g) => (g === 'ja' ? [{ label: 'Rang in Afrika', value: `Nr. ${isos.indexOf(iso) + 1}`, big: true }] : []),
  { alle: `Finde die größten Förderländer: ${stoff}`, janein: `{name}: Wird dort viel ${stoff} gefördert?` })
}
// Tiere und Pflanzen – je Art ein Karten-Quiz
for (const [name, grp, isos, txt] of D.TIERE) {
  merkmal({ slug: `afrika-tier-${slug(name)}`, title: `Wo leben ${name.startsWith('Afrikanischer') || name.endsWith('e') || /[^s]$/.test(name) ? name : name}?`, meta: `${D.TIER_GRUPPEN[grp]} · Verbreitung`, kind: 'wissen', section: S_TP, difficulty: isos.length <= 3 ? 'leicht' : 'mittel',
    text: txt, ask: ['Wo liegt das Land?', 'Welches Land ist markiert?', `${name}?`] },
  iso => (isos.includes(iso) ? 'ja' : 'nein'), JN(`${name} leben hier`, 'nicht (oder kaum)', 'green'), () => [], { alle: `Finde alle Länder: ${name}`, janein: `{name}: Leben dort ${name}?` })
}
for (const [name, grp, isos, txt] of D.PFLANZEN) {
  merkmal({ slug: `afrika-pflanze-${slug(name)}`, title: `Wo wächst ${name.replace(/ \(.*\)/, '')}?`, meta: `${D.PFLANZEN_GRUPPEN[grp]} · Verbreitung`, kind: 'wissen', section: S_TP, difficulty: 'mittel',
    gg: ['baum', 'palme', 'feld', 'wueste'].includes(grp) ? 'ja' : undefined, text: txt, ask: ['Wo liegt das Land?', 'Welches Land ist markiert?', `${name}?`] },
  iso => (isos.includes(iso) ? 'ja' : 'nein'), JN(`${name} wächst hier`, 'nicht typisch', 'olive'), () => [], { alle: `Finde alle Länder: ${name}`, janein: `{name}: Typisch für ${name}?` })
}
// Rekorde
for (const [k, title, wert, mehr] of [['flaeche', 'Die größten Länder Afrikas', 'Fläche', true], ['einwohner', 'Die bevölkerungsreichsten Länder Afrikas', 'Einwohner', true]]) {
  const val = c => (k === 'flaeche' ? Math.round(geoArea(WORLD_G[c.id]) * 6371 ** 2) : c.pop ?? 0)
  const list = [...AFR].sort((a, b) => val(b) - val(a))
  quiz({ slug: `afrika-rekord-${k}`, title, meta: `alle 54 · nach ${wert}`, kind: 'rekorde', section: S_WI, difficulty: 'mittel', layers: ['world'], frame: AF_FRAME, groups: REG_GROUPS, noun: 'Länder', combinable: false,
    text: k === 'flaeche' ? 'Algerien ist das größte Land Afrikas, die Seychellen das kleinste. Welches Land ist größer?' : 'Nigeria hat die meisten Einwohner Afrikas, die Seychellen die wenigsten. Wer hat mehr?',
    ask: ['Wo liegt das Land?', 'Welches Land ist markiert?', 'Welcher Platz?'], rang: { wert: wert === 'Fläche' ? 'Fläche (ca.)' : 'Einwohner', frage: wert === 'Fläche' ? 'Welches Land ist größer?' : 'Welches Land hat mehr Einwohner?', mehr: true } },
  list.map((c, i) => ({ key: `af-${k}:${c.id}`, label: c.name, group: c.region, areas: [`world:${c.id}`], flag: flagOf(c.id), iso: c.id,
    details: [{ label: 'Platz', value: String(i + 1), big: true }, { label: wert === 'Fläche' ? 'Fläche (ca.)' : 'Einwohner', value: k === 'flaeche' ? `${de(val(c))} km²` : de(val(c)) }],
    text: { prompt: `Platz ${i + 1} in Afrika (${wert})?`, answer: c.name } })), 'wissen')
}
// Alte Reiche
quiz({ slug: 'afrika-alte-reiche', title: 'Alte Reiche Afrikas', meta: '# Reiche', kind: 'historisch', section: S_SPR, difficulty: 'schwer', layers: ['world'], frame: AF_FRAME, groups: { reich: ['Reich (Hauptort)', 'plum'] }, noun: 'Reiche',
  text: 'Kusch, Aksum, Mali-Reich, Songhai, Groß-Simbabwe, Königreich Kongo, Benin, Aschanti, Zulu – wo lagen sie?', ask: ['Wo lag das Reich?', 'Welches Reich ist markiert?', 'In welchem heutigen Land?'],
  tip: { title: 'Vorsicht', text: 'Das alte Ghana-Reich lag in Mauretanien und Mali – das heutige Ghana hat nur den Namen übernommen. Das Königreich Benin lag in Nigeria.' } },
D.REICHE.map(([n, lon, lat, zeit, iso, txt]) => ({ key: `af-reich:${slug(n)}`, label: n, group: 'reich', point: [lon, lat], iso, details: [{ label: 'Zeit', value: zeit, big: true }, { label: 'Heute in', value: NAME[iso] }, { label: 'Gut zu wissen', value: txt }], text: { prompt: n, sub: 'In welchem heutigen Land lag der Hauptort?', answer: NAME[iso] } })), 'wissen')

/* ════════════════════════ 7. Lernkarten ════════════════════════ */

console.log('Lernkarten')
const KMETA = (ask, groups, tips, extra = {}) => ({ kind: 'words', withFlags: true, noWrite: true, ask, groups: groups ?? Object.entries(REGION).map(([k, name]) => ({ k, name })), tips, ...extra })
const card = (slugName, iso, c, n, extra = {}) => ({ key: `${slugName}:${iso}${extra._k ? `:${extra._k}` : ''}`, c, a: NAME[iso], g: C3[iso].region, flag: flagOf(iso), ...(n ? { n } : {}), ...Object.fromEntries(Object.entries(extra).filter(([k]) => !k.startsWith('_'))) })
deck({ slug: 'afrika-vorwahlen', title: 'Telefon-Vorwahlen Afrikas', meta: '# Vorwahlen · +20 bis +27, +2xx', kind: 'vorwahlen', section: S_SPR, difficulty: 'schwer', gg: 'ja',
  text: 'Alle afrikanischen Vorwahlen beginnen mit +2 – nur Ägypten (+20) und Südafrika (+27) haben zwei Ziffern.' },
AFR.map(c => card('afrika-vorwahlen', c.id, L(c.id).tel, `Vorwahl ${L(c.id).tel}`)), KMETA('Welches Land hat diese Vorwahl?', null, ['+21x: Nordafrika (212 Marokko, 213 Algerien, 216 Tunesien, 218 Libyen).', '+22x/+23x: Westafrika · +25x: Ostafrika · +26x: Südliches Afrika.']))
deck({ slug: 'afrika-domains', title: 'Länderdomains Afrikas', meta: '# Domains · .za, .ke, .ng …', kind: 'domains', section: S_SPR, difficulty: 'mittel', gg: 'ja',
  text: '.za für Südafrika (Zuid-Afrika), .ke für Kenia, .ng für Nigeria – auf Werbeschildern in GeoGuessr oft zu sehen.' },
AFR.map(c => card('afrika-domains', c.id, L(c.id).tld, `Domain ${L(c.id).tld}`)), KMETA('Welches Land hat diese Domain?', null, ['Fast immer der zweistellige ISO-Code. Südafrika: .za (von „Zuid-Afrika“).']))
deck({ slug: 'afrika-waehrungen', title: 'Währungen Afrikas', meta: '# Währungen', kind: 'wissen', section: S_WI, difficulty: 'schwer',
  text: 'Rand, Naira, Cedi, Birr, Kwacha, Pula – welches Land zahlt womit? (Ohne die 14 CFA-Franc-Länder.)' },
AFR.filter(c => !L(c.id).cfa).map(c => card('afrika-waehrungen', c.id, L(c.id).cur, `Währung: ${L(c.id).cur}`)), KMETA('Welches Land hat diese Währung?', null, ['„Kwacha“ gibt es in Malawi und Sambia – achte auf den Zusatz.', 'Pula heißt auf Setswana „Regen“.']))
deck({ slug: 'afrika-fussball', title: 'Fußball: Spitznamen der Nationalteams', meta: '# Spitznamen', kind: 'wissen', section: S_WI, difficulty: 'mittel',
  text: 'Super Eagles, Black Stars, Bafana Bafana, Atlas-Löwen, Unbezähmbare Löwen – welches Land spielt da?' },
AFR.filter(c => L(c.id).team).map(c => card('afrika-fussball', c.id, L(c.id).team, null)), KMETA('Welches Land hat diesen Spitznamen?', null, ['„Bafana Bafana“ heißt auf isiZulu „Die Jungs“.']))
deck({ slug: 'afrika-gerichte', title: 'Essen: Nationalgerichte Afrikas', meta: '# Gerichte', kind: 'wissen', section: S_WI, difficulty: 'mittel',
  text: 'Injera, Tajine, Jollof-Reis, Bobotie, Ugali, Thiéboudienne – wo isst man was?' },
D.GERICHTE.map(([iso, g, t]) => card('afrika-gerichte', iso, g, t)), KMETA('Aus welchem Land kommt das Gericht?', null, ['Maisbrei heißt in Kenia Ugali, in Sambia Nshima, in Simbabwe Sadza, in Südafrika Pap.']))
deck({ slug: 'afrika-alte-namen', title: 'Alte Ländernamen', meta: '# Namen', kind: 'historisch', section: S_SPR, difficulty: 'mittel',
  text: 'Zaire, Obervolta, Rhodesien, Dahomey, Goldküste, Swasiland, Abessinien – wie heißen die Länder heute?' },
AFR.flatMap(c => (L(c.id).alt ?? []).map((alt, i) => card('afrika-alte-namen', c.id, alt, `Heute: ${c.name}`, { _k: i }))), KMETA('Wie heißt das Land heute?', null, ['Burkina Faso heißt „Land der aufrichtigen Menschen“ – so seit 1984, vorher Obervolta.']))
deck({ slug: 'afrika-groesste-stadt', title: 'Hauptstadt oder größte Stadt?', meta: '# Länder', kind: 'hauptstaedte', section: S_ST, difficulty: 'mittel',
  text: 'In vielen Ländern ist die größte Stadt nicht die Hauptstadt. Zu welchem Land gehört die größte Stadt?' },
Object.entries(D.GROESSTE_STADT).map(([iso, st]) => card('afrika-groesste-stadt', iso, st, `Größte Stadt – die Hauptstadt ist ${C3[iso].capital}`)), KMETA('In welchem Land ist das die größte Stadt (aber nicht die Hauptstadt)?', null, []))
deck({ slug: 'afrika-unabhaengigkeit-jahr', title: 'Unabhängigkeit: Welches Land?', meta: '# Jahreszahlen', kind: 'historisch', section: S_SPR, difficulty: 'sehr-schwer',
  text: 'Ghana 1957, Kenia 1963, Simbabwe 1980, Namibia 1990, Eritrea 1993, Südsudan 2011 – welches Land gehört zur Jahreszahl?' },
AFR.filter(c => L(c.id).un && ![1960].includes(L(c.id).un)).map(c => card('afrika-unabhaengigkeit-jahr', c.id, `Unabhängig ${L(c.id).un}`, `${L(c.id).kol}`)), KMETA('Welches Land wurde in diesem Jahr unabhängig?', null, ['1960 lassen wir weg – da wurden 17 Länder unabhängig.']))
{
  const T = D.TIERE.filter(t => t[2].length === 1).map(([n, g, isos, txt]) => ({ key: `afrika-tiere-land:${slug(n)}`, c: n, a: NAME[isos[0]], g: C3[isos[0]].region, flag: flagOf(isos[0]), n: txt }))
  deck({ slug: 'afrika-tiere-land', title: 'Tiere, die nur in einem Land leben', meta: '# Tiere', kind: 'wissen', section: S_TP, difficulty: 'leicht', text: 'Okapi, Bonobo, Äthiopischer Wolf, Lemuren, Chamäleons – in welchem Land leben sie?' },
  T, KMETA('In welchem Land lebt das Tier?', null, ['Madagaskar hat viele Tiere, die es sonst nirgends gibt – über 90 % seiner Säugetiere sind endemisch.']))
}
// Schriften Afrikas (GG: Schilder lesen)
deck({ slug: 'afrika-schriften', title: 'Schriften Afrikas: Welche Schrift ist das?', meta: '# Wörter', kind: 'sprachen', section: S_SPR, difficulty: 'mittel', gg: 'ja',
  text: 'Ge’ez in Äthiopien und Eritrea, Tifinagh bei den Berbern, Arabisch im Norden, N’Ko in Westafrika – erkenne die Schrift an einem Wort.' },
[
  ['ኢትዮጵያ', 'Ge’ez (Amharisch)', 'Äthiopien – „Ityop’iya“', 'geez'], ['አዲስ አበባ', 'Ge’ez (Amharisch)', 'Addis Abeba', 'geez'], ['ሰላም', 'Ge’ez (Amharisch)', '„Selam“ – Frieden, Hallo', 'geez'],
  ['ኤርትራ', 'Ge’ez (Tigrinya)', 'Eritrea', 'geez'], ['ⵜⴰⵎⴰⵣⵉⵖⵜ', 'Tifinagh (Berber)', '„Tamazight“ – auf Schildern in Marokko und Algerien', 'tif'], ['ⴰⵣⵓⵍ', 'Tifinagh (Berber)', '„Azul“ – Hallo', 'tif'],
  ['ߒߞߏ', 'N’Ko', '„N’Ko“ – Schrift der Manding-Sprachen (Guinea, Mali)', 'nko'], ['مصر', 'Arabisch', 'Ägypten („Misr“)', 'ar'], ['تونس', 'Arabisch', 'Tunesien', 'ar'],
  ['الجزائر', 'Arabisch', 'Algerien', 'ar'], ['المغرب', 'Arabisch', 'Marokko („al-Maghrib“)', 'ar'], ['Ɛvɛ', 'Latein mit Sonderzeichen', 'Ewe (Ghana, Togo) – mit ɛ und ɔ', 'lat'],
  ['Ɗanɗano', 'Latein mit Sonderzeichen', 'Hausa (Nigeria, Niger) – mit ɗ, ƙ, ɓ', 'lat'],
].map(([w, a, n, g], i) => ({ key: `afrika-schriften:${i}`, c: w, a, g, n })),
{ kind: 'words', noWrite: true, big: true, ask: 'Welche Schrift ist das?', groups: [{ k: 'geez', name: 'Ge’ez' }, { k: 'tif', name: 'Tifinagh' }, { k: 'nko', name: 'N’Ko' }, { k: 'ar', name: 'Arabisch' }, { k: 'lat', name: 'Latein' }],
  tips: ['Ge’ez: rundliche Zeichen mit kleinen Strichen und Ringen – Äthiopien und Eritrea.', 'Tifinagh: geometrische Kreise, Kreuze und Striche – oft neben Arabisch auf Schildern in Marokko.'] })

/* ════════════════════════ Schreiben ════════════════════════ */

for (const [f, data] of Object.entries(ITEMS)) {
  const out = DECK_META[f] ? { ...data, _meta: DECK_META[f] } : data
  fs.writeFileSync(path.join(OUT_ITEMS, `${f}.json`), JSON.stringify(out))
  console.log(`  items/${f}.json  ${(fs.statSync(path.join(OUT_ITEMS, `${f}.json`)).size / 1024).toFixed(0)} KB  (${Object.keys(data).length} Quizzes)`)
}
console.log(`  Ebenen: ${(layerBytes / 1024 / 1024).toFixed(1)} MB`)
const ts = `// Erzeugt von scripts/geo/build-afrika.mjs – nicht von Hand bearbeiten.
// Jede Zeile ist ein Quiz; app/geo/_content/afrika.ts macht daraus QuizDefs (Farbnamen → palette.ts).

export interface AfDef {
  slug: string; title: string; meta: string; text: string; kind: string; section: string; difficulty: string; file: string; count: number
  layers: string[]; frame?: [[number, number], [number, number]]; groups: Record<string, [string, string]>; noun: string; ask: string[]
  country?: string; labelSize?: number; tip?: { title: string; text: string }; intro?: string; combinable?: boolean; gg?: 'ja' | 'nein'
  merkmal?: { alle: string; janein: string }; rang?: { wert: string; frage: string; mehr: boolean }; special?: 'schrift'
}

export const AF_DEFS: AfDef[] = [
${DEFS.map(d => '  ' + JSON.stringify(d)).join(',\n')},
]
`
fs.writeFileSync(path.join(root, 'app/geo/_data/afrika.ts'), ts)
console.log(`\n${DEFS.length} Quizzes:`, STATS)
console.log(`Gelöscht (unter ${JN_MIN} Ja-Ländern): ${GELOESCHT.length}`, GELOESCHT.join(", "))
