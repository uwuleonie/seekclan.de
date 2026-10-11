// Baut die Europa-Quizzes von seekclan.de/geo: Regionen und Städte aller Länder Europas, Russland in vier Stufen,
// Flughäfen, Häfen, Bahnhöfe, Postleitzahlen, Stadtteile großer Städte, Autobahnen und Bahnstrecken.
//
// Nur für Entwicklung – wird NICHT beim normalen `npm run build` ausgeführt.
// Ergebnis liegt fertig im Repo:
//   public/geo/layers/eu-*.json        Karten-Ebenen (Regionen, Stadtteile, Postleitzahlen, Straßen, Bahn)
//   public/geo/items/europa.json       Einträge (Regionen, Städte, Flughäfen, Häfen, Bahnhöfe)
//   public/geo/items/stadtteile.json   Einträge der Stadtteil-Quizzes
//   public/geo/items/verkehr.json      Einträge der Straßen-, Bahn- und PLZ-Quizzes
//   app/geo/_data/europa.ts            Anzahl Einträge je Quiz
//
// Benötigt (einmalig):  npm i -g mapshaper   ·   vorher build-welt.mjs und build-laender.mjs
// Danach:  node scripts/geo/build-europa.mjs
//
// Quellen (alle in GEO_SRC):
//  - Natural Earth 1:10m (gemeinfrei): Regionen, Häfen, Orte (deutsche Namen)
//  - GeoNames (CC BY 4.0): Lage und Einwohner der Städte
//  - OurAirports (gemeinfrei): Flughäfen
//  - db-stations / Deutsche Bahn (CC BY 4.0): Bahnhöfe
//  - yetzt/postleitzahlen (ODbL, © OpenStreetMap-Mitwirkende): Postleitzahlen
//  - OpenStreetMap über Overpass (ODbL, © OpenStreetMap-Mitwirkende): Autobahnen, Bahnstrecken, Bezirke (osm/*.json)
//  - Städte-Portale über GitHub (codeforamerica/click_that_hood, funkeinteraktiv/Berlin-Geodaten, KoelnAPI, martgnz/bcn-geodata): Stadtteile

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { geoArea, geoContains, geoCentroid, geoLength } from 'd3-geo'
import * as E from './europa-daten.mjs'
import * as V from './verkehr-daten.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const SRC = process.env.GEO_SRC || path.join(here, '.src')
const TMP = path.join(SRC, 'tmp-europa')
const OUT_LAYERS = path.join(root, 'public/geo/layers')
const OUT_ITEMS = path.join(root, 'public/geo/items')
for (const d of [TMP, OUT_LAYERS, OUT_ITEMS]) fs.mkdirSync(d, { recursive: true })

const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'))
const ms = args => execSync(`mapshaper ${args}`, { stdio: ['ignore', 'ignore', 'inherit'] })
const warn = (...a) => console.warn('  !', ...a)
const de = n => Math.round(n).toLocaleString('de-DE')
const r4 = n => Math.round(n * 1e4) / 1e4
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
function writeLayer(id, features) {
  const file = path.join(OUT_LAYERS, `${id}.json`)
  fs.writeFileSync(file, JSON.stringify({ id, f: features.map(f => ({ ...f, g: rewind(f.g) })) }))
  console.log(`  layers/${id}.json  ${(fs.statSync(file).size / 1024).toFixed(0)} KB  (${features.length})`)
}
/** Flächen mit gleicher id verschmelzen und vereinfachen → Ebene */
function dissolveLayer(id, features, interval = 600) {
  const inp = path.join(TMP, `${id}-in.json`), out = path.join(TMP, `${id}-out.json`)
  fs.writeFileSync(inp, JSON.stringify({ type: 'FeatureCollection', features }))
  ms(`"${inp}" -dissolve id gap-width=1km -simplify interval=${interval} keep-shapes -o "${out}" format=geojson precision=0.0001`)
  const res = readJson(out).features.filter(f => f.geometry)
  writeLayer(id, res.map(f => ({ i: f.properties.id, g: f.geometry })))
  return new Map(res.map(f => [f.properties.id, f.geometry]))
}
/** Linien vereinfachen → Ebene */
function lineLayer(id, features, interval = 300) {
  const inp = path.join(TMP, `${id}-in.json`), out = path.join(TMP, `${id}-out.json`)
  fs.writeFileSync(inp, JSON.stringify({ type: 'FeatureCollection', features }))
  ms(`"${inp}" -simplify interval=${interval} -o "${out}" format=geojson precision=0.0001`)
  const res = readJson(out).features.filter(f => f.geometry)
  writeLayer(id, res.map(f => ({ i: f.properties.id, g: f.geometry })))
  return new Map(res.map(f => [f.properties.id, f.geometry]))
}
const F = (id, geometry) => ({ type: 'Feature', properties: { id }, geometry })

/* ───────────── Quellen ───────────── */

const NE1 = readJson(path.join(SRC, 'ne_10m_admin_1_states_provinces.geojson')).features
const PLACES = readJson(path.join(SRC, 'ne_10m_populated_places.geojson')).features
const NAME_DE = new Map(PLACES.filter(f => f.properties.GEONAMESID > 0 && f.properties.NAME_DE).map(f => [String(f.properties.GEONAMESID), f.properties.NAME_DE]))
const CITIES = readJson(path.join(SRC, 'cities500.json'))
const worldTs = fs.readFileSync(path.join(root, 'app/geo/_data/world.ts'), 'utf8')
const COUNTRIES = JSON.parse(worldTs.slice(worldTs.indexOf('= [') + 2))
const WORLD = readJson(path.join(OUT_LAYERS, 'world.json'))
const worldShape = id => WORLD.f.find(f => f.i === id)?.g

const ITEMS = { europa: {}, stadtteile: {}, verkehr: {} }
const COUNTS = {}
const FILE_OF = {}
function quiz(file, slugName, items) {
  ITEMS[file][slugName] = items
  COUNTS[slugName] = items.length
  FILE_OF[slugName] = file
  console.log(`  quiz ${slugName}: ${items.length}`)
}
const popGroup = p => (p >= 1e6 ? 'mio' : p >= 250000 ? 'gross' : p >= 100000 ? 'mittel' : 'klein')
const germanCity = c => E.EXONYME[c.name] ?? NAME_DE.get(String(c.id)) ?? c.name

/* ════════════════════════ Regionen ════════════════════════ */

console.log('Regionen')
for (const [slugName, cfg] of Object.entries(E.REGIONEN)) {
  const feats = NE1.filter(f => (f.properties.adm0_a3 === cfg.iso || cfg.extra?.includes(f.properties.iso_3166_2)) && !cfg.skip?.includes(f.properties.iso_3166_2))
  const keyOf = p => {
    const cands = [`${p.iso_3166_2}|${p.name_de}`, `${p.name}|${p.type_en}`, p.iso_3166_2, p.name]
    return cands.find(k => cfg.map[k]) ?? (cfg.merge ? cands.map(k => cfg.merge[k]).find(Boolean) : undefined)
  }
  const idOf = k => slug(cfg.idOf?.[k] ?? k)
  const parts = []
  for (const f of feats) {
    const k = keyOf(f.properties)
    if (!k) { warn(slugName, 'ohne Zuordnung:', f.properties.iso_3166_2, f.properties.name); continue }
    parts.push(F(idOf(k), f.geometry))
  }
  const layerId = `eu-${slugName}`
  const shapes = dissolveLayer(layerId, parts, cfg.iso === 'RUS' ? 2500 : 500)
  const done = new Set()
  const items = []
  for (const [k, v] of Object.entries(cfg.map)) {
    const id = idOf(k)
    if (done.has(id)) continue
    done.add(id)
    if (!shapes.has(id)) { warn(slugName, 'Fläche fehlt', k); continue }
    const [name, cap, code] = v
    const label = cfg.nameFmt ? cfg.nameFmt(name) : name
    const capAlt = cfg.capAlias?.[cap]
    const aliases = [...new Set([...(cfg.alias?.[name] ?? []), ...(cfg.nameFmt ? [name] : []), ...(code && !cfg.groupField ? [code] : [])])]
    const grp = cfg.groupField ? v[cfg.groupField] : cfg.groupBy ? cfg.groupBy[k] : 'alle'
    items.push({
      key: `${slugName}:${id}`, label, group: grp, areas: [`${layerId}:${id}`], ...(aliases.length ? { aliases } : {}),
      details: [
        { label: cfg.capLabel, value: capAlt ? `${cap} (${capAlt})` : cap },
        ...(code && !cfg.groupField ? [{ label: cfg.codeLabel ?? 'Kürzel', value: code, big: true }] : []),
        ...(cfg.groups && grp ? [{ label: slugName.startsWith('ru-') ? 'Föderationskreis' : 'Landesteil', value: cfg.groups[grp] }] : []),
        ...(cfg.notes?.[k] ? [{ label: 'Gut zu wissen', value: cfg.notes[k] }] : []),
      ],
      ...(code && cfg.codeLabel ? { text: { prompt: label, sub: `${cfg.codeLabel}?`, answer: code, big: true } }
        : cap && cap !== label ? { text: { prompt: label, sub: `${cfg.capLabel}?`, answer: cap.split(' und ')[0] } } : {}),
    })
  }
  quiz('europa', slugName, items.sort((a, b) => a.label.localeCompare(b.label, 'de')))
}

/* ════════════════════════ Städte ════════════════════════ */

console.log('Städte')
function cityList(cc, min, cfg = {}) {
  const seen = new Set()
  return CITIES.filter(c => c.country === cc && +c.pop >= min && !cfg.dropAdmin1?.includes(c.admin1))
    .sort((a, b) => b.pop - a.pop)
    .filter(c => { const k = germanCity(c); if (seen.has(k)) return false; seen.add(k); return true })
}
function cityItem(c, prefix, extra = {}) {
  const name = germanCity(c)
  const aliases = [...new Set([c.name, NAME_DE.get(String(c.id))].filter(n => n && n !== name))]
  return {
    key: `${prefix}:${slug(name)}`, label: name, group: popGroup(+c.pop), point: [r4(+c.lon), r4(+c.lat)],
    ...(aliases.length ? { aliases } : {}),
    details: [{ label: 'Einwohner', value: `ca. ${de(+c.pop)}` }, ...(c.admin1 ? [{ label: 'Region', value: c.admin1 }] : []), ...(extra.details ?? [])],
  }
}
for (const [slugName, cfg] of Object.entries(E.STAEDTE)) {
  quiz('europa', slugName, cityList(cfg.cc, cfg.min, cfg).map(c => cityItem(c, `st:${cfg.cc}`)))
}
for (const s of E.RU_STUFEN) {
  // ohne Krim (völkerrechtlich Ukraine)
  const list = cityList('RU', s.min).filter(c => !['Crimea', 'Sevastopol'].includes(c.admin1))
  quiz('europa', s.slug, list.map(c => cityItem(c, 'st:RU')))
}

/* ════════════════════════ Flughäfen ════════════════════════ */

console.log('Flughäfen')
{
  const rows = fs.readFileSync(path.join(SRC, 'airports.csv'), 'utf8').trim().split('\n')
  const head = JSON.parse(`[${rows[0]}]`)
  const parse = line => {
    const out = []; let cur = '', q = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ } else if (ch === '"') q = false; else cur += ch }
      else if (ch === '"') q = true
      else if (ch === ',') { out.push(cur); cur = '' } else cur += ch
    }
    out.push(cur)
    return Object.fromEntries(head.map((h, i) => [h, out[i]]))
  }
  const AP = rows.slice(1).map(parse).filter(a => a.scheduled_service === 'yes' && a.iata_code && (a.type === 'large_airport' || a.type === 'medium_airport'))
  const clean = n => n.replace(/\b(International|Intl\.?|Regional)\b/g, '').replace(/\bAirport\b/g, '').replace(/\s+/g, ' ').replace(/\s*[-–]\s*$/, '').trim()
  const deName = n => Object.entries(V.FLUGHAFEN_DE).reduce((s, [en, d]) => s.replace(new RegExp(`\\b${en}\\b`, 'g'), d), n)
  for (const [slugName, cfg] of Object.entries(V.FLUGHAFEN_QUIZZES)) {
    const list = AP.filter(a => cfg.cc.includes(a.iso_country) && (!cfg.large || a.type === 'large_airport') && !cfg.drop?.includes(a.iata_code))
    quiz('europa', slugName, list.map(a => {
      const name = V.FLUGHAFEN_NAME[a.iata_code] ?? deName(clean(a.name))
      const land = COUNTRIES.find(c => c.iso2 === a.iso_country)?.name
      return {
        key: `ap:${a.iata_code}`, label: name, prompt: name, promptSub: a.iata_code, group: a.type === 'large_airport' ? 'gross' : 'mittel',
        point: [r4(+a.longitude_deg), r4(+a.latitude_deg)], aliases: [a.iata_code, a.municipality].filter(Boolean),
        details: [{ label: 'IATA-Code', value: a.iata_code, big: true }, ...(a.municipality ? [{ label: 'Ort', value: a.municipality }] : []), ...(cfg.cc.length > 1 && land ? [{ label: 'Land', value: land }] : [])],
        text: { prompt: name, sub: 'IATA-Code?', answer: a.iata_code, big: true },
      }
    }).sort((a, b) => a.label.localeCompare(b.label, 'de')))
  }
}

/* ════════════════════════ Häfen ════════════════════════ */

console.log('Häfen')
{
  const PORTS = readJson(path.join(SRC, 'ne_10m_ports.geojson')).features
  quiz('europa', 'europa-haefen', V.HAEFEN.map(([name, ne, land, meer, p, note]) => {
    const hit = ne && PORTS.find(f => f.properties.name === ne)
    const pt = hit ? hit.geometry.coordinates : p
    if (!pt) { warn('Hafen ohne Lage', name); return null }
    return {
      key: `hafen:${slug(name)}`, label: name, group: slug(meer), point: [r4(pt[0]), r4(pt[1])], pointShape: 'tri',
      details: [{ label: 'Land', value: land }, { label: 'Meer', value: meer }, ...(note ? [{ label: 'Gut zu wissen', value: note }] : [])],
      text: { prompt: name, sub: 'In welchem Land?', answer: land },
    }
  }).filter(Boolean))
}

/* ════════════════════════ Bahnhöfe ════════════════════════ */

console.log('Bahnhöfe')
{
  const st = fs.readFileSync(path.join(SRC, 'ext/db_stations.ndjson'), 'utf8').trim().split('\n').map(JSON.parse)
  const list = st.filter(s => s.category <= 2 && !V.BAHNHOF_DROP.includes(s.name))
  quiz('europa', 'de-bahnhoefe', list.map(s => ({
    key: `bf:${s.id}`, label: s.name, group: `k${s.category}`, point: [r4(s.location.longitude), r4(s.location.latitude)],
    aliases: [s.name.replace(/ Hbf$/, ' Hauptbahnhof'), s.ril100].filter(Boolean),
    details: [{ label: 'Bundesland', value: s.federalState }, { label: 'Bahnhofskategorie', value: String(s.category) }, ...(s.ril100 ? [{ label: 'Betriebsstellen-Kürzel', value: s.ril100 }] : [])],
    text: { prompt: s.name, sub: 'In welchem Bundesland?', answer: s.federalState },
  })).sort((a, b) => a.label.localeCompare(b.label, 'de')))
}

/* ════════════════════════ Stadtteile ════════════════════════ */

console.log('Stadtteile')
const osmPolys = file => {
  // OSM-Relationen (aus osm/*.json, siehe overpass-Abfragen) → GeoJSON-Polygone
  const d = readJson(path.join(SRC, 'osm', file))
  return d.elements.filter(e => e.type === 'relation').map(e => {
    const rings = joinWays(e.members.filter(m => m.role === 'outer').map(m => m.g))
    const holes = joinWays(e.members.filter(m => m.role === 'inner').map(m => m.g))
    if (!rings.length) return null
    const polys = rings.map(r => [r, ...holes.filter(h => geoContains({ type: 'Polygon', coordinates: [r] }, h[0]))])
    return { type: 'Feature', properties: { ...e.tags, osm: e.id }, geometry: rewind({ type: 'MultiPolygon', coordinates: polys }) }
  }).filter(Boolean)
}
/** Wege zu geschlossenen Ringen zusammensetzen */
function joinWays(ways) {
  const left = ways.filter(w => w && w.length > 1).map(w => [...w])
  const rings = []
  const same = (a, b) => Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7
  while (left.length) {
    let ring = left.shift()
    let grew = true
    while (!same(ring[0], ring[ring.length - 1]) && grew) {
      grew = false
      for (let i = 0; i < left.length; i++) {
        const w = left[i], end = ring[ring.length - 1]
        if (same(w[0], end)) ring = ring.concat(w.slice(1))
        else if (same(w[w.length - 1], end)) ring = ring.concat([...w].reverse().slice(1))
        else if (same(w[w.length - 1], ring[0])) ring = w.concat(ring.slice(1))
        else if (same(w[0], ring[0])) ring = [...w].reverse().concat(ring.slice(1))
        else continue
        left.splice(i, 1); grew = true; break
      }
    }
    if (same(ring[0], ring[ring.length - 1]) && ring.length > 3) rings.push(ring)
  }
  return rings
}
function districtQuiz(slugName, feats, { idOf, nameOf, groupOf, groups, detailsOf, textOf, interval = 60 }) {
  const layerId = `eu-${slugName}`
  const shapes = dissolveLayer(layerId, feats.map(f => F(idOf(f), f.geometry)), interval)
  const seen = new Set()
  quiz('stadtteile', slugName, feats.map(f => {
    const id = idOf(f)
    if (seen.has(id) || !shapes.has(id)) return null
    seen.add(id)
    const g = groupOf ? groupOf(f) : 'alle'
    return {
      key: `${slugName}:${id}`, label: nameOf(f), group: g, areas: [`${layerId}:${id}`],
      details: [...(groups && g !== 'alle' ? [{ label: 'Bezirk', value: groups[g] }] : []), ...(detailsOf?.(f) ?? [])],
      ...(textOf ? { text: textOf(f) } : {}),
    }
  }).filter(Boolean).sort((a, b) => a.label.localeCompare(b.label, 'de')))
}
const ext = n => readJson(path.join(SRC, 'ext', n)).features
const exists = n => fs.existsSync(path.join(SRC, 'osm', n))
const STADTTEIL_GROUPS = {}
{
  // Berlin
  const bez = ext('berlin_bezirke.geojson')
  districtQuiz('berlin-bezirke', bez, { idOf: f => slug(f.properties.name), nameOf: f => f.properties.name, detailsOf: f => [{ label: 'Bezirksnummer', value: String(V.BERLIN_BEZIRKE.indexOf(f.properties.name) + 1).padStart(2, '0') }] })
  STADTTEIL_GROUPS['berlin-ortsteile'] = Object.fromEntries(V.BERLIN_BEZIRKE.map((b, i) => [`b${i + 1}`, b]))
  districtQuiz('berlin-ortsteile', ext('berlin_ortsteile.geojson'), {
    idOf: f => slug(f.properties.name), nameOf: f => f.properties.name, groupOf: f => `b${+f.properties.sch.slice(6, 8)}`, groups: STADTTEIL_GROUPS['berlin-ortsteile'],
    textOf: f => ({ prompt: f.properties.name, sub: 'In welchem Bezirk?', answer: V.BERLIN_BEZIRKE[+f.properties.sch.slice(6, 8) - 1] }), interval: 40,
  })
  // Frankfurt
  districtQuiz('frankfurt-stadtteile', ext('frankfurt_stadtteile.geojson'), { idOf: f => slug(V.FRANKFURT_NAMEN[f.properties.name] ?? f.properties.name), nameOf: f => V.FRANKFURT_NAMEN[f.properties.name] ?? f.properties.name, interval: 40 })
  // Köln
  const kb = ext('koeln_stadtbezirke.geojson')
  districtQuiz('koeln-bezirke', kb, { idOf: f => slug(f.properties.STB_NAME), nameOf: f => f.properties.STB_NAME, detailsOf: f => [{ label: 'Bezirksnummer', value: f.properties.STB_NR }] })
  STADTTEIL_GROUPS['koeln-stadtteile'] = Object.fromEntries(kb.map(f => [`b${f.properties.STB_NR}`, f.properties.STB_NAME]))
  const kbOf = f => { const c = geoCentroid(f); return kb.find(b => geoContains({ type: 'Feature', geometry: rewind(b.geometry) }, c)) }
  districtQuiz('koeln-stadtteile', ext('koeln_stadtteile.geojson'), {
    idOf: f => slug(f.properties.name), nameOf: f => f.properties.name, groupOf: f => `b${kbOf(f)?.properties.STB_NR ?? 0}`, groups: STADTTEIL_GROUPS['koeln-stadtteile'],
    textOf: f => ({ prompt: f.properties.name, sub: 'In welchem Stadtbezirk?', answer: kbOf(f)?.properties.STB_NAME ?? '' }), interval: 40,
  })
  // London
  districtQuiz('london-boroughs', ext('london_boroughs.geojson'), {
    idOf: f => slug(f.properties.name), nameOf: f => f.properties.name, groupOf: f => (V.LONDON_INNER.includes(f.properties.name) ? 'inner' : 'outer'),
    groups: { inner: 'Inner London', outer: 'Outer London' },
  })
  // Paris
  districtQuiz('paris-arrondissements', ext('paris_arrondissements.geojson'), {
    idOf: f => String(V.PARIS_ARR[f.properties.name]), nameOf: f => `${V.PARIS_ARR[f.properties.name]}. Arrondissement`,
    detailsOf: f => [{ label: 'Name', value: f.properties.name }, { label: 'Postleitzahl', value: `750${String(V.PARIS_ARR[f.properties.name]).padStart(2, '0')}` }],
    textOf: f => ({ prompt: `${V.PARIS_ARR[f.properties.name]}. Arrondissement`, sub: 'Wie heißt es?', answer: f.properties.name }), interval: 30,
  })
  // Barcelona
  const bd = ext('barcelona_districtes.geojson')
  districtQuiz('barcelona-districtes', bd, { idOf: f => slug(f.properties.NOM), nameOf: f => f.properties.NOM, detailsOf: f => [{ label: 'Nummer', value: f.properties.DISTRICTE }] })
  STADTTEIL_GROUPS['barcelona-barris'] = Object.fromEntries(bd.map(f => [`d${+f.properties.DISTRICTE}`, f.properties.NOM]))
  districtQuiz('barcelona-barris', ext('barcelona_barris.geojson'), {
    idOf: f => slug(f.properties.NOM), nameOf: f => f.properties.NOM, groupOf: f => `d${+f.properties.DISTRICTE}`, groups: STADTTEIL_GROUPS['barcelona-barris'],
    textOf: f => ({ prompt: f.properties.NOM, sub: 'In welchem Bezirk?', answer: STADTTEIL_GROUPS['barcelona-barris'][`d${+f.properties.DISTRICTE}`] }), interval: 30,
  })
  // OSM-Bezirke (Lyon, Marseille, Madrid, Wien, München, Hamburg)
  const osmDone = {}
  for (const [slugName, cfg] of Object.entries(V.OSM_BEZIRKE)) {
    if (!exists(cfg.file)) { warn('fehlt', cfg.file); continue }
    let feats = osmPolys(cfg.file).filter(cfg.filter ?? (() => true))
    const nameOf = f => (cfg.name ? cfg.name(f.properties) : f.properties.name)
    let parentOf = null, groups
    if (cfg.parent) {
      // Stadtteile: nur die, die in einem Bezirk der Eltern-Ebene liegen – nach Bezirk gefärbt
      const par = osmDone[cfg.parent]
      parentOf = f => { const c = geoCentroid(f); return par.feats.find(b => geoContains(b, c)) }
      feats = feats.filter(f => parentOf(f))
      groups = Object.fromEntries(par.feats.map(b => [slug(par.nameOf(b)), par.nameOf(b)]))
      STADTTEIL_GROUPS[slugName] = groups
    }
    osmDone[slugName] = { feats, nameOf }
    districtQuiz(slugName, feats, {
      idOf: f => slug(cfg.id ? cfg.id(f.properties) : f.properties.name), nameOf,
      ...(parentOf ? { groupOf: f => slug(osmDone[cfg.parent].nameOf(parentOf(f))), groups, textOf: f => ({ prompt: nameOf(f), sub: 'In welchem Bezirk?', answer: osmDone[cfg.parent].nameOf(parentOf(f)) }) } : {}),
      detailsOf: f => (cfg.details ? cfg.details(f.properties) : []), ...(cfg.text ? { textOf: f => cfg.text(f.properties) } : {}), interval: cfg.interval ?? 40,
    })
  }
}

/* ════════════════════════ Postleitzahlen ════════════════════════ */

console.log('Postleitzahlen')
{
  const topo = path.join(SRC, 'ext/plz.topojson')
  const one = path.join(TMP, 'plz1.json'), two = path.join(TMP, 'plz2.json')
  if (!fs.existsSync(two)) {
    execSync(`node --max-old-space-size=6000 $(which mapshaper) "${topo}" -each "z1=postcode.slice(0,1), z2=postcode.slice(0,2)" -dissolve z2 copy-fields=z1 -o "${two}" format=geojson precision=0.0001`, { stdio: 'inherit' })
    execSync(`mapshaper "${two}" -dissolve z1 -o "${one}" format=geojson precision=0.0001`, { stdio: 'inherit' })
  }
  const z2 = readJson(two).features, z1 = readJson(one).features
  dissolveLayer('eu-plz-zonen', z1.map(f => F(f.properties.z1, f.geometry)), 1500)
  quiz('verkehr', 'de-plz-zonen', z1.map(f => ({
    key: `plz1:${f.properties.z1}`, label: `PLZ-Zone ${f.properties.z1}`, group: 'alle', areas: [`eu-plz-zonen:${f.properties.z1}`], aliases: [f.properties.z1],
    details: [{ label: 'Leitzone', value: f.properties.z1, big: true }, { label: 'Große Städte', value: V.PLZ_ZONEN[f.properties.z1] ?? '' }],
    text: { prompt: V.PLZ_ZONEN[f.properties.z1] ?? `Zone ${f.properties.z1}`, sub: 'Welche PLZ-Zone (erste Ziffer)?', answer: f.properties.z1, big: true },
  })).sort((a, b) => a.label.localeCompare(b.label)))
  dissolveLayer('eu-plz-regionen', z2.map(f => F(f.properties.z2, f.geometry)), 700)
  const cityIn = f => {
    const g = rewind(f.geometry)
    return CITIES.filter(c => c.country === 'DE' && +c.pop > 20000 && geoContains({ type: 'Feature', geometry: g }, [+c.lon, +c.lat])).sort((a, b) => b.pop - a.pop)[0]
  }
  quiz('verkehr', 'de-plz-regionen', z2.map(f => {
    const c = cityIn(f)
    const big = c ? germanCity(c) : null
    return {
      key: `plz2:${f.properties.z2}`, label: `PLZ ${f.properties.z2}…`, group: `z${f.properties.z1}`, areas: [`eu-plz-regionen:${f.properties.z2}`], aliases: [f.properties.z2],
      details: [{ label: 'Leitregion', value: f.properties.z2, big: true }, ...(big ? [{ label: 'Größte Stadt', value: big }] : [])],
      ...(big ? { text: { prompt: big, sub: 'Welche Leitregion (erste zwei Ziffern)?', answer: f.properties.z2, big: true } } : {}),
    }
  }).sort((a, b) => a.label.localeCompare(b.label)))
}

/* ════════════════════════ Bundestagswahlkreise 2025 ════════════════════════ */

console.log('Wahlkreise')
{
  const wk = ext('wk25.geojson')
  const lands = [...new Set(wk.map(f => f.properties.LAND_NAME))].sort((a, b) => a.localeCompare(b, 'de'))
  STADTTEIL_GROUPS['de-wahlkreise'] = Object.fromEntries(lands.map(l => [slug(l), l]))
  dissolveLayer('eu-de-wahlkreise', wk.map(f => F(String(f.properties.WKR_NR), f.geometry)), 400)
  quiz('verkehr', 'de-wahlkreise', wk.map(f => {
    const p = f.properties, nr = String(p.WKR_NR)
    return {
      key: `wk25:${nr}`, label: p.WKR_NAME, group: slug(p.LAND_NAME), areas: [`eu-de-wahlkreise:${nr}`], aliases: [nr],
      details: [{ label: 'Wahlkreis-Nummer', value: nr, big: true }, { label: 'Bundesland', value: p.LAND_NAME }],
      text: { prompt: p.WKR_NAME, sub: 'Welche Wahlkreis-Nummer?', answer: nr, big: true },
    }
  }).sort((a, b) => +a.aliases[0] - +b.aliases[0]))
}

/* ════════════════════════ Straßen & Bahn (OSM) ════════════════════════ */

console.log('Straßen & Bahn')
const country = iso => ({ type: 'Feature', geometry: worldShape(iso) })
/** Kurze Wegstücke zu langen Linien verbinden (OSM liefert Autobahnen in tausenden Einzelteilen) */
function mergeLines(lines) {
  const key = p => `${p[0].toFixed(4)},${p[1].toFixed(4)}`
  const left = new Set(lines.map((l, i) => i))
  const byEnd = new Map()
  lines.forEach((l, i) => { for (const p of [l[0], l[l.length - 1]]) { const k = key(p); if (!byEnd.has(k)) byEnd.set(k, []); byEnd.get(k).push(i) } })
  const take = (k, self) => { const c = (byEnd.get(k) ?? []).find(j => j !== self && left.has(j)); if (c !== undefined) left.delete(c); return c }
  const out = []
  for (const i of lines.keys()) {
    if (!left.has(i)) continue
    left.delete(i)
    let line = [...lines[i]]
    for (let j; (j = take(key(line[line.length - 1]), i)) !== undefined;) {
      const l = lines[j]
      line = key(l[0]) === key(line[line.length - 1]) ? line.concat(l.slice(1)) : line.concat([...l].reverse().slice(1))
    }
    for (let j; (j = take(key(line[0]), i)) !== undefined;) {
      const l = lines[j]
      line = key(l[l.length - 1]) === key(line[0]) ? l.concat(line.slice(1)) : [...l].reverse().concat(line.slice(1))
    }
    out.push(line)
  }
  return out
}

function roadQuiz(slugName, cfg) {
  if (!exists(cfg.file)) { warn('fehlt', cfg.file); return }
  const raw = readJson(path.join(SRC, 'osm', cfg.file))
  // nachgeladene Kacheln (falls Overpass beim ersten Mal zu langsam war)
  const fix = cfg.file.replace('.json', '_fix.json')
  if (exists(fix)) for (const [k, v] of Object.entries(readJson(path.join(SRC, 'osm', fix)))) raw[k] = [...(raw[k] ?? []), ...v]
  const shape = cfg.clip ? country(cfg.clip) : null
  const byRef = new Map()
  for (const [refs, lines] of Object.entries(raw)) {
    for (const r of refs.split(';').map(s => s.trim())) {
      const ref = cfg.norm(r)
      if (!ref) continue
      for (const l of lines) {
        if (shape && !l.some(p => geoContains(shape, p))) continue
        if (!byRef.has(ref)) byRef.set(ref, [])
        byRef.get(ref).push(l)
      }
    }
  }
  for (const [ref, ls] of byRef) byRef.set(ref, mergeLines(ls).filter(l => geoLength({ type: 'LineString', coordinates: l }) * 6371 > 0.3))
  const lens = new Map([...byRef].map(([ref, ls]) => [ref, ls.reduce((s, l) => s + geoLength({ type: 'LineString', coordinates: l }) * 6371, 0)]))
  let refs = [...byRef.keys()].filter(r => lens.get(r) >= (cfg.minKm ?? 20))
  if (cfg.max) refs = refs.sort((a, b) => lens.get(b) - lens.get(a)).slice(0, cfg.max)
  refs = refs.sort((a, b) => cfg.order(a) - cfg.order(b) || a.localeCompare(b, 'de'))
  const layerId = `eu-${slugName}`
  const shapes = lineLayer(layerId, refs.map(r => F(slug(r), { type: 'MultiLineString', coordinates: byRef.get(r) })), cfg.interval ?? 1500)
  quiz('verkehr', slugName, refs.filter(r => shapes.has(slug(r))).map(r => {
    const info = cfg.info?.[r]
    return {
      key: `${slugName}:${slug(r)}`, label: r, group: cfg.groupOf(r), areas: [`${layerId}:${slug(r)}`], aliases: [r.replace(/\s|-/g, ''), r.replace(/\s/g, '-')],
      details: [{ label: 'Länge (OSM, ungefähr)', value: `ca. ${de(lens.get(r) / (cfg.dual ? 2 : 1))} km` }, ...(info ? [{ label: 'Verlauf', value: info }] : [])],
      ...(info ? { text: { prompt: info, sub: 'Welche Nummer?', answer: r, big: true } } : {}),
    }
  }))
}
for (const [slugName, cfg] of Object.entries(V.STRASSEN)) roadQuiz(slugName, cfg)

// Europastraßen (Natural Earth 1:10m): nur die Hauptrouten mit ein- und zweistelliger Nummer
{
  const roads = readJson(path.join(SRC, 'ne_10m_roads.geojson')).features.filter(f => f.properties.continent === 'Europe' && /^E\s?\d{1,2}$/.test(f.properties.label ?? ''))
  const by = {}
  for (const f of roads) {
    const ref = `E ${f.properties.label.replace(/\D/g, '')}`
    const ls = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates
    ;(by[ref] ??= []).push(...ls)
  }
  const file = path.join(SRC, 'osm', 'ne_e.json')
  fs.writeFileSync(file, JSON.stringify(by))
  roadQuiz('europa-europastrassen', {
    file: 'ne_e.json', minKm: 150, interval: 3000, norm: r => r, order: r => +r.slice(2),
    groupOf: r => (+r.slice(2) % 10 === 0 ? 'west-ost' : +r.slice(2) % 10 === 5 ? 'nord-sued' : +r.slice(2) % 2 ? 'nord-sued-z' : 'west-ost-z'),
  })
}

function railQuiz(slugName, cfg) {
  if (!exists(cfg.file)) { warn('fehlt', cfg.file); return }
  const d = readJson(path.join(SRC, 'osm', cfg.file))
  const fix = cfg.file.replace('.json', '_fix.json')
  if (exists(fix)) { const ids = new Set(d.elements.map(e => e.id)); d.elements.push(...readJson(path.join(SRC, 'osm', fix)).elements.filter(e => !ids.has(e.id))) }
  // Name: OSM-Name, sonst Streckennummer mit Anfang und Ende (in Belgien z.B. "L36: Brüssel-Nord – Lüttich")
  const end = s => s.split(' - ')[0].replace(/^Y\.\s?/, '')
  const nameOf = t => t.name ?? (t.ref && t.from && t.to ? `${t.ref}: ${end(t.from)} – ${end(t.to)}` : null)
  const rels = d.elements.filter(e => e.type === 'relation' && e.tags && nameOf(e.tags) && !/^(voie|gleis|track)\s*\d/i.test(nameOf(e.tags)) && !/museum|ehemalig|^ex /i.test(nameOf(e.tags)) && (!cfg.filter || cfg.filter(e.tags)))
  const lines = rels.map(e => ({ e, name: nameOf(e.tags), coords: e.members.map(m => m.g).filter(g => g && g.length > 1) }))
    .map(x => ({ ...x, km: x.coords.reduce((s, l) => s + geoLength({ type: 'LineString', coordinates: l }) * 6371, 0) }))
    .filter(x => x.km >= (cfg.minKm ?? 40))
    .filter(x => {
      // nur Strecken, die überwiegend im Land liegen
      if (!cfg.clip) return true
      const shape = country(cfg.clip), pts = x.coords.flatMap(l => l.filter((_, i) => i % 5 === 0))
      return pts.filter(p => geoContains(shape, p)).length >= pts.length * 0.6
    })
  // gleiche Namen zusammenlegen (Hin-/Rückrichtung)
  const by = new Map()
  for (const x of lines) { const k = slug(x.name); if (!by.has(k) || by.get(k).km < x.km) by.set(k, x) }
  // Strecken, die fast ganz auf einer längeren liegen (Abschnitte, doppelte Relationen), weglassen
  const cell = p => `${Math.round(p[0] * 60)},${Math.round(p[1] * 60)}`
  const taken = new Set()
  const list = []
  // bekannte Namen (LGV, Schnellfahrstrecke, …bahn, Main Line) zuerst – die gewinnen gegen gleich verlaufende Relationen
  const famous = x => (/^(LGV|HSL|LAV|AVE|Alta|Linea AV)|Hochgeschwindigkeit|Schnellfahr|bahn$|Main Line|^HS\d|lijn$|route$/i.test(x.name) ? 3 : 1)
  for (const x of [...by.values()].sort((a, b) => b.km * famous(b) - a.km * famous(a))) {
    if (/^Ancienne |^Ligne Nouvelle|^Proyecto|Euskal Y|abandon|desmantel|stillgelegt|geplant|planned|proposed|en construction|im Bau/i.test(x.name) || /proposed|construction/.test(x.e.tags.state ?? '')) continue
    const pts = x.coords.flatMap(l => l)
    const near = pts.filter(p => taken.has(cell(p))).length
    if (pts.length && near / pts.length > 0.7) continue
    list.push(x)
    for (const p of pts) taken.add(cell(p))
    if (list.length >= (cfg.max ?? 60)) break
  }
  const layerId = `eu-${slugName}`
  const shapes = lineLayer(layerId, list.map(x => F(slug(x.name), { type: 'MultiLineString', coordinates: mergeLines(x.coords) })), cfg.interval ?? 600)
  quiz('verkehr', slugName, list.filter(x => shapes.has(slug(x.name))).map(x => ({
    key: `${slugName}:${slug(x.name)}`, label: x.name, group: cfg.groupOf ? cfg.groupOf(x.e.tags) : 'alle', areas: [`${layerId}:${slug(x.name)}`],
    ...(x.e.tags.ref ? { aliases: [x.e.tags.ref] } : {}),
    details: [{ label: 'Länge (OSM, ungefähr)', value: `ca. ${de(x.km)} km` }, ...(x.e.tags.ref ? [{ label: 'Streckennummer', value: x.e.tags.ref }] : []),
      ...(x.e.tags.maxspeed ? [{ label: 'Höchstgeschwindigkeit', value: `${x.e.tags.maxspeed} km/h` }] : [])],
  })).sort((a, b) => a.label.localeCompare(b.label, 'de')))
}
for (const [slugName, cfg] of Object.entries(V.BAHN)) {
  // Italien und Großbritannien: Strecken sind dort kaum als Relationen erfasst – stattdessen benannte Hauptstrecken-Gleise
  if (cfg.ways && exists(cfg.ways)) roadQuiz(slugName, { file: cfg.ways, clip: cfg.clip, minKm: cfg.minKm, max: cfg.max, interval: 600, norm: r => (/dismess|abandon|disused|ehemalig/i.test(r) ? null : r), order: () => 0, groupOf: () => 'alle' })
  else railQuiz(slugName, cfg)
}

/* ════════════════════════ Ausgabe ════════════════════════ */

for (const [file, items] of Object.entries(ITEMS)) {
  const p = path.join(OUT_ITEMS, `${file}.json`)
  fs.writeFileSync(p, JSON.stringify(items))
  console.log(`  items/${file}.json  ${(fs.statSync(p).size / 1024).toFixed(0)} KB`)
}
fs.writeFileSync(path.join(root, 'app/geo/_data/europa.ts'),
  `// Erzeugt von scripts/geo/build-europa.mjs – nicht von Hand bearbeiten.\n\nexport const EUROPA_COUNTS: Record<string, number> = ${JSON.stringify(COUNTS, null, 2)}\n\n` +
  `/** In welcher Datei unter public/geo/items/ die Einträge liegen */\nexport const EUROPA_FILES: Record<string, string> = ${JSON.stringify(FILE_OF, null, 2)}\n\n` +
  `/** Gruppen (Bezirke) der Stadtteil-Quizzes */\nexport const STADTTEIL_GROUPS: Record<string, Record<string, string>> = ${JSON.stringify(STADTTEIL_GROUPS, null, 2)}\n`)
console.log('fertig')
