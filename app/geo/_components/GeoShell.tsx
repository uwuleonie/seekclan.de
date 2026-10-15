'use client'

// Rahmen für alle /geo-Seiten: Atlas-Board (Navigation innerhalb der Seite, keine zweite Navbar),
// Freischalt-Status und Überschreibungen aus dem Adminpanel, Vorschau-Modus für Admins, Bestwerte,
// XP & Level (Leiste, "+XP"-Anzeige mit Ton), Geo-Sternis (Kontostand, Freikaufen), XP-Boost-Banner, "Quiz fortsetzen?"
// und die Merkliste „Meine Wörter“.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '../../lib/auth-context'
import { CATALOG, EMPTY_STATE, bySort, decorate, difficultyOfEntry, modesOf, statusOf, type CatalogState } from '../_lib/catalog'
import type { CatalogEntry, QuizStatus } from '../_lib/types'
import { readLocalBests, saveLocal, saveRemote } from '../_lib/results'
import { dropSave, listAllSaves, saveProgress, type SaveState } from '../_lib/saves'
import { boostFactor, levelOf, type BoostInfo, type Difficulty, type GeoConfig, type LevelInfo, type ModeKey } from '../_lib/xp'
import { BEREICH_BY_KEY } from '../_content/welt'
import type { Bereich } from '../_lib/types'
import Icon from './Icon'
import { cleanWord, type SavedWord } from '../_lib/words'
import { readLocal as readLocalSrs, writeLocal as writeLocalSrs } from '../_lib/srs'

export interface GeoProfile { xp: number; hidden: boolean; level: LevelInfo; sternis: number }
/** Gewinn vom Server: XP – oder Geo-Sternis, wenn kind = 'sterni' */
export interface XpGain { amount: number; label: string; kind?: 'sterni' }
export type BuyResult = { ok: true } | { ok: false; error: string }

interface GeoCtx {
  state: CatalogState
  loaded: boolean
  isAdmin: boolean
  /** Team (Teammitglied, Administrator, Owner) – darf das Geo-Adminpanel ansehen */
  isTeam: boolean
  preview: boolean
  setPreview: (on: boolean) => void
  status: (e: CatalogEntry) => QuizStatus
  /** Alle Quizzes mit den Texten aus dem Adminpanel, ohne unsichtbare, in der Reihenfolge aus dem Adminpanel */
  catalog: CatalogEntry[]
  bySlug: Record<string, CatalogEntry>
  difficulty: (e: CatalogEntry) => Difficulty
  modes: (e: CatalogEntry | undefined) => Record<ModeKey, boolean>
  bereichName: (b: Bereich) => string
  config: GeoConfig
  boosts: BoostInfo[]
  /** Aktiver Boost-Faktor (1 = keiner) */
  boost: number
  /** Bester Treffer in % je Quiz (Konto oder Browser) */
  bests: Record<string, number>
  refreshBests: () => void
  loggedIn: boolean
  profile: GeoProfile | null
  /** Anzahl einmal richtig gelöster Einträge je Quiz */
  progress: Record<string, number>
  /** Richtigen Treffer melden – gibt es XP, erscheint "+X XP" (mit Ton) */
  grantXp: (slugs: string[], key: string, total: number, multi?: boolean) => void
  /** XP anzeigen, die der Server schon gutgeschrieben hat (z.B. Bonus beim Ergebnis) */
  showGains: (gains: XpGain[]) => void
  /** Spiel-Ton abspielen (nur wenn Ton an ist); serie = richtige in Folge (höherer Ton) */
  klang: (art: Klang, serie?: number) => void
  reloadProfile: () => void
  setHidden: (hidden: boolean) => Promise<void>
  /** Preis zum Freikaufen eines Quiz in Geo-Sternis */
  price: (e: CatalogEntry) => number
  /** Quiz mit Geo-Sternis freikaufen */
  buyQuiz: (slug: string) => Promise<BuyResult>
  /** Beliebt: im Adminpanel festgelegte zuerst, dann die meistgespielten (nur Slugs) */
  popular: { pinned: string[]; auto: string[] }
  /** Angepinnt (Konto oder Browser) – Schlüssel "quiz:slug", "country:DEU", "section:europa/Natur", "bereich:europa" */
  pins: string[]
  isPinned: (kind: PinKind, key: string) => boolean
  togglePin: (kind: PinKind, key: string) => void
  /** Merkliste „Meine Wörter“ (Konto oder Browser) */
  words: SavedWord[]
  isSaved: (key: string) => boolean
  toggleWord: (w: SavedWord) => void
}

export type PinKind = 'quiz' | 'country' | 'section' | 'bereich'

const Ctx = createContext<GeoCtx | null>(null)
export function useGeo(): GeoCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useGeo nur innerhalb von /geo')
  return c
}

const NAV: { href: string; label: string; icon?: string; bereich?: Bereich; sep?: boolean }[] = [
  { href: '/geo', label: 'Übersicht', icon: 'compass' },
  { href: '/geo/welt', label: 'Welt', bereich: 'welt', sep: true },
  { href: '/geo/europa', label: 'Europa', bereich: 'europa' },
  { href: '/geo/asien', label: 'Asien', bereich: 'asien' },
  { href: '/geo/afrika', label: 'Afrika', bereich: 'afrika' },
  { href: '/geo/nordamerika', label: 'Nordamerika', bereich: 'nordamerika' },
  { href: '/geo/suedamerika', label: 'Südamerika', bereich: 'suedamerika' },
  { href: '/geo/ozeanien', label: 'Ozeanien', bereich: 'ozeanien' },
  { href: '/geo/sprachen', label: 'Sprachen & Schriften', bereich: 'sprachen', sep: true },
  { href: '/geo/higher-lower', label: 'Higher Lower', icon: 'arrowUp', sep: true },
  { href: '/geo/baukasten', label: 'Baukasten', icon: 'layers' },
  { href: '/geo/rangliste', label: 'Rangliste', icon: 'trophy' },
  { href: '/geo/updates', label: 'Kalender', icon: 'calendar' },
]

/* ───────────── Ton (ohne Datei, direkt im Browser erzeugt) ───────────── */

let audio: AudioContext | null = null
function play(notes: number[], gap = 0.075, vol = 0.09, type: OscillatorType = 'triangle', len = 0.28) {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    audio = audio ?? new AC()
    const t0 = audio.currentTime + 0.01
    notes.forEach((f, i) => {
      const o = audio!.createOscillator(), g = audio!.createGain()
      const t = t0 + i * gap
      o.type = type
      o.frequency.value = f
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012)
      g.gain.exponentialRampToValueAtTime(0.0001, t + len)
      o.connect(g).connect(audio!.destination)
      o.start(t)
      o.stop(t + len + 0.02)
    })
  } catch { /* kein Ton möglich – egal */ }
}

/** Spiel-Töne (z. B. Higher Lower): richtig, falsch, Bonus-Stufe, Wette, Uhr, „du bist dran“ */
export type Klang = 'richtig' | 'falsch' | 'stufe' | 'wette-gewonnen' | 'wette-verloren' | 'tick' | 'zug' | 'sieg'

function klangSpielen(art: Klang, serie = 0) {
  switch (art) {
    case 'richtig': {
      // Wie beim Quiz – mit jeder richtigen Antwort in Folge einen Halbton höher (bis eine Quinte darüber)
      const f = Math.pow(2, Math.min(Math.max(serie - 1, 0), 7) / 12)
      return play([880 * f, 1318 * f])
    }
    case 'falsch': return play([311, 233, 175], 0.11, 0.08, 'sine', 0.32)
    case 'stufe': return play([523, 659, 784, 1046, 1318], 0.05, 0.08)
    case 'wette-gewonnen':
      play([1318, 1760, 2093, 2637], 0.05, 0.07)
      setTimeout(() => play([523, 659, 784, 1046], 0.09, 0.1), 260)
      return
    case 'wette-verloren': return play([392, 330, 262, 196], 0.12, 0.08, 'sine', 0.35)
    case 'tick': return play([1200], 0, 0.05, 'sine', 0.08)
    case 'zug': return play([660, 990], 0.09, 0.08)
    case 'sieg': return play([523, 659, 784, 1046, 784, 1046, 1318], 0.08, 0.1)
  }
}

const fmtLeft = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  const p = (n: number) => String(n).padStart(2, '0')
  return d ? `${d} T ${p(h)}:${p(m)}:${p(sec)}` : `${p(h)}:${p(m)}:${p(sec)}`
}
const fmtFactor = (f: number) => `×${String(Math.round(f * 100) / 100).replace('.', ',')}`

type Toast = { id: number; text: string; sub?: string; big?: boolean; sterni?: boolean }

export default function GeoShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname() || '/geo'
  const [state, setState] = useState<CatalogState>(EMPTY_STATE)
  const [loaded, setLoaded] = useState(false)
  const [preview, setPreviewState] = useState(false)
  const [bests, setBests] = useState<Record<string, number>>({})
  const [bestTick, setBestTick] = useState(0)
  const [profile, setProfile] = useState<GeoProfile | null>(null)
  const [progress, setProgress] = useState<Record<string, number>>({})
  const [profileTick, setProfileTick] = useState(0)
  const [popular, setPopular] = useState<{ pinned: string[]; auto: string[] }>({ pinned: [], auto: [] })
  const [pins, setPins] = useState<string[]>([])
  const [words, setWords] = useState<SavedWord[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])
  const [muted, setMuted] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  /** Toast-Funktion für Stellen, die vor ihr stehen (Nachzahlung beim Laden des Profils) */
  const toastRef = useRef<(t: Omit<Toast, 'id'>) => void>(() => {})

  const isAdmin = !!user?.clan_role && ['administrator', 'owner'].includes(user.clan_role)
  const isTeam = isAdmin || user?.clan_role === 'teammitglied'

  useEffect(() => {
    try {
      setPreviewState(document.cookie.split('; ').includes('geo_preview=1'))
      setMuted(localStorage.getItem('geo-sound') === '0')
    } catch { /* egal */ }
  }, [])

  // Katalog, Überschreibungen, Boosts, Einstellungen vom Server
  useEffect(() => {
    let alive = true
    fetch('/api/geo/catalog', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (!alive) return
        setState({
          ...EMPTY_STATE,
          releases: d.releases ?? {}, admin: !!d.admin, preview: !!d.preview, now: d.now ? new Date(d.now).getTime() : Date.now(),
          role: d.role ?? null, loggedIn: !!d.loggedIn, meta: d.meta ?? {}, groups: d.groups ?? [], boosts: d.boosts ?? [],
          config: d.config ?? EMPTY_STATE.config, unlocks: Array.isArray(d.unlocks) ? d.unlocks : [],
        })
        if (d.popular) setPopular(d.popular)
        setLoaded(true)
      })
      .catch(() => { if (alive) setLoaded(true) })
    return () => { alive = false }
  }, [user?.id, preview])

  const setPreview = useCallback((on: boolean) => {
    document.cookie = `geo_preview=${on ? '1' : '0'}; path=/; max-age=${on ? 60 * 60 * 24 * 30 : 0}; samesite=lax`
    setPreviewState(on)
  }, [])

  // Bestwerte: Konto (falls eingeloggt) + Browser, jeweils der höhere Wert
  useEffect(() => {
    let alive = true
    const local = readLocalBests()
    setBests(local)
    if (!user) return
    fetch('/api/geo/results', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!alive || !d?.bests) return
        const merged = { ...local }
        for (const [slug, v] of Object.entries(d.bests as Record<string, { accuracy: number }>)) merged[slug] = Math.max(merged[slug] ?? 0, v.accuracy)
        setBests(merged)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [user, bestTick])

  // XP-Profil
  useEffect(() => {
    if (!user) { setProfile(null); setProgress({}); return }
    let alive = true
    fetch('/api/geo/me', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!alive || !d?.profile) return
        setProfile(d.profile)
        setProgress(d.progress ?? {})
        // Nachgezahlte Geo-Sternis (erreichte Level, schon fertige Quizzes) anzeigen
        const st: XpGain[] = Array.isArray(d.sternis) ? d.sternis : []
        const sum = st.reduce((s, g) => s + g.amount, 0)
        if (sum > 0) toastRef.current({ text: `+${sum} Geo-Sternis`, sub: st.map(g => g.label).join(' · '), sterni: true, big: true })
      })
      .catch(() => {})
    return () => { alive = false }
  }, [user, profileTick])

  // Angepinnt: eingeloggt im Konto, sonst im Browser
  useEffect(() => {
    let local: string[] = []
    try { local = JSON.parse(localStorage.getItem('geo-pins') || '[]') } catch { /* egal */ }
    if (!user) { setPins(local); return }
    let alive = true
    fetch('/api/geo/pins', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!alive || !d) return
        const remote = (d.pins as { kind: string; key: string }[]).map(p => `${p.kind}:${p.key}`)
        // Was als Gast angepinnt wurde, ins Konto übernehmen
        for (const k of local) if (!remote.includes(k)) {
          const i = k.indexOf(':')
          fetch('/api/geo/pins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: k.slice(0, i), key: k.slice(i + 1), pinned: true }) }).catch(() => {})
          remote.push(k)
        }
        try { localStorage.removeItem('geo-pins') } catch { /* egal */ }
        setPins(remote)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [user])

  const togglePin = useCallback((kind: PinKind, key: string) => {
    const k = `${kind}:${key}`
    setPins(list => {
      const on = !list.includes(k)
      const next = on ? [k, ...list] : list.filter(x => x !== k)
      if (user) fetch('/api/geo/pins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, key, pinned: on }) }).catch(() => {})
      else try { localStorage.setItem('geo-pins', JSON.stringify(next)) } catch { /* egal */ }
      return next
    })
  }, [user])

  // Merkliste: eingeloggt im Konto, sonst im Browser. Beim Einloggen wird alles aus dem Browser übernommen
  // (gleiches gilt für die Lernkartei).
  useEffect(() => {
    let local: SavedWord[] = []
    try { local = (JSON.parse(localStorage.getItem('geo-words') || '[]') as unknown[]).map(cleanWord).filter((w): w is SavedWord => !!w) } catch { /* egal */ }
    if (!user) { setWords(local); return }
    let alive = true
    fetch('/api/geo/words', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(async d => {
        if (!alive || !d) return
        const remote = d.words as SavedWord[]
        const fresh = local.filter(w => !remote.some(r => r.key === w.key))
        if (fresh.length) {
          const ok = await fetch('/api/geo/words', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ words: fresh }) }).then(r => r.ok).catch(() => false)
          if (ok) try { localStorage.removeItem('geo-words') } catch { /* egal */ }
        } else try { localStorage.removeItem('geo-words') } catch { /* egal */ }
        if (alive) setWords([...fresh, ...remote])
      })
      .catch(() => {})
    const srs = readLocalSrs()
    if (Object.keys(srs).length) {
      fetch('/api/geo/srs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ import: srs }) })
        .then(r => { if (r.ok) writeLocalSrs({}) }).catch(() => {})
    }
    return () => { alive = false }
  }, [user])

  const toggleWord = useCallback((w: SavedWord) => {
    setWords(list => {
      const on = !list.some(x => x.key === w.key)
      const next = on ? [w, ...list] : list.filter(x => x.key !== w.key)
      if (user) {
        fetch('/api/geo/words', { method: on ? 'POST' : 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(on ? { words: [w] } : { key: w.key }) }).catch(() => {})
      } else try { localStorage.setItem('geo-words', JSON.stringify(next.slice(0, 2000))) } catch { /* egal */ }
      return next
    })
  }, [user])

  // Uhr für Boost-Countdown (nur wenn ein Boost läuft oder bald startet)
  const boostSoon = state.boosts.some(b => Date.parse(b.endsAt) > now && Date.parse(b.startsAt) - now < 7 * 86400_000)
  useEffect(() => {
    if (!boostSoon) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [boostSoon])

  /* ── "+XP" anzeigen ── */
  const toastId = useRef(0)
  const pushToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = ++toastId.current
    setToasts(list => [...list.slice(-3), { ...t, id }])
    setTimeout(() => setToasts(list => list.filter(x => x.id !== id)), t.big ? 4200 : 2300)
  }, [])
  const soundOn = state.config.sound && !muted

  const applyGains = useCallback((all: XpGain[], newProfile?: GeoProfile) => {
    const gains = all.filter(g => g.kind !== 'sterni')
    const sternis = all.filter(g => g.kind === 'sterni')
    const sum = gains.reduce((s, g) => s + g.amount, 0)
    const stSum = sternis.reduce((s, g) => s + g.amount, 0)
    if (sum > 0) {
      const sub = gains.length > 1 || gains[0]?.label !== 'Erstmals richtig' ? gains.map(g => g.label).join(' · ') : undefined
      pushToast({ text: `+${sum} XP`, sub })
      if (soundOn) play([880, 1318])
    }
    if (stSum > 0) {
      setTimeout(() => {
        pushToast({ text: `+${stSum} Geo-Sternis`, sub: sternis.map(g => g.label).join(' · '), sterni: true })
        if (soundOn) play([1046, 1568, 2093], 0.06, 0.07)
      }, sum > 0 ? 450 : 0)
    }
    setProfile(old => {
      const next = newProfile ?? (old ? { ...old, xp: old.xp + sum, level: levelOf(old.xp + sum, state.config), sternis: old.sternis + stSum } : old)
      if (old && next && next.level.level > old.level.level) {
        pushToast({ text: `Level ${next.level.level}!`, sub: 'Neues Geografie-Level erreicht', big: true })
        if (soundOn) setTimeout(() => play([523, 659, 784, 1046], 0.09, 0.11), 250)
      }
      return next
    })
  }, [pushToast, soundOn, state.config])

  const grantXp = useCallback((slugs: string[], key: string, total: number, multi = false) => {
    if (!user) return
    fetch('/api/geo/xp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slugs, key, total, multi }) })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d) return
        if (d.slug && d.solved > 0) setProgress(p => ({ ...p, [d.slug]: d.solved }))
        const sternis: XpGain[] = Array.isArray(d.sternis) ? d.sternis : []
        if (d.gained > 0 || sternis.length) applyGains([...(d.parts ?? []), ...sternis], d.profile)
      })
      .catch(() => {})
  }, [user, applyGains])

  const setHidden = useCallback(async (hidden: boolean) => {
    await fetch('/api/geo/me', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hidden }) })
    setProfile(p => (p ? { ...p, hidden } : p))
  }, [])

  useEffect(() => { toastRef.current = pushToast }, [pushToast])

  /* ── Geo-Sternis: Quiz freikaufen ── */
  const price = useCallback((e: CatalogEntry) => state.config.sternis.price[difficultyOfEntry(e, state)] ?? 0, [state])
  const buyQuiz = useCallback(async (slug: string): Promise<BuyResult> => {
    try {
      const r = await fetch('/api/geo/sternis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.ok) return { ok: false, error: d.error || 'Freikaufen fehlgeschlagen' }
      setState(s => ({ ...s, unlocks: s.unlocks.includes(slug) ? s.unlocks : [...s.unlocks, slug] }))
      setProfile(p => (p ? { ...p, sternis: Number(d.sternis) } : p))
      pushToast({ text: 'Freigekauft!', sub: `−${d.price} Geo-Sternis · für immer offen`, sterni: true })
      if (soundOn) play([659, 880, 1318], 0.08, 0.1)
      return { ok: true }
    } catch {
      return { ok: false, error: 'Keine Verbindung' }
    }
  }, [pushToast, soundOn])

  /* ── Katalog für diesen Besucher ── */
  const status = useCallback((e: CatalogEntry) => statusOf(e, state), [state])
  const { catalog, bySlug } = useMemo(() => {
    const all = CATALOG.map(e => decorate(e, state))
    const bySlug = Object.fromEntries(all.map(e => [e.slug, e]))
    const visible = bySort(all.filter(e => !statusOf(e, state).hidden), e => state.meta[e.slug]?.sort ?? null)
    return { catalog: visible, bySlug }
  }, [state])

  const boost = boostFactor(state.boosts, now)
  const activeBoost = state.boosts.find(b => Date.parse(b.startsAt) <= now && Date.parse(b.endsAt) > now)
  const nextBoost = !activeBoost ? state.boosts.find(b => Date.parse(b.startsAt) > now && Date.parse(b.startsAt) - now < 7 * 86400_000) : undefined

  const value = useMemo<GeoCtx>(() => ({
    state, loaded, isAdmin, isTeam, preview, setPreview,
    status, catalog, bySlug,
    difficulty: e => difficultyOfEntry(e, state),
    modes: e => modesOf(e, state),
    bereichName: b => state.groups.find(g => g.kind === 'bereich' && g.key === b)?.title ?? BEREICH_BY_KEY[b]?.name ?? b,
    config: state.config, boosts: state.boosts, boost,
    bests, refreshBests: () => setBestTick(n => n + 1),
    loggedIn: !!user, profile, progress,
    grantXp, showGains: g => applyGains(g), klang: (art, serie) => { if (soundOn) klangSpielen(art, serie) }, reloadProfile: () => setProfileTick(n => n + 1), setHidden, price, buyQuiz,
    popular, pins, isPinned: (kind, key) => pins.includes(`${kind}:${key}`), togglePin,
    words, isSaved: key => words.some(w => w.key === key), toggleWord,
  }), [popular, pins, togglePin, words, toggleWord, state, loaded, isAdmin, isTeam, preview, setPreview, status, catalog, bySlug, boost, bests, user, profile, progress, grantXp, applyGains, setHidden, price, buyQuiz, soundOn])

  /* ── Offenes Quiz fortsetzen? (einmal pro Sitzung, nicht auf der Quiz-Seite selbst) ── */
  const [resume, setResume] = useState<SaveState | null>(null)
  const [confirmDrop, setConfirmDrop] = useState(false)
  useEffect(() => {
    if (!loaded) return
    try { if (sessionStorage.getItem('geo-resume-asked')) return } catch { /* egal */ }
    let alive = true
    listAllSaves(!!user).then(saves => {
      if (!alive) return
      try { sessionStorage.setItem('geo-resume-asked', '1') } catch { /* egal */ }
      const s = saves.find(x => !pathname.startsWith('/geo/quiz/'))
      if (s && !pathname.startsWith('/geo/quiz/')) setResume(s)
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, user?.id])

  const resumeGo = () => {
    if (!resume) return
    const url = resume.href + (resume.href.includes('?') ? '&' : '?') + 'weiter=1'
    setResume(null)
    router.push(url)
  }
  const resumeSave = async () => {
    if (!resume) return
    const s = resume
    setResume(null)
    const answered = s.score.right + s.score.wrong
    if (answered > 0 && !s.onlyKeys) {
      const r = { slug: s.slug, mode: s.mode, variant: s.variant, total: s.total, right: s.score.right, wrong: s.score.wrong, seconds: s.elapsed, accuracy: Math.round((s.score.right / answered) * 100) }
      saveLocal(r)
      if (user) applyGains(await saveRemote(r))
      setBestTick(n => n + 1)
    }
    dropSave(s.slug, !!user)
    pushToast({ text: 'Ergebnis gespeichert', sub: s.title })
  }
  const resumeDrop = () => {
    if (!resume) return
    dropSave(resume.slug, !!user)
    setResume(null)
    setConfirmDrop(false)
  }

  const isActive = (href: string) => (href === '/geo' ? pathname === '/geo' : pathname === href || pathname.startsWith(href + '/'))
  const toggleSound = () => setMuted(m => {
    try { localStorage.setItem('geo-sound', m ? '1' : '0') } catch { /* egal */ }
    return !m
  })

  return (
    <Ctx.Provider value={value}>
      <div className="ga-shell">
        <aside className="ga-board" aria-label="Atlas-Bereiche">
          <Link href="/geo" className="ga-board-brand" aria-label="Atlas – Übersicht">
            <span className="ga-board-logo"><Icon name="globe" size={18} strokeWidth={1.7} /></span>
            <span>
              <b>Atlas</b>
              <small>Geografie · Quizzes</small>
            </span>
          </Link>

          {/* Level & XP */}
          {user ? (
            <Link href="/geo/rangliste" className="ga-xp" title={profile ? `${profile.xp.toLocaleString('de-DE')} XP gesamt` : undefined}>
              <span className="ga-xp-top">
                <span className="ga-xp-lvl">Level {profile?.level.level ?? 1}</span>
                {boost > 1 && <span className="ga-xp-boost">{fmtFactor(boost)}</span>}
              </span>
              <span className="ga-xp-bar"><span style={{ width: `${profile?.level.pct ?? 0}%` }} /></span>
              <span className="ga-xp-left">{profile ? `noch ${profile.level.left.toLocaleString('de-DE')} XP bis Level ${profile.level.level + 1}` : 'XP werden geladen …'}</span>
              {profile && <span className="ga-sterni-bal" title="Geo-Sternis – damit kannst du Quizzes freikaufen"><Icon name="star" size={13} /> {profile.sternis.toLocaleString('de-DE')} Geo-Sternis</span>}
            </Link>
          ) : (
            <Link href="/login" className="ga-xp guest">
              <span className="ga-xp-lvl">XP sammeln</span>
              <span className="ga-xp-left">Einloggen, um Level, XP und Ranglisten freizuschalten</span>
            </Link>
          )}

          <nav className="ga-board-links">
            {NAV.map(n => (
              <Link key={n.href} href={n.href} className={`${isActive(n.href) ? 'active' : ''} ${n.sep ? 'sep' : ''}`}>
                {n.bereich
                  ? <span className="dot" style={{ background: BEREICH_BY_KEY[n.bereich].color }} />
                  : <Icon name={n.icon!} size={15} />}
                {n.bereich ? (state.groups.find(g => g.kind === 'bereich' && g.key === n.bereich)?.title ?? n.label) : n.label}
              </Link>
            ))}
            {isTeam && (
              <Link href="/geo/admin" className={`${isActive('/geo/admin') ? 'active' : ''} sep`}>
                <Icon name="bolt" size={15} /> Geo-Admin
              </Link>
            )}
          </nav>
          <div className="ga-board-foot">
            <button className="ga-board-mini" onClick={toggleSound} title={muted ? 'Ton an' : 'Ton aus'} aria-pressed={!muted}>
              <Icon name={muted ? 'x' : 'bolt'} size={13} /> Ton {muted ? 'aus' : 'an'}
            </button>
          </div>
          {isAdmin && (
            <button
              className={`ga-board-preview ${preview ? 'on' : ''}`}
              onClick={() => setPreview(!preview)}
              title={preview ? 'Vorschau beenden (wieder alles sehen)' : 'Vorschau: Seite wie ein normaler Besucher sehen'}
              aria-pressed={preview}
            >
              <Icon name="eye" size={15} />
              <span>{preview ? 'Vorschau an' : 'Als Besucher ansehen'}</span>
            </button>
          )}
        </aside>
        <div className="ga-main">
          {isAdmin && preview && (
            <div className="ga-preview-banner">Vorschau-Modus: Du siehst /geo wie ein normaler Besucher. Gesperrte Quizzes sind zu.</div>
          )}
          {activeBoost && (
            <div className="ga-boost-banner" role="status">
              <span className="ga-boost-x">{fmtFactor(boost)} XP</span>
              <span className="ga-boost-txt"><b>{activeBoost.label}</b> läuft – alle XP zählen {fmtFactor(boost)}</span>
              <span className="ga-boost-time">noch {fmtLeft(Date.parse(activeBoost.endsAt) - now)}</span>
            </div>
          )}
          {nextBoost && (
            <div className="ga-boost-banner soon" role="status">
              <span className="ga-boost-x">{fmtFactor(nextBoost.factor)}</span>
              <span className="ga-boost-txt"><b>{nextBoost.label}</b> startet bald</span>
              <span className="ga-boost-time">in {fmtLeft(Date.parse(nextBoost.startsAt) - now)}</span>
            </div>
          )}
          {children}
        </div>
      </div>

      {/* "+XP" */}
      <div className="ga-toasts" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`ga-toast ${t.big ? 'big' : ''} ${t.sterni ? 'sterni' : ''}`}>
            <b>{t.text}</b>
            {t.sub && <span>{t.sub}</span>}
          </div>
        ))}
      </div>

      {/* Offenes Quiz */}
      {resume && (
        <div className="ga-modal-bg" role="dialog" aria-modal="true" aria-labelledby="ga-resume-t">
          <div className="ga-modal ga-card">
            <p className="ga-eyebrow">Nicht beendet</p>
            <h2 id="ga-resume-t" className="ga-h2" style={{ margin: '4px 0 8px' }}>{resume.title}</h2>
            <p className="ga-muted" style={{ margin: '0 0 16px' }}>
              {saveProgress(resume).done} von {saveProgress(resume).total} geschafft · {saveProgress(resume).accuracy} % richtig ·
              zuletzt {new Date(resume.savedAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </p>
            {!confirmDrop ? (
              <div className="ga-row ga-wrap">
                <button className="ga-btn primary" onClick={resumeGo}><Icon name="play" size={15} /> Fortsetzen</button>
                <button className="ga-btn" onClick={resumeSave}><Icon name="check" size={15} /> Ergebnis speichern</button>
                <button className="ga-btn ghost" onClick={() => setConfirmDrop(true)}><Icon name="x" size={15} /> Verwerfen</button>
              </div>
            ) : (
              <div>
                <p style={{ margin: '0 0 12px' }}><b>Bist du sicher?</b> Der Spielstand wird gelöscht und nicht gewertet.</p>
                <div className="ga-row ga-wrap">
                  <button className="ga-btn danger" onClick={resumeDrop}>Ja, verwerfen</button>
                  <button className="ga-btn ghost" onClick={() => setConfirmDrop(false)}>Abbrechen</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}