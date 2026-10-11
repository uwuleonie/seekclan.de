'use client'

// „Angefangen“: alle Quizzes, die mittendrin verlassen wurden – mit Fortschritt, Fortsetzen und Verwerfen.
// Spielstände liegen im Browser (localStorage) und, wenn eingeloggt, im Konto (siehe _lib/saves.ts).

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Icon from './Icon'
import { useGeo } from './GeoShell'
import { dropSave, listAllSaves, saveProgress, type SaveState } from '../_lib/saves'

const fmtWann = (iso: string) => new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const MODE_DE: Record<string, string> = { click: 'Auf Karte finden', name: 'Namen zuordnen', type: 'Eintippen', text: 'Wissen', mixed: 'Gemischt' }

export default function AngefangeneQuizzes() {
  const { loggedIn, loaded } = useGeo()
  const [saves, setSaves] = useState<SaveState[] | null>(null)
  const [frage, setFrage] = useState<string | null>(null)
  useEffect(() => {
    if (!loaded) return
    let alive = true
    listAllSaves(loggedIn).then(s => { if (alive) setSaves(s) })
    return () => { alive = false }
  }, [loaded, loggedIn])
  if (!saves?.length) return null

  const weg = (slug: string) => {
    dropSave(slug, loggedIn)
    setSaves(s => (s ?? []).filter(x => x.slug !== slug))
    setFrage(null)
  }
  return (
    <section className="ga-section">
      <div className="ga-section-head">
        <div>
          <p className="ga-eyebrow">Weitermachen</p>
          <h2 className="ga-h2">Angefangene Quizzes</h2>
        </div>
        <span className="ga-muted" style={{ fontSize: 13 }}>{loggedIn ? 'Aus deinem Konto und diesem Browser' : 'In diesem Browser gespeichert'}</span>
      </div>
      <div className="ga-weiter-liste">
        {saves.map(s => {
          const p = saveProgress(s)
          const href = s.href + (s.href.includes('?') ? '&' : '?') + 'weiter=1'
          return (
            <div key={s.slug} className="ga-card ga-weiter">
              <div className="ga-grow" style={{ minWidth: 0 }}>
                <b className="ga-weiter-titel">{s.title}</b>
                <small className="ga-muted">{MODE_DE[s.mode] ?? s.mode} · {p.done} von {p.total} · {p.accuracy} % richtig · zuletzt {fmtWann(s.savedAt)}</small>
                <span className="ga-weiter-bar"><span style={{ width: `${p.total ? (p.done / p.total) * 100 : 0}%` }} /></span>
              </div>
              {frage === s.slug ? (
                <span className="ga-row" style={{ gap: 6 }}>
                  <button className="ga-btn danger sm" onClick={() => weg(s.slug)}>Ja, löschen</button>
                  <button className="ga-btn ghost sm" onClick={() => setFrage(null)}>Abbrechen</button>
                </span>
              ) : (
                <span className="ga-row" style={{ gap: 6 }}>
                  <Link href={href} className="ga-btn primary sm"><Icon name="play" size={14} /> Fortsetzen</Link>
                  <button className="ga-icon-btn" aria-label="Spielstand verwerfen" title="Verwerfen" onClick={() => setFrage(s.slug)}><Icon name="x" size={15} /></button>
                </span>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}