// Baut die historischen Karten von seekclan.de/geo.
//
// Nur für Entwicklung – wird NICHT beim normalen `npm run build` ausgeführt.
// Ergebnis liegt fertig im Repo:
//   public/geo/layers/hist-*.json     Karten-Ebenen (Europa 1815, Europa 1914, Welt 1914, Kaiserreich, 1945, Berlin, 1989, Jugoslawien, Linien)
//   public/geo/items/historisch.json  Einträge aller historischen Quizzes
//   app/geo/_data/historisch.ts       Anzahl Einträge je Quiz
//
// Benötigt (einmalig):  npm i -g mapshaper   ·   vorher einmal build-welt.mjs (lädt Natural Earth)
// Danach:  node scripts/geo/build-historisch.mjs
//
// Quellen:
//  - Natural Earth 1:10m (gemeinfrei): heutige Länder und Provinzen
//  - historical-basemaps von André Ourednik (GPL-3.0): Staaten 1815 und 1914, wo es keine heutige Entsprechung gibt
//  - deutschlandGeoJSON von isellsoap (gemeinfrei, aus GADM): Landkreise und Bundesländer
//  - Ancient World Mapping Center (ODbL): Römisches Reich 117 n. Chr.
//  - LOR Berlin (Amt für Statistik Berlin-Brandenburg, CC BY 3.0 DE): Bezirksregionen für die Sektoren
//  - berlin-wall-shape (GeoNutzV Berlin, Senatsverwaltung für Stadtentwicklung): Verlauf der Mauer

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { geoArea, geoBounds, geoCentroid, geoContains, geoDistance } from 'd3-geo'
import * as H from './historisch-daten.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const SRC = process.env.GEO_SRC || path.join(here, '.src')
const HIST = path.join(SRC, 'hist')
const TMP = path.join(SRC, 'tmp-hist')
const OUT_LAYERS = path.join(root, 'public/geo/layers')
const OUT_ITEMS = path.join(root, 'public/geo/items')
for (const d of [HIST, TMP, OUT_LAYERS, OUT_ITEMS]) fs.mkdirSync(d, { recursive: true })

/* ───────────── Quellen laden ───────────── */

const HB = 'https://raw.githubusercontent.com/aourednik/historical-basemaps/master/geojson'
const DEJ = 'https://raw.githubusercontent.com/isellsoap/deutschlandGeoJSON/main'
const SOURCES = {
  'world_1815.geojson': `${HB}/world_1815.geojson`,
  'world_1914.geojson': `${HB}/world_1914.geojson`,
  'world_1930.geojson': `${HB}/world_1930.geojson`,
  'world_100.geojson': `${HB}/world_100.geojson`,
  ...Object.fromEntries(H.ZEITEN.map(z => [`world_${z.year}.geojson`, `${HB}/world_${z.year}.geojson`])),
  'awmc-data/roman_empire_ce_117_extent.geojson': 'https://raw.githubusercontent.com/AWMC/geodata/master/Cultural-Data/political_shading/roman_empire_ce_117_extent/roman_empire_ce_117_extent.geojson',
  'deutschlandGeoJSON/4_kreise/3_mittel.geo.json': `${DEJ}/4_kreise/3_mittel.geo.json`,
  'deutschlandGeoJSON/2_bundeslaender/3_mittel.geo.json': `${DEJ}/2_bundeslaender/3_mittel.geo.json`,
  'lor/berlin-lor.bezirksregionen.geojson': 'https://media.githubusercontent.com/media/technologiestiftung/berlin-lor/master/berlin-lor.bezirksregionen.geojson',
}
for (const [file, url] of Object.entries(SOURCES)) {
  const p = path.join(HIST, file)
  if (!fs.existsSync(p)) { console.log('lade', file); fs.mkdirSync(path.dirname(p), { recursive: true }); execSync(`curl -sSL -o "${p}" "${url}"`) }
}
const WALL = path.join(HIST, 'bws/package/index.geo.json')
if (!fs.existsSync(WALL)) {
  console.log('lade berlin-wall-shape')
  fs.mkdirSync(path.join(HIST, 'bws'), { recursive: true })
  execSync('npm pack berlin-wall-shape@1.0.1 --silent', { cwd: path.join(HIST, 'bws') })
  execSync('tar xzf berlin-wall-shape-1.0.1.tgz', { cwd: path.join(HIST, 'bws') })
}

const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'))
const ms = args => execSync(`mapshaper ${args}`, { stdio: ['ignore', 'ignore', 'inherit'] })
const warn = (...a) => console.warn('  !', ...a)
const de = n => Math.round(n).toLocaleString('de-DE')
const F = (id, geometry, extra = {}) => ({ type: 'Feature', properties: { id, ...extra }, geometry })

function slug(s) {
  return String(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x'
}

/** d3-geo erwartet Außenringe im Uhrzeigersinn – mapshaper schreibt GeoJSON gegen den Uhrzeigersinn */
function rewind(g) {
  if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) return g
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  const fixed = polys.map(rings => (geoArea({ type: 'Polygon', coordinates: rings }) > 2 * Math.PI ? rings.map(r => [...r].reverse()) : rings))
  return g.type === 'Polygon' ? { type: 'Polygon', coordinates: fixed[0] } : { type: 'MultiPolygon', coordinates: fixed }
}
/** Für d3 (geoContains, geoArea …) richtig herum gedrehte Kopie */
const d3g = g => rewind(JSON.parse(JSON.stringify(g)))

const layerSizes = {}
function writeLayer(id, features) {
  const out = features.filter(f => f.g).map(f => ({ ...f, g: rewind(f.g) }))
  const file = path.join(OUT_LAYERS, `${id}.json`)
  fs.writeFileSync(file, JSON.stringify({ id, f: out }))
  layerSizes[id] = fs.statSync(file).size
  console.log(`  layers/${id}.json  ${(layerSizes[id] / 1024).toFixed(0)} KB  (${out.length})`)
}

const fc = features => ({ type: 'FeatureCollection', features })
const tmp = name => path.join(TMP, name)
const writeTmp = (name, features) => { fs.writeFileSync(tmp(name), JSON.stringify(fc(features))); return tmp(name) }

/* ───────────── Grunddaten ───────────── */

const NE0 = readJson(path.join(SRC, 'ne_10m_admin_0_countries_deu.geojson')).features
const NE0_BY = Object.fromEntries(NE0.map(f => [f.properties.ADM0_A3, f]))
const NE1 = readJson(path.join(SRC, 'ne_10m_admin_1_states_provinces.geojson')).features
const SUB = readJson(path.join(SRC, 'ne_10m_admin_0_map_subunits.geojson')).features

const worldTs = fs.readFileSync(path.join(root, 'app/geo/_data/world.ts'), 'utf8')
const COUNTRIES = JSON.parse(worldTs.slice(worldTs.indexOf('= [') + 2))
const COUNTRY = Object.fromEntries(COUNTRIES.map(c => [c.id, c]))
const nameDe = iso3 => COUNTRY[iso3]?.name ?? NE0_BY[iso3]?.properties.NAME_DE ?? iso3

/** Heutiges Land als Feature */
function ne0(iso3, id) {
  const f = NE0_BY[iso3]
  if (!f) { warn('Land fehlt', iso3); return [] }
  return [F(id, f.geometry)]
}
/** Provinzen eines Landes (nur die genannten bzw. alle außer den genannten) */
function ne1(iso3, names, id, { except = false } = {}) {
  const all = NE1.filter(f => f.properties.adm0_a3 === iso3)
  if (!except) for (const n of names) if (!all.some(f => f.properties.name === n)) warn(`Provinz fehlt: ${iso3} ${n}`)
  return all.filter(f => names.includes(f.properties.name) !== except).map(f => F(id, f.geometry))
}

/* Landkreise */
const KREISE = readJson(path.join(HIST, 'deutschlandGeoJSON/4_kreise/3_mittel.geo.json')).features.map(f => {
  const p = f.properties
  const k = p.NAME_3.replace(/ Städte$/, '') + (p.TYPE_3 === 'Landkreise' ? '' : '*')
  return { land: p.NAME_1, rb: p.NAME_2, k, g: f.geometry }
})
function kreise(fn, label) {
  const out = []
  for (const k of KREISE) {
    const id = fn(k.land, k.rb, k.k)
    if (!id) { warn(`${label}: Kreis ohne Zuordnung`, k.land, k.k); continue }
    out.push(F(id, k.g))
  }
  return out
}
const LAENDER = readJson(path.join(HIST, 'deutschlandGeoJSON/2_bundeslaender/3_mittel.geo.json')).features

/* historical-basemaps */
function hb(year, map, islands = [], bbox, { nullId } = {}) {
  const d = readJson(path.join(HIST, `world_${year}.geojson`))
  const named = [], nul = []
  for (const f of d.features) {
    if (!f.geometry) continue
    const nm = (f.properties.NAME ?? '').trim() || (f.properties.PARTOF ?? '').trim()
    if (bbox) {
      let b; try { b = geoBounds(d3g(f.geometry)) } catch { continue }
      if (b[0][0] <= b[1][0] && (b[1][0] < bbox[0] || b[0][0] > bbox[2] || b[1][1] < bbox[1] || b[0][1] > bbox[3])) continue
    }
    if (!nm || nm === 'null') nul.push(f)
    else named.push(F(map[nm] ?? `x-${slug(nm)}`, f.geometry, { hbName: nm }))
  }
  // Namenlose Inseln: feste Zuordnung nach Lage, sonst der nächste benannte Staat
  const cents = named.map(f => ({ id: f.properties.id, pts: samplePts(f.geometry) }))
  for (const f of nul) {
    const c = geoCentroid(d3g(f.geometry))
    const fix = islands.find(i => c[0] >= i.box[0] && c[0] <= i.box[2] && c[1] >= i.box[1] && c[1] <= i.box[3])
    let id = fix?.id ?? nullId
    if (!id) {
      let best = Infinity
      for (const n of cents) for (const p of n.pts) {
        const dd = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2
        if (dd < best) { best = dd; id = n.id }
      }
    }
    named.push(F(id, f.geometry))
  }
  return named
}
function samplePts(g) {
  const pts = []
  const walk = c => { if (typeof c[0] === 'number') pts.push(c); else for (const x of c) walk(x) }
  walk(g.coordinates)
  const step = Math.max(1, Math.floor(pts.length / 400))
  return pts.filter((_, i) => i % step === 0)
}

/* ───────────── Zusammensetzen ───────────── */

/**
 * Baut eine Ebene aus Grundflächen (historical-basemaps) und genaueren Teilen (heutige Länder, Kreise, Provinzen).
 * Wo ein Teil liegt, wird die Grundfläche ausgeschnitten; danach wird alles mit gleicher id verschmolzen.
 */
function compose(name, { base = [], pieces = [], bbox, interval = 1000, gap = '3km' }) {
  console.log(`  ${name}: ${base.length} Grundflächen, ${pieces.length} Teile`)
  const parts = []
  if (pieces.length) parts.push(writeTmp(`${name}-pieces.json`, pieces))
  if (base.length) {
    const b = writeTmp(`${name}-base.json`, base)
    const clip = bbox ? `-clip bbox=${bbox.join(',')} ` : ''
    if (pieces.length) {
      ms(`"${tmp(`${name}-pieces.json`)}" -dissolve -o "${tmp(`${name}-fp.json`)}" format=geojson`)
      ms(`"${b}" ${clip}-erase "${tmp(`${name}-fp.json`)}" remove-slivers -o "${tmp(`${name}-base2.json`)}" format=geojson`)
    } else ms(`"${b}" ${clip}-o "${tmp(`${name}-base2.json`)}" format=geojson`)
    parts.push(tmp(`${name}-base2.json`))
  }
  const out = tmp(`${name}-out.json`)
  ms(`-i ${parts.map(p => `"${p}"`).join(' ')} combine-files -merge-layers force -dissolve id gap-width=${gap} ` +
    `-simplify interval=${interval} keep-shapes -filter-slivers gap-width=${gap} keep-shapes -o "${out}" format=geojson precision=0.0001`)
  // Flächen vorher/nachher: Reste ersetzter Staaten (x-…) fliegen raus, wenn weniger als ein Viertel übrig ist
  const areaOf = g => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []).reduce((a, p) => a + ringStats(p[0]).area, 0)
  const before = {}
  for (const b of base) if (b.properties.id.startsWith('x-')) before[b.properties.id] = (before[b.properties.id] ?? 0) + areaOf(b.geometry)
  const res = readJson(out).features.filter(f => f.geometry && f.properties.id).map(cleanParts).filter(Boolean)
    .filter(f => !before[f.properties.id] || areaOf(f.geometry) / before[f.properties.id] > 0.25)
  fillHoles(res)
  // Winzige Teile (Macau, Jungferninseln …), die mapshaper beim Vereinfachen verloren hat: unverändert übernehmen
  const have = new Set(res.map(f => f.properties.id))
  const lost = {}
  for (const p of pieces) if (!have.has(p.properties.id)) (lost[p.properties.id] ??= []).push(p.geometry)
  for (const [id, gs] of Object.entries(lost)) {
    const polys = gs.flatMap(g => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []))
    if (polys.length) res.push(F(id, { type: 'MultiPolygon', coordinates: polys }))
  }
  if (Object.keys(lost).length) console.log(`  (ergänzt: ${Object.keys(lost).join(', ')})`)
  return res
}

/** Punkt in Ring (eben, Länge/Breite) */
function inRing(pt, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
/**
 * Löcher füllen: Wo heutige Grenzen umstrittene Gebiete aussparen (z.B. Abyei zwischen Sudan und Südsudan),
 * entstünde ein Loch. Löcher, in denen keine andere Fläche liegt, werden geschlossen (Enklaven wie Lesotho bleiben).
 */
function fillHoles(features) {
  const pts = features.map(f => ({ id: f.properties.id, pts: samplePts(f.geometry) }))
  for (const f of features) {
    const g = f.geometry
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []
    for (const p of polys) {
      for (let k = p.length - 1; k >= 1; k--) {
        const hole = p[k]
        if (ringStats(hole).area > 50000) continue
        const occupied = pts.some(o => o.id !== f.properties.id && o.pts.some(q => inRing(q, hole)))
        if (!occupied) p.splice(k, 1)
      }
    }
  }
}

/**
 * Nähte aufräumen: Wo historische und heutige Grenzen nicht genau aufeinanderliegen, bleiben schmale Streifen übrig.
 * Dünne, kleine Teilflächen fliegen raus; Reste ersetzter Staaten (x-…) ebenfalls, wenn kaum etwas übrig ist.
 */
const R_KM = 6371
function ringStats(ring) {
  let per = 0
  for (let i = 1; i < ring.length; i++) per += geoDistance(ring[i - 1], ring[i]) * R_KM
  const area = geoArea(d3g({ type: 'Polygon', coordinates: [ring] })) * R_KM * R_KM
  return { area, per, compact: per ? (4 * Math.PI * area) / (per * per) : 0 }
}
function cleanParts(f) {
  const g = f.geometry
  if (g.type !== 'Polygon' && g.type !== 'MultiPolygon') return f
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  const keep = polys.filter(p => {
    const st = ringStats(p[0])
    return !(st.area < 4000 && st.compact < 0.09) && !(st.area < 40 && st.compact < 0.25)
  })
  if (!keep.length) {
    if (f.properties.id.startsWith('x-')) return null
    // winzige Gebiete (Macau, Inseln) nicht verlieren: größte Teilfläche behalten
    keep.push(polys.reduce((a, p) => (ringStats(p[0]).area > ringStats(a[0]).area ? p : a)))
  }
  const total = keep.reduce((a, p) => a + ringStats(p[0]).area, 0)
  if (f.properties.id.startsWith('x-') && total < 1500) return null
  return { ...f, geometry: keep.length === 1 ? { type: 'Polygon', coordinates: keep[0] } : { type: 'MultiPolygon', coordinates: keep } }
}

/** Linien-Umriss einer Flächen-Gruppe */
function outline(name, features, interval = 800) {
  const inp = writeTmp(`${name}-ol-in.json`, features)
  const out = tmp(`${name}-ol-out.json`)
  ms(`"${inp}" -dissolve -lines -simplify interval=${interval} -o "${out}" format=geojson precision=0.0001`)
  return geomsOf(readJson(out))
}
/** mapshaper schreibt Linien ohne Attribute als GeometryCollection */
const geomsOf = j => (j.features ? j.features.map(f => f.geometry) : j.geometries ?? []).filter(Boolean)
/** Gemeinsame Grenzen zweier Flächen-Gruppen (Feld grp) */
function innerLines(name, features, interval = 800, bbox) {
  const inp = writeTmp(`${name}-il-in.json`, features)
  const out = tmp(`${name}-il-out.json`)
  ms(`"${inp}" -dissolve grp -innerlines ${bbox ? `-clip bbox=${bbox.join(',')} ` : ''}-simplify interval=${interval} -o "${out}" format=geojson precision=0.0001`)
  return geomsOf(readJson(out))
}
/** Feature-Teile, die in einer anderen Fläche liegen (Schnitt) bzw. außerhalb (Rest) */
function clipTo(name, features, mask, mode = 'clip') {
  const a = writeTmp(`${name}-a.json`, features), m = writeTmp(`${name}-m.json`, mask)
  const out = tmp(`${name}-c.json`)
  ms(`"${a}" -${mode} "${m}" remove-slivers -o "${out}" format=geojson`)
  return readJson(out).features.filter(f => f.geometry)
}

/* ───────────── "Heute": welche heutigen Länder liegen in einer Fläche? ───────────── */

// vereinfachte Weltkarte (public/geo/layers/world.json, schon richtig herum gedreht) – viel schneller als 1:10m
const WORLD_BOXES = readJson(path.join(OUT_LAYERS, 'world.json')).f.map(f => ({ id: f.i, g: f.g, b: geoBounds(f.g) }))
function countryAt(p) {
  for (const w of WORLD_BOXES) {
    const [[x0, y0], [x1, y1]] = w.b
    if (p[1] < y0 || p[1] > y1) continue
    if (x0 <= x1 ? (p[0] < x0 || p[0] > x1) : (p[0] < x0 && p[0] > x1)) continue
    if (geoContains(w.g, p)) return w.id
  }
  return null
}
/** Anteile heutiger Länder an einer Fläche (Stichproben auf einem Raster) */
function todayOf(geom, minShare = 0.03) {
  const g = d3g(geom)
  const [[x0, y0], [x1, y1]] = geoBounds(g)
  const w = x1 >= x0 ? x1 - x0 : x1 + 360 - x0, h = y1 - y0
  let n = 0
  const count = {}
  for (let tries = 0, N = 60; tries < 3 && n < 40; tries++, N *= 3) {
    n = 0; for (const k in count) delete count[k]
    const step = Math.max(Math.sqrt((w * h) / (N * N)), 0.002)
    for (let x = x0 + step / 2; x < x0 + w; x += step) for (let y = y0 + step / 2; y < y1; y += step) {
      const p = [x > 180 ? x - 360 : x, y]
      if (!geoContains(g, p)) continue
      n++
      const c = countryAt(p)
      if (c) count[c] = (count[c] ?? 0) + 1
    }
  }
  const total = Object.values(count).reduce((a, b) => a + b, 0)
  if (!total) return []
  return Object.entries(count).filter(([, c]) => c / total >= minShare).sort((a, b) => b[1] - a[1]).map(([id, c]) => ({ id, share: c / total }))
}
const todayText = list => {
  if (!list.length) return null
  if (list.length === 1 && list[0].share > 0.97) return nameDe(list[0].id)
  return list.slice(0, 6).map(t => (list.length > 1 ? `${nameDe(t.id)} (${t.share >= 0.995 ? '100' : Math.max(1, Math.round(t.share * 100))} %)` : nameDe(t.id))).join(', ')
}

/* ───────────── Einträge ───────────── */

const ITEMS = {}
const COUNTS = {}
function quiz(slug, items) {
  ITEMS[slug] = items
  COUNTS[slug] = items.length
  console.log(`  quiz ${slug}: ${items.length}`)
}
const capShort = c => c?.split(/ \(| –|,| ·/)[0]

function details(s, extra = []) {
  const d = []
  if (s.full && s.full !== s.name) d.push({ label: 'Voller Name', value: s.full })
  if (s.cap) d.push({ label: 'Hauptstadt', value: s.cap })
  if (s.form) d.push({ label: 'Staatsform', value: s.form })
  d.push(...extra)
  if (s.today) d.push({ label: 'Heute', value: s.today })
  if (s.end) d.push({ label: 'Danach', value: s.end })
  if (s.note) d.push({ label: 'Gut zu wissen', value: s.note })
  return d
}

/* ════════════════════════ Europa 1815 ════════════════════════ */

console.log('Europa 1815')
const BBOX_EU = [-32, 25, 75, 75]
const L1815 = (() => {
  const base = hb('1815', H.HB_1815, H.HB_1815_INSELN, BBOX_EU).map(f => {
    // Sweden–Norway & Co. werden durch heutige Länder ersetzt
    return f
  })
  const pieces = [
    ...kreise(H.kreis1815, '1815'),
    ...NE1.filter(f => f.properties.adm0_a3 === 'ITA').map(f => {
      const id = H.ITALIEN_1815[f.properties.name]
      if (!id) warn('Provinz ohne Staat', f.properties.name)
      return id ? F(id, f.geometry) : null
    }).filter(Boolean),
    ...ne1('FRA', H.FRANKREICH_SARDINIEN, 'sardinien'),
    ...ne1('FRA', [...H.FRANKREICH_SARDINIEN, ...H.FRANKREICH_UEBERSEE], 'frankreich', { except: true }),
    ...ne0('GBR', 'grossbritannien'), ...ne0('IRL', 'grossbritannien'), ...ne0('IMN', 'grossbritannien'),
    ...ne0('ESP', 'spanien'), ...ne0('PRT', 'portugal'), ...ne0('CHE', 'schweiz'), ...ne0('LIE', 'liechtenstein'),
    ...ne0('NOR', 'norwegen'), ...ne0('SWE', 'schweden'), ...ne0('FIN', 'finnland'), ...ne0('ALD', 'finnland'),
    ...ne0('NLD', 'niederlande'), ...ne1('BEL', ['Luxembourg'], 'niederlande', { except: true }),
    ...ne0('LUX', 'luxemburg'), ...ne1('BEL', ['Luxembourg'], 'luxemburg'),
    ...ne0('AND', 'andorra'), ...ne0('SMR', 'san-marino'), ...ne0('MCO', 'monaco'), ...ne0('MLT', 'malta'),
    ...ne0('VAT', 'kirchenstaat'), ...ne0('GIB', 'grossbritannien'), ...ne1('GRC', ['Ionioi Nisoi'], 'ionische-inseln'),
  ]
  // Svalbard/Jan Mayen nicht zu Norwegen 1815
  const feats = compose('hist-1815', { base, pieces, bbox: BBOX_EU, interval: 600 })
  return feats
})()
writeLayer('hist-1815', L1815.map(f => ({ i: f.properties.id, g: f.geometry })))
const G1815 = Object.fromEntries(L1815.map(f => [f.properties.id, f.geometry]))

for (const [id, s] of Object.entries(H.STAATEN_1815)) {
  if (!G1815[id] && !s.point) { warn('1815: Fläche fehlt', id); continue }
  if (G1815[id]) s.today = todayText(todayOf(G1815[id]))
  else s.today = 'Hessen (Bad Homburg) und Rheinland-Pfalz (Meisenheim)'
}

const GRP_1815 = {
  gross: { name: 'Großmächte', color: '#c9637a' }, bund: { name: 'Deutscher Bund', color: '#e0a84f' },
  italien: { name: 'Italienische Staaten', color: '#5fb07a' }, uebrige: { name: 'Übrige Staaten', color: '#5b9bd5' },
}
const item1815 = (id, { prefix = '1815', areas, group, extra = [] } = {}) => {
  const s = H.STAATEN_1815[id]
  const ar = areas ?? (G1815[id] ? [`hist-1815:${id}`] : [])
  return {
    key: `${prefix}:${id}`, label: s.name, group: group ?? s.g, ...(ar.length ? { areas: ar } : {}), ...(s.point && !ar.length ? { point: s.point } : {}),
    aliases: [...(s.aliases ?? []), ...(s.full && s.full !== s.name ? [s.full] : [])],
    details: details(s, extra),
    ...(s.cap ? { text: { prompt: s.name, sub: 'Hauptstadt um 1815?', answer: capShort(s.cap) } } : {}),
  }
}
// normal
quiz('europa-1815', H.EUROPA_1815_NORMAL.map(id => item1815(id, {
  areas: [`hist-1815:${id}`, ...(H.EUROPA_1815_MIT[id] ?? []).map(x => `hist-1815:${x}`)],
  group: id === 'preussen' || id === 'oesterreich' ? 'gross' : H.STAATEN_1815[id].g,
})))
// schwer: alles
quiz('europa-1815-schwer', Object.keys(H.STAATEN_1815).filter(id => G1815[id] || H.STAATEN_1815[id].point).map(id => item1815(id)))
// Deutscher Bund
quiz('deutscher-bund-1815', H.BUND_1815.map(id => item1815(id, { prefix: 'db', group: undefined })).map(it => ({ ...it, group: 'bund' })))
// Italien
const HAUS = { savoyen: 'Haus Savoyen', habsburg: 'Habsburger', bourbon: 'Bourbonen', papst: 'Papst', frei: 'Republik & Fürstentum' }
quiz('italien-1815', Object.entries(H.STAATEN_1815).filter(([, s]) => s.g === 'italien').map(([id, s]) => ({
  ...item1815(id, { prefix: 'it1815' }), group: s.haus,
  text: { prompt: s.name, sub: 'Hauptstadt?', answer: capShort(s.cap) },
})))

/* Grenze des Deutschen Bundes (Umriss) */
const DB_LINE = (() => {
  const oesterreichBund = clipTo('db-at', [F('x', G1815.oesterreich)], [
    ...ne0('AUT', 'm'), ...ne0('CZE', 'm'), ...ne0('SVN', 'm'), ...ne1('ITA', ['Bozen', 'Trento', 'Trieste', 'Gorizia'], 'm'), ...ne1('HRV', ['Istarska'], 'm'),
  ])
  const preussenBund = clipTo('db-pr', [F('x', G1815.preussen)], [
    ...ne1('POL', ['Warmian-Masurian', 'Pomeranian', 'Kuyavian-Pomeranian', 'Greater Poland'], 'm'), ...ne1('RUS', ['Kaliningrad'], 'm'), ...ne1('LTU', ['Klaipedos'], 'm'),
  ], 'erase')
  const others = H.BUND_1815.filter(id => id !== 'oesterreich' && id !== 'preussen' && G1815[id]).map(id => F(id, G1815[id]))
  return outline('db', [...others, ...oesterreichBund, ...preussenBund], 1500)
})()

/* ════════════════════════ Deutscher Bund um 1860: Flaggen ════════════════════════ */

console.log('Deutscher Bund 1860 (Flaggen)')
const L1860 = compose('hist-1860', {
  base: L1815.map(f => F(f.properties.id, f.geometry)),
  pieces: [...kreise(H.kreis1860, '1860'), ...ne0('LUX', 'luxemburg'), ...ne0('BEL', 'belgien'), ...ne0('NLD', 'niederlande'), ...ne0('LIE', 'liechtenstein')],
  bbox: [-12, 34, 32, 62], interval: 500, gap: '2km',
})
writeLayer('hist-1860', L1860.map(f => ({ i: f.properties.id, g: f.geometry })))
const G1860 = Object.fromEntries(L1860.map(f => [f.properties.id, f.geometry]))
const name1860 = id => H.STAATEN_1860_EXTRA[id] ?? H.STAATEN_1815[id]?.name ?? id

/** Flaggen als SVG (4:3) */
function flagSvg(f) {
  const W = 120, Hh = 90
  let body = ''
  if (f.s) {
    const h = Hh / f.s.length
    body = f.s.map((c, i) => `<rect y="${(i * h).toFixed(2)}" width="${W}" height="${(h + 0.5).toFixed(2)}" fill="${c}"/>`).join('')
  } else if (f.draw === 'rauten') {
    // weiß-blaue Rauten: Schachbrett, gedreht und schräg gestellt
    body = `<rect width="${W}" height="${Hh}" fill="#fff"/><g transform="translate(60 45) skewX(-25) scale(0.8 1.25) rotate(45)">`
    for (let r = 0; r < 20; r++) for (let c = 0; c < 20; c++) if ((r + c) % 2) body += `<rect x="${c * 13 - 130}" y="${r * 13 - 130}" width="13.3" height="13.3" fill="#1e90ff"/>`
    body += '</g>'
  } else if (f.draw === 'kreuz') {
    body = `<rect width="${W}" height="${Hh}" fill="#0047ab"/><rect x="${W / 2 - 9}" width="18" height="${Hh}" fill="#e30613"/><rect y="${Hh / 2 - 9}" width="${W}" height="18" fill="#e30613"/>`
  } else if (f.draw === 'speck') {
    const n = 8, h = Hh / n
    for (let i = 0; i < n; i++) body += `<rect y="${(i * h).toFixed(2)}" width="${W}" height="${(h + 0.5).toFixed(2)}" fill="${i % 2 ? '#fff' : '#e30613'}"/>`
    for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) body += `<rect x="${c * h}" y="${(i * h).toFixed(2)}" width="${h.toFixed(2)}" height="${(h + 0.3).toFixed(2)}" fill="${(i + c) % 2 ? '#e30613' : '#fff'}"/>`
  } else if (f.draw === 'frankfurt') {
    const h = Hh / 4
    for (let i = 0; i < 4; i++) body += `<rect y="${i * h}" width="${W}" height="${h + 0.5}" fill="${i % 2 ? '#fff' : '#e30613'}"/>`
    body += `<rect width="48" height="${h * 2}" fill="#fff"/><path d="M12,8h24v18c0,9-6,14-12,17c-6-3-12-8-12-17z" fill="#e30613"/>` +
      `<path d="M24,13c2,0 3,2 3,4l6,-3l-2,6l3,1l-5,3l1,6l-4,-2l-2,5l-2,-5l-4,2l1,-6l-5,-3l3,-1l-2,-6l6,3c0,-2 1,-4 3,-4z" fill="#fff"/>`
  } else if (f.draw === 'burg') {
    body = `<rect width="${W}" height="${Hh}" fill="#e30613"/>` +
      `<path d="M38,70V44h6v-8h6v8h4V30h-3v-6h4v3h3v-3h4v3h3v-3h4v6h-3v14h4v-8h6v8h6v26z" fill="#fff"/>` +
      `<path d="M55,70v-11a5,5 0 0 1 10,0v11z" fill="#e30613"/>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none">${body}</svg>`
}
const FLAGS_HIST = {}
for (const f of H.FLAGGEN_1860) FLAGS_HIST[`h-db-${f.id}`] = flagSvg(f)
quiz('deutscher-bund-flaggen', H.FLAGGEN_1860.map(f => {
  const names = f.states.map(name1860)
  const areas = f.states.filter(id => G1860[id]).map(id => `hist-1860:${id}`)
  const pts = f.states.filter(id => !G1860[id] && H.STAATEN_1815[id]?.point)
  for (const id of f.states) if (!G1860[id] && !H.STAATEN_1815[id]?.point) warn('Flagge ohne Fläche', id)
  const label = names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} & ${names[1]}` : `${names.slice(0, -1).join(', ')} & ${names.at(-1)}`
  return {
    key: `dbf:${f.id}`, label, group: 'bund', flag: `h-db-${f.id}`, flagPrompt: true,
    ...(areas.length ? { areas } : { point: H.STAATEN_1815[pts[0]].point }),
    aliases: names,
    details: [
      { label: 'Farben', value: f.farben },
      ...(names.length > 1 ? [{ label: 'Gleiche Flagge', value: names.join(', ') }] : []),
      { label: 'Gesichert?', value: f.sicher },
      ...(f.note ? [{ label: 'Gut zu wissen', value: f.note }] : []),
    ],
    text: { prompt: f.farben, sub: 'Welcher Staat hatte diese Flagge?', answer: label },
  }
}))

/* ════════════════════════ Europa 1914 ════════════════════════ */

console.log('Europa 1914')
const L1914 = (() => {
  const base = hb('1914', H.HB_1914, H.HB_1914_INSELN, BBOX_EU)
  const ita = NE1.filter(f => f.properties.adm0_a3 === 'ITA')
  const pieces = [
    ...kreise(() => 'deutsches-reich', '1914'),
    ...ne1('FRA', H.ELSASS_LOTHRINGEN, 'elsass-lothringen'),
    ...ne1('FRA', [...H.ELSASS_LOTHRINGEN, ...H.FRANKREICH_UEBERSEE], 'frankreich', { except: true }),
    ...ita.map(f => F(H.ITALIEN_1914_AH.includes(f.properties.name) ? 'oesterreich-ungarn' : 'italien', f.geometry)),
    ...ne0('GBR', 'grossbritannien'), ...ne0('IRL', 'grossbritannien'), ...ne0('IMN', 'grossbritannien'), ...ne0('GIB', 'grossbritannien'),
    ...ne0('ESP', 'spanien'), ...ne0('PRT', 'portugal'), ...ne0('CHE', 'schweiz'), ...ne0('LIE', 'liechtenstein'),
    ...ne0('NLD', 'niederlande'), ...ne0('LUX', 'luxemburg'), ...ne0('SWE', 'schweden'), ...ne0('ISL', 'island'),
    ...ne0('AND', 'andorra'), ...ne0('SMR', 'san-marino'), ...ne0('MCO', 'monaco'), ...ne0('MLT', 'malta'), ...ne0('BIH', 'bosnien'),
    ...ne0('VAT', 'italien'),
  ]
  return compose('hist-1914', { base, pieces, bbox: BBOX_EU, interval: 700 })
})()
writeLayer('hist-1914', L1914.map(f => ({ i: f.properties.id, g: f.geometry })))
const G1914 = Object.fromEntries(L1914.map(f => [f.properties.id, f.geometry]))
for (const [id, s] of Object.entries(H.STAATEN_1914)) {
  if (!G1914[id]) { warn('1914: Fläche fehlt', id); continue }
  s.today = todayText(todayOf(G1914[id]))
}
const GRP_1914 = {
  mittel: { name: 'Mittelmächte', color: '#7a7a7a' }, entente: { name: 'Entente & Verbündete', color: '#d9774b' }, neutral: { name: 'Neutral', color: '#5b9bd5' },
}
const item1914 = (id, areas) => {
  const s = H.STAATEN_1914[id]
  return {
    key: `1914:${id}`, label: s.name, group: s.g, areas: areas ?? [`hist-1914:${id}`],
    aliases: [...(s.aliases ?? []), ...(s.full && s.full !== s.name ? [s.full] : [])],
    details: details(s, [{ label: 'Im Ersten Weltkrieg', value: s.war }]),
    text: { prompt: s.name, sub: 'Hauptstadt 1914?', answer: capShort(s.cap) },
  }
}
quiz('europa-1914', Object.entries(H.STAATEN_1914).filter(([id, s]) => !s.schwer && G1914[id])
  .map(([id]) => item1914(id, [`hist-1914:${id}`, ...(H.EUROPA_1914_MIT[id] ?? []).map(x => `hist-1914:${x}`)])))
quiz('europa-1914-schwer', Object.keys(H.STAATEN_1914).filter(id => G1914[id]).map(id => item1914(id)))

/* ════════════════════════ Welt 1914: Kolonien ════════════════════════ */

console.log('Welt 1914')
const KOLONIEN = { ...H.KOLONIEN_AFRIKA, ...H.KOLONIEN_WELT }
const LW1914 = (() => {
  const base = hb('1914', { ...H.HB_1914, ...H.HB_1914_WELT }, H.HB_1914_INSELN)
  const spMarokko = base.filter(f => f.properties.hbName === 'Spanish Morocco').map(f => F('spanisch-marokko', f.geometry))
  // Europa wie in der Europa-Karte 1914
  const pieces = L1914.filter(f => H.STAATEN_1914[f.properties.id] || f.properties.id === 'dodekanes').map(f => F(f.properties.id, f.geometry))
  for (const [id, k] of Object.entries(KOLONIEN)) {
    if (k.point) continue
    let ps = [...(k.parts ?? []).flatMap(c => ne0(c, id)), ...(k.ne1 ?? []).flatMap(([c, n]) => ne1(c, n, id)), ...(k.ne1x ?? []).flatMap(([c, n]) => ne1(c, n, id, { except: true }))]
    if (k.minusHb === 'Spanish Morocco') ps = clipTo(`minus-${id}`, ps, spMarokko, 'erase').map(f => F(id, f.geometry))
    if (k.hb === 'Spanish Morocco') ps = spMarokko
    pieces.push(...ps)
  }
  return compose('hist-welt-1914', { base, pieces, interval: 4000, gap: '6km' })
})()
writeLayer('hist-welt-1914', LW1914.map(f => ({ i: f.properties.id, g: f.geometry })))
const GW1914 = Object.fromEntries(LW1914.map(f => [f.properties.id, f.geometry]))
const kolonieItem = (id, k) => {
  const today = k.hb ? 'Marokko (Norden)' : k.point ? 'China (Qingdao)' : todayText(todayOf(GW1914[id], 0.02))
  return {
    key: `kol:${id}`, label: k.name, group: k.m,
    ...(k.point ? { point: k.point } : { areas: [`hist-welt-1914:${id}`] }), aliases: k.aliases ?? [],
    details: [
      { label: 'Kolonialmacht', value: H.MAECHTE[k.m].name },
      { label: 'Hauptstadt 1914', value: k.cap },
      ...(today ? [{ label: 'Heute', value: today }] : []),
      ...(k.note ? [{ label: 'Gut zu wissen', value: k.note }] : []),
    ],
    text: { prompt: k.name, sub: 'Zu welchem Reich gehörte es 1914?', answer: H.MAECHTE[k.m].name },
  }
}
const kolOk = ([id, k]) => k.point || GW1914[id] || (warn('Kolonie ohne Fläche', id), false)
quiz('afrika-1914', Object.entries(H.KOLONIEN_AFRIKA).filter(kolOk).map(([id, k]) => kolonieItem(id, k)))
quiz('welt-kolonien-1914', Object.entries(KOLONIEN).filter(kolOk).filter(([, k]) => k.m !== 'frei').map(([id, k]) => kolonieItem(id, k)))
quiz('welt-imperien-1914', Object.entries(H.MAECHTE).filter(([m]) => m !== 'frei' && H.MUTTERLAND[m]).map(([m, mk]) => {
  const kol = Object.entries(KOLONIEN).filter(([id, k]) => k.m === m && GW1914[id])
  const home = H.MUTTERLAND[m].filter(id => GW1914[id])
  return {
    key: `imp:${m}`, label: mk.name, group: m, areas: [...home, ...kol.map(([id]) => id)].map(id => `hist-welt-1914:${id}`),
    details: [
      { label: 'Mutterland', value: home.map(id => H.STAATEN_1914[id]?.name ?? id).join(', ') },
      { label: 'Kolonien 1914 (Auswahl)', value: kol.length ? kol.map(([, k]) => k.name).join(', ') : '–' },
    ],
  }
}).filter(it => it.areas.length))

/* ════════════════════════ Deutsches Kaiserreich ════════════════════════ */

console.log('Kaiserreich')
const LKR = (() => {
  // Preußens Ostprovinzen, Nordschleswig, Posen usw.: Deutsches Reich 1914 außerhalb des heutigen Deutschlands
  const reich = L1914.filter(f => f.properties.id === 'deutsches-reich')
  const deFp = ne0('DEU', 'm')
  // nur dort, wo das Reich 1914 wirklich über das heutige Deutschland hinausging (sonst bleiben Streifen an allen Grenzen)
  const ausserhalb = [...ne0('POL', 'm'), ...ne1('RUS', ['Kaliningrad'], 'm'), ...ne1('LTU', ['Klaipedos'], 'm'), ...ne1('DNK', ['Syddanmark'], 'm'), ...ne1('BEL', ['Liege'], 'm')]
  const ost = clipTo('kr-ost2', clipTo('kr-ost', reich, deFp, 'erase'), ausserhalb).map(f => F('preussen', f.geometry))
  const pieces = [...kreise(H.kreis1871, '1871'), ...ne1('FRA', H.ELSASS_LOTHRINGEN, 'elsass-lothringen'), ...ost]
  // Nachbarn aus der Europa-Karte 1914 als Hintergrund
  const base = L1914.filter(f => !['deutsches-reich', 'elsass-lothringen'].includes(f.properties.id)).map(f => F(f.properties.id, f.geometry))
  return compose('hist-kaiserreich', { base, pieces, bbox: [-2, 42, 30, 60], interval: 400, gap: '2km' })
})()
writeLayer('hist-kaiserreich', LKR.map(f => ({ i: f.properties.id, g: f.geometry })))
const GKR = Object.fromEntries(LKR.map(f => [f.properties.id, f.geometry]))
const ART_GRP = { Königreich: 'koenig', Großherzogtum: 'gross', Herzogtum: 'herzog', Fürstentum: 'fuerst', 'Freie Stadt': 'stadt', Reichsland: 'reichsland' }
quiz('kaiserreich-1871', Object.entries(H.STAATEN_1871).filter(([id]) => GKR[id] || (warn('Kaiserreich: Fläche fehlt', id), false)).map(([id, s]) => ({
  key: `kr:${id}`, label: s.name, group: ART_GRP[s.art], areas: [`hist-kaiserreich:${id}`],
  aliases: [...(s.aliases ?? []), s.full],
  details: details({ ...s, form: s.art, today: todayText(todayOf(GKR[id])) }),
  text: { prompt: s.name, sub: 'Hauptstadt?', answer: capShort(s.cap) },
})))

/* ════════════════════════ Berlin 1945–1990 ════════════════════════ */

console.log('Berlin')
const LOR = readJson(path.join(HIST, 'lor/berlin-lor.bezirksregionen.geojson')).features
const LBERLIN = compose('hist-berlin', {
  pieces: LOR.map(f => {
    const id = H.berlinBezirk(f.properties.SCHLUESSEL)
    if (!id) warn('LOR ohne Bezirk', f.properties.SCHLUESSEL)
    return F(id, f.geometry)
  }), interval: 25, gap: '30m',
})
const WALL_G = readJson(WALL)
writeLayer('hist-berlin', LBERLIN.map(f => ({ i: f.properties.id, g: f.geometry })))
quiz('berlin-1945', Object.entries(H.BERLIN_BEZIRKE).map(([id, b]) => ({
  key: `bln:${id}`, label: b.name, group: b.s, areas: [`hist-berlin:${id}`],
  details: [{ label: 'Sektor', value: H.SEKTOREN[b.s].name }, ...(b.note ? [{ label: 'Gut zu wissen', value: b.note }] : [])],
  text: { prompt: b.name, sub: 'Welcher Sektor?', answer: H.SEKTOREN[b.s].name },
})))
quiz('berlin-sektoren', Object.entries(H.SEKTOREN).map(([s, sk]) => ({
  key: `sek:${s}`, label: sk.name, group: s,
  areas: Object.entries(H.BERLIN_BEZIRKE).filter(([, b]) => b.s === s).map(([id]) => `hist-berlin:${id}`),
  details: [{ label: 'Bezirke', value: Object.values(H.BERLIN_BEZIRKE).filter(b => b.s === s).map(b => b.name).join(', ') }],
  aliases: { us: ['US-Sektor', 'Amerikanisch'], uk: ['Britisch'], fr: ['Französisch'], su: ['Ost-Berlin', 'Sowjetisch', 'Sowjetischer Sektor'] }[s],
})))

/* ════════════════════════ Besatzungszonen 1945 ════════════════════════ */

console.log('Zonen 1945')
const L1945 = (() => {
  const hb30 = hb('1930', {}, [], [5, 45, 25, 57]).filter(f => /^(Germany|East Prussia)$/.test(f.properties.hbName ?? ''))
  const deFp = ne0('DEU', 'm')
  const ost = clipTo('z-ost', hb30.map(f => F('x', f.geometry)), deFp, 'erase')
  const ostPl = clipTo('z-ost-pl', ost, ne0('POL', 'm')).map(f => F('ost-polen', f.geometry))
  const ostSu = clipTo('z-ost-su', ost, ne1('RUS', ['Kaliningrad'], 'm')).map(f => F('ost-su', f.geometry))
  return compose('hist-1945', { pieces: [...kreise(H.kreis1945, '1945'), ...ostPl, ...ostSu], interval: 500, gap: '2km' })
})()
writeLayer('hist-1945', L1945.map(f => ({ i: f.properties.id, g: f.geometry })))
const G1945 = Object.fromEntries(L1945.map(f => [f.properties.id, f.geometry]))
quiz('zonen-1945', Object.entries(H.ZONEN_1945).filter(([id]) => G1945[id] || (warn('1945: Fläche fehlt', id), false)).map(([id, z]) => ({
  key: `z45:${id}`, label: z.name, group: z.g, areas: [`hist-1945:${id}`], aliases: z.aliases ?? [],
  details: [{ label: 'Gebiet', value: z.note }, { label: 'Heute', value: todayText(todayOf(G1945[id])) ?? '–' }],
})))

/* ════════════════════════ Europa 1989 ════════════════════════ */

console.log('Europa 1989')
const WEST_LAENDER = ['Baden-Württemberg', 'Bayern', 'Bremen', 'Hamburg', 'Hessen', 'Niedersachsen', 'Nordrhein-Westfalen', 'Rheinland-Pfalz', 'Saarland', 'Schleswig-Holstein']
const L1989 = (() => {
  const pieces = []
  for (const f of LAENDER) {
    const n = f.properties.name
    if (n === 'Berlin') continue
    pieces.push(F(WEST_LAENDER.includes(n) ? 'brd' : 'ddr', f.geometry))
  }
  for (const f of LBERLIN) pieces.push(F(H.BERLIN_BEZIRKE[f.properties.id].s === 'su' ? 'ddr' : 'west-berlin', f.geometry))
  for (const c of ['CZE', 'SVK']) pieces.push(...ne0(c, 'cssr'))
  for (const c of ['SVN', 'HRV', 'BIH', 'SRB', 'MNE', 'MKD', 'KOS']) pieces.push(...ne0(c, 'jugoslawien'))
  for (const c of Object.keys(H.SSR)) pieces.push(...ne0(c, 'sowjetunion'))
  return compose('hist-1989', { pieces, interval: 1500, gap: '2km' })
})()
writeLayer('hist-1989', L1989.map(f => ({ i: f.properties.id, g: f.geometry })))
const GRP_1989 = { nato: 'NATO', wp: 'Warschauer Pakt', neutral: 'Neutral & blockfrei', sonder: 'Sonderstatus' }
quiz('europa-1989', Object.entries(H.EUROPA_1989).map(([id, s]) => ({
  key: `1989:${id}`, label: s.name, group: s.g, areas: [s.hist ? `hist-1989:${id}` : `world:${id}`], aliases: s.aliases ?? [],
  details: [
    { label: 'Hauptstadt 1989', value: s.cap }, { label: 'Bündnis', value: s.join },
    { label: 'Heute', value: s.today ?? nameDe(id) }, ...(s.note ? [{ label: '1989', value: s.note }] : []),
  ],
  text: { prompt: s.name, sub: 'NATO, Warschauer Pakt oder neutral?', answer: GRP_1989[s.g] },
})))

/* ════════════════════════ Jugoslawien ════════════════════════ */

console.log('Jugoslawien')
const LYU = compose('hist-jugoslawien', {
  pieces: Object.entries(H.JUGOSLAWIEN).flatMap(([id, r]) => r.su.map(su => {
    const f = SUB.find(x => x.properties.SU_A3 === su)
    if (!f) warn('Teilgebiet fehlt', su)
    return f ? F(id, f.geometry) : null
  }).filter(Boolean)), interval: 300, gap: '1km',
})
writeLayer('hist-jugoslawien', LYU.map(f => ({ i: f.properties.id, g: f.geometry })))
quiz('jugoslawien', Object.entries(H.JUGOSLAWIEN).map(([id, r]) => ({
  key: `yu:${id}`, label: r.name, group: r.g, areas: [`hist-jugoslawien:${id}`], aliases: r.aliases ?? [],
  details: [
    { label: 'Hauptstadt', value: r.cap }, { label: 'Unabhängig', value: r.ind }, { label: 'Heute', value: r.today },
    ...(r.note ? [{ label: 'Gut zu wissen', value: r.note }] : []),
  ],
  text: { prompt: r.name, sub: 'Hauptstadt zur Zeit Jugoslawiens?', answer: r.capThen ?? capShort(r.cap) },
})))

/* ════════════════════════ Sowjetunion & neue Staaten (heutige Grenzen) ════════════════════════ */

quiz('ex-sowjetstaaten', Object.entries(H.SSR).map(([id, r]) => ({
  key: `ssr:${id}`, label: nameDe(id), group: r.g, areas: [`world:${id}`], aliases: [r.ssr, ...(r.aliases ?? [])],
  details: [
    { label: 'Sowjetrepublik', value: r.ssr }, { label: 'Hauptstadt damals', value: r.capThen }, { label: 'Hauptstadt heute', value: r.cap },
    { label: 'Unabhängig seit', value: r.ind }, ...(r.note ? [{ label: 'Gut zu wissen', value: r.note }] : []),
  ],
  text: { prompt: r.ssr, sub: 'Hauptstadt zu Sowjetzeiten?', answer: r.capThen.split(' (')[0] },
})))
quiz('neue-staaten', Object.entries(H.NEUE_STAATEN).map(([id, s]) => ({
  key: `neu:${id}`, label: nameDe(id), group: s.g, areas: [`world:${id}`],
  details: [{ label: s.g === 'vereinigt' ? 'Vereinigt' : 'Unabhängig', value: s.d }, { label: 'Vorher', value: s.from }],
  text: { prompt: nameDe(id), sub: 'In welchem Jahr?', answer: String(s.y) },
})))

/* ════════════════════════ Punkte: Weltwunder, Hauptstädte, alte Namen, Hanse ════════════════════════ */

quiz('weltwunder', H.WELTWUNDER.map(w => ({
  key: `ww:${w.id}`, label: w.name, group: w.g, point: w.p, aliases: w.aliases ?? [], pointShape: 'tri',
  details: [{ label: 'Ort', value: w.where }, ...(w.note ? [{ label: 'Gut zu wissen', value: w.note }] : [])],
  text: { prompt: w.name, sub: 'Antikes oder neues Weltwunder?', answer: w.g === 'antik' ? 'Antikes Weltwunder' : 'Neues Weltwunder (2007)' },
})))
quiz('ehemalige-hauptstaedte', H.EHEMALIGE_HAUPTSTAEDTE.map(c => ({
  key: `eh:${slug(c.name)}`, label: c.name, group: c.g, point: c.p, aliases: c.aliases ?? [],
  details: [{ label: 'Hauptstadt von', value: c.of }, { label: 'Zeitraum', value: c.when }, { label: 'Heutige Hauptstadt', value: c.now }, ...(c.note ? [{ label: 'Gut zu wissen', value: c.note }] : [])],
  text: { prompt: c.name, sub: `Hauptstadt ${c.when} – von welchem Staat?`, answer: c.of },
})))
quiz('alte-staedtenamen', H.ALTE_NAMEN.map(c => ({
  key: `an:${slug(c.old)}`, label: c.old, group: c.g, point: c.p, aliases: c.aliases ?? [],
  details: [{ label: 'Heute', value: c.now }, ...(c.since ? [{ label: 'Umbenannt', value: c.since }] : [])],
  text: { prompt: c.old, sub: 'Wie heißt die Stadt heute?', answer: c.now },
})))
quiz('hanse', H.HANSE.map(c => ({
  key: `hanse:${slug(c.name)}`, label: c.name, group: c.g, point: c.p, aliases: c.aliases ?? [],
  details: [...(c.note ? [{ label: 'Gut zu wissen', value: c.note }] : [])],
})))

/* ════════════════════════ Antike Welt 117 n. Chr. ════════════════════════ */

console.log('Antike')
const LANTIKE = (() => {
  const base = hb('100', H.HB_100, H.HB_100_FLAECHEN, [-25, -10, 145, 70], { nullId: 'x-unbekannt' })
  const rom = readJson(path.join(HIST, 'awmc-data/roman_empire_ce_117_extent.geojson')).features.filter(f => f.geometry).map(f => F('rom', f.geometry))
  return compose('hist-antike', { base, pieces: rom, bbox: [-25, -10, 145, 70], interval: 3000, gap: '5km' })
})()
writeLayer('hist-antike', LANTIKE.map(f => ({ i: f.properties.id, g: f.geometry })))
const GANT = Object.fromEntries(LANTIKE.map(f => [f.properties.id, f.geometry]))
quiz('antike-117', Object.entries(H.ANTIKE).filter(([id]) => GANT[id] || (warn('Antike: Fläche fehlt', id), false)).map(([id, s]) => ({
  key: `ant:${id}`, label: s.name, group: s.g, areas: [`hist-antike:${id}`], aliases: s.aliases ?? [],
  details: details({ ...s, today: todayText(todayOf(GANT[id], 0.04)) }),
  ...(s.cap && s.cap !== '–' ? { text: { prompt: s.name, sub: 'Hauptstadt um 117?', answer: capShort(s.cap) } } : {}),
})))

/* ════════════════════════ Zeitmaschine ════════════════════════ */

console.log('Zeitmaschine')
for (const z of H.ZEITEN) {
  const base = hb(String(z.year), {}, [], [-30, 25, 70, 75])
  const feats = compose(`hist-zeit-${z.year}`, { base, bbox: [-30, 25, 70, 75], interval: 3500, gap: '5km' })
  writeLayer(`hist-zeit-${z.year}`, feats.map((f, i) => ({ i: `${f.properties.id}`, g: f.geometry })))
}

/* ════════════════════════ Linien ════════════════════════ */

console.log('Linien')
const toMulti = gs => ({ type: 'MultiLineString', coordinates: gs.flatMap(g => (g.type === 'LineString' ? [g.coordinates] : g.coordinates)) })
const LINES0 = [
  { i: 'bund-1815', g: toMulti(DB_LINE) },
  { i: 'mauer', g: WALL_G.type === 'FeatureCollection' ? toMulti(WALL_G.features.map(f => f.geometry)) : toMulti([WALL_G]) },
  // innerdeutsche Grenze: aus den Bundesländern (die passen exakt aufeinander)
  { i: 'innerdeutsch', g: toMulti(innerLines('idg', LAENDER.filter(f => f.properties.name !== 'Berlin')
    .map(f => ({ type: 'Feature', properties: { grp: WEST_LAENDER.includes(f.properties.name) ? 'brd' : 'ddr' }, geometry: f.geometry })), 600)) },
  // Eiserner Vorhang: Grenzen zwischen Ostblock und Westen (ohne Deutschland) + bayerisch-tschechische Grenze + innerdeutsche Grenze
  {
    i: 'eiserner-vorhang', g: toMulti([
      ...innerLines('ev', NE0.filter(f => f.properties.ADM0_A3 !== 'DEU').map(f => {
        const id = f.properties.ADM0_A3
        const ost = H.SSR[id] || ['POL', 'CZE', 'SVK', 'HUN', 'ROU', 'BGR'].includes(id)
        return { type: 'Feature', properties: { grp: ost ? 'ost' : 'west' }, geometry: f.geometry }
      }), 1500, [-12, 34, 45.5, 72]),
      ...innerLines('ev-by', [...ne0('DEU', 'x'), ...ne0('CZE', 'y')].map(f => ({ ...f, properties: { grp: f.properties.id } })), 800, [11, 48, 13.95, 50.33]),
    ]),
  },
]

/* ════════════════════════ Ausgabe ════════════════════════ */

// innerdeutsche Grenze gehört auch zum Eisernen Vorhang
const LINES = LINES0.map(l => (l.i === 'eiserner-vorhang' ? { ...l, g: { type: 'MultiLineString', coordinates: [...l.g.coordinates, ...LINES0.find(x => x.i === 'innerdeutsch').g.coordinates] } } : l))
writeLayer('hist-linien', LINES)
fs.writeFileSync(path.join(root, 'public/geo/flags-hist.json'), JSON.stringify(FLAGS_HIST))
console.log(`  flags-hist.json  ${Object.keys(FLAGS_HIST).length} Flaggen`)
fs.writeFileSync(path.join(OUT_ITEMS, 'historisch.json'), JSON.stringify(ITEMS))
console.log(`  items/historisch.json  ${(fs.statSync(path.join(OUT_ITEMS, 'historisch.json')).size / 1024).toFixed(0)} KB`)
fs.writeFileSync(path.join(root, 'app/geo/_data/historisch.ts'),
  `// Erzeugt von scripts/geo/build-historisch.mjs – nicht von Hand bearbeiten.\n\nexport const HIST_COUNTS: Record<string, number> = ${JSON.stringify(COUNTS, null, 2)}\n`)
console.log('fertig')
