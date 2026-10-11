// Baut den Bereich „Sprachen & Schriften“ von seekclan.de/geo (Phase 4).
//
// Nur für Entwicklung – wird NICHT beim normalen `npm run build` ausgeführt.
// Ergebnis liegt fertig im Repo:
//   public/geo/items/sprachen-orte.json   Städte in ihrer eigenen Schrift (Karten-Quizzes)
//   public/geo/items/schriften.json       Lernkarten: Buchstaben, Wörter, Schriften erkennen (+ "_meta" je Deck)
//   app/geo/_data/sprachen.ts             Anzahl Einträge und Gruppen je Quiz
//
// Benötigt:
//   GEO_SRC/cities500.json                 GeoNames (CC BY 4.0) – Lage und Einwohner
//   GEO_SRC/sprachen/wd-orte.json          Ortsnamen aus Wikidata (CC0), über die GeoNames-Kennung (P1566) abgefragt:
//     { "<geonames-id>": { cc, lang, it, l (Name in der Landessprache), de, en, k (Kana-Lesung), zhh, zhs, zh } }
//     Serbisch: Kyrillische Namen stehen in Wikidata unter "sr-ec" (sr ist oft lateinisch).
//     Abfrage je Land:  SELECT ?gn ?it ?l ?d ?e ?k WHERE { VALUES ?gn { "524901" … } ?it wdt:P1566 ?gn.
//                       OPTIONAL { ?it rdfs:label ?l FILTER(LANG(?l)="ru") } … OPTIONAL { ?it wdt:P1814 ?k } }
//   scripts/geo/sprachen-daten.mjs         Buchstaben-Tabellen, Tipps, Verwechsler, Zahlen (von Hand)
//   GEO_SRC/sprachen/wd-aussprache.json    Aussprache-Aufnahmen aus Wikidata (P443, Dateien auf Wikimedia Commons)
//   public/geo/audio/laute/*.mp3           Laut-Aufnahmen (IPA, Wikimedia Commons) – Zuordnung siehe SOUNDS unten
// Danach:  node scripts/geo/build-sprachen.mjs

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as S from './sprachen-daten.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const SRC = process.env.GEO_SRC || path.join(here, '.src')
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'))

const CYCLE = ['#14b8a6', '#f97316', '#6366f1', '#eab308', '#f43f5e', '#22c55e', '#a855f7', '#3b82f6', '#fb7185', '#84cc16', '#d97706', '#db2777', '#38bdf8', '#64748b', '#65a30d', '#facc15']

/* ───────────── Ländernamen (Deutsch) ───────────── */

const WL = readJson(path.join(root, 'public/geo/items/welt-laender.json'))
const LAND = Object.fromEntries(WL['welt-flaggen'].map(x => [x.flag.toUpperCase(), x.label]))
LAND.NU = 'Kanada (Nunavut)'
const landName = cc => LAND[cc] ?? cc

/* ───────────── Städte in eigener Schrift ───────────── */

const GN = Object.fromEntries(readJson(path.join(SRC, 'cities500.json')).map(c => [String(c.id), c]))
const WD = readJson(path.join(SRC, 'sprachen/wd-orte.json'))

const SCRIPT = {
  cyr: [/[Ѐ-ӿ]/, 'Kyrillisch'], el: [/[Ͱ-Ͽ]/, 'Griechisch'], ka: [/[Ⴀ-ჿ]/, 'Georgisch'], hy: [/[԰-֏]/, 'Armenisch'],
  he: [/[֐-׿]/, 'Hebräisch'], ar: [/[؀-ۿ]/, 'Arabisch'], th: [/[฀-๿]/, 'Thai'], lo: [/[຀-໿]/, 'Laotisch'],
  km: [/[ក-៿]/, 'Khmer'], ko: [/[가-힯]/, 'Hangul (Koreanisch)'], ja: [/[一-鿿぀-ヿ]/, 'Japanisch (Kanji)'],
  zht: [/[一-鿿]/, 'Chinesisch (traditionell)'], zhs: [/[一-鿿]/, 'Chinesisch (vereinfacht)'],
  hi: [/[ऀ-ॿ]/, 'Devanagari'], bn: [/[ঀ-৿]/, 'Bengalisch'], pa: [/[਀-੿]/, 'Gurmukhi (Punjabi)'], gu: [/[઀-૿]/, 'Gujarati'],
  or: [/[଀-୿]/, 'Odia'], ta: [/[஀-௿]/, 'Tamil'], te: [/[ఀ-౿]/, 'Telugu'], kn: [/[ಀ-೿]/, 'Kannada'], ml: [/[ഀ-ൿ]/, 'Malayalam'],
  iu: [/[᐀-ᙿ]/, 'Inuktitut-Silbenschrift'], vi: [/[a-zà-ỹđ]/i, 'Vietnamesisch (lateinisch)'],
}
const scriptOf = (lang, cc) => (['ru', 'uk', 'be', 'bg', 'sr', 'mk', 'kk', 'mn'].includes(lang) ? 'cyr'
  : ['ar', 'fa', 'ur'].includes(lang) ? 'ar' : lang === 'mr' ? 'hi' : lang === 'zh-tw' ? 'zht' : lang === 'zh-cn' ? 'zhs' : lang)
const LANG_NAME = { ru: 'Russisch', uk: 'Ukrainisch', be: 'Belarussisch', bg: 'Bulgarisch', sr: 'Serbisch', mk: 'Mazedonisch', kk: 'Kasachisch', mn: 'Mongolisch',
  el: 'Griechisch', ka: 'Georgisch', hy: 'Armenisch', he: 'Hebräisch', ar: 'Arabisch', fa: 'Persisch', ur: 'Urdu', th: 'Thai', lo: 'Laotisch', km: 'Khmer', vi: 'Vietnamesisch',
  ko: 'Koreanisch', ja: 'Japanisch', 'zh-tw': 'Chinesisch (Taiwan)', 'zh-cn': 'Chinesisch (China)', hi: 'Hindi', mr: 'Marathi', bn: 'Bengalisch', pa: 'Punjabi', gu: 'Gujarati',
  or: 'Odia', ta: 'Tamil', te: 'Telugu', kn: 'Kannada', ml: 'Malayalam', iu: 'Inuktitut' }

const ascii = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '')
function similar(a, b) {
  const x = ascii(a), y = ascii(b)
  if (!x || !y) return false
  if (x.slice(0, 4) === y.slice(0, 4) || x.includes(y) || y.includes(x)) return true
  const bi = s => new Set(Array.from({ length: s.length - 1 }, (_, i) => s.slice(i, i + 2)))
  const A = bi(x), B = bi(y)
  let n = 0
  for (const g of A) if (B.has(g)) n++
  return (2 * n) / (A.size + B.size) >= 0.4
}
/** Verwaltungs-Zusätze entfernen, die so nicht auf Schildern stehen */
function clean(name, lang) {
  let s = name.replace(/\s*\(.*?\)\s*/g, ' ').trim()
  if (lang === 'th') s = s.replace(/^(เทศบาลนคร|เทศบาลเมือง|เทศบาลตำบล|อำเภอ|จังหวัด)/, '')
  if (lang === 'te') s = s.replace(/\s*నగరం$/, '')
  if (lang === 'ko') s = s.replace(/(특별자치시|특별시|광역시)$/, '').replace(/^(.{2,})시$/, '$1')
  if (['ja', 'zh-tw', 'zh-cn'].includes(lang)) s = s.replace(/^(.{2,})[市區区]$/, '$1')
  return s.trim()
}

// Von Hand geprüft: anderer Name, aber dieselbe Stadt (Peking, Urmia, Orjol, Aqtau, Öskemen …)
const ACCEPT = new Set(['Orūmīyeh', 'Al Faḩāḩīl', 'Orël', 'Shevchenko', 'Volkovysk', 'Novopolotsk', 'Hubballi', 'Ust-Kamenogorsk', 'Danshui', 'Beijing', 'Paoy Paet', 'Undurkhaan'])

const towns = []
const dropped = []
for (const [gn, o] of Object.entries(WD)) {
  const c = GN[gn]
  if (!c) continue
  const raw = o.cc === 'TW' ? (o.zhh ?? o.l ?? o.zh) : o.cc === 'CN' ? (o.zhs ?? o.l ?? o.zh) : o.l
  const script = scriptOf(o.lang, o.cc)
  if (!raw || !SCRIPT[script][0].test(raw)) { dropped.push(`${o.cc} ${c.name}: Name fehlt oder falsche Schrift (${raw ?? '–'})`); continue }
  const name = clean(raw, o.lang)
  // GeoNames ↔ Wikidata passt? (Deutsch/Englisch muss dem GeoNames-Namen ähneln)
  // (ohne deutschen und englischen Namen lässt sich nichts prüfen – dann gilt die GeoNames-Kennung)
  if ((o.en || o.de) && !ACCEPT.has(c.name) && !similar(c.name, o.en) && !similar(c.name, o.de)) { dropped.push(`${o.cc} ${c.name}: passt nicht zu ${o.de ?? o.en} (${raw})`); continue }
  towns.push({
    gn, cc: o.cc, lang: o.lang, script, name, de: o.de ?? o.en ?? c.name, en: o.en, gnName: c.name,
    kana: o.k ? o.k.replace(/し$/, '') : undefined, pop: +c.pop, pt: [+(+c.lon).toFixed(4), +(+c.lat).toFixed(4)],
  })
}
// Doppelte (gleicher Name im gleichen Land, z.B. Stadt und Stadtteil) – den größeren behalten
const seen = new Map()
for (const t of towns.sort((a, b) => b.pop - a.pop)) { const k = `${t.cc}|${t.name}`; if (!seen.has(k)) seen.set(k, t) }
const TOWNS = [...seen.values()]
console.log(`Städte: ${TOWNS.length} (verworfen ${dropped.length})`)
fs.writeFileSync(path.join(SRC, 'sprachen/verworfen.txt'), dropped.join('\n'))

const fmtPop = n => (n >= 1e6 ? `${(n / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio.` : Math.round(n).toLocaleString('de-DE'))
function townItem(t, group) {
  const details = [
    { label: 'Deutsch', value: t.de, big: true },
    { label: 'Land', value: landName(t.cc) },
    { label: 'Sprache', value: LANG_NAME[t.lang] ?? t.lang },
    ...(t.kana ? [{ label: 'Lesung', value: t.kana }] : []),
    { label: 'Einwohner', value: `ca. ${fmtPop(t.pop)} (GeoNames)` },
  ]
  return {
    key: `sp:${t.gn}`, label: t.name, prompt: t.name, group, point: t.pt, say: sayOf(t),
    aliases: [...new Set([t.de, t.en, t.gnName].filter(Boolean))],
    details, text: { prompt: t.name, sub: 'Welche Stadt ist das?', answer: t.de, big: true },
  }
}

/* ───────────── Aussprache (Ton) ───────────── */

/** Sprache für die Sprachausgabe des Geräts (BCP 47) */
const BCP47 = { ru: 'ru-RU', uk: 'uk-UA', be: 'be-BY', bg: 'bg-BG', sr: 'sr-RS', mk: 'mk-MK', kk: 'kk-KZ', mn: 'mn-MN', el: 'el-GR', ka: 'ka-GE', hy: 'hy-AM',
  he: 'he-IL', ar: 'ar-SA', fa: 'fa-IR', ur: 'ur-PK', th: 'th-TH', lo: 'lo-LA', km: 'km-KH', vi: 'vi-VN', ko: 'ko-KR', ja: 'ja-JP', 'zh-tw': 'zh-TW', 'zh-cn': 'zh-CN',
  hi: 'hi-IN', mr: 'mr-IN', bn: 'bn-IN', pa: 'pa-IN', gu: 'gu-IN', or: 'or-IN', ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', ml: 'ml-IN', iu: 'iu-CA' }
// Echte Aufnahmen aus Wikidata (P443): nur, wenn sie in der Landessprache gesprochen sind (Dateiname oder Sprachangabe)
const AUDIO = readJson(path.join(SRC, 'sprachen/wd-aussprache.json'))
const ISO3 = { rus: 'ru', ukr: 'uk', bel: 'be', bul: 'bg', srp: 'sr', mkd: 'mk', kaz: 'kk', mon: 'mn', ell: 'el', kat: 'ka', hye: 'hy', heb: 'he', ara: 'ar', fas: 'fa', pes: 'fa', urd: 'ur',
  tha: 'th', lao: 'lo', khm: 'km', vie: 'vi', kor: 'ko', jpn: 'ja', cmn: 'zh', yue: 'zh', hin: 'hi', mar: 'mr', ben: 'bn', pan: 'pa', guj: 'gu', ori: 'or', tam: 'ta', tel: 'te', kan: 'kn', mal: 'ml' }
const base = l => (l ? (l.startsWith('zh') ? 'zh' : ['hi', 'mr'].includes(l) ? 'hi' : l.slice(0, 2)) : null)
function recordingFor(qid, lang, native) {
  for (const [file, ql] of AUDIO[qid] ?? []) {
    const ll = /^LL-Q\d+ \(([a-z]{3})\)/.exec(file)?.[1]
    const pre = /^([A-Z][a-z])-/.exec(file)?.[1]?.toLowerCase()
    const fl = ll ? ISO3[ll] : pre ?? ql
    if (fl ? base(fl) === base(lang) : file.includes(native)) return file
  }
  return undefined
}
const QID = Object.fromEntries(Object.entries(WD).map(([gn, o]) => [gn, o.it]))
/** Adresse einer Commons-Datei; Ogg/Opus zusätzlich als MP3 (Commons wandelt um) – Safari spielt kein Ogg */
function commonsUrls(file) {
  const n = file.replace(/ /g, '_')
  const h = crypto.createHash('md5').update(n).digest('hex')
  const orig = `https://upload.wikimedia.org/wikipedia/commons/${h[0]}/${h.slice(0, 2)}/${encodeURIComponent(n)}`
  return /\.(ogg|oga|opus)$/i.test(n) ? [`https://upload.wikimedia.org/wikipedia/commons/transcoded/${h[0]}/${h.slice(0, 2)}/${encodeURIComponent(n)}/${encodeURIComponent(n)}.mp3`, orig] : [orig]
}
const sayOf = t => {
  const rec = recordingFor(QID[t.gn], t.lang, t.name)
  return { t: t.name, l: BCP47[t.lang] ?? t.lang, ...(rec ? { a: commonsUrls(rec), src: rec } : {}) }
}
console.log(`Aufnahmen in Landessprache: ${TOWNS.filter(t => sayOf(t).a).length} von ${TOWNS.length}`)

/* ───────────── Karten-Quizzes: Städte lesen ───────────── */

// slug → Länder (Gruppen) – die Gruppen bekommen den Ländernamen
const MAP_QUIZZES = {
  'kyrillisch-osteuropa': ['RU', 'UA', 'BY'],
  'kyrillisch-balkan': ['BG', 'RS', 'MK'],
  'kyrillisch-zentralasien': ['KZ', 'MN'],
  'griechisch-orte': ['GR', 'CY'],
  'georgisch-orte': ['GE'],
  'armenisch-orte': ['AM'],
  'hebraeisch-orte': ['IL'],
  'arabisch-orte': ['MA', 'DZ', 'TN', 'LY', 'EG', 'LB', 'SY', 'JO', 'IQ', 'SA', 'KW', 'QA', 'AE', 'OM', 'YE', 'IR', 'PK'],
  'thai-lao-khmer-orte': ['TH', 'LA', 'KH'],
  'vietnam-orte': ['VN'],
  'korea-orte': ['KR'],
  'japan-orte': ['JP'],
  'chinesisch-orte': ['TW', 'CN'],
  'indien-schriften-orte': ['IN'],
  'inuktitut-orte': ['NU'],
}
// Arabische Schrift: nach Sprache gruppieren statt nach 17 Ländern
const AR_GROUP = { IR: 'fa', PK: 'ur' }
const AR_GROUPS = { maghreb: 'Maghreb (Arabisch)', nahost: 'Ägypten & Levante (Arabisch)', golf: 'Arabische Halbinsel & Irak (Arabisch)', fa: 'Iran (Persisch)', ur: 'Pakistan (Urdu)' }
const arGroup = cc => AR_GROUP[cc] ?? (['MA', 'DZ', 'TN', 'LY'].includes(cc) ? 'maghreb' : ['EG', 'LB', 'SY', 'JO'].includes(cc) ? 'nahost' : 'golf')

const ORTE = {}
const GROUPS = {}
for (const [slug, ccs] of Object.entries(MAP_QUIZZES)) {
  const list = TOWNS.filter(t => ccs.includes(t.cc))
  let groupOf, names
  if (slug === 'arabisch-orte') { groupOf = t => arGroup(t.cc); names = AR_GROUPS }
  else if (slug === 'indien-schriften-orte') { groupOf = t => t.script; names = Object.fromEntries([...new Set(list.map(t => t.script))].map(s => [s, SCRIPT[s][1]])) }
  else { groupOf = t => t.cc.toLowerCase(); names = Object.fromEntries(ccs.map(cc => [cc.toLowerCase(), landName(cc)])) }
  ORTE[slug] = list.map(t => townItem(t, groupOf(t))).sort((a, b) => a.label.localeCompare(b.label))
  const used = [...new Set(ORTE[slug].map(i => i.group))]
  GROUPS[slug] = Object.fromEntries(Object.keys(names).filter(k => used.includes(k)).map((k, i) => [k, { name: names[k], color: CYCLE[i % CYCLE.length] }]))
  console.log(`  ${slug}: ${ORTE[slug].length}`)
}

/* ───────────── Lernkarten ───────────── */

const DECKS = {}
const META = {}

/* ── Laute: Umschrift → Aufnahmen in public/geo/audio/laute (IPA-Tondateien von Wikimedia Commons) ── */

const L = {
  a: 'open-front-unrounded-vowel', e: 'close-mid-front-unrounded-vowel', E: 'open-mid-front-unrounded-vowel', i: 'close-front-unrounded-vowel',
  o: 'close-mid-back-rounded-vowel', O: 'open-mid-back-rounded-vowel', u: 'close-back-rounded-vowel', y: 'close-central-unrounded-vowel', schwa: 'mid-central-vowel',
  eu: 'close-back-unrounded-vowel', eo: 'open-mid-back-unrounded-vowel', ae: 'near-open-front-unrounded-vowel', oe: 'close-mid-front-rounded-vowel', ue: 'close-front-rounded-vowel',
  b: 'voiced-bilabial-plosive', p: 'voiceless-bilabial-plosive', d: 'voiced-alveolar-plosive', t: 'voiceless-alveolar-plosive', g: 'voiced-velar-plosive', k: 'voiceless-velar-plosive',
  q: 'voiceless-uvular-plosive', v: 'voiced-labiodental-fricative', f: 'voiceless-labiodental-fricative', z: 'voiced-alveolar-sibilant', s: 'voiceless-alveolar-sibilant',
  zh: 'voiced-postalveolar-fricative', sh: 'voiceless-postalveolar-fricative', x: 'voiceless-velar-fricative', gh: 'voiced-velar-fricative', R: 'voiced-uvular-fricative',
  X: 'voiceless-uvular-fricative', h: 'voiceless-glottal-fricative', H: 'voiceless-pharyngeal-fricative', ain: 'voiced-pharyngeal-fricative', stop: 'glottal-stop',
  th: 'voiceless-dental-fricative', dh: 'voiced-dental-fricative', ts: 'voiceless-alveolar-affricate', dz: 'voiced-alveolar-affricate',
  ch: 'voiceless-palato-alveolar-affricate', dj: 'voiced-palato-alveolar-affricate', m: 'bilabial-nasal', n: 'alveolar-nasal', ng: 'velar-nasal',
  l: 'alveolar-lateral-approximant', r: 'alveolar-trill', tap: 'alveolar-tap', j: 'palatal-approximant', w: 'voiced-labio-velar-approximant',
  "k'": 'velar-ejective-plosive', "p'": 'bilabial-ejective-plosive', "t'": 'alveolar-ejective-plosive', "q'": 'uvular-ejective-stop',
  "ts'": 'alveolar-ejective-affricate', "ch'": 'palato-alveolar-ejective-affricate', shch: 'voiceless-alveolo-palatal-fricative', c: 'voiceless-palatal-fricative',
}
// Umschrift-Bausteine je Schreibweise (längste zuerst) → Laute
const DE = { schtsch: ['shch'], "tsch'": ["ch'"], tsch: ['ch'], dsch: ['dj'], sch: ['sh'], "ts'": ["ts'"], "k'": ["k'"], "p'": ["p'"], "t'": ["t'"], "q'": ["q'"],
  ch: ['x'], gh: ['gh'], kh: ['k'], ph: ['f'], th: ['th'], dh: ['dh'], dz: ['dz'], ng: ['ng'], ps: ['p', 's'], ks: ['k', 's'], ts: ['ts'], rr: ['r'],
  eu: ['eu'], eo: ['eo'], ae: ['ae'], oe: ['oe'], kk: ['k'], tt: ['t'], pp: ['p'], ss: ['s'], jj: ['dj'], wa: ['w', 'a'], wo: ['w', 'eo'], wi: ['w', 'i'], ui: ['eu', 'i'],
  ë: ['schwa'], ä: ['ae'], ö: ['oe'], ü: ['ue'], ḥ: ['H'],
  a: ['a'], b: ['b'], d: ['d'], e: ['e'], f: ['f'], g: ['g'], h: ['h'], i: ['i'], j: ['j'], k: ['k'], l: ['l'], m: ['m'], n: ['n'], o: ['o'], p: ['p'], q: ['q'], r: ['r'],
  s: ['s'], t: ['t'], u: ['u'], v: ['v'], w: ['v'], x: ['k', 's'], y: ['y'], z: ['ts'] }
const VARIANT = {
  // Thai: kh/ph/th sind behauchte k/p/t, Armenisch: Apostroph = behaucht (kein Knacklaut)
  th: { kh: ['k'], ph: ['p'], th: ['t'] },
  hy: { "t'": ['t'], "p'": ['p'], "k'": ['k'], "ts'": ['ts'], "tsch'": ['ch'] },
  // Koreanisch: r = getipptes r
  ko: { r: ['tap'] },
  // Japanisch (Hepburn): shi, chi, tsu, fu, y = j, r = getippt
  ja: { sh: ['sh'], ch: ['ch'], y: ['j'], r: ['tap'], w: ['w'], f: ['f'] },
  // Inuktitut: r = Zäpfchen-r, g = weiches Rachen-g
  iu: { r: ['R'], g: ['gh'], j: ['j'], w: ['w'] },
}
function soundsOf(answer, system) {
  const table = { ...DE, ...(VARIANT[system] ?? {}) }
  const keys = Object.keys(table).sort((a, b) => b.length - a.length)
  const s0 = String(answer).toLowerCase()
  if (/^\(|^\d|^[A-ZÄÖÜ]/.test(answer) && !/^[A-Z]$/.test(answer)) return undefined // (stumm), Zahlen, Namen
  const out = []
  for (let i = 0; i < s0.length;) {
    const k = keys.find(k => s0.startsWith(k, i))
    if (!k) { i++; continue }
    out.push(...table[k].map(x => L[x]))
    i += k.length
  }
  return out.length ? out : undefined
}
// Einzelne Zeichen, deren Laut von der Umschrift abweicht
const SND_OVERRIDE = {
  griechisch: { 'Γ γ': ['gh'], 'Δ δ': ['dh'], 'Θ θ': ['th'], 'Ζ ζ': ['z'], 'Σ σ ς': ['s'], 'Χ χ': ['x'] },
  kyrillisch: { 'З': ['z'], 'Ж': ['zh'], 'Ц': ['ts'], 'Ъ': [], 'Ь': [] },
  georgisch: { 'ზ': ['z'], 'ჟ': ['zh'], 'ც': ['ts'], 'ღ': ['gh'] },
  armenisch: { 'Զ զ': ['z'], 'Ժ ժ': ['zh'], 'Ծ ծ': ['ts'], 'Ց ց': ['ts'], 'Ղ ղ': ['gh'], 'Ը ը': ['schwa'] },
  hebraeisch: { 'א': ['stop'], 'ע': ['stop'], 'ז': ['z'], 'צ': ['ts'], 'ץ': ['ts'], 'ח': ['x'] },
  arabisch: { 'ح': ['H'], 'ع': ['ain'], 'ز': ['z'], 'ظ': ['z'], 'ذ': ['dh'], 'ث': ['th'], 'ژ': ['zh'] },
  thai: { 'อ': ['stop'] },
  hieroglyphen: { '𓄿': ['stop'], '𓂝': ['ain'], '𓎛': ['H'], '𓄡': ['c'], '𓊃': ['z'] },
  hangul: { 'ㅇ': ['ng'] },
}
const SYSTEM = { thai: 'th', armenisch: 'hy', hangul: 'ko', hiragana: 'ja', katakana: 'ja', inuktitut: 'iu' }
const word = t => ({ w: t.name, de: t.de, alt: [t.en, t.gnName].filter(Boolean), cc: t.cc, flag: t.cc === 'NU' ? 'ca' : t.cc.toLowerCase(), say: sayOf(t) })
/** Wörter (Ortsnamen) für den Ortsschild-Modus: die größten Städte, höchstens n pro Land */
function words(ccs, n = 12) {
  return ccs.flatMap(cc => TOWNS.filter(t => t.cc === cc).sort((a, b) => b.pop - a.pop).slice(0, n)).map(word)
}

/** Laute einer Karte (ohne Laut-Decks wie „Welche Sprache?“) */
function cardSounds(slug, c, a, g) {
  if (meta0(slug).noSound || g === 'zahl') return undefined
  const o = SND_OVERRIDE[slug]?.[c]
  if (o) return o.length ? o.map(x => L[x]) : undefined
  return soundsOf(a, SYSTEM[slug])
}
const meta0 = slug => ({ noSound: ['kyrillisch-laender', 'lateinische-sonderzeichen'].includes(slug) })
// Lernpfad: welche Quizzes nach den Buchstaben kommen
const PATH = {
  kyrillisch: ['kyrillisch-osteuropa', 'kyrillisch-laender', 'kyrillisch-welches-land'], griechisch: ['griechisch-orte'], georgisch: ['georgisch-orte'], armenisch: ['armenisch-orte'],
  hebraeisch: ['hebraeisch-orte'], arabisch: ['arabisch-orte'], thai: ['thai-lao-khmer-orte', 'suedostasien-welches-land'], hangul: ['korea-orte', 'ostasien-welches-land'],
  hiragana: ['katakana', 'japan-orte'], katakana: ['japan-orte', 'ostasien-welches-land'], inuktitut: ['inuktitut-orte'],
}

function letterDeck(slug, data, meta) {
  DECKS[slug] = data.letters.map(([c, a, n, g, alt], i) => ({ key: `${slug}:${i + 1}`, c, a, n: n || undefined, g, alt: alt?.length ? alt : undefined, snd: cardSounds(slug, c, a, g) }))
  const first = c => c.split(' ')[0]
  const confuse = (S.VERWECHSLER[slug] ?? []).map(set => set.map(ch => DECKS[slug].find(card => first(card.c) === first(ch))?.key).filter(Boolean)).filter(set => set.length >= 2)
  META[slug] = { kind: 'letters', groups: data.groups.map(([k, name, text]) => ({ k, name, text: text || undefined })), tips: data.tips, ...(confuse.length ? { confuse } : {}), ...(PATH[slug] ? { path: PATH[slug] } : {}), ...meta }
  const noSnd = DECKS[slug].filter(c => !c.snd && c.g !== 'zahl').length
  if (!meta0(slug).noSound && noSnd) console.log(`    ohne Laut: ${DECKS[slug].filter(c => !c.snd && c.g !== 'zahl').map(c => `${c.c}=${c.a}`).join(' ')}`)
  console.log(`  ${slug}: ${DECKS[slug].length} Zeichen${meta.words ? `, ${meta.words.length} Ortsnamen` : ''}`)
}

letterDeck('kyrillisch', S.KYRILLISCH, { lang: 'ru-RU', ask: 'Wie klingt der Buchstabe?', askBack: 'Welcher Buchstabe ist das?', words: words(['RU'], 30) })
letterDeck('kyrillisch-laender', S.KYRILLISCH_LAENDER, { ask: 'In welcher Sprache gibt es diesen Buchstaben?', askBack: 'Welcher Buchstabe gehört zu dieser Sprache?', noWrite: true })
letterDeck('griechisch', S.GRIECHISCH, { lang: 'el-GR', ask: 'Wie klingt der Buchstabe?', askBack: 'Welcher Buchstabe ist das?', words: words(['GR', 'CY'], 25) })
letterDeck('georgisch', S.GEORGISCH, { lang: 'ka-GE', ask: 'Wie klingt der Buchstabe?', askBack: 'Welcher Buchstabe ist das?', words: words(['GE'], 20) })
letterDeck('armenisch', S.ARMENISCH, { lang: 'hy-AM', ask: 'Wie klingt der Buchstabe?', askBack: 'Welcher Buchstabe ist das?', words: words(['AM'], 20) })
letterDeck('hebraeisch', S.HEBRAEISCH, { lang: 'he-IL', dir: 'rtl', ask: 'Wie klingt der Buchstabe?', askBack: 'Welcher Buchstabe ist das?', words: words(['IL'], 25) })
letterDeck('arabisch', S.ARABISCH, { lang: 'ar', dir: 'rtl', ask: 'Wie klingt der Buchstabe?', askBack: 'Welcher Buchstabe ist das?', words: words(['EG', 'MA', 'SA', 'IQ', 'SY', 'JO', 'LB', 'AE'], 4) })
letterDeck('thai', S.THAI, { lang: 'th-TH', ask: 'Wie klingt der Buchstabe?', askBack: 'Welcher Buchstabe ist das?', words: words(['TH'], 25) })
letterDeck('hangul', S.HANGUL, { lang: 'ko-KR', ask: 'Wie klingt das Zeichen?', askBack: 'Welches Zeichen ist das?', words: words(['KR'], 25) })
letterDeck('hiragana', S.HIRAGANA, { lang: 'ja-JP', ask: 'Wie liest man das?', askBack: 'Welches Hiragana ist das?' })
letterDeck('katakana', S.KATAKANA, { lang: 'ja-JP', ask: 'Wie liest man das?', askBack: 'Welches Katakana ist das?' })
letterDeck('inuktitut', S.INUKTITUT, { lang: 'iu', font: 'Noto Sans Canadian Aboriginal', ask: 'Wie klingt die Silbe?', askBack: 'Welches Zeichen ist das?', words: words(['NU'], 14) })
letterDeck('hieroglyphen', S.HIEROGLYPHEN, { font: 'Noto Sans Egyptian Hieroglyphs', ask: 'Welcher Laut ist das?', askBack: 'Welches Zeichen ist das?', big: true })
letterDeck('lateinische-sonderzeichen', S.LATEIN, { ask: 'Welche Sprache verrät dieses Zeichen?', askBack: 'Welches Zeichen gehört zu dieser Sprache?', noWrite: true })

// Chinesisch: traditionell oder vereinfacht?
DECKS['chinesisch-zeichen'] = S.CHINESISCH_PAARE.flatMap(([t, s, de], i) => [
  { key: `chinesisch-zeichen:t${i + 1}`, c: t, a: 'Traditionell (Taiwan, Hongkong)', n: `${de} – vereinfacht: ${s}`, g: 'trad' },
  { key: `chinesisch-zeichen:s${i + 1}`, c: s, a: 'Vereinfacht (China)', n: `${de} – traditionell: ${t}`, g: 'simp' },
])
META['chinesisch-zeichen'] = {
  kind: 'words', ask: 'Traditionell oder vereinfacht?', noWrite: true,
  groups: [{ k: 'trad', name: 'Traditionell', text: 'Viele Striche – Taiwan, Hongkong, Macau.' }, { k: 'simp', name: 'Vereinfacht', text: 'Weniger Striche – Volksrepublik China, Singapur.' }],
  tips: ['Faustregel: Wenn ein Zeichen „überladen“ aussieht (門, 車, 東), ist es traditionell.', 'Taiwan schreibt sich 臺灣 oder 台灣 – das 灣 ist traditionell, in China steht 台湾.', 'Taiwan fährt rechts, Hongkong links – beide schreiben traditionell.'],
  words: [...words(['TW'], 14), ...words(['CN'], 14)],
}
console.log(`  chinesisch-zeichen: ${DECKS['chinesisch-zeichen'].length}`)

/* ── Zahlen ── */

DECKS.zahlen = S.ZAHLEN.flatMap(([k, , digits]) => [...digits].map((d, i) => ({ key: `zahlen:${k}${i}`, c: d, a: String(i), g: k })))
META.zahlen = {
  kind: 'letters', ask: 'Welche Zahl ist das?', askBack: 'Welches Zeichen ist diese Zahl?',
  groups: S.ZAHLEN.map(([k, name]) => ({ k, name })),
  tips: ['Arabisch und Persisch unterscheiden sich bei 4, 5 und 6: ٤٥٦ (Arabisch) und ۴۵۶ (Persisch, Urdu).', 'Die arabische 5 (٥) sieht aus wie unsere 0 – und die arabische 0 (٠) ist nur ein Punkt.', 'Auf Kennzeichen in Ägypten, am Golf und in Thailand stehen oft beide Zahlen-Schriften.'],
  confuse: [['zahlen:arabisch4', 'zahlen:persisch4'], ['zahlen:arabisch5', 'zahlen:persisch5', 'zahlen:arabisch0'], ['zahlen:arabisch6', 'zahlen:persisch6'], ['zahlen:thai2', 'zahlen:thai3', 'zahlen:lao2', 'zahlen:lao3']],
}
console.log(`  zahlen: ${DECKS.zahlen.length}`)

/* ── Wort-Decks: Ortsname → Land bzw. Schrift ── */

function wordDeck(slug, list, answerOf, meta, groupOf) {
  DECKS[slug] = list.map((t, i) => ({ key: `${slug}:${t.gn}`, c: t.name, a: answerOf(t), n: t.de, g: groupOf(t), flag: t.cc === 'NU' ? 'ca' : t.cc.toLowerCase(), say: sayOf(t) }))
  META[slug] = { kind: 'words', noWrite: true, ...meta }
  console.log(`  ${slug}: ${DECKS[slug].length}`)
}
const top = (ccs, n) => ccs.flatMap(cc => TOWNS.filter(t => t.cc === cc).sort((a, b) => b.pop - a.pop).slice(0, n))

wordDeck('kyrillisch-welches-land', top(['RU', 'UA', 'BY', 'BG', 'RS', 'MK', 'KZ', 'MN'], 18), t => landName(t.cc), {
  ask: 'Aus welchem Land ist dieser Ortsname?', withFlags: true,
  groups: ['RU', 'UA', 'BY', 'BG', 'RS', 'MK', 'KZ', 'MN'].map(cc => ({ k: cc.toLowerCase(), name: landName(cc) })),
  tips: S.KYRILLISCH_LAENDER.tips,
}, t => t.cc.toLowerCase())

wordDeck('suedostasien-welches-land', top(['TH', 'LA', 'KH'], 25), t => landName(t.cc), {
  ask: 'Thai, Laotisch oder Khmer?', withFlags: true,
  groups: [{ k: 'th', name: 'Thailand', text: 'Kleine Kreise an den Buchstaben, oft eckig-schlank.' }, { k: 'la', name: 'Laos', text: 'Runder und schlichter als Thai, weniger Kreise.' }, { k: 'kh', name: 'Kambodscha', text: 'Breite Zeichen mit „Hüten“ oben und Zeichen, die unter der Zeile hängen.' }],
  tips: ['Thai: viele kleine Kreise, Schrift wirkt wie „Häkchen mit Köpfchen“.', 'Laotisch: wie ein runderes, einfacheres Thai.', 'Khmer: sehr breit und verschnörkelt, mit Zeichen unterhalb der Zeile.'],
}, t => t.cc.toLowerCase())

wordDeck('ostasien-welches-land', top(['KR', 'JP', 'TW', 'CN'], 18), t => landName(t.cc), {
  ask: 'Aus welchem Land ist dieser Ortsname?', withFlags: true,
  groups: [{ k: 'kr', name: 'Südkorea', text: 'Hangul: Kreise und Blöcke.' }, { k: 'jp', name: 'Japan', text: 'Kanji, oft mit Kana gemischt.' }, { k: 'tw', name: 'Taiwan', text: 'Traditionelle Zeichen.' }, { k: 'cn', name: 'China', text: 'Vereinfachte Zeichen.' }],
  tips: ['Ein Kreis (ㅇ) im Wort = Koreanisch.', 'Japan und China/Taiwan teilen sich viele Zeichen – Japan hat oft kurze Namen mit 2 Zeichen.'],
}, t => t.cc.toLowerCase())

wordDeck('indien-welche-schrift', TOWNS.filter(t => t.cc === 'IN'), t => SCRIPT[t.script][1], {
  ask: 'In welcher Schrift ist der Ortsname geschrieben?',
  groups: [...new Set(TOWNS.filter(t => t.cc === 'IN').map(t => t.script))].map(s => ({ k: s, name: SCRIPT[s][1] })),
  tips: ['Devanagari (Hindi, Marathi): durchgehender Strich oben an jedem Wort.', 'Bengalisch: auch ein Strich oben, aber spitzere Dreiecke.', 'Gurmukhi (Punjab): Strich oben, eckige Zeichen – Punjab-Schilder zeigen oft drei Schriften.', 'Tamil: kein Strich oben, eckige Schleifen. Telugu und Kannada: runde Bögen mit „Häkchen“ oben – Kannada wirkt etwas eckiger. Malayalam: sehr rund, wie Kringel.'],
}, t => t.script)

// Welche Schrift? – aus jedem Land mit eigener Schrift die größten Städte
const ALLE = ['RU', 'GR', 'GE', 'AM', 'IL', 'EG', 'SA', 'IR', 'TH', 'LA', 'KH', 'KR', 'JP', 'TW', 'CN', 'NU']
const ALLE_IN = TOWNS.filter(t => t.cc === 'IN').sort((a, b) => b.pop - a.pop)
const inBy = new Map()
for (const t of ALLE_IN) if ((inBy.get(t.script) ?? []).length < 4) inBy.set(t.script, [...(inBy.get(t.script) ?? []), t])
const schriftAnswer = t => (t.cc === 'IR' ? 'Persisch (arabische Schrift)' : SCRIPT[t.script][1])
wordDeck('welche-schrift', [...top(ALLE, 6), ...[...inBy.values()].flat()], schriftAnswer, {
  ask: 'Welche Schrift ist das?',
  groups: [
    { k: 'europa', name: 'Europa & Kaukasus', text: 'Kyrillisch, Griechisch, Georgisch, Armenisch' },
    { k: 'nahost', name: 'Nahost', text: 'Hebräisch, Arabisch, Persisch' },
    { k: 'asien', name: 'Süd- und Ostasien', text: 'Thai, Laotisch, Khmer, Hangul, Kanji, Chinesisch, indische Schriften' },
    { k: 'arktis', name: 'Arktis', text: 'Inuktitut' },
  ],
  tips: ['Fang mit den „Formen“ an: rund (Georgisch, Malayalam), eckig (Hebräisch, Hangul), mit Strich oben (Devanagari, Bengalisch), mit Kreisen (Thai, Hangul).'],
}, t => (['RU', 'GR', 'GE', 'AM'].includes(t.cc) ? 'europa' : ['IL', 'EG', 'SA', 'IR'].includes(t.cc) ? 'nahost' : t.cc === 'NU' ? 'arktis' : 'asien'))

/* ── Schilder-Wörter ── */

const SPR = { es: 'Spanisch', pt: 'Portugiesisch', fr: 'Französisch' }
DECKS['schilder-woerter'] = S.SCHILDER.map(([w, de, l], i) => ({ key: `schilder-woerter:${i + 1}`, c: w, a: de, n: SPR[l], g: l }))
META['schilder-woerter'] = {
  kind: 'words', ask: 'Was bedeutet das Schild?', askBack: 'Wie heißt das auf dem Schild?',
  groups: Object.entries(SPR).map(([k, name]) => ({ k, name })),
  tips: ['Maut: PEAJE (Spanien, Lateinamerika), PORTAGEM (Portugal), PEDÁGIO (Brasilien), PÉAGE (Frankreich).', 'Bodenschwelle: TOPE in Mexiko, LOMBADA in Brasilien, „LOMO DE BURRO“ in Argentinien.', 'RUA = Portugal oder Brasilien, CALLE = spanischsprachig, RUE = französischsprachig.'],
}
console.log(`  schilder-woerter: ${DECKS['schilder-woerter'].length}`)

// Stoppschilder – Quelle: en.wikipedia.org/wiki/Stop_sign (ALTO in Mexiko und Mittelamerika, PARE in Südamerika, Karibik und Brasilien,
// STOP in Europa, ARRÊT in Québec); Japan 止まれ, China/Taiwan 停, Thailand หยุด, Saudi-Arabien قف
const STOPP = [
  ['MX', 'ALTO'], ['GT', 'ALTO'], ['SV', 'ALTO'], ['HN', 'ALTO'], ['NI', 'ALTO'], ['CR', 'ALTO'], ['PA', 'ALTO'],
  ['CU', 'PARE'], ['DO', 'PARE'], ['CO', 'PARE'], ['VE', 'PARE'], ['EC', 'PARE'], ['PE', 'PARE'], ['BO', 'PARE'], ['CL', 'PARE'], ['AR', 'PARE'], ['UY', 'PARE'], ['PY', 'PARE'], ['BR', 'PARE'],
  ['ES', 'STOP'], ['PT', 'STOP'], ['FR', 'STOP'], ['QC', 'ARRÊT'], ['JP', '止まれ'], ['CN', '停'], ['TW', '停'], ['TH', 'หยุด'], ['SA', 'قف'],
]
DECKS['stoppschilder'] = STOPP.map(([cc, w], i) => ({
  key: `stoppschilder:${cc.toLowerCase()}`, c: cc === 'QC' ? 'Kanada (Québec)' : landName(cc), a: w, g: w.length <= 5 && /^[A-ZÊ]+$/.test(w) ? w.toLowerCase().replace('ê', 'e') : 'andere',
  flag: cc === 'QC' ? 'ca' : cc.toLowerCase(), n: cc === 'QC' ? 'In Québec steht meist ARRÊT, manchmal ARRÊT/STOP.' : undefined,
}))
META['stoppschilder'] = {
  kind: 'words', ask: 'Was steht auf dem Stoppschild?', withFlags: true, promptFlag: true, noWrite: true,
  groups: [{ k: 'alto', name: 'ALTO', text: 'Mexiko und Mittelamerika' }, { k: 'pare', name: 'PARE', text: 'Südamerika, Karibik und Brasilien' }, { k: 'stop', name: 'STOP', text: 'Europa (auch Spanien und Portugal)' }, { k: 'arret', name: 'ARRÊT', text: 'Québec' }, { k: 'andere', name: 'Andere Schriften', text: '' }],
  tips: ['ALTO = Mexiko & Mittelamerika, PARE = Südamerika & Karibik, STOP = Europa.', 'Japans Stoppschild ist ein auf der Spitze stehendes Dreieck mit 止まれ.'],
}
console.log(`  stoppschilder: ${DECKS['stoppschilder'].length}`)

/* ───────────── Schreiben ───────────── */

fs.writeFileSync(path.join(root, 'public/geo/items/sprachen-orte.json'), JSON.stringify(ORTE))
fs.writeFileSync(path.join(root, 'public/geo/items/schriften.json'), JSON.stringify({ ...DECKS, _meta: META }))
const counts = { ...Object.fromEntries(Object.entries(ORTE).map(([k, v]) => [k, v.length])), ...Object.fromEntries(Object.entries(DECKS).map(([k, v]) => [k, v.length])) }
fs.writeFileSync(path.join(root, 'app/geo/_data/sprachen.ts'),
  `// Erzeugt von scripts/geo/build-sprachen.mjs – nicht von Hand bearbeiten.\n\nimport type { GroupDef } from '../_lib/types'\n\n` +
  `export const SPRACHEN_COUNTS: Record<string, number> = ${JSON.stringify(counts, null, 2)}\n\n` +
  `/** Gruppen der Karten-Quizzes (Länder bzw. Schriften) */\nexport const SPRACHEN_GROUPS: Record<string, Record<string, GroupDef>> = ${JSON.stringify(GROUPS, null, 2)}\n`)
for (const f of ['sprachen-orte', 'schriften']) console.log(`items/${f}.json ${(fs.statSync(path.join(root, `public/geo/items/${f}.json`)).size / 1024).toFixed(0)} KB`)
