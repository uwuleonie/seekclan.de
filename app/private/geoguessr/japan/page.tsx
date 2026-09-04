'use client'

import { useState, useCallback, useMemo } from 'react'
import { PREFECTURE_DATA } from './japan-data'

// ── Regionen ─────────────────────────────────────────────────────────────────

const REGIONS: Record<string, { nameDe: string; color: string }> = {
  hokkaido: { nameDe: 'Hokkaido',       color: '#d81b60' },
  tohoku:   { nameDe: 'Tohoku',         color: '#e91e8c' },
  kanto:    { nameDe: 'Kantō',          color: '#f06292' },
  chubu:    { nameDe: 'Chūbu',          color: '#c2185b' },
  kinki:    { nameDe: 'Kinki/Kansai',   color: '#880e4f' },
  chugoku:  { nameDe: 'Chūgoku',        color: '#ad1457' },
  shikoku:  { nameDe: 'Shikoku',        color: '#f48fb1' },
  kyushu:   { nameDe: 'Kyūshū/Okinawa',color: '#fce4ec' },
}

// Präfektur → Region (für Regions-Modus)
const PREF_TO_REGION: Record<string, string> = Object.fromEntries(
  Object.entries(PREFECTURE_DATA).map(([name, d]) => [name, d.region])
)

// Alle Regionen als eindeutige Liste
const ALL_REGIONS = Object.keys(REGIONS)

type Mode = 'regions' | 'prefectures'
type QuizMode = 'click' | 'name'

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function shuffled<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

export default function JapanPage() {
  const [mode, setMode] = useState<Mode>('regions')
  const [quizMode, setQuizMode] = useState<QuizMode>('click')
  const [correct, setCorrect] = useState<Set<string>>(new Set())
  const [wrongKey, setWrongKey] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [score, setScore] = useState({ right: 0, wrong: 0 })
  const [showAnswer, setShowAnswer] = useState(false)

  const allItems = mode === 'regions' ? ALL_REGIONS : Object.keys(PREFECTURE_DATA)
  const remaining = allItems.filter(k => !correct.has(k))

  const [target, setTarget] = useState<string>(() => getRandomItem(ALL_REGIONS))

  const nextTarget = useCallback((newCorrect: Set<string>, currentMode: Mode) => {
    const items = currentMode === 'regions' ? ALL_REGIONS : Object.keys(PREFECTURE_DATA)
    const left = items.filter(k => !newCorrect.has(k))
    if (left.length === 0) return null
    setQuizMode(prev => prev === 'click' ? 'name' : 'click')
    return getRandomItem(left)
  }, [])

  const reset = (newMode?: Mode) => {
    const m = newMode ?? mode
    setCorrect(new Set())
    setWrongKey(null)
    setScore({ right: 0, wrong: 0 })
    setQuizMode('click')
    setShowAnswer(false)
    setTarget(getRandomItem(m === 'regions' ? ALL_REGIONS : Object.keys(PREFECTURE_DATA)))
  }

  // Klick auf Karte (click-modus)
  const handleMapClick = (key: string) => {
    if (quizMode !== 'click') return
    if (correct.has(key)) return

    // Im Regionen-Modus: key ist Präfektur, wir prüfen ob die Region stimmt
    const clickedTarget = mode === 'regions' ? PREF_TO_REGION[key] : key

    if (clickedTarget === target) {
      const newCorrect = new Set(correct)
      newCorrect.add(target)
      setCorrect(newCorrect)
      setWrongKey(null)
      setScore(s => ({ ...s, right: s.right + 1 }))
      const next = nextTarget(newCorrect, mode)
      if (next) setTarget(next)
    } else {
      setWrongKey(key)
      setScore(s => ({ ...s, wrong: s.wrong + 1 }))
      setTimeout(() => setWrongKey(null), 700)
    }
  }

  // Antwort-Buttons (name-modus)
  const handleNameAnswer = (answer: string) => {
    if (quizMode !== 'name' || showAnswer) return
    setShowAnswer(true)

    if (answer === target) {
      setScore(s => ({ ...s, right: s.right + 1 }))
      setTimeout(() => {
        const newCorrect = new Set(correct)
        newCorrect.add(target)
        setCorrect(newCorrect)
        setShowAnswer(false)
        const next = nextTarget(newCorrect, mode)
        if (next) setTarget(next)
      }, 800)
    } else {
      setWrongKey(answer)
      setScore(s => ({ ...s, wrong: s.wrong + 1 }))
      setTimeout(() => {
        setShowAnswer(false)
        setWrongKey(null)
        // Nächste Frage ohne diese als korrekt zu markieren
        const next = nextTarget(correct, mode)
        if (next) setTarget(next)
        setQuizMode(prev => prev === 'click' ? 'name' : 'click')
      }, 1000)
    }
  }

  // Antwort-Optionen für name-Modus
  const nameOptions = useMemo(() => {
    const distractors = allItems.filter(k => k !== target && !correct.has(k))
    const picked = shuffled(distractors).slice(0, 3)
    return shuffled([target, ...picked])
  }, [target, quizMode]) // eslint-disable-line

  const done = remaining.length === 0

  // Farbe eines SVG-Elements bestimmen
  const getFill = (prefKey: string) => {
    const regionKey = mode === 'regions' ? PREF_TO_REGION[prefKey] : prefKey

    if (mode === 'regions') {
      // Korrekte Region: Einheitlich eingefärbt
      if (correct.has(regionKey)) return REGIONS[regionKey]?.color ?? '#e91e8c'
      // Ziel-Region im name-Modus anzeigen
      if (quizMode === 'name' && showAnswer && regionKey === target) return REGIONS[regionKey]?.color ?? '#e91e8c'
      if (wrongKey === prefKey) return '#ef5350'
      if (hovered === prefKey) return 'rgba(255,255,255,0.45)'
      return 'rgba(255,255,255,0.12)'
    } else {
      if (correct.has(prefKey)) return REGIONS[PREF_TO_REGION[prefKey]]?.color ?? '#e91e8c'
      if (quizMode === 'name' && showAnswer && prefKey === target) return REGIONS[PREF_TO_REGION[prefKey]]?.color ?? '#e91e8c'
      if (wrongKey === prefKey) return '#ef5350'
      if (hovered === prefKey) return 'rgba(255,255,255,0.45)'
      return 'rgba(255,255,255,0.12)'
    }
  }

  const getStroke = (prefKey: string) => {
    const regionKey = mode === 'regions' ? PREF_TO_REGION[prefKey] : prefKey
    if (quizMode === 'click' && !correct.has(regionKey) && regionKey === target)
      return 'rgba(255,255,255,0.7)'
    return 'rgba(255,255,255,0.25)'
  }

  const glass: React.CSSProperties = {
    background: 'rgba(255,255,255,0.38)',
    backdropFilter: 'blur(28px)',
    WebkitBackdropFilter: 'blur(28px)',
    border: '1px solid rgba(255,255,255,0.65)',
    borderRadius: '20px',
    boxShadow: '0 8px 40px rgba(255,80,160,0.1), inset 0 1px 0 rgba(255,255,255,0.85)',
  }

  const targetLabel = mode === 'regions'
    ? REGIONS[target]?.nameDe ?? target
    : target

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <p style={{ fontFamily: '"Playfair Display", Georgia, serif', fontStyle: 'italic', fontSize: '26px', color: 'rgba(150,40,100,0.85)' }}>
            Japan 🗾
          </p>
          <p style={{ fontFamily: 'sans-serif', fontSize: '11px', letterSpacing: '0.1em', color: 'rgba(180,60,120,0.4)', textTransform: 'uppercase', marginTop: '4px' }}>
            {score.right} richtig · {score.wrong} falsch · {remaining.length} übrig
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {(['regions', 'prefectures'] as Mode[]).map(m => (
            <button key={m} onClick={() => { setMode(m); reset(m) }} style={{
              fontFamily: 'sans-serif', fontSize: '11px', letterSpacing: '0.08em',
              padding: '7px 16px', borderRadius: '20px', cursor: 'pointer', border: 'none',
              background: mode === m ? 'rgba(173,20,87,0.85)' : 'rgba(255,255,255,0.45)',
              color: mode === m ? '#fff' : 'rgba(150,40,100,0.7)',
              backdropFilter: 'blur(12px)', transition: 'all 0.2s',
            }}>
              {m === 'regions' ? '8 Regionen' : '47 Präfekturen'}
            </button>
          ))}
          <button onClick={() => reset()} style={{
            fontFamily: 'sans-serif', fontSize: '11px', letterSpacing: '0.08em',
            padding: '7px 14px', borderRadius: '20px', cursor: 'pointer', border: 'none',
            background: 'rgba(255,255,255,0.45)', color: 'rgba(150,40,100,0.7)',
            backdropFilter: 'blur(12px)',
          }}>↺</button>
        </div>
      </div>

      {/* Aufgabe */}
      {!done && (
        <div style={{ ...glass, padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '22px' }}>{quizMode === 'click' ? '👆' : '🔍'}</span>
          <div>
            <p style={{ fontFamily: 'sans-serif', fontSize: '10px', letterSpacing: '0.12em', color: 'rgba(180,60,120,0.4)', textTransform: 'uppercase', marginBottom: '4px' }}>
              {quizMode === 'click' ? 'Klicke auf die Region' : 'Wie heißt diese Region?'}
            </p>
            <p style={{ fontFamily: '"Playfair Display", Georgia, serif', fontStyle: 'italic', fontSize: '24px', color: 'rgba(150,40,100,0.9)' }}>
              {targetLabel}
            </p>
          </div>
        </div>
      )}

      {done && (
        <div style={{ ...glass, padding: '28px', textAlign: 'center' }}>
          <p style={{ fontFamily: '"Playfair Display", Georgia, serif', fontStyle: 'italic', fontSize: '26px', color: 'rgba(150,40,100,0.85)', marginBottom: '8px' }}>Geschafft! 🎉</p>
          <p style={{ fontFamily: 'sans-serif', fontSize: '12px', color: 'rgba(180,60,120,0.4)', marginBottom: '16px' }}>{score.right} richtig · {score.wrong} Fehler</p>
          <button onClick={() => reset()} style={{ fontFamily: 'sans-serif', fontSize: '12px', letterSpacing: '0.08em', padding: '10px 28px', borderRadius: '20px', cursor: 'pointer', border: 'none', background: 'rgba(173,20,87,0.85)', color: '#fff' }}>Nochmal</button>
        </div>
      )}

      {/* Karte + Antworten */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* SVG Karte */}
        <div style={{ ...glass, padding: '12px', flex: '0 0 auto', overflow: 'hidden' }}>
          <svg
            viewBox="0 0 600 800"
            width="480"
            height="640"
            style={{ display: 'block' }}
          >
            {Object.entries(PREFECTURE_DATA).map(([prefKey, d]) => (
              <g key={prefKey}>
                {d.paths.map((path, i) => (
                  <path
                    key={i}
                    d={path}
                    fill={getFill(prefKey)}
                    stroke={getStroke(prefKey)}
                    strokeWidth={0.8}
                    style={{
                      cursor: quizMode === 'click' ? 'pointer' : 'default',
                      transition: 'fill 0.15s',
                    }}
                    onMouseEnter={() => setHovered(prefKey)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => handleMapClick(prefKey)}
                  />
                ))}
              </g>
            ))}

            {/* Labels für korrekte Einträge */}
            {mode === 'regions'
              ? ALL_REGIONS.map(rKey => {
                  if (!correct.has(rKey)) return null
                  const prefs = Object.entries(PREFECTURE_DATA).filter(([, v]) => v.region === rKey)
                  if (!prefs.length) return null
                  const cx = prefs.reduce((s, [, v]) => s + v.cx, 0) / prefs.length
                  const cy = prefs.reduce((s, [, v]) => s + v.cy, 0) / prefs.length
                  return (
                    <text key={rKey} x={cx} y={cy} textAnchor="middle" fontSize="11" fill="white"
                      style={{ pointerEvents: 'none', fontFamily: 'sans-serif', fontWeight: 600, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                      {REGIONS[rKey]?.nameDe}
                    </text>
                  )
                })
              : Object.entries(PREFECTURE_DATA).map(([prefKey, d]) => {
                  if (!correct.has(prefKey)) return null
                  return (
                    <text key={prefKey} x={d.cx} y={d.cy} textAnchor="middle" fontSize="7" fill="white"
                      style={{ pointerEvents: 'none', fontFamily: 'sans-serif', fontWeight: 600 }}>
                      {prefKey}
                    </text>
                  )
                })
            }
          </svg>
        </div>

        {/* Rechte Spalte: Antworten oder Legende */}
        <div style={{ flex: 1, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Name-Modus Buttons */}
          {quizMode === 'name' && !done && (
            <>
              <p style={{ fontFamily: 'sans-serif', fontSize: '10px', letterSpacing: '0.12em', color: 'rgba(180,60,120,0.4)', textTransform: 'uppercase' }}>Wähle:</p>
              {nameOptions.map(key => {
                const label = mode === 'regions' ? (REGIONS[key]?.nameDe ?? key) : key
                const isRight = showAnswer && key === target
                const isWrong = showAnswer && wrongKey === key
                return (
                  <button
                    key={key}
                    onClick={() => handleNameAnswer(key)}
                    style={{
                      ...glass,
                      padding: '14px 20px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      border: isRight
                        ? '1px solid rgba(76,175,80,0.6)'
                        : isWrong
                        ? '1px solid rgba(239,83,80,0.6)'
                        : '1px solid rgba(255,255,255,0.65)',
                      background: isRight
                        ? 'rgba(76,175,80,0.15)'
                        : isWrong
                        ? 'rgba(239,83,80,0.1)'
                        : 'rgba(255,255,255,0.38)',
                      fontFamily: '"Playfair Display", Georgia, serif',
                      fontStyle: 'italic',
                      fontSize: '18px',
                      color: 'rgba(150,40,100,0.85)',
                      transition: 'all 0.2s',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </>
          )}

          {/* Regionen-Legende */}
          <div style={{ ...glass, padding: '16px 20px' }}>
            <p style={{ fontFamily: 'sans-serif', fontSize: '10px', letterSpacing: '0.12em', color: 'rgba(180,60,120,0.4)', textTransform: 'uppercase', marginBottom: '12px' }}>
              Regionen
            </p>
            {ALL_REGIONS.map(rKey => (
              <div key={rKey} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <div style={{
                  width: '10px', height: '10px', borderRadius: '3px',
                  background: correct.has(rKey) ? REGIONS[rKey].color : 'rgba(255,255,255,0.35)',
                  transition: 'background 0.3s',
                  flexShrink: 0,
                }} />
                <span style={{
                  fontFamily: 'sans-serif', fontSize: '12px',
                  color: correct.has(rKey) ? 'rgba(100,20,60,0.85)' : 'rgba(150,40,100,0.35)',
                  transition: 'color 0.3s',
                }}>
                  {REGIONS[rKey].nameDe}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}