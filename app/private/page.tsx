'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Icon from '././_components/Icon'
import { usePrivate } from '././_components/PrivateShell'
import { getDeviceId } from './_lib/device'
import { KIND_ICON, formatBytes, formatWhen, thumbUrl, type PFile } from './_lib/files'

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

  const today = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
  const myDevice = typeof window !== 'undefined' ? getDeviceId() : ''
  const recent = (files ?? []).slice(0, 12)

  return (
    <div className="pv-page">
      {/* Begrüßung + Schnell senden */}
      <section className="pv-glass pv-hero">
        <div>
          <p className="pv-eyebrow">{today}</p>
          <h1 className="pv-title">{greeting()}, {displayName}</h1>
          <p className="pv-subtitle">
            {unseen > 0
              ? `${unseen} ${unseen === 1 ? 'neue Datei wartet' : 'neue Dateien warten'} in Quick Share.`
              : 'Alles ruhig – keine neuen Dateien von deinen anderen Geräten.'}
          </p>
        </div>
        <div className="pv-hero-actions">
          <button className="pv-btn primary lg" onClick={() => input.current?.click()}>
            <Icon name="upload" /> Dateien senden
          </button>
          <Link href="/private/dateien" className="pv-btn lg">
            <Icon name="share" /> Quick Share
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
                  {f.has_thumb
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={thumbUrl(f.id)} alt={f.original_name} loading="lazy" />
                    : <Icon name={KIND_ICON[f.kind]} size={26} stroke={1.4} />}
                  {!f.seen_at && f.device_id !== myDevice && (
                    <span className="pv-badge new" style={{ position: 'absolute', top: 5, left: 5, fontSize: 10 }}>Neu</span>
                  )}
                </Link>
              ))}
            </div>
          )}
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
          <Link href="/private/geoguessr" className="pv-tile-link">
            <span className="pv-tile-icon"><Icon name="globe" /></span>
            <span className="pv-grow">
              <b style={{ display: 'block' }}>GeoGuessr</b>
              <span className="pv-muted" style={{ fontSize: 13 }}>{geoBest ? `Bestwert Japan: ${geoBest}` : 'Regionen & Präfekturen lernen'}</span>
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
        Tipp am PC: Alt + 1 bis 4 wechselt zwischen den Bereichen · Dateien überall hineinziehen oder mit Strg+V einfügen
      </p>
    </div>
  )
}