'use client'

// Allgemeines Karten-Quiz für den GeoGuessr-Bereich (Brasilien, Indien, Türkei, USA …).
// Aufgebaut wie das Japan-Quiz: Lernen · Auf Karte finden · Namen zuordnen · Gemischt,
// dazu optional "Wissen" (Frage ohne Karte, z.B. Hauptstadt oder Schrift erkennen).
//
// Eine Karte besteht aus Flächen (shapes). Ein Quiz-Eintrag (item) gehört zu einer oder
// mehreren Flächen – so kann dieselbe Karte z.B. nach Bundesstaaten ODER nach Sprachen gefragt werden.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import Icon from '../../_components/Icon'

export interface QuizShape { key: string; d: string; lx: number; ly: number }

export interface QuizItem {
  key: string
  /** Name, der im Namen-Modus als Antwort steht */
  label: string
  /** Was im Klick-Modus gesucht wird (Standard: label) */
  prompt?: string
  /** Kleinere Zusatzzeile zur Frage (z.B. Bundesstaat bei einer Stadt) */
  promptSub?: string
  group: string
  /** Flächen, die zu diesem Eintrag gehören */
  shapes: string[]
  /** Beschriftung auf der Karte (Standard: Mittelpunkt der ersten Fläche) */
  lx?: number
  ly?: number
  /** Punkt-Markierung (z.B. Stadt) */
  point?: [number, number]
  /** Infos im Lernmodus */
  details?: { label: string; value: string; big?: boolean }[]
  /** Wissens-Frage ohne Karte */
  text?: { prompt: string; sub?: string; answer: string; big?: boolean }
}

export interface QuizScope {
  key: string
  label: string
  /** z.B. "Wo liegt …?" */
  askClick: string
  /** z.B. "Wie heißt der markierte Bundesstaat?" */
  askName: string
  /** Überschrift der Wissens-Fragen, z.B. "Welche Sprache ist das?" */
  askText?: string
  itemsNoun: string
  shapes: QuizShape[]
  items: QuizItem[]
  groups: Record<string, { name: string; color: string }>
  /** Schriftgröße der Beschriftung (Kartenmaßstab) */
  labelSize?: number
}

type Mode = 'learn' | 'click' | 'name' | 'text' | 'mixed'
type Ask = 'click' | 'name' | 'text'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function MapQuiz({
  title, storageKey, viewBox, scopes, tips, intro,
}: {
  title: string
  storageKey: string
  viewBox: { x: number; y: number; w: number; h: number }
  scopes: QuizScope[]
  /** Extra-Karte unter der Legende (z.B. Tipps fürs Erkennen) */
  tips?: (scope: QuizScope) => ReactNode
  /** Kurzer Text unter dem Titel */
  intro?: string
}) {
  const BASE_VB = viewBox
  const unit = BASE_VB.w / 520 // Strichstärke/Schrift wie beim Japan-Quiz
  const [scopeKey, setScopeKey] = useState(scopes[0].key)
  const scope = scopes.find(s => s.key === scopeKey) ?? scopes[0]
  const hasText = scope.items.some(i => i.text)
  const [mode, setMode] = useState<Mode>('click')

  const itemByKey = useMemo(() => Object.fromEntries(scope.items.map(i => [i.key, i])), [scope])
  const itemOfShape = useMemo(() => {
    const m: Record<string, QuizItem> = {}
    for (const it of scope.items) for (const s of it.shapes) if (!m[s]) m[s] = it
    return m
  }, [scope])
  const shapeByKey = useMemo(() => Object.fromEntries(scope.shapes.map(s => [s.key, s])), [scope])
  const groupKeys = useMemo(() => Object.keys(scope.groups).filter(g => scope.items.some(i => i.group === g)), [scope])

  const labelPos = useCallback((it: QuizItem): [number, number] => {
    if (it.point) return it.point
    if (it.lx !== undefined && it.ly !== undefined) return [it.lx, it.ly]
    const s = shapeByKey[it.shapes[0]]
    return s ? [s.lx, s.ly] : [0, 0]
  }, [shapeByKey])

  // Quiz-Zustand
  const [queue, setQueue] = useState<string[]>([])
  const [ask, setAsk] = useState<Ask>('click')
  const [solved, setSolved] = useState<Set<string>>(new Set())
  const [mistakes, setMistakes] = useState<Set<string>>(new Set())
  const [score, setScore] = useState({ right: 0, wrong: 0, streak: 0, bestStreak: 0 })
  const [flash, setFlash] = useState<{ key: string; ok: boolean } | null>(null)
  const [reveal, setReveal] = useState(false)
  const [tries, setTries] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [startedAt, setStartedAt] = useState(() => Date.now())
  const [finishedIn, setFinishedIn] = useState<number | null>(null)
  const [newBest, setNewBest] = useState(false)
  const [best, setBest] = useState<{ accuracy: number; seconds: number } | null>(null)

  // Karte
  const [hover, setHover] = useState<string | null>(null) // Flächen-Key
  const [info, setInfo] = useState<string | null>(null) // Lernmodus: Item-Key
  const [showLabels, setShowLabels] = useState(false)
  const [vb, setVb] = useState(BASE_VB)
  const [dragging, setDragging] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ moved: boolean; startDist: number; startVb: typeof BASE_VB; mid: { x: number; y: number } } | null>(null)

  const target = queue[0]
  const targetItem = target ? itemByKey[target] : undefined
  const done = mode !== 'learn' && queue.length === 0 && (score.right + score.wrong) > 0
  const answered = score.right + score.wrong
  const accuracy = answered ? Math.round((score.right / answered) * 100) : 0
  const bestKey = `pv-geo-${storageKey}-${scope.key}-best`

  const nextAsk = useCallback((m: Mode): Ask => {
    if (m === 'name') return 'name'
    if (m === 'text') return 'text'
    if (m === 'mixed') {
      const opts: Ask[] = hasText ? ['click', 'name', 'text'] : ['click', 'name']
      return opts[Math.floor(Math.random() * opts.length)]
    }
    return 'click'
  }, [hasText])

  /* ── Neues Spiel ── */
  const restart = useCallback((s: QuizScope = scope, m: Mode = mode, only?: string[]) => {
    const pool = m === 'text' ? s.items.filter(i => i.text).map(i => i.key) : s.items.map(i => i.key)
    setQueue(shuffle(only?.length ? only : pool))
    setSolved(new Set())
    setMistakes(new Set())
    setScore({ right: 0, wrong: 0, streak: 0, bestStreak: 0 })
    setFlash(null)
    setReveal(false)
    setTries(0)
    setPicked(null)
    setInfo(null)
    setStartedAt(Date.now())
    setFinishedIn(null)
    setNewBest(false)
    setAsk(nextAsk(m))
  }, [scope, mode, nextAsk])

  // Erster Start + Bestwert lesen
  useEffect(() => { restart(scope, mode) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    try { const raw = localStorage.getItem(bestKey); setBest(raw ? JSON.parse(raw) : null) } catch { setBest(null) }
  }, [bestKey, newBest])

  function changeScope(k: string) {
    const s = scopes.find(x => x.key === k)!
    setScopeKey(k)
    const m = mode === 'text' && !s.items.some(i => i.text) ? 'click' : mode
    setMode(m)
    setVb(BASE_VB)
    restart(s, m)
  }
  function changeMode(m: Mode) { setMode(m); restart(scope, m) }

  /* ── Nächste Frage ── */
  const advance = useCallback((wasRight: boolean) => {
    setQueue(q => {
      const [first, ...rest] = q
      if (wasRight) return rest
      const pos = Math.min(rest.length, 3 + Math.floor(Math.random() * 3))
      return [...rest.slice(0, pos), first, ...rest.slice(pos)]
    })
    setTries(0)
    setReveal(false)
    setPicked(null)
    setAsk(nextAsk(mode))
  }, [mode, nextAsk])

  // Wissens-Frage nur für Einträge mit Text – sonst im Mix auf Karte ausweichen
  useEffect(() => {
    if (ask === 'text' && targetItem && !targetItem.text) setAsk(Math.random() < 0.5 ? 'click' : 'name')
  }, [ask, targetItem])

  const registerAnswer = useCallback((right: boolean) => {
    setScore(s => {
      const streak = right ? s.streak + 1 : 0
      return { right: s.right + (right ? 1 : 0), wrong: s.wrong + (right ? 0 : 1), streak, bestStreak: Math.max(s.bestStreak, streak) }
    })
    if (right) setSolved(prev => new Set(prev).add(target))
    else setMistakes(prev => new Set(prev).add(target))
  }, [target])

  /* Ende → Bestwert speichern */
  useEffect(() => {
    if (!done || finishedIn !== null) return
    const secs = Math.round((Date.now() - startedAt) / 1000)
    setFinishedIn(secs)
    try {
      const raw = localStorage.getItem(bestKey)
      const prev = raw ? JSON.parse(raw) : null
      if (!prev || accuracy > prev.accuracy || (accuracy === prev.accuracy && secs < prev.seconds)) {
        localStorage.setItem(bestKey, JSON.stringify({ accuracy, seconds: secs, date: new Date().toISOString() }))
        setNewBest(true)
      }
    } catch { /* egal */ }
  }, [done, finishedIn, startedAt, accuracy, bestKey])

  /* ── Klick auf die Karte ── */
  function onMapPick(shapeKey: string) {
    if (gesture.current?.moved) return
    const it = itemOfShape[shapeKey]
    if (!it) return
    if (mode === 'learn') { setInfo(it.key); return }
    if (done || ask !== 'click' || reveal || !target) return
    if (solved.has(it.key) && it.key !== target) return

    // Richtig, wenn die Fläche zum gesuchten Eintrag gehört (auch wenn sie mehreren gehört)
    const hit = targetItem?.shapes.includes(shapeKey)
    if (hit) {
      registerAnswer(tries === 0)
      if (tries > 0) setSolved(prev => new Set(prev).add(target))
      setFlash({ key: target, ok: true })
      setTimeout(() => { setFlash(null); advance(true) }, 450)
    } else {
      setFlash({ key: it.key, ok: false })
      setTimeout(() => setFlash(null), 600)
      const n = tries + 1
      setTries(n)
      if (n === 1) setMistakes(prev => new Set(prev).add(target))
      if (n >= 3) {
        registerAnswer(false)
        setReveal(true)
        setTimeout(() => advance(false), 1700)
      }
    }
  }

  /* ── Antworten im Namen-/Wissens-Modus ── */
  const options = useMemo(() => {
    if (!targetItem || ask === 'click') return []
    const answerOf = (i: QuizItem) => (ask === 'text' ? i.text?.answer : i.label)
    const right = answerOf(targetItem)
    if (!right) return []
    const others = scope.items.filter(i => i.key !== targetItem.key && answerOf(i) && answerOf(i) !== right)
    // Zwei Ablenker aus derselben Gruppe → echtes Lernen statt Raten
    const same = shuffle(others.filter(i => i.group === targetItem.group))
    const pool = [...same.slice(0, 2), ...shuffle(others.filter(i => !same.slice(0, 2).includes(i)))]
    const answers: string[] = []
    for (const i of pool) {
      const a = answerOf(i)!
      if (!answers.includes(a)) answers.push(a)
      if (answers.length === 3) break
    }
    return shuffle([right, ...answers])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetItem, ask, scope, queue.length])

  const rightAnswer = targetItem ? (ask === 'text' ? targetItem.text?.answer : targetItem.label) : undefined

  function onOptionPick(a: string) {
    if (picked) return
    setPicked(a)
    const right = a === rightAnswer
    registerAnswer(right)
    setTimeout(() => advance(right), right ? 700 : 1600)
  }

  /* ── Tastatur: 1–4 für Antworten ── */
  useEffect(() => {
    if (ask === 'click' || done || mode === 'learn') return
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      const i = Number(e.key) - 1
      if (i >= 0 && i < options.length) onOptionPick(options[i])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  /* ── Zoom & Verschieben ── */
  const clampVb = (v: typeof BASE_VB) => {
    const w = Math.min(BASE_VB.w * 1.15, Math.max(BASE_VB.w / 14, v.w))
    const h = w * (BASE_VB.h / BASE_VB.w)
    const x = Math.min(BASE_VB.x + BASE_VB.w - w * 0.3, Math.max(BASE_VB.x - w * 0.7, v.x))
    const y = Math.min(BASE_VB.y + BASE_VB.h - h * 0.3, Math.max(BASE_VB.y - h * 0.7, v.y))
    return { x, y, w, h }
  }
  const unitsPerPx = () => {
    const r = svgRef.current?.getBoundingClientRect()
    if (!r) return 1
    return Math.max(vb.w / r.width, vb.h / r.height)
  }
  const toSvg = (cx: number, cy: number, v = vb) => {
    const r = svgRef.current!.getBoundingClientRect()
    const s = Math.max(v.w / r.width, v.h / r.height)
    const offX = (r.width * s - v.w) / 2
    const offY = (r.height * s - v.h) / 2
    return { x: v.x - offX + (cx - r.left) * s, y: v.y - offY + (cy - r.top) * s }
  }
  const zoomAt = (factor: number, cx?: number, cy?: number) => {
    setVb(v => {
      const r = svgRef.current?.getBoundingClientRect()
      const p = r && cx !== undefined && cy !== undefined ? toSvg(cx, cy, v) : { x: v.x + v.w / 2, y: v.y + v.h / 2 }
      return clampVb({ x: p.x - (p.x - v.x) * factor, y: p.y - (p.y - v.y) * factor, w: v.w * factor, h: v.h * factor })
    })
  }

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoomAt(e.deltaY > 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })

  function onPointerDown(e: React.PointerEvent) {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pts = [...pointers.current.values()]
    gesture.current = {
      moved: false,
      startDist: pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0,
      startVb: vb,
      mid: pts.length === 2 ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } : { x: e.clientX, y: e.clientY },
    }
  }
  function onPointerMove(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId)
    if (!prev || !gesture.current) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pts = [...pointers.current.values()]
    const g = gesture.current
    if (pts.length === 2 && g.startDist) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const factor = g.startDist / dist
      g.moved = true
      const anchor = toSvg(g.mid.x, g.mid.y, g.startVb)
      const w = g.startVb.w * factor
      setVb(clampVb({ x: anchor.x - (anchor.x - g.startVb.x) * factor, y: anchor.y - (anchor.y - g.startVb.y) * factor, w, h: w * (BASE_VB.h / BASE_VB.w) }))
      return
    }
    const dx = e.clientX - prev.x
    const dy = e.clientY - prev.y
    if (!g.moved && Math.hypot(e.clientX - g.mid.x, e.clientY - g.mid.y) < 6) return
    if (!g.moved) {
      g.moved = true
      setDragging(true)
      ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    }
    const s = unitsPerPx()
    setVb(v => clampVb({ ...v, x: v.x - dx * s, y: v.y - dy * s }))
  }
  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId)
    setDragging(false)
    setTimeout(() => { if (!pointers.current.size) gesture.current = null }, 0)
  }

  const zoomed = vb.w < BASE_VB.w * 0.98
  const fontUnit = (vb.w / BASE_VB.w) * unit

  /* ── Farben ── */
  function fillFor(shapeKey: string): string {
    const it = itemOfShape[shapeKey]
    if (!it) return 'rgba(255,255,255,0.35)' // gehört zu keinem Eintrag (z.B. Washington D.C.)
    const color = scope.groups[it.group]?.color ?? '#a93bc9'
    const isTarget = !!targetItem?.shapes.includes(shapeKey)
    if (flash && (flash.ok ? isTarget : flash.key === it.key)) return flash.ok ? '#25845c' : '#c0344f'

    if (mode === 'learn') {
      const sel = info ? itemByKey[info] : null
      if (sel?.shapes.includes(shapeKey)) return color
      if (sel && sel.group === it.group) return `${color}55`
      if (hover === shapeKey) return 'rgba(255,255,255,0.95)'
      return `${color}30`
    }
    if (solved.has(it.key) && !(ask !== 'click' && isTarget)) return color
    if (reveal && isTarget) return '#e0913a'
    if (ask === 'name' && isTarget) return picked ? (picked === rightAnswer ? '#25845c' : '#e0913a') : '#8b3fd9'
    if (ask === 'text' && isTarget && picked) return picked === rightAnswer ? '#25845c' : '#e0913a'
    if (ask === 'click' && hover && itemOfShape[hover]?.key === it.key) return 'rgba(255,255,255,0.95)'
    return 'rgba(255,255,255,0.82)'
  }

  const hoverItem = hover ? itemOfShape[hover] : undefined
  const showHoverName = hoverItem && (mode === 'learn' || solved.has(hoverItem.key))
  const labelItems = scope.items.filter(it => showLabels || (mode === 'learn' ? info === it.key : solved.has(it.key)))
  const points = scope.items.filter(it => it.point)
  const infoItem = info ? itemByKey[info] : null
  const labelSize = (scope.labelSize ?? 8) * fontUnit

  const taskBlock = (
    <>
      {mode === 'learn' ? (
        <div className="pv-glass pv-card">
          {infoItem ? (
            <>
              <p className="pv-eyebrow">{scope.groups[infoItem.group]?.name}</p>
              <div className="pv-task-target" style={{ margin: '4px 0 10px' }}>{infoItem.prompt ?? infoItem.label}</div>
              {infoItem.details?.map(d => (
                <div key={d.label} className="pv-geo-detail">
                  <span className="pv-muted">{d.label}</span>
                  <span className={d.big ? 'big' : ''}>{d.value}</span>
                </div>
              ))}
              <p className="pv-label" style={{ marginTop: 12 }}>Ebenfalls: {scope.groups[infoItem.group]?.name}</p>
              <div className="pv-row pv-wrap" style={{ gap: 6 }}>
                {scope.items.filter(i => i.group === infoItem.group).map(i => (
                  <button key={i.key} className={`pv-chip ${i.key === info ? 'active' : ''}`} onClick={() => setInfo(i.key)}>{i.label}</button>
                ))}
              </div>
            </>
          ) : (
            <div className="pv-muted" style={{ fontSize: 14 }}>
              Tippe auf die Karte, um Infos zu sehen. Mit zwei Fingern oder dem Mausrad zoomen, zum Verschieben ziehen.
            </div>
          )}
        </div>
      ) : done ? (
        <div className="pv-glass pv-card" style={{ textAlign: 'center' }}>
          <p className="pv-eyebrow">Geschafft</p>
          <div className="pv-task-target" style={{ fontSize: 34, margin: '6px 0' }}>{accuracy} %</div>
          <p className="pv-muted" style={{ margin: '0 0 14px', fontSize: 14 }}>
            {score.right} richtig · {score.wrong} Fehler
            {finishedIn !== null && ` · ${Math.floor(finishedIn / 60)}:${String(finishedIn % 60).padStart(2, '0')} Min.`}
          </p>
          {newBest && <p className="pv-badge ok" style={{ marginBottom: 14 }}>Neuer Bestwert</p>}
          <div className="pv-row pv-wrap" style={{ justifyContent: 'center' }}>
            <button className="pv-btn primary" onClick={() => restart()}><Icon name="refresh" size={17} /> Nochmal</button>
            {mistakes.size > 0 && (
              <button className="pv-btn" onClick={() => restart(scope, mode, [...mistakes])}>Nur Fehler üben ({mistakes.size})</button>
            )}
          </div>
        </div>
      ) : targetItem ? (
        <>
          <div className="pv-glass pv-task">
            <span className="pv-task-icon"><Icon name={ask === 'click' ? 'pointer' : ask === 'name' ? 'target' : 'book'} size={22} /></span>
            <div className="pv-grow" style={{ minWidth: 0 }}>
              <p className="pv-eyebrow">{ask === 'click' ? scope.askClick : ask === 'name' ? scope.askName : scope.askText}</p>
              {ask === 'text' && targetItem.text ? (
                <>
                  <div className={`pv-task-target ${targetItem.text.big ? 'pv-geo-script' : ''}`} style={{ whiteSpace: 'normal' }}>{targetItem.text.prompt}</div>
                  {targetItem.text.sub && <div className="pv-muted" style={{ fontSize: 13 }}>{targetItem.text.sub}</div>}
                </>
              ) : (
                <>
                  <div className="pv-task-target pv-ellipsis">{ask === 'click' ? targetItem.prompt ?? targetItem.label : '?'}</div>
                  {ask === 'click' && targetItem.promptSub && <div className="pv-muted" style={{ fontSize: 13 }}>{targetItem.promptSub}</div>}
                </>
              )}
              {ask === 'click' && tries > 0 && !reveal && (
                <div style={{ fontSize: 12.5, color: 'var(--pv-danger)', marginTop: 2 }}>
                  Nicht ganz – {3 - tries} {3 - tries === 1 ? 'Versuch' : 'Versuche'} übrig
                  {tries >= 2 && ` · Tipp: ${scope.groups[targetItem.group]?.name}`}
                </div>
              )}
              {reveal && <div style={{ fontSize: 12.5, color: '#b86a1c', marginTop: 2 }}>Hier ist es – kommt gleich nochmal dran</div>}
            </div>
          </div>

          {ask !== 'click' && (
            <div className="pv-answers">
              {options.map((a, i) => {
                const cls = picked ? (a === rightAnswer ? 'right' : a === picked ? 'wrong' : '') : ''
                return (
                  <button key={a} className={`pv-answer ${cls}`} disabled={!!picked} onClick={() => onOptionPick(a)}>
                    <span className="pv-muted pv-desktop-only" style={{ fontSize: 12, marginRight: 10 }}>{i + 1}</span>
                    {a}
                  </button>
                )
              })}
            </div>
          )}
          {ask === 'text' && picked && (
            <div className="pv-muted" style={{ fontSize: 13, padding: '0 4px' }}>
              {targetItem.label} · {scope.groups[targetItem.group]?.name} – auf der Karte markiert
            </div>
          )}
        </>
      ) : null}
    </>
  )

  const pool = mode === 'text' ? scope.items.filter(i => i.text).length : scope.items.length
  const progress = pool ? ((pool - queue.length) / pool) * 100 : 0
  const MODES: [Mode, string, string][] = [
    ['learn', 'book', 'Lernen'],
    ['click', 'pointer', 'Auf Karte finden'],
    ['name', 'target', 'Namen zuordnen'],
    ...(hasText ? [['text', 'sparkle', scope.askText?.replace(/\?$/, '') ?? 'Wissen'] as [Mode, string, string]] : []),
    ['mixed', 'shuffle', 'Gemischt'],
  ]

  return (
    <div className="pv-page">
      <div className="pv-page-head">
        <div>
          <Link href="/private/geoguessr" className="pv-btn ghost sm" style={{ marginLeft: -10, marginBottom: 4 }}>
            <Icon name="back" size={15} /> GeoGuessr
          </Link>
          <h1 className="pv-title">{title}</h1>
          <p className="pv-subtitle">
            {mode === 'learn'
              ? intro ?? 'Lernmodus – tippe auf die Karte'
              : `${pool - queue.length} von ${pool} ${scope.itemsNoun} geschafft${best ? ` · Bestwert ${best.accuracy} %` : ''}`}
          </p>
        </div>
        <div className="pv-row pv-wrap">
          {scopes.length > 1 && (
            <div className="pv-seg">
              {scopes.map(s => (
                <button key={s.key} className={scope.key === s.key ? 'active' : ''} onClick={() => changeScope(s.key)}>{s.label}</button>
              ))}
            </div>
          )}
          <button className="pv-icon-btn" aria-label="Neu starten" title="Neu starten" onClick={() => restart()}><Icon name="refresh" size={18} /></button>
        </div>
      </div>

      <div className="pv-chips">
        {MODES.map(([m, icon, label]) => (
          <button key={m} className={`pv-chip ${mode === m ? 'active' : ''}`} onClick={() => changeMode(m)}>
            <Icon name={icon} size={15} /> {label}
          </button>
        ))}
      </div>

      {mode !== 'learn' && <div className="pv-progress"><span style={{ width: `${progress}%` }} /></div>}

      <div className="pv-phone-only" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{taskBlock}</div>

      <div className="pv-geo-layout">
        <div className="pv-glass pv-map-wrap">
          <svg
            ref={svgRef}
            className={`pv-map ${dragging ? 'dragging' : ''}`}
            viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={() => setHover(null)}
            role="img"
            aria-label={`Karte: ${title}`}
          >
            {scope.shapes.map(s => (
              <path
                key={s.key}
                data-key={s.key}
                d={s.d}
                fill={fillFor(s.key)}
                stroke="rgba(90, 30, 80, 0.45)"
                strokeWidth={0.7 * fontUnit}
                strokeLinejoin="round"
                onClick={() => onMapPick(s.key)}
                onPointerEnter={e => { if (e.pointerType === 'mouse') setHover(s.key) }}
                style={{ cursor: itemOfShape[s.key] && (mode === 'learn' || ask === 'click') ? 'pointer' : 'default' }}
              />
            ))}

            {/* Städte als Punkte */}
            {points.map(it => {
              const isT = targetItem?.key === it.key && ask === 'name'
              return (
                <circle
                  key={it.key}
                  cx={it.point![0]}
                  cy={it.point![1]}
                  r={(isT ? 5 : 3.2) * fontUnit}
                  fill={isT ? '#8b3fd9' : solved.has(it.key) || mode === 'learn' ? '#3a1433' : 'rgba(58,20,51,0.55)'}
                  stroke="#fff"
                  strokeWidth={1.2 * fontUnit}
                  onClick={() => onMapPick(it.shapes[0])}
                  style={{ cursor: 'pointer' }}
                />
              )
            })}

            <g style={{ pointerEvents: 'none', fontFamily: 'inherit', fontWeight: 600 }}>
              {labelItems.map(it => {
                const [x, y] = labelPos(it)
                return (
                  <text key={it.key} x={x} y={it.point ? y - 6 * fontUnit : y} textAnchor="middle" dominantBaseline={it.point ? 'auto' : 'middle'}
                    fontSize={labelSize} fill="#fff" stroke="rgba(58,20,51,0.6)" strokeWidth={2 * fontUnit} paintOrder="stroke">
                    {it.label}
                  </text>
                )
              })}
            </g>
          </svg>

          <div className="pv-map-tools">
            <button className="pv-icon-btn" aria-label="Hineinzoomen" onClick={() => zoomAt(1 / 1.4)}><Icon name="zoomIn" size={18} /></button>
            <button className="pv-icon-btn" aria-label="Herauszoomen" onClick={() => zoomAt(1.4)}><Icon name="zoomOut" size={18} /></button>
            {zoomed && <button className="pv-icon-btn" aria-label="Ganze Karte" onClick={() => setVb(BASE_VB)}><Icon name="refresh" size={17} /></button>}
            <button className={`pv-icon-btn ${showLabels ? 'active' : ''}`} aria-label="Alle Namen anzeigen" title="Alle Namen anzeigen" onClick={() => setShowLabels(s => !s)}>
              <Icon name="eye" size={18} />
            </button>
          </div>
          {hoverItem && showHoverName && (
            <div className="pv-map-hover">{hoverItem.prompt ?? hoverItem.label} · {scope.groups[hoverItem.group]?.name}</div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="pv-desktop-only" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{taskBlock}</div>

          {mode !== 'learn' && (
            <div className="pv-stats">
              <div className="pv-stat"><b>{score.right}</b><span>Richtig</span></div>
              <div className="pv-stat"><b>{score.wrong}</b><span>Fehler</span></div>
              <div className="pv-stat"><b>{score.streak}</b><span>Serie</span></div>
            </div>
          )}

          <div className="pv-glass pv-card">
            <p className="pv-label" style={{ marginBottom: 8 }}>Gruppen</p>
            {groupKeys.map(g => {
              const items = scope.items.filter(i => i.group === g)
              const known = mode === 'learn' || showLabels || items.every(i => solved.has(i.key))
              return (
                <div key={g} className="pv-legend-item">
                  <span className="pv-legend-swatch" style={{ background: known ? scope.groups[g].color : 'rgba(255,255,255,0.7)', border: '1px solid rgba(90,30,80,0.2)' }} />
                  <span style={{ color: known ? 'var(--pv-ink)' : 'var(--pv-ink-3)' }}>{scope.groups[g].name}</span>
                  {mode !== 'learn' && (
                    <span className="pv-muted" style={{ marginLeft: 'auto', fontSize: 12 }}>
                      {items.filter(i => solved.has(i.key)).length}/{items.length}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {tips?.(scope)}
        </div>
      </div>
    </div>
  )
}