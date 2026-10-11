'use client'

// Das Karten-Quiz von seekclan.de/geo.
// Aufgebaut wie das Quiz im GeoGuessr-Bereich der Privatseite (Lernen · Auf Karte finden · Namen zuordnen ·
// Wissen · Gemischt), dazu neu: Eintippen, Spielarten (Normal · Sprint · 3 Leben) und kombinierte Quizzes.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import Icon from './Icon'
import Flag, { flagSrc, loadFlags } from './Flag'
import { ISO2 } from '../_data/welt-extra'
import { REGION_FLAG_OF } from '../_data/flaggen-regionen'
import ShareDialog, { type ShareData } from './ShareDialog'
import ItemActions from './ItemActions'
import { useRouter } from 'next/navigation'
import { useGeo } from './GeoShell'
import { buildScene, layerRank, mergeQuizzes, type MergedQuiz, type Scene, type SceneItem } from '../_lib/scene'
import { needsItems, resolveDefs } from '../_lib/items'
import { renderRelief, type ReliefImage, type ViewBox } from '../_lib/relief'
import { pxPerDegree, renderTiles } from '../_lib/raster'
import { checkTyped } from '../_lib/text'
import { readBest, saveLocal, saveRemote, type Best, type QuizMode, type Variant } from '../_lib/results'
import { dropSave, listRemoteSaves, pushRemoteSave, readLocalSave, saveProgress, writeLocalSave, type SaveState } from '../_lib/saves'
import { MODE_KEYS, type ModeKey } from '../_lib/xp'
import type { QuizDef } from '../_lib/types'

type Ask = 'click' | 'name' | 'type' | 'text'

/**
 * Gehört eine Fläche zu einem Eintrag? Im Mix liegen z.B. Bundesländer (adm1-DEU:…) über dem Land (world:DEU) –
 * dann zählt ein Klick auf ein Bundesland auch als Klick auf Deutschland.
 */
function covers(areas: string[] | undefined, shapeKey: string): boolean {
  if (!areas) return false
  return areas.some(a => a === shapeKey || (a.startsWith('world:') && shapeKey.startsWith(`adm1-${a.slice(6)}:`)))
}

const SPRINT_SECONDS = 120
const LIVES = 3

/** Zufallszahlen aus einem Startwert (Mehrspieler: alle bekommen dieselbe Reihenfolge) */
function seeded(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(arr: T[], rnd: () => number = Math.random): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
/** Linien-Art für die Farbe: Straße, Bahn oder (Standard) Fluss */
const lineKind = (shapeKey: string) => (/-(autobahnen|autoroutes|autovias|bundesstrassen|europastrassen):/.test(shapeKey) ? 'road' : /-bahn:/.test(shapeKey) ? 'rail' : '')
/** Text in fremder Schrift (Kyrillisch, Arabisch, Thai …) – wird gerade statt kursiv gezeigt */
const NON_LATIN = /[^\u0000-\u024F\u1E00-\u1EFF\s\d.,'’()\-–]/
/** Kartenansichten – Farben stehen in geo.css (.v-…) */
type MapView = 'politisch' | 'relief' | 'satellit' | 'nacht' | 'dunkel' | 'flaggen' | 'papier' | 'stumm'
const VIEWS: { id: MapView; label: string; hint: string }[] = [
  { id: 'politisch', label: 'Politisch', hint: 'Länder und Grenzen' },
  { id: 'relief', label: 'Relief', hint: 'Gebirge und Höhen' },
  { id: 'satellit', label: 'Satellit', hint: 'Echtes Satellitenbild' },
  { id: 'nacht', label: 'Nachtlichter', hint: 'Die Erde bei Nacht' },
  { id: 'dunkel', label: 'Dunkel', hint: 'Schlicht und ruhig' },
  { id: 'flaggen', label: 'Flaggen', hint: 'Jedes Land in seiner Flagge' },
  { id: 'papier', label: 'Papier-Atlas', hint: 'Heller Atlas-Stil' },
  { id: 'stumm', label: 'Stumm', hint: 'Ohne Grenzen – für Profis' },
]
/** Feinste Stufe des fertigen Reliefs in public/geo/relief (z2): 60 Bildpunkte pro Längengrad */
const STATIC_PX_PER_DEG = 60
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`

/** Mehrspieler-Runde: feste Spielart, gleiche Reihenfolge für alle, Fortschritt geht an den Raum */
export interface MultiSetup {
  roomId: string
  seed: number
  mode: QuizMode
  variant: Variant
  onProgress: (p: { right: number; wrong: number; answered: number; total: number; done: boolean; seconds: number }) => void
  /** Live-Stand der anderen (wird über der Karte gezeigt) */
  board?: ReactNode
}

export default function GeoQuiz({ defs, slug, title, backHref, backLabel, topBar, multi }: {
  defs: QuizDef[]
  /** Mehrspieler-Runde (siehe /geo/mehrspieler) */
  multi?: MultiSetup
  /** Zusätzliche Leiste unter dem Zurück-Knopf (z.B. Land wechseln) */
  topBar?: ReactNode
  /** Schlüssel für Bestwerte (bei kombinierten Quizzes z.B. "mix:a+b") */
  slug: string
  title: string
  backHref: string
  backLabel: string
}) {
  const { loggedIn, refreshBests, grantXp, showGains, modes: modesOfEntry, difficulty, config, boost } = useGeo()
  const router = useRouter()
  const [share, setShare] = useState<ShareData | null>(null)
  const [roomBusy, setRoomBusy] = useState(false)
  const first = defs[0]
  /** Erlaubte Spielarten (Adminpanel) – bei einem Mix muss jedes Quiz sie erlauben */
  const allowed = useMemo(() => {
    const out = {} as Record<ModeKey, boolean>
    for (const k of MODE_KEYS) out[k] = defs.every(d => modesOfEntry(d)[k])
    return out
  }, [defs, modesOfEntry])
  const single = defs.length === 1
  const diff = single ? difficulty(first) : null
  /** Historische Karten im Stil eines alten Atlas */
  const atlas = defs.every(d => d.look === 'atlas')

  /* ── Große Quizzes: Einträge nachladen ── */
  const [loadedDefs, setLoadedDefs] = useState<{ src: QuizDef[]; out: QuizDef[] } | null>(null)
  const [sceneError, setSceneError] = useState('')
  useEffect(() => {
    if (!needsItems(defs)) return
    let alive = true
    resolveDefs(defs).then(out => { if (alive) setLoadedDefs({ src: defs, out }) }).catch(e => { if (alive) setSceneError(String(e?.message || e)) })
    return () => { alive = false }
  }, [defs])
  const resolved = !needsItems(defs) ? defs : loadedDefs?.src === defs ? loadedDefs.out : null
  const merged = useMemo(() => (resolved ? mergeQuizzes(resolved) : null), [resolved])

  /* ── Karte bauen ── */
  const [built, setBuilt] = useState<{ src: MergedQuiz; scene: Scene } | null>(null)
  useEffect(() => {
    if (!merged) return
    let alive = true
    buildScene(merged).then(sc => { if (alive) setBuilt({ src: merged, scene: sc }) }).catch(e => { if (alive) setSceneError(String(e?.message || e)) })
    return () => { alive = false }
  }, [merged])
  const scene = built && built.src === merged ? built.scene : null

  const BASE_VB = scene?.viewBox ?? { x: 0, y: 0, w: 1000, h: 620 }
  const unit = scene?.unit ?? 1

  const items: SceneItem[] = useMemo(() => {
    if (!scene) return []
    const drawable = new Set(scene.shapes.map(s => s.key))
    // Nur Einträge, die man auf der Karte auch sieht
    return scene.items.filter(it => it.pt || (it.areas ?? []).some(a => drawable.has(a)))
  }, [scene])
  const groups = useMemo(() => merged?.groups ?? first.groups, [merged, first])
  const hasText = items.some(i => i.text)

  const itemByKey = useMemo(() => Object.fromEntries(items.map(i => [i.key, i])), [items])
  const itemOfShape = useMemo(() => {
    const m: Record<string, SceneItem> = {}
    for (const it of items) for (const a of it.areas ?? []) if (!m[a]) m[a] = it
    return m
  }, [items])
  const groupKeys = useMemo(() => Object.keys(groups).filter(g => items.some(i => i.group === g)), [groups, items])
  /** Nur Quizzes mit echten Gruppen (z.B. Balkan, Baltikum) zeigen Gruppen-Farben und die Legende */
  const hasGroups = groupKeys.length > 1

  /* ── Spielzustand ── */
  const [mode, setMode] = useState<QuizMode>(multi?.mode ?? 'click')
  const [variant, setVariant] = useState<Variant>(multi?.variant ?? 'normal')
  const [queue, setQueue] = useState<string[]>([])
  const [ask, setAsk] = useState<Ask>('click')
  const [solved, setSolved] = useState<Set<string>>(new Set())
  const [mistakes, setMistakes] = useState<Set<string>>(new Set())
  const [score, setScore] = useState({ right: 0, wrong: 0, streak: 0, bestStreak: 0 })
  const [lives, setLives] = useState(LIVES)
  const [flash, setFlash] = useState<{ key: string; ok: boolean } | null>(null)
  const [reveal, setReveal] = useState(false)
  const [tries, setTries] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const [typeState, setTypeState] = useState<'idle' | 'bad' | 'good' | 'close'>('idle')
  const [startedAt, setStartedAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const [finished, setFinished] = useState<{ seconds: number; newBest: boolean } | null>(null)
  const [best, setBest] = useState<Best | null>(null)
  const [onlyKeys, setOnlyKeys] = useState<string[] | null>(null)

  /* ── Karte ── */
  const [hover, setHover] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [showLabels, setShowLabels] = useState(false)
  /** Namen gefundener Flächen auf der Karte zeigen (Standard: aus, Einstellung bleibt im Browser gespeichert) */
  const [showSolvedNames, setShowSolvedNames] = useState(false)
  useEffect(() => {
    try { if (localStorage.getItem('geo-solved-names') === '1') setShowSolvedNames(true) } catch { /* egal */ }
  }, [])
  /** Heutige Grenzen über die historische Karte legen */
  const [showToday, setShowToday] = useState(false)
  const toggleSolvedNames = () => setShowSolvedNames(v => {
    try { localStorage.setItem('geo-solved-names', v ? '0' : '1') } catch { /* egal */ }
    return !v
  })
  const [vb, setVb] = useState(BASE_VB)
  const [dragging, setDragging] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ moved: boolean; startDist: number; startVb: typeof BASE_VB; mid: { x: number; y: number } } | null>(null)

  useEffect(() => { if (scene) setVb(scene.viewBox) }, [scene])

  const target = queue[0]
  const targetItem = target ? itemByKey[target] : undefined
  const answered = score.right + score.wrong
  const accuracy = answered ? Math.round((score.right / answered) * 100) : 0
  const timeLeft = variant === 'sprint' ? Math.max(0, SPRINT_SECONDS - Math.floor((now - startedAt) / 1000)) : null
  const done = mode !== 'learn' && answered > 0 && (
    queue.length === 0 || (variant === 'leben' && lives <= 0) || (variant === 'sprint' && timeLeft === 0)
  )

  const poolFor = useCallback((m: QuizMode) => (m === 'text' ? items.filter(i => i.text) : items).map(i => i.key), [items])

  const nextAsk = useCallback((m: QuizMode): Ask => {
    if (m === 'name' || m === 'type' || m === 'text') return m
    if (m === 'mixed') {
      const opts: Ask[] = hasText ? ['click', 'name', 'text'] : ['click', 'name']
      return opts[Math.floor(Math.random() * opts.length)]
    }
    return 'click'
  }, [hasText])

  const restart = useCallback((m: QuizMode = mode, only?: string[] | null) => {
    const pool = only?.length ? only : poolFor(m)
    setQueue(multi && !only?.length ? shuffle(pool, seeded(multi.seed)) : shuffle(pool))
    setOnlyKeys(only?.length ? only : null)
    setSolved(new Set())
    setMistakes(new Set())
    setScore({ right: 0, wrong: 0, streak: 0, bestStreak: 0 })
    setLives(LIVES)
    setFlash(null)
    setReveal(false)
    setTries(0)
    setPicked(null)
    setTyped('')
    setTypeState('idle')
    setInfo(null)
    setStartedAt(Date.now())
    setNow(Date.now())
    setFinished(null)
    setAsk(nextAsk(m))
  }, [mode, poolFor, nextAsk, multi])

  // Start, sobald die Karte steht – gibt es einen offenen Spielstand, wird gefragt (bzw. mit ?weiter=1 direkt fortgesetzt)
  useEffect(() => {
    if (!items.length) return
    if (multi) { restart(multi.mode); return }
    const auto = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('weiter') === '1'
    const local = readLocalSave(slug)
    if (local && auto && applySave(local)) return
    restart(mode)
    if (local && local.queue.length) setResumeOffer(local)
    if (loggedIn) {
      listRemoteSaves().then(list => {
        const remote = list.find(x => x.slug === slug && x.queue.length)
        if (!remote || (local && local.savedAt >= remote.savedAt)) return
        if (auto) applySave(remote)
        else setResumeOffer(remote)
      })
    }
  }, [items]) // eslint-disable-line react-hooks/exhaustive-deps

  // Spielart im Adminpanel gesperrt → auf die erste erlaubte wechseln
  useEffect(() => {
    if (allowed[mode as ModeKey] !== false) return
    const m = (['click', 'name', 'type', 'mixed', 'text', 'learn'] as QuizMode[]).find(x => allowed[x as ModeKey])
    if (m) { setMode(m); restart(m) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed])
  useEffect(() => {
    if (variant !== 'normal' && allowed[variant as ModeKey] === false) setVariant('normal')
  }, [allowed, variant])

  useEffect(() => { setBest(readBest(slug, mode, variant)) }, [slug, mode, variant, finished])

  // Uhr für Sprint und Zeitanzeige
  useEffect(() => {
    if (mode === 'learn' || done) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [mode, done])

  function changeMode(m: QuizMode) { setMode(m); restart(m) }
  function changeVariant(v: Variant) { setVariant(v); restart(mode) }

  /* ── Nächste Frage ── */
  const advance = useCallback((wasRight: boolean) => {
    setQueue(q => {
      const [firstKey, ...rest] = q
      let next = rest
      if (!wasRight) {
        const pos = Math.min(rest.length, 3 + Math.floor(Math.random() * 3))
        next = [...rest.slice(0, pos), firstKey, ...rest.slice(pos)]
      }
      // Im Sprint geht es endlos weiter
      if (variant === 'sprint' && next.length === 0) next = shuffle(onlyKeys ?? poolFor(mode))
      return next
    })
    setTries(0)
    setReveal(false)
    setPicked(null)
    setTyped('')
    setTypeState('idle')
    setAsk(nextAsk(mode))
  }, [mode, variant, nextAsk, onlyKeys, poolFor])

  // Wissens-Frage nur für Einträge mit Text – sonst im Mix auf Karte ausweichen
  useEffect(() => {
    if (ask === 'text' && targetItem && !targetItem.text) setAsk(Math.random() < 0.5 ? 'click' : 'name')
  }, [ask, targetItem])

  const registerAnswer = useCallback((right: boolean) => {
    setScore(s => {
      const streak = right ? s.streak + 1 : 0
      return { right: s.right + (right ? 1 : 0), wrong: s.wrong + (right ? 0 : 1), streak, bestStreak: Math.max(s.bestStreak, streak) }
    })
    if (right) {
      setSolved(prev => new Set(prev).add(target))
      // Erstmals richtig? → XP (der Server prüft, ob der Eintrag für diesen Nutzer neu ist)
      if (loggedIn && mode !== 'learn' && target) grantXp(defs.map(d => d.slug), target, items.length, !!multi)
    } else {
      setMistakes(prev => new Set(prev).add(target))
      if (variant === 'leben') setLives(l => l - 1)
    }
  }, [target, variant, loggedIn, mode, grantXp, defs, items.length, multi])

  /* Ende → Bestwert speichern */
  useEffect(() => {
    if (!done || finished) return
    const seconds = Math.round((Date.now() - startedAt) / 1000)
    const result = { slug, mode, variant, total: onlyKeys?.length ?? poolFor(mode).length, right: score.right, wrong: score.wrong, seconds, accuracy }
    // "Nur Fehler üben" zählt nicht als Bestwert
    const newBest = onlyKeys ? false : saveLocal(result)
    setFinished({ seconds, newBest })
    if (!onlyKeys && loggedIn) saveRemote(result).then(parts => { showGains(parts); refreshBests() })
    else if (newBest) refreshBests()
    dropSave(slug, loggedIn)
  }, [done, finished, startedAt, slug, mode, variant, score, accuracy, onlyKeys, poolFor, loggedIn, refreshBests, showGains])

  /* ── Mehrspieler: Stand an den Raum melden ── */
  const multiRef = useRef(multi)
  useEffect(() => { multiRef.current = multi })
  useEffect(() => {
    const m = multiRef.current
    if (!m || answered === 0) return
    m.onProgress({ right: score.right, wrong: score.wrong, answered, total: poolFor(mode).length, done: !!done, seconds: Math.round((Date.now() - startedAt) / 1000) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered, done])

  /** Mit Freunden spielen: Raum anlegen und hinwechseln */
  const startRoom = async () => {
    setRoomBusy(true)
    try {
      const r = await fetch('/api/geo/room', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', slug, mode: mode === 'learn' ? 'click' : mode, variant: variant === 'sprint' ? 'normal' : variant }) })
      const d = await r.json()
      if (d.id) router.push(`/geo/mehrspieler/${d.id}`)
    } finally { setRoomBusy(false) }
  }
  const openShare = () => setShare({
    slug, title, mode, variant, total: onlyKeys?.length ?? poolFor(mode).length, right: score.right, wrong: score.wrong,
    seconds: finished?.seconds ?? Math.round((Date.now() - startedAt) / 1000), accuracy, bestStreak: score.bestStreak,
    solved: [...solved], mistakes: [...mistakes],
  })

  /* ── Spielstand speichern (zum Fortsetzen nach dem Verlassen der Seite) ── */
  const snapshot = useCallback((): SaveState => ({
    v: 1, slug, title, href: typeof window !== 'undefined' ? window.location.pathname + window.location.search.replace(/([?&])weiter=1&?/, '$1').replace(/[?&]$/, '') : '',
    mode, variant, queue, solved: [...solved], mistakes: [...mistakes], score, lives,
    elapsed: Math.round((Date.now() - startedAt) / 1000), onlyKeys, total: onlyKeys?.length ?? poolFor(mode).length,
    savedAt: new Date().toISOString(),
  }), [slug, title, mode, variant, queue, solved, mistakes, score, lives, startedAt, onlyKeys, poolFor])
  const [resumeOffer, setResumeOffer] = useState<SaveState | null>(null)
  const [confirmDrop, setConfirmDrop] = useState(false)
  useEffect(() => {
    if (mode === 'learn' || done || answered === 0 || resumeOffer || variant === 'sprint' || multi) return
    const s = snapshot()
    writeLocalSave(s)
    if (loggedIn) pushRemoteSave(s)
  }, [answered, queue.length, done, mode, variant, loggedIn, snapshot, resumeOffer])
  // Beim Verlassen der Seite den letzten Stand sichern (Zeit läuft sonst weiter)
  useEffect(() => {
    if (mode === 'learn' || done || answered === 0 || variant === 'sprint' || multi) return
    const save = () => { const s = snapshot(); writeLocalSave(s); if (loggedIn) pushRemoteSave(s, 0) }
    window.addEventListener('pagehide', save)
    return () => window.removeEventListener('pagehide', save)
  }, [mode, done, answered, variant, snapshot, loggedIn])

  const applySave = useCallback((s: SaveState) => {
    const known = new Set(items.map(i => i.key))
    const queueOk = s.queue.filter(k => known.has(k))
    if (!queueOk.length) return false
    setMode(s.mode)
    setVariant(s.variant)
    setQueue(queueOk)
    setOnlyKeys(s.onlyKeys)
    setSolved(new Set(s.solved.filter(k => known.has(k))))
    setMistakes(new Set(s.mistakes.filter(k => known.has(k))))
    setScore(s.score)
    setLives(s.lives)
    setStartedAt(Date.now() - s.elapsed * 1000)
    setNow(Date.now())
    setFinished(null)
    setReveal(false); setTries(0); setPicked(null); setTyped(''); setTypeState('idle'); setInfo(null)
    setAsk(s.mode === 'name' || s.mode === 'type' || s.mode === 'text' ? s.mode : s.mode === 'mixed' ? 'click' : 'click')
    return true
  }, [items])

  const resumeSaveResult = async (s: SaveState) => {
    const answeredS = s.score.right + s.score.wrong
    if (answeredS > 0 && !s.onlyKeys) {
      const r = { slug: s.slug, mode: s.mode, variant: s.variant, total: s.total, right: s.score.right, wrong: s.score.wrong, seconds: s.elapsed, accuracy: Math.round((s.score.right / answeredS) * 100) }
      saveLocal(r)
      if (loggedIn) showGains(await saveRemote(r))
      refreshBests()
    }
    dropSave(s.slug, loggedIn)
    setResumeOffer(null)
  }

  /* ── Klick auf Karte ── */
  function onPick(it: SceneItem | undefined, shapeKey?: string) {
    if (gesture.current?.moved || !it) return
    if (mode === 'learn') { setInfo(it.key); return }
    if (done || ask !== 'click' || reveal || !target || !targetItem) return
    const hit = it.key === target || (!!shapeKey && covers(targetItem.areas, shapeKey))
    if (solved.has(it.key) && !hit) return

    if (hit) {
      registerAnswer(tries === 0)
      if (tries > 0) setSolved(prev => new Set(prev).add(target))
      setFlash({ key: target, ok: true })
      setTimeout(() => { setFlash(null); advance(true) }, 420)
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

  /* ── Auswahl-Antworten ── */
  const options = useMemo(() => {
    if (!targetItem || (ask !== 'name' && ask !== 'text')) return []
    const answerOf = (i: SceneItem) => (ask === 'text' ? i.text?.answer : i.label)
    const right = answerOf(targetItem)
    if (!right) return []
    const others = items.filter(i => i.key !== targetItem.key && answerOf(i) && answerOf(i) !== right)
    // Zwei Ablenker aus derselben Gruppe → echtes Lernen statt Raten
    const same = shuffle(others.filter(i => i.group === targetItem.group)).slice(0, 2)
    const pool = [...same, ...shuffle(others.filter(i => !same.includes(i)))]
    const answers: string[] = []
    for (const i of pool) {
      const a = answerOf(i)!
      if (!answers.includes(a)) answers.push(a)
      if (answers.length === 3) break
    }
    return shuffle([right, ...answers])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetItem, ask, items, queue.length])

  const rightAnswer = targetItem ? (ask === 'text' ? targetItem.text?.answer : targetItem.label) : undefined
  /** Flaggen-Quiz, "Namen zuordnen": Antworten sind Flaggen statt Namen */
  const flagOfLabel = useMemo(() => Object.fromEntries(items.filter(i => i.flag).map(i => [i.label, i.flag!])), [items])
  const flagAnswers = ask === 'name' && !!targetItem?.flagPrompt && options.every(a => flagOfLabel[a])

  function onOptionPick(a: string) {
    if (picked || done) return
    setPicked(a)
    const right = a === rightAnswer
    registerAnswer(right)
    setTimeout(() => advance(right), right ? 650 : 1600)
  }

  /* ── Eintippen ── */
  function onTypeSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!targetItem || picked || done || reveal) return
    if (!typed.trim()) return
    const res = checkTyped(typed, [targetItem.label, ...(targetItem.aliases ?? [])])
    if (res !== 'wrong') {
      setTypeState(res === 'exact' ? 'good' : 'close')
      setPicked(targetItem.label)
      registerAnswer(tries === 0)
      if (tries > 0) setSolved(prev => new Set(prev).add(target))
      setTimeout(() => advance(true), res === 'exact' ? 550 : 1300)
    } else {
      setTypeState('bad')
      setTimeout(() => setTypeState('idle'), 400)
      const n = tries + 1
      setTries(n)
      if (n === 1) setMistakes(prev => new Set(prev).add(target))
      if (n >= 3) giveUp()
    }
  }
  function giveUp() {
    if (!targetItem || picked) return
    setPicked('?')
    setReveal(true)
    registerAnswer(false)
    setTimeout(() => advance(false), 1800)
  }
  useEffect(() => { if (ask === 'type' && !done) inputRef.current?.focus({ preventScroll: true }) }, [ask, target, done])

  /* ── Tastatur: 1–4 für Antworten ── */
  useEffect(() => {
    if ((ask !== 'name' && ask !== 'text') || done || mode === 'learn') return
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      const i = Number(e.key) - 1
      if (i >= 0 && i < options.length) onOptionPick(options[i])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  /* ── Zoom & Verschieben ── */
  /** Ausschnitt begrenzen: nicht weiter raus als die ganze Karte, beim Verschieben nicht aus der Karte heraus */
  const clampVb = (v: typeof BASE_VB) => {
    const w = Math.min(BASE_VB.w, Math.max(BASE_VB.w / 30, v.w))
    const h = w * (BASE_VB.h / BASE_VB.w)
    const mx = BASE_VB.w * 0.03, my = BASE_VB.h * 0.03
    const x = Math.min(BASE_VB.x + BASE_VB.w - w + mx, Math.max(BASE_VB.x - mx, v.x))
    const y = Math.min(BASE_VB.y + BASE_VB.h - h + my, Math.max(BASE_VB.y - my, v.y))
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
      const p = svgRef.current && cx !== undefined && cy !== undefined ? toSvg(cx, cy, v) : { x: v.x + v.w / 2, y: v.y + v.h / 2 }
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
    setViewMenu(false)
    // Beim Ziehen mit der Maus nicht aus Versehen Text auf der Seite markieren
    if (e.pointerType === 'mouse') e.preventDefault()
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

  // Kartenmaßstab: wie viele Karten-Einheiten ein Bildschirm-Pixel bei ganzer Karte sind.
  // Damit sind Schrift, Punkte und Kreise immer gleich groß auf dem Bildschirm – egal ob die Karte hoch oder breit ist.
  const [basePx, setBasePx] = useState(unit)
  useEffect(() => {
    const el = svgRef.current
    if (!el || !scene) return
    const update = () => {
      const r = el.getBoundingClientRect()
      if (r.width && r.height) setBasePx(Math.max(scene.viewBox.w / r.width, scene.viewBox.h / r.height))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [scene])

  const zoomed = vb.w < BASE_VB.w * 0.98
  const fontUnit = (vb.w / BASE_VB.w) * basePx

  /* ── Kartenansicht (Politisch · Relief · Satellit · Nachtlichter · Dunkel · Papier · Stumm) ── */
  // Standard je nach Quiz; wer selbst eine Ansicht wählt, behält sie für alle Quizzes (im Browser gespeichert)
  const defaultView: MapView = atlas ? 'papier' : scene?.phys ? 'relief' : 'politisch'
  const [viewPref, setViewPref] = useState<MapView | null>(null)
  useEffect(() => {
    try { const v = localStorage.getItem('geo-map-view'); if (v && VIEWS.some(x => x.id === v)) setViewPref(v as MapView) } catch { /* egal */ }
  }, [])
  const view: MapView = viewPref ?? defaultView
  const [viewMenu, setViewMenu] = useState(false)
  const pickView = (v: MapView | null) => {
    setViewPref(v)
    setViewMenu(false)
    try { if (v) localStorage.setItem('geo-map-view', v); else localStorage.removeItem('geo-map-view') } catch { /* egal */ }
  }
  const rasterView = view === 'relief' || view === 'satellit' || view === 'nacht'
  /** Kachelquelle der Bild-Ansichten (Relief nutzt erst das fertige Relief, siehe reliefFor) */
  const tileSrc = view === 'nacht' ? 'night' : 'sat'

  /* ── Bilder unter der Karte: Relief bzw. Satellit, in die Kartenprojektion umgerechnet ── */
  type RasterLayer = { scene: Scene; view: MapView; imgs: ReliefImage[]; tiles: boolean }
  const [rasterBase, setRasterBase] = useState<RasterLayer | null>(null)
  const [rasterDetail, setRasterDetail] = useState<RasterLayer | null>(null)
  const rasterUrls = useRef<string[]>([])
  const keep = (img: ReliefImage | null) => { if (img) rasterUrls.current.push(img.href); return img }
  const reliefWidth = () => {
    const w = svgRef.current?.getBoundingClientRect().width || 1000
    return Math.max(1000, Math.min(2400, Math.round(w * Math.min(2, window.devicePixelRatio || 1))))
  }
  /** Ausschnitt auf das Seitenverhältnis der Karte erweitern – sonst fehlt das Bild am Rand, wenn die Karte breiter ist als der Ausschnitt */
  const fitAspect = (v: { x: number; y: number; w: number; h: number }) => {
    const r = svgRef.current?.getBoundingClientRect()
    if (!r?.width || !r.height) return v
    const a = r.width / r.height
    if (v.w / v.h < a) { const w = v.h * a; return { ...v, x: v.x - (w - v.w) / 2, w } }
    const h = v.w / a
    return { ...v, y: v.y - (h - v.h) / 2, h }
  }
  /** Relief für einen Ausschnitt: das fertige Relief (schnell) reicht bis 60 Bildpunkte pro Längengrad – darüber die feinen Höhen-Kacheln */
  const reliefFor = async (area: ViewBox, w: number, sig: { cancelled: boolean }) =>
    pxPerDegree(scene!.projection, area, w) > STATIC_PX_PER_DEG * 1.15
      ? { img: keep(await renderTiles('terrain', scene!.projection, area, w, sig).catch(() => null)), tiles: true }
      : { img: keep(await renderRelief(scene!.projection, area, w, sig).catch(() => null)), tiles: false }
  useEffect(() => {
    if (!scene || !rasterView) return
    const sig = { cancelled: false }
    // Etwas größer als die Karte: man darf ein Stück über den Rand hinaus schieben (siehe clampVb) – dort soll das Bild nicht fehlen
    const fit = fitAspect(scene.viewBox)
    const area = { x: fit.x - fit.w * 0.06, y: fit.y - fit.h * 0.06, w: fit.w * 1.12, h: fit.h * 1.12 }
    const w = Math.round(reliefWidth() * 1.12)
    ;(async () => {
      if (view !== 'relief') {
        // Erst ein grobes Bild aus wenigen Kacheln (kommt schnell), dann das scharfe
        const rough = keep(await renderTiles(tileSrc, scene.projection, area, Math.round(w / 2), sig, 2).catch(() => null))
        if (rough && !sig.cancelled) setRasterBase({ scene, view, imgs: [rough], tiles: true })
        const img = keep(await renderTiles(tileSrc, scene.projection, area, w, sig).catch(() => null))
        if (img && !sig.cancelled) setRasterBase({ scene, view, imgs: rough ? [rough, img] : [img], tiles: true })
        return
      }
      // Erst das fertige Relief zeigen, bei kleinen Ländern darüber das scharfe aus den Höhen-Kacheln
      const img = keep(await renderRelief(scene.projection, area, w, sig).catch(() => null))
      if (!img || sig.cancelled) return
      setRasterBase({ scene, view, imgs: [img], tiles: false })
      if (pxPerDegree(scene.projection, area, w) <= STATIC_PX_PER_DEG * 1.15) return
      const hd = keep(await renderTiles('terrain', scene.projection, area, w, sig).catch(() => null))
      if (hd && !sig.cancelled) setRasterBase({ scene, view, imgs: [img, hd], tiles: true })
    })()
    return () => { sig.cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, view, rasterView])
  // Beim Hineinzoomen das Bild für den Ausschnitt neu rechnen (kurz nach dem letzten Zoom) – sonst wird das Grundbild nur hochskaliert (unscharf)
  const deepZoom = vb.w < BASE_VB.w * 0.9
  useEffect(() => {
    if (!scene || !rasterView || !deepZoom) return
    const sig = { cancelled: false }
    const t = setTimeout(async () => {
      const v = fitAspect(vb)
      const area = { x: v.x - v.w * 0.25, y: v.y - v.h * 0.25, w: v.w * 1.5, h: v.h * 1.5 }
      const w = Math.min(3600, Math.round(reliefWidth() * 1.5))
      const r = view !== 'relief'
        ? { img: keep(await renderTiles(tileSrc, scene.projection, area, w, sig).catch(() => null)), tiles: true }
        : await reliefFor(area, w, sig)
      if (r.img && !sig.cancelled) setRasterDetail({ scene, view, imgs: [r.img], tiles: r.tiles })
    }, 300)
    return () => { sig.cancelled = true; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, vb, deepZoom, view, rasterView])
  useEffect(() => () => { for (const u of rasterUrls.current) URL.revokeObjectURL(u) }, [])
  const baseLayer = rasterView && rasterBase && rasterBase.scene === scene && rasterBase.view === view ? rasterBase : null
  const detailLayer = rasterView && deepZoom && rasterDetail && rasterDetail.scene === scene && rasterDetail.view === view ? rasterDetail : null
  const rasterImgs = [...(baseLayer?.imgs ?? []), ...(detailLayer?.imgs ?? [])]
  const usesTerrainTiles = view === 'relief' && (!!baseLayer?.tiles || !!detailLayer?.tiles)

  const sortedShapes = useMemo(() => [...(scene?.shapes ?? [])].sort((a, b) => layerRank(a.key) - layerRank(b.key) || b.size - a.size), [scene])

  /* ── Kartenansicht „Flaggen“: jede Fläche zeigt ihre Flagge (Länder, Regionen mit eigener Flagge) ── */
  /** Flaggen-Schlüssel einer Fläche: Flagge des Eintrags, sonst Land (ISO) bzw. Region (ISO-3166-2) */
  const flagOfShape = useCallback((key: string): string | undefined => {
    const it = itemOfShape[key]
    if (it?.flag && (it.areas?.length ?? 0) === 1) return it.flag
    const i = key.indexOf(':')
    const lid = key.slice(0, i), id = key.slice(i + 1)
    if (lid === 'world' || lid === 'world-eu') return ISO2[id]
    return REGION_FLAG_OF[key]
  }, [itemOfShape])
  const needsRegionFlags = useMemo(() => !!scene?.shapes.some(sh => flagOfShape(sh.key)?.startsWith('r:')), [scene, flagOfShape])
  const needsHistFlags = useMemo(() => items.some(i => i.flag?.startsWith('h-')), [items])
  const [flagData, setFlagData] = useState<Record<string, string>>({})
  useEffect(() => {
    if (view !== 'flaggen') return
    const want: ('flags' | 'flags-regions' | 'flags-hist')[] = ['flags', ...(needsRegionFlags ? ['flags-regions' as const] : []), ...(needsHistFlags ? ['flags-hist' as const] : [])]
    let alive = true
    Promise.all(want.map(f => loadFlags(f).catch(() => ({})))).then(all => { if (alive) setFlagData(Object.assign({}, ...all)) })
    return () => { alive = false }
  }, [view, needsRegionFlags, needsHistFlags])
  /** Flaggen-Quiz: die Flaggen noch nicht gefundener Einträge verraten nichts */
  const isFlagQuiz = useMemo(() => items.some(i => i.flagPrompt), [items])
  const flagFills = useMemo(() => {
    if (view !== 'flaggen' || !scene) return []
    const out: { key: string; d: string; bb: [number, number, number, number]; src: string }[] = []
    // Kontext-Flächen haben als Schlüssel nur die Kennung des Landes (ISO3)
    for (const c of scene.context) {
      const code = ISO2[c.key]
      if (code && flagData[code]) out.push({ key: `c:${c.key}`, d: c.d, bb: c.bb, src: flagSrc(flagData[code]) })
    }
    for (const sh of sortedShapes) {
      if (sh.look === 'line' || sh.tiny) continue
      const it = itemOfShape[sh.key]
      if (it && isFlagQuiz && mode !== 'learn' && !solved.has(it.key)) continue
      const code = flagOfShape(sh.key)
      if (code && flagData[code]) out.push({ key: sh.key, d: sh.d, bb: sh.bb, src: flagSrc(flagData[code]) })
    }
    return out
  }, [view, scene, sortedShapes, flagData, itemOfShape, isFlagQuiz, mode, solved, flagOfShape])
  const flagged = useMemo(() => new Set(flagFills.map(f => f.key)), [flagFills])

  /* ── Farben ── */
  // Flaggen-Quiz: beim Eintippen wird das Land nicht markiert – sonst wäre es ein Länder-Quiz
  const askOnMap = ask === 'name' || (ask === 'type' && !targetItem?.flagPrompt) || (ask === 'text' && !!picked)
  /**
   * Kartenstil "Lagune": Land ist Milchglas mit weißen Linien auf Türkis-Meer.
   * Jede Fläche bekommt einen Zustand (CSS-Klasse s-…), die Farben stehen in geo.css.
   */
  function stateFor(shapeKey: string): { cls: string; fill?: string } {
    const it = itemOfShape[shapeKey]
    if (!it) return { cls: 's-ctx' }
    const isTarget = covers(targetItem?.areas, shapeKey)
    if (flash && (flash.ok ? isTarget : flash.key === it.key)) return { cls: flash.ok ? 's-ok' : 's-bad' }

    if (mode === 'learn') {
      const sel = info ? itemByKey[info] : null
      if (sel?.areas?.includes(shapeKey)) return { cls: 's-sel' }
      if (hover === shapeKey) return { cls: 's-hover' }
      if (hasGroups && sel && sel.group === it.group) return { cls: 's-group', fill: groups[it.group]?.color }
      return { cls: 's-open' }
    }
    if (solved.has(it.key) && !(ask !== 'click' && isTarget)) return { cls: 's-solved' }
    if (reveal && isTarget) return { cls: 's-reveal' }
    if (isTarget && askOnMap) {
      if (!picked || picked === '?') return { cls: 's-target' }
      return { cls: picked === rightAnswer ? 's-ok' : 's-reveal' }
    }
    if (ask === 'click' && hover && itemOfShape[hover]?.key === it.key) return { cls: 's-hover' }
    return { cls: 's-open' }
  }

  /* ── Vollbild ── */
  const wrapRef = useRef<HTMLDivElement>(null)
  const [full, setFull] = useState(false)
  const toggleFull = useCallback(() => {
    if (!full) {
      setFull(true)
      try { void wrapRef.current?.requestFullscreen?.().catch(() => {}) } catch { /* Fallback: nur CSS */ }
    } else {
      setFull(false)
      try { if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}) } catch { /* egal */ }
    }
  }, [full])
  useEffect(() => {
    const onFs = () => { if (!document.fullscreenElement) setFull(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(false) }
    document.addEventListener('fullscreenchange', onFs)
    window.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('fullscreenchange', onFs); window.removeEventListener('keydown', onKey) }
  }, [])
  useEffect(() => {
    if (!full) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [full])

  const labelItems = items.filter(it => showLabels || (mode === 'learn' ? info === it.key : showSolvedNames && solved.has(it.key)))
  const shapeByKey = useMemo(() => Object.fromEntries((scene?.shapes ?? []).map(s => [s.key, s])), [scene])
  const labelPos = (it: SceneItem): [number, number] | null => {
    if (it.pt) return it.pt
    const s = it.areas?.map(a => shapeByKey[a]).find(Boolean)
    return s ? [s.lx, s.ly] : null
  }
  const points = items.filter(it => it.pt)
  // Viele Punkte (Flughäfen, Gipfel, Millionenstädte) → kleinere Punkte, damit die Karte lesbar bleibt
  const pointR = points.length > 600 ? 2.4 : points.length > 200 ? 3 : 3.8
  // Ebenen-Reihenfolge, innerhalb einer Ebene kleine Flächen oben (z.B. Ténéré über der Sahara)
  const [hoverPt, setHoverPt] = useState<string | null>(null)
  const hoverItem = (hoverPt ? itemByKey[hoverPt] : undefined) ?? (hover ? itemOfShape[hover] : undefined)
  const showHoverName = hoverItem && (mode === 'learn' || solved.has(hoverItem.key))
  const infoItem = info ? itemByKey[info] : null
  const labelSize = Math.max(10, (first.labelSize ?? 8) * 1.45) * fontUnit

  /* ── Aufgaben-Block ── */
  const taskBlock = (
    <>
      {mode === 'learn' ? (
        <div className="ga-card">
          {infoItem ? (
            <>
              {hasGroups && <p className="ga-eyebrow">{groups[infoItem.group]?.name}</p>}
              {infoItem.flag && <Flag code={infoItem.flag} size="lg" className="ga-flag-info" />}
              <div className={`ga-task-target ${NON_LATIN.test(infoItem.prompt ?? infoItem.label) ? 'script' : ''}`} style={{ margin: '4px 0 6px' }}>{infoItem.prompt ?? infoItem.label}</div>
              <ItemActions item={infoItem} slug={slug} quiz={title} />
              {infoItem.details?.map(d => (
                <div key={d.label} className="ga-detail">
                  <span className="ga-muted">{d.label}</span>
                  <span className={`v ${d.big ? 'big' : ''}`}>{d.value}</span>
                </div>
              ))}
              {hasGroups && <p className="ga-label" style={{ marginTop: 14 }}>Ebenfalls: {groups[infoItem.group]?.name}</p>}
              {!hasGroups && <p className="ga-label" style={{ marginTop: 14 }}>Alle {single ? first.itemsNoun : 'Einträge'}</p>}
              <div className="ga-chips">
                {(hasGroups ? items.filter(i => i.group === infoItem.group) : items).slice(0, 60).map(i => (
                  <button key={i.key} className={`ga-chip sm ${i.key === info ? 'active' : ''}`} onClick={() => setInfo(i.key)}>{i.label}</button>
                ))}
              </div>
            </>
          ) : (
            <div className="ga-muted" style={{ fontSize: 14, lineHeight: 1.5 }}>
              {(single && first.intro) || 'Tippe auf die Karte, um Infos zu sehen.'} Mit zwei Fingern oder dem Mausrad zoomen, zum Verschieben ziehen.
            </div>
          )}
        </div>
      ) : done ? (
        <div className="ga-card ga-result">
          <p className="ga-eyebrow">{variant === 'leben' && lives <= 0 ? 'Keine Leben mehr' : variant === 'sprint' ? 'Zeit um' : 'Geschafft'}</p>
          <div className="ga-result-num">{variant === 'sprint' ? score.right : `${accuracy} %`}</div>
          <p className="ga-muted" style={{ margin: '0 0 14px', fontSize: 14 }}>
            {variant === 'sprint' ? `richtig in ${fmtTime(SPRINT_SECONDS)} · ${accuracy} % Treffer` : `${score.right} richtig · ${score.wrong} Fehler`}
            {finished && variant !== 'sprint' && ` · ${fmtTime(finished.seconds)} Min.`}
            {score.bestStreak > 2 && ` · beste Serie ${score.bestStreak}`}
          </p>
          {finished?.newBest && <p className="ga-badge ok" style={{ marginBottom: 14 }}>Neuer Bestwert</p>}
          {onlyKeys && <p className="ga-muted" style={{ fontSize: 12.5, marginTop: -6 }}>Fehler-Training zählt nicht als Bestwert.</p>}
          {!loggedIn && !onlyKeys && <p className="ga-muted" style={{ fontSize: 12.5 }}>Melde dich an, um XP zu sammeln und deine Bestwerte im Konto zu speichern.</p>}
          <div className="ga-row ga-wrap" style={{ justifyContent: 'center', marginTop: 8 }}>
            {!multi && <button className="ga-btn primary" onClick={() => restart()}><Icon name="refresh" size={17} /> Nochmal</button>}
            {!multi && mistakes.size > 0 && (
              <button className="ga-btn" onClick={() => restart(mode, [...mistakes])}>Nur Fehler üben ({mistakes.size})</button>
            )}
            <button className="ga-btn" onClick={openShare}><Icon name="share" size={15} /> Ergebnis teilen</button>
          </div>
        </div>
      ) : targetItem ? (
        <>
          <div className="ga-task">
            <span className="ga-task-icon"><Icon name={ask === 'click' ? 'pointer' : ask === 'name' ? 'target' : ask === 'type' ? 'keyboard' : 'book'} size={20} /></span>
            <div className="ga-grow">
              <p className="ga-task-ask">
                {ask === 'click' ? (first.askClick && single ? first.askClick : 'Wo liegt …?')
                  : ask === 'name' ? (single ? first.askName : 'Was ist markiert?')
                  : ask === 'type' ? 'Tippe den Namen ein'
                  : (single ? first.askText : 'Wissensfrage')}
              </p>
              {ask === 'text' && targetItem.text ? (
                <>
                  {targetItem.flagPrompt && targetItem.flag && <Flag code={targetItem.flag} size="lg" />}
                  <div className={`ga-task-target ${targetItem.text.big ? 'script' : ''} ${targetItem.flagPrompt ? 'small' : ''}`}>{targetItem.text.prompt}</div>
                  {targetItem.text.sub && <div className="ga-task-sub">{targetItem.text.sub}</div>}
                </>
              ) : ask === 'click' ? (
                targetItem.flagPrompt && targetItem.flag ? (
                  <Flag code={targetItem.flag} size="lg" />
                ) : (
                  <>
                    <div className={`ga-task-target ${NON_LATIN.test(targetItem.prompt ?? targetItem.label) ? 'script' : ''}`}>{targetItem.prompt ?? targetItem.label}</div>
                    {targetItem.promptSub && <div className="ga-task-sub">{targetItem.promptSub}</div>}
                  </>
                )
              ) : ask === 'type' && targetItem.flagPrompt && targetItem.flag ? (
                <>
                  <Flag code={targetItem.flag} size="lg" />
                  {reveal && <div className="ga-task-target small">{targetItem.label}</div>}
                </>
              ) : (
                <div className="ga-task-target">{ask === 'type' && reveal ? targetItem.label : '?'}</div>
              )}
              {ask === 'click' && tries > 0 && !reveal && (
                <div className="ga-task-warn">
                  Nicht ganz – {3 - tries} {3 - tries === 1 ? 'Versuch' : 'Versuche'} übrig
                  {tries >= 2 && (hasGroups ? ` · Tipp: ${groups[targetItem.group]?.name}` : ` · Tipp: beginnt mit „${targetItem.label.slice(0, 1)}“`)}
                </div>
              )}
              {ask === 'type' && tries > 0 && !reveal && !picked && (
                <div className="ga-task-warn">Falsch – {3 - tries} {3 - tries === 1 ? 'Versuch' : 'Versuche'} übrig{tries >= 2 && ` · beginnt mit „${targetItem.label.slice(0, 2)}…“`}</div>
              )}
              {ask === 'type' && typeState === 'close' && <div className="ga-task-reveal">Fast – richtig geschrieben: {targetItem.label}</div>}
              {reveal && ask !== 'type' && <div className="ga-task-reveal">Hier ist es – kommt gleich nochmal dran</div>}
              {reveal && ask === 'type' && <div className="ga-task-reveal">Kommt gleich nochmal dran</div>}
            </div>
          </div>

          {(ask === 'name' || ask === 'text') && (
            <div className={`ga-answers ${flagAnswers ? 'flags' : ''}`}>
              {options.map((a, i) => {
                const cls = picked ? (a === rightAnswer ? 'right' : a === picked ? 'wrong' : '') : ''
                return (
                  <button key={a} className={`ga-answer ${cls}`} disabled={!!picked} onClick={() => onOptionPick(a)} aria-label={flagAnswers ? `Flagge ${i + 1}` : a}>
                    <kbd className="ga-desktop-only">{i + 1}</kbd>
                    {flagAnswers ? (
                      <span className="ga-answer-flag">
                        <Flag code={flagOfLabel[a]} size="md" />
                        {picked && <small>{a}</small>}
                      </span>
                    ) : <span>{a}</span>}
                  </button>
                )
              })}
            </div>
          )}
          {ask === 'type' && (
            <form onSubmit={onTypeSubmit} className="ga-row">
              <input
                ref={inputRef}
                className={`ga-input ${typeState === 'bad' ? 'bad' : typeState === 'good' || typeState === 'close' ? 'good' : ''}`}
                value={typed}
                onChange={e => setTyped(e.target.value)}
                placeholder="Name eintippen …"
                autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                disabled={!!picked}
                aria-label="Antwort"
              />
              <button type="submit" className="ga-btn primary" disabled={!!picked || !typed.trim()}>OK</button>
              <button type="button" className="ga-btn ghost sm" onClick={() => giveUp()} disabled={!!picked}>Weiß nicht</button>
            </form>
          )}
          {(picked || reveal) && targetItem && <ItemActions item={targetItem} slug={slug} quiz={title} />}
          {ask === 'text' && picked && (
            <div className="ga-muted" style={{ fontSize: 13, padding: '0 4px' }}>
              {targetItem.label}{hasGroups ? ` · ${groups[targetItem.group]?.name}` : ''} – auf der Karte markiert
            </div>
          )}
        </>
      ) : null}
    </>
  )

  const poolSize = onlyKeys?.length ?? poolFor(mode).length
  const progress = variant === 'sprint'
    ? ((SPRINT_SECONDS - (timeLeft ?? 0)) / SPRINT_SECONDS) * 100
    : poolSize ? ((poolSize - queue.length) / poolSize) * 100 : 0

  const MODES: [QuizMode, string, string][] = [
    ['learn', 'book', 'Lernen'],
    ['click', 'pointer', 'Auf Karte finden'],
    ['name', 'target', 'Namen zuordnen'],
    ['type', 'keyboard', 'Eintippen'],
    ...(hasText ? [['text', 'sparkle', (single && first.askText?.replace(/\?$/, '')) || 'Wissen'] as [QuizMode, string, string]] : []),
    ['mixed', 'shuffle', 'Gemischt'],
  ]
  const VARIANTS: [Variant, string, string][] = [
    ['normal', 'flag', 'Normal'],
    ['sprint', 'timer', `Sprint ${SPRINT_SECONDS / 60} Min.`],
    ['leben', 'heart', `${LIVES} Leben`],
  ]

  const subtitle = !scene
    ? (sceneError ? 'Karte konnte nicht geladen werden' : 'Karte wird geladen …')
    : items.length === 0
      ? 'Keine Einträge gefunden – Kartendatei passt nicht'
      : mode === 'learn'
    ? 'Lernmodus – tippe auf die Karte'
    : variant === 'sprint'
      ? `${score.right} richtig${best ? ` · Bestwert ${best.right}` : ''}`
      : `${poolSize - queue.length} von ${poolSize} ${single ? first.itemsNoun : 'Einträgen'} geschafft${best ? ` · Bestwert ${best.accuracy} %` : ''}`

  return (
    <div className="ga-page" style={{ paddingTop: 18 }}>
      <div className="ga-quiz-head">
        <div style={{ minWidth: 0 }}>
          <Link href={backHref} className="ga-btn ghost sm" style={{ marginLeft: -10 }}>
            <Icon name="back" size={15} /> {backLabel}
          </Link>
          {topBar && <div style={{ marginTop: 8 }}>{topBar}</div>}
          <h1 className="ga-quiz-title">{title}</h1>
          <p className="ga-quiz-sub">
            {diff && (
              <span className="ga-diff" style={{ '--ga-diff': config.difficulties[diff].color } as React.CSSProperties} title={`XP ×${config.difficulties[diff].factor}${boost > 1 ? ` · Boost ×${boost}` : ''}`}>
                {config.difficulties[diff].label}
              </span>
            )}
            {subtitle}
          </p>
        </div>
        <div className="ga-row ga-wrap">
          {multi && <span className="ga-badge date"><Icon name="users" size={13} /> Mehrspieler · {variant === 'leben' ? '3 Leben' : 'Normal'}</span>}
          {!multi && loggedIn && mode !== 'learn' && (
            <button className="ga-btn sm" onClick={startRoom} disabled={roomBusy} title="Einladungslink erstellen und zusammen spielen – mit XP-Bonus">
              <Icon name="users" size={15} /> Mit Freunden spielen
            </button>
          )}
          {mode !== 'learn' && !multi && (
            <div className="ga-seg" role="group" aria-label="Spielart">
              {VARIANTS.filter(([v]) => v === 'normal' || allowed[v as ModeKey]).map(([v, icon, label]) => (
                <button key={v} className={variant === v ? 'active' : ''} onClick={() => changeVariant(v)}>
                  <Icon name={icon} size={14} /> {label}
                </button>
              ))}
            </div>
          )}
          {!multi && <button className="ga-icon-btn" aria-label="Neu starten" title="Neu starten" onClick={() => restart()}><Icon name="refresh" size={17} /></button>}
        </div>
      </div>

      {multi?.board}

      <div className="ga-toolbar" style={multi ? { display: 'none' } : undefined}>
        <div className="ga-chips">
          {MODES.filter(([m]) => allowed[m as ModeKey]).map(([m, icon, label]) => (
            <button key={m} className={`ga-chip ${mode === m ? 'active' : ''}`} onClick={() => changeMode(m)}>
              <Icon name={icon} size={15} /> {label}
            </button>
          ))}
        </div>
      </div>

      {resumeOffer && (
        <div className="ga-card ga-resume">
          <div className="ga-grow">
            <p className="ga-eyebrow">Nicht beendet</p>
            <p style={{ margin: '2px 0 0' }}>
              Du hast dieses Quiz am {new Date(resumeOffer.savedAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} verlassen:{' '}
              <b>{saveProgress(resumeOffer).done} von {saveProgress(resumeOffer).total}</b> geschafft, {saveProgress(resumeOffer).accuracy} % richtig.
            </p>
          </div>
          {!confirmDrop ? (
            <div className="ga-row ga-wrap">
              <button className="ga-btn primary sm" onClick={() => { if (applySave(resumeOffer)) setResumeOffer(null) }}><Icon name="play" size={14} /> Fortsetzen</button>
              <button className="ga-btn sm" onClick={() => resumeSaveResult(resumeOffer)}><Icon name="check" size={14} /> Ergebnis speichern</button>
              <button className="ga-btn ghost sm" onClick={() => setConfirmDrop(true)}><Icon name="x" size={14} /> Verwerfen</button>
            </div>
          ) : (
            <div className="ga-row ga-wrap">
              <span><b>Bist du sicher?</b> Der Stand wird gelöscht.</span>
              <button className="ga-btn danger sm" onClick={() => { dropSave(resumeOffer.slug, loggedIn); setResumeOffer(null); setConfirmDrop(false) }}>Ja, verwerfen</button>
              <button className="ga-btn ghost sm" onClick={() => setConfirmDrop(false)}>Abbrechen</button>
            </div>
          )}
        </div>
      )}

      {mode !== 'learn' && <div className="ga-progress"><span style={{ width: `${progress}%` }} /></div>}

      {!full && <div className="ga-phone-only" style={{ flexDirection: 'column', gap: 10, marginBottom: 10 }}>{taskBlock}</div>}

      <div className="ga-quiz-layout">
        <div ref={wrapRef} className={`ga-map-wrap v-${view} ${view === 'flaggen' ? 'v-dunkel' : ''} ${full ? 'full' : ''} ${view === 'papier' ? 'atlas' : ''}`}>
          {!scene ? (
            <div className="ga-map-loading">
              {sceneError ? <><Icon name="info" /> {sceneError}</> : <><Icon name="globe" /> Karte wird gezeichnet …</>}
            </div>
          ) : (
            <svg
              ref={svgRef}
              className={`ga-map v-${view} ${view === 'flaggen' ? 'v-dunkel' : ''} ${dragging ? 'dragging' : ''} ${scene.phys ? 'phys' : ''} ${view === 'relief' && rasterImgs.length ? 'relief' : ''} ${view === 'papier' ? 'atlas' : ''}`}
              viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onPointerLeave={() => setHover(null)}
              role="img"
              aria-label={`Karte: ${title}`}
            >
              <defs>
                {/* Weiches Leuchten – Größe in Bildschirm-Pixeln, damit es beim Zoomen gleich bleibt */}
                <filter id="ga-glow" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation={1.6 * fontUnit} result="b" />
                  <feColorMatrix in="b" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.45 0" result="b2" />
                  <feMerge><feMergeNode in="b2" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id="ga-soft" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation={1.5 * fontUnit} result="b" />
                  <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id="ga-shore" x="-10%" y="-10%" width="120%" height="120%">
                  <feGaussianBlur stdDeviation={4 * fontUnit} />
                </filter>
                {view === 'relief' && rasterImgs.length > 0 && (
                  <clipPath id="ga-land">
                    {scene.context.map(c => <path key={c.key} d={c.d} />)}
                    {!scene.phys && scene.shapes.filter(sh => sh.look === 'land' || sh.look === 'terr').map(sh => <path key={`cl-${sh.key}`} d={sh.d} />)}
                  </clipPath>
                )}
              </defs>
              {scene.graticule && <path className="grat" d={scene.graticule} strokeWidth={0.6} />}

              {/* Heller Schimmer im Flachwasser vor den Küsten (auf physischen Karten um das ganze Land) */}
              <g className="shore" filter="url(#ga-shore)" aria-hidden="true">
                {scene.phys
                  ? scene.context.map(c => <path key={`sh2-${c.key}`} d={c.d} />)
                  : scene.shapes.filter(sh => sh.look === 'land' || sh.look === 'terr').map(sh => <path key={`sh2-${sh.key}`} d={sh.d} />)}
              </g>

              {/* Relief (auf die Landflächen beschnitten) bzw. Satellitenbild – in die Kartenprojektion umgerechnet */}
              {rasterImgs.length > 0 && (
                <g className="relief-img" clipPath={view === 'relief' ? 'url(#ga-land)' : undefined} aria-hidden="true">
                  {rasterImgs.map(im => <image key={im.href} href={im.href} x={im.x} y={im.y} width={im.w} height={im.h} preserveAspectRatio="none" />)}
                </g>
              )}

              {scene.context.map(c => <path key={c.key} className="ctx" d={c.d} />)}

              {/* Kartenansicht „Flaggen“: Flaggen in den Flächen (unter den anklickbaren Flächen) */}
              {flagFills.length > 0 && (
                <g className="flg" aria-hidden="true">
                  <defs>
                    {flagFills.map((f, i) => (
                      <pattern key={f.key} id={`ga-fl-${i}`} patternUnits="userSpaceOnUse" x={f.bb[0]} y={f.bb[1]} width={Math.max(0.01, f.bb[2] - f.bb[0])} height={Math.max(0.01, f.bb[3] - f.bb[1])}>
                        <image href={f.src} width={Math.max(0.01, f.bb[2] - f.bb[0])} height={Math.max(0.01, f.bb[3] - f.bb[1])} preserveAspectRatio="xMidYMid slice" />
                      </pattern>
                    ))}
                  </defs>
                  {flagFills.map((f, i) => <path key={f.key} d={f.d} fill={`url(#ga-fl-${i})`} />)}
                </g>
              )}

              {sortedShapes.map(s => {
                const it = itemOfShape[s.key]
                const st = stateFor(s.key)
                const cursor = it && (mode === 'learn' || ask === 'click') ? 'pointer' : 'default'
                const enter = (e: React.PointerEvent) => { if (e.pointerType === 'mouse') setHover(s.key) }
                if (s.look === 'line') {
                  // Flüsse: sichtbare Linie + breite unsichtbare Linie zum leichteren Treffen
                  return (
                    <g key={s.key} className={`ln ${lineKind(s.key)} ${st.cls}`} style={{ cursor }} onClick={() => onPick(it, s.key)} onPointerEnter={enter}>
                      <path className="hit" d={s.d} />
                      <path className="vis" d={s.d} />
                    </g>
                  )
                }
                return (
                  <path
                    key={s.key}
                    data-k={s.key}
                    className={`a lk-${s.look} ${st.cls} t${s.tint} ${flagged.has(s.key) ? 'fl' : ''}`}
                    d={s.d}
                    style={{ ...(st.fill ? { fill: `color-mix(in srgb, ${st.fill} 45%, transparent)` } : {}), cursor }}
                    onClick={() => onPick(it, s.key)}
                    onPointerEnter={enter}
                  />
                )
              })}

              {/* Winzige Länder/Inseln: Kreis zum Antippen */}
              {scene.shapes.filter(s => s.tiny && s.look !== 'line' && itemOfShape[s.key]).map(s => {
                const st = stateFor(s.key)
                return (
                  <circle
                    key={`t-${s.key}`}
                    cx={s.lx} cy={s.ly} r={4.6 * fontUnit}
                    className={`tiny lk-${s.look} ${st.cls}`}
                    // Gruppenfarbe (Lernmodus) auch für die Kreise – sonst wären sie schwarz
                    style={{ cursor: 'pointer', ...(st.fill ? { fill: `color-mix(in srgb, ${st.fill} 70%, #f3e6bd)` } : {}) }}
                    onClick={() => onPick(itemOfShape[s.key], s.key)}
                    onPointerEnter={e => { if (e.pointerType === 'mouse') setHover(s.key) }}
                  />
                )
              })}

              {/* Zusätzliche Linien (Mauer, Grenzen) und heutige Grenzen – nicht anklickbar */}
              {scene.lines.map(l => <path key={l.ref} className={`ovl ovl-${l.kind}`} d={l.d} />)}
              {showToday && scene.today && <path className="today" d={scene.today} />}

              {/* Städte als Punkte */}
              {points.map(it => {
                const isT = targetItem?.key === it.key && askOnMap
                const fl = flash && flash.key === it.key ? (flash.ok ? 's-ok' : 's-bad') : null
                const rev = reveal && targetItem?.key === it.key ? 's-reveal' : null
                const sel = mode === 'learn' && info === it.key ? 's-sel' : null
                const known = solved.has(it.key) || mode === 'learn'
                const cls = fl ?? rev ?? sel ?? (isT ? 's-target' : known ? 's-solved' : 's-open')
                const r = (isT || fl || rev || sel ? 5.5 : pointR) * fontUnit
                const common = {
                  className: `pt ${cls}`,
                  style: { cursor: 'pointer' },
                  onClick: () => onPick(it, it.areas?.[0]),
                  onPointerEnter: (e: React.PointerEvent) => { if (e.pointerType === 'mouse') setHoverPt(it.key) },
                  onPointerLeave: () => setHoverPt(null),
                }
                if (it.pointShape === 'tri') {
                  const [x, y] = it.pt!
                  const h = r * 1.25
                  return <path key={`p-${it.key}`} d={`M${x},${y - h}L${x + h * 0.95},${y + h * 0.65}L${x - h * 0.95},${y + h * 0.65}Z`} {...common} />
                }
                return <circle key={`p-${it.key}`} cx={it.pt![0]} cy={it.pt![1]} r={r} {...common} />
              })}

              <g>
                {labelItems.map(it => {
                  const p = labelPos(it)
                  if (!p) return null
                  return (
                    <text key={`l-${it.key}`} className="lbl" x={p[0]} y={it.pt ? p[1] - 7 * fontUnit : p[1]}
                      textAnchor="middle" dominantBaseline={it.pt ? 'auto' : 'middle'}
                      fontSize={labelSize} strokeWidth={3 * fontUnit}>
                      {it.label}
                    </text>
                  )
                })}
              </g>
            </svg>
          )}

          {scene && (
            <div className="ga-map-tools" role="toolbar" aria-label="Karte">
              <button aria-label="Hineinzoomen" title="Hineinzoomen" onClick={() => zoomAt(1 / 1.5)}><Icon name="plus" size={17} /></button>
              <button aria-label="Herauszoomen" title="Herauszoomen" onClick={() => zoomAt(1.5)}><Icon name="minus" size={17} /></button>
              <button aria-label="Ganze Karte" title="Ganze Karte" disabled={!zoomed} onClick={() => setVb(BASE_VB)}><Icon name="globe" size={16} /></button>
              <span className="sep" />
              <button className={viewMenu ? 'active' : ''} aria-label="Kartenansicht wählen" title="Kartenansicht" aria-expanded={viewMenu} onClick={() => setViewMenu(m => !m)}>
                <Icon name="map" size={16} />
              </button>
              <button aria-label={full ? 'Vollbild beenden' : 'Vollbild'} title={full ? 'Vollbild beenden (Esc)' : 'Vollbild'} onClick={toggleFull}>
                <Icon name={full ? 'minimize' : 'maximize'} size={16} />
              </button>
              <button className={showSolvedNames ? 'active' : ''} aria-label="Namen gefundener Länder anzeigen" title={showSolvedNames ? 'Namen der gefundenen ausblenden' : 'Namen der gefundenen anzeigen'} aria-pressed={showSolvedNames} onClick={toggleSolvedNames}>
                <Icon name="tag" size={16} />
              </button>
              <button className={showLabels ? 'active' : ''} aria-label="Alle Namen anzeigen" title="Alle Namen anzeigen" aria-pressed={showLabels} onClick={() => setShowLabels(s => !s)}>
                <Icon name="eye" size={16} />
              </button>
              {scene.today && (
                <button className={showToday ? 'active' : ''} aria-label="Heutige Grenzen anzeigen" title={showToday ? 'Heutige Grenzen ausblenden' : 'Heutige Grenzen einblenden'} aria-pressed={showToday} onClick={() => setShowToday(v => !v)}>
                  <Icon name="layers" size={16} />
                </button>
              )}
            </div>
          )}
          {scene && viewMenu && (
            <div className="ga-view-menu" role="menu" aria-label="Kartenansicht">
              <p className="ga-eyebrow">Kartenansicht</p>
              {VIEWS.map(v => (
                <button key={v.id} role="menuitemradio" aria-checked={view === v.id} className={view === v.id ? 'on' : ''} onClick={() => pickView(v.id)}>
                  <span className={`sw sw-${v.id}`} aria-hidden="true" />
                  <span className="tx"><b>{v.label}{v.id === defaultView ? ' · Standard' : ''}</b><small>{v.hint}</small></span>
                  {view === v.id && <Icon name="check" size={15} />}
                </button>
              ))}
              {viewPref && <button className="reset" onClick={() => pickView(null)}>Standard dieses Quiz verwenden</button>}
            </div>
          )}
          {scene && (view === 'satellit' || view === 'nacht' || usesTerrainTiles) && (
            <div className="ga-map-credit">
              {view === 'satellit'
                ? <a href="https://s2maps.eu" target="_blank" rel="noopener noreferrer">Sentinel-2 cloudless 2016 by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016) · CC BY 4.0</a>
                : view === 'nacht'
                ? <a href="https://earthobservatory.nasa.gov/features/NightLights" target="_blank" rel="noopener noreferrer">Black Marble 2016: NASA Earth Observatory / NASA GIBS</a>
                : <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener noreferrer">Höhendaten: Terrain Tiles (AWS Open Data) · Quellen</a>}
            </div>
          )}
          {full && scene && (
            <>
              <div className="ga-float-task">{taskBlock}</div>
              <div className="ga-float-hud">
                <span className="t">{title}</span>
                {mode === 'learn' ? <span className="ga-muted">Lernmodus</span> : (
                  <>
                    <span className="bar"><span style={{ width: `${progress}%` }} /></span>
                    {variant !== 'sprint' && <span>{poolSize - queue.length}/{poolSize}</span>}
                    <span className="ok"><Icon name="check" size={14} /> {score.right}</span>
                    <span className="bad"><Icon name="x" size={14} /> {score.wrong}</span>
                    {variant === 'leben' && <span className="ga-hearts">{Array.from({ length: LIVES }, (_, i) => <Icon key={i} name="heart" size={14} className={i < lives ? '' : 'off'} />)}</span>}
                    {variant === 'sprint' && <span className={`ga-timer ${(timeLeft ?? 0) <= 15 ? 'low' : ''}`}>{fmtTime(timeLeft ?? 0)}</span>}
                    {variant === 'normal' && score.streak >= 3 && <span className="streak">Serie {score.streak}</span>}
                  </>
                )}
              </div>
            </>
          )}
          {hoverItem && showHoverName && (
            <div className="ga-map-hover">{hoverItem.prompt ?? hoverItem.label}{hasGroups ? ` · ${groups[hoverItem.group]?.name}` : ''}</div>
          )}
        </div>

        <aside className="ga-side">
          {!full && <div className="ga-desktop-only" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{taskBlock}</div>}

          {mode !== 'learn' && (
            <div className="ga-stats">
              <div className="ga-stat"><b>{score.right}</b><span>Richtig</span></div>
              <div className="ga-stat"><b>{score.wrong}</b><span>Fehler</span></div>
              {variant === 'leben' ? (
                <div className="ga-stat">
                  <b className="ga-hearts">{Array.from({ length: LIVES }, (_, i) => <Icon key={i} name="heart" size={17} className={i < lives ? '' : 'off'} />)}</b>
                  <span>Leben</span>
                </div>
              ) : variant === 'sprint' ? (
                <div className="ga-stat"><b className={`ga-timer ${(timeLeft ?? 0) <= 15 ? 'low' : ''}`}>{fmtTime(timeLeft ?? 0)}</b><span>Zeit</span></div>
              ) : (
                <div className={`ga-stat ${score.streak >= 5 ? 'hot' : ''}`}><b>{score.streak}</b><span>Serie</span></div>
              )}
            </div>
          )}

          {hasGroups && (
          <div className="ga-card">
              <p className="ga-label">Gruppen</p>
              {groupKeys.map(g => {
                const gi = items.filter(i => i.group === g)
                const known = mode === 'learn' || showLabels || gi.every(i => solved.has(i.key))
                return (
                  <div key={g} className="ga-legend-item">
                    <span className="ga-swatch" style={{ background: known ? groups[g].color : 'var(--ga-land)' }} />
                    <span style={{ color: known ? 'var(--ga-ink)' : 'var(--ga-ink-3)' }}>{groups[g].name}</span>
                    {mode !== 'learn' && (
                      <span className="ga-muted" style={{ marginLeft: 'auto', fontSize: 12 }}>
                        {gi.filter(i => solved.has(i.key)).length}/{gi.length}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {scene && (scene.lines.length > 0 || scene.today) && (
            <div className="ga-card" style={{ fontSize: 13.5, lineHeight: 1.5 }}>
              <p className="ga-label">Auf der Karte</p>
              {scene.lines.map(l => (
                <div key={l.ref} className="ga-legend-item"><span className={`ga-line-swatch ${l.kind}`} /><span>{l.label}</span></div>
              ))}
              {scene.today && (
                <button className={`ga-legend-item ga-legend-btn ${showToday ? 'on' : ''}`} onClick={() => setShowToday(v => !v)} aria-pressed={showToday}>
                  <span className="ga-line-swatch today" /><span>Heutige Grenzen {showToday ? 'ausblenden' : 'einblenden'}</span>
                </button>
              )}
            </div>
          )}

          {single && first.tip && (
            <div className="ga-card" style={{ fontSize: 13.5, lineHeight: 1.5 }}>
              <p className="ga-label">{first.tip.title}</p>
              <div className="ga-muted">{first.tip.text}</div>
            </div>
          )}
          {!single && (
            <div className="ga-card" style={{ fontSize: 13.5, lineHeight: 1.5 }}>
              <p className="ga-label">Kombiniert</p>
              <div className="ga-muted">{defs.map(d => d.title).join(' · ')}</div>
            </div>
          )}
        </aside>
      </div>
      {share && <ShareDialog data={share} onClose={() => setShare(null)} />}
    </div>
  )
}