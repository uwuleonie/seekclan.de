// Deutschland & Österreich: Bundesländer und Landeshauptstädte
// Grenzen: Natural Earth admin 1 (Ebenen adm1-DEU / adm1-AUT)

import type { GeoItem, GroupDef, LonLat, QuizDef } from '../_lib/types'
import { C } from './palette'

/* ───────────── Deutschland ───────────── */

// Keine Einteilung in Himmelsrichtungen – jedes Bundesland bekommt auf der Karte seine eigene Atlas-Farbe
const DE_GROUPS: Record<string, GroupDef> = { alle: { name: 'Deutschland', color: C.ochre } }

const DE: { id: string; name: string; short: string; capital: string; cap: LonLat; kind?: string }[] = [
  { id: 'DE-SH', name: 'Schleswig-Holstein', short: 'SH', capital: 'Kiel', cap: [10.134, 54.323] },
  { id: 'DE-HH', name: 'Hamburg', short: 'HH', capital: 'Hamburg', cap: [9.993, 53.551], kind: 'Stadtstaat' },
  { id: 'DE-HB', name: 'Bremen', short: 'HB', capital: 'Bremen', cap: [8.807, 53.075], kind: 'Stadtstaat (Bremen und Bremerhaven)' },
  { id: 'DE-NI', name: 'Niedersachsen', short: 'NI', capital: 'Hannover', cap: [9.732, 52.375] },
  { id: 'DE-MV', name: 'Mecklenburg-Vorpommern', short: 'MV', capital: 'Schwerin', cap: [11.401, 53.629] },
  { id: 'DE-NW', name: 'Nordrhein-Westfalen', short: 'NRW', capital: 'Düsseldorf', cap: [6.773, 51.228] },
  { id: 'DE-HE', name: 'Hessen', short: 'HE', capital: 'Wiesbaden', cap: [8.24, 50.078] },
  { id: 'DE-RP', name: 'Rheinland-Pfalz', short: 'RP', capital: 'Mainz', cap: [8.247, 49.993] },
  { id: 'DE-SL', name: 'Saarland', short: 'SL', capital: 'Saarbrücken', cap: [6.997, 49.235] },
  { id: 'DE-BW', name: 'Baden-Württemberg', short: 'BW', capital: 'Stuttgart', cap: [9.18, 48.776] },
  { id: 'DE-BY', name: 'Bayern', short: 'BY', capital: 'München', cap: [11.576, 48.137] },
  { id: 'DE-BE', name: 'Berlin', short: 'BE', capital: 'Berlin', cap: [13.405, 52.52], kind: 'Stadtstaat, Bundeshauptstadt' },
  { id: 'DE-BB', name: 'Brandenburg', short: 'BB', capital: 'Potsdam', cap: [13.064, 52.391] },
  { id: 'DE-ST', name: 'Sachsen-Anhalt', short: 'ST', capital: 'Magdeburg', cap: [11.628, 52.12] },
  { id: 'DE-SN', name: 'Sachsen', short: 'SN', capital: 'Dresden', cap: [13.737, 51.05] },
  { id: 'DE-TH', name: 'Thüringen', short: 'TH', capital: 'Erfurt', cap: [11.029, 50.978] },
]

const deStates: GeoItem[] = DE.map(s => ({
  key: s.id,
  label: s.name,
  group: 'alle',
  areas: [`adm1-DEU:${s.id}`],
  aliases: [s.short, ...(s.id === 'DE-NW' ? ['NRW'] : []), ...(s.id === 'DE-HB' ? ['Freie Hansestadt Bremen'] : [])],
  details: [
    { label: 'Hauptstadt', value: s.capital },
    { label: 'Kürzel', value: s.short },
    ...(s.kind ? [{ label: 'Art', value: s.kind }] : []),
  ],
  text: s.capital === s.name ? undefined : { prompt: `Landeshauptstadt von ${s.name}?`, answer: s.capital },
})).sort((a, b) => a.label.localeCompare(b.label, 'de'))

const deCapitals: GeoItem[] = DE.map(s => ({
  key: `lhs:${s.id}`,
  label: s.capital,
  prompt: s.capital,
  promptSub: 'Tippe auf das Bundesland',
  group: 'alle',
  areas: [`adm1-DEU:${s.id}`],
  point: s.cap,
  details: [{ label: 'Bundesland', value: s.name }],
  text: s.capital === s.name ? undefined : { prompt: `${s.capital} ist die Hauptstadt von …`, answer: s.name },
})).sort((a, b) => a.label.localeCompare(b.label, 'de'))

/* ───────────── Österreich ───────────── */

const AT_GROUPS: Record<string, GroupDef> = { alle: { name: 'Österreich', color: C.rose } }

const AT: { id: string; name: string; short: string; capital: string; cap: LonLat }[] = [
  { id: 'AT-9', name: 'Wien', short: 'W', capital: 'Wien', cap: [16.373, 48.208] },
  { id: 'AT-3', name: 'Niederösterreich', short: 'NÖ', capital: 'St. Pölten', cap: [15.626, 48.204] },
  { id: 'AT-1', name: 'Burgenland', short: 'B', capital: 'Eisenstadt', cap: [16.525, 47.846] },
  { id: 'AT-6', name: 'Steiermark', short: 'ST', capital: 'Graz', cap: [15.439, 47.071] },
  { id: 'AT-2', name: 'Kärnten', short: 'K', capital: 'Klagenfurt', cap: [14.305, 46.624] },
  { id: 'AT-4', name: 'Oberösterreich', short: 'OÖ', capital: 'Linz', cap: [14.286, 48.306] },
  { id: 'AT-5', name: 'Salzburg', short: 'S', capital: 'Salzburg', cap: [13.055, 47.809] },
  { id: 'AT-7', name: 'Tirol', short: 'T', capital: 'Innsbruck', cap: [11.393, 47.269] },
  { id: 'AT-8', name: 'Vorarlberg', short: 'V', capital: 'Bregenz', cap: [9.747, 47.505] },
]

const atStates: GeoItem[] = AT.map(s => ({
  key: s.id,
  label: s.name,
  group: 'alle',
  areas: [`adm1-AUT:${s.id}`],
  aliases: [s.short],
  details: [
    { label: 'Hauptstadt', value: s.capital },
    { label: 'Kürzel', value: s.short },
    ...(s.id === 'AT-7' ? [{ label: 'Hinweis', value: 'Osttirol liegt getrennt vom Rest Tirols – zwischen Salzburg und Kärnten.' }] : []),
  ],
  text: s.capital === s.name ? undefined : { prompt: `Landeshauptstadt von ${s.name}?`, answer: s.capital },
})).sort((a, b) => a.label.localeCompare(b.label, 'de'))

const atCapitals: GeoItem[] = AT.map(s => ({
  key: `lhs:${s.id}`,
  label: s.capital,
  prompt: s.capital,
  promptSub: 'Tippe auf das Bundesland',
  group: 'alle',
  areas: [`adm1-AUT:${s.id}`],
  point: s.cap,
  aliases: s.id === 'AT-2' ? ['Klagenfurt am Wörthersee'] : s.id === 'AT-3' ? ['Sankt Pölten', 'St Pölten'] : [],
  details: [{ label: 'Bundesland', value: s.name }],
  text: s.capital === s.name ? undefined : { prompt: `${s.capital} ist die Hauptstadt von …`, answer: s.name },
})).sort((a, b) => a.label.localeCompare(b.label, 'de'))

export const DACH_QUIZZES: QuizDef[] = [
  {
    slug: 'de-bundeslaender', title: 'Bundesländer Deutschland', meta: '16 Bundesländer',
    text: 'Alle 16 Bundesländer finden, benennen oder eintippen – mit Landeshauptstädten im Lernmodus.',
    bereich: 'europa', country: 'DEU', kind: 'regionen',
    askClick: 'Wo liegt das Bundesland?', askName: 'Wie heißt das markierte Bundesland?', askText: 'Welche Landeshauptstadt?',
    itemsNoun: 'Bundesländer', groups: DE_GROUPS, items: deStates, layers: ['adm1-DEU'], labelSize: 9,
    intro: 'Lernmodus – tippe auf ein Bundesland.',
  },
  {
    slug: 'de-landeshauptstaedte', title: 'Landeshauptstädte Deutschland', meta: '16 Landeshauptstädte',
    text: 'Von Kiel bis München: Zu jeder Landeshauptstadt das Bundesland finden.',
    bereich: 'europa', country: 'DEU', kind: 'hauptstaedte',
    askClick: 'In welchem Bundesland liegt die Stadt?', askName: 'Welche Landeshauptstadt hat das markierte Land?', askText: 'Welches Bundesland?',
    itemsNoun: 'Landeshauptstädte', groups: DE_GROUPS, items: deCapitals, layers: ['adm1-DEU'], labelSize: 9,
  },
  {
    slug: 'at-bundeslaender', title: 'Bundesländer Österreich', meta: '9 Bundesländer',
    text: 'Die neun Bundesländer – inklusive Osttirol, das getrennt vom Rest Tirols liegt.',
    bereich: 'europa', country: 'AUT', kind: 'regionen',
    askClick: 'Wo liegt das Bundesland?', askName: 'Wie heißt das markierte Bundesland?', askText: 'Welche Landeshauptstadt?',
    itemsNoun: 'Bundesländer', groups: AT_GROUPS, items: atStates, layers: ['adm1-AUT'], labelSize: 10,
    intro: 'Lernmodus – tippe auf ein Bundesland.',
  },
  {
    slug: 'at-landeshauptstaedte', title: 'Landeshauptstädte Österreich', meta: '9 Landeshauptstädte',
    text: 'Von Bregenz bis Eisenstadt: Zu jeder Hauptstadt das Bundesland finden.',
    bereich: 'europa', country: 'AUT', kind: 'hauptstaedte',
    askClick: 'In welchem Bundesland liegt die Stadt?', askName: 'Welche Landeshauptstadt hat das markierte Land?', askText: 'Welches Bundesland?',
    itemsNoun: 'Landeshauptstädte', groups: AT_GROUPS, items: atCapitals, layers: ['adm1-AUT'], labelSize: 10,
  },
]