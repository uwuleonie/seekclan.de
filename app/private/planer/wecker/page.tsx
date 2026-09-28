'use client'

// Wecker & Timer
// - Timer laufen auf dem Server weiter: auch bei geschlossener Seite kommt beim Ablauf ein Push
// - Ist die Seite offen, klingelt es direkt hier (mit Ton)
// - Wecker mit Wochentagen (z.B. Mo–Fr 06:30), einmalig oder wiederholend

import { useCallback, useEffect, useState } from 'react'
import Icon from '../../_components/Icon'
import Portal from '../../_components/Portal'
import { usePrivate } from '../../_components/PrivateShell'
import { WEEKDAY_SHORT } from '@/app/lib/alarms'
import { api, fmtTime, relDay, type PAlarm } from '../../_lib/planner'

const PRESETS = [1, 3, 5, 10, 15, 20, 25, 30, 45, 60]
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] // Mo … So

function fmtDur(sec: number) {
  const s = Math.max(0, Math.ceil(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

function daysText(days: number[]) {
  if (!days.length) return 'Einmalig'
  const set = new Set(days)
  if (set.size === 7) return 'Täglich'
  if (set.size === 5 && [1, 2, 3, 4, 5].every(d => set.has(d))) return 'Mo–Fr'
  if (set.size === 2 && set.has(0) && set.has(6)) return 'Wochenende'
  return DAY_ORDER.filter(d => set.has(d)).map(d => WEEKDAY_SHORT[d]).join(', ')
}

export default function WeckerPage() {
  const { toast, ring } = usePrivate()
  const [alarms, setAlarms] = useState<PAlarm[]>([])
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [dur, setDur] = useState({ h: 0, m: 5, s: 0 })
  const [label, setLabel] = useState('')
  const [draft, setDraft] = useState<{ id: number | null; time: string; label: string; days: number[] } | null>(null)

  const load = useCallback(async () => {
    try {
      setAlarms(await api<PAlarm[]>('planer/alarms'))
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Sekundentakt für Countdowns + lokales Klingeln
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(iv)
  }, [])

  const timers = alarms.filter(a => a.kind === 'timer' && a.enabled && a.next_fire_at)
  const clocks = alarms.filter(a => a.kind === 'alarm')

  // Abgelaufene Timer/Wecker hier klingeln lassen (Server schickt zusätzlich Push)
  useEffect(() => {
    for (const a of alarms) {
      if (!a.enabled || !a.next_fire_at) continue
      const t = new Date(a.next_fire_at).getTime()
      if (t <= now && now - t < 60_000) {
        ring({
          key: `alarm:${a.id}`,
          title: a.kind === 'timer' ? `Timer abgelaufen${a.label ? `: ${a.label}` : ''}` : `Wecker ${fmtTime(new Date(t))}`,
          body: a.kind === 'timer' ? 'Die Zeit ist um.' : a.label || undefined,
          alarmId: a.id,
          canSnooze: a.kind === 'alarm',
        })
        setTimeout(load, 4000) // Server hat den Timer dann beendet / Wecker neu geplant
      }
    }
  }, [now, alarms, ring, load])

  async function startTimer(seconds: number, name = label) {
    if (seconds <= 0) return
    try {
      const a = await api<PAlarm>('planer/alarms', { method: 'POST', json: { kind: 'timer', duration_seconds: seconds, label: name || null } })
      setAlarms(prev => [...prev, a])
      setLabel('')
    } catch (err) {
      toast(`Timer: ${(err as Error).message}`, { ms: 6000 })
    }
  }

  async function cancel(a: PAlarm) {
    setAlarms(prev => prev.filter(x => x.id !== a.id))
    await api(`planer/alarms/${a.id}`, { method: 'DELETE' }).catch(() => load())
  }

  async function toggleAlarm(a: PAlarm) {
    try {
      const u = await api<PAlarm>(`planer/alarms/${a.id}`, { method: 'PATCH', json: { enabled: !a.enabled } })
      setAlarms(prev => prev.map(x => (x.id === u.id ? u : x)))
      if (u.enabled && u.next_fire_at) toast(`Klingelt ${relDay(new Date(u.next_fire_at))}, ${fmtTime(new Date(u.next_fire_at))}`)
    } catch (err) {
      toast(`Wecker: ${(err as Error).message}`)
    }
  }

  async function saveAlarm() {
    if (!draft?.time) return
    const body = { kind: 'alarm', time_of_day: draft.time, label: draft.label || null, days: draft.days, enabled: true }
    try {
      const u = draft.id
        ? await api<PAlarm>(`planer/alarms/${draft.id}`, { method: 'PATCH', json: body })
        : await api<PAlarm>('planer/alarms', { method: 'POST', json: body })
      setDraft(null)
      load()
      if (u.next_fire_at) toast(`Klingelt ${relDay(new Date(u.next_fire_at))}, ${fmtTime(new Date(u.next_fire_at))}`)
    } catch (err) {
      toast(`Wecker: ${(err as Error).message}`, { ms: 6000 })
    }
  }

  const main = timers.sort((a, b) => new Date(a.next_fire_at!).getTime() - new Date(b.next_fire_at!).getTime())[0]
  const mainLeft = main ? (new Date(main.next_fire_at!).getTime() - now) / 1000 : 0
  const mainFrac = main && main.duration_seconds ? Math.max(0, Math.min(1, mainLeft / main.duration_seconds)) : 0
  const R = 100
  const C = 2 * Math.PI * R

  return (
    <>
      {error && <div className="pv-glass pv-empty" style={{ color: 'var(--pv-danger)' }}>{error}</div>}

      <div className="pv-dash">
        {/* Timer */}
        <section className="pv-glass pv-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="pv-h2">Timer</div>
          <div className="pv-timer-ring">
            <svg viewBox="0 0 220 220" width="220" height="220">
              <circle cx="110" cy="110" r={R} fill="none" stroke="rgba(120,40,100,0.1)" strokeWidth="10" />
              <circle cx="110" cy="110" r={R} fill="none" stroke="url(#pvg)" strokeWidth="10" strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={C * (1 - mainFrac)} style={{ transition: 'stroke-dashoffset 0.25s linear' }} />
              <defs>
                <linearGradient id="pvg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#d93690" /><stop offset="1" stopColor="#7c4ae0" /></linearGradient>
              </defs>
            </svg>
            <div className="inner">
              {main ? (
                <>
                  <div className="pv-timer-big" style={{ fontSize: mainLeft >= 3600 ? 40 : 52 }}>{fmtDur(mainLeft)}</div>
                  <div className="pv-muted" style={{ fontSize: 13 }}>{main.label || `Timer ${fmtDur(main.duration_seconds ?? 0)}`}</div>
                </>
              ) : (
                <div className="pv-timer-big" style={{ fontSize: 48 }}>{fmtDur(dur.h * 3600 + dur.m * 60 + dur.s)}</div>
              )}
            </div>
          </div>

          <div className="pv-presets">
            {PRESETS.map(m => <button key={m} className="pv-chip" onClick={() => startTimer(m * 60, label || `${m} Min.`)}>{m} Min.</button>)}
          </div>
          <div className="pv-dur-input">
            <input className="pv-input" type="number" min={0} max={47} value={dur.h} onChange={e => setDur({ ...dur, h: Math.max(0, Number(e.target.value) || 0) })} aria-label="Stunden" />
            <span>:</span>
            <input className="pv-input" type="number" min={0} max={59} value={dur.m} onChange={e => setDur({ ...dur, m: Math.max(0, Math.min(59, Number(e.target.value) || 0)) })} aria-label="Minuten" />
            <span>:</span>
            <input className="pv-input" type="number" min={0} max={59} value={dur.s} onChange={e => setDur({ ...dur, s: Math.max(0, Math.min(59, Number(e.target.value) || 0)) })} aria-label="Sekunden" />
          </div>
          <div className="pv-row">
            <input className="pv-input" placeholder="Name (optional), z.B. Pizza" value={label} onChange={e => setLabel(e.target.value)} />
            <button className="pv-btn primary" onClick={() => startTimer(dur.h * 3600 + dur.m * 60 + dur.s)}><Icon name="play" size={15} /> Start</button>
          </div>

          {timers.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <p className="pv-eyebrow">Laufende Timer</p>
              {timers.map(t => {
                const left = (new Date(t.next_fire_at!).getTime() - now) / 1000
                return (
                  <div key={t.id} className="pv-row" style={{ padding: '6px 4px' }}>
                    <Icon name="timer" size={18} />
                    <b style={{ fontVariantNumeric: 'tabular-nums', width: 80 }}>{fmtDur(left)}</b>
                    <span className="pv-grow pv-ellipsis pv-muted">{t.label || `Timer ${fmtDur(t.duration_seconds ?? 0)}`} · endet {fmtTime(new Date(t.next_fire_at!))}</span>
                    <button className="pv-btn sm danger" onClick={() => cancel(t)}>Stopp</button>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Wecker */}
        <section className="pv-glass pv-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="pv-row">
            <div className="pv-h2 pv-grow">Wecker</div>
            <button className="pv-btn primary sm" onClick={() => setDraft({ id: null, time: '07:00', label: '', days: [1, 2, 3, 4, 5] })}><Icon name="plus" size={15} /> Wecker</button>
          </div>
          {clocks.length === 0 && <div className="pv-empty" style={{ padding: 18 }}>Noch kein Wecker gestellt.</div>}
          {clocks.map(a => (
            <div key={a.id} className={`pv-alarm ${a.enabled ? '' : 'off'}`}>
              <button className="pv-grow" style={{ border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', color: 'inherit', padding: 0 }}
                onClick={() => setDraft({ id: a.id, time: (a.time_of_day ?? '07:00').slice(0, 5), label: a.label ?? '', days: a.days ?? [] })}>
                <div className="pv-alarm-time">{(a.time_of_day ?? '').slice(0, 5)}</div>
                <div className="pv-alarm-info pv-muted" style={{ fontSize: 13, marginTop: 4 }}>
                  {a.label ? `${a.label} · ` : ''}{daysText(a.days ?? [])}
                  {a.enabled && a.next_fire_at && ` · nächstes Mal ${relDay(new Date(a.next_fire_at))}`}
                </div>
              </button>
              <button className={`pv-switch ${a.enabled ? 'on' : ''}`} aria-label={a.enabled ? 'Ausschalten' : 'Einschalten'} onClick={() => toggleAlarm(a)} />
            </div>
          ))}
          <p className="pv-muted" style={{ fontSize: 12, margin: '6px 0 0' }}>
            Wecker und Timer kommen als Push-Benachrichtigung, auch bei geschlossener Seite. Einschalten kannst du das über die Glocke oben.
          </p>
        </section>
      </div>

      {draft && (
        <Portal>
          <div className="pv-overlay sheet" onClick={e => { if (e.target === e.currentTarget) setDraft(null) }}>
            <div className="pv-modal">
              <div className="pv-grip" />
              <div className="pv-h2">{draft.id ? 'Wecker bearbeiten' : 'Neuer Wecker'}</div>
              <input className="pv-input" type="time" value={draft.time} onChange={e => setDraft({ ...draft, time: e.target.value })} style={{ fontSize: 34, textAlign: 'center', minHeight: 70 }} />
              <input className="pv-input" placeholder="Bezeichnung (optional)" value={draft.label} onChange={e => setDraft({ ...draft, label: e.target.value })} />
              <div>
                <label className="pv-label">Wiederholen</label>
                <div className="pv-daypick">
                  {DAY_ORDER.map(d => (
                    <button key={d} className={draft.days.includes(d) ? 'on' : ''} onClick={() => setDraft({ ...draft, days: draft.days.includes(d) ? draft.days.filter(x => x !== d) : [...draft.days, d] })}>
                      {WEEKDAY_SHORT[d]}
                    </button>
                  ))}
                </div>
                <div className="pv-chips" style={{ marginTop: 8 }}>
                  <button className="pv-chip" onClick={() => setDraft({ ...draft, days: [1, 2, 3, 4, 5] })}>Mo–Fr</button>
                  <button className="pv-chip" onClick={() => setDraft({ ...draft, days: [0, 1, 2, 3, 4, 5, 6] })}>Täglich</button>
                  <button className="pv-chip" onClick={() => setDraft({ ...draft, days: [0, 6] })}>Wochenende</button>
                  <button className="pv-chip" onClick={() => setDraft({ ...draft, days: [] })}>Einmalig</button>
                </div>
              </div>
              <div className="pv-modal-actions">
                {draft.id && <button className="pv-btn danger" style={{ marginRight: 'auto' }} onClick={async () => { const a = alarms.find(x => x.id === draft.id); if (a) await cancel(a); setDraft(null) }}><Icon name="trash" size={15} /> Löschen</button>}
                <button className="pv-btn" onClick={() => setDraft(null)}>Abbrechen</button>
                <button className="pv-btn primary" onClick={saveAlarm}>Speichern</button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  )
}