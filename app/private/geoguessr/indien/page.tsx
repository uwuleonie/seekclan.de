'use client'

// Indien: 36 Bundesstaaten/Unionsterritorien + Hauptsprachen mit Beispielwörtern in ihrer Schrift
// Karte: Natural Earth. Sprachzuordnung = jeweilige Haupt-/Amtssprache (vereinfacht, viele Staaten sind mehrsprachig).

import MapQuiz, { type QuizItem, type QuizScope } from '../_lib/MapQuiz'
import { GEO } from '../_data/india-geo'

interface Lang {
  name: string
  color: string
  script: string
  hello: string
  thanks: string
  /** Aussprache in lateinischer Schrift */
  latin: string
  tip: string
}

const LANGS: Record<string, Lang> = {
  hindi: { name: 'Hindi', color: '#d93690', script: 'Devanagari', hello: 'नमस्ते', thanks: 'धन्यवाद', latin: 'namaste · dhanyavaad',
    tip: 'Durchgehender Strich oben über den Wörtern (Shirorekha).' },
  bengali: { name: 'Bengalisch', color: '#e0913a', script: 'Bengalisch', hello: 'নমস্কার', thanks: 'ধন্যবাদ', latin: 'nomoshkar · dhonnobad',
    tip: 'Strich oben wie Hindi, aber mit spitzen, dreieckigen Formen.' },
  assamese: { name: 'Assamesisch', color: '#ee8a5a', script: 'Assamesisch (Bengalisch)', hello: 'নমস্কাৰ', thanks: 'ধন্যবাদ', latin: 'nomoskar · dhonnobad',
    tip: 'Fast wie Bengalisch – verräterisch sind die Buchstaben ৰ und ৱ.' },
  odia: { name: 'Odia', color: '#c07bd8', script: 'Odia', hello: 'ନମସ୍କାର', thanks: 'ଧନ୍ୟବାଦ', latin: 'nomoskaro · dhonyobado',
    tip: 'Runde Bögen oben auf fast jedem Buchstaben – wie kleine Schirme.' },
  telugu: { name: 'Telugu', color: '#5b6ee8', script: 'Telugu', hello: 'నమస్కారం', thanks: 'ధన్యవాదాలు', latin: 'namaskaaram · dhanyavaadaalu',
    tip: 'Rund, mit kleinen Häkchen oben auf den Buchstaben.' },
  kannada: { name: 'Kannada', color: '#3f9bb5', script: 'Kannada', hello: 'ನಮಸ್ಕಾರ', thanks: 'ಧನ್ಯವಾದಗಳು', latin: 'namaskaara · dhanyavaadagalu',
    tip: 'Sehr ähnlich zu Telugu, die Haken oben sind eckiger und gehen nach rechts.' },
  tamil: { name: 'Tamil', color: '#25845c', script: 'Tamil', hello: 'வணக்கம்', thanks: 'நன்றி', latin: 'vanakkam · nandri',
    tip: 'Kein Strich oben, eher eckig-rund mit vielen Schleifen unten – wirkt "einfacher".' },
  malayalam: { name: 'Malayalam', color: '#1f8a6e', script: 'Malayalam', hello: 'നമസ്കാരം', thanks: 'നന്ദി', latin: 'namaskaaram · nandi',
    tip: 'Sehr rund und breit, lange zusammenhängende Schlaufen.' },
  marathi: { name: 'Marathi', color: '#a93bc9', script: 'Devanagari', hello: 'नमस्कार', thanks: 'धन्यवाद', latin: 'namaskaar · dhanyavaad',
    tip: 'Gleiche Schrift wie Hindi – der Buchstabe ळ kommt fast nur im Marathi vor.' },
  gujarati: { name: 'Gujarati', color: '#e36aa8', script: 'Gujarati', hello: 'નમસ્તે', thanks: 'આભાર', latin: 'namaste · aabhaar',
    tip: 'Sieht aus wie Hindi OHNE den Strich oben.' },
  punjabi: { name: 'Panjabi', color: '#7c4ae0', script: 'Gurmukhi', hello: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ', thanks: 'ਧੰਨਵਾਦ', latin: 'sat sri akaal · dhannvaad',
    tip: 'Strich oben, aber kantige Buchstaben wie ੳ und ਅ.' },
  konkani: { name: 'Konkani', color: '#b85c9e', script: 'Devanagari (auch Latein)', hello: 'नमस्कार', thanks: 'देव बरें करूं', latin: 'namaskaar · dev borem korum',
    tip: 'Goa: Devanagari, aber auch viel lateinische Schrift und Portugiesisch-Einflüsse.' },
  urdu: { name: 'Urdu / Kashmiri', color: '#4d7c8a', script: 'Arabisch (Nastaliq)', hello: 'السلام علیکم', thanks: 'شکریہ', latin: 'assalaam alaikum · shukriya',
    tip: 'Arabische Schrift, von rechts nach links.' },
  nepali: { name: 'Nepali', color: '#8a5a2b', script: 'Devanagari', hello: 'नमस्ते', thanks: 'धन्यवाद', latin: 'namaste · dhanyabaad',
    tip: 'Devanagari wie Hindi – in Sikkim oft neben Englisch.' },
  tibetan: { name: 'Ladakhi', color: '#6b6477', script: 'Tibetisch', hello: 'ཇུ་ལེ།', thanks: 'ཇུ་ལེ།', latin: 'juley (Hallo und Danke)',
    tip: 'Tibetische Schrift mit Punkten zwischen den Silben.' },
  meitei: { name: 'Meitei (Manipuri)', color: '#c0344f', script: 'Meitei Mayek / Bengalisch', hello: 'Khurumjari', thanks: 'Thagatchari', latin: 'khurumjari · thagatchari',
    tip: 'Eigene Schrift Meitei Mayek, früher Bengalisch.' },
  english: { name: 'Englisch & lokale Sprachen', color: '#9aa0b5', script: 'Lateinisch', hello: 'Hello', thanks: 'Thank you', latin: 'z.B. Mizo "Chibai", Khasi "Khublei"',
    tip: 'Nordosten: Schilder oft in lateinischer Schrift (Mizo, Khasi, Nagamese, Englisch).' },
}

/** Bundesstaat → Hauptsprache */
const STATE_LANG: Record<string, keyof typeof LANGS> = {
  'Uttar Pradesh': 'hindi', Bihar: 'hindi', 'Madhya Pradesh': 'hindi', Rajasthan: 'hindi', Haryana: 'hindi', Delhi: 'hindi',
  Uttarakhand: 'hindi', 'Himachal Pradesh': 'hindi', Jharkhand: 'hindi', Chhattisgarh: 'hindi', Chandigarh: 'hindi',
  'Andaman and Nicobar': 'hindi',
  'West Bengal': 'bengali', Tripura: 'bengali',
  Assam: 'assamese', Odisha: 'odia',
  'Andhra Pradesh': 'telugu', Telangana: 'telugu',
  Karnataka: 'kannada',
  'Tamil Nadu': 'tamil', Puducherry: 'tamil',
  Kerala: 'malayalam', Lakshadweep: 'malayalam',
  Maharashtra: 'marathi',
  Gujarat: 'gujarati', 'Dadra and Nagar Haveli and Daman and Diu': 'gujarati',
  Punjab: 'punjabi', Goa: 'konkani',
  'Jammu and Kashmir': 'urdu', Ladakh: 'tibetan', Sikkim: 'nepali', Manipur: 'meitei',
  Mizoram: 'english', Nagaland: 'english', Meghalaya: 'english', 'Arunachal Pradesh': 'english',
}

/** Hauptstädte (Stand 2024) */
const CAPITAL: Record<string, string> = {
  'Andhra Pradesh': 'Amaravati', 'Arunachal Pradesh': 'Itanagar', Assam: 'Dispur', Bihar: 'Patna', Chhattisgarh: 'Raipur',
  Goa: 'Panaji', Gujarat: 'Gandhinagar', Haryana: 'Chandigarh', 'Himachal Pradesh': 'Shimla', Jharkhand: 'Ranchi',
  Karnataka: 'Bengaluru', Kerala: 'Thiruvananthapuram', 'Madhya Pradesh': 'Bhopal', Maharashtra: 'Mumbai', Manipur: 'Imphal',
  Meghalaya: 'Shillong', Mizoram: 'Aizawl', Nagaland: 'Kohima', Odisha: 'Bhubaneswar', Punjab: 'Chandigarh',
  Rajasthan: 'Jaipur', Sikkim: 'Gangtok', 'Tamil Nadu': 'Chennai', Telangana: 'Hyderabad', Tripura: 'Agartala',
  'Uttar Pradesh': 'Lucknow', Uttarakhand: 'Dehradun', 'West Bengal': 'Kolkata', Delhi: 'Neu-Delhi', Puducherry: 'Puducherry',
  'Jammu and Kashmir': 'Srinagar / Jammu', Ladakh: 'Leh', Chandigarh: 'Chandigarh', Lakshadweep: 'Kavaratti',
  'Andaman and Nicobar': 'Port Blair', 'Dadra and Nagar Haveli and Daman and Diu': 'Daman',
}
const UT = new Set(['Delhi', 'Puducherry', 'Jammu and Kashmir', 'Ladakh', 'Chandigarh', 'Lakshadweep', 'Andaman and Nicobar', 'Dadra and Nagar Haveli and Daman and Diu'])

const shapes = GEO.states.map(s => ({ key: s.key, d: s.d, lx: s.lx, ly: s.ly }))
const GROUPS = Object.fromEntries(Object.entries(LANGS).map(([k, l]) => [k, { name: l.name, color: l.color }]))

const stateItems: QuizItem[] = GEO.states.map(s => {
  const lk = STATE_LANG[s.key] ?? 'hindi'
  const l = LANGS[lk]
  return {
    key: s.key,
    label: s.key,
    group: lk,
    shapes: [s.key],
    details: [
      { label: 'Art', value: UT.has(s.key) ? 'Unionsterritorium' : 'Bundesstaat' },
      ...(CAPITAL[s.key] ? [{ label: 'Hauptstadt', value: CAPITAL[s.key] }] : []),
      { label: 'Hauptsprache', value: l.name },
      { label: 'Schrift', value: l.script },
      { label: 'Hallo', value: l.hello, big: true },
    ],
    text: { prompt: `Hauptsprache in ${s.key}?`, answer: l.name },
  }
}).sort((a, b) => a.label.localeCompare(b.label))

const langItems: QuizItem[] = Object.entries(LANGS).map(([k, l]) => ({
  key: k,
  label: l.name,
  prompt: l.name,
  promptSub: `Schrift: ${l.script}`,
  group: k,
  shapes: Object.entries(STATE_LANG).filter(([, v]) => v === k).map(([s]) => s),
  details: [
    { label: 'Schrift', value: l.script },
    { label: 'Hallo', value: l.hello, big: true },
    ...(l.thanks !== l.hello ? [{ label: 'Danke', value: l.thanks, big: true }] : []),
    { label: 'Aussprache', value: l.latin },
    { label: 'Erkennen', value: l.tip },
  ],
  // Nur Einträge mit Wörtern in der echten Schrift (nicht in Umschrift) kommen ins Schrift-Quiz
  text: /[a-z]/i.test(l.hello) ? undefined : { prompt: l.thanks !== l.hello ? `${l.hello} · ${l.thanks}` : l.hello, sub: 'Welche Sprache / Schrift ist das?', answer: l.name, big: true },
}))

const SCOPES: QuizScope[] = [
  {
    key: 'langs', label: 'Sprachen', itemsNoun: 'Sprachen',
    askClick: 'Wo spricht man diese Sprache?', askName: 'Welche Sprache spricht man im markierten Gebiet?', askText: 'Welche Schrift?',
    shapes, items: langItems, groups: GROUPS, labelSize: 9,
  },
  {
    key: 'states', label: '36 Staaten', itemsNoun: 'Staaten & Gebiete',
    askClick: 'Wo liegt der Bundesstaat?', askName: 'Wie heißt der markierte Bundesstaat?', askText: 'Welche Sprache?',
    shapes, items: stateItems, groups: GROUPS, labelSize: 7.5,
  },
]

export default function IndiaPage() {
  return (
    <MapQuiz
      title="Indien"
      storageKey="indien"
      viewBox={GEO.viewBox}
      scopes={SCOPES}
      intro="Lernmodus – tippe auf ein Gebiet, um Sprache, Schrift und Beispielwörter zu sehen."
      tips={() => (
        <div className="pv-glass pv-card" style={{ fontSize: 13.5 }}>
          <p className="pv-label" style={{ marginBottom: 6 }}>Hinweis</p>
          <div className="pv-muted">
            Vereinfacht: Jeder Staat hat hier eine Hauptsprache. In Wirklichkeit sind viele Staaten mehrsprachig,
            und Englisch steht fast überall mit auf den Schildern.
          </div>
        </div>
      )}
    />
  )
}