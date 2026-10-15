// Baut „GeoGuessr Südamerika“ von seekclan.de/geo: Länder-Steckbriefe, Bild-Galerien, Lernkarten und Karten-Quizzes.
//
// Nur für Entwicklung – wird NICHT beim normalen `npm run build` ausgeführt. Das Ergebnis liegt fertig im Repo.
// Braucht nur Dateien aus dem Repo:
//   scripts/geo/gg-sa/<slug>.json         Hinweise je Land (Fakten aus Plonk It, CC BY-NC-SA 4.0 – auf Deutsch neu formuliert)
//   scripts/geo/gg-sa-daten.mjs           Von Hand: Länder, Merkmale, Vorwahlen/Domains, Taxis Argentinien, Straßenbuchstaben Chile, Pflanzen
//   scripts/geo/gg-sa-zeichnungen.mjs     Von Hand: Kennzeichen, Taxis, Poller, Kilometersteine, Masten, Schilder, Zäune, Linien (eigene Zeichnungen)
//   scripts/geo/gg-sa-pflanzen.json       Herkunft der Pflanzen-Fotos (Wikimedia Commons, Lizenz, Urheber) – Fotos in public/geo/gg-sa/pflanzen/
//   scripts/geo/sa-daten.mjs              Namen der Regionen Chiles (für die Karte der Straßenbuchstaben)
// Erzeugt:
//   public/geo/gg-sa/index.json, laender/<slug>.json, <art>/*.svg, QUELLEN.txt
//   public/geo/items/gg-sa-karten.json    Lernkarten (special 'schrift')
//   public/geo/items/gg-sa-orte.json      Karten-Quizzes (Taxis Argentinien, Straßenbuchstaben Chile, Merkmals-Karten)
//   app/geo/_data/gg-sa.ts                Anzahl Einträge je Quiz + Länderliste
// Danach:  node scripts/geo/build-gg-sa.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as D from './gg-sa-daten.mjs'
import * as Z from './gg-sa-zeichnungen.mjs'
import * as S from './sa-daten.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const OUT = 'public/geo/gg-sa'
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'))
const write = (p, s) => { fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true }); fs.writeFileSync(path.join(root, p), s) }
const clean = s => String(s ?? '').replace(/\s+/g, ' ').trim()
const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const SLUGS = Object.keys(D.LAENDER)
const nameOf = s => D.LAENDER[s]?.[0] ?? s
const flagOf = s => D.LAENDER[s]?.[2]
const gruppeOf = s => D.LAENDER[s]?.[3]
const GORDER = Object.keys(D.GRUPPEN)
const KAT_ORDER = Object.keys(D.KATEGORIEN)

function rng(seed) {
  let h = 2166136261
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296 }
}
const shuffleWith = (arr, r) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }

/* ───────────── Länder einlesen ───────────── */

const LAND = {}
for (const s of SLUGS) {
  const file = path.join(here, 'gg-sa', `${s}.json`)
  if (!fs.existsSync(file)) throw new Error(`Fehlt: scripts/geo/gg-sa/${s}.json`)
  const d = readJson(file)
  const code = D.CODES.find(c => c[1] === flagOf(s))
  const hinweise = (d.hinweise ?? [])
    .filter(h => h && h.titel && h.text && D.KATEGORIEN[h.kat])
    .map(h => ({
      kat: h.kat, titel: clean(h.titel), text: clean(h.text),
      staerke: [1, 2, 3].includes(h.staerke) ? h.staerke : 1,
      region: h.region ? clean(h.region) : undefined,
      compare: (h.compare ?? []).filter(c => D.LAENDER[c] && c !== s),
      src: 'p',
    }))
  // Vorwahl und Domain (allgemein bekannt)
  if (code) hinweise.push({ kat: 'telefon-domain', titel: `Vorwahl ${code[2]}, Domain ${code[3]}`, text: `Telefonnummern beginnen international mit ${code[2]}, Webseiten enden auf ${code[3]} – auf Werbeplakaten und Lieferwagen gut zu sehen.`, staerke: 3, compare: [], src: 'a' })
  hinweise.sort((a, b) => KAT_ORDER.indexOf(a.kat) - KAT_ORDER.indexOf(b.kat) || b.staerke - a.staerke)
  const m = d.merkmale ?? {}
  LAND[s] = {
    slug: s, name: nameOf(s), iso3: D.LAENDER[s][1], flag: flagOf(s), gruppe: gruppeOf(s), kurz: clean(d.kurz),
    sprachen: m.sprachen ?? [], merkmale: Object.fromEntries(Object.keys(D.MERKMALE).map(k => [k, D.MERKMAL[s]?.[k] ?? null])), hinweise,
    info: {
      kennzeichen: m.kennzeichen ?? null, poller: m.poller ?? null, strommasten: m.strommasten ?? null, google_auto: m.google_auto ?? null,
      chevron: m.chevron ?? null, landschaft: m.landschaft ?? null, klima: m.klima ?? null,
      vorwahl: code ? `${code[2]} · Domain ${code[3]}` : null,
    },
  }
}

/* ───────────── Zeichnungen ───────────── */

const ARTEN = [
  // key, Ordner, Name, Daten, Zeichner
  ['kennzeichen', 'Kennzeichen', Z.KENNZEICHEN, k => Z.kennzeichenSvg(k)],
  ['poller', 'Poller', Z.POLLER, (p, id) => Z.pollerSvg(p, id)],
  ['km', 'Kilometersteine', Z.KM, k => Z.kmSvg(k)],
  ['masten', 'Strommasten', Z.MASTEN, m => Z.mastSvg(m)],
  ['schilder', 'Chevrons & Leitplanken', Z.SCHILDER, s => Z.schildSvg(s)],
  ['linien', 'Fahrbahn-Linien', Z.LINIEN, l => Z.linienSvg(l)],
  ['zaeune', 'Zäune & Mauern', Z.ZAEUNE, z => Z.zaunSvg(z)],
  ['taxis', 'Taxis', Z.TAXIS, t => (t.moto ? Z.mototaxiSvg(t.moto.farbe, t.moto.offen) : Z.taxiSvg(t.auto))],
]
const BILD = {}
for (const s of SLUGS) BILD[s] = {}
for (const [art, , daten, zeichne] of ARTEN) {
  fs.rmSync(path.join(root, OUT, art), { recursive: true, force: true })
  for (const [s, list] of Object.entries(daten)) {
    if (!D.LAENDER[s]) throw new Error(`gg-sa-zeichnungen.mjs ${art}: unbekanntes Land ${s}`)
    BILD[s][art] = list.map((x, i) => {
      const file = `/geo/gg-sa/${art}/${s}-${i}.svg`
      write(`public${file}`, zeichne(x, `${s}-${i}`))
      return { file, titel: x.titel }
    })
  }
}
// Taxis Argentinien je Stadt
const AR_TAXI_BILDER = D.AR_TAXIS.map(([stadt, prov, , , text, , auto]) => {
  const file = `/geo/gg-sa/taxis/ar-${slug(stadt)}.svg`
  write(`public${file}`, Z.taxiSvg(auto))
  return { stadt, prov, text, file }
})
for (const [stadt, auto, text] of D.AR_TAXI_EXTRA) {
  const file = `/geo/gg-sa/taxis/ar-${slug(stadt)}-2.svg`
  write(`public${file}`, Z.taxiSvg(auto))
  AR_TAXI_BILDER.push({ stadt, prov: D.AR_TAXIS.find(t => t[0] === stadt)?.[1], text, file })
}
BILD['argentina'].taxis = AR_TAXI_BILDER.map(t => ({ file: t.file, titel: `${t.stadt}: ${t.text}` }))

// Pflanzen (Fotos)
const PF_QUELLEN = readJson(path.join(here, 'gg-sa-pflanzen.json'))
for (const k of Object.keys(D.PFLANZEN)) {
  if (!fs.existsSync(path.join(root, OUT, 'pflanzen', `${k}.jpg`))) throw new Error(`Foto fehlt: ${k}.jpg`)
  if (!PF_QUELLEN[k]) throw new Error(`Quelle fehlt: ${k}`)
}
for (const [k, [name, , laender, wo]] of Object.entries(D.PFLANZEN)) {
  for (const s of laender) (BILD[s].pflanzen ??= []).push({ file: `/geo/gg-sa/pflanzen/${k}.jpg`, titel: `${name} – ${wo}` })
}

const GALERIEN = [
  { key: 'kennzeichen', label: 'Kennzeichen', quiz: 'gg-sa-kennzeichen', text: 'Buchstaben und Zahlen sind ausgedachte Beispiele – Farben, Balken und Format stimmen.' },
  { key: 'taxis', label: 'Taxis', quiz: 'gg-sa-taxis-argentinien', text: 'Taxis verraten oft sogar die Stadt – besonders in Argentinien.' },
  { key: 'poller', label: 'Poller', quiz: 'gg-sa-poller', text: 'In Südamerika sind Poller seltener als in Europa – umso mehr verraten sie.' },
  { key: 'km', label: 'Kilometersteine', quiz: 'gg-sa-poller', text: 'Kilometersteine und Straßenmarker am Rand – oft mit Straßennummer.' },
  { key: 'masten', label: 'Strommasten', quiz: 'gg-sa-masten', text: 'Leiter, Einbuchtung, Dreizack oder Streifen: Masten sieht man in fast jeder Runde.' },
  { key: 'schilder', label: 'Chevrons & Leitplanken', quiz: 'gg-sa-schilder', text: 'Chevrons, Leitplanken, Schild-Rückseiten und Pfosten.' },
  { key: 'linien', label: 'Linien', quiz: 'gg-sa-linien', text: 'Ein Stück Straße von oben: Mittellinie und Ränder.' },
  { key: 'zaeune', label: 'Zäune & Mauern', quiz: 'gg-sa-zaeune', text: 'Holzzäune, Lehmmauern und bunte Tore.' },
  { key: 'pflanzen', label: 'Pflanzen (Fotos)', quiz: 'gg-sa-pflanzen', text: 'Palmen, Kakteen, Bäume und Felder – Fotos von Wikimedia Commons.' },
]

/* ───────────── Übersicht + Steckbriefe ───────────── */

const sprachErkennung = [
  { sprache: 'Portugiesisch (Brasilien)', laender: ['brazil'], zeichen: ['ã', 'õ', 'ç', 'lh', 'nh'], text: 'Endungen auf -ão und -ões, „Rua“ und „Avenida“, „Rodovia“ statt „Ruta“.' },
  { sprache: 'Spanisch', laender: SLUGS.filter(s => D.MERKMAL[s]?.sprache === 'spanisch'), zeichen: ['ñ', 'll', '¿', '¡'], text: '„Calle“, „Carrera“ (Kolumbien), „Ruta“, „Avenida“. Kein ã oder ç.' },
  { sprache: 'Englisch', laender: ['falkland-islands'], zeichen: [], text: 'Auf den Falklandinseln – dazu Linksverkehr.' },
]
const vergleiche = [
  { thema: 'chevron', titel: 'Chevrons: drei Farben', text: 'Weiß mit roten Pfeilen gibt es nur in Argentinien, schwarz mit gelbem Pfeil nur in Brasilien – sonst gelb mit schwarzen Pfeilen.', laender: ['argentina', 'brazil', 'chile', 'uruguay'], werte: { argentina: 'weiß-rot', brazil: 'schwarz-gelb', chile: 'gelb-schwarz', uruguay: 'gelb-schwarz' } },
  { thema: 'kennzeichen', titel: 'Gelbe Kennzeichen', text: 'Gelb ist in Kolumbien normal, in Peru selten. Orange: Taxis in Chile und Ecuador. Rot: Nutzfahrzeuge in Brasilien.', laender: ['colombia', 'peru', 'chile', 'ecuador', 'brazil'], werte: { colombia: 'gelb', peru: 'weiß, selten gelb', chile: 'orange bei Taxis', ecuador: 'orange bei Taxis', brazil: 'rot bei Nutzfahrzeugen' } },
  { thema: 'leitplanke', titel: 'Leitplanken: Peru oder Bolivien?', text: 'Beide haben schräge schwarz-gelbe Streifen. In Bolivien ist der äußere Streifen gelb, in Peru schwarz.', laender: ['bolivia', 'peru'], werte: { bolivia: 'außen gelb', peru: 'außen schwarz' } },
  { thema: 'auto', titel: 'Schwarzes Google-Auto (Gen 3)', text: 'Schwarz: Argentinien, Uruguay, Peru. Weiß ohne Antenne: Chile, Bolivien, Peru.', laender: ['argentina', 'uruguay', 'peru', 'chile', 'bolivia'], werte: { argentina: 'schwarz', uruguay: 'schwarz', peru: 'schwarz oder weiß', chile: 'weiß', bolivia: 'weiß' } },
  { thema: 'linien', titel: 'Linien: Chile, Uruguay, Argentinien', text: 'Chile: alles weiß oder alles gelb, nie gemischt. Uruguay: dreifache Mitte. Argentinien: weiß gestrichelt oder doppelt gelb.', laender: ['chile', 'uruguay', 'argentina'], werte: {} },
]

const INDEX = {
  region: 'suedamerika',
  gruppen: D.GRUPPEN, kategorien: D.KATEGORIEN,
  merkmale: Object.fromEntries(Object.entries(D.MERKMALE).map(([k, [name, werte]]) => [k, { name, werte }])),
  wertNamen: D.WERT_NAMEN, trainKeys: D.TRAIN_KEYS, galerien: GALERIEN,
  laender: SLUGS.map(s => {
    const l = LAND[s]
    return {
      slug: s, name: l.name, flag: l.flag, gruppe: l.gruppe, iso3: l.iso3, kurz: l.kurz, sprachen: l.sprachen, merkmale: l.merkmale,
      anzahl: l.hinweise.length, stark: l.hinweise.filter(h => h.staerke === 3).length,
      orts: [], zebra: [], strassen: [], poller: [], wegweiser: [], linien: [],
      titelbild: BILD[s].kennzeichen?.[0]?.file ?? null,
      galerie: BILD[s],
    }
  }),
  vergleiche, sprachErkennung,
}
fs.rmSync(path.join(root, OUT, 'laender'), { recursive: true, force: true })
write(`${OUT}/index.json`, JSON.stringify(INDEX))
for (const s of SLUGS) {
  const l = LAND[s]
  write(`${OUT}/laender/${s}.json`, JSON.stringify({
    ...INDEX.laender.find(x => x.slug === s), info: l.info,
    hinweise: l.hinweise.map(h => ({ ...h, compare: h.compare.length ? h.compare : undefined })),
  }))
}

/* ───────────── Lernkarten ───────────── */

const ADJ = { argentina: 'argentin', chile: 'chilen', uruguay: 'urugua', brazil: 'brasil', colombia: 'kolumbian', ecuador: 'ecuadorian', peru: 'peruan', bolivia: 'bolivian', 'falkland-islands': 'falkland' }
const verraet = (s, titel, region) => {
  const t = titel.toLowerCase()
  if (t.includes(nameOf(s).toLowerCase()) || t.includes(ADJ[s])) return true
  return !!region && region.toLowerCase().split(/[^a-zäöüßéèáíóúçñõãâêôåøæ-]+/).some(w => w.length >= 5 && t.includes(w.slice(0, -1)))
}
const DECKS = {}, META = {}
const groupsFrom = (keys, names) => [...new Set(keys)].map(k => ({ k, name: names[k] ?? k }))
const sortByGroup = (cards, order) => cards.sort((a, b) => order.indexOf(a.g) - order.indexOf(b.g) || a.a.localeCompare(b.a, 'de'))
const landGroups = cards => groupsFrom(GORDER.filter(g => cards.some(c => c.g === g)), D.GRUPPEN)

function bildDeck(slugName, arten, ask, tips, label, nur = () => true) {
  const cards = SLUGS.flatMap(s => arten.flatMap(art => (BILD[s][art] ?? []).filter(b => nur(s, b)).map((b, i) => ({
    key: `${slugName}:${s}-${art}-${i}`, c: `${label} ${nameOf(s)} ${i + 1}`, a: nameOf(s), g: gruppeOf(s), flag: flagOf(s), img: b.file, n: b.titel,
  }))))
  DECKS[slugName] = sortByGroup(cards, GORDER)
  META[slugName] = { kind: 'words', withFlags: true, noWrite: true, imgDeck: true, ask, groups: landGroups(cards), tips }
}
bildDeck('gg-sa-kennzeichen', ['kennzeichen'], 'Aus welchem Land ist dieses Kennzeichen?', [
  'Weiß mit blauem Balken oben (Mercosur): Argentinien, Brasilien, Uruguay. Schwarz: altes argentinisches Kennzeichen.',
  'Gelb: Kolumbien (Peru selten). Orange: Taxis in Chile und Ecuador. Rot: Nutzfahrzeuge in Brasilien.',
  'Bolivien: kurz, weiß, blaue Schrift. Ecuador: kurze und lange weiße Schilder gemischt.',
  'Buchstaben und Zahlen sind ausgedachte Beispiele – eigene Zeichnungen.',
], 'Kennzeichen')
bildDeck('gg-sa-poller', ['poller', 'km'], 'Aus welchem Land ist dieser Poller oder Kilometerstein?', [
  'Ecuador hat viele Poller mit Rot. Uruguay: weiß mit gelber Seite. Peru: dreieckige Betonpoller in Rot oder Gelb.',
  'Kilometersteine: Argentinien weiß mit schwarzem Streifen und RN-Nummer, Bolivien oben schwarz mit „Km“, Kolumbien grün mit „Pr“, Brasilien blau.',
  'Eigene Zeichnungen nach den Hinweisen – echte Poller sehen ähnlich, aber nicht exakt so aus.',
], 'Poller')
bildDeck('gg-sa-masten', ['masten'], 'Aus welchem Land ist dieser Strommast?', [
  'Leitermast (lange Aussparungen unten): Brasilien. Viele kleine Kerben wie Sprossen: Ecuador. Einbuchtung: Chile.',
  'Dreizack: Uruguay. A-Form aus Holz: Argentinien. Schwarz-gelb gestreift: Kolumbien (oben) und Peru (unten).',
  'Eigene Zeichnungen, vereinfacht.',
], 'Mast')
bildDeck('gg-sa-schilder', ['schilder'], 'Aus welchem Land ist das?', [
  'Chevron weiß-rot: Argentinien. Schwarz-gelb: Brasilien. Gelb-schwarz: fast alle anderen.',
  'Leitplanken mit schrägen Streifen: außen gelb = Bolivien, außen schwarz = Peru.',
  'Schwarz-weiß gestreifter Schildpfosten: Peru. Türkisblaue Rückseite: Ecuador.',
], 'Schild')
bildDeck('gg-sa-linien', ['linien'], 'Aus welchem Land sind diese Linien?', [
  'Alles weiß oder alles gelb, nie gemischt: Chile. Dreifache Mitte: Uruguay.',
  'Weiße Ränder ohne Mittellinie auf Bergstraßen: Peru.',
], 'Linien')
bildDeck('gg-sa-zaeune', ['zaeune'], 'Aus welchem Land ist das?', [
  'Holzzäune und bemalte spitze Pfähle: Kolumbien. Lehmmauer mit Dreiecken: San Pedro de Atacama (Chile).',
], 'Zaun')

// Taxis Argentinien: Bild → Stadt
{
  const TG = { schwarz: 'schwarz', rot: 'rot', weiss: 'weiß', gruen: 'grün', gelb: 'gelb' }
  const cards = AR_TAXI_BILDER.map((t, i) => {
    const grp = D.AR_TAXIS.find(x => x[0] === t.stadt)?.[5] ?? 'weiss'
    return { key: `gg-sa-taxi-ar:${i}`, c: `Taxi ${i + 1}`, a: t.stadt, g: grp, img: t.file, n: `${t.text} (Provinz ${t.prov})` }
  })
  DECKS['gg-sa-taxis-argentinien'] = cards
  META['gg-sa-taxis-argentinien'] = {
    kind: 'words', noWrite: true, imgDeck: true, ask: 'In welcher Stadt fährt dieses Taxi?',
    groups: Object.entries(TG).filter(([k]) => cards.some(c => c.g === k)).map(([k, name]) => ({ k, name })),
    tips: [
      'Schwarz mit gelbem Dach: Buenos Aires, Rosario, Mendoza. Weiß mit gelbem Dach: San Juan.',
      'Ganz schwarz: Jujuy. Rot: Salta. Gelb: Neuquén. Grün: Córdoba.',
      'Mendoza, Rosario und Buenos Aires sehen gleich aus – dann helfen Landschaft (Berge = Mendoza) und Stadtbild.',
      'Nach der Plonk-It-Karte „Argentina Taxi Map“. Eigene Zeichnungen – das Auto ist beliebig, nur die Farben stimmen.',
    ],
  }
}
// Taxis & Mototaxis: Bild → Land
bildDeck('gg-sa-taxis', ['taxis'], 'Aus welchem Land ist dieses Taxi?', [
  'Pastellgelb mit weißem Kennzeichen: Kolumbien. Kräftig gelb mit orangem Kennzeichen: Ecuador.',
  'Rot-weiße Streifen an der Seite und viele Mototaxis: Peru.',
  'Argentinien hat in fast jeder Stadt eigene Taxi-Farben – siehe eigenes Quiz.',
], 'Taxi', (s, b) => s !== 'argentina' || b.titel.startsWith('Buenos Aires'))
// Pflanzen: Foto → Name
{
  const cards = Object.entries(D.PFLANZEN).map(([k, [name, wiss, laender, wo, erkennen]]) => ({
    key: `gg-sa-pf:${k}`, c: wiss, a: name, g: laender.includes('brazil') && laender.length === 1 ? 'brasilien' : laender.every(s => gruppeOf(s) === 'anden') ? 'anden' : 'cono',
    img: `/geo/gg-sa/pflanzen/${k}.jpg`, n: `${erkennen}. Wo: ${wo}`,
  }))
  DECKS['gg-sa-pflanzen'] = sortByGroup(cards, GORDER)
  META['gg-sa-pflanzen'] = {
    kind: 'words', noWrite: true, imgDeck: true, ask: 'Welche Pflanze ist das?',
    groups: [{ k: 'cono', name: 'Argentinien, Chile, Uruguay' }, { k: 'brasilien', name: 'Brasilien' }, { k: 'anden', name: 'Andenländer' }].filter(g => cards.some(c => c.g === g.k)),
    tips: [
      'Palmen in Brasilien: Carnaúba (Fächer, Nordosten), Babassu und Açaí (Amazonas), Macaúba (Mitte).',
      'Araukarien: die chilenische im Süden der Anden, die Paraná-Kiefer im Süden Brasiliens.',
      'Fotos von Wikimedia Commons (freie Lizenzen) – nicht alle wurden in Südamerika aufgenommen. Quellen: /geo/gg-sa/QUELLEN.txt',
    ],
  }
}
// Vorwahlen & Domains
for (const [slugName, idx, ask, label] of [['gg-sa-vorwahlen', 2, 'Welches Land hat diese Vorwahl?', 'Vorwahl'], ['gg-sa-domains', 3, 'Zu welchem Land gehört diese Domain?', 'Domain']]) {
  const cards = D.CODES.map(c => ({ key: `${slugName}:${c[1]}`, c: c[idx], a: c[0], g: 'alle', flag: c[1], n: `${label} ${c[idx]}` }))
  DECKS[slugName] = cards
  META[slugName] = { kind: 'words', withFlags: true, big: true, ask, groups: [{ k: 'alle', name: 'Südamerika' }], tips: idx === 2
    ? ['+5x: die großen Länder (54 Argentinien, 55 Brasilien, 56 Chile, 57 Kolumbien, 58 Venezuela, 51 Peru).', '+59x: die kleineren (591 Bolivien, 593 Ecuador, 595 Paraguay, 598 Uruguay).']
    : ['Fast immer die ersten zwei Buchstaben des Landes – Achtung: .co ist Kolumbien, .cl Chile.'] }
}
// Hinweis → Land
{
  const cards = []
  for (const s of SLUGS) LAND[s].hinweise.forEach((h, i) => {
    if (h.staerke < 2 || ['sprache', 'telefon-domain', 'fahrseite'].includes(h.kat) || verraet(s, h.titel, h.region)) return
    cards.push({ key: `gg-sa-hw:${s}:${i}`, c: h.titel, a: nameOf(s), g: h.kat, flag: flagOf(s), n: h.region ? `${h.text} (${h.region})` : h.text, near: h.compare.length ? h.compare.map(nameOf) : undefined })
  })
  DECKS['gg-sa-hinweise'] = sortByGroup(cards, KAT_ORDER)
  META['gg-sa-hinweise'] = {
    kind: 'words', withFlags: true, noWrite: true, ask: 'Welches Land?', groups: groupsFrom(KAT_ORDER.filter(k => cards.some(c => c.g === k)), D.KATEGORIEN),
    tips: ['Am meisten bringen Kennzeichen, Masten, Linien und das Google-Auto.', 'Zu jedem Land gibt es einen Steckbrief mit allen Hinweisen.'],
  }
}
// Rate das Land
{
  const cards = []
  for (const s of SLUGS) {
    const pool = LAND[s].hinweise.filter(h => h.staerke >= 2 && !h.region && !['sprache', 'telefon-domain', 'fahrseite', 'abdeckung', 'kamera'].includes(h.kat) && !verraet(s, h.titel, h.region))
    if (pool.length < 3) continue
    const r = rng(`rate-sa:${s}`)
    const seen = new Set()
    const want = Math.min(6, Math.max(2, Math.floor(pool.length / 3)))
    for (let t = 0; t < 60 && cards.filter(c => c.a === nameOf(s)).length < want; t++) {
      const picks = []
      for (const h of shuffleWith(pool, r)) { if (picks.length === 3) break; if (!picks.some(p => p.kat === h.kat)) picks.push(h) }
      for (const h of shuffleWith(pool, r)) { if (picks.length === 3) break; if (!picks.includes(h)) picks.push(h) }
      const id = picks.map(p => pool.indexOf(p)).sort((a, b) => a - b).join('-')
      if (seen.has(id) || picks.length < 3) continue
      seen.add(id)
      cards.push({ key: `gg-sa-rate:${s}:${id}`, c: picks.map(p => p.titel).join('\n'), a: nameOf(s), g: gruppeOf(s), flag: flagOf(s), n: picks.map(p => p.text).join(' · ') })
    }
  }
  DECKS['gg-sa-rate-das-land'] = sortByGroup(cards, GORDER)
  META['gg-sa-rate-das-land'] = { kind: 'words', withFlags: true, noWrite: true, multiline: true, ask: 'Drei Hinweise – welches Land?', groups: landGroups(cards), tips: ['Erst ausschließen: Sprache, Kennzeichen, Chevron-Farbe.'] }
}
// Region raten (für die vier großen Länder)
for (const [s, slugName] of [['argentina', 'gg-sa-regionen-argentinien'], ['brazil', 'gg-sa-regionen-brasilien'], ['chile', 'gg-sa-regionen-chile'], ['peru', 'gg-sa-regionen-peru'], ['bolivia', 'gg-sa-regionen-bolivien']]) {
  const cards = []
  LAND[s].hinweise.forEach((h, i) => {
    if (!h.region || verraet(s, h.titel, h.region)) return
    cards.push({ key: `${slugName}:${i}`, c: h.titel, a: h.region, g: h.kat, n: h.text })
  })
  DECKS[slugName] = sortByGroup(cards, KAT_ORDER)
  META[slugName] = {
    kind: 'words', noWrite: true, ask: `Wo in ${nameOf(s)}?`, groups: groupsFrom(KAT_ORDER.filter(k => cards.some(c => c.g === k)), D.KATEGORIEN),
    tips: ['Region-Hinweise helfen, nach dem Land auch noch genau zu tippen.', `Alle Hinweise stehen im Steckbrief ${nameOf(s)}.`],
  }
}
write('public/geo/items/gg-sa-karten.json', JSON.stringify({ ...DECKS, _meta: META }))

/* ───────────── Karten-Quizzes ───────────── */

const ORTE = {}
ORTE['gg-sa-ar-taxis'] = D.AR_TAXIS.map(([stadt, prov, lon, lat, text, grp]) => ({
  key: `gg-sa-taxi:${slug(stadt)}`, label: stadt, group: grp, point: [lon, lat],
  details: [{ label: 'Taxi', value: D.AR_TAXI_EXTRA.find(x => x[0] === stadt) ? `${text}` : text, big: true }, { label: 'Provinz', value: prov }],
  text: { prompt: `Taxis in ${stadt}`, sub: 'Welche Farbe?', answer: text },
}))
{
  const cl = S.REGIONEN['cl-regionen'].map
  ORTE['gg-sa-cl-strassen'] = Object.entries(D.CL_STRASSEN).map(([k, [b, prov]]) => ({
    key: `gg-sa-cl-str:${slug(k)}`, label: cl[k][0], prompt: b, promptSub: 'Region mit diesem Straßenbuchstaben', group: S.REGIONEN['cl-regionen'].map[k][3],
    areas: [`sa-cl-regionen:${slug(k)}`],
    details: [{ label: 'Straßenbuchstabe', value: b, big: true }, ...(prov ? [{ label: 'Je Provinz', value: prov }] : []), { label: 'Beispiel', value: `${b[0]}-${String(10 + Math.round(rng(k)() * 40) * 2)}` }],
    text: { prompt: `Straße ${b.split(' · ')[0]}-…`, sub: 'Welche Region?', answer: cl[k][0], big: true },
  }))
}
function merkmalKarte(key, frage) {
  return SLUGS.filter(s => LAND[s].merkmale[key]).map(s => {
    const v = LAND[s].merkmale[key], vn = D.WERT_NAMEN[v] ?? v
    return {
      key: `gg-sa-${key}:${LAND[s].iso3}`, label: nameOf(s), group: v.replace(/[^a-z]/g, '') || 'x', areas: [`world:${LAND[s].iso3}`], flag: flagOf(s),
      details: [{ label: D.MERKMALE[key][0], value: vn, big: true }], text: { prompt: `${frage} ${nameOf(s)}?`, answer: vn },
    }
  })
}
ORTE['gg-sa-kennzeichen-karte'] = merkmalKarte('kennzeichen', 'Wie sehen die Kennzeichen aus in')
ORTE['gg-sa-chevron-karte'] = merkmalKarte('chevron', 'Welche Farbe haben die Chevrons in')
ORTE['gg-sa-mittellinie-karte'] = merkmalKarte('mittellinie', 'Welche Farbe hat die Mittellinie in')
ORTE['gg-sa-auto-karte'] = merkmalKarte('google_auto', 'Welche Farbe hat das Gen-3-Google-Auto in')
write('public/geo/items/gg-sa-orte.json', JSON.stringify(ORTE))

/* ───────────── Quellen ───────────── */

const credits = [
  'GeoGuessr Südamerika (seekclan.de/geo) – Quellen und Lizenzen', '',
  'HINWEISE JE LAND',
  'Fakten aus dem Plonk-It-Guide (https://www.plonkit.net/guide), Lizenz CC BY-NC-SA 4.0 (https://creativecommons.org/licenses/by-nc-sa/4.0/deed.de).',
  'Alle Texte sind auf Deutsch neu formuliert und gekürzt. Diese Texte stehen ebenfalls unter CC BY-NC-SA 4.0.',
  'Ländervorwahlen (ITU) und Länderdomains (IANA): allgemein bekannt.', '',
  'EIGENE ZEICHNUNGEN (seekclan.de): Kennzeichen, Taxis, Poller, Kilometersteine, Strommasten, Chevrons, Leitplanken, Zäune, Fahrbahn-Linien.',
  'Nach den Beschreibungen in den Hinweisen (Plonk It). Kennzeichen-Texte sind ausgedachte Beispiele. Mercosur-Kennzeichen und die alten',
  'Kennzeichen Argentiniens und Brasiliens nach allgemein bekanntem Aussehen. Taxis in Santiago (schwarz/gelbes Dach), Rio de Janeiro (gelb/blau)',
  'und São Paulo (weiß): allgemein bekannt.', '',
  'TAXI-FARBEN ARGENTINIEN: Plonk-It-Grafik „Argentina Taxi Map“.',
  'STRASSENBUCHSTABEN CHILE: https://es.wikipedia.org/wiki/Rutas_regionales_de_Chile (CC BY-SA 4.0).', '',
  'FOTOS VON PFLANZEN – Wikimedia Commons',
  'Datei hier | Datei auf Commons | Lizenz | Urheber',
  ...Object.entries(PF_QUELLEN).map(([k, q]) => `pflanzen/${k}.jpg | ${q.page} | ${q.lic} | ${clean(q.artist) || 'siehe Commons-Seite'}`),
  '', 'Die Fotos wurden auf 480 Pixel Breite verkleinert.',
]
write(`${OUT}/QUELLEN.txt`, credits.join('\n') + '\n')

/* ───────────── TypeScript-Daten ───────────── */

const counts = { ...Object.fromEntries(Object.entries(DECKS).map(([k, v]) => [k, v.length])), ...Object.fromEntries(Object.entries(ORTE).map(([k, v]) => [k, v.length])) }
const colorOf = { 'weiß': '#e8e4da', 'gelb': '#f2c230', 'gemischt': '#9a8fb5', 'mercosur': '#3d74d0', 'schwarz': '#555555', 'gelb-schwarz': '#f2c230', 'schwarz-gelb': '#3a3a3a', 'weiß-rot': '#d14b4b' }
const groupsFor = key => Object.fromEntries(D.MERKMALE[key][1].filter(v => SLUGS.some(s => LAND[s].merkmale[key] === v))
  .map(v => [v.replace(/[^a-z]/g, '') || 'x', { name: D.WERT_NAMEN[v] ?? v, color: colorOf[v] ?? '#888888' }]))
const ts = `// Erzeugt von scripts/geo/build-gg-sa.mjs – nicht von Hand ändern.
export const GG_SA_COUNTS: Record<string, number> = ${JSON.stringify(counts, null, 2)}

/** Länder mit Steckbrief: [slug, Name, Flagge, Gruppe] */
export const GG_SA_LAENDER: [string, string, string, string][] = ${JSON.stringify(SLUGS.map(s => [s, nameOf(s), flagOf(s), gruppeOf(s)]))}

/** Farben der Merkmals-Karten */
export const GG_SA_MERKMAL_GROUPS: Record<string, Record<string, { name: string; color: string }>> = ${JSON.stringify({
  'gg-sa-kennzeichen-karte': groupsFor('kennzeichen'), 'gg-sa-chevron-karte': groupsFor('chevron'),
  'gg-sa-mittellinie-karte': groupsFor('mittellinie'), 'gg-sa-auto-karte': groupsFor('google_auto'),
}, null, 2)}
`
write('app/geo/_data/gg-sa.ts', ts)

console.log('Länder', SLUGS.length, '· Hinweise', SLUGS.reduce((n, s) => n + LAND[s].hinweise.length, 0))
console.log(Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(' · '))
