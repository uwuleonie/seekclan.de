// Länderseiten von seekclan.de/geo (/geo/land/<slug>): Daten und Karten für alle Länder der Weltkarte.
//
//   node scripts/geo/build-laenderseiten.mjs
//
// Quellen (liegen in GEO_SRC, Standard scripts/geo/.src):
//   factbook/<fips>.json       CIA World Factbook (github.com/factbook/factbook.json, gemeinfrei): Wirtschaft, Handel,
//                              Rohstoffe, Staatsform, Sprachen, Nachbarländer, Zeitzone
//   fips.json                  Zuordnung FIPS → ISO3 (aus Natural Earth)
//   country-codes.csv          github.com/datasets/country-codes (ODC-PDDL): ISO2, Währung
//   ne_10m_admin_0_countries_deu.geojson   Natural Earth (gemeinfrei): englische Ländernamen für die Zuordnung
//   ne_10m_admin_1_states_provinces.geojson Natural Earth (gemeinfrei): Provinzen und Regionen aller Länder
// Aus dem Projekt: public/geo/layers/world.json (Umrisse), app/geo/_data/world.ts (Länder), public/geo/items/welt-*.json
// (Vorwahl, Domain, Millionenstädte), public/geo/gg*/index.json (GeoGuessr-Steckbriefe).
//
// Erzeugt:
//   public/geo/land/<ISO3>.json     Daten je Land (Texte übersetzt mit scripts/geo/land/woerter.mjs)
//   public/geo/land/karte/<ISO3>.svg  Lagekarte (Land bernsteinfarben, Umgebung grau)
//   public/geo/land/karte/<ISO3>-form.svg  Das Land allein mit Hauptstadt und Millionenstädten
//   public/geo/land/adm1/<ISO3>.json  Provinzen/Regionen aus Natural Earth admin_1 (vereinfacht, mit deutschen Namen) – die
//                                     Länderseite nimmt sie nur, wenn es im Atlas kein eigenes Regionen-Quiz für das Land gibt.
//                                     Braucht einmalig: npm i -g mapshaper
//   app/geo/_data/land.ts           Liste aller Länder (slug, ISO3, Name, Flagge, Kontinent)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { geoBounds, geoMercator, geoNaturalEarth1, geoConicEqualArea, geoPath, geoCentroid, geoArea } from 'd3-geo'
import { WAREN, STAATSFORM, SEKTOR, VERWENDUNG } from './land/woerter.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const SRC = process.env.GEO_SRC || path.join(here, '.src')
const OUT = path.join(root, 'public/geo/land')
const OUT_KARTE = path.join(OUT, 'karte')
const OUT_ADM1 = path.join(OUT, 'adm1')
for (const d of [OUT_KARTE, OUT_ADM1]) fs.mkdirSync(d, { recursive: true })
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'))

/* ───────────── Länder ───────────── */

const worldTs = fs.readFileSync(path.join(root, 'app/geo/_data/world.ts'), 'utf8')
const COUNTRIES = JSON.parse(/export const COUNTRIES: WorldCountry\[\] = (\[.*?\])\n/s.exec(worldTs)[1])
const WORLD = Object.fromEntries(readJson(path.join(root, 'public/geo/layers/world.json')).f.map(f => [f.i, f.g]))
const slugify = s => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// country-codes.csv: ISO2 (Flagge), Währung
function csv(text) {
  const rows = []
  let row = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ } else if (ch === '"') q = false; else cell += ch }
    else if (ch === '"') q = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (ch !== '\r') cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const [head, ...rest] = rows
  return rest.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])))
}
const CC = {}
for (const r of csv(fs.readFileSync(path.join(SRC, 'country-codes.csv'), 'utf8'))) if (r['ISO3166-1-Alpha-3']) CC[r['ISO3166-1-Alpha-3']] = r
const ISO2 = { KOS: 'XK', PSX: 'PS', SDS: 'SS' }
const iso2 = iso => (ISO2[iso] ?? CC[iso]?.['ISO3166-1-Alpha-2'] ?? '').toUpperCase()

// Factbook je Land
const FIPS = {}
for (const [f, i] of readJson(path.join(SRC, 'fips.json'))) if (!FIPS[i]) FIPS[i] = f
Object.assign(FIPS, { KOS: 'kv', SDS: 'od', TWN: 'tw', VAT: 'vt', FRA: 'fr', NOR: 'no', NLD: 'nl', DNK: 'da', GBR: 'uk', USA: 'us', AUS: 'as', NZL: 'nz', FIN: 'fi', CHN: 'ch', ISR: 'is', CYP: 'cy', SOM: 'so', MAR: 'mo', SRB: 'ri', KAZ: 'kz', GEO: 'gg', BIH: 'bk', BEL: 'be', PRT: 'po', IRQ: 'iz', ATG: 'ac', PNG: 'pp', PSX: 'we' })
const REGION_FB = {}
try { for (const z of fs.readFileSync(path.join(SRC, 'factbook', '_regions.txt'), 'utf8').split('\n')) { const [f, r] = z.trim().split(/\s+/); if (f && r) REGION_FB[f] = r } } catch { /* fehlt */ }
const factbook = iso => {
  const p = path.join(SRC, 'factbook', `${FIPS[iso]}.json`)
  return FIPS[iso] && fs.existsSync(p) ? readJson(p) : null
}
const txt = o => (o && typeof o === 'object' && 'text' in o ? String(o.text) : '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
const jahr = t => { const m = /\((?:\D*)(\d{4})/.exec(t); return m ? Number(m[1]) : null }
const prozent = t => { const m = /(-?[\d.]+)%/.exec(t); return m ? Number(m[1]) : null }

/* ───────────── Englische Namen → ISO3 ───────────── */

const NAME2ISO = {}
const putName = (n, iso) => { if (n) NAME2ISO[n.toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ').trim()] = iso }
const DE_IDS = new Set(COUNTRIES.map(c => c.id))
for (const f of readJson(path.join(SRC, 'ne_10m_admin_0_countries_deu.geojson')).features) {
  const p = f.properties
  let iso = p.ADM0_A3_DE || p.ADM0_A3
  if (!DE_IDS.has(iso) && DE_IDS.has(p.ADM0_A3)) iso = p.ADM0_A3
  for (const k of ['ADMIN', 'NAME', 'NAME_LONG', 'BRK_NAME', 'NAME_CIAWF', 'NAME_SORT', 'FORMAL_EN', 'NAME_EN']) putName(p[k], iso)
}
for (const [n, iso] of Object.entries({
  US: 'USA', USA: 'USA', 'United States': 'USA', UK: 'GBR', UAE: 'ARE', DRC: 'COD', 'Democratic Republic of the Congo': 'COD', 'Republic of the Congo': 'COG',
  'Congo, Republic of the': 'COG', 'Congo, Democratic Republic of the': 'COD', 'S. Korea': 'KOR', 'South Korea': 'KOR', 'Korea, South': 'KOR', 'North Korea': 'PRK', 'Korea, North': 'PRK',
  NZ: 'NZL', Burma: 'MMR', 'Holy See (Vatican City)': 'VAT', "Cote d'Ivoire": 'CIV', 'The Gambia': 'GMB', 'Gambia, The': 'GMB', 'Bahamas, The': 'BHS', Czechia: 'CZE', 'Czech Republic': 'CZE',
  Macedonia: 'MKD', 'North Macedonia': 'MKD', Eswatini: 'SWZ', 'Timor-Leste': 'TLS', 'Gaza Strip': 'PSX', 'West Bank': 'PSX', Kosovo: 'KOS', 'South Sudan': 'SDS', Turkey: 'TUR', Turkiye: 'TUR',
  'Micronesia, Federated States of': 'FSM', 'Bosnia and Herzegovina': 'BIH', 'Antigua and Barbuda': 'ATG', 'Trinidad and Tobago': 'TTO', 'St. Vincent and the Grenadines': 'VCT', 'St. Lucia': 'LCA', 'St. Kitts and Nevis': 'KNA',
  'French Guiana': 'GUF', 'Hong Kong': 'HKG', Taiwan: 'TWN', Russia: 'RUS', Vietnam: 'VNM', Laos: 'LAO', Syria: 'SYR', Iran: 'IRN', Moldova: 'MDA', Tanzania: 'TZA', Bolivia: 'BOL', Venezuela: 'VEN', Brunei: 'BRN', 'Cabo Verde': 'CPV',
})) putName(n, iso)
/** ISO3 eines englischen Ländernamens aus dem Factbook (Zusätze in Klammern zählen nicht: „Russia (Kaliningrad)“) */
function isoOf(name) {
  const n = name.toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ').trim()
  return NAME2ISO[n] ?? NAME2ISO[n.replace(/\s*\(.*\)$/, '')] ?? null
}

/* ───────────── Übersetzen ───────────── */

const FEHLT = { ware: new Map(), land: new Map(), staat: new Map(), sprache: new Map() }
const fehlt = (art, w) => FEHLT[art].set(w, (FEHLT[art].get(w) ?? 0) + 1)

/** Liste „cars, vehicle parts, gold (2023)“ → deutsche Begriffe (unbekannte fallen weg, doppelte auch) */
function waren(t) {
  if (!t) return []
  const s = t.replace(/note:.*$/i, '').replace(/\(\d{4}[^)]*\)/g, '').replace(/\b(\d{4}) est\.?/g, '')
  const out = []
  for (let w of s.split(/[,;]/)) {
    w = w.trim().toLowerCase().replace(/\.$/, '').replace(/^and /, '')
    if (!w || w === 'none' || w === 'negl') continue
    const de = WAREN[w]
    if (!de) { fehlt('ware', w); continue }
    if (!out.includes(de)) out.push(de)
  }
  return out
}

const DN_REGION = new Intl.DisplayNames(['de'], { type: 'region' })
const deName = iso => COUNTRIES.find(c => c.id === iso)?.name ?? (iso2(iso) ? DN_REGION.of(iso2(iso)) : iso)
/** „USA 10%, France 8%, Korea, South 5% (2023)“ → [{iso, name, anteil}] */
function partner(t) {
  if (!t) return []
  const s = t.replace(/\(\d{4}[^)]*\)/g, '').replace(/, (The|Republic of the|Democratic Republic of the|South|North|Federated States of)\b/g, (m, x) => ` §${x}`)
  const out = []
  for (const teil of s.split(',')) {
    const m = /^\s*(.*?)\s+([\d.]+)%/.exec(teil)
    if (!m) continue
    let name = m[1].replace(/ §(.*)$/, (mm, x) => `, ${x}`)
    const iso = isoOf(name)
    if (!iso) fehlt('land', name)
    out.push({ iso, name: iso ? deName(iso) : null, en: iso ? undefined : name, anteil: Number(m[2]) })
  }
  return out.filter(p => p.name)
}

function staatsform(t) {
  const s = t.toLowerCase().replace(/&nbsp;/g, ' ').replace(/ \([^)]*\)/g, '')
  for (const [en, de] of STAATSFORM) if (s.startsWith(en)) {
    if (!/commonwealth realm/.test(s)) return de
    return de.endsWith(')') ? `${de.slice(0, -1)}, Commonwealth Realm)` : `${de} (Commonwealth Realm)`
  }
  if (s) fehlt('staat', s.slice(0, 90))
  return null
}

// Sprachen: englischer Name → deutscher Name (über Intl)
const DN_EN = new Intl.DisplayNames(['en'], { type: 'language' })
const DN_DE = new Intl.DisplayNames(['de'], { type: 'language' })
const SPRACHE = {}
const CODES = 'aa ab af ak am an ar as av ay az ba be bg bh bi bm bn bo br bs ca ce ch co cr cs cu cv cy da de dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id ie ig ii ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh zu'.split(' ')
  .concat('ace ady ain ale alt ang arn ast awa ban bem bho bik bin bla byn ceb chk chr chy ckb crh csb dak dar dgr din doi dsb dua dyu efi eka ewo fan fil fon fur gaa gag gay gil gom gor grc gsw guz gwi hai haw hil hmn hsb hup iba ibb ilo inh jbo kaa kab kac kam kbd kea kfo kha khq kmb kok kos kpe krc krl kru ksh kum lad lah lez lkt loz lrc lua lun luo lus luy mad mag mai mak man mas mdf men mer mfe mgh mic min mni moh mos mua mus mwl myv mzn nap naq nds new nia niu nmg nog nqo nso nus nyn osa pag pam pap pau pon prg quc raj rap rar rof rom rup rwk sad sah sat sba sbp scn sco seh sel ses shn sid sma smj smn sms snk sog srn srr ssy suk sus swb syr tem teo tet tig tiv tkl tlh tli tmh tog tpi tum tvl tyv tzm udm umb vai vun wae wal war was wuu xal xog yao yap yav ybb yue zap zbl zen zgh zun zza'.split(' '))
for (const c of CODES) { try { const en = DN_EN.of(c), de = DN_DE.of(c); if (en && de && en !== c) SPRACHE[en.toLowerCase()] = de } catch { /* unbekannt */ } }
Object.assign(SPRACHE, {
  'mandarin': 'Mandarin (Chinesisch)', 'standard chinese': 'Chinesisch', 'chinese': 'Chinesisch', 'cantonese': 'Kantonesisch', 'persian': 'Persisch', 'farsi': 'Persisch', 'dari': 'Dari (Persisch)', 'pashto': 'Paschtu',
  'filipino': 'Filipino', 'tagalog': 'Tagalog', 'malay': 'Malaiisch', 'bahasa malaysia': 'Malaiisch', 'bahasa indonesia': 'Indonesisch', 'indonesian': 'Indonesisch', 'swahili': 'Swahili', 'kiswahili': 'Swahili',
  'creole': 'Kreolisch', 'french creole': 'Kreolisch', 'haitian creole': 'Haitianisch', 'english-based creole': 'Kreolisch', 'portuguese-based creole': 'Kreolisch', 'mauritian creole': 'Morisyen (Kreolisch)', 'seychellois creole': 'Seselwa (Kreolisch)',
  'sango': 'Sango', 'kirundi': 'Kirundi', 'kinyarwanda': 'Kinyarwanda', 'sesotho': 'Sesotho', 'setswana': 'Setswana', 'siswati': 'Swati', 'isizulu': 'Zulu', 'isixhosa': 'Xhosa', 'afrikaans': 'Afrikaans', 'sepedi': 'Sepedi',
  'tigrinya': 'Tigrinya', 'amharic': 'Amharisch', 'oromo': 'Oromo', 'somali': 'Somali', 'berber': 'Berbersprachen', 'tamazight': 'Tamazight (Berberisch)', 'arabic': 'Arabisch', 'hebrew': 'Hebräisch', 'english': 'Englisch',
  'spanish': 'Spanisch', 'castilian spanish': 'Spanisch', 'castilian': 'Spanisch', 'portuguese': 'Portugiesisch', 'french': 'Französisch', 'german': 'Deutsch', 'swiss german': 'Schweizerdeutsch', 'italian': 'Italienisch', 'dutch': 'Niederländisch',
  'flemish': 'Flämisch (Niederländisch)', 'luxembourgish': 'Luxemburgisch', 'romansh': 'Rätoromanisch', 'catalan': 'Katalanisch', 'galician': 'Galicisch', 'basque': 'Baskisch', 'greek': 'Griechisch', 'turkish': 'Türkisch', 'kurdish': 'Kurdisch',
  'russian': 'Russisch', 'ukrainian': 'Ukrainisch', 'belarusian': 'Belarussisch', 'polish': 'Polnisch', 'czech': 'Tschechisch', 'slovak': 'Slowakisch', 'hungarian': 'Ungarisch', 'romanian': 'Rumänisch', 'moldovan': 'Rumänisch',
  'bulgarian': 'Bulgarisch', 'serbian': 'Serbisch', 'croatian': 'Kroatisch', 'bosnian': 'Bosnisch', 'montenegrin': 'Montenegrinisch', 'slovenian': 'Slowenisch', 'slovene': 'Slowenisch', 'macedonian': 'Mazedonisch', 'albanian': 'Albanisch',
  'swedish': 'Schwedisch', 'norwegian': 'Norwegisch', 'danish': 'Dänisch', 'finnish': 'Finnisch', 'icelandic': 'Isländisch', 'estonian': 'Estnisch', 'latvian': 'Lettisch', 'lithuanian': 'Litauisch', 'irish': 'Irisch', 'gaelic': 'Irisch',
  'maltese': 'Maltesisch', 'georgian': 'Georgisch', 'armenian': 'Armenisch', 'azerbaijani': 'Aserbaidschanisch', 'azeri': 'Aserbaidschanisch', 'kazakh': 'Kasachisch', 'uzbek': 'Usbekisch', 'turkmen': 'Turkmenisch', 'kyrgyz': 'Kirgisisch',
  'tajik': 'Tadschikisch', 'mongolian': 'Mongolisch', 'khalkha mongol': 'Mongolisch', 'hindi': 'Hindi', 'bengali': 'Bengalisch', 'bangla': 'Bengalisch', 'urdu': 'Urdu', 'punjabi': 'Panjabi', 'nepali': 'Nepali', 'sinhala': 'Singhalesisch',
  'tamil': 'Tamil', 'dzongkha': 'Dzongkha', 'dhivehi': 'Dhivehi', 'thai': 'Thai', 'lao': 'Laotisch', 'khmer': 'Khmer', 'burmese': 'Birmanisch', 'vietnamese': 'Vietnamesisch', 'korean': 'Koreanisch', 'japanese': 'Japanisch',
  'tetum': 'Tetum', 'samoan': 'Samoanisch', 'tongan': 'Tongaisch', 'fijian': 'Fidschi', 'bislama': 'Bislama', 'tok pisin': 'Tok Pisin', 'hiri motu': 'Hiri Motu', 'marshallese': 'Marshallesisch', 'palauan': 'Palauisch',
  'kiribati': 'Kiribatisch', 'gilbertese': 'Kiribatisch', 'tuvaluan': 'Tuvaluisch', 'nauruan': 'Nauruisch', 'maori': 'Maori', 'quechua': 'Quechua', 'aymara': 'Aymara', 'guarani': 'Guaraní', 'papiamento': 'Papiamentu',
  'sranan tongo': 'Sranantongo', 'malagasy': 'Malagasy', 'comorian': 'Komorisch', 'shikomoro': 'Komorisch', 'wolof': 'Wolof', 'fula': 'Fulfulde', 'fulani': 'Fulfulde', 'pular': 'Fulfulde', 'hausa': 'Hausa', 'yoruba': 'Yoruba', 'igbo': 'Igbo', 'ibo': 'Igbo',
  'lingala': 'Lingala', 'kikongo': 'Kikongo', 'tshiluba': 'Tshiluba', 'chichewa': 'Chichewa', 'chewa': 'Chichewa', 'bemba': 'Bemba', 'shona': 'Shona', 'ndebele': 'Ndebele', 'luganda': 'Luganda', 'kirghiz': 'Kirgisisch',
  'sign language': 'Gebärdensprache', 'new zealand sign language': 'Gebärdensprache', 'sami': 'Samisch', 'faroese': 'Färöisch', 'greenlandic': 'Grönländisch', 'romani': 'Romani', 'yiddish': 'Jiddisch', 'latin': 'Latein',
  'ndau': 'Ndau', 'sotho': 'Sesotho', 'tswana': 'Setswana', 'swati': 'Swati', 'zulu': 'Zulu', 'xhosa': 'Xhosa', 'tsonga': 'Tsonga', 'venda': 'Venda', 'kurmanji': 'Kurdisch', 'balochi': 'Belutschi', 'sindhi': 'Sindhi', 'saraiki': 'Saraiki',
  'standard chinese or mandarin': 'Hochchinesisch (Mandarin)', 'putonghua': 'Hochchinesisch', 'yue': 'Kantonesisch', 'wu': 'Wu-Chinesisch', 'min nan': 'Min Nan', 'minnan': 'Min Nan', 'hokkien': 'Hokkien', 'hakka': 'Hakka', 'teochew': 'Teochew',
  'bokmal norwegian': 'Norwegisch (Bokmål)', 'nynorsk norwegian': 'Norwegisch (Nynorsk)', 'serbo-croatian': 'Serbokroatisch', 'serbo-croat': 'Serbokroatisch', 'frisian': 'Friesisch', 'alsatian': 'Elsässisch',
  'monegasque': 'Monegassisch', 'panjabi': 'Panjabi', 'persian farsi': 'Persisch', 'baluchi': 'Belutschi', 'uzbeki': 'Usbekisch', 'turkmani': 'Turkmenisch', 'silesian': 'Schlesisch', 'tetun prasa': 'Tetum', 'tetun terik': 'Tetum',
  'mandinka': 'Mandinka', 'aramaic': 'Aramäisch', 'circassian': 'Tscherkessisch', 'french patois': 'Kreolisch', 'tonga': 'Tonga', 'luvale': 'Luvale', 'lomwe': 'Lomwe', 'ilocano': 'Ilokano', 'kapampangan': 'Kapampangan', 'vlach': 'Aromunisch',
  'malayalam': 'Malayalam', 'telugu': 'Telugu', 'marathi': 'Marathi', 'gujarati': 'Gujarati', 'kannada': 'Kannada', 'odia': 'Oriya', 'assamese': 'Assamesisch', 'sanskrit': 'Sanskrit', 'kashmiri': 'Kashmiri',
})
/** Text an , und ; teilen – aber nicht innerhalb von Klammern */
function teilen(s) {
  const out = []
  let tiefe = 0, cur = ''
  for (const ch of s) {
    if (ch === '(') tiefe++
    if (ch === ')') tiefe = Math.max(0, tiefe - 1)
    if ((ch === ',' || ch === ';') && !tiefe) { out.push(cur); cur = '' } else cur += ch
  }
  out.push(cur)
  return out
}
/** „English 78.2%, Spanish (official) 13.4%, …“ → [{name, offiziell, anteil}] */
function sprachen(t) {
  if (!t) return []
  const s = t.replace(/;?\s*note\b.*$/i, '').replace(/\(\d{4}[^)]*\)/g, '')
  const out = []
  for (const teil of teilen(s)) {
    const roh = teil.trim()
    const m = /^([A-Za-z' -]+?)(?:\s+\(([^)]*)\))?(?:\s+([\d.]+)%)?(?:\s+\(([^)]*)\))?$/.exec(roh)
    if (!m) continue
    const en = m[1].trim().toLowerCase().replace(/ languages?$/, '').replace(/^and /, '')
    if (!en || /other|unspecified|unknown|none|^or$|indigenous|local|dialects/.test(en)) continue
    const de = SPRACHE[en]
    if (!de) { fehlt('sprache', en); continue }
    const zus = `${m[2] ?? ''} ${m[4] ?? ''}`
    const offiziell = /official/.test(zus) && !/unofficial/.test(zus)
    if (out.some(x => x.name === de)) continue
    out.push({ name: de, offiziell, anteil: m[3] ? Number(m[3]) : null })
    if (out.length >= 8) break
  }
  return out
}

/* ───────────── Vorwahl, Domain, Städte, GeoGuessr ───────────── */

const ITEMS_WL = readJson(path.join(root, 'public/geo/items/welt-laender.json'))
const VORWAHL = {}, TLD = {}
for (const it of ITEMS_WL['welt-vorwahlen']) for (const a of it.areas ?? []) { const i = /^world:([A-Z]{3})$/.exec(a)?.[1]; if (i) VORWAHL[i] = it.label }
for (const it of ITEMS_WL['welt-domains']) for (const a of it.areas ?? []) { const i = /^world:([A-Z]{3})$/.exec(a)?.[1]; if (i && !TLD[i]) TLD[i] = it.label }
const STAEDTE = {}
for (const it of readJson(path.join(root, 'public/geo/items/welt-orte.json'))['welt-millionenstaedte']) {
  const land = it.details?.find(d => d.label === 'Land')?.value
  const iso = COUNTRIES.find(c => c.name === land)?.id
  if (!iso) continue
  const ew = it.details?.find(d => d.label === 'Einwohner')?.value?.replace(/ \(.*\)$/, '') ?? null
  const zahl = ew ? Number(ew.replace(' Mio.', '').replace(',', '.')) : 0
  ;(STAEDTE[iso] = STAEDTE[iso] ?? []).push({ name: it.label, einwohner: ew, z: zahl, punkt: it.point })
}
for (const l of Object.values(STAEDTE)) l.sort((a, b) => b.z - a.z)

const GG = {}
for (const [region, dir] of [['europa', 'gg'], ['suedamerika', 'gg-sa'], ['afrika', 'gg-af']]) {
  const p = path.join(root, 'public/geo', dir, 'index.json')
  if (!fs.existsSync(p)) continue
  for (const l of readJson(p).laender) if (l.iso3 && !GG[l.iso3]) GG[l.iso3] = { region, slug: l.slug, anzahl: l.anzahl }
}
const LINKS = new Set(['GBR', 'IRL', 'MLT', 'CYP', 'AUS', 'NZL', 'JPN', 'IND', 'BGD', 'BTN', 'LKA', 'PAK', 'NPL', 'MYS', 'SGP', 'IDN', 'THA', 'BRN', 'TLS', 'PNG', 'FJI', 'SLB', 'TON', 'WSM', 'KIR', 'TUV', 'NRU',
  'MDV', 'KEN', 'UGA', 'TZA', 'ZAF', 'BWA', 'LSO', 'SWZ', 'NAM', 'ZMB', 'ZWE', 'MOZ', 'MWI', 'MUS', 'SYC', 'GUY', 'SUR', 'JAM', 'BHS', 'BRB', 'TTO', 'ATG', 'DMA', 'GRD', 'KNA', 'LCA', 'VCT'])

/* ───────────── Lagekarte ───────────── */

/** SVG-Pfad (nur M, L, Z) vereinfachen: Punkte näher als 1,5 px am letzten Punkt fallen weg, winzige Ringe auch */
function vereinfachen(d) {
  const out = []
  for (const ring of d.split('M').filter(Boolean)) {
    const zu = ring.endsWith('Z')
    const pts = ring.replace(/Z$/, '').split('L').map(p => p.split(',').map(Number))
    const keep = [pts[0]]
    for (const p of pts.slice(1)) { const q = keep[keep.length - 1]; if (Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) >= 1.5) keep.push(p) }
    if (keep.length < 3) continue
    out.push(`M${keep.map(p => p.join(',')).join('L')}${zu ? 'Z' : ''}`)
  }
  return out.join('')
}

/** Kleine Lagekarte: Land bernsteinfarben, Umgebung grau, Ausschnitt mit Rand. Winzige Länder bekommen einen Kreis. */
function karte(iso) {
  const g = WORLD[iso]
  if (!g) return false
  const W = 480, H = 320
  const [[x0, y0], [x1, y1]] = geoBounds(g)
  const breit = x1 < x0 ? x1 + 360 - x0 : x1 - x0
  const gross = breit > 150 || y1 - y0 > 70 // Russland, USA (Alaska), Kiribati, Fidschi …
  const ctr = geoCentroid(g)
  const pad = Math.max(breit, y1 - y0, 4) * 0.6 + 2
  const mk = () => {
  if (gross) return geoNaturalEarth1().rotate([-ctr[0], 0]).fitExtent([[10, 10], [W - 10, H - 10]], g)
  else {
    const dx = Math.max(breit / 2 + pad, 6), dy = (y1 - y0) / 2 + pad
    const box = { type: 'MultiPoint', coordinates: [[ctr[0] - dx, Math.max(ctr[1] - dy, -80)], [ctr[0] + dx, Math.min(ctr[1] + dy, 82)]] }
    return geoMercator().rotate([-ctr[0], 0]).fitExtent([[0, 0], [W, H]], box)
  }
  }
  let proj = mk()
  const roh = geoPath(proj)
  const pathRoh = geoPath(mk().clipExtent([[-5, -5], [W + 5, H + 5]])).digits(0)
  /** Pfad ohne doppelte Punkte (nach dem Runden liegen viele Punkte aufeinander) */
  const pathOf = geo => { const d = pathRoh(geo); return d ? vereinfachen(d) : d }
  pathOf.bounds = geo => roh.bounds(geo)
  const teile = []
  for (const [id, geo] of Object.entries(WORLD)) {
    if (id === iso) continue
    const b = roh.bounds(geo)
    if (!isFinite(b[0][0]) || b[1][0] < -20 || b[0][0] > W + 20 || b[1][1] < -20 || b[0][1] > H + 20) continue
    if (b[1][0] - b[0][0] > W * 3) continue // über die Datumsgrenze gezogen
    const d = pathOf(geo)
    if (d) teile.push(`<path d="${d}"/>`)
  }
  const d = pathOf(g)
  const [[bx0, by0], [bx1, by1]] = pathOf.bounds(g)
  const klein = bx1 - bx0 < 14 && by1 - by0 < 14
  const [cx, cy] = proj(ctr)
  const kreis = klein ? `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="14" fill="none" stroke="#e9b35f" stroke-width="2.5"/>` : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#173d4f"/><g fill="#33515f" stroke="#5f7d8a" stroke-width=".6">${teile.join('')}</g><path d="${d}" fill="#e9b35f" stroke="#fff3d6" stroke-width=".8"/>${kreis}</svg>`
  fs.writeFileSync(path.join(OUT_KARTE, `${iso}.svg`), svg)
  return true
}

/** Das Land allein: Umriss, Hauptstadt (Stern) und Millionenstädte (Punkte mit Namen) */
function formKarte(iso, cap, kapName, staedte) {
  const g = WORLD[iso]
  // Winzige Länder (Vatikan, Monaco, San Marino …) sind auf der Weltkarte nur ein Klecks – keine eigene Umriss-Karte
  if (!g || geoArea(g) * 6371 ** 2 < 100) return false
  const W = 480, H = 320
  const [[x0, y0], [x1, y1]] = geoBounds(g)
  const breit = x1 < x0 ? x1 + 360 - x0 : x1 - x0
  const ctr = geoCentroid(g)
  const proj = breit > 25 || y1 - y0 > 20
    ? geoConicEqualArea().rotate([-ctr[0], 0]).parallels([y0 + (y1 - y0) / 6, y1 - (y1 - y0) / 6]).fitExtent([[24, 24], [W - 24, H - 24]], g)
    : geoMercator().rotate([-ctr[0], 0]).fitExtent([[24, 24], [W - 24, H - 24]], g)
  const d = vereinfachen(geoPath(proj).digits(0)(g) ?? '')
  const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const punkte = []
  const label = (x, y, text, gross) => `<text x="${(x > W - 110 ? x - 7 : x + 7).toFixed(0)}" y="${(y + 4).toFixed(0)}"${x > W - 110 ? ' text-anchor="end"' : ''} font-size="${gross ? 13 : 11}" font-weight="${gross ? 700 : 500}" paint-order="stroke" stroke="#173d4f" stroke-width="3" fill="#f4efe6">${esc(text)}</text>`
  const genutzt = []
  const frei = (x, y) => !genutzt.some(([a, b]) => Math.abs(a - x) < 60 && Math.abs(b - y) < 14)
  if (cap) {
    const [x, y] = proj(cap)
    if (isFinite(x)) { punkte.push(`<path d="M${x},${y - 6}l1.8,3.9 4.2,.5-3.1,2.9.8,4.2-3.7-2.1-3.7,2.1.8-4.2-3.1-2.9 4.2-.5z" fill="#fff3d6" stroke="#173d4f" stroke-width=".8"/>`, label(x, y, kapName, true)); genutzt.push([x, y]) }
  }
  for (const st of staedte.slice(0, 8)) {
    if (st.name === kapName || !st.punkt) continue
    const [x, y] = proj(st.punkt)
    if (!isFinite(x) || x < 0 || x > W || y < 0 || y > H) continue
    punkte.push(`<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="3" fill="#173d4f" stroke="#fff3d6" stroke-width="1.5"/>`)
    if (frei(x, y)) { punkte.push(label(x, y, st.name, false)); genutzt.push([x, y]) }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="system-ui, sans-serif"><rect width="${W}" height="${H}" fill="#173d4f"/><path d="${d}" fill="#e9b35f" fill-opacity=".9" stroke="#fff3d6" stroke-width="1"/>${punkte.join('')}</svg>`
  fs.writeFileSync(path.join(OUT_KARTE, `${iso}-form.svg`), svg)
  return true
}

/* ───────────── Provinzen aus Natural Earth (Ersatz, wenn es kein eigenes Regionen-Quiz gibt) ───────────── */

const TYP_DE = {
  Province: 'Provinzen', State: 'Bundesstaaten', Region: 'Regionen', District: 'Distrikte', County: 'Countys', Department: 'Departamentos',
  Municipality: 'Gemeinden', Prefecture: 'Präfekturen', Governorate: 'Gouvernements', Parish: 'Parishes', Emirate: 'Emirate', Canton: 'Kantone',
  Island: 'Inseln', 'Island council': 'Inselräte', Atoll: 'Atolle', Commune: 'Gemeinden', Division: 'Divisionen', Oblast: 'Oblaste',
  'Autonomous Region': 'Regionen', 'Administrative Region': 'Verwaltungsregionen', Territory: 'Territorien', Voivodeship: 'Woiwodschaften',
  Quarter: 'Quartiere', Zone: 'Zonen', Area: 'Gebiete', Capital: 'Regionen', 'Capital District': 'Regionen', Dependency: 'Regionen',
}
const NE_ISO = { SOL: 'SOM', CYN: 'CYP', SAH: 'MAR' }
const ADM1 = {}
{
  const roh = path.join(SRC, 'ne_10m_admin_1_states_provinces.geojson')
  const klein = path.join(SRC, 'tmp-laender-adm1.json')
  if (!fs.existsSync(klein) && fs.existsSync(roh)) {
    console.log('Natural Earth admin_1 vereinfachen (mapshaper) …')
    execSync(`mapshaper "${roh}" -filter-fields adm0_a3,name,name_de,type_en,iso_3166_2 -simplify 6% keep-shapes -o format=geojson precision=0.001 "${klein}"`, { stdio: 'inherit' })
  }
  if (fs.existsSync(klein)) {
    for (const f of readJson(klein).features) {
      const p = f.properties
      const iso = NE_ISO[p.adm0_a3] ?? p.adm0_a3
      if (!f.geometry) continue
      ;(ADM1[iso] = ADM1[iso] ?? []).push(f)
    }
  }
}
/** d3 erwartet Außenringe im Uhrzeigersinn – mapshaper schreibt sie andersherum (die Fläche wäre sonst „die Welt ohne die Provinz“) */
function richtigHerum(g) {
  const poly = rings => {
    const p = { type: 'Polygon', coordinates: rings }
    return geoArea(p) > 2 * Math.PI ? rings.map(r => [...r].reverse()) : rings
  }
  if (g.type === 'Polygon') return { type: 'Polygon', coordinates: poly(g.coordinates) }
  if (g.type === 'MultiPolygon') return { type: 'MultiPolygon', coordinates: g.coordinates.map(poly) }
  return g
}
/** Schreibt public/geo/land/adm1/<ISO3>.json im Ebenen-Format des Atlas ({id, titel, f: [{i, n, g}]}) – null, wenn es keine Gliederung gibt */
function adm1(iso) {
  const fs1 = ADM1[iso]
  if (!fs1 || fs1.length < 2) return null
  const typen = {}
  for (const f of fs1) typen[f.properties.type_en] = (typen[f.properties.type_en] ?? 0) + 1
  const typ = Object.entries(typen).sort((a, b) => b[1] - a[1])[0][0]
  const ids = new Set()
  const f = fs1.map((x, i) => {
    let id = slugify(x.properties.iso_3166_2 && x.properties.iso_3166_2 !== '-99' ? x.properties.iso_3166_2 : `${iso}-${i}`)
    while (ids.has(id)) id += '-x'
    ids.add(id)
    return { i: id, n: x.properties.name_de || x.properties.name, g: richtigHerum(x.geometry) }
  })
  const titel = TYP_DE[typ] ?? 'Regionen'
  fs.writeFileSync(path.join(OUT_ADM1, `${iso}.json`), JSON.stringify({ id: `land-adm1-${iso}`, titel, f }))
  return { titel, anzahl: f.length }
}

/* ───────────── Zusammenbauen ───────────── */

const INDEX = []
let mitFb = 0
for (const c of COUNTRIES) {
  const slug = slugify(c.name)
  const fb = factbook(c.id)
  const e = fb?.Economy ?? {}
  const geo = fb?.Geography ?? {}
  const gov = fb?.Government ?? {}
  if (fb) mitFb++

  const sektoren = {}
  const so = e['GDP - composition, by sector of origin'] ?? {}
  let sJahr = null
  for (const [k, de] of Object.entries(SEKTOR)) { const t = txt(so[k]); const v = prozent(t); if (v != null) { sektoren[de] = v; sJahr = sJahr ?? jahr(t) } }
  const verwendung = {}
  const eu = e['GDP - composition, by end use'] ?? {}
  let vJahr = null
  for (const [k, de] of Object.entries(VERWENDUNG)) { const t = txt(eu[k]); const v = prozent(t); if (v != null) { verwendung[de] = v; vJahr = vJahr ?? jahr(t) } }

  const neueste = (o, pre) => { if (!o) return null; const ks = Object.keys(o).filter(k => k.startsWith(pre)).sort().reverse(); const t = txt(o[ks[0]]); const v = prozent(t); return v == null ? null : { wert: v, jahr: jahr(t) } }

  const lb = geo['Land boundaries'] ?? {}
  const nachbarn = []
  for (const teil of txt(lb['border countries']).replace(/\(\d+\)/g, '').split(';')) {
    const m = /^\s*(.*?)\s+([\d,.]+)\s*km/.exec(teil)
    if (!m) continue
    const iso = isoOf(m[1])
    if (!iso) { fehlt('land', m[1]); continue }
    if (iso === c.id) continue
    const km = Number(m[2].replace(/,/g, ''))
    const da = nachbarn.find(n => n.iso === iso)
    if (da) da.km += km
    else nachbarn.push({ iso, name: deName(iso), km, karte: DE_IDS.has(iso) })
  }
  nachbarn.sort((a, b) => b.km - a.km)

  const zeit = /UTC\s*([+−-]\s*\d{1,2}(?::\d{2})?)?/.exec(txt(gov.Capital?.['time difference']))
  const cur = CC[c.id]?.['ISO4217-currency_alphabetic_code']?.split(',')[0]
  let waehrung = null
  if (cur) { try { waehrung = { code: cur, name: new Intl.DisplayNames(['de'], { type: 'currency' }).of(cur) } } catch { /* unbekannt */ } }
  if (c.id === 'KOS') waehrung = { code: 'EUR', name: 'Euro' }
  if (c.id === 'PSX') waehrung = { code: 'ILS', name: 'Israelischer Neuer Schekel' }

  const daten = {
    iso: c.id, slug, name: c.name, flag: iso2(c.id).toLowerCase() || null, kontinente: c.continents, hauptstadt: c.capital, cap: c.cap,
    aliases: c.aliases,
    staatsform: gov['Government type'] ? staatsform(txt(gov['Government type'])) : null,
    waehrung, vorwahl: VORWAHL[c.id] ?? null, domain: TLD[c.id] ?? null,
    fahrseite: LINKS.has(c.id) ? 'links' : 'rechts',
    zeitzone: zeit ? `UTC${(zeit[1] ?? '').replace(/\s/g, '').replace('-', '−')}` : null,
    sprachen: sprachen(txt(fb?.['People and Society']?.Languages?.Languages ?? fb?.['People and Society']?.Languages)),
    nachbarn,
    staedte: (STAEDTE[c.id] ?? []).slice(0, 8).map(({ name, einwohner }) => ({ name, einwohner })),
    wirtschaft: {
      sektoren: Object.keys(sektoren).length ? { werte: sektoren, jahr: sJahr } : null,
      verwendung: Object.keys(verwendung).length ? { werte: verwendung, jahr: vJahr } : null,
      wachstum: neueste(e['Real GDP growth rate'], 'Real GDP growth rate'),
      inflation: neueste(e['Inflation rate (consumer prices)'], 'Inflation rate'),
      schulden: neueste(e['Public debt'], 'Public debt'),
      exporte: waren(txt(e['Exports - commodities'])),
      exportJahr: jahr(txt(e['Exports - commodities'])),
      exportPartner: partner(txt(e['Exports - partners'])),
      importe: waren(txt(e['Imports - commodities'])),
      importPartner: partner(txt(e['Imports - partners'])),
      agrar: waren(txt(e['Agricultural products'])),
      rohstoffe: waren(txt(geo['Natural resources'])),
    },
    gg: GG[c.id] ?? null,
    factbook: FIPS[c.id] && fb && REGION_FB[FIPS[c.id]] ? `${REGION_FB[FIPS[c.id]]}/${FIPS[c.id]}` : null,
    karte: karte(c.id),
    form: formKarte(c.id, c.cap, c.capital, STAEDTE[c.id] ?? []),
    adm1: adm1(c.id),
  }
  fs.writeFileSync(path.join(OUT, `${c.id}.json`), JSON.stringify(daten))
  INDEX.push([slug, c.id, c.name, daten.flag, c.continents[0], c.aliases])
}

INDEX.sort((a, b) => a[2].localeCompare(b[2], 'de'))
const doppelt = INDEX.map(x => x[0]).filter((s, i, a) => a.indexOf(s) !== i)
if (doppelt.length) throw new Error(`doppelte slugs: ${doppelt}`)
fs.writeFileSync(path.join(root, 'app/geo/_data/land.ts'), `// Erzeugt von scripts/geo/build-laenderseiten.mjs – nicht von Hand bearbeiten.
// Alle Länder mit eigener Seite unter /geo/land/<slug>: [slug, ISO3, Name, Flagge (ISO2), Kontinent, andere Namen]

export type LandEintrag = [string, string, string, string | null, string, string[]]
export const LAENDER: LandEintrag[] = ${JSON.stringify(INDEX)}
`)

console.log(`${INDEX.length} Länder, ${mitFb} mit Factbook`)
for (const [art, m] of Object.entries(FEHLT)) {
  const l = [...m].sort((a, b) => b[1] - a[1])
  console.log(`\nnicht übersetzt (${art}): ${l.length}`)
  console.log(l.slice(0, 80).map(([w, n]) => `${w} (${n})`).join(' | '))
}
