'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Icon from '../../_components/Icon'
import { PREFECTURE_DATA } from './japan-data'

/* ─────────────────────────────────────────────────────────────────────────
   Daten aufbereiten
   In japan-data.ts heißt Hokkaido fälschlich "Hokkai" mit Region "unknown" —
   dadurch war die Region Hokkaido im alten Quiz nie lösbar. Wird hier korrigiert.
   ───────────────────────────────────────────────────────────────────────── */

const NAME_FIX: Record<string, string> = { Hokkai: 'Hokkaido' }
const REGION_FIX: Record<string, string> = { Hokkaido: 'hokkaido' }

const REGIONS: Record<string, { name: string; color: string }> = {
  hokkaido: { name: 'Hokkaido', color: '#7c4ae0' },
  tohoku: { name: 'Tōhoku', color: '#a93bc9' },
  kanto: { name: 'Kantō', color: '#d93690' },
  chubu: { name: 'Chūbu', color: '#5b6ee8' },
  kinki: { name: 'Kinki / Kansai', color: '#e0608f' },
  chugoku: { name: 'Chūgoku', color: '#c07bd8' },
  shikoku: { name: 'Shikoku', color: '#ee8a5a' },
  kyushu: { name: 'Kyūshū & Okinawa', color: '#3f9bb5' },
}
const REGION_KEYS = Object.keys(REGIONS)

interface Pref { name: string; region: string; paths: string[]; lx: number; ly: number }

/** Beschriftungspunkt = Mittelpunkt der größten Teilfläche (Inseln verfälschen sonst die Position, z.B. Tokio) */
function labelPoint(paths: string[]): [number, number] {
  let best: { area: number; x: number; y: number } = { area: -1, x: 0, y: 0 }
  for (const p of paths) {
    const nums = p.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? []
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, sx = 0, sy = 0, n = 0
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const x = nums[i], y = nums[i + 1]
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
      sx += x; sy += y; n++
    }
    const area = (maxX - minX) * (maxY - minY)
    if (n && area > best.area) best = { area, x: sx / n, y: sy / n }
  }
  return [best.x, best.y]
}

const PREFS: Pref[] = Object.entries(PREFECTURE_DATA).map(([raw, d]) => {
  const name = NAME_FIX[raw] ?? raw
  const region = REGION_FIX[name] ?? d.region
  const [lx, ly] = labelPoint(d.paths)
  return { name, region, paths: d.paths, lx, ly }
}).sort((a, b) => a.name.localeCompare(b.name))

const PREF_BY_NAME = Object.fromEntries(PREFS.map(p => [p.name, p]))
const REGION_LABEL = Object.fromEntries(
  REGION_KEYS.map(r => {
    const ps = PREFS.filter(p => p.region === r)
    const big = ps.length ? ps.reduce((a, b) => (a.paths.join('').length > b.paths.join('').length ? a : b)) : null
    return [r, big ? [big.lx, big.ly] : [0, 0]]
  })
) as Record<string, [number, number]>

const BASE_VB = { x: 0, y: -6, w: 520, h: 692 }

/* ── Spiellogik-Typen ── */
type Scope = 'regions' | 'prefectures'
type Mode = 'learn' | 'click' | 'name' | 'mixed'
type Ask = 'click' | 'name'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const itemsFor = (scope: Scope) => (scope === 'regions' ? REGION_KEYS : PREFS.map(p => p.name))
const labelFor = (scope: Scope, key: string) => (scope === 'regions' ? REGIONS[key]?.name ?? key : key)
const regionOfKey = (scope: Scope, key: string) => (scope === 'regions' ? key : PREF_BY_NAME[key]?.region)

export default function JapanPage() {
  const [scope, setScope] = useState<Scope>('regions')
  const [mode, setMode] = useState<Mode>('click')

  // Quiz-Zustand
  const [queue, setQueue] = useState<string[]>(() => shuffle(REGION_KEYS))
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

  // Karte
  const [hover, setHover] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null) // Lernmodus: angetippte Präfektur
  const [showLabels, setShowLabels] = useState(false)
  const [vb, setVb] = useState(BASE_VB)
  const [dragging, setDragging] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ moved: boolean; startDist: number; startVb: typeof BASE_VB; mid: { x: number; y: number } } | null>(null)

  const target = queue[0]
  const allItems = itemsFor(scope)
  const done = mode !== 'learn' && queue.length === 0
  const answered = score.right + score.wrong
  const accuracy = answered ? Math.round((score.right / answered) * 100) : 0

  /* ── Neues Spiel ── */
  const restart = useCallback((s: Scope = scope, m: Mode = mode, only?: string[]) => {
    setQueue(shuffle(only?.length ? only : itemsFor(s)))
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
    setAsk(m === 'name' ? 'name' : m === 'mixed' ? (Math.random() < 0.5 ? 'name' : 'click') : 'click')
  }, [scope, mode])

  function changeScope(s: Scope) { setScope(s); restart(s, mode) }
  function changeMode(m: Mode) { setMode(m); restart(scope, m) }

  /* ── Nächste Frage ── */
  const advance = useCallback((wasRight: boolean) => {
    setQueue(q => {
      const [first, ...rest] = q
      if (wasRight) return rest
      // Falsch → später nochmal fragen (nicht sofort)
      const pos = Math.min(rest.length, 3 + Math.floor(Math.random() * 3))
      return [...rest.slice(0, pos), first, ...rest.slice(pos)]
    })
    setTries(0)
    setReveal(false)
    setPicked(null)
    setAsk(mode === 'name' ? 'name' : mode === 'mixed' ? (Math.random() < 0.5 ? 'name' : 'click') : 'click')
  }, [mode])

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
    if (!done || finishedIn !== null || answered === 0) return
    const secs = Math.round((Date.now() - startedAt) / 1000)
    setFinishedIn(secs)
    try {
      const raw = localStorage.getItem('pv-geo-japan-best')
      const prev = raw ? JSON.parse(raw) : null
      if (!prev || accuracy > prev.accuracy || (accuracy === prev.accuracy && secs < prev.seconds)) {
        localStorage.setItem('pv-geo-japan-best', JSON.stringify({ accuracy, mode: scope, seconds: secs, date: new Date().toISOString() }))
        setNewBest(true)
      }
    } catch { /* egal */ }
  }, [done, finishedIn, answered, startedAt, accuracy, scope])

  /* ── Klick auf die Karte ── */
  function onMapPick(prefName: string) {
    if (gesture.current?.moved) return
    const key = scope === 'regions' ? PREF_BY_NAME[prefName].region : prefName

    if (mode === 'learn') { setInfo(prefName); return }
    if (done || ask !== 'click' || reveal || !target) return
    if (solved.has(key) && key !== target) return

    if (key === target) {
      registerAnswer(tries === 0)
      if (tries > 0) setSolved(prev => new Set(prev).add(target))
      setFlash({ key, ok: true })
      setTimeout(() => { setFlash(null); advance(true) }, 450)
    } else {
      setFlash({ key, ok: false })
      setTimeout(() => setFlash(null), 600)
      const n = tries + 1
      setTries(n)
      if (n === 1) setMistakes(prev => new Set(prev).add(target))
      if (n >= 3) {
        // Nach 3 Fehlversuchen Lösung zeigen und später erneut fragen
        registerAnswer(false)
        setReveal(true)
        setTimeout(() => advance(false), 1600)
      }
    }
  }

  /* ── Antwort im Namen-Modus ── */
  const options = useMemo(() => {
    if (!target || ask !== 'name') return []
    let pool = allItems.filter(k => k !== target)
    if (scope === 'prefectures') {
      // Mindestens zwei Ablenker aus derselben Region → echtes Lernen statt Raten
      const same = shuffle(pool.filter(k => PREF_BY_NAME[k].region === PREF_BY_NAME[target].region)).slice(0, 2)
      pool = [...same, ...shuffle(pool.filter(k => !same.includes(k)))]
    } else pool = shuffle(pool)
    return shuffle([target, ...pool.slice(0, 3)])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, ask, scope, queue.length])

  function onNamePick(key: string) {
    if (picked) return
    setPicked(key)
    const right = key === target
    registerAnswer(right)
    setTimeout(() => advance(right), right ? 650 : 1400)
  }

  /* ── Tastatur: 1–4 für Antworten ── */
  useEffect(() => {
    if (ask !== 'name' || done || mode === 'learn') return
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      const i = Number(e.key) - 1
      if (i >= 0 && i < options.length) onNamePick(options[i])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  /* ── Zoom & Verschieben ── */
  const clampVb = (v: typeof BASE_VB) => {
    const w = Math.min(BASE_VB.w * 1.15, Math.max(50, v.w))
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
      const w = v.w * factor
      const h = v.h * factor
      return clampVb({ x: p.x - (p.x - v.x) * factor, y: p.y - (p.y - v.y) * factor, w, h })
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
    // gesture.moved bleibt bis nach dem Klick-Event gesetzt, damit Verschieben keinen Treffer auslöst
    setTimeout(() => { if (!pointers.current.size) gesture.current = null }, 0)
  }

  const zoomed = vb.w < BASE_VB.w * 0.98
  const fontUnit = vb.w / BASE_VB.w

  /* ── Farben ── */
  function fillFor(p: Pref): string {
    const key = scope === 'regions' ? p.region : p.name
    const regionColor = REGIONS[p.region]?.color ?? '#a93bc9'
    if (flash && flash.key === key) return flash.ok ? '#25845c' : '#c0344f'

    if (mode === 'learn') {
      if (info && (scope === 'regions' ? PREF_BY_NAME[info].region === p.region : info === p.name)) return regionColor
      if (info && PREF_BY_NAME[info].region === p.region) return `${regionColor}55`
      if (hover === p.name) return 'rgba(255,255,255,0.95)'
      return `${regionColor}30`
    }
    if (solved.has(key)) return regionColor
    if (reveal && key === target) return '#e0913a'
    if (ask === 'name' && key === target) return picked ? (picked === target ? '#25845c' : '#e0913a') : '#8b3fd9'
    if (ask === 'name' && picked && key === picked) return '#c0344f'
    if (hover && (scope === 'regions' ? PREF_BY_NAME[hover]?.region === p.region : hover === p.name) && ask === 'click') return 'rgba(255,255,255,0.95)'
    return 'rgba(255,255,255,0.82)'
  }

  const hoverLabel = hover
    ? mode === 'learn' || scope === 'prefectures'
      ? `${hover} · ${REGIONS[PREF_BY_NAME[hover].region]?.name}`
      : REGIONS[PREF_BY_NAME[hover].region]?.name
    : null
  const showHoverName = hover && (mode === 'learn' || solved.has(scope === 'regions' ? PREF_BY_NAME[hover].region : hover))

  /* Aufgabe + Antworten: am PC rechts neben der Karte, am Handy ÜBER der Karte (sonst müsste man scrollen) */
  const taskBlock = (
    <>
      {mode === 'learn' ? (
        <div className="pv-glass pv-card">
          {info ? (
            <>
              <p className="pv-eyebrow">{REGIONS[PREF_BY_NAME[info].region]?.name}</p>
              <div className="pv-task-target" style={{ margin: '4px 0 12px' }}>{scope === 'regions' ? REGIONS[PREF_BY_NAME[info].region]?.name : info}</div>
              <p className="pv-label">Präfekturen dieser Region</p>
              <div className="pv-row pv-wrap" style={{ gap: 6 }}>
                {PREFS.filter(p => p.region === PREF_BY_NAME[info].region).map(p => (
                  <button key={p.name} className={`pv-chip ${p.name === info ? 'active' : ''}`} onClick={() => setInfo(p.name)}>{p.name}</button>
                ))}
              </div>
            </>
          ) : (
            <div className="pv-muted" style={{ fontSize: 14 }}>
              Tippe auf eine Stelle der Karte, um Name und Region zu sehen. Mit zwei Fingern oder dem Mausrad zoomen, zum Verschieben ziehen.
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
              <button className="pv-btn" onClick={() => restart(scope, mode, [...mistakes])}>
                Nur Fehler üben ({mistakes.size})
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="pv-glass pv-task">
            <span className="pv-task-icon"><Icon name={ask === 'click' ? 'pointer' : 'target'} size={22} /></span>
            <div className="pv-grow" style={{ minWidth: 0 }}>
              <p className="pv-eyebrow">
                {ask === 'click'
                  ? `Wo liegt ${scope === 'regions' ? 'die Region' : 'die Präfektur'}?`
                  : `Wie heißt die markierte ${scope === 'regions' ? 'Region' : 'Präfektur'}?`}
              </p>
              <div className="pv-task-target pv-ellipsis">
                {ask === 'click' ? labelFor(scope, target) : '?'}
              </div>
              {ask === 'click' && tries > 0 && !reveal && (
                <div style={{ fontSize: 12.5, color: 'var(--pv-danger)', marginTop: 2 }}>
                  Nicht ganz – {3 - tries} {3 - tries === 1 ? 'Versuch' : 'Versuche'} übrig
                  {scope === 'prefectures' && tries >= 2 && ` · Tipp: ${REGIONS[regionOfKey(scope, target)!]?.name}`}
                </div>
              )}
              {reveal && <div style={{ fontSize: 12.5, color: '#b86a1c', marginTop: 2 }}>Hier ist sie – kommt gleich nochmal dran</div>}
            </div>
          </div>

          {ask === 'name' && (
            <div className="pv-answers">
              {options.map((k, i) => {
                const cls = picked ? (k === target ? 'right' : k === picked ? 'wrong' : '') : ''
                return (
                  <button key={k} className={`pv-answer ${cls}`} disabled={!!picked} onClick={() => onNamePick(k)}>
                    <span className="pv-muted pv-desktop-only" style={{ fontSize: 12, marginRight: 10 }}>{i + 1}</span>
                    {labelFor(scope, k)}
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}
    </>
  )

  const remaining = queue.length
  const progress = allItems.length ? ((allItems.length - remaining) / allItems.length) * 100 : 0

  return (
    <div className="pv-page">
      {/* Kopf */}
      <div className="pv-page-head">
        <div>
          <Link href="/private/geoguessr" className="pv-btn ghost sm" style={{ marginLeft: -10, marginBottom: 4 }}>
            <Icon name="back" size={15} /> GeoGuessr
          </Link>
          <h1 className="pv-title">Japan</h1>
          <p className="pv-subtitle">
            {mode === 'learn'
              ? 'Lernmodus – tippe auf die Karte'
              : `${allItems.length - remaining} von ${allItems.length} ${scope === 'regions' ? 'Regionen' : 'Präfekturen'} geschafft`}
          </p>
        </div>
        <div className="pv-row pv-wrap">
          <div className="pv-seg">
            <button className={scope === 'regions' ? 'active' : ''} onClick={() => changeScope('regions')}>8 Regionen</button>
            <button className={scope === 'prefectures' ? 'active' : ''} onClick={() => changeScope('prefectures')}>47 Präfekturen</button>
          </div>
          <button className="pv-icon-btn" aria-label="Neu starten" title="Neu starten" onClick={() => restart()}><Icon name="refresh" size={18} /></button>
        </div>
      </div>

      <div className="pv-chips">
        {([
          ['learn', 'book', 'Lernen'],
          ['click', 'pointer', 'Auf Karte finden'],
          ['name', 'target', 'Namen zuordnen'],
          ['mixed', 'shuffle', 'Gemischt'],
        ] as [Mode, string, string][]).map(([m, icon, label]) => (
          <button key={m} className={`pv-chip ${mode === m ? 'active' : ''}`} onClick={() => changeMode(m)}>
            <Icon name={icon} size={15} /> {label}
          </button>
        ))}
      </div>

      {mode !== 'learn' && (
        <div className="pv-progress"><span style={{ width: `${progress}%` }} /></div>
      )}

      <div className="pv-phone-only" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{taskBlock}</div>

      <div className="pv-geo-layout">
        {/* Karte */}
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
            aria-label="Karte von Japan"
          >
            {PREFS.map(p => (
              <g key={p.name} onClick={() => onMapPick(p.name)} onPointerEnter={e => { if (e.pointerType === 'mouse') setHover(p.name) }}>
                {p.paths.map((d, i) => (
                  <path
                    key={i}
                    d={d}
                    fill={fillFor(p)}
                    stroke="rgba(90, 30, 80, 0.45)"
                    strokeWidth={0.7 * fontUnit}
                    strokeLinejoin="round"
                    style={{ cursor: mode === 'learn' || ask === 'click' ? 'pointer' : 'default' }}
                  />
                ))}
              </g>
            ))}

            {/* Beschriftungen */}
            <g style={{ pointerEvents: 'none', fontFamily: 'inherit', fontWeight: 600 }}>
              {scope === 'regions' && mode !== 'learn'
                ? REGION_KEYS.filter(r => solved.has(r) || showLabels).map(r => (
                    <text key={r} x={REGION_LABEL[r][0]} y={REGION_LABEL[r][1]} textAnchor="middle" fontSize={11 * fontUnit}
                      fill="#fff" stroke="rgba(58,20,51,0.55)" strokeWidth={2.4 * fontUnit} paintOrder="stroke">
                      {REGIONS[r].name}
                    </text>
                  ))
                : PREFS.filter(p => showLabels || (mode === 'learn' ? info === p.name : solved.has(p.name))).map(p => (
                    <text key={p.name} x={p.lx} y={p.ly} textAnchor="middle" dominantBaseline="middle" fontSize={7.5 * fontUnit}
                      fill="#fff" stroke="rgba(58,20,51,0.6)" strokeWidth={2 * fontUnit} paintOrder="stroke">
                      {p.name}
                    </text>
                  ))}
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
          {hoverLabel && showHoverName && <div className="pv-map-hover">{hoverLabel}</div>}
        </div>

        {/* Seitenspalte */}
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
            <p className="pv-label" style={{ marginBottom: 8 }}>Regionen</p>
            {REGION_KEYS.map(r => {
              const known = mode === 'learn' || showLabels || (scope === 'regions'
                ? solved.has(r)
                : PREFS.filter(p => p.region === r).every(p => solved.has(p.name)))
              return (
                <div key={r} className="pv-legend-item">
                  <span className="pv-legend-swatch" style={{ background: known ? REGIONS[r].color : 'rgba(255,255,255,0.7)', border: '1px solid rgba(90,30,80,0.2)' }} />
                  <span style={{ color: known ? 'var(--pv-ink)' : 'var(--pv-ink-3)' }}>{REGIONS[r].name}</span>
                  {scope === 'prefectures' && mode !== 'learn' && (
                    <span className="pv-muted" style={{ marginLeft: 'auto', fontSize: 12 }}>
                      {PREFS.filter(p => p.region === r && solved.has(p.name)).length}/{PREFS.filter(p => p.region === r).length}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}