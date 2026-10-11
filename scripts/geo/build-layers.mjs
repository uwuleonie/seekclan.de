// Baut die Kartendaten für seekclan.de/geo.
//
// Nur für Entwicklung – wird NICHT beim normalen `npm run build` ausgeführt.
// Ergebnis liegt fertig im Repo (public/geo/layers/*.json und app/geo/_data/*.ts).
//
// Benötigt (einmalig):  npm i -g mapshaper
// Quellen werden nach scripts/geo/.src geladen (siehe SOURCES unten), danach:
//   node scripts/geo/build-layers.mjs
//
// Quellen:
//  - Natural Earth 1:10m (gemeinfrei) https://www.naturalearthdata.com  – Länder in deutscher Sicht (_deu),
//    Verwaltungsgrenzen (admin 1), Orte (populated places)
//  - Brasilien: Gemeindegrenzen IBGE via github.com/tbrugz/geodata-br, Vorwahl je Gemeinde via github.com/kelvins/municipios-brasileiros

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { geoArea, geoNaturalEarth1, geoPath } from 'd3-geo'
import { COUNTRIES_RAW, CAPITAL_FALLBACK } from './countries.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const SRC = process.env.GEO_SRC || path.join(here, '.src')
const OUT_LAYERS = path.join(root, 'public/geo/layers')
const OUT_DATA = path.join(root, 'app/geo/_data')
const TMP = path.join(SRC, 'tmp')
fs.mkdirSync(OUT_LAYERS, { recursive: true })
fs.mkdirSync(OUT_DATA, { recursive: true })
fs.mkdirSync(TMP, { recursive: true })

const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson'
const SOURCES = {
  'ne_10m_admin_0_countries_deu.geojson': `${NE}/ne_10m_admin_0_countries_deu.geojson`,
  'ne_110m_admin_0_countries.geojson': `${NE}/ne_110m_admin_0_countries.geojson`,
  'ne_10m_admin_1_states_provinces.geojson': `${NE}/ne_10m_admin_1_states_provinces.geojson`,
  'ne_10m_populated_places.geojson': `${NE}/ne_10m_populated_places.geojson`,
  'mun-br.json': 'https://raw.githubusercontent.com/tbrugz/geodata-br/master/geojson/geojs-100-mun.json',
  'municipios.csv': 'https://raw.githubusercontent.com/kelvins/municipios-brasileiros/main/csv/municipios.csv',
}
for (const [file, url] of Object.entries(SOURCES)) {
  const p = path.join(SRC, file)
  if (!fs.existsSync(p)) {
    console.log('lade', file)
    execSync(`curl -sSL -o "${p}" "${url}"`)
  }
}

const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'))
const ms = (args) => execSync(`mapshaper ${args}`, { stdio: ['ignore', 'ignore', 'inherit'] })
const r3 = n => Math.round(n * 1000) / 1000

/**
 * d3-geo erwartet Außenringe im Uhrzeigersinn – mapshaper schreibt GeoJSON nach RFC 7946 (gegen den Uhrzeigersinn).
 * Ist eine Fläche dadurch "umgedreht" (größer als die halbe Erdkugel), drehen wir jeden Ring einzeln um.
 */
function rewind(g) {
  if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) return g
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  const fixed = polys.map(rings => {
    const poly = { type: 'Polygon', coordinates: rings }
    return geoArea(poly) > 2 * Math.PI ? rings.map(r => [...r].reverse()) : rings
  })
  return g.type === 'Polygon' ? { type: 'Polygon', coordinates: fixed[0] } : { type: 'MultiPolygon', coordinates: fixed }
}

/** Schreibt eine Ebene im kompakten Format { id, f: [{ i, g, c? }] } */
function writeLayer(id, features) {
  for (const f of features) f.g = rewind(f.g)
  const out = { id, f: features }
  const file = path.join(OUT_LAYERS, `${id}.json`)
  fs.writeFileSync(file, JSON.stringify(out))
  console.log(`  ${id}.json  ${(fs.statSync(file).size / 1024).toFixed(0)} KB  (${features.length} Flächen)`)
}

/* ───────────── Welt (Länder) ───────────── */
console.log('Welt …')
const worldTmp = path.join(TMP, 'world.json')
ms(`"${path.join(SRC, 'ne_10m_admin_0_countries_deu.geojson')}" -filter-fields ADM0_A3,LABEL_X,LABEL_Y,POP_EST -simplify 6% weighted keep-shapes -o "${worldTmp}" format=geojson precision=0.001`)
const world = readJson(worldTmp)
writeLayer('world', world.features.map(f => ({
  i: f.properties.ADM0_A3,
  g: f.geometry,
  c: [r3(f.properties.LABEL_X), r3(f.properties.LABEL_Y)],
})))
const popOf = Object.fromEntries(world.features.map(f => [f.properties.ADM0_A3, f.properties.POP_EST]))

/* ───────────── Orte (für Hauptstädte) ───────────── */
const places = readJson(path.join(SRC, 'ne_10m_populated_places.geojson')).features.map(f => f.properties)
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

function findPlace(iso3, names, { preferCapital = true } = {}) {
  const wanted = names.filter(Boolean).map(norm)
  const cands = places.filter(p => (p.ADM0_A3 === iso3 || p.SOV_A3 === iso3) &&
    [p.NAME, p.NAME_DE, p.NAMEASCII, p.NAME_EN, p.NAMEALT, p.LS_NAME].some(n => wanted.includes(norm(n))))
  if (!cands.length) return null
  cands.sort((a, b) => (preferCapital ? (b.ADM0CAP - a.ADM0CAP) : 0) || (b.POP_MAX - a.POP_MAX))
  return cands[0]
}

/* ───────────── Länderliste → app/geo/_data/world.ts ───────────── */
console.log('Länderliste …')
const countries = COUNTRIES_RAW.trim().split('\n').map(line => {
  const [id, name, cont, region, capital, search, aliases] = line.split('|')
  const place = findPlace(id, [capital, search])
  let cap = place ? [r3(place.LONGITUDE), r3(place.LATITUDE)] : CAPITAL_FALLBACK[id]
  if (CAPITAL_FALLBACK[id] && !place) cap = CAPITAL_FALLBACK[id]
  if (!cap) console.warn(`  ! Hauptstadt nicht gefunden: ${id} ${capital}`)
  if (!world.features.some(f => f.properties.ADM0_A3 === id)) console.warn(`  ! Land fehlt in der Karte: ${id}`)
  return {
    id, name,
    continents: cont.split(','),
    region,
    capital,
    cap: cap ?? null,
    pop: popOf[id] ?? null,
    aliases: aliases ? aliases.split(',').map(s => s.trim()).filter(Boolean) : [],
  }
})
fs.writeFileSync(path.join(OUT_DATA, 'world.ts'),
  `// Automatisch erzeugt von scripts/geo/build-layers.mjs – nicht von Hand ändern (Quelle: scripts/geo/countries.mjs)\n` +
  `// Karten: Natural Earth (gemeinfrei), Grenzen in deutscher Sicht. Einwohner: Natural Earth POP_EST.\n` +
    `export interface WorldCountry { id: string; name: string; continents: string[]; region: string; capital: string; cap: [number, number] | null; pop: number | null; aliases: string[] }\n` +
  `export const COUNTRIES: WorldCountry[] = ${JSON.stringify(countries)}\n`)
console.log(`  world.ts  (${countries.length} Länder)`)

/* ───────────── Verwaltungsgrenzen (admin 1) ───────────── */
const ADM1 = {
  DEU: '18%', AUT: '25%', USA: '8%', BRA: '10%', IND: '10%', TUR: '14%', JPN: '14%',
}
const adm1Src = path.join(SRC, 'ne_10m_admin_1_states_provinces.geojson')
const adm1Meta = {}
for (const [iso, pct] of Object.entries(ADM1)) {
  console.log(`Admin-1 ${iso} …`)
  const tmp = path.join(TMP, `adm1-${iso}.json`)
  ms(`"${adm1Src}" -filter "adm0_a3 === '${iso}'" -filter-fields iso_3166_2,name,name_de,latitude,longitude -simplify ${pct} weighted keep-shapes -o "${tmp}" format=geojson precision=0.001`)
  const fc = readJson(tmp)
  writeLayer(`adm1-${iso}`, fc.features.map(f => ({
    i: f.properties.iso_3166_2,
    g: f.geometry,
    c: [r3(f.properties.longitude), r3(f.properties.latitude)],
  })))
  adm1Meta[iso] = fc.features.map(f => {
    const p = f.properties
    const capPlace = places.filter(pl => pl.ADM0_A3 === iso && pl.FEATURECLA === 'Admin-1 capital' && norm(pl.ADM1NAME) === norm(p.name))
      .sort((a, b) => b.POP_MAX - a.POP_MAX)[0]
    return {
      id: p.iso_3166_2,
      name: p.name,
      nameDe: p.name_de || p.name,
      capital: capPlace ? { name: capPlace.NAME_DE || capPlace.NAME, ll: [r3(capPlace.LONGITUDE), r3(capPlace.LATITUDE)] } : null,
    }
  }).sort((a, b) => a.id.localeCompare(b.id))
}
fs.writeFileSync(path.join(OUT_DATA, 'adm1.ts'),
  `// Automatisch erzeugt von scripts/geo/build-layers.mjs – nicht von Hand ändern.\n` +
  `// Verwaltungsgrenzen (Bundesländer, Staaten, Provinzen) aus Natural Earth (gemeinfrei).\n` +
    `export interface Adm1Meta { id: string; name: string; nameDe: string; capital: { name: string; ll: [number, number] } | null }\n` +
  `export const ADM1: Record<string, Adm1Meta[]> = ${JSON.stringify(adm1Meta)}\n`)

/* ───────────── Orts-Listen (Städte-Quizzes) → app/geo/_data/places.ts ───────────── */
// Je Liste: Land + Städtenamen. Koordinaten kommen aus Natural Earth (größter Ort mit dem Namen im Land).
const PLACE_LISTS = {
  'tr-cities': { iso: 'TUR', names: ['İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Adana', 'Gaziantep', 'Konya', 'Antalya', 'Trabzon', 'Diyarbakır', 'Mersin', 'Samsun', 'Kayseri', 'Eskişehir', 'İzmit', 'Malatya', 'Şanlıurfa', 'Erzurum', 'Kahramanmaraş', 'Denizli', 'Van', 'Batman', 'Adapazarı', 'Rize', 'Elazığ', 'Sivas', 'Balıkesir', 'Manisa', 'Adıyaman', 'Aydın'] },
}
const ALT_NAMES = { 'İzmit': ['Kocaeli'], 'Adapazarı': ['Sakarya', 'Adapazari'], 'Şanlıurfa': ['Urfa', 'Sanliurfa'], 'Kahramanmaraş': ['Kahramanmaras'] }
const placesOut = {}
for (const [key, { iso, names }] of Object.entries(PLACE_LISTS)) {
  placesOut[key] = {}
  for (const n of names) {
    const p = findPlace(iso, [n, ...(ALT_NAMES[n] ?? [])], { preferCapital: false })
    if (!p) { console.warn(`  ! Ort nicht gefunden: ${key} ${n}`); continue }
    placesOut[key][n] = [r3(p.LONGITUDE), r3(p.LATITUDE)]
  }
}
fs.writeFileSync(path.join(OUT_DATA, 'places.ts'),
  `// Automatisch erzeugt von scripts/geo/build-layers.mjs – nicht von Hand ändern.\n` +
  `// Koordinaten [Länge, Breite] aus Natural Earth populated places (gemeinfrei).\n` +
    `export const PLACES: Record<string, Record<string, [number, number]>> = ${JSON.stringify(placesOut)}\n`)

/* ───────────── Brasilien: Vorwahlen (DDD) ───────────── */
console.log('Brasilien DDD …')
const csv = fs.readFileSync(path.join(SRC, 'municipios.csv'), 'utf8').trim().split('\n')
const head = csv[0].split(',')
const iCode = head.indexOf('codigo_ibge'), iDdd = head.indexOf('ddd'), iUf = head.indexOf('codigo_uf')
const dddOf = {}
for (const line of csv.slice(1)) {
  const c = line.split(',')
  dddOf[c[iCode]] = { ddd: c[iDdd], uf: c[iUf] }
}
const mun = readJson(path.join(SRC, 'mun-br.json'))
let missing = 0
for (const f of mun.features) {
  const d = dddOf[f.properties.id]
  if (!d) missing++
  f.properties = { ddd: d?.ddd ?? '00', uf: d?.uf ?? '00' }
}
if (missing) console.warn(`  ! ${missing} Gemeinden ohne Vorwahl`)
const munTmp = path.join(TMP, 'mun-ddd.json')
fs.writeFileSync(munTmp, JSON.stringify(mun))
const dddTmp = path.join(TMP, 'ddd.json')
ms(`"${munTmp}" -dissolve2 ddd copy-fields=uf -simplify 4% weighted keep-shapes -o "${dddTmp}" format=geojson precision=0.001`)
const ddd = readJson(dddTmp)
writeLayer('br-ddd', ddd.features.filter(f => f.properties.ddd !== '00').map(f => ({ i: String(f.properties.ddd), g: f.geometry })))

/* ───────────── Seiten-Hintergrund: weiche, verschwommene Kontinente ───────────── */
console.log('Hintergrund …')
{
  const fc = readJson(path.join(SRC, 'ne_110m_admin_0_countries.geojson'))
  fc.features = fc.features.filter(f => f.properties.ADM0_A3 !== 'ATA')
  const BW = 1600, BH = 900
  const proj = geoNaturalEarth1().fitExtent([[-60, 40], [BW + 60, BH + 160]], { type: 'Sphere' })
  const d = geoPath(proj).digits(0)(fc)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BW} ${BH}" preserveAspectRatio="xMidYMid slice">` +
    `<defs><filter id="b" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="22"/></filter>` +
    `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3fa7a8"/><stop offset=".55" stop-color="#2f6f8a"/><stop offset="1" stop-color="#c9905a"/></linearGradient></defs>` +
    `<path d="${d}" fill="url(#g)" filter="url(#b)"/></svg>`
  fs.mkdirSync(path.join(root, 'public/geo'), { recursive: true })
  fs.writeFileSync(path.join(root, 'public/geo/bg-world.svg'), svg)
  console.log(`  bg-world.svg  ${(svg.length / 1024).toFixed(0)} KB`)
}

console.log('fertig.')