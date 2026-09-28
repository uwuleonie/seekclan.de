'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Icon from './_components/Icon'
import { usePrivate } from './_components/PrivateShell'
import ClockWeather from './_components/ClockWeather'
import TodayCard from './_components/TodayCard'
import { getDeviceId } from './_lib/device'
import FileThumb from './_components/FileThumb'
import { formatBytes, formatWhen, type PFile } from './_lib/files'
import { openClaude, openGoogle } from './_lib/ask'

interface Headline { title: string; link: string; date: string | null }

interface NoteLite { id: number; title: string; content: string; updated_at: string }

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Gute Nacht'
  if (h < 11) return 'Guten Morgen'
  if (h < 17) return 'Hallo'
  if (h < 22) return 'Guten Abend'
  return 'Gute Nacht'
}

export default function PrivateHome() {
  const { displayName, isLeonie, upload, stamp, unseen, toast } = usePrivate()
  const [files, setFiles] = useState<PFile[] | null>(null)
  const [notes, setNotes] = useState<NoteLite[] | null>(null)
  const [geoBest, setGeoBest] = useState<string | null>(null)
  const [news, setNews] = useState<Headline[] | null>(null)
  const [query, setQuery] = useState('')
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/private/files', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : { files: [] }))
      .then(d => setFiles(d.files ?? []))
      .catch(() => setFiles([]))
  }, [stamp])

  useEffect(() => {
    if (!isLeonie) return
    fetch('/api/private/leonie/notes')
      .then(r => (r.ok ? r.json() : []))
      .then(setNotes)
      .catch(() => setNotes([]))
  }, [isLeonie])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('pv-geo-japan-best')
      if (raw) {
        const b = JSON.parse(raw)
        setGeoBest(`${b.accuracy} % Trefferquote (${b.mode === 'regions' ? 'Regionen' : 'Präfekturen'})`)
      }
    } catch { /* egal */ }
  }, [])

  useEffect(() => {
    fetch('/api/private/news?cat=top', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : { items: [] }))
      .then(d => setNews((d.items ?? []).slice(0, 6)))
      .catch(() => setNews([]))
  }, [])

  const today = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
  const myDevice = typeof window !== 'undefined' ? getDeviceId() : ''
  const recent = (files ?? []).slice(0, 12)

  return (
    <div className="pv-page">
      {/* Uhr, Wetter, Begrüßung */}
      <ClockWeather greeting={`${greeting()}, ${displayName}`} />

      {/* Suchen: Google oder Claude */}
      <form
        className="pv-glass pv-searchbar"
        onSubmit={e => { e.preventDefault(); if (query.trim()) openGoogle(query) }}
      >
        <Icon name="search" size={18} />
        <input className="pv-grow" value={query} onChange={e => setQuery(e.target.value)} placeholder="Suchen oder Claude fragen …" aria-label="Suchbegriff" enterKeyHint="search" />
        <button type="submit" className="pv-btn sm" disabled={!query.trim()}>Google</button>
        <button type="button" className="pv-btn sm primary" disabled={!query.trim()} onClick={() => { openClaude(query); setQuery('') }}>
          <Icon name="sparkle" size={14} /> Claude
        </button>
      </form>

      {/* Schnellzugriff */}
      <section className="pv-glass pv-hero" style={{ padding: '14px 18px' }}>
        <p className="pv-subtitle" style={{ margin: 0 }}>
          {unseen > 0
            ? `${unseen} ${unseen === 1 ? 'neue Datei wartet' : 'neue Dateien warten'} in Quick Share.`
            : 'Keine neuen Dateien von deinen anderen Geräten.'}
        </p>
        <div className="pv-hero-actions">
          <button className="pv-btn primary" onClick={() => input.current?.click()}>
            <Icon name="upload" /> Dateien senden
          </button>
          <Link href="/private/planer/reminder" className="pv-btn">
            <Icon name="check" /> Reminder
          </Link>
          <Link href="/private/planer/wecker" className="pv-btn pv-desktop-only">
            <Icon name="timer" /> Timer
          </Link>
          <input
            ref={input}
            type="file"
            multiple
            hidden
            onChange={e => {
              if (e.target.files?.length) {
                upload(e.target.files)
                toast('Wird gesendet – du kannst die Seite weiter benutzen')
              }
              e.target.value = ''
            }}
          />
        </div>
      </section>

      <div className="pv-dash">
        <TodayCard />
        {/* Neueste Dateien */}
        <section className="pv-glass pv-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="pv-row">
            <div className="pv-grow">
              <div className="pv-h2">Zuletzt geteilt</div>
              <div className="pv-muted" style={{ fontSize: 13 }}>
                {files ? `${files.length} Dateien · ${formatBytes(files.reduce((s, f) => s + f.size_bytes, 0))}` : 'lädt …'}
              </div>
            </div>
            <Link href="/private/dateien" className="pv-btn sm">Alle <Icon name="next" size={14} /></Link>
          </div>
          {files === null ? (
            <div className="pv-center" style={{ padding: 20 }}><div className="pv-spinner" /></div>
          ) : recent.length === 0 ? (
            <div className="pv-empty" style={{ padding: 20 }}>Noch nichts geteilt. Am Handy auf „Dateien senden“ tippen.</div>
          ) : (
            <div className="pv-mini-grid">
              {recent.map(f => (
                <Link key={f.id} href="/private/dateien" className="pv-mini-thumb" title={`${f.original_name} · ${formatWhen(f.created_at)}`}>
                  <FileThumb file={f} iconSize={26} alt={f.original_name} />
                  {!f.seen_at && f.device_id !== myDevice && (
                    <span className="pv-badge new" style={{ position: 'absolute', top: 5, left: 5, fontSize: 10 }}>Neu</span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Nachrichten */}
        <section className="pv-glass pv-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="pv-row">
            <div className="pv-grow">
              <div className="pv-h2">Nachrichten</div>
              <div className="pv-muted" style={{ fontSize: 13 }}>Top-Themen von tagesschau.de</div>
            </div>
            <Link href="/private/aktuell" className="pv-btn sm">Mehr <Icon name="next" size={14} /></Link>
          </div>
          {news === null && <div className="pv-center" style={{ padding: 16 }}><div className="pv-spinner" /></div>}
          {news && news.length === 0 && <div className="pv-muted" style={{ fontSize: 13 }}>Gerade nicht erreichbar.</div>}
          {news?.map(n => (
            <a key={n.link} href={n.link} target="_blank" rel="noopener noreferrer" className="pv-headline">
              <span className="pv-grow">{n.title}</span>
              {n.date && <span className="pv-muted" style={{ fontSize: 11.5, flexShrink: 0 }}>{new Date(n.date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>}
            </a>
          ))}
        </section>

        {/* Bereiche */}
        <section className="pv-glass pv-card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="pv-h2" style={{ marginBottom: 6 }}>Bereiche</div>
          <Link href="/private/dateien" className="pv-tile-link">
            <span className="pv-tile-icon"><Icon name="share" /></span>
            <span className="pv-grow">
              <b style={{ display: 'block' }}>Quick Share</b>
              <span className="pv-muted" style={{ fontSize: 13 }}>Fotos, Videos & Dateien zwischen Handy und PC</span>
            </span>
            <Icon name="next" size={16} />
          </Link>
          <Link href="/private/planer" className="pv-tile-link">
            <span className="pv-tile-icon"><Icon name="calendar" /></span>
            <span className="pv-grow">
              <b style={{ display: 'block' }}>Planer</b>
              <span className="pv-muted" style={{ fontSize: 13 }}>Kalender, Reminder, Stundenplan, Wecker & Timer</span>
            </span>
            <Icon name="next" size={16} />
          </Link>
          {isLeonie && (
            <Link href="/private/leonie" className="pv-tile-link">
              <span className="pv-tile-icon"><Icon name="notes" /></span>
              <span className="pv-grow">
                <b style={{ display: 'block' }}>Notizen</b>
                <span className="pv-muted" style={{ fontSize: 13 }}>{notes ? `${notes.length} Notizen` : 'Ordner, Links, Teilen per Link'}</span>
              </span>
              <Icon name="next" size={16} />
            </Link>
          )}
          <Link href="/private/aktuell" className="pv-tile-link">
            <span className="pv-tile-icon"><Icon name="flag" /></span>
            <span className="pv-grow">
              <b style={{ display: 'block' }}>Aktuell</b>
              <span className="pv-muted" style={{ fontSize: 13 }}>Nachrichten, Ergebnisse & Tabellen</span>
            </span>
            <Icon name="next" size={16} />
          </Link>
          <Link href="/private/tools" className="pv-tile-link">
            <span className="pv-tile-icon"><Icon name="tools" /></span>
            <span className="pv-grow">
              <b style={{ display: 'block' }}>Werkzeuge</b>
              <span className="pv-muted" style={{ fontSize: 13 }}>Bild, Farbe, Rechner, Währung, Passwort</span>
            </span>
            <Icon name="next" size={16} />
          </Link>
          <Link href="/private/geoguessr" className="pv-tile-link">
            <span className="pv-tile-icon"><Icon name="globe" /></span>
            <span className="pv-grow">
              <b style={{ display: 'block' }}>GeoGuessr</b>
              <span className="pv-muted" style={{ fontSize: 13 }}>{geoBest ? `Bestwert Japan: ${geoBest}` : 'Japan, USA, Brasilien, Indien, Türkei, Kyrillisch'}</span>
            </span>
            <Icon name="next" size={16} />
          </Link>
        </section>

        {/* Letzte Notizen */}
        {isLeonie && notes && notes.length > 0 && (
          <section className="pv-glass pv-card" style={{ gridColumn: '1 / -1' }}>
            <div className="pv-row" style={{ marginBottom: 8 }}>
              <div className="pv-h2 pv-grow">Letzte Notizen</div>
              <Link href="/private/leonie" className="pv-btn sm">Öffnen <Icon name="next" size={14} /></Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 4 }}>
              {notes.slice(0, 6).map(n => (
                <Link key={n.id} href={`/private/leonie?note=${n.id}`} className="pv-list-link">
                  <span className="pv-tile-icon" style={{ width: 36, height: 36, borderRadius: 11 }}><Icon name="notes" size={17} /></span>
                  <span className="pv-grow" style={{ minWidth: 0 }}>
                    <b className="pv-ellipsis" style={{ display: 'block', fontSize: 14 }}>{n.title}</b>
                    <span className="pv-muted pv-ellipsis" style={{ display: 'block', fontSize: 12 }}>
                      {formatWhen(n.updated_at)} · {n.content.replace(/\s+/g, ' ').slice(0, 60) || 'leer'}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      <p className="pv-muted pv-desktop-only" style={{ fontSize: 12, textAlign: 'center', marginTop: 8 }}>
        Tipp am PC: Alt + 1 bis 7 wechselt zwischen den Bereichen · Text markieren → Claude oder Google · Dateien überall hineinziehen oder mit Strg+V einfügen
      </p>
    </div>
  )
}