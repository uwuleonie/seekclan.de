'use client'

// Brasilien: 27 Bundesstaaten + 67 Telefon-Vorwahlen (DDD)
// Vorwahl je Gemeinde: github.com/kelvins/municipios-brasileiros · Grenzen: IBGE via github.com/tbrugz/geodata-br

import MapQuiz, { type QuizItem, type QuizScope } from '../_lib/MapQuiz'
import { GEO } from '../_data/brazil-geo'

/** IBGE-Code → Kürzel, Name, Hauptstadt, Großregion */
const UF: Record<string, { sigla: string; name: string; capital: string; region: string }> = {
  '11': { sigla: 'RO', name: 'Rondônia', capital: 'Porto Velho', region: 'N' },
  '12': { sigla: 'AC', name: 'Acre', capital: 'Rio Branco', region: 'N' },
  '13': { sigla: 'AM', name: 'Amazonas', capital: 'Manaus', region: 'N' },
  '14': { sigla: 'RR', name: 'Roraima', capital: 'Boa Vista', region: 'N' },
  '15': { sigla: 'PA', name: 'Pará', capital: 'Belém', region: 'N' },
  '16': { sigla: 'AP', name: 'Amapá', capital: 'Macapá', region: 'N' },
  '17': { sigla: 'TO', name: 'Tocantins', capital: 'Palmas', region: 'N' },
  '21': { sigla: 'MA', name: 'Maranhão', capital: 'São Luís', region: 'NE' },
  '22': { sigla: 'PI', name: 'Piauí', capital: 'Teresina', region: 'NE' },
  '23': { sigla: 'CE', name: 'Ceará', capital: 'Fortaleza', region: 'NE' },
  '24': { sigla: 'RN', name: 'Rio Grande do Norte', capital: 'Natal', region: 'NE' },
  '25': { sigla: 'PB', name: 'Paraíba', capital: 'João Pessoa', region: 'NE' },
  '26': { sigla: 'PE', name: 'Pernambuco', capital: 'Recife', region: 'NE' },
  '27': { sigla: 'AL', name: 'Alagoas', capital: 'Maceió', region: 'NE' },
  '28': { sigla: 'SE', name: 'Sergipe', capital: 'Aracaju', region: 'NE' },
  '29': { sigla: 'BA', name: 'Bahia', capital: 'Salvador', region: 'NE' },
  '31': { sigla: 'MG', name: 'Minas Gerais', capital: 'Belo Horizonte', region: 'SE' },
  '32': { sigla: 'ES', name: 'Espírito Santo', capital: 'Vitória', region: 'SE' },
  '33': { sigla: 'RJ', name: 'Rio de Janeiro', capital: 'Rio de Janeiro', region: 'SE' },
  '35': { sigla: 'SP', name: 'São Paulo', capital: 'São Paulo', region: 'SE' },
  '41': { sigla: 'PR', name: 'Paraná', capital: 'Curitiba', region: 'S' },
  '42': { sigla: 'SC', name: 'Santa Catarina', capital: 'Florianópolis', region: 'S' },
  '43': { sigla: 'RS', name: 'Rio Grande do Sul', capital: 'Porto Alegre', region: 'S' },
  '50': { sigla: 'MS', name: 'Mato Grosso do Sul', capital: 'Campo Grande', region: 'CO' },
  '51': { sigla: 'MT', name: 'Mato Grosso', capital: 'Cuiabá', region: 'CO' },
  '52': { sigla: 'GO', name: 'Goiás', capital: 'Goiânia', region: 'CO' },
  '53': { sigla: 'DF', name: 'Distrito Federal', capital: 'Brasília', region: 'CO' },
}

const REGIONS = {
  N: { name: 'Norden', color: '#25845c' },
  NE: { name: 'Nordosten', color: '#e0913a' },
  CO: { name: 'Zentral-Westen', color: '#c07bd8' },
  SE: { name: 'Südosten', color: '#d93690' },
  S: { name: 'Süden', color: '#5b6ee8' },
}

/** Erste Ziffer der Vorwahl = Gebiet (so ist der DDD-Plan aufgebaut) */
const DIGITS = {
  '1': { name: '1x · São Paulo', color: '#d93690' },
  '2': { name: '2x · Rio de Janeiro, Espírito Santo', color: '#e36aa8' },
  '3': { name: '3x · Minas Gerais', color: '#a93bc9' },
  '4': { name: '4x · Paraná, Santa Catarina', color: '#5b6ee8' },
  '5': { name: '5x · Rio Grande do Sul', color: '#3f9bb5' },
  '6': { name: '6x · Zentral-Westen, Tocantins, Acre, Rondônia', color: '#c07bd8' },
  '7': { name: '7x · Bahia, Sergipe', color: '#e0913a' },
  '8': { name: '8x · Nordosten (PE, AL, PB, RN, CE, PI)', color: '#ee8a5a' },
  '9': { name: '9x · Norden, Maranhão', color: '#25845c' },
}

// DDD 61 gehört zu Brasília (DF), auch wenn umliegende Orte in Goiás liegen
const ufOfDdd = (d: { key: string; uf: string }) => (d.key === '61' ? '53' : d.uf)

const dddByUf: Record<string, string[]> = {}
for (const d of GEO.ddd) (dddByUf[ufOfDdd(d)] ??= []).push(d.key)

const dddItems: QuizItem[] = [...GEO.ddd].sort((a, b) => a.key.localeCompare(b.key)).map(d => {
  const uf = UF[ufOfDdd(d)]
  return {
    key: d.key,
    label: d.key,
    prompt: `DDD ${d.key}`,
    promptSub: d.cities.length ? `z.B. ${d.cities.slice(0, 2).join(', ')}` : undefined,
    group: d.key[0],
    shapes: [d.key],
    details: [
      { label: 'Vorwahl', value: `(${d.key})`, big: true },
      { label: 'Bundesstaat', value: `${uf.name} (${uf.sigla})` },
      ...(d.cities.length ? [{ label: 'Städte', value: d.cities.join(', ') }] : []),
      ...(d.key === '61' ? [{ label: 'Hinweis', value: 'Gilt auch für Orte in Goiás rund um Brasília' }] : []),
    ],
    text: { prompt: `(${d.key})`, sub: 'Zu welchem Bundesstaat gehört diese Vorwahl?', answer: uf.name, big: true },
  }
})

const ufItems: QuizItem[] = GEO.uf.map(u => {
  const s = UF[u.key]
  return {
    key: u.key,
    label: s.name,
    group: s.region,
    shapes: [u.key],
    details: [
      { label: 'Kürzel', value: s.sigla },
      { label: 'Hauptstadt', value: s.capital },
      { label: 'Vorwahlen', value: (dddByUf[u.key] ?? []).sort().join(', ') },
      { label: 'Region', value: REGIONS[s.region as keyof typeof REGIONS].name },
    ],
    text: { prompt: `Hauptstadt von ${s.name}?`, answer: s.capital },
  }
}).sort((a, b) => a.label.localeCompare(b.label))

const SCOPES: QuizScope[] = [
  {
    key: 'ddd', label: '67 Vorwahlen', itemsNoun: 'Vorwahlen',
    askClick: 'Wo gilt diese Vorwahl?', askName: 'Welche Vorwahl hat das markierte Gebiet?', askText: 'Welcher Bundesstaat?',
    shapes: GEO.ddd.map(d => ({ key: d.key, d: d.d, lx: d.lx, ly: d.ly })), items: dddItems, groups: DIGITS, labelSize: 11,
  },
  {
    key: 'uf', label: '27 Bundesstaaten', itemsNoun: 'Bundesstaaten',
    askClick: 'Wo liegt der Bundesstaat?', askName: 'Wie heißt der markierte Bundesstaat?', askText: 'Welche Hauptstadt?',
    shapes: GEO.uf.map(u => ({ key: u.key, d: u.d, lx: u.lx, ly: u.ly })), items: ufItems, groups: REGIONS, labelSize: 9,
  },
]

export default function BrazilPage() {
  return (
    <MapQuiz
      title="Brasilien"
      storageKey="brasilien"
      viewBox={GEO.viewBox}
      scopes={SCOPES}
      intro="Lernmodus – tippe auf ein Gebiet. Die erste Ziffer der Vorwahl verrät die Gegend."
      tips={scope => scope.key === 'ddd' ? (
        <div className="pv-glass pv-card" style={{ fontSize: 13.5 }}>
          <p className="pv-label" style={{ marginBottom: 6 }}>Tipp für GeoGuessr</p>
          <div className="pv-muted">
            Vorwahlen stehen oft auf Schildern, Geschäften und Werbung als <b>(xx)</b> vor der Nummer.
            Die erste Ziffer grenzt die Gegend schon stark ein – siehe Farben links.
          </div>
        </div>
      ) : null}
    />
  )
}