// Baut „GeoGuessr Afrika“ von seekclan.de/geo: Länder-Steckbriefe, Lernkarten (Hinweise, Rate das Land, Regionen) und Merkmals-Karten.
//
// Nur für Entwicklung – wird NICHT beim normalen `npm run build` ausgeführt. Das Ergebnis liegt fertig im Repo.
// Braucht nur Dateien aus dem Repo:
//   scripts/geo/gg-af/<slug>.json   Hinweise je Land (Fakten aus Plonk It, CC BY-NC-SA 4.0 – auf Deutsch neu formuliert)
//   scripts/geo/afrika-daten.mjs    Vorwahlen, Domains, Fahrseite (allgemein bekannt)
// Erzeugt:
//   public/geo/gg-af/index.json, laender/<slug>.json, QUELLEN.txt
//   public/geo/items/gg-af-karten.json    Lernkarten (special 'schrift')
//   public/geo/items/gg-af-orte.json      Merkmals-Karten
//   app/geo/_data/gg-af.ts                Anzahl Einträge je Quiz + Länderliste + Farben der Karten
// Danach:  node scripts/geo/build-gg-af.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as A from './afrika-daten.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const OUT = 'public/geo/gg-af'
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'))
const write = (p, s) => { fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true }); fs.writeFileSync(path.join(root, p), s) }
const clean = s => String(s ?? '').replace(/\s+/g, ' ').trim()
const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** slug → [Name, ISO3 (Ebene), Flagge, Gruppe, Ebene] */
const LAENDER = {
  'south-africa': ['Südafrika', 'ZAF', 'za', 'sued', 'world'],
  'namibia': ['Namibia', 'NAM', 'na', 'sued', 'world'],
  'botswana': ['Botswana', 'BWA', 'bw', 'sued', 'world'],
  'lesotho': ['Lesotho', 'LSO', 'ls', 'sued', 'world'],
  'eswatini': ['Eswatini', 'SWZ', 'sz', 'sued', 'world'],
  'kenya': ['Kenia', 'KEN', 'ke', 'ost', 'world'],
  'uganda': ['Uganda', 'UGA', 'ug', 'ost', 'world'],
  'rwanda': ['Ruanda', 'RWA', 'rw', 'ost', 'world'],
  'nigeria': ['Nigeria', 'NGA', 'ng', 'west', 'world'],
  'ghana': ['Ghana', 'GHA', 'gh', 'west', 'world'],
  'senegal': ['Senegal', 'SEN', 'sn', 'west', 'world'],
  'madagascar': ['Madagaskar', 'MDG', 'mg', 'inseln', 'world'],
  'reunion': ['Réunion', 'REU', 'fr', 'inseln', 'gebiete'],
  'tunisia': ['Tunesien', 'TUN', 'tn', 'nord', 'world'],
}
const GRUPPEN = { sued: 'Südliches Afrika', ost: 'Ostafrika', west: 'Westafrika', inseln: 'Inseln im Indischen Ozean', nord: 'Nordafrika' }
const KATEGORIEN = {
  'fahrseite': 'Fahrseite', 'kennzeichen': 'Kennzeichen', 'autos': 'Autos, Taxis & Mototaxis', 'poller': 'Poller & Wegsteine', 'strassennummern': 'Straßennummern',
  'linien': 'Fahrbahnlinien', 'verkehrsschilder': 'Schilder & Chevrons', 'wegweiser': 'Wegweiser', 'ortsschild': 'Ortsschilder', 'strommasten': 'Strommasten & Laternen',
  'zaeune': 'Zäune, Mauern & Tore', 'sprache': 'Sprache', 'werbung': 'Werbung & Wandmalereien', 'google-auto': 'Google-Auto', 'kamera': 'Kamera', 'strassen': 'Straßen',
  'gebaeude': 'Gebäude', 'klima': 'Klima', 'landschaft': 'Landschaft', 'pflanzen': 'Bäume, Palmen & Pflanzen', 'abdeckung': 'Abdeckung', 'telefon-domain': 'Vorwahl & Domain', 'sonstiges': 'Sonstiges',
}
const KAT_ORDER = Object.keys(KATEGORIEN)

/**
 * Merkmale für Ausschluss-Training, Vergleichstabelle und Karten – aus den Hinweisen (Plonk It) zusammengefasst.
 * Fahrseite und Sprache auf Schildern: allgemein bekannt (Wikipedia).
 */
const MERKMALE = {
  fahrseite: ['Fahrseite', ['links', 'rechts']],
  sprache: ['Sprache auf Schildern', ['englisch', 'französisch', 'arabisch']],
  kennzeichen: ['Kennzeichen', ['weiß', 'gelb', 'gelb-hinten', 'blau', 'schwarz', 'gemischt']],
  randlinie: ['Randlinie', ['gelb', 'weiß']],
  mittellinie: ['Mittellinie', ['weiß', 'gelb']],
}
const TRAIN_KEYS = ['fahrseite', 'sprache', 'kennzeichen', 'randlinie', 'mittellinie']
const WERT_NAMEN = { englisch: 'Englisch', 'französisch': 'Französisch', arabisch: 'Arabisch (+ Französisch)', 'gelb-hinten': 'vorne weiß, hinten gelb' }
const MERKMAL = {
  'south-africa': { fahrseite: 'links', sprache: 'englisch', kennzeichen: 'gemischt', randlinie: 'gelb', mittellinie: 'weiß' },
  'namibia': { fahrseite: 'links', sprache: 'englisch', kennzeichen: 'gelb', randlinie: 'gelb', mittellinie: 'weiß' },
  'botswana': { fahrseite: 'links', sprache: 'englisch', kennzeichen: 'gelb-hinten', randlinie: 'gelb', mittellinie: 'weiß' },
  'lesotho': { fahrseite: 'links', sprache: 'englisch', kennzeichen: 'weiß', randlinie: 'gelb', mittellinie: 'weiß' },
  'eswatini': { fahrseite: 'links', sprache: 'englisch', kennzeichen: 'weiß', randlinie: 'gelb', mittellinie: 'weiß' },
  'kenya': { fahrseite: 'links', sprache: 'englisch', kennzeichen: 'gelb-hinten', randlinie: 'weiß', mittellinie: 'gelb' },
  'uganda': { fahrseite: 'links', sprache: 'englisch', kennzeichen: 'gelb-hinten', randlinie: 'weiß', mittellinie: 'gelb' },
  'rwanda': { fahrseite: 'rechts', sprache: 'englisch', kennzeichen: 'gelb-hinten', randlinie: 'weiß' },
  'nigeria': { fahrseite: 'rechts', sprache: 'englisch', kennzeichen: 'weiß' },
  'ghana': { fahrseite: 'rechts', sprache: 'englisch', kennzeichen: 'gemischt', randlinie: 'weiß', mittellinie: 'weiß' },
  'senegal': { fahrseite: 'rechts', sprache: 'französisch', kennzeichen: 'blau' },
  'madagascar': { fahrseite: 'rechts', sprache: 'französisch' },
  'reunion': { fahrseite: 'rechts', sprache: 'französisch', kennzeichen: 'weiß', randlinie: 'weiß', mittellinie: 'weiß' },
  'tunisia': { fahrseite: 'rechts', sprache: 'arabisch', kennzeichen: 'schwarz', randlinie: 'weiß', mittellinie: 'weiß' },
}

const SLUGS = Object.keys(LAENDER)
const nameOf = s => LAENDER[s]?.[0] ?? s
const flagOf = s => LAENDER[s]?.[2]
const gruppeOf = s => LAENDER[s]?.[3]
const GORDER = Object.keys(GRUPPEN)

function rng(seed) {
  let h = 2166136261
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296 }
}
const shuffleWith = (arr, r) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }

/* ───────────── Länder einlesen ───────────── */

const LAND = {}
for (const s of SLUGS) {
  const file = path.join(here, 'gg-af', `${s}.json`)
  if (!fs.existsSync(file)) throw new Error(`Fehlt: scripts/geo/gg-af/${s}.json`)
  const d = readJson(file)
  const iso = LAENDER[s][1]
  const L = A.LAND[iso]
  const hinweise = (d.hinweise ?? [])
    .filter(h => h && h.titel && h.text && KATEGORIEN[h.kat])
    .map(h => ({
      kat: h.kat, titel: clean(h.titel), text: clean(h.text), staerke: [1, 2, 3].includes(h.staerke) ? h.staerke : 1,
      region: h.region ? clean(h.region) : undefined, compare: (h.compare ?? []).filter(c => LAENDER[c] && c !== s), src: 'p',
    }))
  const m = MERKMAL[s]
  // Fahrseite und Vorwahl/Domain ergänzen (allgemein bekannt), wenn die Quelle sie nicht nennt
  if (!hinweise.some(h => h.kat === 'fahrseite')) hinweise.push({ kat: 'fahrseite', titel: m.fahrseite === 'links' ? 'Linksverkehr' : 'Rechtsverkehr', text: m.fahrseite === 'links' ? 'Hier wird links gefahren – wie im ganzen südlichen und östlichen Afrika (außer Ruanda).' : 'Hier wird rechts gefahren.', staerke: m.fahrseite === 'links' ? 2 : 1, compare: [], src: 'a' })
  if (L) hinweise.push({ kat: 'telefon-domain', titel: `Vorwahl ${L.tel}, Domain ${L.tld}`, text: `Telefonnummern beginnen international mit ${L.tel}, Webseiten enden auf ${L.tld} – auf Werbeplakaten und Lieferwagen gut zu sehen.`, staerke: 3, compare: [], src: 'a' })
  if (s === 'reunion') hinweise.push({ kat: 'telefon-domain', titel: 'Vorwahl +262, Domain .re', text: 'Telefonnummern beginnen mit +262 (oder 0262/0692/0693), Webseiten enden oft auf .re – sonst wie in Frankreich auf .fr.', staerke: 3, compare: [], src: 'a' })
  hinweise.sort((a, b) => KAT_ORDER.indexOf(a.kat) - KAT_ORDER.indexOf(b.kat) || b.staerke - a.staerke)
  const mm = d.merkmale ?? {}
  LAND[s] = {
    slug: s, name: nameOf(s), iso3: iso, flag: flagOf(s), gruppe: gruppeOf(s), kurz: clean(d.kurz),
    sprachen: Array.isArray(mm.sprachen) ? mm.sprachen : L ? L.sp : ['Französisch'],
    merkmale: Object.fromEntries(Object.keys(MERKMALE).map(k => [k, m[k] ?? null])), hinweise,
    info: {
      kennzeichen: mm.kennzeichen ?? null, poller: mm.poller ?? null, strommasten: mm.strommasten ?? null, google_auto: mm.google_auto ?? null,
      chevron: mm.chevron ?? null, landschaft: mm.landschaft ?? null, klima: mm.klima ?? null,
      vorwahl: L ? `${L.tel} · Domain ${L.tld}` : s === 'reunion' ? '+262 · Domain .re' : null,
    },
  }
}

/* ───────────── Index und Steckbriefe ───────────── */

const sprachErkennung = [
  { sprache: 'Afrikaans', laender: ['south-africa', 'namibia'], zeichen: [], text: 'Ortsnamen auf -fontein, -kraal, -dorp, -berg, -burg. Vor allem in Südafrika und Namibia, selten in Botswana.' },
  { sprache: 'Swahili', laender: ['kenya', 'uganda'], zeichen: [], text: 'Wörter wie „karibu“ (willkommen), „hoteli“, „duka“ (Laden), „barabara“ (Straße).' },
  { sprache: 'Kinyarwanda', laender: ['rwanda'], zeichen: [], text: 'Viele Wörter mit „rw“, „cy“, „nyi“ – z. B. „Murakaza neza“ (willkommen).' },
  { sprache: 'Französisch', laender: ['senegal', 'madagascar', 'reunion', 'tunisia'], zeichen: ['é', 'è', 'ç'], text: 'Senegal, Madagaskar und Réunion; in Tunesien neben Arabisch.' },
  { sprache: 'Arabisch', laender: ['tunisia'], zeichen: ['ع', 'ش', 'ت'], text: 'Unter den GeoGuessr-Ländern Afrikas nur Tunesien.' },
  { sprache: 'Malagasy', laender: ['madagascar'], zeichen: [], text: 'Lange Ortsnamen mit vielen Vokalen, oft auf -o, -y, -ana: Antananarivo, Fianarantsoa.' },
]
const vergleiche = [
  { thema: 'linien', titel: 'Gelbe Randlinien im Süden', text: 'Südafrika, Namibia, Botswana, Lesotho und Eswatini haben gelbe Randlinien und weiße Mittellinien. Kenia und Uganda: genau umgekehrt – gelbe Mitte, weiße Ränder.', laender: ['south-africa', 'namibia', 'botswana', 'lesotho', 'eswatini', 'kenya', 'uganda'], werte: { 'south-africa': 'gelber Rand', namibia: 'gelber Rand', botswana: 'gelber Rand', lesotho: 'gelber Rand', eswatini: 'gelber Rand', kenya: 'gelbe Mitte', uganda: 'gelbe Mitte' } },
  { thema: 'strassennummern', titel: 'Straßennummern im südlichen Afrika', text: 'N- und R-Straßen gibt es nur in Südafrika, MR-Straßen nur in Eswatini. A- und B-Straßen: Botswana, Lesotho und Namibia – Namibia hat zusätzlich C-, D- und M-Straßen.', laender: ['south-africa', 'eswatini', 'botswana', 'lesotho', 'namibia'], werte: { 'south-africa': 'N, R', eswatini: 'MR', botswana: 'A, B', lesotho: 'A, B', namibia: 'A–D, M' } },
  { thema: 'kennzeichen', titel: 'Kennzeichen', text: 'Komplett blau gibt es nur im Senegal, schwarz nur in Tunesien. Vorne weiß und hinten gelb: Kenia, Uganda, Ruanda und Botswana. Namibia meist vorne und hinten gelb.', laender: ['senegal', 'tunisia', 'kenya', 'uganda', 'rwanda', 'botswana', 'namibia'], werte: { senegal: 'blau', tunisia: 'schwarz', kenya: 'weiß/gelb', uganda: 'weiß/gelb', rwanda: 'weiß/gelb', botswana: 'weiß/gelb', namibia: 'gelb' } },
  { thema: 'fahrseite', titel: 'Fahrseite', text: 'Links: das ganze südliche Afrika sowie Kenia und Uganda. Rechts: Ruanda (obwohl mitten zwischen Linksverkehr-Ländern), Westafrika, Madagaskar, Réunion und Tunesien.', laender: SLUGS, werte: Object.fromEntries(SLUGS.map(s => [s, MERKMAL[s].fahrseite])) },
]
const INDEX = {
  gruppen: GRUPPEN, kategorien: KATEGORIEN,
  merkmale: Object.fromEntries(Object.entries(MERKMALE).map(([k, [name, werte]]) => [k, { name, werte }])),
  wertNamen: WERT_NAMEN,
  laender: SLUGS.map(s => {
    const l = LAND[s]
    return { slug: s, name: l.name, flag: l.flag, gruppe: l.gruppe, iso3: l.iso3, kurz: l.kurz, sprachen: l.sprachen, merkmale: l.merkmale, anzahl: l.hinweise.length, stark: l.hinweise.filter(h => h.staerke === 3).length, orts: [], zebra: [], strassen: [], poller: [], wegweiser: [], linien: [], galerie: {}, titelbild: null }
  }),
  vergleiche, sprachErkennung, trainKeys: TRAIN_KEYS, galerien: [],
}
write(`${OUT}/index.json`, JSON.stringify(INDEX))
for (const s of SLUGS) write(`${OUT}/laender/${s}.json`, JSON.stringify({ ...INDEX.laender.find(l => l.slug === s), info: LAND[s].info, hinweise: LAND[s].hinweise }))

/* ───────────── Lernkarten ───────────── */

const DECKS = {}, META = {}
const landGroups = cards => GORDER.filter(g => cards.some(c => c.g === g)).map(k => ({ k, name: GRUPPEN[k] }))
const byGroup = cards => [...cards].sort((a, b) => GORDER.indexOf(a.g) - GORDER.indexOf(b.g))
/** Hinweis verrät das Land im Titel? Dann nicht als Karte */
const verraet = (s, t) => [nameOf(s), ...(s === 'south-africa' ? ['Südafrika', 'Kapstadt'] : [])].some(n => t.toLowerCase().includes(n.toLowerCase()))
function hinweisDeck(slugName, kats, ask, tips) {
  const cards = []
  for (const s of SLUGS) LAND[s].hinweise.forEach((h, i) => {
    if (kats && !kats.includes(h.kat)) return
    if (h.kat === 'telefon-domain' && slugName !== 'gg-af-hinweise') return
    if (verraet(s, h.titel)) return
    cards.push({ key: `${slugName}:${s}:${i}`, c: h.titel, a: nameOf(s), g: kats ? gruppeOf(s) : h.kat, flag: flagOf(s), n: h.text + (h.region ? ` (${h.region})` : ''), ...(h.compare.length ? { near: h.compare.map(nameOf) } : {}) })
  })
  DECKS[slugName] = kats ? byGroup(cards) : [...cards].sort((a, b) => KAT_ORDER.indexOf(a.g) - KAT_ORDER.indexOf(b.g))
  META[slugName] = { kind: 'words', withFlags: true, noWrite: true, ask, groups: kats ? landGroups(cards) : KAT_ORDER.filter(k => cards.some(c => c.g === k)).map(k => ({ k, name: KATEGORIEN[k] })), tips }
}
hinweisDeck('gg-af-hinweise', null, 'Welches Land?', ['Am meisten bringen Fahrseite, Linienfarben, Kennzeichen und das Google-Auto.', 'Zu jedem Land gibt es einen Steckbrief mit allen Hinweisen.'])
hinweisDeck('gg-af-google-auto', ['google-auto', 'kamera'], 'Welches Land hat dieses Google-Auto?', ['In Afrika verrät das Auto oft das Land: Ghana-Tape, Namibias schiefe Antenne, Nigerias Polizei-Begleitung.'])
hinweisDeck('gg-af-strasse', ['kennzeichen', 'linien', 'verkehrsschilder', 'wegweiser', 'strassennummern', 'poller', 'strommasten', 'ortsschild', 'autos', 'fahrseite'], 'Welches Land?', ['Linien, Kennzeichen, Schilder und Masten – alles, was an der Straße steht.'])
hinweisDeck('gg-af-landschaft', ['landschaft', 'pflanzen', 'klima', 'gebaeude', 'strassen', 'zaeune'], 'Welches Land?', ['Rote Erde allein reicht nicht – achte auf Pflanzen, Hügel und Häuser.'])
// Rate das Land: drei Hinweise
{
  const cards = []
  for (const s of SLUGS) {
    const r = rng(`af-${s}`)
    const pool = LAND[s].hinweise.filter(h => h.kat !== 'telefon-domain' && !verraet(s, h.titel))
    const seen = new Set()
    const want = Math.min(6, Math.max(2, Math.floor(pool.length / 4)))
    for (let t = 0; t < 80 && cards.filter(c => c.a === nameOf(s)).length < want; t++) {
      const picks = []
      for (const h of shuffleWith(pool, r)) { if (picks.length === 3) break; if (!picks.some(p => p.kat === h.kat)) picks.push(h) }
      const id = picks.map(p => pool.indexOf(p)).sort((a, b) => a - b).join('-')
      if (seen.has(id) || picks.length < 3) continue
      seen.add(id)
      cards.push({ key: `gg-af-rate:${s}:${id}`, c: picks.map(p => p.titel).join('\n'), a: nameOf(s), g: gruppeOf(s), flag: flagOf(s), n: picks.map(p => p.text).join(' · ') })
    }
  }
  DECKS['gg-af-rate-das-land'] = byGroup(cards)
  META['gg-af-rate-das-land'] = { kind: 'words', withFlags: true, noWrite: true, multiline: true, ask: 'Drei Hinweise – welches Land?', groups: landGroups(cards), tips: ['Erst ausschließen: Fahrseite, Linienfarben, Sprache.'] }
}
// Vorwahlen und Domains der GG-Länder
DECKS['gg-af-vorwahlen'] = byGroup(SLUGS.map(s => { const L = A.LAND[LAENDER[s][1]]; return { key: `gg-af-vw:${s}`, c: L ? L.tel : '+262', a: nameOf(s), g: gruppeOf(s), flag: flagOf(s), n: `Vorwahl ${L ? L.tel : '+262'}` } }))
META['gg-af-vorwahlen'] = { kind: 'words', withFlags: true, noWrite: true, ask: 'Welches Land hat diese Vorwahl?', groups: landGroups(DECKS['gg-af-vorwahlen']), tips: ['+27 Südafrika, +254 Kenia, +234 Nigeria, +233 Ghana, +221 Senegal.'] }
DECKS['gg-af-domains'] = byGroup(SLUGS.map(s => { const L = A.LAND[LAENDER[s][1]]; return { key: `gg-af-tld:${s}`, c: L ? L.tld : '.re', a: nameOf(s), g: gruppeOf(s), flag: flagOf(s), n: `Domain ${L ? L.tld : '.re'}` } }))
META['gg-af-domains'] = { kind: 'words', withFlags: true, noWrite: true, ask: 'Welches Land hat diese Domain?', groups: landGroups(DECKS['gg-af-domains']), tips: ['Südafrika: .za (von „Zuid-Afrika“), oft als .co.za.'] }
// Regionen je Land: Wo im Land bist du?
const REGION_DECKS = []
for (const s of SLUGS) {
  const cards = []
  LAND[s].hinweise.forEach((h, i) => {
    if (!h.region || verraet(s, h.titel)) return
    cards.push({ key: `gg-af-reg-${s}:${i}`, c: h.titel, a: h.region, g: h.kat, n: h.text })
  })
  if (new Set(cards.map(c => c.a)).size < 6) continue
  const slugName = `gg-af-regionen-${s}`
  DECKS[slugName] = [...cards].sort((a, b) => KAT_ORDER.indexOf(a.g) - KAT_ORDER.indexOf(b.g))
  META[slugName] = { kind: 'words', noWrite: true, ask: `Wo in ${nameOf(s)}?`, groups: KAT_ORDER.filter(k => cards.some(c => c.g === k)).map(k => ({ k, name: KATEGORIEN[k] })), tips: ['Region-Hinweise helfen, nach dem Land auch noch genau zu tippen.', `Alle Hinweise stehen im Steckbrief ${nameOf(s)}.`] }
  REGION_DECKS.push([slugName, s])
}
write('public/geo/items/gg-af-karten.json', JSON.stringify({ ...DECKS, _meta: META }))

/* ───────────── Merkmals-Karten ───────────── */

const ORTE = {}
function merkmalKarte(key, frage) {
  return SLUGS.filter(s => LAND[s].merkmale[key]).map(s => {
    const v = LAND[s].merkmale[key], vn = WERT_NAMEN[v] ?? v
    return {
      key: `gg-af-${key}:${LAND[s].iso3}`, label: nameOf(s), group: slug(v) || 'x', areas: [`${LAENDER[s][4]}:${LAND[s].iso3}`], flag: flagOf(s), iso: LAND[s].iso3,
      details: [{ label: MERKMALE[key][0], value: vn, big: true }], text: { prompt: `${frage} ${nameOf(s)}?`, answer: vn },
    }
  })
}
ORTE['gg-af-fahrseite-karte'] = merkmalKarte('fahrseite', 'Auf welcher Seite wird gefahren in')
ORTE['gg-af-randlinie-karte'] = merkmalKarte('randlinie', 'Welche Farbe hat die Randlinie in')
ORTE['gg-af-mittellinie-karte'] = merkmalKarte('mittellinie', 'Welche Farbe hat die Mittellinie in')
ORTE['gg-af-kennzeichen-karte'] = merkmalKarte('kennzeichen', 'Wie sehen die Kennzeichen aus in')
ORTE['gg-af-sprache-karte'] = merkmalKarte('sprache', 'Welche Sprache steht auf den Schildern in')
write('public/geo/items/gg-af-orte.json', JSON.stringify(ORTE))

/* ───────────── Quellen ───────────── */

write(`${OUT}/QUELLEN.txt`, [
  'GeoGuessr Afrika (seekclan.de/geo) – Quellen und Lizenzen', '',
  'HINWEISE JE LAND',
  'Fakten aus dem Plonk-It-Guide (https://www.plonkit.net/guide, Stand Oktober 2026), Lizenz CC BY-NC-SA 4.0 (https://creativecommons.org/licenses/by-nc-sa/4.0/deed.de).',
  'Alle Texte sind auf Deutsch neu formuliert und gekürzt. Diese Texte stehen ebenfalls unter CC BY-NC-SA 4.0.',
  'Fahrseite, Ländervorwahlen (ITU) und Länderdomains (IANA): allgemein bekannt.',
  'Länder mit Street View in GeoGuessr: geometas.com/learn/geoguessr_country_coverage, dazu Namibia (Street View seit Juni 2025).',
].join('\n') + '\n')

/* ───────────── TypeScript-Daten ───────────── */

const counts = { ...Object.fromEntries(Object.entries(DECKS).map(([k, v]) => [k, v.length])), ...Object.fromEntries(Object.entries(ORTE).map(([k, v]) => [k, v.length])) }
const colorOf = { 'weiß': '#e8e4da', 'gelb': '#f2c230', 'gemischt': '#9a8fb5', 'gelb-hinten': '#c9c37a', 'blau': '#3d74d0', 'schwarz': '#555555', links: '#e07a5f', rechts: '#5b9bd5', englisch: '#c9637a', 'französisch': '#3d74d0', arabisch: '#5fb07a' }
const groupsFor = key => Object.fromEntries(MERKMALE[key][1].filter(v => SLUGS.some(s => LAND[s].merkmale[key] === v)).map(v => [slug(v) || 'x', { name: WERT_NAMEN[v] ?? v, color: colorOf[v] ?? '#888888' }]))
write('app/geo/_data/gg-af.ts', `// Erzeugt von scripts/geo/build-gg-af.mjs – nicht von Hand ändern.
export const GG_AF_COUNTS: Record<string, number> = ${JSON.stringify(counts, null, 2)}

/** Länder mit Steckbrief: [slug, Name, Flagge, Gruppe] */
export const GG_AF_LAENDER: [string, string, string, string][] = ${JSON.stringify(SLUGS.map(s => [s, nameOf(s), flagOf(s), gruppeOf(s)]))}

/** Regionen-Decks: [slug, Land-slug, Name] */
export const GG_AF_REGIONEN: [string, string, string, string][] = ${JSON.stringify(REGION_DECKS.map(([q, s]) => [q, s, nameOf(s), LAENDER[s][1]]))}

/** Farben der Merkmals-Karten */
export const GG_AF_MERKMAL_GROUPS: Record<string, Record<string, { name: string; color: string }>> = ${JSON.stringify(Object.fromEntries(['fahrseite', 'randlinie', 'mittellinie', 'kennzeichen', 'sprache'].map(k => [`gg-af-${k}-karte`, groupsFor(k)])), null, 2)}
`)
console.log('Länder', SLUGS.length, '· Hinweise', SLUGS.reduce((n, s) => n + LAND[s].hinweise.length, 0))
console.log(Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(' · '))
