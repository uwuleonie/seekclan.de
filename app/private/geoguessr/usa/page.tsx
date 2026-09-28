'use client'

// USA: 50 Bundesstaaten + Hauptstädte
// Karte: Natural Earth (Alaska und Hawaii als Einschub unten links)
// Regionen: Einteilung des U.S. Census Bureau (Northeast, Midwest, South, West)

import MapQuiz, { type QuizItem, type QuizScope } from '../_lib/MapQuiz'
import { GEO } from '../_data/usa-geo'

const GROUPS = {
  northeast: { name: 'Nordosten', color: '#d93690' },
  midwest: { name: 'Mittlerer Westen', color: '#7c4ae0' },
  south: { name: 'Süden', color: '#e0913a' },
  west: { name: 'Westen', color: '#3f9bb5' },
}

const REGION: Record<string, keyof typeof GROUPS> = {}
for (const s of ['CT', 'ME', 'MA', 'NH', 'RI', 'VT', 'NJ', 'NY', 'PA']) REGION[s] = 'northeast'
for (const s of ['IL', 'IN', 'MI', 'OH', 'WI', 'IA', 'KS', 'MN', 'MO', 'NE', 'ND', 'SD']) REGION[s] = 'midwest'
for (const s of ['DE', 'FL', 'GA', 'MD', 'NC', 'SC', 'VA', 'WV', 'AL', 'KY', 'MS', 'TN', 'AR', 'LA', 'OK', 'TX']) REGION[s] = 'south'
for (const s of ['AZ', 'CO', 'ID', 'MT', 'NV', 'NM', 'UT', 'WY', 'AK', 'CA', 'HI', 'OR', 'WA']) REGION[s] = 'west'

// Deutsche Namen, wo sie sich unterscheiden
const DE: Record<string, string> = { California: 'Kalifornien', 'North Carolina': 'North Carolina', 'South Carolina': 'South Carolina' }

const shapes = GEO.states.map(s => ({ key: s.key, d: s.d, lx: s.lx, ly: s.ly }))
const capitalOf = Object.fromEntries(GEO.capitals.map(c => [c.state, c]))

// Washington D.C. ist kein Bundesstaat → nur als Fläche, nicht abgefragt
const STATES = GEO.states.filter(s => s.key !== 'DC').sort((a, b) => a.name.localeCompare(b.name))

const stateItems: QuizItem[] = STATES.map(s => {
  const cap = capitalOf[s.name]
  return {
    key: s.key,
    label: s.name,
    group: REGION[s.key],
    shapes: [s.key],
    details: [
      { label: 'Kürzel', value: s.key },
      ...(DE[s.name] && DE[s.name] !== s.name ? [{ label: 'Deutsch', value: DE[s.name] }] : []),
      ...(cap ? [{ label: 'Hauptstadt', value: cap.name }] : []),
      { label: 'Region', value: GROUPS[REGION[s.key]].name },
    ],
    text: cap ? { prompt: `Hauptstadt von ${s.name}?`, answer: cap.name } : undefined,
  }
})

const capitalItems: QuizItem[] = STATES.filter(s => capitalOf[s.name]).map(s => {
  const cap = capitalOf[s.name]
  return {
    key: s.key,
    label: cap.name,
    prompt: cap.name,
    promptSub: 'Tippe auf den Bundesstaat',
    group: REGION[s.key],
    shapes: [s.key],
    point: [cap.x, cap.y],
    details: [
      { label: 'Bundesstaat', value: `${s.name} (${s.key})` },
      { label: 'Region', value: GROUPS[REGION[s.key]].name },
    ],
    text: { prompt: `${cap.name} ist die Hauptstadt von …`, answer: s.name },
  }
})

const SCOPES: QuizScope[] = [
  {
    key: 'states', label: '50 Staaten', itemsNoun: 'Staaten',
    askClick: 'Wo liegt der Bundesstaat?', askName: 'Wie heißt der markierte Staat?', askText: 'Welche Hauptstadt?',
    shapes, items: stateItems, groups: GROUPS, labelSize: 7,
  },
  {
    key: 'capitals', label: 'Hauptstädte', itemsNoun: 'Hauptstädte',
    askClick: 'In welchem Staat liegt die Hauptstadt?', askName: 'Welche Hauptstadt hat der markierte Staat?', askText: 'Welcher Staat?',
    shapes, items: capitalItems, groups: GROUPS, labelSize: 6.5,
  },
]

export default function UsaPage() {
  return (
    <MapQuiz
      title="USA"
      storageKey="usa"
      viewBox={GEO.viewBox}
      scopes={SCOPES}
      intro="Lernmodus – tippe auf einen Staat. Alaska und Hawaii sind unten links eingeblendet."
    />
  )
}