'use client'

// Mehrspieler-Raum: Warteraum (Einladungslink, wer ist da, Gastgeber startet) → alle spielen dasselbe Quiz
// in derselben Reihenfolge, der Stand der anderen ist live sichtbar → Endstand. Bonus-XP für alle (siehe XP & Level).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useGeo } from '../../_components/GeoShell'
import GeoQuiz from '../../_components/GeoQuiz'
import Icon from '../../_components/Icon'
import { isBuilt } from '../../_lib/catalog'
import type { QuizMode, Variant } from '../../_lib/results'
import type { QuizDef } from '../../_lib/types'

type Player = { id: string; username: string; right: number; wrong: number; answered: number; total: number; seconds: number | null; finished: boolean; online: boolean; me: boolean }
type Room = { id: string; slug: string; mode: string; variant: string; seed: number; status: 'lobby' | 'running' | 'done'; hostId: string; hostName: string; startedAt: string | null }
type State = { room: Room; players: Player[]; me: string | null; isHost: boolean }

const MODE_DE: Record<string, string> = { click: 'Auf Karte finden', name: 'Namen zuordnen', type: 'Eintippen', text: 'Wissensfrage', mixed: 'Gemischt' }
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

async function post(body: Record<string, unknown>) {
  const r = await fetch('/api/geo/room', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error || 'Fehler')
  return d
}

export default function RoomView({ id }: { id: string }) {
  const router = useRouter()
  const { loggedIn, loaded, bySlug, status, config } = useGeo()
  const [st, setSt] = useState<State | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const joined = useRef(false)

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/geo/room?id=${encodeURIComponent(id)}`, { cache: 'no-store' })
      const d = await r.json()
      if (!r.ok) { setError(d.error || 'Raum nicht gefunden'); return null }
      setSt(d)
      return d as State
    } catch { return null }
  }, [id])

  // Beitreten (einmal) und alle 2 Sekunden den Stand holen
  useEffect(() => {
    if (!loggedIn) return
    let alive = true
    ;(async () => {
      const d = await load()
      if (d && !d.players.some(p => p.me) && !joined.current) {
        joined.current = true
        try { const j = await post({ action: 'join', id }); if (alive) setSt(j) } catch (e) { if (alive) setError(e instanceof Error ? e.message : 'Fehler') }
      }
    })()
    const t = setInterval(load, 2000)
    return () => { alive = false; clearInterval(t) }
  }, [loggedIn, id, load])

  const room = st?.room
  // Nur vom Quiz-Schlüssel abhängig – sonst würde jede Abfrage (alle 2 s) das Quiz neu aufbauen
  const roomSlug = room?.slug ?? ''
  const slugs = useMemo(() => (roomSlug ? (roomSlug.startsWith('mix:') ? roomSlug.slice(4).split('+') : [roomSlug]) : []), [roomSlug])
  const defs = useMemo(() => slugs.map(s => bySlug[s]).filter(e => isBuilt(e) && status(e).open) as QuizDef[], [slugs, bySlug, status])
  const title = defs.length === 1 ? defs[0].title : 'Eigener Mix'
  const inviteUrl = typeof window !== 'undefined' ? window.location.href : ''

  const lastSent = useRef(0)
  const onProgress = useCallback((p: { right: number; wrong: number; answered: number; total: number; done: boolean; seconds: number }) => {
    // Nicht öfter als alle 700 ms melden (außer am Ende)
    const now = Date.now()
    if (!p.done && now - lastSent.current < 700) return
    lastSent.current = now
    post({ action: 'progress', id, ...p }).then(setSt).catch(() => {})
  }, [id])

  const copy = async () => { try { await navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* egal */ } }
  const leave = async () => { await post({ action: 'leave', id }).catch(() => {}); router.push('/geo') }

  const ranked = useMemo(() => [...(st?.players ?? [])].sort((a, b) => b.right - a.right || a.wrong - b.wrong || (a.seconds ?? 1e9) - (b.seconds ?? 1e9)), [st])

  const board = st && (
    <div className="ga-card ga-mp-board">
      {ranked.map((p, i) => (
        <div key={p.id} className={`ga-mp-p ${p.me ? 'me' : ''} ${p.online ? '' : 'off'}`}>
          <span className="rk">{i + 1}</span>
          <span className="nm">{p.username}{p.id === room?.hostId && <small> · Gastgeber</small>}</span>
          <span className="bar"><span style={{ width: `${p.total ? (p.answered / p.total) * 100 : 0}%` }} /></span>
          <span className="sc"><b>{p.right}</b> <span className="ga-muted">/ {p.wrong} F</span></span>
          {p.finished && <span className="ga-badge ok">fertig{p.seconds != null ? ` · ${fmtTime(p.seconds)}` : ''}</span>}
        </div>
      ))}
    </div>
  )

  if (!loaded) return <div className="ga-page"><div className="ga-map-loading">Lädt …</div></div>
  if (!loggedIn) {
    return (
      <div className="ga-page">
        <div className="ga-card ga-locked">
          <div className="ga-locked-icon"><Icon name="users" size={28} /></div>
          <h1 className="ga-h2">Du wurdest eingeladen</h1>
          <p className="ga-lead" style={{ margin: '6px auto 16px' }}>Zum Mitspielen bitte einloggen – danach kommst du direkt in den Raum.</p>
          <Link href={`/login?redirect=${encodeURIComponent(`/geo/mehrspieler/${id}`)}`} className="ga-btn primary">Einloggen</Link>
        </div>
      </div>
    )
  }
  if (error && !st) return <div className="ga-page"><div className="ga-card ga-locked"><h1 className="ga-h2">{error}</h1><Link href="/geo" className="ga-btn primary" style={{ marginTop: 12 }}>Zum Atlas</Link></div></div>
  if (!st || !room) return <div className="ga-page"><div className="ga-map-loading">Raum wird geladen …</div></div>
  const meIn = st.players.some(p => p.me)

  if (room.status === 'lobby' || !meIn || !defs.length) {
    return (
      <div className="ga-page" style={{ maxWidth: 860 }}>
        <Link href="/geo" className="ga-btn ghost sm" style={{ marginLeft: -10 }}><Icon name="back" size={15} /> Atlas</Link>
        <p className="ga-eyebrow" style={{ marginTop: 8 }}>Mehrspieler · Warteraum</p>
        <h1 className="ga-title" style={{ marginBottom: 6 }}>{title}</h1>
        <p className="ga-lead">{MODE_DE[room.mode] ?? room.mode} · {room.variant === 'leben' ? '3 Leben' : 'Normal'} · alle bekommen dieselben Fragen in derselben Reihenfolge. Bonus: ×{String(config.xp.multiplayer).replace('.', ',')} XP.</p>
        {error && <p className="ga-adm-flash bad">{error}</p>}
        {!defs.length && <p className="ga-adm-flash bad">Dieses Quiz ist für dich nicht freigeschaltet.</p>}

        <div className="ga-card ga-mp-invite">
          <span className="ga-adm-label">Einladungslink – an Freunde schicken</span>
          <div className="ga-share-link">
            <input className="ga-input" readOnly value={inviteUrl} onFocus={e => e.target.select()} aria-label="Einladungslink" />
            <button className="ga-btn" onClick={copy}><Icon name={copied ? 'check' : 'copy'} size={15} /> {copied ? 'Kopiert' : 'Kopieren'}</button>
          </div>
        </div>

        <h2 className="ga-h3" style={{ margin: '20px 0 10px' }}>Dabei ({st.players.length})</h2>
        <div className="ga-card ga-mp-lobby">
          {st.players.map(p => (
            <div key={p.id} className={`ga-mp-p ${p.me ? 'me' : ''} ${p.online ? '' : 'off'}`}>
              <span className={`dot ${p.online ? 'on' : ''}`} />
              <span className="nm">{p.username}{p.id === room.hostId && <small> · Gastgeber</small>}{p.me && <small> · du</small>}</span>
            </div>
          ))}
        </div>

        <div className="ga-row ga-wrap" style={{ marginTop: 16 }}>
          {st.isHost
            ? <button className="ga-btn primary" disabled={!defs.length} onClick={() => post({ action: 'start', id }).then(setSt).catch(e => setError(e.message))}><Icon name="play" size={15} /> Runde starten</button>
            : <span className="ga-muted">Warte, bis {room.hostName} die Runde startet …</span>}
          <button className="ga-btn ghost" onClick={leave}>Raum verlassen</button>
        </div>
        {st.isHost && st.players.length < 2 && <p className="ga-muted" style={{ fontSize: 13 }}>Den Mehrspieler-Bonus gibt es ab zwei Spielern.</p>}
      </div>
    )
  }

  return (
    <>
      <GeoQuiz
        key={`${room.id}:${room.seed}`}
        defs={defs}
        slug={room.slug}
        title={title}
        backHref="/geo"
        backLabel="Atlas"
        multi={{ roomId: room.id, seed: room.seed, mode: room.mode as QuizMode, variant: room.variant as Variant, onProgress, board }}
      />
      <div className="ga-page" style={{ paddingTop: 0 }}>
        <div className="ga-row ga-wrap">
          {room.status === 'done' && <span className="ga-badge ok">Alle fertig – Endstand oben</span>}
          {st.isHost && room.status === 'done' && <button className="ga-btn primary sm" onClick={() => post({ action: 'again', id }).then(setSt)}><Icon name="refresh" size={14} /> Neue Runde</button>}
          <button className="ga-btn ghost sm" onClick={leave}>Raum verlassen</button>
        </div>
      </div>
    </>
  )
}