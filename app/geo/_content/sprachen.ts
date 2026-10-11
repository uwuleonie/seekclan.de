// Bereich „Sprachen & Schriften“ (Phase 4): jede Schrift in Stufen lernen –
// 1. Buchstaben (Lernkarten), 2. Ortsnamen auf der Karte lesen, 3. Länder an der Schrift erkennen, 4. Ortsschild-Prüfung (in den Lernkarten).
// Lernkarten:      public/geo/items/schriften.json      (special: 'schrift', Komponente SchriftQuiz)
// Karten-Quizzes:  public/geo/items/sprachen-orte.json  (normales Karten-Quiz mit Punkten)
// Erzeugt von scripts/geo/build-sprachen.mjs (Inhalte in scripts/geo/sprachen-daten.mjs).

import { SPRACHEN_COUNTS, SPRACHEN_GROUPS } from '../_data/sprachen'
import type { Kind, QuizDef } from '../_lib/types'

const n = (slug: string) => SPRACHEN_COUNTS[slug] ?? 0
const meta = (m: string, slug: string) => m.replace('#', n(slug).toLocaleString('de-DE'))

/** Lernkarten (Buchstaben, Wörter, Schriften erkennen) */
function deck(slug: string, title: string, m: string, section: string, text: string, kind: Kind = 'sprachen'): QuizDef {
  return {
    slug, title, meta: meta(m, slug), bereich: 'sprachen', kind, section, text,
    special: 'schrift', items: [], itemsFile: 'schriften', count: n(slug),
    askClick: 'Welches Zeichen?', askName: 'Was bedeutet es?', itemsNoun: 'Karten',
    groups: {}, layers: [], combinable: false,
  }
}

/** Karten-Quiz: Städte in ihrer eigenen Schrift */
function orte(slug: string, title: string, m: string, section: string, text: string, tip?: QuizDef['tip']): QuizDef {
  return {
    slug, title, meta: meta(m, slug), bereich: 'sprachen', kind: 'sprachen', section, text,
    items: [], itemsFile: 'sprachen-orte', count: n(slug),
    askClick: 'Wo liegt diese Stadt?', askName: 'Wie heißt die markierte Stadt?', askText: 'Welche Stadt ist das?',
    itemsNoun: 'Städte', groups: SPRACHEN_GROUPS[slug] ?? {}, layers: [], labelSize: 8,
    intro: 'Lernmodus – tippe auf eine Stadt: Name in Landesschrift, auf Deutsch und Aussprache.',
    tip,
  }
}

const ERK = 'Schriften erkennen'
const KYR = 'Kyrillisch'
const GR = 'Griechisch'
const KAU = 'Kaukasus: Georgisch & Armenisch'
const NAH = 'Nahost: Hebräisch & Arabisch'
const SOA = 'Südostasien: Thai, Laotisch, Khmer, Vietnamesisch'
const OA = 'Ostasien: Koreanisch, Japanisch, Chinesisch'
const IND = 'Indien'
const ALT = 'Arktis & Altertum'
const SCH = 'Schilder & Wörter'
const LERN = 'Wiederholen'

export const SPRACHEN_QUIZZES: QuizDef[] = [
  /* ── Wiederholen ── */
  { ...deck('meine-woerter', 'Meine Wörter', 'Merkliste · Lernkartei', LERN,
    'Alles, was du in den Quizzes mit dem Stern gemerkt hast: Orte, Länder und Wörter – mit Aussprache und eigener Lernkartei.'), meta: 'Merkliste · Lernkartei' },
  /* ── Erkennen ── */
  deck('welche-schrift', 'Welche Schrift ist das?', '# Ortsnamen · 25 Schriften', ERK,
    'Der GeoGuessr-Klassiker: ein Ortsname in fremder Schrift – Kyrillisch, Georgisch, Thai, Hangul, Tamil …? Erkennst du sie alle?'),
  deck('lateinische-sonderzeichen', 'Sonderzeichen: welche Sprache?', '# Zeichen · ł, ő, ș, ø …', ERK,
    'ł heißt Polen, ő heißt Ungarn, ș heißt Rumänien: Buchstaben, die sofort verraten, wo du bist.'),

  /* ── Kyrillisch ── */
  deck('kyrillisch', 'Kyrillisch lesen', 'Stufe 1 · # Buchstaben', KYR,
    'Das russische Alphabet in drei Gruppen: wie bei uns, falsche Freunde, neue Buchstaben. Mit Ortsschild-Prüfung.'),
  orte('kyrillisch-osteuropa', 'Kyrillisch: Städte in Russland, Ukraine, Belarus', 'Stufe 2 · # Städte', KYR,
    'Москва, Київ, Мінск: Lies den Ortsnamen und finde die Stadt auf der Karte.',
    { title: 'Tipp', text: 'Beim Eintippen zählt der deutsche Name (Moskau) oder die englische Schreibweise (Moscow).' }),
  orte('kyrillisch-balkan', 'Kyrillisch: Städte in Bulgarien, Serbien, Nordmazedonien', 'Stufe 2 · # Städte', KYR,
    'София, Београд, Скопје: die kyrillischen Ortsnamen des Balkans.'),
  orte('kyrillisch-zentralasien', 'Kyrillisch: Städte in Kasachstan & der Mongolei', 'Stufe 2 · # Städte', KYR,
    'Алматы, Улаанбаатар: Kyrillisch mit vielen Sonderbuchstaben.'),
  deck('kyrillisch-laender', 'Kyrillisch: Sonderbuchstaben der Länder', 'Stufe 3 · # Buchstaben', KYR,
    'Ї heißt Ukraine, Ў heißt Belarus, Ђ heißt Serbien: Diese Buchstaben verraten das Land.'),
  deck('kyrillisch-welches-land', 'Kyrillisch: Aus welchem Land?', 'Stufe 4 · # Ortsnamen', KYR,
    'Ein kyrillischer Ortsname – Russland, Ukraine, Belarus, Bulgarien, Serbien, Nordmazedonien, Kasachstan oder Mongolei?'),

  /* ── Griechisch ── */
  deck('griechisch', 'Griechisch lesen', 'Stufe 1 · # Buchstaben', GR,
    'Alle 24 griechischen Buchstaben – viele kennst du schon aus Mathe. Mit Ortsschild-Prüfung.'),
  orte('griechisch-orte', 'Griechisch: Städte in Griechenland & Zypern', 'Stufe 2 · # Städte', GR,
    'Αθήνα, Θεσσαλονίκη, Λευκωσία: Lies den Ortsnamen und finde ihn auf der Karte.'),

  /* ── Kaukasus ── */
  deck('georgisch', 'Georgisch lesen', 'Stufe 1 · # Buchstaben', KAU,
    'Die runde Schrift Georgiens (Mchedruli) – 33 Buchstaben, keine Großbuchstaben.'),
  orte('georgisch-orte', 'Georgisch: Städte in Georgien', 'Stufe 2 · # Städte', KAU, 'თბილისი, ბათუმი, ქუთაისი: die Städte Georgiens in georgischer Schrift.'),
  deck('armenisch', 'Armenisch lesen', 'Stufe 1 · # Buchstaben', KAU, 'Das armenische Alphabet mit 38 Buchstaben.'),
  orte('armenisch-orte', 'Armenisch: Städte in Armenien', 'Stufe 2 · # Städte', KAU, 'Երևան, Գյումրի, Վանաձոր: die Städte Armeniens in armenischer Schrift.'),

  /* ── Nahost ── */
  deck('hebraeisch', 'Hebräisch lesen', 'Stufe 1 · # Buchstaben', NAH, 'Die 22 hebräischen Buchstaben und ihre Endformen – von rechts nach links.'),
  orte('hebraeisch-orte', 'Hebräisch: Städte in Israel', 'Stufe 2 · # Städte', NAH, 'ירושלים, תל אביב, חיפה: die Städte Israels auf Hebräisch.'),
  deck('arabisch', 'Arabisch lesen', 'Stufe 1 · # Zeichen', NAH,
    'Die arabischen Buchstaben, die Extra-Buchstaben von Persisch und Urdu – und die ostarabischen Ziffern.'),
  orte('arabisch-orte', 'Arabische Schrift: Städte von Marokko bis Pakistan', 'Stufe 2 · # Städte', NAH,
    'القاهرة, الرياض, تهران, کراچی: Städte in arabischer Schrift – Arabisch, Persisch und Urdu.'),

  /* ── Südostasien ── */
  deck('thai', 'Thai lesen', 'Stufe 1 · # Zeichen', SOA, 'Die 44 Thai-Konsonanten mit ihren Merkwörtern – und die Thai-Ziffern.'),
  orte('thai-lao-khmer-orte', 'Thai, Laotisch, Khmer: Städte', 'Stufe 2 · # Städte', SOA,
    'Städte in Thailand, Laos und Kambodscha in ihrer eigenen Schrift.',
    { title: 'GeoGuessr-Tipp', text: 'Thai hat kleine Kreise an den Buchstaben, Laotisch ist runder, Khmer breit mit „Hüten“.' }),
  deck('suedostasien-welches-land', 'Thai, Laotisch oder Khmer?', 'Stufe 3 · # Ortsnamen', SOA, 'Ein Ortsname – aus Thailand, Laos oder Kambodscha?'),
  orte('vietnam-orte', 'Vietnamesisch: Städte in Vietnam', '# Städte · mit Tonzeichen', SOA,
    'Hà Nội, Thành phố Hồ Chí Minh, Đà Nẵng: Vietnamesisch mit seinen Tonzeichen.'),

  /* ── Ostasien ── */
  deck('hangul', 'Koreanisch lesen (Hangul)', 'Stufe 1 · # Zeichen', OA, 'Hangul in einer Stunde: Konsonanten, Vokale und wie sie zu Silben werden.'),
  orte('korea-orte', 'Hangul: Städte in Südkorea', 'Stufe 2 · # Städte', OA, '서울, 부산, 대구: die Städte Südkoreas in Hangul.'),
  deck('hiragana', 'Japanisch: Hiragana', 'Stufe 1 · # Zeichen', OA, 'Die 46 Hiragana – die runde Silbenschrift.'),
  deck('katakana', 'Japanisch: Katakana', 'Stufe 1 · # Zeichen', OA, 'Die 46 Katakana – die eckige Silbenschrift für Fremdwörter.'),
  orte('japan-orte', 'Kanji: Städte in Japan', 'Stufe 2 · # Städte', OA, '東京, 大阪, 京都: die großen Städte Japans in Kanji – mit Lesung in Hiragana.'),
  deck('chinesisch-zeichen', 'Chinesisch: traditionell oder vereinfacht?', '# Zeichen · Taiwan oder China', OA,
    '國 oder 国? Traditionelle Zeichen heißen Taiwan oder Hongkong, vereinfachte heißen China.'),
  orte('chinesisch-orte', 'Chinesisch: Städte in Taiwan & China', 'Stufe 2 · # Städte', OA, '臺北 und 北京: Taiwan schreibt traditionell, China vereinfacht.'),
  deck('ostasien-welches-land', 'Korea, Japan, Taiwan oder China?', 'Stufe 3 · # Ortsnamen', OA, 'Ein Ortsname in Ostasien – aus welchem Land ist er?'),

  /* ── Indien ── */
  deck('indien-welche-schrift', 'Indien: welche Schrift?', '# Ortsnamen · 10 Schriften', IND,
    'Devanagari, Bengalisch, Tamil, Telugu, Kannada, Malayalam, Gujarati, Gurmukhi, Odia – an der Schrift erkennst du den Bundesstaat.'),
  orte('indien-schriften-orte', 'Indien: Städte in ihrer Schrift', '# Städte · nach Schrift', IND,
    'Indiens Großstädte in der Schrift ihres Bundesstaats – Tamil im Süden, Bengalisch im Osten, Devanagari im Norden.'),

  /* ── Arktis & Altertum ── */
  deck('inuktitut', 'Inuktitut-Silbenschrift', '# Zeichen · Nunavut', ALT, 'Die Silbenschrift der Inuit in Nunavut: Jedes Zeichen gedreht = anderer Vokal.'),
  orte('inuktitut-orte', 'Inuktitut: Orte in Nunavut', '# Orte', ALT, 'ᐃᖃᓗᐃᑦ (Iqaluit) und die anderen Orte Nunavuts in Silbenschrift.'),
  deck('hieroglyphen', 'Ägyptische Hieroglyphen', '# Zeichen · das „Alphabet“', ALT, 'Die 25 Einkonsonantenzeichen – Geier, Schilfblatt, Eule und Co.'),

  /* ── Schilder ── */
  deck('schilder-woerter', 'Schilder-Wörter: Spanisch, Portugiesisch, Französisch', '# Wörter', SCH,
    'CALLE, RUA, RUE – SALIDA, SAÍDA, SORTIE: die wichtigsten Wörter auf Straßenschildern.'),
  deck('stoppschilder', 'Stoppschilder: ALTO, PARE oder STOP?', '# Länder', SCH,
    'Mexiko sagt ALTO, Brasilien und Südamerika PARE, Europa STOP und Québec ARRÊT.'),
  deck('zahlen', 'Zahlen in fremden Schriften', '# Ziffern · 8 Schriften', SCH,
    '٤ oder ۴? ๓ oder ໓? Die Ziffern von Arabisch, Persisch, Devanagari, Bengalisch, Thai, Laotisch, Khmer und Chinesisch – für Kennzeichen, Preise und Hausnummern.'),
]