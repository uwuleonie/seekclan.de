'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Icon from '../_components/Icon'

interface Best { accuracy: number; mode: string; seconds: number; date: string }

export default function GeoGuessrHub() {
  const [best, setBest] = useState<Best | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('pv-geo-japan-best')
      if (raw) setBest(JSON.parse(raw))
    } catch { /* egal */ }
  }, [])

  return (
    <div className="pv-page">
      <div className="pv-page-head">
        <div>
          <p className="pv-eyebrow">Lernen & Üben</p>
          <h1 className="pv-title">GeoGuessr</h1>
          <p className="pv-subtitle">Regionen erkennen, Karten verinnerlichen, schneller raten.</p>
        </div>
      </div>

      <div className="pv-geo-tiles">
        <Link href="/private/geoguessr/japan" className="pv-glass pv-geo-tile">
          <div className="pv-row">
            <span className="pv-tile-icon"><Icon name="flag" /></span>
            <div className="pv-grow">
              <div className="pv-h2">Japan</div>
              <div className="pv-muted" style={{ fontSize: 13 }}>8 Regionen · 47 Präfekturen</div>
            </div>
            <Icon name="next" size={18} />
          </div>
          <div className="pv-muted" style={{ fontSize: 13.5 }}>
            Karte erkunden, Präfekturen anklicken oder Namen zuordnen. Mit Zoom für die kleinen Präfekturen rund um Tokio und Osaka.
          </div>
          {best ? (
            <span className="pv-badge ok" style={{ alignSelf: 'flex-start' }}>
              Bestwert: {best.accuracy} % · {best.mode === 'regions' ? 'Regionen' : 'Präfekturen'}
            </span>
          ) : (
            <span className="pv-badge" style={{ alignSelf: 'flex-start' }}>Noch nicht gespielt</span>
          )}
        </Link>
      </div>

      <section className="pv-glass pv-card">
        <div className="pv-h2" style={{ marginBottom: 12 }}>So funktionieren die Modi</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
          {[
            { icon: 'book', title: 'Lernen', text: 'Frei auf der Karte tippen – Name und Region werden angezeigt.' },
            { icon: 'pointer', title: 'Auf Karte finden', text: 'Ein Name wird genannt, du tippst die richtige Stelle an.' },
            { icon: 'target', title: 'Namen zuordnen', text: 'Eine Fläche ist markiert, du wählst aus vier Namen.' },
            { icon: 'shuffle', title: 'Gemischt', text: 'Beide Fragearten zufällig abwechselnd.' },
          ].map(m => (
            <div key={m.title} className="pv-row" style={{ alignItems: 'flex-start' }}>
              <span className="pv-tile-icon" style={{ width: 38, height: 38, borderRadius: 12 }}><Icon name={m.icon} size={18} /></span>
              <div>
                <b style={{ fontSize: 14 }}>{m.title}</b>
                <div className="pv-muted" style={{ fontSize: 13 }}>{m.text}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}