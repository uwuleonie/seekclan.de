// Baut die Daten für „Higher Lower“ von seekclan.de/geo (welches Land hat mehr …?).
//
// Nur für Entwicklung – wird NICHT beim normalen `npm run build` ausgeführt. Das Ergebnis liegt fertig im Repo.
// Braucht nur Dateien aus dem Repo:
//   scripts/geo/countries.mjs            Länderliste des Atlas (deutsche Namen, Kontinente)
//   scripts/geo/hl-roh/weltbank.json      Weltbank-API (api.worldbank.org, je Kennzahl der neueste Wert), Stand Okt. 2026
//   scripts/geo/hl-roh/factbook.json      CIA World Factbook (github.com/factbook/factbook.json), herausgezogene Zahlen
//   scripts/geo/hl-roh/wikipedia.json     Tabellen aus der englischen Wikipedia (Stand Okt. 2026), je Liste [Land, Wert, Zusatz]
//   scripts/geo/hl-roh/laender-info.json  github.com/mledoze/countries: Nachbarländer, Amtssprachen, englische Namen
//   scripts/geo/hl-roh/bigmac.json        The Economist, Big-Mac-Index (github.com/TheEconomist/big-mac-data)
// Erzeugt:
//   app/lib/hl-werte.json                 Alle Werte (nur auf dem Server – der Browser bekommt verdeckte Werte erst nach dem Tipp)
//   app/geo/_data/hl.ts                   Kategorien (Name, Einheit, Quelle, Anzahl Länder je Region) – ohne Werte
// Danach:  node scripts/geo/build-higherlower.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { COUNTRIES_RAW } from './countries.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const readJson = p => JSON.parse(fs.readFileSync(path.join(here, p), 'utf8'))
const write = (p, s) => { fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true }); fs.writeFileSync(path.join(root, p), s) }

const WB = readJson('hl-roh/weltbank.json')
const FB = readJson('hl-roh/factbook.json')
const WIKI = readJson('hl-roh/wikipedia.json')
const INFO = readJson('hl-roh/laender-info.json')
const BIGMAC = readJson('hl-roh/bigmac.json')
const ISO2 = JSON.parse(fs.readFileSync(path.join(root, 'app/geo/_data/welt-extra.ts'), 'utf8').match(/export const ISO2[^=]*=\s*(\{[^}]*\})/)[1])

/* ───────────── Länder ───────────── */

const LAENDER = COUNTRIES_RAW.trim().split('\n').map(l => {
  const [id, name, konts, , capital, , alt] = l.split('|')
  return { id, name, konts: konts.split(','), capital, alt: alt ? alt.split(',') : [] }
})
// Atlas-Schlüssel → Schlüssel in den Quellen (Kosovo, Palästina, Südsudan haben im Atlas eigene Kürzel)
const QUELL_ID = { KOS: ['XKX', 'UNK', 'KOS'], PSX: ['PSE'], SDS: ['SSD'] }
const quellIds = id => QUELL_ID[id] ?? [id]

export const REGIONEN = { welt: 'Welt', europa: 'Europa', suedamerika: 'Südamerika' }
const inRegion = (l, r) => r === 'welt' || l.konts.includes(r)
// Mindestens so viele Länder mit Wert, sonst gibt es die Kategorie in der Region nicht
const MIN = { welt: 30, europa: 12, suedamerika: 8 }

/* ───────────── Namen aus Wikipedia → Atlas-Schlüssel ───────────── */

const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\[[^\]]*\]/g, '').replace(/\([^)]*\)/g, '').replace(/[†◇‡*]/g, '').replace(/^the /, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()
const NAME = new Map()
for (const l of LAENDER) {
  for (const q of quellIds(l.id)) for (const n of INFO.namen[q] ?? []) if (!NAME.has(norm(n))) NAME.set(norm(n), l.id)
}
const EXTRA_NAMEN = {
  'czech republic': 'CZE', 'turkey': 'TUR', 'turkiye': 'TUR', 'ivory coast': 'CIV', 'cote d ivoire': 'CIV', 'dr congo': 'COD',
  'democratic republic of the congo': 'COD', 'congo dr': 'COD', 'republic of the congo': 'COG', 'congo': 'COG', 'east timor': 'TLS',
  'timor leste': 'TLS', 'cape verde': 'CPV', 'cabo verde': 'CPV', 'swaziland': 'SWZ', 'eswatini': 'SWZ', 'macedonia': 'MKD',
  'north macedonia': 'MKD', 'great britain': 'GBR', 'united kingdom': 'GBR', 'chinese taipei': 'TWN', 'taiwan': 'TWN',
  'south korea': 'KOR', 'korea south': 'KOR', 'north korea': 'PRK', 'korea north': 'PRK', 'kosovo': 'KOS', 'palestine': 'PSX',
  'state of palestine': 'PSX', 'palestinian territories': 'PSX', 'south sudan': 'SDS', 'russia': 'RUS', 'russian federation': 'RUS',
  'iran': 'IRN', 'syria': 'SYR', 'laos': 'LAO', 'vietnam': 'VNM', 'viet nam': 'VNM', 'bolivia': 'BOL', 'venezuela': 'VEN',
  'tanzania': 'TZA', 'moldova': 'MDA', 'micronesia': 'FSM', 'federated states of micronesia': 'FSM', 'brunei': 'BRN',
  'the gambia': 'GMB', 'gambia': 'GMB', 'the bahamas': 'BHS', 'bahamas': 'BHS', 'vatican city': 'VAT', 'holy see': 'VAT',
  'united states of america': 'USA', 'united states': 'USA', 'usa': 'USA', 'myanmar': 'MMR', 'burma': 'MMR',
  'saint kitts and nevis': 'KNA', 'saint lucia': 'LCA', 'st lucia': 'LCA', 'st vincent and the grenadines': 'VCT', 'mainland china': 'CHN', 'congo democratic republic of the': 'COD', 'congo republic of the': 'COG', 'russia ussr': 'RUS', 'saint vincent and the grenadines': 'VCT', 'sao tome and principe': 'STP',
  'west germany': null, 'east germany': null, 'soviet union': null, 'yugoslavia': null, 'serbia and montenegro': null,
  'czechoslovakia': null, 'unified team': null, 'russian olympic committee': null, 'roc': null,
}
for (const [k, v] of Object.entries(EXTRA_NAMEN)) NAME.set(k, v)
const idOf = n => { const k = norm(n); return NAME.has(k) ? NAME.get(k) : undefined }
const unbekannt = new Map()

/* ───────────── Zahlen lesen ───────────── */

const zahl = s => {
  if (s == null) return null
  const m = String(s).replace(/−/g, '-').match(/-?[\d,]*\.?\d+/)
  return m ? Number(m[0].replace(/,/g, '')) : null
}

/** Werte aus einer Wikipedia-Liste: { ISO: [wert, jahr|null] } (erster Treffer je Land gilt) */
function wiki(liste, jahr, opts = {}) {
  const out = {}
  for (const [name, w, extra] of WIKI[liste].slice(opts.skip ?? 1)) {
    const id = idOf(name)
    if (id === undefined) { const u = unbekannt.get(liste) ?? new Set(); u.add(name); unbekannt.set(liste, u); continue }
    if (!id || out[id]) continue
    const v = zahl(w)
    if (v == null || !Number.isFinite(v)) continue
    const j = opts.jahrAusSpalte ? (zahl(extra) ? Math.round(zahl(extra)) : jahr) : jahr
    out[id] = [v, j]
  }
  return out
}

// Werte älter als ab (Standard 2015) werden nicht genommen – sonst stünden Zahlen aus den 1990ern neben aktuellen
function weltbank(ind, ab = 2015) {
  const raw = Object.fromEntries(String(WB[ind] ?? '').split(',').filter(Boolean).map(x => { const [i, v, j] = x.split(':'); return [i, [Number(v), Number(j)]] }))
  const out = {}
  for (const l of LAENDER) for (const q of quellIds(l.id)) if (raw[q] && raw[q][1] >= ab) { out[l.id] = raw[q]; break }
  return out
}

function factbook(feld) {
  const out = {}
  for (const l of LAENDER) for (const q of quellIds(l.id)) {
    const r = FB[q]?.[feld]
    if (r && r[0] != null) { out[l.id] = r; break }
  }
  return out
}

/* ───────────── Kategorien ─────────────
 * fmt: 'gross' (Mio/Mrd), 'zahl' (dez Nachkommastellen), 'usd', 'usd-gross'
 * gruppe: ernst · spass · absurd   ·   leicht: wie gut man es im Schnitt weiß (1 = leicht … 3 = schwer), für die Start-Trefferquote
 */
const WB_Q = ['Weltbank', 'https://data.worldbank.org/indicator/']
const FB_Q = ['CIA World Factbook', 'https://github.com/factbook/factbook.json']
const W = t => ['Wikipedia: ' + t, 'https://en.wikipedia.org/wiki/' + encodeURIComponent(t.replace(/ /g, '_'))]

const K = []
const kat = (key, name, icon, gruppe, schwer, einheit, fmt, dez, quelle, werte, extra = {}) =>
  K.push({ key, name, icon, gruppe, schwer, einheit, fmt, dez, quelle: quelle[0], url: quelle[1], werte, ...extra })
const wb = (ind) => [WB_Q[0], WB_Q[1] + ind]

// Ernst
kat('einwohner', 'Einwohner', '👥', 'ernst', 1, '', 'gross', 1, wb('SP.POP.TOTL'), weltbank('SP.POP.TOTL'))
kat('flaeche', 'Fläche', '🗺️', 'ernst', 1, 'km²', 'gross', 0, wb('AG.SRF.TOTL.K2'), weltbank('AG.SRF.TOTL.K2'))
kat('dichte', 'Einwohner pro km²', '🏘️', 'ernst', 2, 'pro km²', 'zahl', 0, wb('EN.POP.DNST'), weltbank('EN.POP.DNST'))
kat('bip', 'Wirtschaftsleistung (BIP)', '💰', 'ernst', 2, 'US$', 'usd-gross', 1, wb('NY.GDP.MKTP.CD'), weltbank('NY.GDP.MKTP.CD'))
kat('bip-kopf', 'BIP pro Kopf', '💶', 'ernst', 2, 'US$', 'usd', 0, wb('NY.GDP.PCAP.CD'), weltbank('NY.GDP.PCAP.CD'))
kat('lebenserwartung', 'Lebenserwartung', '❤️', 'ernst', 2, 'Jahre', 'zahl', 1, wb('SP.DYN.LE00.IN'), weltbank('SP.DYN.LE00.IN'))
kat('gluecks', 'Glücks-Wert (World Happiness Report)', '😊', 'ernst', 2, 'von 10', 'zahl', 2, W('World Happiness Report'), wiki('whr', 2026))
kat('hdi', 'Menschliche Entwicklung (HDI)', '🎓', 'ernst', 2, 'von 1', 'zahl', 3, W('List of countries by Human Development Index'), wiki('hdi', 2023))
kat('kinder-pro-frau', 'Kinder pro Frau', '👶', 'ernst', 2, 'Kinder', 'zahl', 2, wb('SP.DYN.TFRT.IN'), weltbank('SP.DYN.TFRT.IN'))
kat('medianalter', 'Medianalter', '🎂', 'ernst', 2, 'Jahre', 'zahl', 1, FB_Q, factbook('median'))
kat('senioren', 'Anteil über 65-Jährige', '👵', 'ernst', 3, '%', 'zahl', 1, wb('SP.POP.65UP.TO.ZS'), weltbank('SP.POP.65UP.TO.ZS'))
kat('jugend', 'Anteil unter 15-Jährige', '🧒', 'ernst', 3, '%', 'zahl', 1, wb('SP.POP.0014.TO.ZS'), weltbank('SP.POP.0014.TO.ZS'))
kat('stadt', 'Anteil Stadtbevölkerung', '🏙️', 'ernst', 3, '%', 'zahl', 1, wb('SP.URB.TOTL.IN.ZS'), weltbank('SP.URB.TOTL.IN.ZS'))
kat('internet', 'Internetnutzer', '🌐', 'ernst', 2, '%', 'zahl', 1, wb('IT.NET.USER.ZS'), weltbank('IT.NET.USER.ZS'))
kat('handy', 'Handyverträge pro 100 Einwohner', '📱', 'ernst', 3, 'pro 100', 'zahl', 0, wb('IT.CEL.SETS.P2'), weltbank('IT.CEL.SETS.P2'))
kat('wald', 'Waldanteil', '🌲', 'ernst', 2, '%', 'zahl', 1, wb('AG.LND.FRST.ZS'), weltbank('AG.LND.FRST.ZS'))
kat('acker', 'Anteil Ackerland', '🌾', 'ernst', 3, '%', 'zahl', 1, wb('AG.LND.ARBL.ZS'), weltbank('AG.LND.ARBL.ZS'))
kat('co2', 'CO₂ pro Kopf', '🏭', 'ernst', 2, 't pro Jahr', 'zahl', 1, wb('EN.GHG.CO2.PC.CE.AR5'), weltbank('EN.GHG.CO2.PC.CE.AR5'))
kat('oekostrom', 'Strom aus Erneuerbaren', '⚡', 'ernst', 3, '%', 'zahl', 1, wb('EG.ELC.RNEW.ZS'), weltbank('EG.ELC.RNEW.ZS'))
kat('arbeitslos', 'Arbeitslosenquote', '📉', 'ernst', 3, '%', 'zahl', 1, wb('SL.UEM.TOTL.ZS'), weltbank('SL.UEM.TOTL.ZS'))
kat('aerzte', 'Ärzte pro 1.000 Einwohner', '🩺', 'ernst', 3, 'pro 1.000', 'zahl', 2, wb('SH.MED.PHYS.ZS'), weltbank('SH.MED.PHYS.ZS'))
kat('betten', 'Krankenhausbetten pro 1.000 Einwohner', '🛏️', 'ernst', 3, 'pro 1.000', 'zahl', 1, FB_Q, factbook('betten'))
kat('mutter-alter', 'Alter der Mutter beim ersten Kind', '🍼', 'ernst', 3, 'Jahre', 'zahl', 1, FB_Q, factbook('mutter'))
kat('bildung', 'Ausgaben für Bildung', '📚', 'ernst', 3, '% des BIP', 'zahl', 1, wb('SE.XPD.TOTL.GD.ZS'), weltbank('SE.XPD.TOTL.GD.ZS'))
kat('export', 'Exporte', '📦', 'ernst', 3, '% des BIP', 'zahl', 0, wb('NE.EXP.GNFS.ZS'), weltbank('NE.EXP.GNFS.ZS'))
kat('militaer', 'Militärausgaben', '🪖', 'ernst', 3, '% des BIP', 'zahl', 1, FB_Q, factbook('militaer'))
kat('gini', 'Ungleichheit (Gini-Index)', '⚖️', 'ernst', 3, 'von 100', 'zahl', 1, FB_Q, factbook('gini'))
// Touristen/Tourismus-Einnahmen: neueste Weltbank-Werte sind von 2020 (Corona) – darum (noch) nicht dabei.
// Flugpassagiere: nur Werte ab 2022 (nach Corona)
kat('flugpassagiere', 'Flugpassagiere pro Jahr', '✈️', 'ernst', 3, '', 'gross', 1, wb('IS.AIR.PSGR'), weltbank('IS.AIR.PSGR', 2022))
kat('hoechster-punkt', 'Höchster Punkt', '🏔️', 'ernst', 2, 'm', 'zahl', 0, FB_Q, factbook('berg'), { zusatz: 'berg' })
kat('mittlere-hoehe', 'Mittlere Höhe des Landes', '⛰️', 'ernst', 3, 'm', 'zahl', 0, FB_Q, factbook('mhoehe'))
kat('kueste', 'Küstenlänge', '🌊', 'ernst', 2, 'km', 'zahl', 0, FB_Q, factbook('kueste'), { zusatz: 'kueste' })
kat('grenze', 'Länge der Landgrenzen', '🧱', 'ernst', 3, 'km', 'zahl', 0, FB_Q, factbook('grenze'))
kat('hauptstadt-hoehe', 'Höhe der Hauptstadt', '🏛️', 'ernst', 3, 'm', 'zahl', 0, W('List of capital cities by elevation'), wiki('capelev', null))
kat('temperatur', 'Durchschnittstemperatur', '🌡️', 'ernst', 2, '°C', 'zahl', 1, W('List of countries by average yearly temperature'), wiki('temp', null))
kat('hauptstadt-einw', 'Einwohner der Hauptstadt (Ballungsraum)', '🌆', 'ernst', 2, '', 'gross', 2, FB_Q, factbook('hauptstadt'), { zusatz: 'hauptstadt' })

// Spaß
const nachbarn = {}, sprachen = {}
for (const l of LAENDER) for (const q of quellIds(l.id)) if (INFO.info[q]) { nachbarn[l.id] = [INFO.info[q][0], null]; sprachen[l.id] = [INFO.info[q][1], null]; break }
kat('nachbarn', 'Anzahl Nachbarländer', '🤝', 'spass', 2, 'Länder', 'zahl', 0, ['mledoze/countries', 'https://github.com/mledoze/countries'], nachbarn)
kat('sprachen', 'Anzahl Amtssprachen', '🗣️', 'spass', 3, 'Sprachen', 'zahl', 0, ['mledoze/countries', 'https://github.com/mledoze/countries'], sprachen)
kat('olympia', 'Olympia-Medaillen (alle Zeiten)', '🥇', 'spass', 2, 'Medaillen', 'zahl', 0, W('All-time Olympic Games medal table'), wiki('olymp', 2026))
kat('nobel', 'Nobelpreisträger', '🏅', 'spass', 2, 'Personen', 'zahl', 0, W('List of Nobel laureates by country'), wiki('nobel', 2025))
// Eurovision: Wikipedia listet nur Gewinner – alle anderen europäischen Teilnehmerländer haben 0 Siege
const ev = {}
let evW = null
for (const [name, w] of WIKI.eurovision) { if (w) evW = zahl(w); const id = idOf(name); if (id) ev[id] = [evW, 2026] }
for (const l of LAENDER) if (l.konts.includes('europa') && !ev[l.id] && !['VAT', 'LIE', 'KOS', 'KAZ'].includes(l.id)) ev[l.id] = [0, 2026]
kat('eurovision', 'Eurovision-Siege', '🎤', 'spass', 2, 'Siege', 'zahl', 0, W('List of Eurovision Song Contest winners'), ev, { nurRegion: ['europa'] })
kat('groesse', 'Durchschnittsgröße der Männer', '📏', 'spass', 2, 'cm', 'zahl', 1, W('Human height by country'), wiki('height', null))
kat('autos', 'Autos pro 1.000 Einwohner', '🚗', 'spass', 2, 'pro 1.000', 'zahl', 0, W('List of countries and territories by motor vehicles per capita'), wiki('vehicles', null, { jahrAusSpalte: true }))
kat('bier', 'Bier pro Kopf', '🍺', 'spass', 2, 'Liter pro Jahr', 'zahl', 1, W('List of countries by beer consumption per capita'), wiki('beer', null, { jahrAusSpalte: true }), { zusatz: 'bier' })
kat('wein', 'Wein pro Kopf', '🍷', 'spass', 3, 'Liter reiner Alkohol', 'zahl', 2, FB_Q, factbook('wein'))
kat('alkohol', 'Alkohol pro Kopf', '🥃', 'spass', 3, 'Liter reiner Alkohol', 'zahl', 1, FB_Q, factbook('alkohol'))
kat('tee', 'Tee pro Kopf', '🍵', 'spass', 3, 'kg pro Jahr', 'zahl', 2, W('List of countries by tea consumption per capita'), wiki('tea', null), { zusatz: 'tee' })
kat('milch', 'Milch pro Kopf', '🥛', 'spass', 3, 'kg pro Jahr', 'zahl', 0, W('List of countries by milk consumption per capita'), wiki('milk', 2013), { zusatz: 'milch' })
kat('fleisch', 'Fleisch pro Kopf', '🥩', 'spass', 2, 'kg pro Jahr', 'zahl', 1, W('List of countries by meat consumption'), wiki('meat', 2020), { zusatz: 'fleisch' })
kat('kaffee-ernte', 'Kaffee-Ernte', '☕', 'spass', 3, 'Tonnen', 'gross', 1, W('List of countries by coffee production'), wiki('coffee', null, { skip: 2 }))
kat('rauchen', 'Anteil Raucher', '🚬', 'spass', 3, '%', 'zahl', 1, FB_Q, factbook('rauchen'))
kat('adipositas', 'Starkes Übergewicht (Erwachsene)', '⚖️', 'spass', 3, '%', 'zahl', 1, FB_Q, factbook('uebergewicht'))
kat('flughaefen', 'Flughäfen und Flugplätze', '🛫', 'spass', 2, 'Stück', 'zahl', 0, FB_Q, factbook('flughaefen'))
kat('schiene', 'Länge des Schienennetzes', '🚆', 'spass', 2, 'km', 'zahl', 0, FB_Q, factbook('schiene'), { zusatz: 'schiene' })
kat('milliardaere', 'Milliardäre', '💎', 'spass', 2, 'Personen', 'zahl', 0, W('List of countries by number of billionaires'), wiki('billion', 2026, { skip: 3 }))
kat('inseln', 'Anzahl Inseln', '🏝️', 'spass', 3, 'Inseln', 'zahl', 0, W('List of countries by number of islands'), wiki('islands', null))
kat('atomkraft', 'Atomreaktoren in Betrieb', '☢️', 'spass', 2, 'Reaktoren', 'zahl', 0, W('Nuclear power by country'), wiki('nuclear', null, { skip: 3 }))
kat('breitband', 'Festnetz-Internet pro 100 Einwohner', '📶', 'spass', 3, 'pro 100', 'zahl', 0, FB_Q, factbook('breitband'))

// Absurd
const nameLaenge = Object.fromEntries(LAENDER.map(l => [l.id, [l.name.replace(/[^\p{L}]/gu, '').length, null]]))
kat('name-laenge', 'Buchstaben im deutschen Ländernamen', '🔤', 'absurd', 2, 'Buchstaben', 'zahl', 0, ['eigene Zählung (Atlas-Namen)', ''], nameLaenge, { zusatz: 'name' })
const SAARLAND = 2569.69 // km², Statistisches Amt Saarland (de.wikipedia.org/wiki/Saarland)
const saar = Object.fromEntries(Object.entries(weltbank('AG.SRF.TOTL.K2')).map(([k, [v, j]]) => [k, [Math.round((v / SAARLAND) * 100) / 100, j]]))
kat('saarlaender', 'Fläche in Saarländern', '📐', 'absurd', 2, 'Saarländer', 'zahl', 1, ['Weltbank-Fläche ÷ Saarland (2.569,69 km²)', 'https://de.wikipedia.org/wiki/Saarland'], saar)
kat('heliports', 'Hubschrauber-Landeplätze', '🚁', 'absurd', 3, 'Stück', 'zahl', 0, FB_Q, factbook('heliports'))
kat('schiffe', 'Handelsschiffe unter eigener Flagge', '🚢', 'absurd', 3, 'Schiffe', 'zahl', 0, FB_Q, factbook('schiffe'))
kat('mcdonalds', 'McDonald’s-Filialen', '🍟', 'absurd', 2, 'Filialen', 'zahl', 0, W("List of countries with McDonald's restaurants"), wiki('mcd', 2025), { zusatz: 'mcdonalds' })
const bm = {}
for (const l of LAENDER) for (const q of quellIds(l.id)) if (BIGMAC[q] && Number(BIGMAC[q][1]) >= 2025) { bm[l.id] = [BIGMAC[q][0], Number(BIGMAC[q][1])]; break }
kat('bigmac', 'Preis eines Big Mac', '🍔', 'absurd', 3, 'US$', 'zahl', 2, ['The Economist – Big-Mac-Index', 'https://github.com/TheEconomist/big-mac-data'], bm)

/* ───────────── „bekannte“ Länder für die Stufe Leicht ───────────── */

const pop = weltbank('SP.POP.TOTL')
const KLEIN_EUROPA = ['AND', 'LIE', 'MCO', 'SMR', 'VAT', 'KOS']
const bekannt = {
  welt: LAENDER.filter(l => (pop[l.id]?.[0] ?? 0) >= 20e6 || ['CHE', 'AUT', 'NLD', 'BEL', 'SWE', 'NOR', 'DNK', 'FIN', 'PRT', 'GRC', 'IRL', 'NZL', 'ISR', 'CUB', 'CHL', 'CZE', 'HUN'].includes(l.id)).map(l => l.id),
  europa: LAENDER.filter(l => l.konts.includes('europa') && !KLEIN_EUROPA.includes(l.id)).map(l => l.id),
  suedamerika: LAENDER.filter(l => l.konts.includes('suedamerika')).map(l => l.id),
}

/* ───────────── Ausgabe ───────────── */

const runde = (v, dez) => { const f = 10 ** Math.max(0, dez + 1); return Math.round(v * f) / f }
const werte = {}
const meta = []
for (const k of K) {
  const w = {}
  for (const [id, r] of Object.entries(k.werte)) {
    if (r[0] == null || !Number.isFinite(r[0])) continue
    w[id] = r.length > 2 ? [runde(r[0], k.dez), r[1] ?? null, r[2]] : [runde(r[0], k.dez), r[1] ?? null]
  }
  const regionen = {}
  for (const r of Object.keys(REGIONEN)) {
    if (k.nurRegion && !k.nurRegion.includes(r)) continue
    const n = LAENDER.filter(l => inRegion(l, r) && w[l.id]).length
    if (n >= MIN[r]) regionen[r] = n
  }
  const jahre = Object.values(w).map(x => x[1]).filter(Boolean)
  werte[k.key] = w
  meta.push({
    key: k.key, name: k.name, icon: k.icon, gruppe: k.gruppe, schwer: k.schwer, einheit: k.einheit, fmt: k.fmt, dez: k.dez,
    quelle: k.quelle, url: k.url, regionen,
    jahr: jahre.length ? (Math.min(...jahre) === Math.max(...jahre) ? String(Math.max(...jahre)) : `${Math.min(...jahre)}–${Math.max(...jahre)}`) : null,
    ...(k.zusatz ? { zusatz: k.zusatz } : {}),
  })
}

const laender = Object.fromEntries(LAENDER.map(l => [l.id, {
  name: l.name, flag: ISO2[l.id] ?? null, capital: l.capital,
  regionen: ['welt', ...l.konts.filter(k => k in REGIONEN)],
}]))

write('app/lib/hl-werte.json', JSON.stringify({ stand: '2026-10', laender, bekannt, werte }))
write('app/geo/_data/hl.ts', `// Erzeugt von scripts/geo/build-higherlower.mjs – nicht von Hand bearbeiten.
// Kategorien für Higher Lower (ohne Werte – die liegen nur auf dem Server in app/lib/hl-werte.json).

export type HlRegion = 'welt' | 'europa' | 'suedamerika'
export type HlGruppe = 'ernst' | 'spass' | 'absurd'
export interface HlKategorie {
  key: string; name: string; icon: string; gruppe: HlGruppe
  /** 1 = leicht … 3 = schwer (für die Start-Trefferquote der Wetten) */
  schwer: number
  einheit: string; fmt: 'gross' | 'zahl' | 'usd' | 'usd-gross'; dez: number
  quelle: string; url: string
  /** Anzahl Länder mit Wert je Region (fehlt = gibt es dort nicht) */
  regionen: Partial<Record<HlRegion, number>>
  jahr: string | null
  zusatz?: string
}

export const HL_REGIONEN: { key: HlRegion; name: string }[] = ${JSON.stringify(Object.entries(REGIONEN).map(([key, name]) => ({ key, name })))}

export const HL_KATEGORIEN: HlKategorie[] = ${JSON.stringify(meta, null, 1)}

export const HL_KAT: Record<string, HlKategorie> = Object.fromEntries(HL_KATEGORIEN.map(k => [k.key, k]))
`)

console.log(`${meta.length} Kategorien`)
for (const m of meta) console.log(m.key.padEnd(18), JSON.stringify(m.regionen), m.jahr ?? '')
for (const [l, s] of unbekannt) console.log(`nicht zugeordnet (${l}):`, [...s].slice(0, 40).join(' | '))
