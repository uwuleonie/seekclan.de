'use client'

// Nachrichten wie eine Zeitungs-Startseite:
//  • Überblick: Aufmacher + 3 weitere Top-Meldungen, darunter je eine Spalte Deutschland / Welt / Wirtschaft
//  • Bereich (Deutschland, Welt, Wirtschaft): Aufmacher + 3, darunter eine kompakte Liste (8 Stück, dann „Mehr“)
// Oben die Tages-Zusammenfassung von Claude als schmales Band (aufklappbar).
// Alle vier Feeds werden einmal geladen, das Umschalten geht danach sofort.

import { useEffect, useState } from 'react'
import Icon from '../_components/Icon'
import { openClaude } from '../_lib/ask'

interface Item { title: string; link: string; teaser: string; date: string | null; image: string | null }
interface Briefing { news_date: string; category: 'de' | 'welt' | 'wirtschaft'; headline: string | null; items: { title: string; summary: string; source: string; url: string | null }[]; updated_at: string }

type FeedKey = 'top' | 'inland' | 'ausland' | 'wirtschaft'
const TABS: { key: FeedKey; label: string; brief: Briefing['category'] | null }[] = [
  { key: 'top', label: 'Überblick', brief: null },
  { key: 'inland', label: 'Deutschland', brief: 'de' },
  { key: 'ausland', label: 'Welt', brief: 'welt' },
  { key: 'wirtschaft', label: 'Wirtschaft', brief: 'wirtschaft' },
]
const SECTIONS = TABS.filter(t => t.key !== 'top')
const PAGE = 8
const BRIEF_POINTS = 3

function ago(iso: string | null) {
  if (!iso) return ''
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'gerade eben'
  if (m < 60) return `vor ${m} Min.`
  const h = Math.round(m / 60)
  if (h < 24) return `vor ${h} Std.`
  return new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })
}

const explain = (i: Item) => openClaude(`${i.title}\n${i.teaser}\n${i.link}`, 'explain')

function Thumb({ src, className }: { src: string | null; className: string }) {
  if (!src) return <span className={`${className} pv-nx-noimg`}><Icon name="globe" size={16} /></span>
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={className} src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }} />
}

// Aufmacher links groß (Titel liegt auf dem Bild), rechts drei kleinere Meldungen
function Lead({ items }: { items: Item[] }) {
  const [hero, ...side] = items
  if (!hero) return null
  return (
    <div className="pv-nx-lead">
      <article className={`pv-glass pv-nx-hero ${hero.image ? 'overlay' : ''}`}>
        {hero.image && <a href={hero.link} target="_blank" rel="noopener noreferrer" className="pv-nx-hero-img" tabIndex={-1} aria-hidden="true"><Thumb src={hero.image} className="pv-nx-img" /></a>}
        <div className="pv-nx-hero-body">
          <a href={hero.link} target="_blank" rel="noopener noreferrer" className="pv-nx-hero-title">{hero.title}</a>
          {hero.teaser && <p className="pv-nx-teaser">{hero.teaser}</p>}
          <div className="pv-nx-meta">
            <span>{ago(hero.date)}</span>
            <span className="pv-grow" />
            <button className="pv-btn sm ghost pv-nx-hero-ask" onClick={() => explain(hero)}><Icon name="sparkle" size={13} /> Erklären</button>
          </div>
        </div>
      </article>
      {side.length > 0 && (
        <div className="pv-nx-side">
          {side.slice(0, 3).map(i => (
            <article key={i.link} className="pv-glass pv-nx-card">
              <a href={i.link} target="_blank" rel="noopener noreferrer" className="pv-nx-card-link">
                <Thumb src={i.image} className="pv-nx-card-img" />
                <span className="pv-nx-card-title">{i.title}</span>
              </a>
              <div className="pv-nx-meta">
                <span>{ago(i.date)}</span>
                <span className="pv-grow" />
                <button className="pv-nx-ask" onClick={() => explain(i)} aria-label="Claude erklärt die Nachricht" title="Erklären"><Icon name="sparkle" size={14} /></button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

// Schmale Zeile: kleines Bild, Titel, Zeit, Erklären
function Row({ item, thumb = true }: { item: Item; thumb?: boolean }) {
  return (
    <li className="pv-nx-row">
      <a href={item.link} target="_blank" rel="noopener noreferrer" className="pv-nx-row-link" title={item.teaser || item.title}>
        {thumb && <Thumb src={item.image} className="pv-nx-row-img" />}
        <span className="pv-nx-row-text">
          <span className="pv-nx-row-title">{item.title}</span>
          <span className="pv-nx-row-time">{ago(item.date)}</span>
        </span>
      </a>
      <button className="pv-nx-ask" onClick={() => explain(item)} aria-label="Claude erklärt die Nachricht" title="Erklären"><Icon name="sparkle" size={14} /></button>
    </li>
  )
}

export default function News() {
  const [tab, setTab] = useState<FeedKey>('top')
  const [feeds, setFeeds] = useState<Partial<Record<FeedKey, Item[]>>>({})
  const [errors, setErrors] = useState<Partial<Record<FeedKey, string>>>({})
  const [shown, setShown] = useState(PAGE)
  const [briefings, setBriefings] = useState<Briefing[] | null>(null)
  const [briefDate, setBriefDate] = useState<string | null>(null)
  const [briefOpen, setBriefOpen] = useState(false)

  useEffect(() => {
    let alive = true
    for (const t of TABS) {
      fetch(`/api/private/news?cat=${t.key}`, { cache: 'no-store' })
        .then(async r => {
          const d = await r.json().catch(() => ({}))
          if (!r.ok) throw new Error(d.detail ? `${d.error} – Grund: ${d.detail}` : d.error || `Fehler ${r.status}`)
          if (alive) setFeeds(f => ({ ...f, [t.key]: d.items ?? [] }))
        })
        .catch(e => {
          if (!alive) return
          setErrors(x => ({ ...x, [t.key]: (e as Error).message }))
          setFeeds(f => ({ ...f, [t.key]: [] }))
        })
    }
    fetch('/api/private/news/briefing?days=14', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : []))
      .then((d: Briefing[]) => { if (!alive) return; setBriefings(d); if (d[0]) setBriefDate(d[0].news_date) })
      .catch(() => { if (alive) setBriefings([]) })
    return () => { alive = false }
  }, [])

  function pick(t: FeedKey) { setTab(t); setShown(PAGE); setBriefOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  const current = TABS.find(t => t.key === tab)!
  const items = feeds[tab]
  const error = errors[tab]

  // Zusammenfassung für den gewählten Tag / Bereich
  const dates = [...new Set((briefings ?? []).map(b => b.news_date))]
  const dayBriefs = (briefings ?? []).filter(b => b.news_date === briefDate)
  const briefs = current.brief ? dayBriefs.filter(b => b.category === current.brief) : dayBriefs
  const points = briefs.flatMap(b => b.items.map(i => ({ ...i, cat: b.category })))
  const visiblePoints = briefOpen ? points : points.slice(0, BRIEF_POINTS)

  // Überblick: Meldungen, die schon oben stehen, nicht in den Spalten wiederholen
  const leadLinks = new Set((feeds.top ?? []).slice(0, 4).map(i => i.link))

  return (
    <div className="pv-nx">
      <div className="pv-chips">
        {TABS.map(t => <button key={t.key} className={`pv-chip ${tab === t.key ? 'active' : ''}`} onClick={() => pick(t.key)}>{t.label}</button>)}
      </div>

      {/* Tages-Zusammenfassung als Band */}
      {briefings && briefings.length === 0 ? (
        <div className="pv-nx-brief-empty"><Icon name="sparkle" size={14} /> Die Tages-Zusammenfassung von Claude erscheint hier, sobald die geplante Aufgabe läuft.</div>
      ) : briefings && (
        <section className="pv-glass pv-nx-brief">
          <div className="pv-nx-brief-head">
            <span className="pv-tile-icon" style={{ width: 28, height: 28, borderRadius: 9 }}><Icon name="sparkle" size={14} /></span>
            <b>Tages-Zusammenfassung</b>
            <span className="pv-muted" style={{ fontSize: 12 }}>von Claude</span>
            <span className="pv-grow" />
            {dates.length > 1 && (
              <select className="pv-input" style={{ width: 'auto', minHeight: 28, fontSize: 12.5, padding: '2px 8px' }} value={briefDate ?? ''} onChange={e => { setBriefDate(e.target.value); setBriefOpen(false) }} aria-label="Tag">
                {dates.map(d => <option key={d} value={d}>{new Date(`${d}T12:00`).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })}</option>)}
              </select>
            )}
          </div>
          {!points.length && <p className="pv-muted" style={{ fontSize: 13, margin: '4px 0 0' }}>Für diesen Bereich gibt es an dem Tag keine Zusammenfassung.</p>}
          {points.length > 0 && (
            <ol className="pv-nx-points">
              {visiblePoints.map((p, n) => (
                <li key={n}>
                  <b>{p.title}</b>
                  <span>{p.summary}{p.url && <> <a href={p.url} target="_blank" rel="noopener noreferrer nofollow" className="pv-link">{p.source || 'Quelle'}</a></>}</span>
                </li>
              ))}
            </ol>
          )}
          {points.length > BRIEF_POINTS && (
            <button className="pv-btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setBriefOpen(o => !o)}>
              {briefOpen ? 'Weniger anzeigen' : `Alle ${points.length} Punkte anzeigen`}
            </button>
          )}
        </section>
      )}

      {error && <div className="pv-glass pv-card" style={{ color: 'var(--pv-danger)', fontSize: 13.5 }}>{error}</div>}
      {!items && <div className="pv-center" style={{ padding: 40 }}><div className="pv-spinner" /></div>}

      {items && items.length > 0 && <Lead items={items.slice(0, 4)} />}

      {/* Überblick: drei Spalten */}
      {tab === 'top' && items && (
        <div className="pv-nx-cols">
          {SECTIONS.map(s => {
            const list = feeds[s.key]
            return (
              <section key={s.key} className="pv-glass pv-nx-col">
                <button className="pv-nx-col-head" onClick={() => pick(s.key)}>
                  <span>{s.label}</span>
                  <Icon name="next" size={15} />
                </button>
                {!list && <div className="pv-center" style={{ padding: 20 }}><div className="pv-spinner" /></div>}
                {list && list.length === 0 && <p className="pv-muted" style={{ fontSize: 13, margin: 0 }}>Gerade nicht erreichbar.</p>}
                <ul className="pv-nx-rows">
                  {(list ?? []).filter(i => !leadLinks.has(i.link)).slice(0, 5).map(i => <Row key={i.link} item={i} thumb={false} />)}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      {/* Bereich: kompakte Liste */}
      {tab !== 'top' && items && items.length > 4 && (
        <section className="pv-glass pv-nx-more">
          <p className="pv-eyebrow" style={{ margin: '0 0 4px' }}>Weitere Meldungen</p>
          <ul className="pv-nx-rows two">
            {items.slice(4, 4 + shown).map(i => <Row key={i.link} item={i} />)}
          </ul>
          {items.length > 4 + shown && (
            <button className="pv-btn sm ghost" style={{ alignSelf: 'center' }} onClick={() => setShown(s => s + PAGE)}>
              Mehr anzeigen ({items.length - 4 - shown} weitere)
            </button>
          )}
        </section>
      )}

      {items && items.length > 0 && <p className="pv-muted" style={{ fontSize: 11, textAlign: 'center', margin: 0 }}>tagesschau.de · alle 10 Minuten aktualisiert</p>}
    </div>
  )
}