'use client'

// Lernkarten für den Bereich „Sprachen & Schriften“ (special: 'schrift').
// Daten: public/geo/items/schriften.json – je Deck eine Liste von Karten { key, c (Zeichen/Wort), a (Antwort), n (Hinweis), g (Gruppe), alt, flag, snd (Laute), say (Aussprache) }
// und unter "_meta" Gruppen, Tipps, Sprache, Schriftart, Ortsnamen (Ortsschild-Prüfung), Verwechsler-Gruppen (confuse) und Lernpfad (path).
// Sonderfall slug „meine-woerter“: die Karten kommen aus der Merkliste (Stern an Orten und Ländern in allen Quizzes).
//
// Spielarten:
//   Lernen (Tabelle zum Anhören) · Lernkartei (Heute fällig, 5 Fächer) · Lesen · Zeichen finden · Hören · Verwechsler · Eintippen
//   Ortsschild (Ortsname → Stadt, mit Lesehilfe) · Schreiben (Ortsname mit der Bildschirm-Tastatur in fremder Schrift)
//   Silben & Wörter (Lernpfad): Silben und Ortsnamen NUR aus Zeichen, die man schon gelernt hat (Lernkartei)
// Falsch beantwortete Karten kommen drei Karten später noch einmal. XP gibt es für jede neu richtige Karte (nicht für die Merkliste).
// Jede erste Antwort auf eine Karte landet in der Lernkartei (Konto oder Browser).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Icon from './Icon'
import Flag from './Flag'
import { useGeo } from './GeoShell'
import { SaveButton, SoundButton } from './ItemActions'
import { checkTyped } from '../_lib/text'
import { readBest, saveLocal, saveRemote, type Best, type QuizMode, type Variant } from '../_lib/results'
import { playSay, playSounds, speak, stopAudio, useVoices, canSay, type Say } from '../_lib/audio'
import { BOXES, BOX_DAYS, NEW_PER_DAY, SAFE_BOX, countNew, isDue, newToday, nextState, readLocal, writeLocal, type DeckState } from '../_lib/srs'
import type { SavedWord } from '../_lib/words'
import type { ModeKey } from '../_lib/xp'
import type { QuizDef } from '../_lib/types'

interface Card {
  key: string; c: string; a: string; n?: string; g: string; alt?: string[]; flag?: string; snd?: string[]; say?: Say; word?: SavedWord
  /** Bild statt Text (z.B. Ortsschild, Straßennummer) – Adresse unter /geo/… */
  img?: string
  /** Antworten, die als falsche Auswahl bevorzugt werden (leicht verwechselbare Länder) */
  near?: string[]
  /** Erzeugte Silbe (Lernpfad) – zählt nicht für Lernkartei und XP */
  syn?: boolean
}
interface Word { w: string; de: string; alt?: string[]; cc: string; flag: string; say?: Say }
interface DeckMeta {
  kind: 'letters' | 'words'
  groups: { k: string; name: string; text?: string }[]
  tips?: string[]
  lang?: string
  font?: string
  dir?: 'rtl'
  ask?: string
  askBack?: string
  noWrite?: boolean
  withFlags?: boolean
  promptFlag?: boolean
  big?: boolean
  words?: Word[]
  confuse?: string[][]
  path?: string[]
  /** Karten zeigen ein Bild (Schild) statt Text */
  imgDeck?: boolean
  /** Vorderseite hat mehrere Zeilen (z.B. drei Hinweise) */
  multiline?: boolean
}
type Deck = { cards: Card[]; meta: DeckMeta }
type Mode = 'learn' | 'kartei' | 'read' | 'write' | 'hear' | 'confuse' | 'type' | 'sign' | 'spell' | 'pfad'
type Ask = 'read' | 'write' | 'hear'
type Q =
  | { kind: 'card'; card: Card; ask: Ask; among?: string[]; fresh?: boolean; opts?: string[] }
  | { kind: 'word'; word: Word; ask: 'sign' | 'spell' }

const SPRINT_SECONDS = 120
const LIVES = 3
const MW = 'meine-woerter'
/** Spielarten mit Bestwerten → Schlüssel für Bestwerte und Adminpanel-Regeln */
const MODE_KEY: Partial<Record<Mode, QuizMode & ModeKey>> = { read: 'name', write: 'click', type: 'type', sign: 'text' }
/** Welche Adminpanel-Regel eine Spielart ohne eigenen Schlüssel erlaubt */
const RULE_OF: Record<Exclude<Mode, 'learn'>, ModeKey> = { kartei: 'name', read: 'name', write: 'click', hear: 'name', confuse: 'name', type: 'type', sign: 'text', spell: 'type', pfad: 'name' }

/**
 * Lernpfad „Silben & Wörter“: nur für Schriften, bei denen man Zeichen einfach aneinanderreihen kann.
 * alphabet = Konsonant + Vokal zu Silben verbinden (Kyrillisch, Griechisch, Georgisch, Armenisch)
 * silben   = jedes Zeichen ist schon eine Silbe → zwei Zeichen zu einem Kunstwort (Hiragana, Katakana, Inuktitut)
 * Nicht dabei: Hebräisch und Arabisch (Buchstaben verbinden sich, Vokale fehlen), Thai und Hangul (Zeichen werden zusammengesetzt).
 */
const PFAD: Record<string, 'alphabet' | 'silben'> = {
  kyrillisch: 'alphabet', griechisch: 'alphabet', georgisch: 'alphabet', armenisch: 'alphabet',
  hiragana: 'silben', katakana: 'silben', inuktitut: 'silben',
}
/** Mindestens so viele gelernte Zeichen, bevor es Silben gibt */
const PFAD_MIN = 4
/** Vokal? (nach der Umschrift der Karte: a, e, i, o, u, y, je, ja … ) */
const isVowel = (c: Card) => /^j?[aeiouyëäöüï]+$/i.test(c.a)
/** Umschrift, die man sinnvoll zusammensetzen kann (keine Namen wie „Härtezeichen“) */
const plainSound = (c: Card) => /^[a-zäöüëßʿ']{1,4}$/i.test(c.a)
/** Kleinbuchstabe einer Karte („Α α“ → „α“) */
const glyphOf = (c: Card) => c.c.split(/\s+/).at(-1) ?? c.c
/** Gilt als gelernt: in der Lernkartei mindestens einmal richtig und nicht öfter falsch als richtig */
const learnedState = (st?: { right: number; wrong: number }) => !!st && st.right >= 1 && st.right >= st.wrong

const fileCache = new Map<string, Promise<Record<string, unknown>>>()
/** Lernkarten-Datei laden (public/geo/items/<datei>.json – Standard: schriften) */
function loadDecks(file = 'schriften') {
  let p = fileCache.get(file)
  if (!p) {
    p = fetch(`/geo/items/${file}.json`).then(r => {
      if (!r.ok) throw new Error(`Lernkarten konnten nicht geladen werden (${r.status})`)
      return r.json()
    })
    p.catch(() => fileCache.delete(file))
    fileCache.set(file, p)
  }
  return p
}
/** Schrift von Google Fonts nachladen (nur für Zeichen, die viele Geräte nicht haben, z.B. Hieroglyphen) */
function useFont(family?: string) {
  useEffect(() => {
    if (!family) return
    const id = `ga-font-${family.replace(/\s+/g, '-')}`
    if (document.getElementById(id)) return
    const l = document.createElement('link')
    l.id = id
    l.rel = 'stylesheet'
    l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}&display=swap`
    document.head.appendChild(l)
  }, [family])
}
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`
const pickOne = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)]
/** Vergleich beim Schreiben: Groß/klein, Leerzeichen und Bindestriche egal */
const norm = (s: string) => s.normalize('NFC').toLocaleLowerCase().replace(/[\s\-‐–'’.]/g, '')
/** Ein Zeichen in eine Form bringen, die man in der Lesehilfe nachschlagen kann */
const charKeys = (ch: string) => [...new Set([ch, ch.toLocaleUpperCase(), ch.toLocaleLowerCase(), ch.normalize('NFD')[0]])]

/** Merkliste → Karten */
function deckFromWords(words: SavedWord[]): Deck {
  const groups = new Map<string, string>()
  const cards: Card[] = words.map(w => {
    groups.set(w.slug, w.quiz)
    return { key: `mw:${w.key.replace(/\s+/g, '_')}`, c: w.c, a: w.a || w.c, n: w.sub, g: w.slug, flag: w.flag, say: w.say, word: w }
  })
  return {
    cards,
    meta: {
      kind: 'words', withFlags: true, promptFlag: true, noWrite: cards.length < 2,
      ask: 'Was gehört dazu?', askBack: 'Welcher Name gehört dazu?',
      groups: [...groups].map(([k, name]) => ({ k, name })),
      tips: [
        'Mit dem Stern an jedem Ort und Land in allen Quizzes landet ein Eintrag hier.',
        'Die Lernkartei fragt jeden Tag nur das ab, was fällig ist – so bleibt es hängen.',
        'Anhören: echte Aufnahme, wenn es eine gibt – sonst die Stimme deines Geräts.',
      ],
    },
  }
}

export default function SchriftQuiz({ def, backHref, backLabel }: { def: QuizDef; backHref: string; backLabel: string }) {
  const { loggedIn, refreshBests, showGains, grantXp, modes: modesOf, config, difficulty, words: savedWords, bySlug, status } = useGeo()
  const slug = def.slug
  const isMw = slug === MW
  const [fileDeck, setFileDeck] = useState<Deck | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (isMw) return
    let alive = true
    loadDecks(def.itemsFile)
      .then(all => {
        if (!alive) return
        const cards = all[slug] as Card[] | undefined
        const meta = (all._meta as Record<string, DeckMeta>)?.[slug]
        if (!cards || !meta) setError('Lernkarten nicht gefunden')
        else setFileDeck({ cards, meta })
      })
      .catch(e => { if (alive) setError(String(e?.message || e)) })
    return () => { alive = false }
  }, [slug, isMw, def.itemsFile])
  const mwDeck = useMemo(() => (isMw ? deckFromWords(savedWords) : null), [isMw, savedWords])
  const deck = isMw ? mwDeck : fileDeck
  const meta = deck?.meta
  useFont(meta?.font)
  const glyphFont = meta?.font ? `'${meta.font}', system-ui, sans-serif` : undefined
  useVoices()

  /* ── Lernkartei-Stand (Konto oder Browser) ── */
  const [srs, setSrs] = useState<DeckState>({})
  const [srsTick, setSrsTick] = useState(0)
  useEffect(() => {
    let alive = true
    if (loggedIn) {
      fetch(`/api/geo/srs?deck=${slug}`, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(d => { if (alive && d?.cards) setSrs(d.cards) }).catch(() => {})
    } else setSrs(readLocal()[slug] ?? {})
    return () => { alive = false }
  }, [slug, loggedIn, srsTick])
  const record = useCallback((key: string, ok: boolean, fresh: boolean) => {
    setSrs(prev => {
      const next = { ...prev, [key]: nextState(prev[key], ok) }
      if (!loggedIn) { const all = readLocal(); all[slug] = next; writeLocal(all) }
      return next
    })
    if (fresh) countNew(slug)
    if (loggedIn) {
      fetch('/api/geo/srs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deck: slug, key, ok }) }).catch(() => {})
    }
  }, [loggedIn, slug])
  const srsInfo = useMemo(() => {
    const cards = deck?.cards ?? []
    const boxes = Array.from({ length: BOXES }, () => 0)
    let due = 0, unseen = 0
    const now = Date.now()
    for (const c of cards) {
      const s = srs[c.key]
      if (!s) { unseen++; continue }
      boxes[Math.max(1, Math.min(BOXES, s.box)) - 1]++
      if (isDue(s, now)) due++
    }
    const newLeft = Math.min(unseen, Math.max(0, NEW_PER_DAY - (typeof window === 'undefined' ? 0 : newToday(slug))))
    return { boxes, due, unseen, newLeft, safe: boxes.slice(SAFE_BOX - 1).reduce((a, b) => a + b, 0) }
  }, [deck, srs, slug])

  /* ── Lesehilfe: Zeichen → Laut (aus den Karten des Decks) ── */
  const reader = useMemo(() => {
    const m = new Map<string, Card>()
    if (meta?.kind !== 'letters') return m
    for (const c of deck!.cards) for (const part of c.c.split(/\s+/)) if ([...part].length <= 2) for (const k of charKeys(part)) if (!m.has(k)) m.set(k, c)
    return m
  }, [deck, meta])

  /* ── Spielarten ── */
  const allowed = modesOf(def)
  const hasHear = !!deck?.cards.some(c => c.snd?.length || canSay(c.say))
  const hasSpell = meta?.kind === 'letters' && !!meta.words?.length && !meta.dir
  const available: [Mode, string, string][] = useMemo(() => {
    if (!meta || !deck?.cards.length) return []
    const out: [Mode, string, string][] = [['learn', 'book', 'Lernen'], ['kartei', 'cards', 'Lernkartei']]
    out.push(['read', 'target', meta.kind === 'letters' ? 'Lesen' : 'Erkennen'])
    if (!meta.noWrite) out.push(['write', 'pointer', meta.kind === 'letters' ? 'Zeichen finden' : 'Umgekehrt'])
    if (hasHear) out.push(['hear', 'ear', 'Hören'])
    if (meta.confuse?.length) out.push(['confuse', 'shuffle', 'Verwechsler'])
    if (meta.kind === 'letters' && !meta.noWrite) out.push(['type', 'keyboard', 'Eintippen'])
    if (meta.words?.length) out.push(['sign', 'flag', 'Ortsschild'])
    if (hasSpell) out.push(['spell', 'type', 'Schreiben'])
    if (PFAD[slug] && meta.kind === 'letters') out.push(['pfad', 'sparkle', 'Silben & Wörter'])
    return out.filter(([m]) => m === 'learn' || allowed[RULE_OF[m]])
  }, [meta, deck, allowed, hasHear, hasSpell, slug])

  const [mode, setMode] = useState<Mode>('learn')
  const [variant, setVariant] = useState<Variant>('normal')
  const [group, setGroup] = useState<string | null>(null)
  const pool = useMemo(() => (deck ? deck.cards.filter(c => !group || c.g === group) : []), [deck, group])
  const scored = !!MODE_KEY[mode] && !isMw

  /* ── Spielzustand ── */
  const [queue, setQueue] = useState<Q[]>([])
  const [total, setTotal] = useState(0)
  const [score, setScore] = useState({ right: 0, wrong: 0, streak: 0, best: 0 })
  const [missed, setMissed] = useState<Set<string>>(new Set())
  const [picked, setPicked] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const [lives, setLives] = useState(LIVES)
  const [startedAt, setStartedAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const [finished, setFinished] = useState<{ newBest: boolean; seconds: number } | null>(null)
  const [best, setBest] = useState<Best | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const nextTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ── Lernpfad: was kann man mit den gelernten Zeichen schon lesen? ── */
  const pfad = useMemo(() => {
    const art = PFAD[slug]
    if (!art || !deck || meta?.kind !== 'letters') return null
    const learned = deck.cards.filter(c => learnedState(srs[c.key]) && plainSound(c))
    const learnedKeys = new Set(deck.cards.filter(c => learnedState(srs[c.key])).map(c => c.key))
    const vowels = learned.filter(isVowel), cons = learned.filter(c => !isVowel(c))
    // Silben aus den gelernten Zeichen
    const syl: Card[] = []
    if (art === 'alphabet') {
      for (const k of cons) for (const v of vowels) {
        const a = k.a + (v.a === 'je' ? 'e' : v.a)
        syl.push({ key: `syl:${k.key}+${v.key}`, c: glyphOf(k) + glyphOf(v), a, g: 'silbe', n: `${glyphOf(k)} = ${k.a} · ${glyphOf(v)} = ${v.a}`, syn: true, say: meta.lang ? { t: glyphOf(k) + glyphOf(v), l: meta.lang } : undefined })
      }
    } else {
      for (const x of learned) for (const y of learned) {
        if (x.key === y.key) continue
        syl.push({ key: `syl:${x.key}+${y.key}`, c: glyphOf(x) + glyphOf(y), a: x.a + y.a, g: 'silbe', n: `${glyphOf(x)} = ${x.a} · ${glyphOf(y)} = ${y.a}`, syn: true, say: meta.lang ? { t: glyphOf(x) + glyphOf(y), l: meta.lang } : undefined })
      }
    }
    // Ortsnamen, deren Zeichen alle schon gelernt sind
    const readable = (w: string) => {
      const chars = [...w].filter(ch => /\p{L}/u.test(ch))
      return chars.length > 0 && chars.every(ch => { const c = charKeys(ch).map(k => reader.get(k)).find(Boolean); return !!c && learnedKeys.has(c.key) })
    }
    const words = (meta.words ?? []).filter(w => readable(w.w))
    const sylOk = art === 'alphabet' ? learned.length >= PFAD_MIN && vowels.length > 0 && cons.length > 0 : learned.length >= PFAD_MIN
    return { art, learned: learnedKeys.size, total: deck.cards.length, syl: sylOk ? syl : [], words, allWords: meta.words?.length ?? 0 }
  }, [slug, deck, meta, srs, reader])

  /** Welche Fragearten eine Karte in der Lernkartei bekommen kann */
  const asksFor = useCallback((c: Card): Ask[] => {
    const out: Ask[] = ['read']
    if (!meta?.noWrite) out.push('write')
    if (c.snd?.length || (c.say && canSay(c.say))) out.push('hear')
    return out
  }, [meta])

  const start = useCallback((m: Mode, only?: string[]) => {
    if (nextTimer.current) clearTimeout(nextTimer.current)
    stopAudio()
    setMode(m)
    setPicked(null)
    setTyped('')
    setScore({ right: 0, wrong: 0, streak: 0, best: 0 })
    setMissed(new Set())
    setLives(LIVES)
    setFinished(null)
    setStartedAt(Date.now())
    if (m === 'learn' || !deck) { setQueue([]); setTotal(0); return }
    let q: Q[]
    if (m === 'pfad') {
      // Erst Silben, dann Ortsnamen – alles nur aus schon gelernten Zeichen
      const syl = shuffle(pfad?.syl ?? []).slice(0, 10)
      const sylQ: Q[] = syl.map(card => {
        const others = shuffle((pfad?.syl ?? []).filter(o => o.a !== card.a)).map(o => o.a)
        return { kind: 'card' as const, card, ask: 'read' as Ask, opts: shuffle([card.a, ...[...new Set(others)].slice(0, 3)]) }
      })
      const wordQ: Q[] = shuffle(pfad?.words ?? []).slice(0, 10).map(word => ({ kind: 'word' as const, word, ask: 'sign' as const }))
      q = [...sylQ, ...wordQ]
    } else if (m === 'sign' || m === 'spell') {
      q = shuffle(deck.meta.words ?? []).map(word => ({ kind: 'word' as const, word, ask: m }))
    } else if (m === 'kartei') {
      const t = Date.now()
      const src = pool
      const due = src.filter(c => isDue(srs[c.key], t)).sort((a, b) => Date.parse(srs[a.key].due) - Date.parse(srs[b.key].due))
      const fresh = src.filter(c => !srs[c.key]).slice(0, Math.max(0, NEW_PER_DAY - newToday(slug)))
      q = [...shuffle(due).map(card => ({ kind: 'card' as const, card, ask: pickOne(asksFor(card)) })),
        ...fresh.map(card => ({ kind: 'card' as const, card, ask: 'read' as Ask, fresh: true }))]
    } else if (m === 'confuse') {
      const sets = (deck.meta.confuse ?? []).map(s => s.filter(k => deck.cards.some(c => c.key === k))).filter(s => s.length >= 2)
      const inGroup = group ? sets.filter(s => s.some(k => deck.cards.find(c => c.key === k)?.g === group)) : sets
      q = shuffle(inGroup.flatMap(s => s.map(k => ({ kind: 'card' as const, card: deck.cards.find(c => c.key === k)!, ask: (Math.random() < 0.5 || deck.meta.noWrite ? 'read' : 'write') as Ask, among: s }))))
    } else {
      const ask: Ask = m === 'write' ? 'write' : m === 'hear' ? 'hear' : 'read'
      const src = pool.filter(c => !only || only.includes(c.key)).filter(c => m !== 'hear' || c.snd?.length || canSay(c.say))
      q = shuffle(src).map(card => ({ kind: 'card' as const, card, ask }))
    }
    setQueue(q)
    setTotal(q.length)
  }, [deck, pool, srs, slug, group, asksFor, pfad])
  // Gruppe gewechselt → laufende Runde neu mit der Auswahl
  useEffect(() => { if (mode !== 'learn') start(mode) }, [group]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const k = MODE_KEY[mode]; if (k && !isMw) setBest(readBest(slug, k, variant)); else setBest(null) }, [slug, mode, variant, finished, isMw])
  useEffect(() => {
    if (variant !== 'sprint' || mode === 'learn' || mode === 'kartei' || finished) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [variant, mode, finished])

  const current = queue[0]
  const timed = variant === 'sprint' && mode !== 'kartei'
  const timeLeft = timed ? Math.max(0, SPRINT_SECONDS - Math.floor((now - startedAt) / 1000)) : null
  const over = mode !== 'learn' && total > 0 && (queue.length === 0 || (variant === 'leben' && mode !== 'kartei' && lives <= 0) || timeLeft === 0)

  // Hören: Ton gleich beim Erscheinen der Karte abspielen
  const playCard = useCallback((c: Card) => {
    if (c.snd?.length) playSounds(c.snd)
    else if (c.say) playSay(c.say)
    else if (meta?.lang) speak(c.c.split(' ')[0], meta.lang)
  }, [meta])
  useEffect(() => {
    if (current?.kind === 'card' && current.ask === 'hear' && !picked) { const t = setTimeout(() => playCard(current.card), 250); return () => clearTimeout(t) }
  }, [current, picked, playCard])

  // Ergebnis speichern (nur Spielarten mit Bestwert)
  useEffect(() => {
    if (!over || finished) return
    const seconds = Math.round((Date.now() - startedAt) / 1000)
    const key = MODE_KEY[mode]
    if (!key || isMw) { setFinished({ newBest: false, seconds }); return }
    const answered = score.right + score.wrong
    const result = {
      slug, mode: key, variant, total, right: score.right, wrong: score.wrong, seconds,
      accuracy: variant === 'sprint' ? Math.round((score.right / Math.max(1, answered)) * 100) : Math.round((score.right / Math.max(1, total)) * 100),
    }
    const newBest = saveLocal(result)
    setFinished({ newBest, seconds })
    if (loggedIn) saveRemote(result).then(g => { showGains(g); refreshBests() })
    else if (newBest) refreshBests()
  }, [over, finished, mode, startedAt, score, slug, variant, total, loggedIn, refreshBests, showGains, isMw])

  /* ── Frage und Antworten ── */
  const answerOf = (q: Q) => (q.kind === 'word' ? (q.ask === 'spell' ? q.word.w : q.word.de) : q.ask === 'read' ? q.card.a : q.card.c)
  const promptOf = (q: Q) => (q.kind === 'word' ? (q.ask === 'spell' ? q.word.de : q.word.w) : q.ask === 'write' ? q.card.a : q.card.c)
  const optKind: 'glyph' | 'answer' = current?.kind === 'card' && current.ask !== 'read' ? 'glyph' : 'answer'
  const options = useMemo(() => {
    if (!current || !deck || mode === 'type' || current.kind === 'word' && current.ask === 'spell') return []
    const right = answerOf(current)
    if (current.kind === 'card' && current.opts) return current.opts
    let others: string[]
    if (current.kind === 'word') {
      // Ortsschild: andere Städte, möglichst aus demselben Land
      const same = (deck.meta.words ?? []).filter(w => w.de !== right)
      const near = same.filter(w => w.cc === current.word.cc)
      others = shuffle(near.length >= 3 ? near : same).map(w => w.de)
    } else {
      const card = current.card
      const glyph = current.ask !== 'read'
      const sameAnswer = new Set(deck.cards.filter(c => c.a === card.a).map(c => c.c))
      const sameSound = (c: Card) => current.ask === 'hear' && !!card.snd && !!c.snd && c.snd.join() === card.snd.join()
      let cands = glyph
        ? deck.cards.filter(c => !sameAnswer.has(c.c) && c.a !== card.a && !sameSound(c))
        : deck.cards.filter(c => c.a !== right)
      if (!glyph && card.near?.length) {
        // Leicht verwechselbare Länder zuerst
        const near = new Set(card.near)
        const firstOfEach = (cs: Card[]) => [...new Map(cs.map(c => [c.a, c])).values()]
        cands = [...shuffle(firstOfEach(cands.filter(c => near.has(c.a)))), ...shuffle(cands.filter(c => !near.has(c.a) && c.g === card.g)), ...shuffle(cands.filter(c => !near.has(c.a) && c.g !== card.g))]
      } else if (current.among) {
        // Verwechsler: zuerst die Karten aus derselben Verwechsler-Gruppe
        const set = new Set(current.among)
        cands = [...shuffle(cands.filter(c => set.has(c.key))), ...shuffle(cands.filter(c => !set.has(c.key) && c.g === card.g))]
      } else {
        // Bevorzugt aus derselben Gruppe – so wird es knifflig (В/Б, ж/ш …)
        cands = [...shuffle(cands.filter(c => c.g === card.g)), ...shuffle(cands.filter(c => c.g !== card.g))]
      }
      others = cands.map(c => (glyph ? c.c : c.a))
    }
    const uniq = [...new Set(others)].filter(o => o !== right).slice(0, 3)
    return shuffle([right, ...uniq])
  }, [current, mode, deck]) // eslint-disable-line react-hooks/exhaustive-deps
  const flagOfAnswer = useMemo(() => {
    const m: Record<string, string> = {}
    if (deck?.meta.withFlags) for (const c of deck.cards) if (c.flag) m[c.a] = c.flag
    return m
  }, [deck])

  // Bildschirm-Tastatur: Zeichen des Ortsnamens + einige andere aus der Schrift
  const keyboard = useMemo(() => {
    if (current?.kind !== 'word' || current.ask !== 'spell') return []
    const lower = (s: string) => [...s.toLocaleLowerCase()].filter(ch => ch.trim() && !/[-‐–'’.]/.test(ch))
    const own = [...new Set(lower(current.word.w))]
    const rest = shuffle([...new Set((meta?.words ?? []).flatMap(w => lower(w.w)))].filter(ch => !own.includes(ch))).slice(0, Math.max(6, 18 - own.length))
    return shuffle([...own, ...rest])
  }, [current, meta])

  function advance(wasRight: boolean) {
    stopAudio()
    setQueue(q => {
      const [head, ...rest] = q
      if (wasRight || !head) return rest
      // Falsch: drei Karten später noch einmal (nur einmal wiederholen)
      const k = head.kind === 'word' ? head.word.w : head.card.key
      if (missed.has(k)) return rest
      const at = Math.min(3, rest.length)
      return [...rest.slice(0, at), head, ...rest.slice(at)]
    })
    setPicked(null)
    setTyped('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }
  function answer(given: string, ok: boolean) {
    if (!current || picked !== null) return
    setPicked(given)
    const k = current.kind === 'word' ? current.word.w : current.card.key
    const firstTry = !missed.has(k)
    if (current.kind === 'card' && firstTry && !current.card.syn) record(current.card.key, ok, !!current.fresh)
    if (ok) {
      setScore(s => ({ right: s.right + (firstTry ? 1 : 0), wrong: s.wrong, streak: s.streak + 1, best: Math.max(s.best, s.streak + 1) }))
      if (firstTry && current.kind === 'card' && !current.card.syn && loggedIn && !isMw) grantXp([slug], current.card.key, deck?.cards.length ?? total)
      if (current.kind === 'card' && current.card.syn && current.card.say && canSay(current.card.say)) playSay(current.card.say)
      if (current.kind === 'card' && current.ask !== 'hear' && meta?.kind === 'letters' && current.card.snd?.length) playSounds(current.card.snd)
      if (current.kind === 'word' && current.word.say) playSay(current.word.say)
      // Ortsnamen: kein automatisches Weiter – Zeit für Lesehilfe und Aussprache
      if (current.kind === 'card') nextTimer.current = setTimeout(() => advance(true), 800)
    } else {
      setScore(s => ({ ...s, wrong: s.wrong + (firstTry ? 1 : 0), streak: 0 }))
      if (firstTry) setMissed(m => new Set(m).add(k))
      if (variant === 'leben' && mode !== 'kartei') setLives(l => l - 1)
    }
  }
  const pick = (o: string) => current && answer(o, o === answerOf(current))
  function submitTyped(e: React.FormEvent) {
    e.preventDefault()
    if (!current || picked !== null || !typed.trim()) return
    if (current.kind === 'word') { answer(typed, norm(typed) === norm(current.word.w)); return }
    const r = checkTyped(typed, [current.card.a, ...(current.card.alt ?? [])])
    answer(typed, r === 'exact' || r === 'close')
  }
  /** Schreiben: nächsten richtigen Buchstaben verraten (zählt als Fehler) */
  function hint() {
    if (current?.kind !== 'word') return
    const target = [...current.word.w]
    let i = 0
    const got = [...typed]
    while (i < got.length && i < target.length && norm(got[i]) === norm(target[i])) i++
    let next = target.slice(0, i + 1).join('')
    while (next.length < target.length && !target[next.length - 1].trim()) next = target.slice(0, next.length + 1).join('')
    setTyped(next)
    if (!missed.has(current.word.w)) { setMissed(m => new Set(m).add(current.word.w)); setScore(s => ({ ...s, wrong: s.wrong + 1, streak: 0 })) }
  }

  // Tastatur: 1–4 wählen, Enter = weiter, Leertaste = nochmal hören
  useEffect(() => {
    if (mode === 'learn') return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (picked !== null && e.key === 'Enter') { advance(isRight); return }
      if (e.key === ' ' && current?.kind === 'card' && current.ask === 'hear') { e.preventDefault(); playCard(current.card); return }
      const i = Number(e.key) - 1
      if (picked === null && i >= 0 && i < options.length) pick(options[i])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  /* ── Darstellung ── */
  const diff = difficulty(def)
  const done = total - queue.length
  const progress = timed ? ((SPRINT_SECONDS - (timeLeft ?? 0)) / SPRINT_SECONDS) * 100 : total ? (done / total) * 100 : 0
  const groupName = (k: string) => meta?.groups.find(g => g.k === k)?.name ?? k
  const isRight = picked !== null && !!current && (current.kind === 'word' && current.ask === 'spell' ? norm(picked) === norm(current.word.w) : current.kind === 'card' && mode === 'type' ? checkTyped(picked, [current.card.a, ...(current.card.alt ?? [])]) !== 'wrong' : picked === answerOf(current))
  const isWordDeck = meta?.kind === 'words'
  const noun = isWordDeck ? 'Karten' : 'Zeichen'
  const subtitle = !deck ? (error || 'Lädt …')
    : !deck.cards.length ? 'Noch keine gemerkten Einträge'
    : mode === 'learn' ? `${pool.length} ${noun}${group ? ` · ${groupName(group)}` : ''} – tippe eine Karte an${hasHear ? ' zum Anhören' : ''}`
    : mode === 'kartei' ? `Lernkartei · ${done} von ${total}`
    : timed ? `${score.right} richtig · noch ${fmtTime(timeLeft ?? 0)}${best ? ` · Bestwert ${best.right}` : ''}`
    : `${done} von ${total} geschafft${best ? ` · Bestwert ${best.accuracy} %` : ''}`
  const pathEntries = (meta?.path ?? []).map(s => bySlug[s]).filter(Boolean)

  /** Lesehilfe: Ortsname Zeichen für Zeichen */
  const lesehilfe = (text: string) => {
    if (!reader.size) return null
    const chars = [...text]
    if (!chars.some(ch => charKeys(ch).some(k => reader.has(k)))) return null
    return (
      <div className="ga-sc-reader" dir="ltr" aria-label="Lesehilfe: Zeichen für Zeichen">
        {chars.map((ch, i) => {
          const c = charKeys(ch).map(k => reader.get(k)).find(Boolean)
          if (!ch.trim()) return <span key={i} className="ga-sc-gap" />
          return (
            <button key={i} type="button" className={`ga-sc-rchar ${c ? '' : 'none'}`} disabled={!c?.snd?.length} title={c?.n}
              onClick={() => c?.snd?.length && playSounds(c.snd)}>
              <b style={{ fontFamily: glyphFont }}>{ch}</b>
              <span>{c ? c.a : '·'}</span>
            </button>
          )
        })}
      </div>
    )
  }

  /** Fächer der Lernkartei als kleine Balken */
  const faecher = () => {
    const max = Math.max(1, ...srsInfo.boxes, srsInfo.unseen)
    return (
      <div className="ga-srs-boxes" aria-label="Fächer der Lernkartei">
        <div className="ga-srs-box new" title="Noch nie geübt"><i style={{ height: `${(srsInfo.unseen / max) * 100}%` }} /><b>{srsInfo.unseen}</b><span>neu</span></div>
        {srsInfo.boxes.map((n, i) => (
          <div key={i} className={`ga-srs-box ${i + 1 >= SAFE_BOX ? 'safe' : ''}`} title={`Fach ${i + 1}: nach einer richtigen Antwort wieder dran in ${BOX_DAYS[i + 1]} ${BOX_DAYS[i + 1] === 1 ? 'Tag' : 'Tagen'}`}>
            <i style={{ height: `${(n / max) * 100}%` }} /><b>{n}</b><span>Fach {i + 1}</span>
          </div>
        ))}
      </div>
    )
  }

  const askText = (q: Q) => {
    if (q.kind === 'word') return q.ask === 'spell' ? 'Schreib den Ortsnamen in der Landesschrift' : 'Welche Stadt steht auf dem Schild?'
    if (q.ask === 'hear') return isWordDeck ? 'Was hörst du?' : 'Welches Zeichen hörst du?'
    if (q.ask === 'write') return meta!.askBack ?? 'Welches Zeichen ist das?'
    if (mode === 'type') return 'Tippe den Laut ein'
    if (q.card.syn) return 'Wie liest man diese Silbe?'
    return meta!.ask ?? 'Was ist das?'
  }

  return (
    <div className="ga-page" style={{ paddingTop: 18 }}>
      <div className="ga-quiz-head">
        <div style={{ minWidth: 0 }}>
          <Link href={backHref} className="ga-btn ghost sm" style={{ marginLeft: -10 }}><Icon name="back" size={15} /> {backLabel}</Link>
          <h1 className="ga-quiz-title">{def.title}</h1>
          <p className="ga-quiz-sub">
            <span className="ga-diff" style={{ '--ga-diff': config.difficulties[diff].color } as React.CSSProperties}>{config.difficulties[diff].label}</span>
            {subtitle}
          </p>
        </div>
        {mode !== 'learn' && (
          <div className="ga-row ga-wrap">
            {mode !== 'kartei' && (
              <div className="ga-seg" role="group" aria-label="Spielart">
                {([['normal', 'flag', 'Normal'], ['sprint', 'timer', `Sprint ${SPRINT_SECONDS / 60} Min.`], ['leben', 'heart', `${LIVES} Leben`]] as [Variant, string, string][])
                  .filter(([v]) => v === 'normal' || allowed[v as ModeKey])
                  .map(([v, icon, label]) => <button key={v} className={variant === v ? 'active' : ''} onClick={() => { setVariant(v); start(mode) }}><Icon name={icon} size={14} /> {label}</button>)}
              </div>
            )}
            <button className="ga-icon-btn" aria-label="Neu starten" title="Neu starten" onClick={() => start(mode)}><Icon name="refresh" size={17} /></button>
          </div>
        )}
      </div>

      {pathEntries.length > 0 && (
        <nav className="ga-sc-path" aria-label="Lernpfad">
          <span className="ga-sc-step on"><b>1</b> {def.title}</span>
          {pathEntries.map((e, i) => {
            const st = status(e)
            return st.open
              ? <Link key={e.slug} href={`/geo/quiz/${e.slug}`} className="ga-sc-step"><b>{i + 2}</b> {e.title}</Link>
              : <span key={e.slug} className="ga-sc-step locked" title="Noch gesperrt"><b>{i + 2}</b> <Icon name="lock" size={12} /> {e.title}</span>
          })}
        </nav>
      )}

      <div className="ga-toolbar">
        <div className="ga-chips">
          {available.map(([m, icon, label]) => (
            <button key={m} className={`ga-chip ${mode === m ? 'active' : ''}`} onClick={() => start(m)}>
              <Icon name={icon} size={15} /> {label}
              {m === 'kartei' && srsInfo.due + srsInfo.newLeft > 0 && <span className="ga-chip-count">{srsInfo.due + srsInfo.newLeft}</span>}
            </button>
          ))}
        </div>
      </div>
      {mode !== 'learn' && <div className="ga-progress"><span style={{ width: `${progress}%` }} /></div>}

      {meta && meta.groups.length > 1 && mode !== 'sign' && mode !== 'spell' && (
        <div className="ga-chips" style={{ margin: '12px 0 4px' }}>
          <button className={`ga-chip sm ${!group ? 'active' : ''}`} onClick={() => setGroup(null)}>Alle</button>
          {meta.groups.map(g => <button key={g.k} className={`ga-chip sm ${group === g.k ? 'active' : ''}`} onClick={() => setGroup(g.k)} title={g.text}>{g.name}</button>)}
        </div>
      )}

      {!deck ? (
        <div className="ga-map-loading">{error ? <><Icon name="info" /> {error}</> : 'Lädt …'}</div>
      ) : !deck.cards.length ? (
        <div className="ga-card ga-result" style={{ maxWidth: 560, margin: '24px auto' }}>
          <div className="ga-locked-icon"><Icon name="star" size={28} /></div>
          <p className="ga-eyebrow">Merkliste leer</p>
          <p className="ga-lead" style={{ margin: '6px auto 14px' }}>
            In jedem Quiz siehst du nach einer Antwort den Stern <b>Merken</b>. Gemerkte Orte, Länder und Wörter landen hier –
            mit Aussprache zum Anhören und eigener Lernkartei.
          </p>
          {!loggedIn && <p className="ga-muted" style={{ fontSize: 12.5 }}>Ohne Konto bleibt die Merkliste in diesem Browser. Nach dem Anmelden wird sie ins Konto übernommen.</p>}
          <Link href={backHref} className="ga-btn primary"><Icon name="back" size={15} /> {backLabel}</Link>
        </div>
      ) : mode === 'learn' ? (
        <div className="ga-sc-learn">
          <div className="ga-sc-groups">
            {meta!.groups.filter(g => !group || g.k === group).map(g => {
              const cards = deck.cards.filter(c => c.g === g.k)
              if (!cards.length) return null
              return (
                <section key={g.k} className="ga-card ga-sc-group">
                  <div className="ga-row ga-wrap" style={{ justifyContent: 'space-between' }}>
                    <div>
                      <h3 className="ga-h3">{g.name}</h3>
                      {g.text && <p className="ga-muted" style={{ fontSize: 13, margin: '2px 0 0' }}>{g.text}</p>}
                    </div>
                    {available.some(([m]) => m === 'read') && (
                      <button className="ga-btn sm" onClick={() => { setGroup(g.k); start('read') }}><Icon name="play" size={14} /> Diese Gruppe üben</button>
                    )}
                  </div>
                  <div className={`ga-sc-grid ${isWordDeck ? 'words' : ''}`}>
                    {cards.map(c => {
                      const s = srs[c.key]
                      return (
                        <div key={c.key} className={`ga-sc-card ${s ? `box${s.box}` : ''}`} role="button" tabIndex={0}
                          onClick={() => playCard(c)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); playCard(c) } }}
                          title={c.snd?.length || c.say ? 'Anhören' : undefined}>
                          {c.flag && meta!.withFlags && <Flag code={c.flag} size="sm" />}
                          {c.img
                            ? <img src={c.img} alt={c.c} className="ga-sc-card-img" loading="lazy" />
                            : <b dir={meta!.dir ?? 'auto'} style={{ fontFamily: glyphFont }} className={`${meta!.big ? 'big' : ''} ${meta!.multiline ? 'multi' : ''}`}>{c.c}</b>}
                          <span>{c.a}</span>
                          {c.n && <small>{c.n}</small>}
                          {(c.snd?.length || c.say) && <Icon name="volume" size={12} className="ga-sc-card-snd" />}
                          {c.word && <span className="ga-sc-card-act"><SaveButton word={c.word} small /></span>}
                          {s && <i className="ga-sc-card-box" title={`Lernkartei: Fach ${s.box}`}>{s.box}</i>}
                        </div>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
          <aside className="ga-side">
            <div className="ga-card ga-tip">
              <p className="ga-eyebrow">Lernkartei</p>
              {faecher()}
              <p className="ga-muted" style={{ fontSize: 13, margin: '8px 0 10px' }}>
                {srsInfo.due + srsInfo.newLeft > 0
                  ? <>Heute dran: <b>{srsInfo.due}</b> fällig{srsInfo.newLeft > 0 && <> + <b>{srsInfo.newLeft}</b> neue</>}.</>
                  : srsInfo.unseen === 0 && srsInfo.due === 0 ? 'Für heute alles geschafft – morgen geht es weiter.' : 'Für heute alles geschafft.'}
                {' '}{srsInfo.safe} von {deck.cards.length} sitzen schon sicher.
              </p>
              {available.some(([m]) => m === 'kartei') && (
                <button className="ga-btn primary sm" disabled={srsInfo.due + srsInfo.newLeft === 0} onClick={() => start('kartei')}><Icon name="cards" size={14} /> Heute üben</button>
              )}
              <p className="ga-muted" style={{ fontSize: 11.5, margin: '8px 0 0' }}>
                Richtig = ein Fach weiter (wieder dran nach 1, 3, 7, 14, 30 Tagen), falsch = zurück in Fach 1. {loggedIn ? 'Gespeichert in deinem Konto.' : 'Gespeichert in diesem Browser – mit Konto auf allen Geräten.'}
              </p>
            </div>
            {pfad && available.some(([m]) => m === 'pfad') && (
              <div className="ga-card ga-tip ga-sc-pfad">
                <p className="ga-eyebrow">Lernpfad</p>
                <ol className="ga-sc-pfad-steps">
                  <li className={pfad.learned >= PFAD_MIN ? 'done' : 'now'}>
                    <b>Zeichen lernen</b>
                    <span>{pfad.learned} von {pfad.total} gelernt</span>
                    <span className="ga-sc-pfad-bar"><i style={{ width: `${Math.min(100, (pfad.learned / Math.max(1, pfad.total)) * 100)}%` }} /></span>
                  </li>
                  <li className={pfad.syl.length ? 'done' : pfad.learned >= PFAD_MIN ? 'now' : ''}>
                    <b>{pfad.art === 'alphabet' ? 'Silben lesen' : 'Zwei Zeichen zusammen lesen'}</b>
                    <span>{pfad.syl.length ? `${pfad.syl.length} Silben möglich` : `ab ${PFAD_MIN} gelernten Zeichen${pfad.art === 'alphabet' ? ' mit Vokal' : ''}`}</span>
                  </li>
                  {pfad.allWords > 0 && (
                    <li className={pfad.words.length ? 'done' : ''}>
                      <b>Ortsnamen lesen</b>
                      <span>{pfad.words.length} von {pfad.allWords} kannst du schon lesen</span>
                      {pfad.words.length > 0 && (
                        <span className="ga-sc-pfad-words">{pfad.words.slice(0, 8).map(w => <i key={w.w} dir="auto" style={{ fontFamily: glyphFont }} title={w.de}>{w.w}</i>)}{pfad.words.length > 8 && <i>…</i>}</span>
                      )}
                    </li>
                  )}
                </ol>
                <button className="ga-btn primary sm" disabled={!pfad.syl.length && !pfad.words.length} onClick={() => start('pfad')}><Icon name="sparkle" size={14} /> Silben & Wörter üben</button>
                <p className="ga-muted" style={{ fontSize: 11.5, margin: '8px 0 0' }}>„Gelernt“ heißt: in einer Übung oder der Lernkartei mindestens so oft richtig wie falsch.</p>
              </div>
            )}
            {meta!.tips && meta!.tips.length > 0 && (
              <div className="ga-card ga-tip">
                <p className="ga-eyebrow">Lerntipps</p>
                <ul className="ga-sc-tips">{meta!.tips.map(t => <li key={t}>{t}</li>)}</ul>
              </div>
            )}
            {!isMw && (
              <div className="ga-card ga-tip">
                <p className="ga-eyebrow">So lernst du am besten</p>
                <ol className="ga-sc-tips">
                  <li>Erst eine Gruppe ansehen{hasHear ? ' und anhören (Karte antippen)' : ''}.</li>
                  <li>„Diese Gruppe üben“ – falsche Karten kommen gleich nochmal.</li>
                  {available.some(([m]) => m === 'hear') && <li>„Hören“: Laut hören, Zeichen finden.</li>}
                  {available.some(([m]) => m === 'confuse') && <li>„Verwechsler“: Zeichen, die sich ähnlich sehen, direkt gegeneinander.</li>}
                  {available.some(([m]) => m === 'sign') && <li>Ortsschild-Prüfung mit echten Ortsnamen – mit Lesehilfe.</li>}
                  {available.some(([m]) => m === 'spell') && <li>„Schreiben“: Ortsnamen selbst in der Schrift zusammensetzen.</li>}
                  <li>Ab dann jeden Tag kurz die Lernkartei.</li>
                </ol>
                {meta!.kind === 'letters' && <Link href="/geo/alphabete" className="ga-btn ghost sm" style={{ marginTop: 6 }}><Icon name="book" size={14} /> Alle Alphabete vergleichen</Link>}
              </div>
            )}
            {hasHear && !isMw && meta!.kind === 'letters' && (
              <p className="ga-muted" style={{ fontSize: 11.5 }}>
                Laute: Aufnahmen der Lautschrift (IPA) von Wikimedia Commons, CC BY-SA (<a href="/geo/audio/laute/QUELLEN.txt" target="_blank" rel="noopener">Quellen</a>). Sie zeigen den Laut – nicht immer genau die Aussprache in jeder Sprache.
                {' '}Ortsnamen: echte Aufnahmen von Wikimedia Commons / Lingua Libre, wenn vorhanden – sonst die Stimme deines Geräts.
              </p>
            )}
          </aside>
        </div>
      ) : over ? (
        <div className="ga-card ga-result" style={{ maxWidth: 560, margin: '24px auto' }}>
          <p className="ga-eyebrow">{mode === 'kartei' ? 'Lernkartei für heute' : variant === 'leben' && lives <= 0 ? 'Keine Leben mehr' : timed ? 'Zeit um' : 'Geschafft'}</p>
          <div className="ga-result-num">{timed ? score.right : `${Math.round((score.right / Math.max(1, total)) * 100)} %`}</div>
          <p className="ga-muted" style={{ margin: '0 0 14px', fontSize: 14 }}>
            {score.right} beim ersten Mal richtig · {score.wrong} Fehler · beste Serie {score.best}
            {finished && ` · ${fmtTime(finished.seconds)} Min.`}
          </p>
          {mode === 'kartei' && faecher()}
          {finished?.newBest && <p className="ga-badge ok" style={{ marginBottom: 14 }}>Neuer Bestwert</p>}
          {!loggedIn && !isMw && <p className="ga-muted" style={{ fontSize: 12.5 }}>Melde dich an, damit du XP bekommst und deine Bestwerte und die Lernkartei im Konto landen.</p>}
          <div className="ga-row ga-wrap" style={{ justifyContent: 'center', marginTop: 10 }}>
            {mode !== 'kartei' && <button className="ga-btn primary" onClick={() => start(mode)}><Icon name="refresh" size={16} /> Nochmal</button>}
            {mode === 'kartei' && srsInfo.due + srsInfo.newLeft > 0 && <button className="ga-btn primary" onClick={() => start('kartei')}><Icon name="cards" size={16} /> Weiter üben ({srsInfo.due + srsInfo.newLeft})</button>}
            {missed.size > 0 && ['read', 'write', 'hear', 'type'].includes(mode) && <button className="ga-btn" onClick={() => start(mode, [...missed])}>Nur die {missed.size} Fehler üben</button>}
            <button className="ga-btn ghost" onClick={() => { setSrsTick(t => t + 1); start('learn') }}><Icon name="book" size={16} /> Lernen</button>
          </div>
        </div>
      ) : current ? (
        <div className="ga-sc-play">
          <div className={`ga-card ga-sc-prompt ${current.kind === 'word' && current.ask === 'sign' ? 'sign' : ''}`}>
            <p className="ga-task-ask">
              {askText(current)}
              {current.kind === 'card' && current.fresh && <span className="ga-badge" style={{ marginLeft: 8 }}>neu</span>}
            </p>
            {current.kind === 'word' && current.ask === 'sign' ? (
              <div className={`ga-sc-sign cc-${current.word.cc.toLowerCase()}`} dir="auto" style={{ fontFamily: glyphFont }}>{current.word.w}</div>
            ) : current.kind === 'word' ? (
              <div className="ga-sc-q">
                {current.word.flag && <Flag code={current.word.flag} size="lg" />}
                <b className="word">{current.word.de}</b>
              </div>
            ) : current.ask === 'hear' ? (
              <div className="ga-sc-q">
                <button type="button" className="ga-sc-hear" onClick={() => playCard(current.card)} aria-label="Nochmal anhören">
                  <Icon name="volume" size={34} />
                </button>
                <small className="ga-muted ga-desktop-only">Leertaste = nochmal</small>
              </div>
            ) : (
              <div className="ga-sc-q">
                {meta!.promptFlag && current.card.flag && current.ask !== 'write' && <Flag code={current.card.flag} size="lg" />}
                {current.card.img && current.ask === 'read' ? (
                  <img src={current.card.img} alt="" className="ga-sc-q-img" />
                ) : (
                  <b dir={current.ask === 'write' ? undefined : meta!.dir ?? 'auto'} style={{ fontFamily: current.ask === 'write' ? undefined : glyphFont }}
                    className={`${current.ask === 'write' || isWordDeck ? 'word' : ''} ${meta!.big && current.ask !== 'write' ? 'big' : ''} ${meta!.multiline && current.ask === 'read' ? 'multi' : ''} ${promptOf(current).length > 38 && !meta!.multiline ? 'long' : ''}`}>
                    {promptOf(current)}
                  </b>
                )}
              </div>
            )}
            {picked !== null && (
              <div className={isRight ? 'ga-task-reveal' : 'ga-task-warn'}>
                {isRight ? 'Richtig!' : <>Richtig wäre: <b dir="auto" style={{ fontFamily: optKind === 'glyph' || (current.kind === 'word' && current.ask === 'spell') ? glyphFont : undefined }}>{answerOf(current)}</b></>}
                {current.kind === 'card' && current.ask === 'hear' && <span> · <b style={{ fontFamily: glyphFont }}>{current.card.c}</b> = {current.card.a}</span>}
                {current.kind === 'card' && current.card.n && <span> · {current.card.n}</span>}
                {current.kind === 'word' && current.ask === 'sign' && <span> · {current.word.flag && <Flag code={current.word.flag} size="sm" className="ga-inline-flag" />} <b dir="auto" style={{ fontFamily: glyphFont }}>{current.word.w}</b></span>}
              </div>
            )}
            {picked !== null && current.kind === 'word' && lesehilfe(current.word.w)}
            {picked !== null && current.kind === 'card' && ((isWordDeck && current.card.c.length > 2) || current.card.syn) && lesehilfe(current.card.c)}
            <div className="ga-item-actions">
              {current.kind === 'card' && current.ask !== 'hear' && (current.ask !== 'write' || picked !== null) && (current.card.snd?.length || current.card.say) && (
                <SoundButton sounds={current.card.snd} say={current.card.say} />
              )}
              {current.kind === 'word' && (picked !== null || current.ask === 'spell') && <SoundButton say={current.word.say ?? (meta?.lang ? { t: current.word.w, l: meta.lang } : null)} />}
              {picked !== null && current.kind === 'word' && (
                <SaveButton word={{ key: `wort:${current.word.w.replace(/\s+/g, '_')}`, slug, quiz: def.title, c: current.word.w, a: current.word.de, flag: current.word.flag, say: current.word.say, at: new Date().toISOString() }} />
              )}
              {picked !== null && current.kind === 'card' && (current.card.word || isWordDeck) && (
                <SaveButton word={current.card.word ?? { key: current.card.key, slug, quiz: def.title, c: current.card.c, a: current.card.a, sub: current.card.n, flag: current.card.flag, say: current.card.say, at: new Date().toISOString() }} />
              )}
            </div>
          </div>

          <div className="ga-sc-answer">
            {current.kind === 'word' && current.ask === 'spell' ? (
              <form onSubmit={submitTyped}>
                <input ref={inputRef} className={`ga-input ga-sc-spell ${picked !== null ? (isRight ? 'good' : 'bad') : ''}`} value={typed} onChange={e => setTyped(e.target.value)}
                  dir="auto" style={{ fontFamily: glyphFont }} placeholder="Hier entsteht der Ortsname …" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} disabled={picked !== null} aria-label="Ortsname in der Landesschrift" />
                <div className="ga-sc-keys" role="group" aria-label="Bildschirm-Tastatur">
                  {keyboard.map(k => {
                    const hint = charKeys(k).map(x => reader.get(x)).find(Boolean)
                    return (
                      <button key={k} type="button" disabled={picked !== null} onClick={() => setTyped(t => t + k)} style={{ fontFamily: glyphFont }} title={hint?.a}>
                        {k}
                        {hint && <small>{hint.a}</small>}
                      </button>
                    )
                  })}
                  <button type="button" className="wide" disabled={picked !== null} onClick={() => setTyped(t => t + ' ')}>Leerzeichen</button>
                  <button type="button" className="wide" disabled={picked !== null || !typed} onClick={() => setTyped(t => [...t].slice(0, -1).join(''))}>⌫</button>
                </div>
                <div className="ga-row ga-wrap" style={{ marginTop: 10 }}>
                  <button type="submit" className="ga-btn primary" disabled={picked !== null || !typed.trim()}>Prüfen</button>
                  <button type="button" className="ga-btn ghost sm" disabled={picked !== null} onClick={hint}>Nächster Buchstabe</button>
                  <button type="button" className="ga-btn ghost sm" disabled={picked !== null} onClick={() => answer('', false)}>Weiß nicht</button>
                </div>
              </form>
            ) : mode === 'type' ? (
              <form onSubmit={submitTyped} className="ga-row">
                <input ref={inputRef} autoFocus className={`ga-input ${picked !== null ? (isRight ? 'good' : 'bad') : ''}`} value={typed} onChange={e => setTyped(e.target.value)}
                  placeholder="Laut eintippen, z.B. sch" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} disabled={picked !== null} aria-label="Antwort" />
                <button type="submit" className="ga-btn primary" disabled={picked !== null || !typed.trim()}>OK</button>
                <button type="button" className="ga-btn ghost sm" disabled={picked !== null} onClick={() => answer('', false)}>Weiß nicht</button>
              </form>
            ) : (
              <div className={`ga-answers ${optKind === 'glyph' ? 'ga-sc-glyphs' : ''}`}>
                {options.map((o, i) => {
                  const cls = picked !== null ? (o === answerOf(current) ? 'right' : o === picked ? 'wrong' : '') : ''
                  return (
                    <button key={o} className={`ga-answer ${cls}`} disabled={picked !== null} onClick={() => pick(o)}>
                      <kbd className="ga-desktop-only">{i + 1}</kbd>
                      {flagOfAnswer[o] && optKind === 'answer' && <Flag code={flagOfAnswer[o]} size="sm" />}
                      <span dir="auto" style={optKind === 'glyph' ? { fontFamily: glyphFont } : undefined}>{o}</span>
                    </button>
                  )
                })}
              </div>
            )}
            {picked !== null && (!isRight || current.kind === 'word') && (
              <button className="ga-btn primary" style={{ marginTop: 12 }} onClick={() => advance(isRight)}>Weiter <Icon name="next" size={15} /></button>
            )}
            <div className="ga-stat-row" style={{ marginTop: 14 }}>
              <div><b>{score.right}</b><span>Richtig</span></div>
              <div><b>{score.wrong}</b><span>Fehler</span></div>
              <div><b>{variant === 'leben' && mode !== 'kartei' ? lives : score.streak}</b><span>{variant === 'leben' && mode !== 'kartei' ? 'Leben' : 'Serie'}</span></div>
            </div>
            {!scored && mode !== 'kartei' && mode !== 'pfad' && <p className="ga-muted" style={{ fontSize: 11.5, marginTop: 8 }}>Übungsrunde – zählt für die Lernkartei, ohne Bestwert.</p>}
            {mode === 'pfad' && <p className="ga-muted" style={{ fontSize: 11.5, marginTop: 8 }}>Nur mit Zeichen, die du schon gelernt hast. Die Aussprache der Silben ist vereinfacht.</p>}
          </div>
        </div>
      ) : (
        <div className="ga-map-loading">{mode === 'kartei' ? 'Für heute ist nichts fällig.' : mode === 'pfad' ? `Lerne zuerst mindestens ${PFAD_MIN} Zeichen${pfad?.art === 'alphabet' ? ' (mit mindestens einem Vokal)' : ''} – in der Lernkartei oder beim Lesen. Dann kannst du hier Silben und Wörter lesen.` : 'Lädt …'}</div>
      )}
    </div>
  )
}