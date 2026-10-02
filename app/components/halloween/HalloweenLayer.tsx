'use client'

// Halloween-Ebene über der ganzen Website (eingebunden in app/layout.tsx)
//  • zeigt die versteckten Kürbisse der aktuellen Seite (nur während des Events; Admins schon vorher als Vorschau)
//  • Kürbis anklicken → Süßigkeiten springen heraus → Quizfrage mit Timer
//  • falsche Antwort / Zeit um / Tab gewechselt → das Skelett lacht dich aus
//  • kleiner Zähler unten links (gefundene Kürbisse + Süßigkeiten, Link zum Shop)
//  • Platzier-Modus für Administrator/Owner (Start über /admin2/halloween): Klick auf die Seite versteckt einen Kürbis
// Wird das Event beendet („Sofort beenden“), liefert der Server event: null und hier verschwindet alles.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { spookyFont } from '@/app/lib/fonts'
import { CANDY_COLORS, CANDY_KINDS, CandyArt, PumpkinArt, SkeletonArt, type CandyKind } from './art'
import './halloween.css'

type Pumpkin = { id: number; anchor: string; x: number; y: number; size: number; difficulty?: string; foundBy?: number; found?: boolean }
type Me = { loggedIn: boolean; earned?: number; spent?: number; candies?: number; found?: number; total: number }
type HwEventInfo = { id: number; slug: string; title: string; accent: string; startsAt: string; endsAt: string; running: boolean; preview: boolean }
type HwState = { event: HwEventInfo | null; pumpkins?: Pumpkin[]; me?: Me | null; canPlace?: boolean }
type Question = { text: string; answers: string[]; difficulty: 'easy' | 'medium' | 'hard'; bonus: number; timeLimit: number }
type QuizResult = { correct: boolean; result: string; correctIndex: number | null; bonus: number }
type Quiz = { findId: number; q: Question; endsAt: number; picked: number | null; sending: boolean; result: QuizResult | null }
type Piece = { kind: CandyKind; color: string; dx: number; dy: number; r: number; delay: number; size: number }
type Burst = { id: number; x: number; y: number; label: string; pieces: Piece[] }
type Reason = 'wrong' | 'timeout' | 'tab'

// Hier gibt es keine Kürbisse (Verwaltung, private Bereiche, Login)
const SKIP = ['/admin', '/admin2', '/private', '/login', '/register', '/verify-account']
const PLACE_KEY = 'hw-place'
const DIFF: Record<string, string> = { random: 'Zufällig', easy: 'Einfach', medium: 'Mittel', hard: 'Schwer' }

export default function HalloweenLayer() {
  const pathname = usePathname() || '/'
  const skip = SKIP.some(p => pathname === p || pathname.startsWith(p + '/'))
  if (skip) return null
  // key = Seite → bei jedem Seitenwechsel frisch laden
  return <Layer key={pathname} path={pathname} />
}

// ── Hilfen ─────────────────────────────────────────────────────────────────

function readPlaceFlag(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (new URLSearchParams(window.location.search).get('hw-place') === '1') sessionStorage.setItem(PLACE_KEY, '1')
    return sessionStorage.getItem(PLACE_KEY) === '1'
  } catch {
    return false
  }
}

// Liegt das Element in etwas, das beim Scrollen stehen bleibt (z. B. Navbar)? Dann muss der Kürbis darüber liegen.
function isElevated(el: Element): boolean {
  let n: Element | null = el
  while (n && n !== document.body) {
    const pos = getComputedStyle(n).position
    if (pos === 'fixed' || pos === 'sticky') return true
    n = n.parentElement
  }
  return false
}

// Eindeutiger, einfacher CSS-Pfad zu einem Element (nur Tags + Reihenfolge, oder eine ID)
function selectorFor(el: Element): string {
  const parts: string[] = []
  let n: Element | null = el
  while (n && n !== document.body && n !== document.documentElement) {
    if (n.id && /^[A-Za-z][\w-]{0,60}$/.test(n.id)) { parts.unshift(`#${n.id}`); return parts.join(' > ') }
    const tag = n.tagName.toLowerCase()
    let i = 1
    let s = n.previousElementSibling
    while (s) { if (s.tagName === n.tagName) i++; s = s.previousElementSibling }
    parts.unshift(`${tag}:nth-of-type(${i})`)
    n = n.parentElement
  }
  parts.unshift('body')
  return parts.join(' > ')
}

// Bereich, an dem der Kürbis „hängt“: das angeklickte Element oder ein ausreichend großes Elternelement
function pickAnchor(start: Element): Element {
  let el: Element | null = start
  if (el instanceof SVGElement) el = (el.ownerSVGElement || el).parentElement
  while (el && el !== document.body) {
    const r = el.getBoundingClientRect()
    if (r.width >= 120 && r.height >= 48 && getComputedStyle(el).display !== 'inline') break
    el = el.parentElement
  }
  el = el || document.body
  // Sehr tiefe Pfade kürzen, indem ein größeres Elternelement genommen wird
  while (el !== document.body && selectorFor(el).length > 560 && el.parentElement) el = el.parentElement
  return el
}

function makeBurst(x: number, y: number, amount: number): Burst {
  const n = Math.min(18, Math.max(8, amount * 3))
  const pieces: Piece[] = Array.from({ length: n }, (_, i) => {
    const angle = (-Math.PI / 2) + (Math.random() - 0.5) * Math.PI * 1.3
    const dist = 70 + Math.random() * 90
    return {
      kind: CANDY_KINDS[i % CANDY_KINDS.length],
      color: CANDY_COLORS[Math.floor(Math.random() * CANDY_COLORS.length)],
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist,
      r: (Math.random() - 0.5) * 720,
      delay: Math.random() * 90,
      size: 22 + Math.random() * 14,
    }
  })
  return { id: Date.now() + Math.random(), x, y, label: `+${amount}`, pieces }
}

async function postJson(url: string, body: unknown, method = 'POST', keepalive = false) {
  const r = await fetch(url, { method, keepalive, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const d = await r.json().catch(() => ({}))
  return { ok: r.ok, status: r.status, d }
}

// ── Ebene ──────────────────────────────────────────────────────────────────

function Layer({ path }: { path: string }) {
  const [st, setSt] = useState<HwState | null>(null)
  const [placing, setPlacing] = useState<boolean>(readPlaceFlag)
  const [tick, setTick] = useState(0)
  const [bursts, setBursts] = useState<Burst[]>([])
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [laugh, setLaugh] = useState<{ reason: Reason; correct: string | null } | null>(null)
  const [loginAsk, setLoginAsk] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const btnRefs = useRef(new Map<number, HTMLButtonElement>())
  const busy = useRef(false)
  const quizRef = useRef<Quiz | null>(null)

  // Portal erst im Browser
  useEffect(() => { const t = setTimeout(() => setMounted(true), 0); return () => clearTimeout(t) }, [])

  // Platzier-Parameter aus der Adresse entfernen
  useEffect(() => {
    try {
      const u = new URL(window.location.href)
      if (u.searchParams.has('hw-place')) { u.searchParams.delete('hw-place'); window.history.replaceState(window.history.state, '', u.toString()) }
    } catch { /* egal */ }
  }, [])

  // Daten laden (bei Seitenwechsel, jede Minute und wenn man zum Tab zurückkommt)
  useEffect(() => {
    let alive = true
    fetch(`/api/halloween/state?path=${encodeURIComponent(path)}${placing ? '&place=1' : ''}`, { cache: 'no-store' })
      .then(r => r.json())
      .then((d: HwState) => { if (alive) setSt(d) })
      .catch(() => {})
    return () => { alive = false }
  }, [path, placing, tick])
  useEffect(() => {
    const t = setInterval(() => { if (!quizRef.current) setTick(n => n + 1) }, 60000)
    const f = () => { if (!quizRef.current) setTick(n => n + 1) }
    window.addEventListener('focus', f)
    return () => { clearInterval(t); window.removeEventListener('focus', f) }
  }, [])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(t => (t === msg ? null : t)), 3500)
  }, [])

  const ev = st?.event || null
  const canPlace = !!st?.canPlace && placing
  const visible = !!ev && (ev.running || ev.preview || canPlace)
  const pumpkins = useMemo(() => (visible ? st?.pumpkins || [] : []), [visible, st?.pumpkins])

  // ── Kürbisse an ihre Stelle setzen (jedes Bild neu, damit sie beim Scrollen/Umbauen mitwandern) ──
  useEffect(() => {
    if (!pumpkins.length) return
    const cache = new Map<number, { el: Element | null; at: number }>()
    let raf = 0
    const loop = () => {
      const now = performance.now()
      for (const p of pumpkins) {
        const b = btnRefs.current.get(p.id)
        if (!b) continue
        let c = cache.get(p.id)
        if (!c || now - c.at > 700 || (c.el && !c.el.isConnected)) {
          let el: Element | null = null
          try { el = document.querySelector(p.anchor) } catch { el = null }
          c = { el, at: now }
          cache.set(p.id, c)
          b.style.zIndex = el && isElevated(el) ? '8001' : '7500'
        }
        const el = c.el
        const r = el?.getBoundingClientRect()
        if (!el || !r || (r.width === 0 && r.height === 0)) { b.style.visibility = 'hidden'; continue }
        const left = r.left + (p.x / 100) * r.width - p.size / 2
        const top = r.top + (p.y / 100) * r.height - p.size / 2
        b.style.visibility = 'visible'
        b.style.transform = `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0)`
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [pumpkins])

  const addBurst = useCallback((x: number, y: number, amount: number) => {
    const b = makeBurst(x, y, amount)
    setBursts(list => [...list, b])
    setTimeout(() => setBursts(list => list.filter(z => z.id !== b.id)), 1900)
  }, [])

  // ── Kürbis gefunden ──
  const collect = async (p: Pumpkin, btn: HTMLButtonElement) => {
    if (busy.current || quizRef.current) return
    if (!st?.me?.loggedIn) { setLoginAsk(true); return }
    busy.current = true
    const rect = btn.getBoundingClientRect()
    const { ok, status, d } = await postJson('/api/halloween/find', { pumpkinId: p.id })
    busy.current = false
    if (!ok) {
      if (status === 409 || status === 404) setSt(s => (s ? { ...s, pumpkins: (s.pumpkins || []).filter(x => x.id !== p.id) } : s))
      if (status === 401) { setLoginAsk(true); return }
      showToast(d.error || 'Das hat nicht geklappt')
      return
    }
    setSt(s => (s ? { ...s, me: d.me, pumpkins: (s.pumpkins || []).filter(x => x.id !== p.id) } : s))
    addBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, d.gained)
    if (d.question) {
      const q = d.question as Question
      setTimeout(() => {
        const next: Quiz = { findId: d.findId, q, endsAt: Date.now() + q.timeLimit * 1000, picked: null, sending: false, result: null }
        quizRef.current = next
        setQuiz(next)
      }, 800)
    }
  }

  // ── Antwort abschicken (auch bei Zeitablauf oder Tab-Wechsel mit answer = null) ──
  const submit = useCallback(async (answer: number | null, reason: 'pick' | 'timeout' | 'tab') => {
    const qz = quizRef.current
    if (!qz || qz.sending || qz.result) return
    const sending: Quiz = { ...qz, sending: true, picked: answer }
    quizRef.current = sending
    setQuiz(sending)
    const { ok, d } = await postJson('/api/halloween/answer', { findId: qz.findId, answer }, 'POST', true).catch(() => ({ ok: false, status: 0, d: {} as Record<string, unknown> }))
    const result: QuizResult = ok
      ? { correct: !!d.correct, result: String(d.result), correctIndex: d.correctIndex ?? null, bonus: Number(d.bonus) || 0 }
      : { correct: false, result: reason === 'pick' ? 'wrong' : 'timeout', correctIndex: null, bonus: 0 }
    if (ok && d.me) setSt(s => (s ? { ...s, me: d.me } : s))
    const done: Quiz = { ...sending, sending: false, result }
    quizRef.current = done
    setQuiz(done)

    if (result.correct) {
      addBurst(window.innerWidth / 2, window.innerHeight / 2, result.bonus)
      setTimeout(() => { quizRef.current = null; setQuiz(null) }, 1700)
    } else {
      const correctText = result.correctIndex != null ? qz.q.answers[result.correctIndex] ?? null : null
      const why: Reason = reason === 'tab' ? 'tab' : result.result === 'timeout' ? 'timeout' : 'wrong'
      setTimeout(() => setLaugh({ reason: why, correct: correctText }), 450)
    }
  }, [addBurst])

  const onPick = useCallback((i: number) => submit(i, 'pick'), [submit])
  const onTimeout = useCallback(() => submit(null, 'timeout'), [submit])

  const closeLaugh = () => { setLaugh(null); quizRef.current = null; setQuiz(null) }

  // Timer + „austabben“ = sofort falsch
  const quizOpen = !!quiz && !quiz.result && !quiz.sending
  useEffect(() => {
    if (!quizOpen) return
    const onHide = () => { if (document.visibilityState === 'hidden') submit(null, 'tab') }
    const onBlur = () => submit(null, 'tab')
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('blur', onBlur)
    return () => { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('blur', onBlur) }
  }, [quizOpen, submit])

  // Seite verlassen mit offener Frage → zählt als falsch
  useEffect(() => () => {
    const qz = quizRef.current
    if (qz && !qz.result && !qz.sending) {
      fetch('/api/halloween/answer', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ findId: qz.findId, answer: null }) }).catch(() => {})
    }
  }, [])

  // ── Platzier-Modus ──
  const [armed, setArmed] = useState(true)
  const [pDiff, setPDiff] = useState('random')
  const [pSize, setPSize] = useState(34)
  const [editing, setEditing] = useState<number | null>(null)
  const ghostRef = useRef<HTMLDivElement>(null)
  const markRef = useRef<HTMLDivElement>(null)
  const eventId = ev?.id

  const stopPlacing = () => {
    try { sessionStorage.removeItem(PLACE_KEY) } catch { /* egal */ }
    setPlacing(false); setEditing(null)
  }

  useEffect(() => {
    if (!canPlace || !armed || !eventId) return
    const onMove = (e: MouseEvent) => {
      const t = e.target as Element
      const g = ghostRef.current, m = markRef.current
      if (!g || !m) return
      if (t.closest?.('[data-hw-ui]')) { g.style.opacity = '0'; m.style.opacity = '0'; return }
      g.style.opacity = '.75'
      g.style.transform = `translate3d(${e.clientX - pSize / 2}px, ${e.clientY - pSize / 2}px, 0)`
      const a = pickAnchor(t).getBoundingClientRect()
      m.style.opacity = '1'
      m.style.transform = `translate3d(${a.left}px, ${a.top}px, 0)`
      m.style.width = `${a.width}px`; m.style.height = `${a.height}px`
    }
    const onClick = async (e: MouseEvent) => {
      const t = e.target as Element
      if (t.closest?.('[data-hw-ui]')) return
      e.preventDefault(); e.stopPropagation()
      const anchor = pickAnchor(t)
      const r = anchor.getBoundingClientRect()
      const x = r.width ? ((e.clientX - r.left) / r.width) * 100 : 50
      const y = r.height ? ((e.clientY - r.top) / r.height) * 100 : 50
      const { ok, d } = await postJson(`/api/admin2/halloween/${eventId}/pumpkins`, { pagePath: path, anchor: selectorFor(anchor), x, y, size: pSize, difficulty: pDiff })
      if (!ok) { showToast(d.error || 'Speichern fehlgeschlagen'); return }
      setSt(s => (s ? { ...s, pumpkins: [...(s.pumpkins || []), d.pumpkin], me: s.me ? { ...s.me, total: s.me.total + 1 } : s.me } : s))
      showToast('Kürbis versteckt')
    }
    document.addEventListener('mousemove', onMove, true)
    document.addEventListener('click', onClick, true)
    return () => { document.removeEventListener('mousemove', onMove, true); document.removeEventListener('click', onClick, true) }
  }, [canPlace, armed, eventId, path, pSize, pDiff, showToast])

  const patchPumpkin = async (p: Pumpkin, patch: Record<string, unknown>) => {
    const { ok, d } = await postJson(`/api/admin2/halloween/${eventId}/pumpkins/${p.id}`, patch, 'PATCH')
    if (!ok) { showToast(d.error || 'Fehler'); return }
    setSt(s => (s ? { ...s, pumpkins: (s.pumpkins || []).map(x => (x.id === p.id ? { ...x, ...d.pumpkin } : x)) } : s))
  }
  const deletePumpkin = async (p: Pumpkin) => {
    if ((p.foundBy || 0) > 0 && !confirm(`Diesen Kürbis haben schon ${p.foundBy} Spieler gefunden. Beim Löschen verlieren sie die Süßigkeiten dafür. Trotzdem löschen?`)) return
    const r = await fetch(`/api/admin2/halloween/${eventId}/pumpkins/${p.id}`, { method: 'DELETE' })
    if (!r.ok) { showToast('Löschen fehlgeschlagen'); return }
    setEditing(null)
    setSt(s => (s ? { ...s, pumpkins: (s.pumpkins || []).filter(x => x.id !== p.id), me: s.me ? { ...s.me, total: Math.max(0, s.me.total - 1) } : s.me } : s))
  }

  if (!mounted || !st) return null
  const showPlaceBar = placing && !!st.canPlace
  if (!ev && !showPlaceBar) return null

  const year = ev?.slug.split('-')[1]
  const onShop = path.startsWith('/halloween')
  const me = st.me
  const editP = editing != null ? pumpkins.find(p => p.id === editing) : null

  const ui = (
    <>
      {/* Kürbisse */}
      {pumpkins.map(p => (
        <button
          key={p.id}
          ref={el => { if (el) btnRefs.current.set(p.id, el); else btnRefs.current.delete(p.id) }}
          type="button"
          data-hw-ui
          className={`hw-pk${canPlace ? ' placing' : ''}${p.found ? ' found' : ''}`}
          style={{ width: p.size, height: p.size, visibility: 'hidden' }}
          aria-label="Kürbis"
          onClick={e => { e.stopPropagation(); if (canPlace) setEditing(p.id); else collect(p, e.currentTarget) }}
        >
          <span className="hw-pk-in"><PumpkinArt size={p.size} /></span>
        </button>
      ))}

      {/* Süßigkeiten-Explosionen */}
      {bursts.map(b => (
        <div key={b.id} className="hw-burst" style={{ left: b.x, top: b.y }} aria-hidden="true">
          {b.pieces.map((pc, i) => (
            <span key={i} className="hw-piece" style={{ '--dx': `${pc.dx}px`, '--dy': `${pc.dy}px`, '--r': `${pc.r}deg`, animationDelay: `${pc.delay}ms` } as React.CSSProperties}>
              <CandyArt kind={pc.kind} color={pc.color} size={pc.size} />
            </span>
          ))}
          <span className={`hw-plus ${spookyFont.className}`}>{b.label}</span>
        </div>
      ))}

      {/* Zähler unten links */}
      {ev && !onShop && !showPlaceBar && (ev.running || ev.preview) && (
        <Link href={`/halloween/${year}`} className="hw-hud" data-hw-ui>
          <span className="hw-hud-item"><PumpkinArt size={22} /><b>{me?.loggedIn ? `${me.found ?? 0}/${me.total}` : me?.total ?? 0}</b></span>
          {me?.loggedIn
            ? <span className="hw-hud-item"><CandyArt kind="wrap" color="#f43f5e" size={20} /><b>{me.candies ?? 0}</b></span>
            : <span className="hw-hud-txt">Einloggen zum Sammeln</span>}
          {ev.preview && <span className="hw-hud-tag">Vorschau</span>}
        </Link>
      )}

      {/* Quiz */}
      {quiz && !laugh && (
        <QuizModal quiz={quiz} onPick={onPick} onTimeout={onTimeout} />
      )}

      {/* Skelett lacht */}
      {laugh && (
        <div className="hw-laugh" data-hw-ui role="dialog" aria-modal="true" onClick={closeLaugh}>
          <div className="hw-laugh-box" onClick={e => e.stopPropagation()}>
            <div className={`hw-haha ${spookyFont.className}`} aria-hidden="true"><span>HA</span><span>HA</span><span>HA</span></div>
            <SkeletonArt size={200} />
            <p className={`hw-laugh-title ${spookyFont.className}`}>
              {laugh.reason === 'wrong' ? 'Falsch!' : laugh.reason === 'timeout' ? 'Zu langsam!' : 'Erwischt!'}
            </p>
            <p className="hw-laugh-text">
              {laugh.reason === 'tab' ? 'Du hast den Tab gewechselt – die Frage zählt als falsch.'
                : laugh.reason === 'timeout' ? 'Die Zeit ist abgelaufen.'
                : 'Das war leider nicht richtig.'}
              {laugh.correct && <><br />Richtig wäre gewesen: <b>{laugh.correct}</b></>}
            </p>
            <p className="hw-laugh-text small">Die Süßigkeiten fürs Finden behältst du trotzdem.</p>
            <button type="button" className="hw-btn" onClick={closeLaugh}>Weiter suchen</button>
          </div>
        </div>
      )}

      {/* Login-Hinweis */}
      {loginAsk && (
        <div className="hw-modal-bg" data-hw-ui onClick={() => setLoginAsk(false)}>
          <div className="hw-modal small" onClick={e => e.stopPropagation()}>
            <PumpkinArt size={56} />
            <p className={`hw-modal-title ${spookyFont.className}`}>Kürbis gefunden!</p>
            <p className="hw-modal-text">Melde dich an, um Kürbisse zu sammeln und Süßigkeiten zu bekommen.</p>
            <div className="hw-row">
              <Link href="/login" className="hw-btn">Einloggen</Link>
              <button type="button" className="hw-btn ghost" onClick={() => setLoginAsk(false)}>Später</button>
            </div>
          </div>
        </div>
      )}

      {/* Platzier-Modus */}
      {showPlaceBar && (
        <>
          {canPlace && armed && <div ref={markRef} className="hw-mark" aria-hidden="true" />}
          {canPlace && armed && <div ref={ghostRef} className="hw-ghost" aria-hidden="true"><PumpkinArt size={pSize} /></div>}
          <div className="hw-placebar" data-hw-ui>
            <div className="hw-placebar-head">
              <b>Platzier-Modus</b>
              <span>{ev ? `${pumpkins.length} auf dieser Seite · ${me?.total ?? 0} insgesamt` : 'Kein aktives Halloween-Event – erst in /admin2/halloween einschalten'}</span>
            </div>
            {ev && (
              <div className="hw-placebar-row">
                <label className="hw-switch"><input type="checkbox" checked={armed} onChange={e => setArmed(e.target.checked)} /> Klick versteckt Kürbis</label>
                <label>Schwierigkeit
                  <select value={pDiff} onChange={e => setPDiff(e.target.value)}>
                    {Object.entries(DIFF).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
                <label>Größe
                  <input type="range" min={20} max={64} value={pSize} onChange={e => setPSize(Number(e.target.value))} />
                </label>
              </div>
            )}
            <p className="hw-placebar-hint">{armed ? 'Klicke irgendwo auf die Seite. Zum Navigieren „Klick versteckt Kürbis“ ausschalten.' : 'Navigiere zur nächsten Seite und schalte dann wieder ein.'} Kürbis anklicken = bearbeiten.</p>
            <div className="hw-row">
              <Link href="/admin2/halloween" className="hw-btn ghost">Zur Verwaltung</Link>
              <button type="button" className="hw-btn" onClick={stopPlacing}>Beenden</button>
            </div>
          </div>
          {editP && (
            <div className="hw-edit" data-hw-ui>
              <b>Kürbis #{editP.id}</b>
              <span>Gefunden von {editP.foundBy ?? 0} Spieler{(editP.foundBy ?? 0) === 1 ? '' : 'n'}</span>
              <label>Schwierigkeit
                <select value={editP.difficulty || 'random'} onChange={e => patchPumpkin(editP, { difficulty: e.target.value })}>
                  {Object.entries(DIFF).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label>Größe
                <input type="range" min={20} max={64} defaultValue={editP.size} onPointerUp={e => patchPumpkin(editP, { size: Number((e.target as HTMLInputElement).value) })} onKeyUp={e => patchPumpkin(editP, { size: Number((e.target as HTMLInputElement).value) })} />
              </label>
              <div className="hw-row">
                <button type="button" className="hw-btn danger" onClick={() => deletePumpkin(editP)}>Löschen</button>
                <button type="button" className="hw-btn ghost" onClick={() => setEditing(null)}>Schließen</button>
              </div>
            </div>
          )}
        </>
      )}

      {toast && <div className="hw-toast" data-hw-ui role="status">{toast}</div>}
    </>
  )

  return createPortal(ui, document.body)
}

// ── Quiz-Fenster ───────────────────────────────────────────────────────────

const DIFF_LABEL: Record<string, string> = { easy: 'Einfach', medium: 'Mittel', hard: 'Schwer' }

function QuizModal({ quiz, onPick, onTimeout }: { quiz: Quiz; onPick: (i: number) => void; onTimeout: () => void }) {
  const [now, setNow] = useState(() => Date.now())
  const locked = quiz.sending || !!quiz.result
  const total = quiz.q.timeLimit * 1000
  const left = Math.max(0, quiz.endsAt - now)

  useEffect(() => {
    if (locked) return
    const t = setInterval(() => {
      const n = Date.now()
      setNow(n)
      if (n >= quiz.endsAt) onTimeout()
    }, 100)
    return () => clearInterval(t)
  }, [locked, quiz.endsAt, onTimeout])

  const r = quiz.result
  const cls = (i: number) => {
    if (!r) return quiz.picked === i ? 'picked' : ''
    if (r.correctIndex === i) return 'right'
    if (quiz.picked === i) return 'wrong'
    return 'dim'
  }

  return (
    <div className="hw-modal-bg" data-hw-ui role="dialog" aria-modal="true" aria-label="Quizfrage">
      <div className={`hw-modal hw-quiz ${quiz.q.difficulty}`}>
        <div className="hw-quiz-top">
          <span className={`hw-chip ${quiz.q.difficulty}`}>{DIFF_LABEL[quiz.q.difficulty]}</span>
          <span className="hw-quiz-bonus"><CandyArt kind="wrap" color="#f43f5e" size={18} /> +{quiz.q.bonus} bei richtiger Antwort</span>
        </div>
        <div className="hw-timer" aria-hidden="true">
          <div className="hw-timer-bar" style={{ transform: `scaleX(${locked && !r ? left / total : r ? 0 : left / total})` }} />
        </div>
        <div className={`hw-timer-num ${left < 5000 && !locked ? 'urgent' : ''}`}>{locked ? '' : `${Math.ceil(left / 1000)} s`}</div>
        <p className="hw-quiz-q">{quiz.q.text}</p>
        <div className={`hw-answers n${quiz.q.answers.length}`}>
          {quiz.q.answers.map((a, i) => (
            <button key={i} type="button" className={`hw-answer ${cls(i)}`} disabled={locked} onClick={() => onPick(i)}>
              <span className="hw-answer-key">{String.fromCharCode(65 + i)}</span>{a}
            </button>
          ))}
        </div>
        {r?.correct && <p className={`hw-quiz-right ${spookyFont.className}`}>Richtig! +{r.bonus}</p>}
        {!r && <p className="hw-quiz-note">Nicht den Tab wechseln – sonst zählt die Frage sofort als falsch.</p>}
      </div>
    </div>
  )
}