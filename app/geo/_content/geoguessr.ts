// Übernommen aus dem GeoGuessr-Lernbereich (/private/geoguessr): USA, Brasilien, Indien, Türkei, Japan.
// Inhalte (Sprachen, Vorwahlen, Kennzeichen, Regionen, Tipps) 1:1 wie auf der Privatseite,
// die Karten sind jetzt echte Koordinaten (Natural Earth) – dadurch mit allem anderen kombinierbar.

import { ADM1 } from '../_data/adm1'
import { BR_DDD } from '../_data/br-ddd'
import { PLACES } from '../_data/places'
import type { GeoItem, GroupDef, LonLat, QuizDef } from '../_lib/types'
import { C } from './palette'

/* ═══════════════ USA ═══════════════ */

// Keine Einteilung nach Himmelsrichtungen – jeder Staat bekommt seine eigene Atlas-Farbe.
// Die Census-Region steht weiter im Lernmodus als Info.
const US_GROUPS: Record<string, GroupDef> = { alle: { name: 'USA', color: C.blue } }
const US_REGION_NAME: Record<string, string> = { northeast: 'Nordosten', midwest: 'Mittlerer Westen', south: 'Süden', west: 'Westen' }
const US_REGION: Record<string, string> = {}
for (const s of ['CT', 'ME', 'MA', 'NH', 'RI', 'VT', 'NJ', 'NY', 'PA']) US_REGION[s] = 'northeast'
for (const s of ['IL', 'IN', 'MI', 'OH', 'WI', 'IA', 'KS', 'MN', 'MO', 'NE', 'ND', 'SD']) US_REGION[s] = 'midwest'
for (const s of ['DE', 'FL', 'GA', 'MD', 'NC', 'SC', 'VA', 'WV', 'AL', 'KY', 'MS', 'TN', 'AR', 'LA', 'OK', 'TX']) US_REGION[s] = 'south'
for (const s of ['AZ', 'CO', 'ID', 'MT', 'NV', 'NM', 'UT', 'WY', 'AK', 'CA', 'HI', 'OR', 'WA']) US_REGION[s] = 'west'
const US_DE: Record<string, string> = { California: 'Kalifornien' }

const US = ADM1.USA.filter(s => s.id !== 'US-DC')
const usStates: GeoItem[] = US.map(s => {
  const code = s.id.slice(3)
  return {
    key: s.id,
    label: s.name,
    group: 'alle',
    areas: [`adm1-USA:${s.id}`],
    aliases: [code, ...(US_DE[s.name] ? [US_DE[s.name]] : [])],
    details: [
      { label: 'Kürzel', value: code },
      ...(US_DE[s.name] ? [{ label: 'Deutsch', value: US_DE[s.name] }] : []),
      ...(s.capital ? [{ label: 'Hauptstadt', value: s.capital.name }] : []),
      { label: 'Region (Census)', value: US_REGION_NAME[US_REGION[code]] },
    ],
    text: s.capital ? { prompt: `Hauptstadt von ${s.name}?`, answer: s.capital.name } : undefined,
  }
}).sort((a, b) => a.label.localeCompare(b.label))

const usCapitals: GeoItem[] = US.filter(s => s.capital).map(s => {
  const code = s.id.slice(3)
  return {
    key: `hs:${s.id}`,
    label: s.capital!.name,
    prompt: s.capital!.name,
    promptSub: 'Tippe auf den Bundesstaat',
    group: 'alle',
    areas: [`adm1-USA:${s.id}`],
    point: s.capital!.ll,
    aliases: s.capital!.name === 'Saint Paul' ? ['St. Paul'] : [],
    details: [{ label: 'Bundesstaat', value: `${s.name} (${code})` }, { label: 'Region (Census)', value: US_REGION_NAME[US_REGION[code]] }],
    text: { prompt: `${s.capital!.name} ist die Hauptstadt von …`, answer: s.name },
  }
}).sort((a, b) => a.label.localeCompare(b.label))

/* ═══════════════ Brasilien ═══════════════ */

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
const BR_REGIONS: Record<string, GroupDef> = {
  N: { name: 'Norden', color: C.green },
  NE: { name: 'Nordosten', color: C.ochre },
  CO: { name: 'Zentral-Westen', color: C.plum },
  SE: { name: 'Südosten', color: C.rose },
  S: { name: 'Süden', color: C.indigo },
}
/** Erste Ziffer der Vorwahl = Gebiet (so ist der DDD-Plan aufgebaut) */
const BR_DIGITS: Record<string, GroupDef> = {
  '1': { name: '1x · São Paulo', color: C.rose },
  '2': { name: '2x · Rio de Janeiro, Espírito Santo', color: C.coral },
  '3': { name: '3x · Minas Gerais', color: C.plum },
  '4': { name: '4x · Paraná, Santa Catarina', color: C.indigo },
  '5': { name: '5x · Rio Grande do Sul', color: C.blue },
  '6': { name: '6x · Zentral-Westen, Tocantins, Acre, Rondônia', color: C.wine },
  '7': { name: '7x · Bahia, Sergipe', color: C.ochre },
  '8': { name: '8x · Nordosten (PE, AL, PB, RN, CE, PI)', color: C.terra },
  '9': { name: '9x · Norden, Maranhão', color: C.green },
}
// DDD 61 gehört zu Brasília (DF), auch wenn umliegende Orte in Goiás liegen
const ufOfDdd = (d: { key: string; uf: string }) => (d.key === '61' ? '53' : d.uf)
const dddByUf: Record<string, string[]> = {}
for (const d of BR_DDD) (dddByUf[ufOfDdd(d)] ??= []).push(d.key)

const brDdd: GeoItem[] = [...BR_DDD].sort((a, b) => a.key.localeCompare(b.key)).map(d => {
  const uf = UF[ufOfDdd(d)]
  return {
    key: `ddd:${d.key}`,
    label: d.key,
    prompt: `DDD ${d.key}`,
    promptSub: d.cities.length ? `z.B. ${d.cities.slice(0, 2).join(', ')}` : undefined,
    group: d.key[0],
    areas: [`br-ddd:${d.key}`],
    details: [
      { label: 'Vorwahl', value: `(${d.key})`, big: true },
      { label: 'Bundesstaat', value: `${uf.name} (${uf.sigla})` },
      ...(d.cities.length ? [{ label: 'Städte', value: d.cities.join(', ') }] : []),
      ...(d.key === '61' ? [{ label: 'Hinweis', value: 'Gilt auch für Orte in Goiás rund um Brasília' }] : []),
    ],
    text: { prompt: `(${d.key})`, sub: 'Zu welchem Bundesstaat gehört diese Vorwahl?', answer: uf.name, big: true },
  }
})

const brStates: GeoItem[] = Object.entries(UF).map(([code, s]) => ({
  key: `BR-${s.sigla}`,
  label: s.name,
  group: s.region,
  areas: [`adm1-BRA:BR-${s.sigla}`],
  aliases: [s.sigla],
  details: [
    { label: 'Kürzel', value: s.sigla },
    { label: 'Hauptstadt', value: s.capital },
    { label: 'Vorwahlen', value: (dddByUf[code] ?? []).sort().join(', ') },
    { label: 'Region', value: BR_REGIONS[s.region].name },
  ],
  text: { prompt: `Hauptstadt von ${s.name}?`, answer: s.capital },
})).sort((a, b) => a.label.localeCompare(b.label))

/* ═══════════════ Indien ═══════════════ */

interface Lang { name: string; color: string; script: string; hello: string; thanks: string; latin: string; tip: string }
const LANGS: Record<string, Lang> = {
  hindi: { name: 'Hindi', color: C.rose, script: 'Devanagari', hello: 'नमस्ते', thanks: 'धन्यवाद', latin: 'namaste · dhanyavaad', tip: 'Durchgehender Strich oben über den Wörtern (Shirorekha).' },
  bengali: { name: 'Bengalisch', color: C.ochre, script: 'Bengalisch', hello: 'নমস্কার', thanks: 'ধন্যবাদ', latin: 'nomoshkar · dhonnobad', tip: 'Strich oben wie Hindi, aber mit spitzen, dreieckigen Formen.' },
  assamese: { name: 'Assamesisch', color: C.coral, script: 'Assamesisch (Bengalisch)', hello: 'নমস্কাৰ', thanks: 'ধন্যবাদ', latin: 'nomoskar · dhonnobad', tip: 'Fast wie Bengalisch – verräterisch sind die Buchstaben ৰ und ৱ.' },
  odia: { name: 'Odia', color: C.plum, script: 'Odia', hello: 'ନମସ୍କାର', thanks: 'ଧନ୍ୟବାଦ', latin: 'nomoskaro · dhonyobado', tip: 'Runde Bögen oben auf fast jedem Buchstaben – wie kleine Schirme.' },
  telugu: { name: 'Telugu', color: C.indigo, script: 'Telugu', hello: 'నమస్కారం', thanks: 'ధన్యవాదాలు', latin: 'namaskaaram · dhanyavaadaalu', tip: 'Rund, mit kleinen Häkchen oben auf den Buchstaben.' },
  kannada: { name: 'Kannada', color: C.blue, script: 'Kannada', hello: 'ನಮಸ್ಕಾರ', thanks: 'ಧನ್ಯವಾದಗಳು', latin: 'namaskaara · dhanyavaadagalu', tip: 'Sehr ähnlich zu Telugu, die Haken oben sind eckiger und gehen nach rechts.' },
  tamil: { name: 'Tamil', color: C.green, script: 'Tamil', hello: 'வணக்கம்', thanks: 'நன்றி', latin: 'vanakkam · nandri', tip: 'Kein Strich oben, eher eckig-rund mit vielen Schleifen unten – wirkt "einfacher".' },
  malayalam: { name: 'Malayalam', color: C.teal, script: 'Malayalam', hello: 'നമസ്കാരം', thanks: 'നന്ദി', latin: 'namaskaaram · nandi', tip: 'Sehr rund und breit, lange zusammenhängende Schlaufen.' },
  marathi: { name: 'Marathi', color: C.wine, script: 'Devanagari', hello: 'नमस्कार', thanks: 'धन्यवाद', latin: 'namaskaar · dhanyavaad', tip: 'Gleiche Schrift wie Hindi – der Buchstabe ळ kommt fast nur im Marathi vor.' },
  gujarati: { name: 'Gujarati', color: C.terra, script: 'Gujarati', hello: 'નમસ્તે', thanks: 'આભાર', latin: 'namaste · aabhaar', tip: 'Sieht aus wie Hindi OHNE den Strich oben.' },
  punjabi: { name: 'Panjabi', color: C.moss, script: 'Gurmukhi', hello: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ', thanks: 'ਧੰਨਵਾਦ', latin: 'sat sri akaal · dhannvaad', tip: 'Strich oben, aber kantige Buchstaben wie ੳ und ਅ.' },
  konkani: { name: 'Konkani', color: C.sky, script: 'Devanagari (auch Latein)', hello: 'नमस्कार', thanks: 'देव बरें करूं', latin: 'namaskaar · dev borem korum', tip: 'Goa: Devanagari, aber auch viel lateinische Schrift und Portugiesisch-Einflüsse.' },
  urdu: { name: 'Urdu / Kashmiri', color: C.slate, script: 'Arabisch (Nastaliq)', hello: 'السلام علیکم', thanks: 'شکریہ', latin: 'assalaam alaikum · shukriya', tip: 'Arabische Schrift, von rechts nach links.' },
  nepali: { name: 'Nepali', color: C.brown, script: 'Devanagari', hello: 'नमस्ते', thanks: 'धन्यवाद', latin: 'namaste · dhanyabaad', tip: 'Devanagari wie Hindi – in Sikkim oft neben Englisch.' },
  tibetan: { name: 'Ladakhi', color: C.sand, script: 'Tibetisch', hello: 'ཇུ་ལེ།', thanks: 'ཇུ་ལེ།', latin: 'juley (Hallo und Danke)', tip: 'Tibetische Schrift mit Punkten zwischen den Silben.' },
  meitei: { name: 'Meitei (Manipuri)', color: '#a83a3a', script: 'Meitei Mayek / Bengalisch', hello: 'Khurumjari', thanks: 'Thagatchari', latin: 'khurumjari · thagatchari', tip: 'Eigene Schrift Meitei Mayek, früher Bengalisch.' },
  english: { name: 'Englisch & lokale Sprachen', color: '#8d939c', script: 'Lateinisch', hello: 'Hello', thanks: 'Thank you', latin: 'z.B. Mizo "Chibai", Khasi "Khublei"', tip: 'Nordosten: Schilder oft in lateinischer Schrift (Mizo, Khasi, Nagamese, Englisch).' },
}
/** Bundesstaat → Hauptsprache (vereinfacht) */
const STATE_LANG: Record<string, string> = {
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
const IN_CAPITAL: Record<string, string> = {
  'Andhra Pradesh': 'Amaravati', 'Arunachal Pradesh': 'Itanagar', Assam: 'Dispur', Bihar: 'Patna', Chhattisgarh: 'Raipur',
  Goa: 'Panaji', Gujarat: 'Gandhinagar', Haryana: 'Chandigarh', 'Himachal Pradesh': 'Shimla', Jharkhand: 'Ranchi',
  Karnataka: 'Bengaluru', Kerala: 'Thiruvananthapuram', 'Madhya Pradesh': 'Bhopal', Maharashtra: 'Mumbai', Manipur: 'Imphal',
  Meghalaya: 'Shillong', Mizoram: 'Aizawl', Nagaland: 'Kohima', Odisha: 'Bhubaneswar', Punjab: 'Chandigarh',
  Rajasthan: 'Jaipur', Sikkim: 'Gangtok', 'Tamil Nadu': 'Chennai', Telangana: 'Hyderabad', Tripura: 'Agartala',
  'Uttar Pradesh': 'Lucknow', Uttarakhand: 'Dehradun', 'West Bengal': 'Kolkata', Delhi: 'Neu-Delhi', Puducherry: 'Puducherry',
  'Jammu and Kashmir': 'Srinagar / Jammu', Ladakh: 'Leh', Chandigarh: 'Chandigarh', Lakshadweep: 'Kavaratti',
  'Andaman and Nicobar': 'Port Blair', 'Dadra and Nagar Haveli and Daman and Diu': 'Daman',
}
const IN_UT = new Set(['Delhi', 'Puducherry', 'Jammu and Kashmir', 'Ladakh', 'Chandigarh', 'Lakshadweep', 'Andaman and Nicobar', 'Dadra and Nagar Haveli and Daman and Diu'])
const IN_GROUPS: Record<string, GroupDef> = Object.fromEntries(Object.entries(LANGS).map(([k, l]) => [k, { name: l.name, color: l.color }]))

const inStates: GeoItem[] = ADM1.IND.map(s => {
  const lk = STATE_LANG[s.name] ?? 'hindi'
  const l = LANGS[lk]
  return {
    key: s.id,
    label: s.name,
    group: lk,
    areas: [`adm1-IND:${s.id}`],
    details: [
      { label: 'Art', value: IN_UT.has(s.name) ? 'Unionsterritorium' : 'Bundesstaat' },
      ...(IN_CAPITAL[s.name] ? [{ label: 'Hauptstadt', value: IN_CAPITAL[s.name] }] : []),
      { label: 'Hauptsprache', value: l.name },
      { label: 'Schrift', value: l.script },
      { label: 'Hallo', value: l.hello, big: true },
    ],
    text: { prompt: `Hauptsprache in ${s.name}?`, answer: l.name },
  }
}).sort((a, b) => a.label.localeCompare(b.label))

const idByName = Object.fromEntries(ADM1.IND.map(s => [s.name, s.id]))
const inLangs: GeoItem[] = Object.entries(LANGS).map(([k, l]) => ({
  key: `sprache:in:${k}`,
  label: l.name,
  prompt: l.name,
  promptSub: `Schrift: ${l.script}`,
  group: k,
  areas: Object.entries(STATE_LANG).filter(([, v]) => v === k).map(([s]) => `adm1-IND:${idByName[s]}`).filter(a => !a.endsWith(':undefined')),
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

/* ═══════════════ Türkei ═══════════════ */

const TR_REGIONS: Record<string, GroupDef> = {
  marmara: { name: 'Marmara', color: C.rose },
  ege: { name: 'Ägäis', color: C.blue },
  akdeniz: { name: 'Mittelmeer', color: C.ochre },
  ic: { name: 'Zentralanatolien', color: C.plum },
  karadeniz: { name: 'Schwarzes Meer', color: C.green },
  dogu: { name: 'Ostanatolien', color: C.indigo },
  guneydogu: { name: 'Südostanatolien', color: C.terra },
}
/** Kennzeichen-Nummer → Name + Region */
const TR: Record<string, [string, string]> = {
  '01': ['Adana', 'akdeniz'], '02': ['Adıyaman', 'guneydogu'], '03': ['Afyonkarahisar', 'ege'], '04': ['Ağrı', 'dogu'],
  '05': ['Amasya', 'karadeniz'], '06': ['Ankara', 'ic'], '07': ['Antalya', 'akdeniz'], '08': ['Artvin', 'karadeniz'],
  '09': ['Aydın', 'ege'], '10': ['Balıkesir', 'marmara'], '11': ['Bilecik', 'marmara'], '12': ['Bingöl', 'dogu'],
  '13': ['Bitlis', 'dogu'], '14': ['Bolu', 'karadeniz'], '15': ['Burdur', 'akdeniz'], '16': ['Bursa', 'marmara'],
  '17': ['Çanakkale', 'marmara'], '18': ['Çankırı', 'ic'], '19': ['Çorum', 'karadeniz'], '20': ['Denizli', 'ege'],
  '21': ['Diyarbakır', 'guneydogu'], '22': ['Edirne', 'marmara'], '23': ['Elazığ', 'dogu'], '24': ['Erzincan', 'dogu'],
  '25': ['Erzurum', 'dogu'], '26': ['Eskişehir', 'ic'], '27': ['Gaziantep', 'guneydogu'], '28': ['Giresun', 'karadeniz'],
  '29': ['Gümüşhane', 'karadeniz'], '30': ['Hakkâri', 'dogu'], '31': ['Hatay', 'akdeniz'], '32': ['Isparta', 'akdeniz'],
  '33': ['Mersin', 'akdeniz'], '34': ['İstanbul', 'marmara'], '35': ['İzmir', 'ege'], '36': ['Kars', 'dogu'],
  '37': ['Kastamonu', 'karadeniz'], '38': ['Kayseri', 'ic'], '39': ['Kırklareli', 'marmara'], '40': ['Kırşehir', 'ic'],
  '41': ['Kocaeli', 'marmara'], '42': ['Konya', 'ic'], '43': ['Kütahya', 'ege'], '44': ['Malatya', 'dogu'],
  '45': ['Manisa', 'ege'], '46': ['Kahramanmaraş', 'akdeniz'], '47': ['Mardin', 'guneydogu'], '48': ['Muğla', 'ege'],
  '49': ['Muş', 'dogu'], '50': ['Nevşehir', 'ic'], '51': ['Niğde', 'ic'], '52': ['Ordu', 'karadeniz'],
  '53': ['Rize', 'karadeniz'], '54': ['Sakarya', 'marmara'], '55': ['Samsun', 'karadeniz'], '56': ['Siirt', 'guneydogu'],
  '57': ['Sinop', 'karadeniz'], '58': ['Sivas', 'ic'], '59': ['Tekirdağ', 'marmara'], '60': ['Tokat', 'karadeniz'],
  '61': ['Trabzon', 'karadeniz'], '62': ['Tunceli', 'dogu'], '63': ['Şanlıurfa', 'guneydogu'], '64': ['Uşak', 'ege'],
  '65': ['Van', 'dogu'], '66': ['Yozgat', 'ic'], '67': ['Zonguldak', 'karadeniz'], '68': ['Aksaray', 'ic'],
  '69': ['Bayburt', 'karadeniz'], '70': ['Karaman', 'ic'], '71': ['Kırıkkale', 'ic'], '72': ['Batman', 'guneydogu'],
  '73': ['Şırnak', 'guneydogu'], '74': ['Bartın', 'karadeniz'], '75': ['Ardahan', 'dogu'], '76': ['Iğdır', 'dogu'],
  '77': ['Yalova', 'marmara'], '78': ['Karabük', 'karadeniz'], '79': ['Kilis', 'guneydogu'], '80': ['Osmaniye', 'akdeniz'],
  '81': ['Düzce', 'karadeniz'],
}
/** Großstädte (nach Einwohnern laut Natural Earth), Name der Stadt → Kennzeichen-Nummer der Provinz */
const TR_CITIES: [string, string][] = [
  ['İstanbul', '34'], ['Ankara', '06'], ['İzmir', '35'], ['Bursa', '16'], ['Adana', '01'], ['Gaziantep', '27'],
  ['Konya', '42'], ['Antalya', '07'], ['Trabzon', '61'], ['Diyarbakır', '21'], ['Mersin', '33'], ['Samsun', '55'],
  ['Kayseri', '38'], ['Eskişehir', '26'], ['İzmit', '41'], ['Malatya', '44'], ['Şanlıurfa', '63'], ['Erzurum', '25'],
  ['Kahramanmaraş', '46'], ['Denizli', '20'], ['Van', '65'], ['Batman', '72'], ['Adapazarı', '54'], ['Rize', '53'],
  ['Elazığ', '23'], ['Sivas', '58'], ['Balıkesir', '10'], ['Manisa', '45'], ['Adıyaman', '02'], ['Aydın', '09'],
]
const trProvinces: GeoItem[] = Object.entries(TR).map(([code, [name, region]]) => ({
  key: `TR-${code}`,
  label: name,
  group: region,
  areas: [`adm1-TUR:TR-${code}`],
  details: [{ label: 'Kennzeichen', value: code, big: true }, { label: 'Region', value: TR_REGIONS[region].name }],
  text: { prompt: code, sub: 'Welche Provinz hat dieses Kennzeichen?', answer: name, big: true },
})).sort((a, b) => a.label.localeCompare(b.label, 'tr'))

const trCities: GeoItem[] = TR_CITIES.map(([name, code], i) => {
  const [prov, region] = TR[code]
  return {
    key: `stadt:tr:${code}:${name}`,
    label: name,
    promptSub: 'Tippe auf die Provinz',
    group: region,
    areas: [`adm1-TUR:TR-${code}`],
    point: PLACES['tr-cities'][name] as LonLat | undefined,
    details: [
      { label: 'Provinz', value: prov },
      { label: 'Kennzeichen', value: code, big: true },
      { label: 'Region', value: TR_REGIONS[region].name },
      { label: 'Rang', value: `Nr. ${i + 1} der Großstädte` },
    ],
    text: { prompt: name, sub: 'Welches Kennzeichen hat diese Stadt?', answer: code, big: true },
  }
})

/* ═══════════════ Japan ═══════════════ */

const JP_REGIONS: Record<string, GroupDef> = {
  hokkaido: { name: 'Hokkaido', color: C.indigo },
  tohoku: { name: 'Tōhoku', color: C.plum },
  kanto: { name: 'Kantō', color: C.rose },
  chubu: { name: 'Chūbu', color: C.blue },
  kinki: { name: 'Kinki / Kansai', color: C.terra },
  chugoku: { name: 'Chūgoku', color: C.ochre },
  shikoku: { name: 'Shikoku', color: C.green },
  kyushu: { name: 'Kyūshū & Okinawa', color: C.teal },
}
function jpRegion(n: number): string {
  if (n === 1) return 'hokkaido'
  if (n <= 7) return 'tohoku'
  if (n <= 14) return 'kanto'
  if (n <= 23) return 'chubu'
  if (n <= 30) return 'kinki'
  if (n <= 35) return 'chugoku'
  if (n <= 39) return 'shikoku'
  return 'kyushu'
}
const JP_ALIASES: Record<string, string[]> = {
  'JP-01': ['Hokkaido'], 'JP-13': ['Tokio'], 'JP-26': ['Kyoto'], 'JP-27': ['Osaka'], 'JP-28': ['Hyogo'], 'JP-39': ['Kochi'], 'JP-44': ['Oita'],
}
const jpPrefs: GeoItem[] = ADM1.JPN.map(s => {
  const n = Number(s.id.slice(3))
  const r = jpRegion(n)
  return {
    key: s.id,
    label: s.name,
    group: r,
    areas: [`adm1-JPN:${s.id}`],
    aliases: JP_ALIASES[s.id] ?? [],
    details: [{ label: 'Region', value: JP_REGIONS[r].name }, { label: 'Nummer', value: String(n) }],
    text: { prompt: `${s.name} liegt in der Region …`, answer: JP_REGIONS[r].name },
  }
}).sort((a, b) => a.label.localeCompare(b.label))

/* ═══════════════ Quizzes ═══════════════ */

export const GEOGUESSR_QUIZZES: QuizDef[] = [
  {
    slug: 'us-staaten', title: 'USA – Bundesstaaten', meta: '50 Staaten',
    text: 'Alle 50 Bundesstaaten finden, zuordnen oder eintippen. Alaska und Hawaii als Einschub.',
    bereich: 'nordamerika', country: 'USA', kind: 'regionen',
    askClick: 'Wo liegt der Bundesstaat?', askName: 'Wie heißt der markierte Staat?', askText: 'Welche Hauptstadt?',
    itemsNoun: 'Staaten', groups: US_GROUPS, items: usStates, layers: ['adm1-USA'], projection: 'albersUsa', context: false, labelSize: 7,
    intro: 'Lernmodus – tippe auf einen Staat. Alaska und Hawaii sind unten links eingeblendet.',
  },
  {
    slug: 'us-hauptstaedte', title: 'USA – Hauptstädte', meta: '50 Hauptstädte',
    text: 'Sacramento, Albany, Tallahassee … zu jeder Hauptstadt den Bundesstaat finden.',
    bereich: 'nordamerika', country: 'USA', kind: 'hauptstaedte',
    askClick: 'In welchem Staat liegt die Hauptstadt?', askName: 'Welche Hauptstadt hat der markierte Staat?', askText: 'Welcher Staat?',
    itemsNoun: 'Hauptstädte', groups: US_GROUPS, items: usCapitals, layers: ['adm1-USA'], projection: 'albersUsa', context: false, labelSize: 6.5,
  },
  {
    slug: 'br-vorwahlen', title: 'Brasilien – Vorwahlen (DDD)', meta: '67 Vorwahlen',
    text: 'Telefon-Vorwahlen von Schildern und Werbung einer Gegend zuordnen – die erste Ziffer verrät schon viel.',
    bereich: 'suedamerika', country: 'BRA', kind: 'vorwahlen',
    askClick: 'Wo gilt diese Vorwahl?', askName: 'Welche Vorwahl hat das markierte Gebiet?', askText: 'Welcher Bundesstaat?',
    itemsNoun: 'Vorwahlen', groups: BR_DIGITS, items: brDdd, layers: ['br-ddd'], labelSize: 10,
    intro: 'Lernmodus – tippe auf ein Gebiet. Die erste Ziffer der Vorwahl verrät die Gegend.',
    tip: { title: 'Tipp für GeoGuessr', text: 'Vorwahlen stehen oft auf Schildern, Geschäften und Werbung als (xx) vor der Nummer. Die erste Ziffer grenzt die Gegend schon stark ein – siehe Farben.' },
  },
  {
    slug: 'br-staaten', title: 'Brasilien – Bundesstaaten', meta: '27 Bundesstaaten',
    text: 'Alle Bundesstaaten mit Kürzel, Hauptstadt und Vorwahlen.',
    bereich: 'suedamerika', country: 'BRA', kind: 'regionen',
    askClick: 'Wo liegt der Bundesstaat?', askName: 'Wie heißt der markierte Bundesstaat?', askText: 'Welche Hauptstadt?',
    itemsNoun: 'Bundesstaaten', groups: BR_REGIONS, items: brStates, layers: ['adm1-BRA'], labelSize: 8.5,
  },
  {
    slug: 'in-sprachen', title: 'Indien – Sprachen & Schriften', meta: '17 Sprachen',
    text: 'Welche Sprache und Schrift wo? Mit Beispielwörtern in Hindi, Tamil, Telugu, Bengalisch und mehr.',
    bereich: 'asien', country: 'IND', kind: 'sprachen',
    askClick: 'Wo spricht man diese Sprache?', askName: 'Welche Sprache spricht man im markierten Gebiet?', askText: 'Welche Schrift?',
    itemsNoun: 'Sprachen', groups: IN_GROUPS, items: inLangs, layers: ['adm1-IND'], labelSize: 9,
    intro: 'Lernmodus – tippe auf ein Gebiet, um Sprache, Schrift und Beispielwörter zu sehen.',
    tip: { title: 'Hinweis', text: 'Vereinfacht: Jeder Staat hat hier eine Hauptsprache. In Wirklichkeit sind viele Staaten mehrsprachig, und Englisch steht fast überall mit auf den Schildern.' },
  },
  {
    slug: 'in-staaten', title: 'Indien – Bundesstaaten', meta: '36 Staaten & Gebiete',
    text: 'Bundesstaaten und Unionsterritorien – mit Hauptstadt und Hauptsprache.',
    bereich: 'asien', country: 'IND', kind: 'regionen',
    askClick: 'Wo liegt der Bundesstaat?', askName: 'Wie heißt der markierte Bundesstaat?', askText: 'Welche Sprache?',
    itemsNoun: 'Staaten & Gebiete', groups: IN_GROUPS, items: inStates, layers: ['adm1-IND'], labelSize: 7.5,
  },
  {
    slug: 'tr-provinzen', title: 'Türkei – Provinzen & Kennzeichen', meta: '81 Provinzen',
    text: 'Die Kennzeichen-Nummern der Provinzen lernen (34 = İstanbul, 06 = Ankara …).',
    bereich: 'asien', country: 'TUR', kind: 'kennzeichen',
    askClick: 'Wo liegt die Provinz?', askName: 'Wie heißt die markierte Provinz?', askText: 'Welche Provinz?',
    itemsNoun: 'Provinzen', groups: TR_REGIONS, items: trProvinces, layers: ['adm1-TUR'], labelSize: 7,
    intro: 'Lernmodus – tippe auf eine Provinz. Die Zahl ist die Kennzeichen-Nummer.',
    tip: { title: 'Tipp für GeoGuessr', text: 'Türkische Kennzeichen beginnen mit der Nummer der Provinz (z.B. 34 = İstanbul, 06 = Ankara). 01–67 sind alphabetisch nach dem alten Namen sortiert, 68–81 kamen später dazu.' },
  },
  {
    slug: 'tr-grossstaedte', title: 'Türkei – Großstädte', meta: '30 Großstädte',
    text: 'Die 30 größten Städte finden – mit Kennzeichen-Nummer ihrer Provinz.',
    bereich: 'asien', country: 'TUR', kind: 'staedte',
    askClick: 'Wo liegt die Stadt?', askName: 'Welche Stadt ist markiert?', askText: 'Welches Kennzeichen?',
    itemsNoun: 'Städte', groups: TR_REGIONS, items: trCities, layers: ['adm1-TUR'], labelSize: 8,
  },
  {
    slug: 'jp-praefekturen', title: 'Japan – Präfekturen', meta: '8 Regionen · 47 Präfekturen',
    text: 'Präfekturen anklicken oder Namen zuordnen. Mit Zoom für die kleinen Präfekturen rund um Tokio und Osaka.',
    bereich: 'asien', country: 'JPN', kind: 'regionen',
    askClick: 'Wo liegt die Präfektur?', askName: 'Wie heißt die markierte Präfektur?', askText: 'Welche Region?',
    itemsNoun: 'Präfekturen', groups: JP_REGIONS, items: jpPrefs, layers: ['adm1-JPN'], labelSize: 7,
    intro: 'Lernmodus – tippe auf eine Präfektur. Die Farben zeigen die acht Regionen.',
  },
]