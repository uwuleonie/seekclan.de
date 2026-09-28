'use client'

// Kyrillisch lernen – für GeoGuessr: Buchstaben, Wörter/Ortsnamen lesen und Sprachen erkennen.
// Fortschritt je Buchstabe wird nur im Browser gespeichert (localStorage).

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Icon from '../../_components/Icon'

/* ── Daten ─────────────────────────────────────────────────────────────── */

interface Letter {
  up: string
  low: string
  /** Umschrift (wie auf Karten/Schildern, englische Schreibweise) */
  latin: string
  /** So klingt es auf Deutsch */
  sound: string
  /** Sieht aus wie ein lateinischer Buchstabe, klingt aber anders */
  trap?: string
}

const RUSSIAN: Letter[] = [
  { up: 'А', low: 'а', latin: 'a', sound: 'a wie in "Apfel"' },
  { up: 'Б', low: 'б', latin: 'b', sound: 'b' },
  { up: 'В', low: 'в', latin: 'v', sound: 'w wie in "Wasser"', trap: 'sieht aus wie B' },
  { up: 'Г', low: 'г', latin: 'g', sound: 'g wie in "Gans"' },
  { up: 'Д', low: 'д', latin: 'd', sound: 'd' },
  { up: 'Е', low: 'е', latin: 'e / ye', sound: 'je wie in "jetzt"' },
  { up: 'Ё', low: 'ё', latin: 'yo', sound: 'jo wie in "Joghurt"' },
  { up: 'Ж', low: 'ж', latin: 'zh', sound: 'weiches sch wie in "Journal"' },
  { up: 'З', low: 'з', latin: 'z', sound: 'weiches s wie in "Sonne"', trap: 'sieht aus wie 3' },
  { up: 'И', low: 'и', latin: 'i', sound: 'i', trap: 'gespiegeltes N' },
  { up: 'Й', low: 'й', latin: 'y / i', sound: 'j wie in "ja" (kurz)' },
  { up: 'К', low: 'к', latin: 'k', sound: 'k' },
  { up: 'Л', low: 'л', latin: 'l', sound: 'l' },
  { up: 'М', low: 'м', latin: 'm', sound: 'm' },
  { up: 'Н', low: 'н', latin: 'n', sound: 'n', trap: 'sieht aus wie H' },
  { up: 'О', low: 'о', latin: 'o', sound: 'o' },
  { up: 'П', low: 'п', latin: 'p', sound: 'p' },
  { up: 'Р', low: 'р', latin: 'r', sound: 'gerolltes r', trap: 'sieht aus wie P' },
  { up: 'С', low: 'с', latin: 's', sound: 'scharfes s wie in "Bus"', trap: 'sieht aus wie C' },
  { up: 'Т', low: 'т', latin: 't', sound: 't' },
  { up: 'У', low: 'у', latin: 'u', sound: 'u', trap: 'sieht aus wie Y' },
  { up: 'Ф', low: 'ф', latin: 'f', sound: 'f' },
  { up: 'Х', low: 'х', latin: 'kh', sound: 'ch wie in "Bach"', trap: 'sieht aus wie X' },
  { up: 'Ц', low: 'ц', latin: 'ts', sound: 'z wie in "Zeit"' },
  { up: 'Ч', low: 'ч', latin: 'ch', sound: 'tsch wie in "Tschüss"' },
  { up: 'Ш', low: 'ш', latin: 'sh', sound: 'sch' },
  { up: 'Щ', low: 'щ', latin: 'shch', sound: 'langes weiches sch(tsch)' },
  { up: 'Ъ', low: 'ъ', latin: '–', sound: 'Härtezeichen (stumm)' },
  { up: 'Ы', low: 'ы', latin: 'y', sound: 'dumpfes i (zwischen i und ü)' },
  { up: 'Ь', low: 'ь', latin: '’', sound: 'Weichheitszeichen (stumm)' },
  { up: 'Э', low: 'э', latin: 'e', sound: 'e wie in "Ende"' },
  { up: 'Ю', low: 'ю', latin: 'yu', sound: 'ju wie in "Jugend"' },
  { up: 'Я', low: 'я', latin: 'ya', sound: 'ja', trap: 'gespiegeltes R' },
]

interface LangInfo { key: string; name: string; flag: string; special: string; missing?: string; note: string; words: string[] }

/** Woran man die Sprachen auf Schildern unterscheidet */
const LANGS: LangInfo[] = [
  { key: 'ru', name: 'Russisch', flag: 'RU', special: 'ы э ё ъ', note: 'Hat ы und э – beides gibt es im Ukrainischen nicht.', words: ['Выход', 'Добро пожаловать', 'Улица Мира', 'Остановка'] },
  { key: 'uk', name: 'Ukrainisch', flag: 'UA', special: 'і ї є ґ', missing: 'ы э ё ъ', note: 'ї und є gibt es nur im Ukrainischen.', words: ['Київ', 'Вихід', 'Ласкаво просимо', 'Вулиця'] },
  { key: 'be', name: 'Belarussisch', flag: 'BY', special: 'ў і', missing: 'и щ ъ', note: 'ў (u mit Bogen) ist das Erkennungszeichen.', words: ['Вуліца', 'Сардэчна запрашаем', 'Мінск', 'Выхад'] },
  { key: 'bg', name: 'Bulgarisch', flag: 'BG', special: 'ъ als Vokal (oft!)', missing: 'ы э ё', note: 'Viele ъ mitten im Wort, kein ы und э.', words: ['Път', 'Добре дошли', 'България', 'Тържище'] },
  { key: 'sr', name: 'Serbisch', flag: 'RS', special: 'ј љ њ ђ ћ џ', missing: 'й щ ы э ю я ъ ь', note: 'Ј statt й – und oft zusätzlich lateinische Schrift.', words: ['Јагодина', 'Ћуприја', 'Излаз', 'Добродошли'] },
  { key: 'mk', name: 'Mazedonisch', flag: 'MK', special: 'ѓ ќ ѕ ј љ њ', note: 'Wie Serbisch, aber mit ѓ und ќ.', words: ['Скопје', 'Добредојдовте', 'Ѓорче Петров', 'Ќеј'] },
  { key: 'kk', name: 'Kasachisch', flag: 'KZ', special: 'ә ғ қ ң ө ұ ү һ і', note: 'Viele Buchstaben mit Haken und Strichen (қ ғ ұ).', words: ['Қазақстан', 'Көше', 'Қош келдіңіз', 'Алматы'] },
  { key: 'mn', name: 'Mongolisch', flag: 'MN', special: 'ө ү', note: 'Viele doppelte Vokale (аа, ээ, үү).', words: ['Улаанбаатар', 'Монгол Улс', 'Гудамж', 'Өргөө'] },
  { key: 'ky', name: 'Kirgisisch', flag: 'KG', special: 'ң ө ү', note: 'Wie Mongolisch ө und ү, dazu ң – aber ohne doppelte Vokale.', words: ['Көчө', 'Кыргызстан', 'Бишкек', 'Кош келиңиз'] },
]

/** Orte und Schilder-Wörter zum Lesen üben: [kyrillisch, Umschrift, Bedeutung/Land] */
const WORDS: [string, string, string][] = [
  ['Москва', 'Moskva', 'Moskau · Russland'], ['Санкт-Петербург', 'Sankt-Peterburg', 'Russland'], ['Новосибирск', 'Novosibirsk', 'Russland'],
  ['Екатеринбург', 'Yekaterinburg', 'Russland'], ['Казань', 'Kazan', 'Russland'], ['Нижний Новгород', 'Nizhny Novgorod', 'Russland'],
  ['Челябинск', 'Chelyabinsk', 'Russland'], ['Самара', 'Samara', 'Russland'], ['Ростов-на-Дону', 'Rostov-na-Donu', 'Russland'],
  ['Красноярск', 'Krasnoyarsk', 'Russland'], ['Воронеж', 'Voronezh', 'Russland'], ['Волгоград', 'Volgograd', 'Russland'],
  ['Владивосток', 'Vladivostok', 'Russland'], ['Иркутск', 'Irkutsk', 'Russland'], ['Мурманск', 'Murmansk', 'Russland'],
  ['Сочи', 'Sochi', 'Russland'], ['Калининград', 'Kaliningrad', 'Russland'], ['Пермь', 'Perm', 'Russland'],
  ['Київ', 'Kyiv', 'Kiew · Ukraine'], ['Харків', 'Kharkiv', 'Ukraine'], ['Одеса', 'Odesa', 'Ukraine'], ['Львів', 'Lviv', 'Ukraine'],
  ['Дніпро', 'Dnipro', 'Ukraine'], ['Мінск', 'Minsk', 'Belarus'], ['София', 'Sofia', 'Bulgarien'], ['Пловдив', 'Plovdiv', 'Bulgarien'],
  ['Варна', 'Varna', 'Bulgarien'], ['Београд', 'Beograd', 'Belgrad · Serbien'], ['Нови Сад', 'Novi Sad', 'Serbien'], ['Ниш', 'Niš', 'Serbien'],
  ['Скопје', 'Skopje', 'Nordmazedonien'], ['Алматы', 'Almaty', 'Kasachstan'], ['Астана', 'Astana', 'Kasachstan'],
  ['Улаанбаатар', 'Ulaanbaatar', 'Mongolei'], ['Бишкек', 'Bishkek', 'Kirgisistan'],
  ['Улица', 'Ulitsa', 'Straße'], ['Выход', 'Vykhod', 'Ausgang'], ['Вход', 'Vkhod', 'Eingang'], ['Аптека', 'Apteka', 'Apotheke'],
  ['Магазин', 'Magazin', 'Laden'], ['Продукты', 'Produkty', 'Lebensmittel'], ['Гостиница', 'Gostinitsa', 'Hotel'],
  ['Остановка', 'Ostanovka', 'Haltestelle'], ['Центр', 'Tsentr', 'Zentrum'], ['Почта', 'Pochta', 'Post'], ['Банк', 'Bank', 'Bank'],
  ['Кафе', 'Kafe', 'Café'], ['Шоссе', 'Shosse', 'Landstraße'], ['Проспект', 'Prospekt', 'Allee'], ['Площадь', 'Ploshchad', 'Platz'],
]

/* ── Hilfen ─────────────────────────────────────────────────────────────── */

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

type QuizKind = 'letter' | 'sound' | 'word' | 'lang'
interface Question { prompt: string; sub?: string; answer: string; options: string[]; big?: boolean; letterKey?: string; explain?: string }

const MASTERY_KEY = 'pv-geo-cyrillic-mastery'
const ROUND = 15

function readMastery(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(MASTERY_KEY) || '{}') } catch { return {} }
}

/** Unsichere Buchstaben öfter fragen */
function pickLetters(m: Record<string, number>, n: number): Letter[] {
  const weighted = RUSSIAN.flatMap(l => Array(Math.max(1, 4 - (m[l.up] ?? 0))).fill(l) as Letter[])
  const out: Letter[] = []
  for (const l of shuffle(weighted)) {
    if (!out.includes(l)) out.push(l)
    if (out.length === n) break
  }
  return out
}

function makeQuestions(kind: QuizKind, m: Record<string, number>): Question[] {
  const withLatin = RUSSIAN.filter(l => l.latin !== '–' && l.latin !== '’')
  if (kind === 'letter') {
    return pickLetters(m, ROUND).map(l => {
      const pool = shuffle(RUSSIAN.filter(x => x !== l)).slice(0, 3)
      return {
        prompt: `${l.up} ${l.low}`, sub: 'Wie klingt dieser Buchstabe?', big: true, letterKey: l.up,
        answer: l.sound, options: shuffle([l.sound, ...pool.map(x => x.sound)]),
        explain: l.trap ? `Falle: ${l.trap}` : `Umschrift: ${l.latin}`,
      }
    })
  }
  if (kind === 'sound') {
    return pickLetters(m, ROUND).filter(l => withLatin.includes(l)).map(l => {
      // Ablenker bevorzugt aus den "falschen Freunden", damit man genau hinschaut
      const pool = shuffle(RUSSIAN.filter(x => x !== l)).slice(0, 3)
      return {
        prompt: l.latin, sub: `Welcher Buchstabe klingt wie: ${l.sound}?`, letterKey: l.up,
        answer: `${l.up} ${l.low}`, options: shuffle([`${l.up} ${l.low}`, ...pool.map(x => `${x.up} ${x.low}`)]),
      }
    })
  }
  if (kind === 'word') {
    return shuffle(WORDS).slice(0, ROUND).map(([cyr, lat, meaning]) => {
      const pool = shuffle(WORDS.filter(w => w[1] !== lat)).slice(0, 3)
      return { prompt: cyr, sub: 'Wie liest man das?', big: true, answer: lat, options: shuffle([lat, ...pool.map(w => w[1])]), explain: meaning }
    })
  }
  // Sprache erkennen
  const all = LANGS.flatMap(l => l.words.map(w => ({ w, l })))
  return shuffle(all).slice(0, ROUND).map(({ w, l }) => {
    // Ähnliche Sprachen als Ablenker (sonst zu leicht)
    const near: Record<string, string[]> = {
      ru: ['uk', 'be', 'bg'], uk: ['ru', 'be', 'bg'], be: ['ru', 'uk', 'bg'], bg: ['ru', 'mk', 'sr'], sr: ['mk', 'bg', 'ru'],
      mk: ['sr', 'bg', 'ru'], kk: ['ky', 'mn', 'ru'], mn: ['ky', 'kk', 'ru'], ky: ['kk', 'mn', 'ru'],
    }
    const opts = near[l.key].map(k => LANGS.find(x => x.key === k)!.name)
    return { prompt: w, sub: 'Welche Sprache ist das?', big: true, answer: l.name, options: shuffle([l.name, ...opts]), explain: l.note }
  })
}

/* ── Seite ──────────────────────────────────────────────────────────────── */

export default function CyrillicPage() {
  const [tab, setTab] = useState<'alphabet' | 'langs' | 'quiz'>('alphabet')
  const [kind, setKind] = useState<QuizKind>('letter')
  const [mastery, setMastery] = useState<Record<string, number>>({})
  const [questions, setQuestions] = useState<Question[]>([])
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [score, setScore] = useState({ right: 0, wrong: 0 })
  const [wrongList, setWrongList] = useState<Question[]>([])

  useEffect(() => { setMastery(readMastery()) }, [])

  const start = useCallback((k: QuizKind = kind, retry?: Question[]) => {
    setKind(k)
    setQuestions(retry?.length ? shuffle(retry) : makeQuestions(k, readMastery()))
    setIdx(0)
    setPicked(null)
    setScore({ right: 0, wrong: 0 })
    setWrongList([])
    setTab('quiz')
  }, [kind])

  const q = questions[idx]
  const finished = tab === 'quiz' && questions.length > 0 && idx >= questions.length

  function answer(a: string) {
    if (!q || picked) return
    setPicked(a)
    const right = a === q.answer
    setScore(s => ({ right: s.right + (right ? 1 : 0), wrong: s.wrong + (right ? 0 : 1) }))
    if (!right) setWrongList(w => [...w, q])
    if (q.letterKey) {
      const m = readMastery()
      m[q.letterKey] = Math.max(0, Math.min(3, (m[q.letterKey] ?? 0) + (right ? 1 : -1)))
      try { localStorage.setItem(MASTERY_KEY, JSON.stringify(m)) } catch { /* egal */ }
      setMastery(m)
    }
    setTimeout(() => { setPicked(null); setIdx(i => i + 1) }, right ? 750 : 2000)
  }

  // Tastatur 1–4
  useEffect(() => {
    if (tab !== 'quiz' || !q || picked) return
    const onKey = (e: KeyboardEvent) => {
      const i = Number(e.key) - 1
      if (i >= 0 && i < q.options.length) answer(q.options[i])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const learned = useMemo(() => RUSSIAN.filter(l => (mastery[l.up] ?? 0) >= 3).length, [mastery])

  const KINDS: [QuizKind, string, string][] = [
    ['letter', 'book', 'Buchstabe → Laut'],
    ['sound', 'target', 'Laut → Buchstabe'],
    ['word', 'flag', 'Orte & Schilder lesen'],
    ['lang', 'globe', 'Welche Sprache?'],
  ]

  return (
    <div className="pv-page">
      <div className="pv-page-head">
        <div>
          <Link href="/private/geoguessr" className="pv-btn ghost sm" style={{ marginLeft: -10, marginBottom: 4 }}>
            <Icon name="back" size={15} /> GeoGuessr
          </Link>
          <h1 className="pv-title">Kyrillisch</h1>
          <p className="pv-subtitle">{learned} von {RUSSIAN.length} Buchstaben sicher gelernt</p>
        </div>
        <div className="pv-seg">
          <button className={tab === 'alphabet' ? 'active' : ''} onClick={() => setTab('alphabet')}>Alphabet</button>
          <button className={tab === 'langs' ? 'active' : ''} onClick={() => setTab('langs')}>Sprachen</button>
          <button className={tab === 'quiz' ? 'active' : ''} onClick={() => (questions.length ? setTab('quiz') : start())}>Quiz</button>
        </div>
      </div>

      <div className="pv-chips">
        {KINDS.map(([k, icon, label]) => (
          <button key={k} className={`pv-chip ${tab === 'quiz' && kind === k ? 'active' : ''}`} onClick={() => start(k)}>
            <Icon name={icon} size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === 'alphabet' && (
        <>
          <div className="pv-glass pv-card" style={{ fontSize: 13.5 }}>
            <b>So geht&apos;s:</b> <span className="pv-muted">Die mit <span className="pv-cyr-trap-dot" /> markierten Buchstaben sind &quot;falsche Freunde&quot; –
              sie sehen aus wie lateinische Buchstaben, klingen aber anders (В = w, Н = n, Р = r, С = s, У = u, Х = ch).
              Die Punkte zeigen, wie sicher du einen Buchstaben schon kannst.</span>
          </div>
          <div className="pv-cyr-grid">
            {RUSSIAN.map(l => {
              const m = mastery[l.up] ?? 0
              return (
                <div key={l.up} className={`pv-glass pv-cyr-card ${l.trap ? 'trap' : ''}`}>
                  <div className="pv-cyr-letter">{l.up}<span>{l.low}</span></div>
                  <div className="pv-cyr-latin">{l.latin}</div>
                  <div className="pv-cyr-sound">{l.sound}</div>
                  {l.trap && <div className="pv-cyr-trap">{l.trap}</div>}
                  <div className="pv-cyr-dots" aria-label={`Lernstand ${m} von 3`}>
                    {[0, 1, 2].map(i => <i key={i} className={i < m ? 'on' : ''} />)}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {tab === 'langs' && (
        <div className="pv-cyr-langs">
          {LANGS.map(l => (
            <div key={l.key} className="pv-glass pv-card">
              <div className="pv-row" style={{ gap: 8 }}>
                <span className="pv-badge">{l.flag}</span>
                <div className="pv-h2 pv-grow" style={{ fontSize: 18 }}>{l.name}</div>
              </div>
              <div className="pv-geo-detail"><span className="pv-muted">Extra-Buchstaben</span><span className="big">{l.special}</span></div>
              {l.missing && <div className="pv-geo-detail"><span className="pv-muted">Fehlt</span><span>{l.missing}</span></div>}
              <p className="pv-muted" style={{ fontSize: 13, margin: '8px 0' }}>{l.note}</p>
              <div className="pv-row pv-wrap" style={{ gap: 6 }}>
                {l.words.map(w => <span key={w} className="pv-chip" style={{ cursor: 'default' }}>{w}</span>)}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'quiz' && (
        <div style={{ maxWidth: 640, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!finished && q && (
            <>
              <div className="pv-progress"><span style={{ width: `${(idx / questions.length) * 100}%` }} /></div>
              <div className="pv-glass pv-card" style={{ textAlign: 'center', padding: '28px 20px' }}>
                <p className="pv-eyebrow">Frage {idx + 1} von {questions.length}</p>
                <div className={q.big ? 'pv-cyr-prompt' : 'pv-task-target'} style={{ margin: '8px 0' }}>{q.prompt}</div>
                {q.sub && <div className="pv-muted" style={{ fontSize: 14 }}>{q.sub}</div>}
              </div>
              <div className="pv-answers">
                {q.options.map((o, i) => (
                  <button key={o} className={`pv-answer ${picked ? (o === q.answer ? 'right' : o === picked ? 'wrong' : '') : ''}`} disabled={!!picked} onClick={() => answer(o)}>
                    <span className="pv-muted pv-desktop-only" style={{ fontSize: 12, marginRight: 10 }}>{i + 1}</span>{o}
                  </button>
                ))}
              </div>
              {picked && q.explain && <div className="pv-glass pv-card pv-muted" style={{ fontSize: 13.5 }}>{q.explain}</div>}
              <div className="pv-stats">
                <div className="pv-stat"><b>{score.right}</b><span>Richtig</span></div>
                <div className="pv-stat"><b>{score.wrong}</b><span>Fehler</span></div>
                <div className="pv-stat"><b>{questions.length - idx}</b><span>Übrig</span></div>
              </div>
            </>
          )}
          {finished && (
            <div className="pv-glass pv-card" style={{ textAlign: 'center' }}>
              <p className="pv-eyebrow">Runde geschafft</p>
              <div className="pv-task-target" style={{ fontSize: 34, margin: '6px 0' }}>
                {Math.round((score.right / Math.max(1, score.right + score.wrong)) * 100)} %
              </div>
              <p className="pv-muted" style={{ margin: '0 0 14px', fontSize: 14 }}>{score.right} richtig · {score.wrong} Fehler</p>
              <div className="pv-row pv-wrap" style={{ justifyContent: 'center' }}>
                <button className="pv-btn primary" onClick={() => start(kind)}><Icon name="refresh" size={17} /> Neue Runde</button>
                {wrongList.length > 0 && <button className="pv-btn" onClick={() => start(kind, wrongList)}>Nur Fehler üben ({wrongList.length})</button>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}