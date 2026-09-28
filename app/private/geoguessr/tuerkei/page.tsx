'use client'

// Türkei: Großstädte + 81 Provinzen mit Kfz-Kennzeichen-Nummer
// Karte und Orte: Natural Earth · Kennzeichen-Nummer = ISO-3166-2-Code der Provinz (TR-01 … TR-81)

import MapQuiz, { type QuizItem, type QuizScope } from '../_lib/MapQuiz'
import { GEO } from '../_data/turkey-geo'

const REGIONS = {
  marmara: { name: 'Marmara', color: '#d93690' },
  ege: { name: 'Ägäis', color: '#3f9bb5' },
  akdeniz: { name: 'Mittelmeer', color: '#e0913a' },
  ic: { name: 'Zentralanatolien', color: '#c07bd8' },
  karadeniz: { name: 'Schwarzes Meer', color: '#25845c' },
  dogu: { name: 'Ostanatolien', color: '#7c4ae0' },
  guneydogu: { name: 'Südostanatolien', color: '#c0344f' },
}
type R = keyof typeof REGIONS

/** Kennzeichen-Nummer → Name + Region */
const P: Record<string, [string, R]> = {
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
const CITIES: [string, string][] = [
  ['İstanbul', '34'], ['Ankara', '06'], ['İzmir', '35'], ['Bursa', '16'], ['Adana', '01'], ['Gaziantep', '27'],
  ['Konya', '42'], ['Antalya', '07'], ['Trabzon', '61'], ['Diyarbakır', '21'], ['Mersin', '33'], ['Samsun', '55'],
  ['Kayseri', '38'], ['Eskişehir', '26'], ['İzmit', '41'], ['Malatya', '44'], ['Şanlıurfa', '63'], ['Erzurum', '25'],
  ['Kahramanmaraş', '46'], ['Denizli', '20'], ['Van', '65'], ['Batman', '72'], ['Adapazarı', '54'], ['Rize', '53'],
  ['Elazığ', '23'], ['Sivas', '58'], ['Balıkesir', '10'], ['Manisa', '45'], ['Adıyaman', '02'], ['Aydın', '09'],
]

// Punkt-Koordinaten aus Natural Earth: je Provinz der Verwaltungssitz
const seat = (code: string) => GEO.cities.find(c => c.prov === `TR-${code}` && /capital/i.test(c.cls))
  ?? GEO.cities.find(c => c.prov === `TR-${code}`)

const shapes = GEO.provinces.map(p => ({ key: p.key, d: p.d, lx: p.lx, ly: p.ly }))

const cityItems: QuizItem[] = CITIES.map(([name, code], i) => {
  const s = seat(code)
  const [prov, region] = P[code]
  return {
    key: code,
    label: name,
    promptSub: 'Tippe auf die Provinz',
    group: region,
    shapes: [code],
    point: s ? [s.x, s.y] : undefined,
    details: [
      { label: 'Provinz', value: prov },
      { label: 'Kennzeichen', value: code, big: true },
      { label: 'Region', value: REGIONS[region].name },
      { label: 'Rang', value: `Nr. ${i + 1} der Großstädte` },
    ],
    text: { prompt: name, sub: 'Welches Kennzeichen hat diese Stadt?', answer: code, big: true },
  }
})

const provinceItems: QuizItem[] = Object.entries(P).map(([code, [name, region]]) => ({
  key: code,
  label: name,
  group: region,
  shapes: [code],
  details: [
    { label: 'Kennzeichen', value: code, big: true },
    { label: 'Region', value: REGIONS[region].name },
  ],
  text: { prompt: code, sub: 'Welche Provinz hat dieses Kennzeichen?', answer: name, big: true },
})).sort((a, b) => a.label.localeCompare(b.label, 'tr'))

const SCOPES: QuizScope[] = [
  {
    key: 'cities', label: '30 Großstädte', itemsNoun: 'Städte',
    askClick: 'Wo liegt die Stadt?', askName: 'Welche Stadt ist markiert?', askText: 'Welches Kennzeichen?',
    shapes, items: cityItems, groups: REGIONS, labelSize: 9,
  },
  {
    key: 'provinces', label: '81 Provinzen', itemsNoun: 'Provinzen',
    askClick: 'Wo liegt die Provinz?', askName: 'Wie heißt die markierte Provinz?', askText: 'Welche Provinz?',
    shapes, items: provinceItems, groups: REGIONS, labelSize: 7,
  },
]

export default function TurkeyPage() {
  return (
    <MapQuiz
      title="Türkei"
      storageKey="tuerkei"
      viewBox={GEO.viewBox}
      scopes={SCOPES}
      intro="Lernmodus – tippe auf eine Provinz. Die Zahl ist die Kennzeichen-Nummer."
      tips={() => (
        <div className="pv-glass pv-card" style={{ fontSize: 13.5 }}>
          <p className="pv-label" style={{ marginBottom: 6 }}>Tipp für GeoGuessr</p>
          <div className="pv-muted">
            Türkische Kennzeichen beginnen mit der Nummer der Provinz (z.B. <b>34</b> = İstanbul, <b>06</b> = Ankara).
            01–67 sind alphabetisch nach dem alten Namen sortiert, 68–81 kamen später dazu.
          </div>
        </div>
      )}
    />
  )
}