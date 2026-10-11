// Länder & Hauptstädte – für die ganze Welt und je Kontinent
// Daten: app/geo/_data/world.ts (erzeugt aus scripts/geo/countries.mjs + Natural Earth)

import { COUNTRIES, type WorldCountry } from '../_data/world'
import { ISO2 } from '../_data/welt-extra'
import type { Bereich, GeoItem, GroupDef, Kontinent, LonLat, QuizDef } from '../_lib/types'
import { C, fmtPop } from './palette'

export const BEREICHE: { key: Bereich; name: string; short: string; color: string; frame: [LonLat, LonLat] }[] = [
  { key: 'welt', name: 'Welt', short: 'Welt', color: '#c9a46a', frame: [[-180, -58], [180, 84]] },
  { key: 'europa', name: 'Europa', short: 'Europa', color: '#5b9bd5', frame: [[-25, 34], [45, 71.5]] },
  { key: 'asien', name: 'Asien', short: 'Asien', color: '#e0a84f', frame: [[25, -11], [148, 56]] },
  { key: 'afrika', name: 'Afrika', short: 'Afrika', color: '#d9774b', frame: [[-26, -36], [60, 38]] },
  { key: 'nordamerika', name: 'Nordamerika', short: 'Nordamerika', color: '#c9637a', frame: [[-170, 7], [-52, 72]] },
  { key: 'suedamerika', name: 'Südamerika', short: 'Südamerika', color: '#5fb07a', frame: [[-92, -56], [-34, 13]] },
  { key: 'ozeanien', name: 'Ozeanien', short: 'Ozeanien', color: '#3fa7a8', frame: [[110, -48], [190, 10]] },
  // Themen-Bereich: Schriften und Sprachen der ganzen Welt (kein Kontinent)
  { key: 'sprachen', name: 'Sprachen & Schriften', short: 'Sprachen', color: '#9fbf6a', frame: [[-180, -58], [180, 84]] },
]
export const BEREICH_BY_KEY = Object.fromEntries(BEREICHE.map(b => [b.key, b])) as Record<Bereich, (typeof BEREICHE)[number]>

/** Regionen je Kontinent (Einteilung angelehnt an das UN-Schema, für Farben und Tipps) */
const REGIONS: Record<Kontinent, Record<string, GroupDef>> = {
  // Europa: echte Landschafts-/Kulturräume statt Himmelsrichtungen
  europa: {
    inseln: { name: 'Britische Inseln', color: C.green },
    skandinavien: { name: 'Skandinavien & Nordatlantik', color: C.sky },
    baltikum: { name: 'Baltikum', color: C.teal },
    benelux: { name: 'Benelux', color: C.coral },
    frankreich: { name: 'Frankreich & Monaco', color: C.blue },
    iberien: { name: 'Iberische Halbinsel', color: C.ochre },
    alpen: { name: 'Alpenländer', color: C.wine },
    mittel: { name: 'Mitteleuropa', color: C.indigo },
    italien: { name: 'Italien & Mittelmeer', color: C.terra },
    balkan: { name: 'Balkan', color: C.plum },
    ost: { name: 'Osteuropa', color: C.rose },
    kaukasus: { name: 'Türkei, Kaukasus & Kasachstan', color: C.brown },
  },
  asien: {
    nordasien: { name: 'Nordasien', color: C.rose },
    vorderasien: { name: 'Vorderasien', color: C.terra },
    kaukasus: { name: 'Kaukasus', color: C.plum },
    zentral: { name: 'Zentralasien', color: C.ochre },
    sued: { name: 'Südasien', color: C.green },
    ost: { name: 'Ostasien', color: C.indigo },
    suedost: { name: 'Südostasien', color: C.teal },
  },
  afrika: {
    nord: { name: 'Nordafrika', color: C.ochre },
    west: { name: 'Westafrika', color: C.terra },
    zentral: { name: 'Zentralafrika', color: C.green },
    ost: { name: 'Ostafrika', color: C.teal },
    sued: { name: 'Südliches Afrika', color: C.indigo },
  },
  nordamerika: {
    nord: { name: 'Nördliches Amerika', color: C.blue },
    mittel: { name: 'Mittelamerika', color: C.terra },
    karibik: { name: 'Karibik', color: C.teal },
  },
  // Südamerika hat nur 12 Länder – keine künstliche Einteilung
  suedamerika: {
    alle: { name: 'Südamerika', color: C.green },
  },
  ozeanien: {
    aunz: { name: 'Australien & Neuseeland', color: C.terra },
    melanesien: { name: 'Melanesien', color: C.green },
    mikronesien: { name: 'Mikronesien', color: C.teal },
    polynesien: { name: 'Polynesien', color: C.indigo },
  },
}

const CONTINENT_GROUPS: Record<string, GroupDef> = Object.fromEntries(
  BEREICHE.filter(b => b.key !== 'welt' && b.key !== 'sprachen').map(b => [b.key, { name: b.name, color: b.color }]),
)

/** Gruppe eines Landes im jeweiligen Quiz */
const EUROPA_GROUP: Record<string, string> = {
  GBR: 'inseln', IRL: 'inseln',
  NOR: 'skandinavien', SWE: 'skandinavien', DNK: 'skandinavien', ISL: 'skandinavien', FIN: 'skandinavien',
  EST: 'baltikum', LVA: 'baltikum', LTU: 'baltikum',
  BEL: 'benelux', NLD: 'benelux', LUX: 'benelux',
  FRA: 'frankreich', MCO: 'frankreich',
  ESP: 'iberien', PRT: 'iberien', AND: 'iberien',
  CHE: 'alpen', AUT: 'alpen', LIE: 'alpen',
  DEU: 'mittel', POL: 'mittel', CZE: 'mittel', SVK: 'mittel', HUN: 'mittel',
  ITA: 'italien', MLT: 'italien', SMR: 'italien', VAT: 'italien', CYP: 'italien',
  SVN: 'balkan', HRV: 'balkan', BIH: 'balkan', SRB: 'balkan', MNE: 'balkan', KOS: 'balkan', MKD: 'balkan', ALB: 'balkan', GRC: 'balkan', BGR: 'balkan', ROU: 'balkan',
  UKR: 'ost', BLR: 'ost', MDA: 'ost', RUS: 'ost',
  TUR: 'kaukasus', GEO: 'kaukasus', ARM: 'kaukasus', AZE: 'kaukasus', KAZ: 'kaukasus',
}

function groupOf(c: WorldCountry, bereich: Bereich): string {
  if (bereich === 'welt') return c.continents[0]
  const regions = REGIONS[bereich as Kontinent]
  if (bereich === 'europa') return EUROPA_GROUP[c.id] ?? 'mittel'
  if (bereich === 'suedamerika') return 'alle'
  if (bereich === 'asien' && c.id === 'RUS') return 'nordasien'
  if (bereich === 'asien' && c.id === 'CYP') return 'vorderasien'
  return regions[c.region] ? c.region : Object.keys(regions)[0]
}

const inBereich = (c: WorldCountry, b: Bereich) => b === 'welt' || c.continents.includes(b)

function countryDetails(c: WorldCountry, bereich: Bereich) {
  const g = groupOf(c, bereich)
  const groupName = bereich === 'welt' ? CONTINENT_GROUPS[g]?.name : REGIONS[bereich as Kontinent][g]?.name
  return [
    { label: 'Hauptstadt', value: c.capital },
    ...(bereich === 'suedamerika' ? [] : [{ label: bereich === 'welt' ? 'Kontinent' : 'Region', value: groupName ?? '' }]),
    { label: 'Einwohner', value: fmtPop(c.pop) },
    ...(c.continents.length > 1 ? [{ label: 'Hinweis', value: 'Liegt auf mehreren Kontinenten' }] : []),
  ]
}

function countryItems(bereich: Bereich): GeoItem[] {
  return COUNTRIES.filter(c => inBereich(c, bereich))
    .map(c => ({
      key: `land:${c.id}`,
      label: c.name,
      group: groupOf(c, bereich),
      areas: [`world:${c.id}`],
      aliases: c.aliases,
      flag: ISO2[c.id],
      details: countryDetails(c, bereich),
      text: { prompt: `Hauptstadt von ${c.name}?`, answer: c.capital },
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'de'))
}

function capitalItems(bereich: Bereich): GeoItem[] {
  return COUNTRIES.filter(c => inBereich(c, bereich) && c.cap)
    .map(c => ({
      key: `hs:${c.id}`,
      label: c.capital,
      prompt: c.capital,
      promptSub: 'Tippe auf das Land',
      group: groupOf(c, bereich),
      areas: [`world:${c.id}`],
      point: c.cap as LonLat,
      details: [
        { label: 'Land', value: c.name },
        ...countryDetails(c, bereich).filter(d => d.label !== 'Hauptstadt'),
        ...(c.id === 'ISR' ? [{ label: 'Hinweis', value: 'Der Status von Jerusalem ist international umstritten.' }] : []),
        ...(c.id === 'BOL' ? [{ label: 'Hinweis', value: 'Regierungssitz ist La Paz.' }] : []),
        ...(c.id === 'PSX' ? [{ label: 'Hinweis', value: 'Sitz der Regierung, beansprucht wird Ost-Jerusalem.' }] : []),
      ],
      text: { prompt: `${c.capital} ist die Hauptstadt von …`, answer: c.name },
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'de'))
}

function groupsFor(bereich: Bereich): Record<string, GroupDef> {
  return bereich === 'welt' ? CONTINENT_GROUPS : REGIONS[bereich as Kontinent]
}

const COUNTRY_TIPS: Partial<Record<Bereich, string>> = {
  europa: 'Kleine Länder wie Vatikanstadt, Monaco oder Liechtenstein haben einen Kreis zum Antippen. Zoomen hilft!',
  nordamerika: 'Die kleinen Karibik-Inseln haben Kreise zum Antippen – reinzoomen lohnt sich.',
  ozeanien: 'Viele Inselstaaten sind winzig: Tippe auf die Kreise. Samoa und Tonga liegen östlich der Datumsgrenze.',
  welt: 'Mini-Staaten und Inseln haben Kreise zum Antippen. Mit Mausrad oder zwei Fingern zoomen.',
}

function laender(bereich: Bereich): QuizDef {
  const b = BEREICH_BY_KEY[bereich]
  const items = countryItems(bereich)
  return {
    slug: `${bereich}-laender`,
    title: bereich === 'welt' ? 'Länder der Welt' : `Länder ${b.name}s`,
    meta: `${items.length} Länder`,
    text: bereich === 'welt'
      ? 'Alle anerkannten Staaten der Erde (plus Kosovo, Palästina, Taiwan) – finden, benennen oder eintippen.'
      : `Alle Länder in ${b.name} auf der Karte finden, zuordnen oder eintippen.`,
    bereich,
    kind: 'laender',
    section: bereich === 'welt' ? 'Länder & Hauptstädte' : undefined,
    askClick: 'Wo liegt das Land?',
    askName: 'Wie heißt das markierte Land?',
    askText: 'Welche Hauptstadt?',
    itemsNoun: 'Länder',
    groups: groupsFor(bereich),
    items,
    layers: ['world'],
    frame: b.frame,
    projection: bereich === 'welt' ? 'naturalEarth' : 'auto',
    labelSize: bereich === 'welt' ? 6 : 8,
    intro: 'Lernmodus – tippe auf ein Land, um Hauptstadt, Region und Einwohner zu sehen.',
    tip: COUNTRY_TIPS[bereich] ? { title: 'Tipp', text: COUNTRY_TIPS[bereich]! } : undefined,
  }
}

function hauptstaedte(bereich: Bereich): QuizDef {
  const b = BEREICH_BY_KEY[bereich]
  const items = capitalItems(bereich)
  return {
    slug: `${bereich}-hauptstaedte`,
    title: bereich === 'welt' ? 'Hauptstädte der Welt' : `Hauptstädte ${b.name}s`,
    meta: `${items.length} Hauptstädte`,
    text: bereich === 'welt'
      ? 'Zu jeder Hauptstadt das Land finden – oder umgekehrt.'
      : `Die Hauptstädte in ${b.name}: Land antippen, Stadt benennen oder eintippen.`,
    bereich,
    kind: 'hauptstaedte',
    section: bereich === 'welt' ? 'Länder & Hauptstädte' : undefined,
    askClick: 'In welchem Land liegt die Hauptstadt?',
    askName: 'Welche Hauptstadt hat das markierte Land?',
    askText: 'Welches Land?',
    itemsNoun: 'Hauptstädte',
    groups: groupsFor(bereich),
    items,
    layers: ['world'],
    frame: b.frame,
    projection: bereich === 'welt' ? 'naturalEarth' : 'auto',
    labelSize: bereich === 'welt' ? 6 : 7.5,
    intro: 'Lernmodus – tippe auf ein Land, um seine Hauptstadt zu sehen.',
  }
}

export const WELT_QUIZZES: QuizDef[] = (['welt', 'europa', 'asien', 'afrika', 'nordamerika', 'suedamerika', 'ozeanien'] as Bereich[])
  .flatMap(b => [laender(b), hauptstaedte(b)])

/** Für Globus/Startseite: Kontinent eines Landes an einer Stelle (transkontinentale Länder nach Längengrad) */
export function continentAt(id: string, lon: number): Kontinent | null {
  if (id === 'RUS' || id === 'KAZ') return lon > 58 ? 'asien' : 'europa'
  if (id === 'TUR') return lon > 29.1 ? 'asien' : 'europa'
  if (['GEO', 'ARM', 'AZE'].includes(id)) return 'asien'
  if (id === 'FRA' && lon < -40) return 'suedamerika'
  const extra: Record<string, Kontinent> = {
    GRL: 'nordamerika', SAH: 'afrika', PRI: 'nordamerika', NCL: 'ozeanien', PYF: 'ozeanien', FLK: 'suedamerika',
    HKG: 'asien', MAC: 'asien', BMU: 'nordamerika', CUW: 'nordamerika', ABW: 'nordamerika', GUM: 'ozeanien',
  }
  if (extra[id]) return extra[id]
  const c = COUNTRY_BY_ID[id]
  return (c?.continents[0] as Kontinent) ?? null
}

export const COUNTRY_BY_ID: Record<string, WorldCountry> = Object.fromEntries(COUNTRIES.map(c => [c.id, c]))