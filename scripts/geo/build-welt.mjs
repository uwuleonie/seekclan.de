// Baut alle Daten für die Welt-Quizzes von seekclan.de/geo.
//
// Nur für Entwicklung – wird NICHT beim normalen `npm run build` ausgeführt.
// Ergebnis liegt fertig im Repo:
//   public/geo/layers/*.json   Karten-Ebenen (Kontinente, Meere, Gebirge, Flüsse, Seen, Wüsten, Überseegebiete)
//   public/geo/items/*.json    Einträge der Quizzes (werden erst beim Öffnen eines Quiz geladen)
//   public/geo/flags.json      alle Flaggen als SVG
//   app/geo/_data/welt-extra.ts  ISO-Codes + Anzahl Einträge je Quiz
//
// Benötigt (einmalig):  npm i -g mapshaper
// Danach:  node scripts/geo/build-welt.mjs      (lädt Quellen nach scripts/geo/.src, falls nicht vorhanden)
//
// Quellen (alle frei nutzbar):
//  - Natural Earth 1:10m/1:50m (gemeinfrei): Länder, Teilgebiete, Meere, Gebirge, Gipfel, Flüsse, Seen, Wüsten, Orte
//  - CIA World Factbook (gemeinfrei, Stand 2025): Fläche der Länder
//  - Weltbank (CC BY 4.0, über github.com/datasets/population): Einwohner
//  - github.com/datasets/country-codes (ODC-PDDL): ISO-Codes, Vorwahlen, Länderdomains
//  - github.com/mledoze/countries (ODbL): Binnenstaaten
//  - GeoNames (CC BY 4.0, über github.com/lmfmaier/cities-json): Einwohner der Städte
//  - OurAirports (gemeinfrei): Flughäfen
//  - flag-icons (MIT): Flaggen

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { geoArea, geoBounds, geoCentroid, geoContains, geoDistance } from 'd3-geo'
import * as D from './welt-daten.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const SRC = process.env.GEO_SRC || path.join(here, '.src')
const TMP = path.join(SRC, 'tmp-welt')
const OUT_LAYERS = path.join(root, 'public/geo/layers')
const OUT_ITEMS = path.join(root, 'public/geo/items')
for (const d of [SRC, TMP, OUT_LAYERS, OUT_ITEMS, path.join(SRC, 'factbook')]) fs.mkdirSync(d, { recursive: true })

/* ───────────── Quellen laden ───────────── */

const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson'
const SOURCES = {
  'ne_10m_admin_0_countries_deu.geojson': `${NE}/ne_10m_admin_0_countries_deu.geojson`,
  'ne_10m_admin_0_map_subunits.geojson': `${NE}/ne_10m_admin_0_map_subunits.geojson`,
  'ne_10m_admin_0_map_units.geojson': `${NE}/ne_10m_admin_0_map_units.geojson`,
  'ne_10m_geography_marine_polys.geojson': `${NE}/ne_10m_geography_marine_polys.geojson`,
  'ne_10m_geography_regions_polys.geojson': `${NE}/ne_10m_geography_regions_polys.geojson`,
  'ne_10m_geography_regions_elevation_points.geojson': `${NE}/ne_10m_geography_regions_elevation_points.geojson`,
  'ne_50m_rivers_lake_centerlines_scale_rank.geojson': `${NE}/ne_50m_rivers_lake_centerlines_scale_rank.geojson`,
  'ne_10m_rivers_lake_centerlines.geojson': `${NE}/ne_10m_rivers_lake_centerlines.geojson`,
  'ne_10m_rivers_europe.geojson': `${NE}/ne_10m_rivers_europe.geojson`,
  'ne_10m_lakes.geojson': `${NE}/ne_10m_lakes.geojson`,
  'ne_10m_populated_places.geojson': `${NE}/ne_10m_populated_places.geojson`,
  'country-codes.csv': 'https://raw.githubusercontent.com/datasets/country-codes/main/data/country-codes.csv',
  'population.csv': 'https://raw.githubusercontent.com/datasets/population/main/data/population.csv',
  'countries.json': 'https://raw.githubusercontent.com/mledoze/countries/master/countries.json',
  'cities500.json': 'https://raw.githubusercontent.com/lmfmaier/cities-json/master/cities500.json',
  'airports.csv': 'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv',
}
for (const [file, url] of Object.entries(SOURCES)) {
  const p = path.join(SRC, file)
  if (!fs.existsSync(p)) { console.log('lade', file); execSync(`curl -sSL -o "${p}" "${url}"`) }
}

const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'))
const src = f => path.join(SRC, f)
const r3 = n => Math.round(n * 1000) / 1000
const ms = args => execSync(`mapshaper ${args}`, { stdio: ['ignore', 'ignore', 'inherit'] })
const de = n => Math.round(n).toLocaleString('de-DE')
const warn = (...a) => console.warn('  !', ...a)

function slug(s) {
  return String(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x'
}
const normName = s => slug(s).replace(/\bsaint\b|\bsankt\b/g, 'st').replace(/-/g, '')

function parseCsv(t) {
  const rows = []; let row = [], f = '', q = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++ } else q = false } else f += c }
    else if (c === '"') q = true
    else if (c === ',') { row.push(f); f = '' }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = '' }
    else if (c !== '\r') f += c
  }
  if (f || row.length) { row.push(f); rows.push(row) }
  const h = rows[0]
  return rows.slice(1).filter(r => r.length > 1).map(r => Object.fromEntries(h.map((k, i) => [k, r[i]])))
}

/** d3-geo erwartet Außenringe im Uhrzeigersinn – mapshaper schreibt GeoJSON gegen den Uhrzeigersinn */
function rewind(g) {
  if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) return g
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  const fixed = polys.map(rings => (geoArea({ type: 'Polygon', coordinates: rings }) > 2 * Math.PI ? rings.map(r => [...r].reverse()) : rings))
  return g.type === 'Polygon' ? { type: 'Polygon', coordinates: fixed[0] } : { type: 'MultiPolygon', coordinates: fixed }
}

function writeLayer(id, features) {
  for (const f of features) f.g = rewind(f.g)
  const file = path.join(OUT_LAYERS, `${id}.json`)
  fs.writeFileSync(file, JSON.stringify({ id, f: features }))
  console.log(`  layers/${id}.json  ${(fs.statSync(file).size / 1024).toFixed(0)} KB  (${features.length})`)
}

/** Features → mapshaper (vereinfachen, optional zusammenlegen) → Features */
/** Geometrien mit gleicher id zu einer Multi-Geometrie zusammenfassen (ohne Verschmelzen – Überlappungen bleiben erhalten) */
function mergeById(features, key) {
  const by = new Map()
  for (const f of features) {
    if (!f.geometry) continue
    const id = f.properties[key]
    if (!by.has(id)) by.set(id, { props: f.properties, polys: [], lines: [] })
    const e = by.get(id), g = f.geometry
    if (g.type === 'Polygon') e.polys.push(g.coordinates)
    else if (g.type === 'MultiPolygon') e.polys.push(...g.coordinates)
    else if (g.type === 'LineString') e.lines.push(g.coordinates)
    else if (g.type === 'MultiLineString') e.lines.push(...g.coordinates)
  }
  return [...by.values()].map(e => ({
    type: 'Feature', properties: e.props,
    geometry: e.polys.length ? { type: 'MultiPolygon', coordinates: e.polys } : { type: 'MultiLineString', coordinates: e.lines },
  }))
}

/**
 * Features → mapshaper → Features.
 * dissolve: echte Verschmelzung (für lückenlose Flächen wie Meere/Kontinente). Achtung: mapshaper löscht dabei Flächen,
 *           die komplett unter einer anderen liegen (z.B. die Drakestraße im Ozean) – die werden danach ohne Verschmelzen ergänzt.
 * merge:    nur zusammenfassen (für Flächen, die sich überlappen dürfen: Wüsten in der Sahara, Gebirge, Seen …)
 */
function shape(name, features, { simplify, dissolve, merge } = {}) {
  const run = (tag, feats, cmd) => {
    const inp = path.join(TMP, `${name}-${tag}-in.json`), out = path.join(TMP, `${name}-${tag}-out.json`)
    fs.writeFileSync(inp, JSON.stringify({ type: 'FeatureCollection', features: feats }))
    ms(`"${inp}" ${cmd}${simplify ? ` -simplify ${simplify} weighted keep-shapes` : ''} -o "${out}" format=geojson precision=0.001`)
    return readJson(out).features.filter(f => f.geometry)
  }
  if (merge) return run('m', mergeById(features, merge), '')
  if (!dissolve) return run('s', features, '')
  const out = run('d', features, `-dissolve2 ${dissolve}`)
  const have = new Set(out.map(f => f.properties[dissolve]))
  const lost = features.filter(f => !have.has(f.properties[dissolve]))
  if (lost.length) {
    console.log(`  (${new Set(lost.map(f => f.properties[dissolve])).size} überlagerte Flächen ergänzt)`)
    // klein und teils mit sich selbst schneidenden Ringen → unverändert übernehmen (mapshaper würde sie verwerfen)
    out.push(...mergeById(lost, dissolve))
  }
  return out
}

/* ───────────── Gemeinsame Daten ───────────── */

const worldTs = fs.readFileSync(path.join(root, 'app/geo/_data/world.ts'), 'utf8')
/** @type {{id:string,name:string,continents:string[],region:string,capital:string,cap:[number,number]|null,pop:number|null,aliases:string[]}[]} */
const COUNTRIES = JSON.parse(worldTs.slice(worldTs.indexOf('= [') + 2))
const COUNTRY = Object.fromEntries(COUNTRIES.map(c => [c.id, c]))

const CC = parseCsv(fs.readFileSync(src('country-codes.csv'), 'utf8'))
const ISO3_FIX = { KOS: 'XKX', PSX: 'PSE', SDS: 'SSD' }
const ccOf = id => CC.find(r => r['ISO3166-1-Alpha-3'] === (ISO3_FIX[id] || id))
const ISO2 = {}
for (const c of COUNTRIES) {
  const r = ccOf(c.id)
  ISO2[c.id] = c.id === 'KOS' ? 'XK' : r?.['ISO3166-1-Alpha-2']
  if (!ISO2[c.id]) warn('ISO2 fehlt', c.id)
}
const ID_BY_ISO2 = Object.fromEntries(Object.entries(ISO2).map(([id, i2]) => [i2, id]))
const GEBIET_BY_ISO2 = Object.fromEntries(D.GEBIETE.filter(g => g.iso).map(g => [g.iso.toUpperCase(), g]))

/** Kontinent-Gruppe für ein Land an einer Stelle (Russland/Kasachstan/Türkei nach Längengrad) */
function groupAt(id, lon) {
  if (id === 'RUS' || id === 'KAZ') return lon > 58 ? 'asien' : 'europa'
  if (id === 'TUR') return lon > 29.1 ? 'asien' : 'europa'
  if (['GEO', 'ARM', 'AZE', 'CYP'].includes(id)) return 'asien'
  return COUNTRY[id]?.continents[0] ?? null
}
function groupOfIso2(iso2, lon, fallback) {
  const id = ID_BY_ISO2[iso2]
  if (id) return groupAt(id, lon)
  const g = GEBIET_BY_ISO2[iso2]
  if (g) return g.cont
  return fallback ?? null
}
const OA_CONT = { EU: 'europa', AS: 'asien', AF: 'afrika', NA: 'nordamerika', SA: 'suedamerika', OC: 'ozeanien', AN: 'antarktis' }
const NAME_OF_ISO2 = iso2 => COUNTRY[ID_BY_ISO2[iso2]]?.name ?? GEBIET_BY_ISO2[iso2]?.name ?? iso2

/* Länder-Flächen (für "Liegt in …" bei Punkten, Flüssen, Seen) */
const WORLD_DEU = readJson(src('ne_10m_admin_0_countries_deu.geojson')).features
const worldBoxes = WORLD_DEU.map(f => ({ id: f.properties.ADM0_A3, g: f.geometry, b: geoBounds(f.geometry) }))
function countryAt([lon, lat]) {
  for (const w of worldBoxes) {
    const [[x0, y0], [x1, y1]] = w.b
    if (lat < y0 || lat > y1) continue
    if (x0 <= x1 ? lon < x0 || lon > x1 : lon < x0 && lon > x1) continue
    if (geoContains(w.g, [lon, lat])) return w.id
  }
  return null
}

const fmtPop = n => !n ? '–' : n >= 1e9 ? `${(n / 1e9).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Mrd.` : n >= 1e6 ? `${(n / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio.` : de(n)
const CONT_NAME = { europa: 'Europa', asien: 'Asien', afrika: 'Afrika', nordamerika: 'Nordamerika', suedamerika: 'Südamerika', ozeanien: 'Ozeanien', antarktis: 'Antarktis' }

const ITEMS = {} // datei → slug → GeoItem[]
function put(file, slugName, items) {
  ITEMS[file] ??= {}
  ITEMS[file][slugName] = items.sort((a, b) => a.label.localeCompare(b.label, 'de'))
  console.log(`  ${slugName}: ${items.length} Einträge`)
}
function uniq(list) { return [...new Set(list.filter(Boolean))] }

/* ═════════════ 1. Länder: Fakten ═════════════ */
console.log('Länder …')

// Einwohner: Weltbank (neuestes Jahr), sonst Factbook
const popRows = parseCsv(fs.readFileSync(src('population.csv'), 'utf8'))
const WB = {}
for (const r of popRows) {
  const y = Number(r.Year), v = Number(r.Value)
  if (!WB[r['Country Code']] || WB[r['Country Code']].y < y) WB[r['Country Code']] = { y, v }
}

// Factbook (Fläche, Ersatz-Einwohner): Länderkürzel nach FIPS
const mapUnits = readJson(src('ne_10m_admin_0_map_units.geojson')).features.map(f => f.properties)
const FIPS = {}
for (const p of mapUnits) if (p.FIPS_10 && p.FIPS_10 !== '-99' && !FIPS[p.ADM0_A3]) FIPS[p.ADM0_A3] = p.FIPS_10.toLowerCase()
Object.assign(FIPS, { KOS: 'kv', SDS: 'od', TWN: 'tw', VAT: 'vt', FRA: 'fr', NOR: 'no', NLD: 'nl', DNK: 'da', GBR: 'uk', USA: 'us', AUS: 'as', NZL: 'nz', FIN: 'fi', CHN: 'ch', ISR: 'is', CYP: 'cy', SOM: 'so', MAR: 'mo', SRB: 'ri', KAZ: 'kz', GEO: 'gg', BIH: 'bk', BEL: 'be', PRT: 'po', IRQ: 'iz', ATG: 'ac', PNG: 'pp' })
const FB_REGIONS = ['europe', 'africa', 'east-n-southeast-asia', 'south-asia', 'middle-east', 'central-asia', 'north-america', 'central-america-n-caribbean', 'south-america', 'australia-oceania', 'antarctica']
function factbook(fips) {
  const p = path.join(SRC, 'factbook', `${fips}.json`)
  if (!fs.existsSync(p)) {
    for (const r of FB_REGIONS) {
      try {
        execSync(`curl -sfL -o "${p}" https://raw.githubusercontent.com/factbook/factbook.json/master/${r}/${fips}.json`)
        if (fs.existsSync(p) && fs.statSync(p).size > 100) break
      } catch { /* nächste Region */ }
    }
  }
  return fs.existsSync(p) ? readJson(p) : null
}
const num = t => Number(String(t ?? '').replace(/[^0-9.]/g, '').replace(/\.(?=.*\.)/g, '')) || 0
function fbArea(fips) {
  const fb = factbook(fips)
  const a = fb?.Geography?.Area
  if (!a) return 0
  const total = num((a['total '] ?? a.total)?.text?.split(' sq')[0]?.replace(/,/g, ''))
  const land = num(a.land?.text?.split(' sq')[0]?.replace(/,/g, ''))
  return Math.max(total, land)
}
function fbPop(fips) {
  const t = factbook(fips)?.['People and Society']?.Population?.total?.text
  return t ? num(t.split(' (')[0].replace(/,/g, '')) : 0
}

const mled = readJson(src('countries.json'))
const FACT = {}
for (const c of COUNTRIES) {
  const r = ccOf(c.id)
  const wb = WB[ISO3_FIX[c.id] || c.id]
  let area = c.id === 'PSX' ? fbArea('gz') + fbArea('we') : fbArea(FIPS[c.id])
  let pop = wb && wb.y >= 2023 ? wb.v : 0
  let popSrc = pop ? `Weltbank ${wb.y}` : ''
  if (!pop) { pop = c.id === 'PSX' ? fbPop('gz') + fbPop('we') : fbPop(FIPS[c.id]); popSrc = 'CIA World Factbook 2025' }
  if (!area) warn('Fläche fehlt', c.id)
  if (!pop) warn('Einwohner fehlen', c.id)
  const ml = mled.find(m => m.cca3 === (ISO3_FIX[c.id] || c.id)) ?? (c.id === 'KOS' ? mled.find(m => m.cca2 === 'XK') : null)
  FACT[c.id] = {
    area, pop, popSrc,
    dial: (D.VORWAHL_FIX[c.id] ?? r?.Dial ?? '').split(',')[0].trim(),
    tld: c.id === 'KOS' ? null : r?.TLD || null,
    landlocked: !!ml?.landlocked,
  }
}

fs.writeFileSync(path.join(TMP, 'fakten.tsv'), COUNTRIES.map(c => [c.id, c.name, FIPS[c.id], FACT[c.id].area, FACT[c.id].pop, FACT[c.id].popSrc, FACT[c.id].dial, FACT[c.id].tld, FACT[c.id].landlocked].join('\t')).join('\n'))
const CONT_GROUP_ORDER = ['europa', 'asien', 'afrika', 'nordamerika', 'suedamerika', 'ozeanien', 'antarktis']
const capDetail = c => ({ label: 'Hauptstadt', value: c.capital })
const contDetail = c => ({ label: 'Kontinent', value: c.continents.map(k => CONT_NAME[k]).join(' / ') })

// Flaggen
put('welt-laender', 'welt-flaggen', COUNTRIES.map(c => ({
  key: `flagge:${c.id}`, label: c.name, aliases: c.aliases, group: c.continents[0], areas: [`world:${c.id}`],
  flag: ISO2[c.id].toLowerCase(), flagPrompt: true,
  details: [capDetail(c), contDetail(c)],
  text: { prompt: 'Welches Land hat diese Flagge?', answer: c.name },
})))

// Vorwahlen
{
  const byDial = new Map()
  for (const c of COUNTRIES) {
    const d = FACT[c.id].dial
    if (!d) { warn('Vorwahl fehlt', c.id); continue }
    if (!byDial.has(d)) byDial.set(d, [])
    byDial.get(d).push(c)
  }
  const items = []
  for (const [d, cs] of byDial) {
    const label = `+${d.replace('-', ' ')}`
    const digits = d.replace(/\D/g, '')
    const names = cs.map(c => c.name).join(' & ')
    items.push({
      key: `vw:${digits}`, label, prompt: label, group: cs[0].continents[0],
      areas: cs.map(c => `world:${c.id}`),
      aliases: uniq([digits, `00${digits}`, `+${digits}`, label.replace(' ', '-'), ...cs.flatMap(c => D.VORWAHL_EXTRA_ALIASES[c.id] ?? [])]),
      details: [{ label: cs.length > 1 ? 'Länder' : 'Land', value: names, big: true }, ...cs.filter(c => D.VORWAHL_NOTE[c.id]).map(c => ({ label: 'Hinweis', value: D.VORWAHL_NOTE[c.id] }))],
      text: { prompt: `Vorwahl von ${names}?`, answer: label },
    })
  }
  put('welt-laender', 'welt-vorwahlen', items)
}

// Länderdomains (Länder + Gebiete mit eigener Domain)
{
  const TLD_NOTE = {
    '.tv': 'Wird wegen "TV" gern von Streaming-Seiten genutzt – Tuvalu verdient daran mit.',
    '.io': 'Bei Tech-Firmen beliebt ("Input/Output").',
    '.ai': 'Bei KI-Firmen sehr beliebt – ein großer Teil der Staatseinnahmen von Anguilla.',
    '.me': 'Wird oft für persönliche Seiten genutzt ("me").',
    '.co': 'Wird oft als Ersatz für .com genutzt.',
    '.fm': 'Bei Radiosendern beliebt (UKW = FM).',
    '.gg': 'Bei Gamern beliebt ("good game").',
    '.ly': 'Bekannt durch Link-Kürzer wie bit.ly.',
    '.uk': 'Ausnahme: der ISO-Code wäre GB, die Domain ist aber .uk.',
    '.tk': 'War jahrelang kostenlos und daher eine der meistgenutzten Domains der Welt.',
    '.cc': 'Wird oft als Abkürzung für "Community" oder "Creative Commons" genutzt.',
    '.nu': 'In Schweden und den Niederlanden beliebt ("nu" = jetzt).',
    '.am': 'Bei Radiosendern beliebt (Mittelwelle = AM).',
    '.to': 'Wird gern für Kurzlinks genutzt.',
    '.ac': 'Wird oft von Hochschulen genutzt ("academic").',
  }
  const items = []
  for (const c of COUNTRIES) {
    const t = FACT[c.id].tld
    if (!t) continue
    items.push({
      key: `tld:${t}`, label: t, prompt: t, group: c.continents[0], areas: [`world:${c.id}`], aliases: [t.slice(1)],
      details: [{ label: 'Land', value: c.name, big: true }, ...(TLD_NOTE[t] ? [{ label: 'Wusstest du?', value: TLD_NOTE[t] }] : [])],
      text: { prompt: `Länderdomain von ${c.name}?`, answer: t },
    })
  }
  for (const g of D.GEBIETE) {
    if (!g.tld) continue
    items.push({
      key: `tld:${g.tld}`, label: g.tld, prompt: g.tld, group: g.cont, areas: [`gebiete:${g.code}`], aliases: [g.tld.slice(1)],
      details: [{ label: 'Gebiet', value: g.name, big: true }, { label: 'Gehört zu', value: g.sov }, ...(TLD_NOTE[g.tld] ? [{ label: 'Wusstest du?', value: TLD_NOTE[g.tld] }] : [])],
      text: { prompt: `Länderdomain von ${g.name}?`, answer: g.tld },
    })
  }
  put('welt-laender', 'welt-domains', items)
}

// Größte / kleinste nach Fläche und Einwohnern
function ranking(slugName, keyPrefix, field, dir, what) {
  const sorted = [...COUNTRIES].filter(c => FACT[c.id][field]).sort((a, b) => dir * (FACT[b.id][field] - FACT[a.id][field]))
  const top = sorted.slice(0, 100)
  put('welt-laender', slugName, top.map((c, i) => ({
    key: `${keyPrefix}:${c.id}`, label: c.name, aliases: c.aliases, group: c.continents[0], areas: [`world:${c.id}`],
    details: [
      { label: 'Platz', value: `${i + 1}`, big: true },
      { label: 'Fläche', value: `${FACT[c.id].area < 10 ? FACT[c.id].area.toLocaleString('de-DE', { maximumFractionDigits: 2 }) : de(FACT[c.id].area)} km²` },
      { label: 'Einwohner', value: fmtPop(FACT[c.id].pop) },
    ],
    text: { prompt: `Platz ${i + 1} der ${what}?`, answer: c.name },
  })))
}
ranking('welt-flaeche-gross', 'fl-gross', 'area', 1, 'größten Länder (Fläche)')
ranking('welt-flaeche-klein', 'fl-klein', 'area', -1, 'kleinsten Länder (Fläche)')
ranking('welt-einwohner-gross', 'ew-gross', 'pop', 1, 'bevölkerungsreichsten Länder')
ranking('welt-einwohner-klein', 'ew-klein', 'pop', -1, 'bevölkerungsärmsten Länder')

// Binnenstaaten
put('welt-laender', 'welt-binnenstaaten', COUNTRIES.filter(c => FACT[c.id].landlocked).map(c => ({
  key: `binnen:${c.id}`, label: c.name, aliases: c.aliases, group: c.continents[0], areas: [`world:${c.id}`],
  details: [capDetail(c), contDetail(c), ...(['LIE', 'UZB'].includes(c.id) ? [{ label: 'Wusstest du?', value: 'Doppelter Binnenstaat – auch alle Nachbarn haben keinen Zugang zum Meer.' }] : [])],
})))

// Hauptstädte (schwer): nur der Punkt zählt
put('welt-laender', 'welt-hauptstaedte-schwer', COUNTRIES.filter(c => c.cap).map(c => ({
  key: `hsp:${c.id}`, label: c.capital, prompt: c.capital, group: c.continents[0], point: c.cap,
  details: [{ label: 'Land', value: c.name, big: true }, contDetail(c)],
  text: { prompt: `Hauptstadt von ${c.name}?`, answer: c.capital },
})))

/* ═════════════ 2. Überseegebiete ═════════════ */
console.log('Überseegebiete …')
const SUB = readJson(src('ne_10m_admin_0_map_subunits.geojson')).features
{
  const feats = []
  for (const g of D.GEBIETE) {
    const parts = g.su === '@ATF' ? SUB.filter(f => f.properties.GU_A3 === 'ATF') : SUB.filter(f => g.su.includes(f.properties.SU_A3))
    if (!parts.length) warn('Gebiet ohne Fläche', g.code)
    for (const f of parts) feats.push({ type: 'Feature', properties: { id: g.code }, geometry: f.geometry })
  }
  const out = shape('gebiete', feats, { merge: 'id', simplify: '12%' })
  writeLayer('gebiete', out.map(f => ({ i: f.properties.id, g: f.geometry })))

  const gebietItem = (g, extra = {}) => ({
    key: `gebiet:${g.code}`, label: g.name, aliases: g.aliases ?? [], group: g.cont, areas: [`gebiete:${g.code}`],
    ...(g.flag ? { flag: g.flag } : {}),
    details: [{ label: 'Gehört zu', value: g.sov, big: true }, { label: 'Status', value: g.status }, ...(g.note ? [{ label: 'Hinweis', value: g.note }] : [])],
    text: { prompt: `Zu welchem Staat gehört ${g.name}?`, answer: g.sov },
    ...extra,
  })
  put('welt-gebiete', 'welt-ueberseegebiete', D.GEBIETE.map(g => gebietItem(g)))
  put('welt-gebiete', 'welt-flaggen-gebiete', D.GEBIETE.filter(g => g.flag).map(g => gebietItem(g, {
    key: `gflagge:${g.code}`, flagPrompt: true, text: { prompt: 'Welches Gebiet hat diese Flagge?', answer: g.name },
  })))
}

/* ═════════════ 3. Kontinente ═════════════ */
console.log('Kontinente …')
{
  const feats = [], split = []
  for (const f of SUB) {
    const p = f.properties
    const ov = [p.SU_A3, p.GU_A3, p.ADM0_A3].find(k => k in D.KONTINENT_OVERRIDE)
    let k = ov !== undefined ? D.KONTINENT_OVERRIDE[ov] : D.NE_CONTINENT[p.CONTINENT] ?? null
    if (['RUS', 'KAZ', 'TUR'].includes(p.ADM0_A3) && !(p.SU_A3 in D.KONTINENT_OVERRIDE)) { split.push(f); continue }
    if (!k) continue
    feats.push({ type: 'Feature', properties: { k }, geometry: f.geometry })
  }
  // Russland/Kasachstan an Ural & Uralfluss, Türkei am Bosporus teilen
  const poly = ring => ({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } }] })
  const euFile = path.join(TMP, 'eu-side.json'), thFile = path.join(TMP, 'thrakien.json')
  fs.writeFileSync(euFile, JSON.stringify(poly(D.EUROPA_SEITE)))
  fs.writeFileSync(thFile, JSON.stringify(poly(D.THRAKIEN)))
  const splitFile = (name, list) => { const p = path.join(TMP, `${name}.json`); fs.writeFileSync(p, JSON.stringify({ type: 'FeatureCollection', features: list })); return p }
  const rk = splitFile('rk', split.filter(f => f.properties.ADM0_A3 !== 'TUR'))
  const tr = splitFile('tr', split.filter(f => f.properties.ADM0_A3 === 'TUR'))
  const run = (inp, cmd, clipFile, k) => {
    const out = path.join(TMP, `${path.basename(inp, '.json')}-${cmd}.json`)
    ms(`"${inp}" -${cmd} "${clipFile}" -o "${out}" format=geojson`)
    for (const f of readJson(out).features) feats.push({ type: 'Feature', properties: { k }, geometry: f.geometry })
  }
  run(rk, 'clip', euFile, 'EU'); run(rk, 'erase', euFile, 'AS')
  run(tr, 'clip', thFile, 'EU'); run(tr, 'erase', thFile, 'AS')
  const out = shape('kontinente', feats, { dissolve: 'k', simplify: '2.5%' })
  writeLayer('kontinente', out.map(f => ({ i: f.properties.k, g: f.geometry })))

  const STAT = {
    AS: { area: 'ca. 44,6 Mio. km²', pop: 'ca. 4,8 Mrd.', q: 'Größter und bevölkerungsreichster Kontinent?' },
    AF: { area: 'ca. 30,3 Mio. km²', pop: 'ca. 1,5 Mrd.', q: 'Kontinent mit den meisten Staaten (54)?' },
    NA: { area: 'ca. 24,7 Mio. km²', pop: 'ca. 600 Mio.', q: 'Auf welchem Kontinent liegt Grönland, die größte Insel der Welt?' },
    SA: { area: 'ca. 17,8 Mio. km²', pop: 'ca. 440 Mio.', q: 'Kontinent mit dem größten Teil des Amazonas-Regenwalds?' },
    AN: { area: 'ca. 14 Mio. km²', pop: 'keine dauerhaften Einwohner', q: 'Kältester, trockenster und windigster Kontinent?' },
    EU: { area: 'ca. 10,5 Mio. km²', pop: 'ca. 745 Mio.', q: 'Zweitkleinster Kontinent – Deutschland liegt hier.' },
    OZ: { area: 'ca. 8,5 Mio. km²', pop: 'ca. 46 Mio.', q: 'Kleinster Kontinent?' },
  }
  const counts = {}
  for (const c of COUNTRIES) for (const k of c.continents) counts[k] = (counts[k] ?? 0) + 1
  put('welt-natur', 'welt-kontinente', Object.entries(D.KONTINENTE).map(([k, v]) => ({
    key: `kont:${k}`, label: v.name, aliases: v.aliases, group: v.group, areas: [`kontinente:${k}`],
    details: [
      { label: 'Fläche', value: STAT[k].area },
      { label: 'Einwohner', value: STAT[k].pop },
      ...(counts[v.group] ? [{ label: 'Staaten', value: `${counts[v.group]} (inkl. Staaten auf zwei Kontinenten)` }] : []),
    ],
    text: { prompt: STAT[k].q, answer: v.name },
  })))
}

/* ═════════════ 4. Ozeane & Meere ═════════════ */
console.log('Meere …')
{
  const raw = readJson(src('ne_10m_geography_marine_polys.geojson')).features
    .filter(f => f.properties.name && !D.MEER_RAUS_KLASSE.has(f.properties.featurecla))
  const ART = { ocean: 'Ozean', sea: 'Meer', bay: 'Bucht', gulf: 'Golf', strait: 'Meerenge', channel: 'Meeresstraße', sound: 'Sund', fjord: 'Fjord', lagoon: 'Lagune / Haff', reef: 'Riff', inlet: 'Meeresarm' }
  const M = raw.map((f, i) => {
    const p = f.properties
    const de_ = D.OZEAN[p.name] ?? D.MEER_NAME[p.name] ?? p.name_de ?? p.name
    const level = D.MEER_STUFE1.has(p.name) ? 1 : p.scalerank <= 5 ? 2 : 3
    return { i, f, p, de: de_, level, ocean: D.OZEAN[p.name] ?? null }
  })
  // Gleiche deutsche Namen bei verschiedenen Gewässern unterscheiden (außer den Ozean-Hälften)
  const byName = {}
  for (const m of M) (byName[m.de] ??= []).push(m)
  for (const [n, list] of Object.entries(byName)) if (list.length > 1 && !list[0].ocean && new Set(list.map(m => m.p.name)).size > 1) { warn('Meer doppelt', n, list.map(m => m.p.name).join(' / ')); list.forEach(m => { m.de = `${n} (${m.p.name})` }) }
  for (const m of M) m.id = slug(m.de)

  // Nachbarn über gemeinsame Randpunkte (auf 0,02° gerundet)
  const cells = new Map()
  const walk = (c, i) => {
    if (typeof c[0] === 'number') {
      const k = `${Math.round(c[0] * 50)},${Math.round(c[1] * 50)}`
      let s = cells.get(k); if (!s) cells.set(k, s = new Map())
      s.set(i, (s.get(i) ?? 0) + 1); return
    }
    for (const x of c) walk(x, i)
  }
  M.forEach(m => walk(m.f.geometry.coordinates, m.i))
  const nb = M.map(() => new Map())
  for (const s of cells.values()) {
    const ids = [...s.keys()]
    for (const a of ids) for (const b of ids) if (a !== b) nb[a].set(b, (nb[a].get(b) ?? 0) + 1)
  }
  const byIdx = Object.fromEntries(M.map(m => [m.i, m]))
  // Zugehöriger Ozean: von den Ozeanen aus über Nachbarn ausbreiten (stärkste Grenze zuerst)
  function spread(seed) {
    const owner = new Map(seed.map(m => [m.i, m.i]))
    let frontier = seed.map(m => m.i)
    while (frontier.length) {
      const next = []
      const cand = new Map()
      for (const a of frontier) for (const [b, n] of nb[a]) {
        if (owner.has(b)) continue
        const cur = cand.get(b)
        if (!cur || cur.n < n) cand.set(b, { from: a, n })
      }
      for (const [b, { from }] of cand) { owner.set(b, owner.get(from)); next.push(b) }
      frontier = next
    }
    return owner
  }
  const seeds = M.filter(m => m.ocean || D.MEER_PARENT[m.p.name])
  const oceanOwner = spread(seeds)
  for (const m of M) {
    const o = oceanOwner.get(m.i)
    m.parent = o !== undefined ? (byIdx[o].ocean ?? D.MEER_PARENT[byIdx[o].p.name]) : null
    if (!m.parent && !['Kaspisches Meer', 'Kara-Bogas-Gol'].includes(m.de) && !m.ocean) warn('Meer ohne Ozean', m.de)
  }
  const OZ_GROUP = { 'Atlantischer Ozean': 'atlantik', 'Pazifischer Ozean': 'pazifik', 'Indischer Ozean': 'indik', 'Arktischer Ozean': 'arktis', 'Südlicher Ozean': 'suedpolar' }

  for (const level of [1, 2, 3]) {
    const kept = M.filter(m => m.level <= level)
    const owner = spread(kept)
    const feats = []
    for (const m of M) {
      const o = owner.get(m.i)
      if (o === undefined) continue
      feats.push({ type: 'Feature', properties: { id: byIdx[o].id }, geometry: m.f.geometry })
    }
    const out = shape(`meere-${level}`, feats, { dissolve: 'id', simplify: level === 1 ? '3%' : level === 2 ? '5%' : '8%' })
    writeLayer(`meere-${level}`, out.map(f => ({ i: f.properties.id, g: f.geometry })))
    const seen = new Set()
    const items = []
    for (const m of kept) {
      if (seen.has(m.id)) continue
      seen.add(m.id)
      const parent = m.ocean ?? m.parent
      items.push({
        key: `meer:${m.id}`, label: m.de, aliases: uniq([...(D.OZEAN_ALIAS[m.de] ?? []), ...(D.MEER_ALIAS[m.de] ?? []), m.ocean ? null : m.p.name]),
        group: OZ_GROUP[parent] ?? 'binnen', areas: [`meere-${level}:${m.id}`],
        details: [
          { label: 'Art', value: ART[m.p.featurecla] ?? 'Gewässer' },
          ...(m.ocean ? [] : [{ label: 'Gehört zu', value: parent ?? 'Binnengewässer' }]),
          ...(D.MEER_NOTE[m.de] ? [{ label: 'Wusstest du?', value: D.MEER_NOTE[m.de] }] : []),
        ],
        ...(m.ocean || !parent ? {} : { text: { prompt: `Zu welchem Ozean gehört: ${m.de}?`, answer: parent } }),
      })
    }
    put('welt-natur', level === 1 ? 'welt-ozeane' : level === 2 ? 'welt-ozeane-schwer' : 'welt-ozeane-sehr-schwer', items)
  }
}

/* ═════════════ 5. Gebirge & Gipfel ═════════════ */
console.log('Gebirge …')
{
  const raw = readJson(src('ne_10m_geography_regions_polys.geojson')).features.filter(f => f.properties.FEATURECLA === 'Range/mtn')
  const R = raw.map(f => {
    const p = f.properties
    const name = D.GEBIRGE_NAME[p.NAME] ?? (p.NAME_DE && p.NAME_DE === p.NAME_DE.toUpperCase() && p.NAME_DE.length > 4 ? p.NAME_DE[0] + p.NAME_DE.slice(1).toLowerCase() : p.NAME_DE) ?? p.NAME
    return { f, p, name, level: D.GEBIRGE_STUFE1.has(p.NAME) ? 1 : p.SCALERANK <= 5 ? 2 : 3, c: geoCentroid(f.geometry), group: D.NE_REGION[p.REGION] ?? 'asien' }
  }).filter(r => !D.GEBIRGE_RAUS.has(r.p.NAME))
  // Gleiche Namen: nahe beieinander → zusammenlegen, sonst mit Land unterscheiden
  const groups = []
  for (const r of R) {
    const g = groups.find(x => x.name === r.name && geoDistance(x.c, r.c) * 6371 < 1500)
    if (g) { g.parts.push(r); g.level = Math.min(g.level, r.level) } else groups.push({ name: r.name, c: r.c, parts: [r], level: r.level, group: r.group })
  }
  const dupNames = groups.reduce((m, g) => (m[g.name] = (m[g.name] ?? 0) + 1, m), {})
  for (const g of groups) {
    if (dupNames[g.name] > 1) {
      const cid = countryAt(g.c) ?? countryAt(g.parts[0].c)
      g.name = `${g.name} (${COUNTRY[cid]?.name ?? CONT_NAME[g.group]})`
    }
    g.id = slug(g.name)
    const lands = uniq(g.parts.map(p => countryAt(p.c))).map(id => COUNTRY[id]?.name).filter(Boolean)
    g.lands = lands
  }
  const feats = groups.flatMap(g => g.parts.map(p => ({ type: 'Feature', properties: { id: g.id }, geometry: p.f.geometry })))
  const out = shape('gebirge', feats, { merge: 'id', simplify: '20%' })
  writeLayer('gebirge', out.map(f => ({ i: f.properties.id, g: f.geometry })))
  const rangeItem = g => ({
    key: `geb:${g.id}`, label: g.name, aliases: uniq([...(D.GEBIRGE_ALIAS[g.name] ?? []), g.parts[0].p.NAME_EN !== g.name ? g.parts[0].p.NAME_EN : null]),
    group: g.group, areas: [`gebirge:${g.id}`],
    details: [{ label: 'Kontinent', value: CONT_NAME[g.group] }, ...(g.lands.length ? [{ label: 'Liegt in', value: g.lands.join(', ') }] : [])],
  })

  // Gipfel
  const P = readJson(src('ne_10m_geography_regions_elevation_points.geojson')).features
    .filter(f => ['mountain', 'spot elevation'].includes(f.properties.featurecla) && f.properties.name)
  const peaks = []
  for (const f of P) {
    const p = f.properties
    const fix = D.GIPFEL_FIX[`${p.name}@${p.elevation}`] ?? D.GIPFEL_FIX[p.name] ?? {}
    if (fix.drop) continue
    const name = fix.name ?? p.name_de ?? p.name
    if (peaks.some(x => x.name === name && geoDistance(x.ll, f.geometry.coordinates) * 6371 < 5)) continue
    peaks.push({ name, ll: f.geometry.coordinates.map(r3), h: fix.h ?? p.elevation, aliases: uniq([...(fix.aliases ?? []), p.name !== name ? p.name : null]), group: D.NE_REGION[p.region] ?? 'asien', rank: p.scalerank })
  }
  for (const x of D.ACHTTAUSENDER_EXTRA) if (!peaks.some(p => p.name === x.name)) peaks.push({ name: x.name, ll: x.ll, h: x.h, aliases: x.aliases ?? [], group: x.region, rank: 1 })
  const peakDup = peaks.reduce((m, p) => (m[p.name] = (m[p.name] ?? 0) + 1, m), {})
  for (const p of peaks) {
    const cid = countryAt(p.ll)
    p.land = COUNTRY[cid]?.name
    if (peakDup[p.name] > 1) p.name = `${p.name} (${p.land ?? CONT_NAME[p.group]})`
    p.id = slug(p.name)
    p.level = D.GIPFEL_STUFE1.has(p.name) ? 1 : D.ACHTTAUSENDER.has(p.name) || p.rank <= 5 ? 2 : 3
  }
  for (const n of D.GIPFEL_STUFE1) if (!peaks.some(p => p.name === n)) warn('Gipfel fehlt', n)
  const peakItem = p => ({
    key: `berg:${p.id}`, label: p.name, aliases: p.aliases, group: p.group, point: p.ll, pointShape: 'tri',
    details: [
      { label: 'Höhe', value: `${de(p.h)} m`, big: true },
      ...(p.land ? [{ label: 'Land', value: p.land }] : []),
      ...(D.ACHTTAUSENDER.has(p.name) ? [{ label: 'Achttausender', value: 'einer der 14 Berge über 8000 m' }] : []),
      ...(D.SEVEN_SUMMITS[p.name] ? [{ label: 'Wusstest du?', value: D.SEVEN_SUMMITS[p.name] }] : []),
    ],
    text: { prompt: `Wie hoch ist: ${p.name}?`, answer: `${de(p.h)} m` },
  })
  for (const level of [1, 2, 3]) {
    put('welt-natur', level === 1 ? 'welt-gebirge' : level === 2 ? 'welt-gebirge-schwer' : 'welt-gebirge-sehr-schwer', [
      ...groups.filter(g => g.level <= level).map(rangeItem),
      ...peaks.filter(p => p.level <= level).map(peakItem),
    ])
  }
}

/* ═════════════ 6. Flüsse ═════════════ */
console.log('Flüsse …')
{
  const mergeOf = {}
  for (const [to, list] of Object.entries(D.FLUSS_MERGE)) for (const n of list) mergeOf[n] = to
  const segs = []
  const fixEnc = t => t && t.replace('Rivire', 'Rivière')
  const add = (f, key0, alt, srcName) => {
    const key = fixEnc(key0)
    if (!f.geometry) return
    const lines = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : []
    if (!lines.length) return
    const mid = lines[0][Math.floor(lines[0].length / 2)]
    segs.push({ key: mergeOf[key] ?? key, alt: uniq(alt), geom: f.geometry, mid, srcName })
  }
  // 1:50m – mit deutschen Namen
  const r50 = readJson(src('ne_50m_rivers_lake_centerlines_scale_rank.geojson')).features.filter(f => f.properties.featurecla !== 'Lake Centerline')
  const known = new Set()
  for (const f of r50) {
    const p = f.properties
    const key = p.name_de || p.name
    if (!key) continue
    add(f, key, [p.name, p.name_en, p.name_alt], p.name)
    for (const n of [p.name, p.name_en, p.name_alt, p.name_de]) if (n) known.add(normName(n))
  }
  // 1:10m – zusätzliche (kleinere) Flüsse, nur wenn noch nicht bekannt
  const r10 = readJson(src('ne_10m_rivers_lake_centerlines.geojson')).features.filter(f => f.properties.featurecla === 'River' && f.properties.name)
  for (const f of r10) {
    const p = f.properties
    if ([p.name, p.name_en, p.name_alt].some(n => n && known.has(normName(n)))) continue
    add(f, p.name, [p.name_alt], p.name)
  }
  for (const f of r10) for (const n of [f.properties.name, f.properties.name_alt]) if (n) known.add(normName(n))
  // Europa-Ergänzung (1:10m, mit deutschen Namen)
  const reu = readJson(src('ne_10m_rivers_europe.geojson')).features.filter(f => f.properties.name)
  for (const f of reu) {
    const p = f.properties
    if ([p.name, p.name_de, p.name_en].some(n => n && known.has(normName(n)))) continue
    add(f, p.name_de || p.name, [p.name, p.name_en], p.name)
  }

  // Abschnitte gleichen Namens zu Flüssen bündeln: verbunden, wenn sich Enden berühren oder Mitten nah beieinander liegen
  const ends = s => {
    const lines = s.geom.type === 'LineString' ? [s.geom.coordinates] : s.geom.coordinates
    return lines.flatMap(l => [l[0], l[l.length - 1]])
  }
  const parent = segs.map((_, i) => i)
  const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  const byKey = {}
  segs.forEach((s, i) => { s.ends = ends(s); (byKey[s.key] ??= []).push(i) })
  for (const list of Object.values(byKey)) {
    for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
      const A = segs[list[a]], B = segs[list[b]]
      const near = geoDistance(A.mid, B.mid) * 6371 < 600 || A.ends.some(p => B.ends.some(q => geoDistance(p, q) * 6371 < 120))
      if (near) parent[find(list[a])] = find(list[b])
    }
  }
  const clusters = new Map()
  segs.forEach((s, i) => { const r = find(i); if (!clusters.has(r)) clusters.set(r, []); clusters.get(r).push(s) })
  const rivers = [...clusters.values()].map(parts => ({ key: parts[0].key, parts, alt: parts.flatMap(p => p.alt) }))
  // Länder, durch die ein Fluss fließt (Stichproben entlang der Linie)
  for (const r of rivers) {
    const pts = []
    for (const s of r.parts) {
      const lines = s.geom.type === 'LineString' ? [s.geom.coordinates] : s.geom.coordinates
      for (const l of lines) for (let i = 0; i < l.length; i += Math.max(1, Math.floor(l.length / 12))) pts.push(l[i])
    }
    const counts = {}
    for (const p of pts) { const c = countryAt(p); if (c) counts[c] = (counts[c] ?? 0) + 1 }
    r.lands = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([c]) => c)
    r.mid = [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length]
  }
  // Gleicher Name in verschiedenen Ländern → mit Land unterscheiden (gleiches Land → ein Fluss)
  const landsOfKey = rivers.reduce((m, r) => ((m[r.key] ??= new Set()).add(r.lands[0] ?? '?'), m), {})
  for (const r of rivers) {
    const main = r.lands[0]
    const named = D.FLUSS_NAME[`${r.key}@${main}`] ?? D.FLUSS_NAME[r.key]
    r.name = named ?? (landsOfKey[r.key].size > 1 ? `${r.key} (${COUNTRY[main]?.name ?? 'Welt'})` : r.key)
  }
  // Nach der Umbenennung können wieder gleiche Namen entstehen (z.B. zwei "Rio Grande"-Teile) → zusammenlegen
  const byName = new Map()
  for (const r of rivers) {
    const o = byName.get(r.name)
    if (o) { o.parts.push(...r.parts); o.alt.push(...r.alt); o.lands = uniq([...o.lands, ...r.lands]) } else byName.set(r.name, r)
  }
  const RIV = [...byName.values()]
  const ids = new Set()
  for (const r of RIV) {
    let id = slug(r.name), n = 2
    while (ids.has(id)) id = `${slug(r.name)}-${n++}`
    ids.add(id); r.id = id
    r.level = D.FLUSS_STUFE1.has(r.name) ? 1 : 2
    r.group = groupAt(r.lands[0], r.mid[0]) ?? 'asien'
  }
  for (const n of D.FLUSS_STUFE1) if (!RIV.some(r => r.name === n)) warn('Fluss fehlt', n)
  const toFeats = list => list.flatMap(r => r.parts.map(s => ({ type: 'Feature', properties: { id: r.id }, geometry: s.geom })))
  const o1 = shape('fluesse', toFeats(RIV.filter(r => r.level === 1)), { merge: 'id', simplify: '35%' })
  writeLayer('fluesse', o1.map(f => ({ i: f.properties.id, g: f.geometry })))
  const o2 = shape('fluesse-alle', toFeats(RIV), { merge: 'id', simplify: '20%' })
  writeLayer('fluesse-alle', o2.map(f => ({ i: f.properties.id, g: f.geometry })))
  const riverItem = (r, layer) => ({
    key: `fluss:${r.id}`, label: r.name,
    aliases: uniq([...(D.FLUSS_ALIAS[r.name] ?? []), ...r.alt.filter(a => a !== r.name)]).slice(0, 8),
    group: r.group, areas: [`${layer}:${r.id}`],
    details: [
      { label: 'Kontinent', value: CONT_NAME[r.group] },
      ...(r.lands.length ? [{ label: r.lands.length > 1 ? 'Fließt durch' : 'Land', value: r.lands.slice(0, 8).map(c => COUNTRY[c]?.name ?? c).join(', ') }] : []),
    ],
    ...(r.lands.length ? { text: { prompt: `Durch welches Land fließt: ${r.name}?`, answer: COUNTRY[r.lands[0]]?.name ?? r.lands[0] } } : {}),
  })
  put('welt-natur', 'welt-fluesse', RIV.filter(r => r.level === 1).map(r => riverItem(r, 'fluesse')))
  put('welt-natur', 'welt-fluesse-schwer', RIV.map(r => riverItem(r, 'fluesse-alle')))
}

/* ═════════════ 7. Seen ═════════════ */
console.log('Seen …')
{
  const raw = readJson(src('ne_10m_lakes.geojson')).features.filter(f => f.properties.name)
  const L = []
  for (const f of raw) {
    const p = f.properties
    const core = p.name.replace(/^(Lake|Lac|Lago|Lagoa)\s+(of\s+the\s+|de\s+|di\s+)?/i, '')
    const name = D.SEE_NAME[p.name] ?? (p.name_de && p.name_de !== core ? p.name_de : p.name)
    const c = geoCentroid(f.geometry)
    const o = L.find(x => x.name === name && geoDistance(x.c, c) * 6371 < 400)
    const lvl = D.SEE_STUFE1.has(p.name) ? 1 : 2
    if (o) { o.parts.push(f); o.level = Math.min(o.level, lvl); o.alt.push(p.name) } else L.push({ name, c, parts: [f], level: lvl, alt: [p.name], cls: p.featurecla })
  }
  const dup = L.reduce((m, l) => (m[l.name] = (m[l.name] ?? 0) + 1, m), {})
  const ids = new Set()
  for (const l of L) {
    const counts = {}
    for (const f of l.parts) {
      const rings = f.geometry.type === 'Polygon' ? [f.geometry.coordinates[0]] : f.geometry.coordinates.map(p => p[0])
      for (const ring of rings) for (let i = 0; i < ring.length; i += Math.max(1, Math.floor(ring.length / 24))) { const c = countryAt(ring[i]); if (c) counts[c] = (counts[c] ?? 0) + 1 }
    }
    l.lands = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([c]) => c)
    l.land = l.lands[0] ?? countryAt(l.c)
    if (dup[l.name] > 1) l.name = `${l.name} (${COUNTRY[l.land]?.name ?? 'Welt'})`
    let id = slug(l.name), n = 2
    while (ids.has(id)) id = `${slug(l.name)}-${n++}`
    ids.add(id); l.id = id
    l.group = groupAt(l.land, l.c[0]) ?? 'asien'
  }
  const found = new Set(raw.map(f => f.properties.name))
  for (const n of D.SEE_STUFE1) if (!found.has(n)) warn('See (Stufe 1) nicht in Natural Earth:', n)
  const out = shape('seen', L.flatMap(l => l.parts.map(f => ({ type: 'Feature', properties: { id: l.id }, geometry: f.geometry }))), { merge: 'id', simplify: '10%' })
  writeLayer('seen', out.map(f => ({ i: f.properties.id, g: f.geometry })))
  const KIND = { Lake: 'See', Reservoir: 'Stausee', 'Alkaline Lake': 'Salzsee' }
  const seeItem = l => ({
    key: `see:${l.id}`, label: l.name, aliases: uniq([...(D.SEE_ALIAS[l.name] ?? []), ...l.alt.filter(a => a !== l.name)]), group: l.group, areas: [`seen:${l.id}`],
    details: [{ label: 'Art', value: KIND[l.cls] ?? 'See' }, ...(l.lands.length ? [{ label: l.lands.length > 1 ? 'Liegt in' : 'Land', value: l.lands.slice(0, 6).map(c => COUNTRY[c]?.name ?? c).join(', ') }] : [])],
    ...(l.land && COUNTRY[l.land] ? { text: { prompt: `In welchem Land liegt: ${l.name}?`, answer: COUNTRY[l.land].name } } : {}),
  })
  put('welt-natur', 'welt-seen', L.filter(l => l.level === 1).map(seeItem))
  put('welt-natur', 'welt-seen-schwer', L.map(seeItem))
}

/* ═════════════ 8. Wüsten ═════════════ */
console.log('Wüsten …')
{
  const raw = readJson(src('ne_10m_geography_regions_polys.geojson')).features.filter(f => f.properties.FEATURECLA === 'Desert' && !D.WUESTE_RAUS.has(f.properties.NAME))
  const W = raw.map(f => {
    const p = f.properties
    const name = D.WUESTE_NAME[p.NAME] ?? p.NAME_DE ?? p.NAME
    const c = geoCentroid(f.geometry)
    return { f, name, id: slug(name), c, group: D.NE_REGION[p.REGION] ?? 'afrika', land: countryAt(c) }
  })
  const out = shape('wuesten', W.map(w => ({ type: 'Feature', properties: { id: w.id }, geometry: w.f.geometry })), { merge: 'id', simplify: '15%' })
  writeLayer('wuesten', out.map(f => ({ i: f.properties.id, g: f.geometry })))
  const seen = new Set()
  put('welt-natur', 'welt-wuesten', W.filter(w => !seen.has(w.id) && seen.add(w.id)).map(w => ({
    key: `wueste:${w.id}`, label: w.name, aliases: D.WUESTE_ALIAS[w.name] ?? [], group: w.group, areas: [`wuesten:${w.id}`],
    details: [{ label: 'Kontinent', value: CONT_NAME[w.group] }, ...(w.land ? [{ label: 'Land', value: COUNTRY[w.land]?.name ?? w.land }] : [])],
  })))
}

/* ═════════════ 9. Millionenstädte ═════════════ */
console.log('Millionenstädte …')
{
  const NEP = readJson(src('ne_10m_populated_places.geojson')).features.map(f => f.properties)
  const RENAME = { 'New York City': 'New York', 'Mexico City': 'Mexiko-Stadt' }
  /** Deutscher Name aus Natural Earth – nur, wenn es nachweislich derselbe Ort ist (gleicher Name, < 30 km) */
  const deName = (iso, ll, name) => {
    if (RENAME[name]) return RENAME[name]
    const n0 = normName(name)
    let best = null, bd = 30
    for (const p of NEP) {
      if (p.ISO_A2 !== iso || !p.NAME_DE) continue
      const same = [p.NAME, p.NAMEASCII, p.NAME_EN, ...String(p.NAMEALT ?? '').split('|')].some(x => x && normName(x) === n0)
      if (!same) continue
      const d = geoDistance([p.LONGITUDE, p.LATITUDE], ll) * 6371
      if (d < bd) { bd = d; best = p }
    }
    return best?.NAME_DE || null
  }
  const cities = readJson(src('cities500.json')).filter(c => +c.pop >= 1e6 && !D.STADT_RAUS.has(+c.id))
  const list = cities.map(c => {
    const ll = [r3(+c.lon), r3(+c.lat)]
    const nm = deName(c.country, ll, c.name) ?? c.name
    return { name: nm, alt: c.name, iso: c.country, adm1: c.admin1, ll, pop: +c.pop, src: 'GeoNames' }
  })
  for (const x of D.STADT_EXTRA) list.push({ name: x.name, alt: (x.aliases ?? [])[0], iso: x.iso, ll: x.ll, pop: x.pop, src: x.note, aliases: x.aliases })
  const dup = list.reduce((m, c) => ((m[c.name] ??= []).push(c), m), {})
  const ids = new Set()
  put('welt-orte', 'welt-millionenstaedte', list.map(c => {
    const land = NAME_OF_ISO2(c.iso)
    const same = dup[c.name]
    const label = same.length < 2 ? c.name : same.every(x => x.iso === c.iso) ? `${c.name} (${c.adm1})` : `${c.name} (${land})`
    let id = slug(`${c.name}-${c.iso}`), n = 2
    while (ids.has(id)) id = `${slug(`${c.name}-${c.iso}`)}-${n++}`
    ids.add(id)
    return {
      key: `stadt:${id}`, label, prompt: label, aliases: uniq([c.alt !== c.name ? c.alt : null, ...(c.aliases ?? []), c.name !== label ? c.name : null]),
      group: groupOfIso2(c.iso, c.ll[0]) ?? 'asien', point: c.ll,
      details: [{ label: 'Land', value: land, big: true }, { label: 'Einwohner', value: `${fmtPop(c.pop)} (${c.src})` }],
      text: { prompt: `In welchem Land liegt ${label}?`, answer: land },
    }
  }))
}

/* ═════════════ 10. Flughäfen ═════════════ */
console.log('Flughäfen …')
{
  const A = parseCsv(fs.readFileSync(src('airports.csv'), 'utf8')).filter(a => a.iata_code && a.scheduled_service === 'yes')
  const byIata = {}
  for (const a of A) if (!byIata[a.iata_code] || a.type === 'large_airport') byIata[a.iata_code] = a
  const make = (a, label, extra = {}) => {
    const ll = [r3(+a.longitude_deg), r3(+a.latitude_deg)]
    const land = NAME_OF_ISO2(a.iso_country)
    return {
      key: `apt:${a.iata_code}`, label, point: ll, group: groupOfIso2(a.iso_country, ll[0], OA_CONT[a.continent]) ?? 'asien',
      details: [
        { label: 'Code', value: a.iata_code, big: true },
        { label: 'Flughafen', value: a.name },
        { label: 'Stadt', value: a.municipality || '–' },
        { label: 'Land', value: land },
      ],
      ...extra,
    }
  }
  const top = D.FLUGHAFEN_TOP.map(([code, label, mio], i) => {
    const a = byIata[code]
    if (!a) { warn('Flughafen fehlt', code); return null }
    const it = make(a, label, { prompt: label, promptSub: code, aliases: uniq([code, ...(D.FLUGHAFEN_ALIAS[code] ?? [])]) })
    it.details.push({ label: 'Passagiere 2024', value: `${mio.toLocaleString('de-DE')} Mio. (Platz ${i + 1} weltweit)` })
    it.text = { prompt: `IATA-Code von ${label}?`, answer: code }
    return it
  }).filter(Boolean)
  put('welt-orte', 'welt-flughaefen', top)
  // Schwer: alle großen Flughäfen mit Linienverkehr – gefragt wird nur der Code
  const large = Object.values(byIata).filter(a => a.type === 'large_airport')
  put('welt-orte', 'welt-flughaefen-schwer', large.map(a => {
    const city = a.municipality || a.name
    return make(a, a.iata_code, { prompt: a.iata_code, aliases: [], text: { prompt: `Welche Stadt hat den Flughafen ${a.iata_code}?`, answer: city.replace(/\s*\(.*\)$/, '') } })
  }))
}

/* ═════════════ 11. Flaggen ═════════════ */
console.log('Flaggen …')
{
  const fiDir = path.join(SRC, 'flag-icons')
  if (!fs.existsSync(path.join(fiDir, 'package/flags/4x3'))) {
    fs.mkdirSync(fiDir, { recursive: true })
    execSync('npm pack flag-icons@7.5.0 --silent', { cwd: fiDir })
    execSync('tar xzf flag-icons-7.5.0.tgz', { cwd: fiDir })
  }
  const need = uniq([...Object.values(ISO2).map(s => s.toLowerCase()), ...D.GEBIETE.map(g => g.flag)])
  const flags = {}
  for (const code of need) {
    const p = path.join(fiDir, 'package/flags/4x3', `${code}.svg`)
    if (!fs.existsSync(p)) { warn('Flagge fehlt', code); continue }
    flags[code] = fs.readFileSync(p, 'utf8').replace(/<\?xml[^>]*>/, '').replace(/\s*\n\s*/g, ' ').replace(/>\s+</g, '><').trim()
  }
  const file = path.join(root, 'public/geo/flags.json')
  fs.writeFileSync(file, JSON.stringify(flags))
  console.log(`  flags.json  ${(fs.statSync(file).size / 1024).toFixed(0)} KB  (${Object.keys(flags).length} Flaggen)`)
}

/* ═════════════ Ausgabe ═════════════ */
const counts = {}
for (const [file, bySlug] of Object.entries(ITEMS)) {
  const p = path.join(OUT_ITEMS, `${file}.json`)
  fs.writeFileSync(p, JSON.stringify(bySlug))
  console.log(`  items/${file}.json  ${(fs.statSync(p).size / 1024).toFixed(0)} KB`)
  for (const [s, list] of Object.entries(bySlug)) counts[s] = list.length
}
fs.writeFileSync(path.join(root, 'app/geo/_data/welt-extra.ts'),
  `// Automatisch erzeugt von scripts/geo/build-welt.mjs – nicht von Hand ändern.\n` +
  `/** ISO-3166-Alpha-2 je Land (für Flaggen) */\n` +
  `export const ISO2: Record<string, string> = ${JSON.stringify(Object.fromEntries(Object.entries(ISO2).map(([k, v]) => [k, v.toLowerCase()])))}\n` +
  `/** Anzahl Einträge je Quiz (die Einträge selbst liegen in public/geo/items/*.json) */\n` +
  `export const ITEM_COUNTS: Record<string, number> = ${JSON.stringify(counts)}\n`)
console.log('fertig.')
