// Baut „GeoGuessr Europa“ von seekclan.de/geo (Phase 6): Länder-Steckbriefe, Lernkarten und Karten-Quizzes.
//
// Nur für Entwicklung – wird NICHT beim normalen `npm run build` ausgeführt. Das Ergebnis liegt fertig im Repo.
// Braucht nur Dateien aus dem Repo:
//   scripts/geo/gg/laender.json           Hinweise je Land (Schlüssel = slug) (Fakten aus Plonk It, CC BY-NC-SA 4.0, + älterer Guide – auf Deutsch neu formuliert)
//   scripts/geo/gg/allgemein.json         Länderübergreifende Vergleiche
//   scripts/geo/gg/schilder.json          Ortsschilder & Zebrastreifen-Schilder von Wikimedia Commons (Dateien in public/geo/gg/schilder/)
//   scripts/geo/gg-daten.mjs              Von Hand: Länder, Merkmale, Straßennummern, Kennzeichen-Codes
//   scripts/geo/gg-zeichnungen.mjs        Von Hand: Poller, Wegweiser und Fahrbahn-Linien je Land (eigene Zeichnungen)
//   public/geo/items/europa.json          Regionen Russlands, Polens und der Ukraine (für die Kennzeichen-Karten)
// Erzeugt:
//   public/geo/gg/index.json              Übersicht: alle Länder mit Merkmalen, Schildern, Anzahl Hinweise + Vergleiche
//   public/geo/gg/laender/<slug>.json     Steckbrief je Land (alle Hinweise)
//   public/geo/gg/strassen/*.svg          Straßennummern-Schilder (eigene Grafiken)
//   public/geo/gg/poller|wegweiser|linien/*.svg   Poller, Wegweiser, Fahrbahn-Linien (eigene Zeichnungen)
//   public/geo/gg/QUELLEN.txt             Quellen und Lizenzen
//   public/geo/items/gg-karten.json       Lernkarten (special 'schrift'): Ortsschilder, Zebrastreifen, Straßennummern, Poller, Wegweiser, Hinweise, Rate das Land
//   public/geo/items/gg-orte.json         Karten-Quizzes: Kennzeichen-Regionen, Ortsschild-/Wegweiser-/Kennzeichen-/Linien-Farben
//   app/geo/_data/gg.ts                   Anzahl Einträge je Quiz + Länderliste für die Seiten
// Danach:  node scripts/geo/build-gg.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as D from './gg-daten.mjs'
import * as Z from './gg-zeichnungen.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'))
const write = (p, s) => { fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true }); fs.writeFileSync(path.join(root, p), s) }

const SLUGS = Object.keys(D.LAENDER)
const nameOf = s => D.LAENDER[s]?.[0] ?? s
const flagOf = s => D.LAENDER[s]?.[2]
const gruppeOf = s => D.LAENDER[s]?.[3]

/** Gleichbleibender Zufall (damit der Build immer dasselbe ergibt) */
function rng(seed) {
  let h = 2166136261
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296 }
}
const shuffleWith = (arr, r) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
const clean = s => String(s ?? '').replace(/\s+/g, ' ').trim()

/* ───────────── Länder einlesen ───────────── */

const KAT_ORDER = Object.keys(D.KATEGORIEN)
const LAENDER_JSON = readJson(path.join(here, 'gg/laender.json'))
const LAND = {}
for (const slug of SLUGS) {
  const d = LAENDER_JSON[slug]
  if (!d) throw new Error(`Fehlt in scripts/geo/gg/laender.json: ${slug}`)
  const merk = {}
  for (const k of Object.keys(D.MERKMALE)) {
    const v = D.MERKMAL_FIX[slug]?.[k] ?? d.merkmale?.[k] ?? (k === 'linienfarbe' ? Z.LINIENFARBE[slug] : null) ?? null
    merk[k] = v && D.MERKMALE[k][1].includes(v) ? v : null
  }
  const hinweise = (d.hinweise ?? [])
    .filter(h => h && h.titel && h.text && D.KATEGORIEN[h.kat])
    .map(h => ({
      kat: h.kat, titel: clean(h.titel), text: clean(h.text),
      staerke: [1, 2, 3].includes(h.staerke) ? h.staerke : 1,
      region: h.region ? clean(h.region) : undefined,
      compare: (h.compare ?? []).filter(c => D.LAENDER[c] && c !== slug),
      src: h.src === 'plonkit' ? 'p' : 's',
    }))
    .sort((a, b) => KAT_ORDER.indexOf(a.kat) - KAT_ORDER.indexOf(b.kat) || b.staerke - a.staerke)
  LAND[slug] = {
    slug, name: nameOf(slug), iso3: D.LAENDER[slug][1], flag: flagOf(slug), gruppe: gruppeOf(slug),
    kurz: clean(d.kurz), sprachen: d.merkmale?.sprachen ?? [], merkmale: merk, hinweise,
    info: { poller: d.merkmale?.poller ?? null, strommasten: d.merkmale?.strommasten ?? null, google_auto: d.merkmale?.google_auto ?? null, landschaft: d.merkmale?.landschaft ?? null },
  }
}

/* ───────────── Schilder ───────────── */

const SCHILDER = readJson(path.join(here, 'gg/schilder.json'))
for (const s of SCHILDER) if (!fs.existsSync(path.join(root, 'public/geo/gg/schilder', s.name))) throw new Error(`Schild fehlt: ${s.name}`)
const schilderOf = (slug, set) => SCHILDER.filter(s => s.land === slug && s.set === set).map(s => `/geo/gg/schilder/${s.name}`)

/* ───────────── Straßennummern-Schilder (eigene SVG) ───────────── */

function shieldSvg(text, bg, fg, form) {
  const w = Math.max(70, 26 + text.length * 19), h = 52
  const dark = bg !== D.STRASSEN_FARBEN.WEISS && bg !== D.STRASSEN_FARBEN.GELB
  const line = dark ? '#ffffff' : '#111111'
  let shape
  if (form === 'shield') {
    shape = `<path d="M3 3H${w - 3}V${h * 0.62}Q${w / 2} ${h + 6} 3 ${h * 0.62}Z" fill="${bg}" stroke="${line}" stroke-width="3"/>`
  } else if (form === 'round') {
    shape = `<rect x="1.5" y="1.5" width="${w - 3}" height="${h - 3}" rx="10" fill="${bg}"/><rect x="5" y="5" width="${w - 10}" height="${h - 10}" rx="7" fill="none" stroke="${line}" stroke-width="2.5"/>`
  } else {
    shape = `<rect x="1.5" y="1.5" width="${w - 3}" height="${h - 3}" rx="4" fill="${bg}" stroke="${line}" stroke-width="3"/>`
  }
  const ty = form === 'shield' ? 30 : 35
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h + (form === 'shield' ? 6 : 0)}" width="${w * 2}" height="${(h + (form === 'shield' ? 6 : 0)) * 2}">${shape}` +
    `<text x="${w / 2}" y="${ty}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="26" fill="${fg}">${text.replace(/&/g, '&amp;')}</text></svg>`
}
fs.rmSync(path.join(root, 'public/geo/gg/strassen'), { recursive: true, force: true })
const STRASSEN = D.STRASSEN.map(([land, art, text, bg, fg, form], i) => {
  const file = `/geo/gg/strassen/${land}-${i}.svg`
  write(`public${file}`, shieldSvg(text, bg, fg, form))
  return { land, art, text, file }
})

/* ───────────── Poller, Wegweiser, Fahrbahn-Linien (eigene Zeichnungen) ───────────── */

for (const [name, specs] of [['POLLER', Z.POLLER], ['WEGWEISER', Z.WEGWEISER], ['LINIEN', Z.LINIEN], ['LINIENFARBE', Z.LINIENFARBE]]) {
  for (const s of Object.keys(specs)) if (!D.LAENDER[s]) throw new Error(`gg-zeichnungen.mjs ${name}: unbekanntes Land ${s}`)
}
const ZEICH = {}
for (const dir of ['poller', 'wegweiser', 'linien']) fs.rmSync(path.join(root, 'public/geo/gg', dir), { recursive: true, force: true })
for (const s of SLUGS) {
  ZEICH[s] = {
    poller: (Z.POLLER[s] ?? []).map((p, i) => {
      const file = `/geo/gg/poller/${s}-${i}.svg`
      write(`public${file}`, Z.pollerSvg(p, `${s}-${i}`))
      return { file, titel: p.titel }
    }),
    wegweiser: (Z.WEGWEISER[s] ?? []).map((w, i) => {
      const file = `/geo/gg/wegweiser/${s}-${i}.svg`, anonym = `/geo/gg/wegweiser/${s}-${i}-a.svg`
      write(`public${file}`, Z.wegweiserSvg(w))
      write(`public${anonym}`, Z.wegweiserSvg(w, true))
      return { file, anonym, titel: w.titel }
    }),
    linien: (Z.LINIEN[s] ?? []).map((l, i) => {
      const file = `/geo/gg/linien/${s}-${i}.svg`
      write(`public${file}`, Z.linienSvg(l))
      return { file, titel: l.titel }
    }),
  }
}

/* ───────────── Übersicht + Steckbriefe ───────────── */

const ALLG = readJson(path.join(here, 'gg/allgemein.json'))
const vergleiche = (ALLG.vergleiche ?? []).map(v => ({
  thema: v.thema, titel: clean(v.titel), text: clean(v.text),
  laender: (v.laender ?? []).filter(s => D.LAENDER[s]),
  werte: Object.fromEntries(Object.entries(v.werte ?? {}).filter(([s]) => D.LAENDER[s])),
}))
const sprachErkennung = (ALLG.sprach_erkennung ?? []).map(s => ({ sprache: s.sprache, laender: (s.laender ?? []).filter(x => D.LAENDER[x]), zeichen: s.zeichen ?? [], text: clean(s.text) }))

const INDEX = {
  gruppen: D.GRUPPEN, kategorien: D.KATEGORIEN,
  merkmale: Object.fromEntries(Object.entries(D.MERKMALE).map(([k, [name, werte]]) => [k, { name, werte }])),
  wertNamen: D.WERT_NAMEN,
  laender: SLUGS.map(s => {
    const l = LAND[s]
    return {
      slug: s, name: l.name, flag: l.flag, gruppe: l.gruppe, iso3: l.iso3, kurz: l.kurz, sprachen: l.sprachen, merkmale: l.merkmale,
      anzahl: l.hinweise.length, stark: l.hinweise.filter(h => h.staerke === 3).length,
      orts: schilderOf(s, 'orts'), zebra: schilderOf(s, 'zebra'), strassen: STRASSEN.filter(x => x.land === s).map(({ art, text, file }) => ({ art, text, file })),
      poller: ZEICH[s].poller, wegweiser: ZEICH[s].wegweiser.map(({ file, titel }) => ({ file, titel })), linien: ZEICH[s].linien,
    }
  }),
  vergleiche, sprachErkennung,
}
write('public/geo/gg/index.json', JSON.stringify(INDEX))
fs.rmSync(path.join(root, 'public/geo/gg/laender'), { recursive: true, force: true })
for (const s of SLUGS) {
  const l = LAND[s]
  write(`public/geo/gg/laender/${s}.json`, JSON.stringify({
    ...INDEX.laender.find(x => x.slug === s), info: l.info,
    hinweise: l.hinweise.map(h => ({ ...h, compare: h.compare.length ? h.compare : undefined })),
  }))
}

/* ───────────── Lernkarten (special 'schrift') ───────────── */

// Verrät der Titel schon das Land? (Name oder Adjektiv, z. B. „Polnische Sonderbuchstaben“) – solche Karten nicht abfragen
const ADJ = {
  'ireland': 'irisch', 'united-kingdom': 'britisch', 'spain': 'spanisch', 'france': 'französisch', 'germany': 'deutsch', 'italy': 'italienisch',
  'poland': 'polnisch', 'russia': 'russisch', 'sweden': 'schwedisch', 'norway': 'norwegisch', 'finland': 'finnisch', 'denmark': 'dänisch',
  'netherlands': 'niederländisch', 'belgium': 'belgisch', 'austria': 'österreich', 'switzerland': 'schweiz', 'hungary': 'ungarisch',
  'czechia': 'tschechisch', 'slovakia': 'slowakisch', 'greece': 'griechisch', 'turkey': 'türkisch', 'ukraine': 'ukrainisch', 'romania': 'rumänisch',
  'bulgaria': 'bulgarisch', 'croatia': 'kroatisch', 'serbia': 'serbisch', 'portugal': 'portugiesisch', 'iceland': 'isländisch', 'estonia': 'estnisch',
  'latvia': 'lettisch', 'lithuania': 'litauisch', 'slovenia': 'slowenisch', 'albania': 'albanisch', 'cyprus': 'zypr', 'luxembourg': 'luxemburg',
  'malta': 'maltesisch', 'north-macedonia': 'mazedonisch', 'montenegro': 'montenegr', 'belarus': 'belarussisch', 'bosnia-and-herzegovina': 'bosnisch',
  'faroe-islands': 'färöisch', 'gibraltar': 'gibraltar', 'andorra': 'andorran', 'monaco': 'monegass', 'liechtenstein': 'liechtenstein',
  'san-marino': 'san marin', 'azores': 'azor', 'madeira': 'madeir', 'svalbard': 'spitzberg', 'greenland': 'grönländ', 'jersey': 'jersey', 'isle-of-man': 'isle of man',
}
const verraet = (slug, titel, region) => {
  const t = titel.toLowerCase()
  if (t.includes(nameOf(slug).toLowerCase()) || (ADJ[slug] && t.includes(ADJ[slug]))) return true
  // Regionsname im Titel (z. B. „… in Katalonien“) verrät das Land ebenfalls
  return !!region && region.toLowerCase().split(/[^a-zäöüßéèáíóúçñõãâêôåøæ-]+/).some(w => w.length >= 5 && t.includes(w.slice(0, -1)))
}
const OHNE_KAT = ['fahrseite', 'sprache', 'schrift']

const DECKS = {}, META = {}
const groupsFrom = (keys, names) => [...new Set(keys)].map(k => ({ k, name: names[k] ?? k }))
const sortByGroup = (cards, order) => cards.sort((a, b) => order.indexOf(a.g) - order.indexOf(b.g) || a.a.localeCompare(b.a, 'de'))
const GORDER = Object.keys(D.GRUPPEN)

// Ortsschilder
{
  const cards = SCHILDER.filter(s => s.set === 'orts').map((s, i) => ({
    key: `gg-orts:${s.name.replace(/\.\w+$/, '')}`, c: `Ortsschild ${i + 1}`, a: nameOf(s.land), g: gruppeOf(s.land), flag: flagOf(s.land),
    img: `/geo/gg/schilder/${s.name}`, n: SCHILDER.filter(x => x.set === 'orts' && x.land === s.land).length > 1 ? 'Eine von mehreren Varianten in diesem Land' : undefined,
  }))
  DECKS['gg-ortsschilder'] = sortByGroup(cards, GORDER)
  META['gg-ortsschilder'] = {
    kind: 'words', withFlags: true, noWrite: true, imgDeck: true, ask: 'Aus welchem Land ist dieses Ortsschild?',
    groups: groupsFrom(GORDER.filter(g => cards.some(c => c.g === g)), D.GRUPPEN),
    tips: [
      'Gelb mit schwarzem Rand: Deutschland, Luxemburg, Slowenien, Kroatien, Island – Bosnien und Nordmazedonien schreiben zweisprachig.',
      'Blau mit weißer Schrift: Skandinavien, Niederlande, Serbien, Türkei. Grün: Polen und Irland.',
      'Weiß mit rotem Rand: Frankreich, Spanien, Ungarn – Österreich hat einen blauen Rand.',
      'Die Grafiken sind die offiziellen Verkehrszeichen von Wikimedia Commons – echte Schilder können leicht abweichen.',
    ],
  }
}
// Fußgängerüberweg-Schilder
{
  const cards = SCHILDER.filter(s => s.set === 'zebra').map((s, i) => ({
    key: `gg-zebra:${s.name.replace(/\.\w+$/, '')}`, c: `Zebrastreifen-Schild ${i + 1}`,
    a: s.land === 'united-kingdom' ? 'Vereinigtes Königreich & Irland' : nameOf(s.land),
    g: gruppeOf(s.land), flag: flagOf(s.land), img: `/geo/gg/schilder/${s.name}`,
    n: s.land === 'united-kingdom' ? 'Belisha-Bake: gelbe Kugel auf schwarz-weißer Stange – auch in Irland, auf der Isle of Man und in Jersey.'
      : SCHILDER.filter(x => x.set === 'zebra' && x.land === s.land).length > 1 ? 'Dieses Land nutzt zwei Varianten' : undefined,
  }))
  DECKS['gg-zebrastreifen'] = sortByGroup(cards, GORDER)
  META['gg-zebrastreifen'] = {
    kind: 'words', withFlags: true, noWrite: true, imgDeck: true, ask: 'Aus welchem Land ist dieses Zebrastreifen-Schild?',
    groups: groupsFrom(GORDER.filter(g => cards.some(c => c.g === g)), D.GRUPPEN),
    tips: [
      'Fast überall: weißes Dreieck auf blauem Quadrat. Achte auf den Blauton, die Form des Dreiecks und die Figur.',
      'Island: gelbes Dreieck. Schweiz und Liechtenstein: hohes, schmales Schild.',
      'Großbritannien und Irland: statt eines Schildes eine gelbe Kugel auf einer schwarz-weißen Stange (Belisha-Bake).',
      'Türkei und Griechenland haben auch eine Variante mit zwei Figuren.',
    ],
  }
}
// Straßennummern
{
  const cards = STRASSEN.map((s, i) => ({
    key: `gg-strasse:${s.land}-${i}`, c: s.text, a: nameOf(s.land), g: gruppeOf(s.land), flag: flagOf(s.land), img: s.file, n: s.art,
  }))
  DECKS['gg-strassennummern'] = sortByGroup(cards, GORDER)
  META['gg-strassennummern'] = {
    kind: 'words', withFlags: true, noWrite: true, imgDeck: true, ask: 'Aus welchem Land ist diese Straßennummer?',
    groups: groupsFrom(GORDER.filter(g => cards.some(c => c.g === g)), D.GRUPPEN),
    tips: [
      'Rote Schilder mit weißer Schrift: Autobahnen in Frankreich, der Schweiz, den Niederlanden, Polen, Tschechien und der Slowakei.',
      'Gelb mit schwarzer Schrift: kleinere Straßen in Frankreich (D), Deutschland (B), den Niederlanden (N), Polen, Litauen und Luxemburg.',
      'Grün: Autobahnen in Italien, Slowenien, Rumänien, Bulgarien – in Großbritannien und Irland grün mit GELBER Schrift für Hauptstraßen.',
      'Eigene Grafiken – Farben nach Fotos von Straßenschildern, Formen vereinfacht.',
    ],
  }
}
// Poller (eigene Zeichnungen)
{
  const cards = SLUGS.flatMap(s => ZEICH[s].poller.map((p, i) => ({
    key: `gg-poller:${s}-${i}`, c: `Poller ${nameOf(s)} ${i + 1}`, a: nameOf(s), g: gruppeOf(s), flag: flagOf(s), img: p.file, n: p.titel,
  })))
  DECKS['gg-poller'] = sortByGroup(cards, GORDER)
  META['gg-poller'] = {
    kind: 'words', withFlags: true, noWrite: true, imgDeck: true, ask: 'Aus welchem Land ist dieser Poller?',
    groups: groupsFrom(GORDER.filter(g => cards.some(c => c.g === g)), D.GRUPPEN),
    tips: [
      'Achte zuerst auf die Farbe des Reflektors: rot (Balkan, Italien, Niederlande), orange (Tschechien, Slowakei, Litauen), gelb (Belgien, Dänemark), weiß oder grau (Deutschland, Schweiz, Schweden).',
      'Dann auf Form und Kopf: dreieckig mit schwarzer Spitze (Italien), runde spitze Kappe (Frankreich), dünn und gebogen (Norwegen, Lettland).',
      'Eigene Zeichnungen nach den Beschreibungen in den Guides – echte Poller sehen ähnlich, aber nicht exakt so aus.',
    ],
  }
}
// Wegweiser (eigene Zeichnungen, Ortsnamen als Balken)
{
  const cards = SLUGS.flatMap(s => ZEICH[s].wegweiser.map((w, i) => ({
    key: `gg-wegweiser:${s}-${i}`, c: `Wegweiser ${nameOf(s)} ${i + 1}`, a: nameOf(s), g: gruppeOf(s), flag: flagOf(s), img: w.anonym, n: w.titel,
  })))
  DECKS['gg-wegweiser'] = sortByGroup(cards, GORDER)
  META['gg-wegweiser'] = {
    kind: 'words', withFlags: true, noWrite: true, imgDeck: true, ask: 'Aus welchem Land ist dieser Wegweiser?',
    groups: groupsFrom(GORDER.filter(g => cards.some(c => c.g === g)), D.GRUPPEN),
    tips: [
      'Gelb: Deutschland, Luxemburg, Norwegen, Island, Färöer und der Balkan (Slowenien, Kroatien, Serbien, Montenegro, Nordmazedonien).',
      'Grün: Polen und Ungarn (normale Straßen), Italien nur an Autobahnen. Blau: Baltikum, Skandinavien außer Norwegen, Tschechien, Italien, Rumänien.',
      'Zwei Zeilen pro Ziel: Bulgarien, Serbien, Nordmazedonien, Ukraine (Kyrillisch + Latein) und Griechenland, Zypern (Griechisch + Englisch).',
      'Die Ortsnamen sind hier verdeckt – sonst wäre es zu leicht. Eigene Zeichnungen, Formen vereinfacht.',
    ],
  }
}
// Hinweis → Land (alle mittleren und starken Hinweise)
{
  const cards = []
  for (const s of SLUGS) {
    LAND[s].hinweise.forEach((h, i) => {
      if (h.staerke < 2 || OHNE_KAT.includes(h.kat) || verraet(s, h.titel, h.region)) return
      cards.push({
        key: `gg-hw:${s}:${i}`, c: h.titel, a: nameOf(s), g: h.kat, flag: flagOf(s),
        n: h.region ? `${h.text} (${h.region})` : h.text,
        near: h.compare.length ? h.compare.map(nameOf) : undefined,
      })
    })
  }
  DECKS['gg-hinweise'] = sortByGroup(cards, KAT_ORDER)
  META['gg-hinweise'] = {
    kind: 'words', withFlags: true, noWrite: true, ask: 'Welches Land?',
    groups: groupsFrom(KAT_ORDER.filter(k => cards.some(c => c.g === k)), D.KATEGORIEN),
    tips: [
      'Am meisten bringen Poller, Kennzeichen, Schilder und Linien – die sieht man fast in jeder Runde.',
      'Erst eine Kategorie lernen (z. B. Poller), dann die nächste. Die Lernkartei fragt jeden Tag nur das Fällige ab.',
      'Zu jedem Land gibt es einen ausführlichen Steckbrief mit allen Hinweisen.',
    ],
  }
}
// Rate das Land: drei Hinweise → Land
{
  const cards = []
  for (const s of SLUGS) {
    const pool = LAND[s].hinweise.filter(h => h.staerke >= 2 && !h.region && ![...OHNE_KAT, 'abdeckung', 'kamera', 'telefon-domain'].includes(h.kat) && !verraet(s, h.titel, h.region))
    const cats = [...new Set(pool.map(h => h.kat))]
    if (pool.length < 3 || cats.length < 2) continue
    const r = rng(`rate:${s}`)
    const seen = new Set()
    const want = Math.min(5, Math.max(2, Math.floor(pool.length / 4)))
    for (let t = 0; t < 40 && cards.filter(c => c.a === nameOf(s)).length < want; t++) {
      const picks = []
      for (const h of shuffleWith(pool, r)) {
        if (picks.length === 3) break
        if (picks.some(p => p.kat === h.kat)) continue
        picks.push(h)
      }
      if (picks.length < 3) {
        for (const h of shuffleWith(pool, r)) { if (picks.length === 3) break; if (!picks.includes(h)) picks.push(h) }
      }
      const id = picks.map(p => pool.indexOf(p)).sort((a, b) => a - b).join('-')
      if (seen.has(id) || picks.length < 3) continue
      seen.add(id)
      cards.push({
        key: `gg-rate:${s}:${id}`, c: picks.map(p => p.titel).join('\n'), a: nameOf(s), g: gruppeOf(s), flag: flagOf(s),
        n: picks.map(p => p.text).join(' · '),
      })
    }
  }
  DECKS['gg-rate-das-land'] = sortByGroup(cards, GORDER)
  META['gg-rate-das-land'] = {
    kind: 'words', withFlags: true, noWrite: true, multiline: true, ask: 'Drei Hinweise – welches Land?',
    groups: groupsFrom(GORDER.filter(g => cards.some(c => c.g === g)), D.GRUPPEN),
    tips: [
      'Wie in einer echten Runde: mehrere kleine Hinweise zusammen ergeben das Land.',
      'Schließe zuerst aus, was nicht passen kann – Fahrseite, Schrift, Kennzeichen-Farbe.',
    ],
  }
}
write('public/geo/items/gg-karten.json', JSON.stringify({ ...DECKS, _meta: META }))

/* ───────────── Karten-Quizzes ───────────── */

const EU = readJson(path.join(root, 'public/geo/items/europa.json'))
const ORTE = {}
const byLabel = (slug, label) => {
  const it = EU[slug].find(x => x.label === label)
  if (!it) throw new Error(`${slug}: „${label}“ nicht gefunden`)
  return it
}
const codesText = cs => cs.join(' · ')

ORTE['gg-ru-kennzeichen'] = D.RU_CODES.map(([label, codes]) => {
  const it = byLabel('ru-subjekte', label)
  const cs = codes.split(',')
  return {
    key: `gg-ru:${it.key.split(':')[1]}`, label, prompt: codesText(cs), promptSub: 'Region mit diesem Kennzeichen-Code',
    group: it.group, areas: it.areas, aliases: [],
    details: [{ label: 'Kennzeichen-Code', value: codesText(cs), big: true }, ...(it.details ?? []).filter(d => d.label === 'Föderationskreis')],
    text: { prompt: `Kennzeichen-Code ${codesText(cs)}`, sub: 'Welche Region?', answer: label },
  }
})
ORTE['gg-pl-kennzeichen'] = D.PL_CODES.map(([label, code]) => {
  const it = byLabel('pl-woiwodschaften', label)
  return {
    key: `gg-pl:${it.key.split(':')[1]}`, label, prompt: code, promptSub: 'Woiwodschaft mit diesem Anfangsbuchstaben',
    group: it.group, areas: it.areas, details: [{ label: 'Kennzeichen beginnt mit', value: code, big: true }, ...(it.details ?? [])],
    text: { prompt: `Kennzeichen beginnt mit ${code}`, sub: 'Welche Woiwodschaft?', answer: label },
  }
})
ORTE['gg-ua-kennzeichen'] = Object.entries(D.UA_CODES).map(([id, codes]) => {
  const it = EU['ua-oblaste'].find(x => x.key === `ua-oblaste:${id}`)
  if (!it) throw new Error(`ua-oblaste: ${id}`)
  const cs = codes.split(',')
  return {
    key: `gg-ua:${id}`, label: it.label, prompt: codesText(cs), promptSub: 'Oblast mit diesen Kennzeichen-Buchstaben',
    group: it.group, areas: it.areas, details: [{ label: 'Kennzeichen beginnt mit', value: codesText(cs), big: true }],
    text: { prompt: `Kennzeichen beginnt mit ${codesText(cs)}`, sub: 'Welche Oblast?', answer: it.label },
  }
})

// Merkmals-Karten: Länder Europas nach einem Merkmal gefärbt
function merkmalKarte(key, frage) {
  return SLUGS.filter(s => LAND[s].iso3 && LAND[s].merkmale[key]).map(s => {
    const v = LAND[s].merkmale[key]
    const vn = D.WERT_NAMEN[v] ?? v
    return {
      key: `gg-${key}:${LAND[s].iso3}`, label: nameOf(s), group: v.replace(/[^a-z]/g, '') || 'x', areas: [`world:${LAND[s].iso3}`], flag: flagOf(s),
      details: [{ label: D.MERKMALE[key][0], value: vn, big: true }],
      text: { prompt: `${frage} ${nameOf(s)}?`, answer: vn },
    }
  })
}
ORTE['gg-ortsschild-karte'] = merkmalKarte('ortsschild_hintergrund', 'Welche Farbe hat das Ortsschild in')
ORTE['gg-wegweiser-karte'] = merkmalKarte('wegweiser', 'Welche Farbe haben die Wegweiser in')
ORTE['gg-kennzeichen-karte'] = merkmalKarte('kennzeichen_hinten', 'Welche Farbe hat das hintere Kennzeichen in')
ORTE['gg-linien-karte'] = merkmalKarte('linienfarbe', 'Welche Linienfarben gibt es in')
write('public/geo/items/gg-orte.json', JSON.stringify(ORTE))

/* ───────────── Quellen ───────────── */

const credits = [
  'GeoGuessr Europa (seekclan.de/geo) – Quellen und Lizenzen', '',
  'HINWEISE JE LAND',
  'Fakten aus dem Plonk-It-Guide (https://www.plonkit.net/guide), Lizenz CC BY-NC-SA 4.0 (https://creativecommons.org/licenses/by-nc-sa/4.0/deed.de),',
  'und aus „GeoGuessr – The Top Tips, Tricks and Techniques“ (https://somerandomstuff1.wordpress.com).',
  'Alle Texte sind auf Deutsch neu formuliert und gekürzt. Diese Texte stehen ebenfalls unter CC BY-NC-SA 4.0.', '',
  'VERKEHRSZEICHEN (Ortsschilder, Zebrastreifen) – Wikimedia Commons',
  'Datei hier | Datei auf Commons | Lizenz | Urheber',
  ...SCHILDER.map(s => `schilder/${s.name} | https://commons.wikimedia.org/wiki/${encodeURIComponent(s.commons.replace(/ /g, '_'))} | ${s.lizenz} | ${s.urheber}`), '',
  'STRASSENNUMMERN-SCHILDER: eigene Grafiken (seekclan.de). Farben nach der Karte „Road numbering signs in Europe“ (u/Melongated) und den Guides.', '',
  'KENNZEICHEN-CODES (Russland, Polen, Ukraine): Wikidata, Eigenschaft P395 (CC0).', '',
  'ORTSSCHILD-FARBEN: Vergleichsgrafik „Comparison of locality signs“ (europamapas) und die offiziellen Zeichen auf Commons.', '',
  'POLLER, WEGWEISER, FAHRBAHN-LINIEN: eigene Zeichnungen (seekclan.de) nach den Beschreibungen in den Hinweisen oben (Plonk It, CC BY-NC-SA 4.0).',
  'Ortsnamen auf den Wegweisern sind echte Orte, die Entfernungen sind Beispiele. Linienfarben zusätzlich nach Wikipedia „Road surface marking“',
  '(https://en.wikipedia.org/wiki/Road_surface_marking, CC BY-SA 4.0): Irland, Niederlande, Norwegen, Finnland, Vereinigtes Königreich und',
  '„Most European countries reserve white for routine lane markings“ – daher sind Linien ohne Farbangabe weiß gezeichnet.',
]
write('public/geo/gg/QUELLEN.txt', credits.join('\n') + '\n')

/* ───────────── TypeScript-Daten ───────────── */

const counts = { ...Object.fromEntries(Object.entries(DECKS).map(([k, v]) => [k, v.length])), ...Object.fromEntries(Object.entries(ORTE).map(([k, v]) => [k, v.length])) }
const colorOf = { 'weiß': '#e8e4da', 'gelb': '#f2c230', 'blau': '#3d74d0', 'grün': '#2f9b5f', 'rot': '#d14b4b', 'schwarz': '#555555', 'gemischt': '#9a8fb5', 'rechts': '#5b9bd5', 'links': '#e07a5f',
  'gelb-mitte': '#f3a51c', 'weiß+gelb': '#c9c37a', 'gelb-rand': '#e8d64a' }
const groupsFor = key => Object.fromEntries(D.MERKMALE[key][1].filter(v => SLUGS.some(s => LAND[s].iso3 && LAND[s].merkmale[key] === v))
  .map(v => [v.replace(/[^a-z]/g, '') || 'x', { name: D.WERT_NAMEN[v] ?? v, color: colorOf[v] ?? '#888888' }]))
const ts = `// Erzeugt von scripts/geo/build-gg.mjs – nicht von Hand ändern.
export const GG_COUNTS: Record<string, number> = ${JSON.stringify(counts, null, 2)}

/** Länder mit Steckbrief: [slug, Name, Flagge, Gruppe] */
export const GG_LAENDER: [string, string, string, string][] = ${JSON.stringify(SLUGS.map(s => [s, nameOf(s), flagOf(s), gruppeOf(s)]))}

export const GG_GRUPPEN: Record<string, string> = ${JSON.stringify(D.GRUPPEN, null, 2)}

/** Farben der Merkmals-Karten */
export const GG_MERKMAL_GROUPS: Record<string, Record<string, { name: string; color: string }>> = ${JSON.stringify({
  'gg-ortsschild-karte': groupsFor('ortsschild_hintergrund'), 'gg-wegweiser-karte': groupsFor('wegweiser'), 'gg-kennzeichen-karte': groupsFor('kennzeichen_hinten'),
  'gg-linien-karte': groupsFor('linienfarbe'),
}, null, 2)}
`
write('app/geo/_data/gg.ts', ts)

console.log('Länder', SLUGS.length, '· Hinweise', SLUGS.reduce((n, s) => n + LAND[s].hinweise.length, 0))
console.log(Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(' · '))
