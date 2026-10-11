'use client'

// Kalender & Updates: was wurde wann freigeschaltet, was kommt als Nächstes, wann laufen XP-Boosts

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useGeo } from '../_components/GeoShell'
import Icon from '../_components/Icon'
import { fmtRelease } from '../_components/QuizTile'
import { countryName } from '../_lib/catalog'
import type { CatalogEntry } from '../_lib/types'

type CalEvent =
  | { kind: 'quiz'; at: number; e: CatalogEntry; future: boolean }
  | { kind: 'boost'; at: number; end: number; label: string; factor: number }

const DAY = 86400_000
const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const ymd = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
const fmtFactor = (f: number) => `×${String(Math.round(f * 100) / 100).replace('.', ',')}`

export default function UpdatesPage() {
  const { status, loaded, catalog, bereichName, boosts } = useGeo()
  const list = useMemo(() => catalog.map(e => ({ e, st: status(e) })), [status, catalog])
  const released = list.filter(x => x.st.released).sort((a, b) => b.st.releaseAt!.localeCompare(a.st.releaseAt!))
  const upcoming = list.filter(x => x.st.releaseAt && !x.st.released && !x.st.hidden).sort((a, b) => a.st.releaseAt!.localeCompare(b.st.releaseAt!))
  const soon = list.filter(x => !x.st.releaseAt)

  // Freigeschaltet nach Tagen, "Bald verfügbar" nach Bereichen – damit es übersichtlich bleibt
  const releasedByDay = useMemo(() => {
    const m = new Map<string, typeof released>()
    for (const x of released) {
      const d = new Date(x.st.releaseAt!).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      m.set(d, [...(m.get(d) ?? []), x])
    }
    return [...m.entries()]
  }, [released])
  const soonByBereich = useMemo(() => {
    const m = new Map<string, typeof soon>()
    for (const x of soon) m.set(x.e.bereich, [...(m.get(x.e.bereich) ?? []), x])
    return [...m.entries()]
  }, [soon])

  const where = (e: CatalogEntry) => [bereichName(e.bereich), e.country ? countryName(e.country) : null].filter(Boolean).join(' · ')

  /* ── Kalender ── */
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [day, setDay] = useState<string | null>(null)

  const events = useMemo(() => {
    const out: CalEvent[] = []
    for (const x of [...released, ...upcoming]) out.push({ kind: 'quiz', at: Date.parse(x.st.releaseAt!), e: x.e, future: !x.st.released })
    for (const b of boosts) out.push({ kind: 'boost', at: Date.parse(b.startsAt), end: Date.parse(b.endsAt), label: b.label, factor: b.factor })
    return out
  }, [released, upcoming, boosts])

  const cells = useMemo(() => {
    const first = new Date(month)
    const offset = (first.getDay() + 6) % 7
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset)
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
      const t0 = d.getTime(), t1 = t0 + DAY
      const evs = events.filter(ev => (ev.kind === 'quiz' ? ev.at >= t0 && ev.at < t1 : ev.at < t1 && ev.end > t0))
      return { d, key: ymd(d), inMonth: d.getMonth() === month.getMonth(), today: ymd(d) === ymd(new Date()), evs }
    })
  }, [month, events])
  const selected = cells.find(c => c.key === day)

  return (
    <div className="ga-page" style={{ maxWidth: 980 }}>
      <Link href="/geo" className="ga-btn ghost sm" style={{ marginLeft: -10 }}><Icon name="back" size={15} /> Atlas</Link>
      <p className="ga-eyebrow" style={{ marginTop: 8 }}>Kalender</p>
      <h1 className="ga-title">Was kam wann?</h1>
      <p className="ga-lead">Alle Freischaltungen und XP-Boosts im Kalender – dazu, was als Nächstes kommt.</p>

      {!loaded ? <div className="ga-map-loading">Lädt …</div> : (
        <>
          <section className="ga-section">
            <div className="ga-card ga-cal">
              <div className="ga-cal-head">
                <button className="ga-icon-btn" aria-label="Voriger Monat" onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}><Icon name="back" size={16} /></button>
                <b>{month.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</b>
                <button className="ga-icon-btn" aria-label="Nächster Monat" onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}><Icon name="next" size={16} /></button>
              </div>
              <div className="ga-cal-grid">
                {WEEKDAYS.map(w => <span key={w} className="ga-cal-wd">{w}</span>)}
                {cells.map(c => {
                  const quizzes = c.evs.filter(e => e.kind === 'quiz').length
                  const boost = c.evs.some(e => e.kind === 'boost')
                  return (
                    <button key={c.key} className={`ga-cal-day ${c.inMonth ? '' : 'out'} ${c.today ? 'today' : ''} ${day === c.key ? 'sel' : ''} ${boost ? 'boost' : ''}`}
                      onClick={() => setDay(c.key === day ? null : c.key)} aria-label={c.d.toLocaleDateString('de-DE')}>
                      <span className="n">{c.d.getDate()}</span>
                      {quizzes > 0 && <span className="q">{quizzes} {quizzes === 1 ? 'Quiz' : 'Quizzes'}</span>}
                      {boost && <span className="b">Boost</span>}
                    </button>
                  )
                })}
              </div>
              {selected && (
                <div className="ga-cal-list">
                  <p className="ga-eyebrow">{selected.d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                  {selected.evs.length === 0 ? <p className="ga-muted">Nichts an diesem Tag.</p> : selected.evs.map((ev, i) => ev.kind === 'boost' ? (
                    <div key={i} className="ga-tl-item">
                      <span className="ga-tl-date">{fmtFactor(ev.factor)} XP</span>
                      <span><b>{ev.label}</b> <span className="ga-muted">· {new Date(ev.at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} bis {new Date(ev.end).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></span>
                    </div>
                  ) : (
                    <Link key={i} href={`/geo/quiz/${ev.e.slug}`} className="ga-tl-item">
                      <span className="ga-tl-date">{new Date(ev.at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</span>
                      <span><b>{ev.e.title}</b> {ev.future && <span className="ga-badge date" style={{ marginLeft: 4 }}>geplant</span>}<span className="ga-muted"> · {where(ev.e)}</span></span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>

          {upcoming.length > 0 && (
            <section className="ga-section">
              <h2 className="ga-h2" style={{ marginBottom: 12 }}>Demnächst</h2>
              <div className="ga-card ga-timeline">
                {upcoming.map(x => (
                  <div key={x.e.slug} className="ga-tl-item">
                    <span className="ga-tl-date">{fmtRelease(x.st.releaseAt!)}</span>
                    <span><b>{x.e.title}</b> <span className="ga-muted">· {where(x.e)} · {x.e.meta}</span></span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="ga-section">
            <h2 className="ga-h2" style={{ marginBottom: 12 }}>Freigeschaltet</h2>
            {released.length === 0 ? <p className="ga-muted">Noch nichts – bald geht&apos;s los.</p> : releasedByDay.map(([day, xs]) => (
              <div key={day} style={{ marginBottom: 14 }}>
                <p className="ga-eyebrow" style={{ margin: '0 0 6px' }}>{day} · {xs.length} {xs.length === 1 ? 'Quiz' : 'Quizzes'}</p>
                <div className="ga-card ga-timeline">
                  {xs.map(x => (
                    <Link key={x.e.slug} href={`/geo/quiz/${x.e.slug}`} className="ga-tl-item">
                      <span className="ga-tl-date">{new Date(x.st.releaseAt!).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</span>
                      <span>
                        <b>{x.e.title}</b> {x.st.isNew && <span className="ga-badge new" style={{ marginLeft: 4 }}>Neu</span>}
                        <span className="ga-muted"> · {where(x.e)} · {x.e.meta}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </section>

          {soon.length > 0 && (
            <section className="ga-section">
              <h2 className="ga-h2" style={{ marginBottom: 12 }}>Bald verfügbar</h2>
              {soonByBereich.map(([b, xs]) => (
                <div key={b} style={{ marginBottom: 12 }}>
                  <p className="ga-eyebrow" style={{ margin: '0 0 6px' }}>{bereichName(b as CatalogEntry['bereich'])} · {xs.length}</p>
                  <div className="ga-chips">
                    {xs.map(x => <span key={x.e.slug} className="ga-chip sm" style={{ cursor: 'default' }}>{x.e.title}{x.e.country ? ` · ${countryName(x.e.country)}` : ''}</span>)}
                  </div>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  )
}