'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Icon from '../_components/Icon'

interface Tile {
  href: string
  code: string
  title: string
  meta: string
  text: string
  /** localStorage-Schlüssel der Bestwerte (erste gefundene wird angezeigt) */
  bestKeys: { key: string; label: string }[]
}

const TILES: Tile[] = [
  {
    href: '/private/geoguessr/japan', code: 'JP', title: 'Japan', meta: '8 Regionen · 47 Präfekturen',
    text: 'Präfekturen anklicken oder Namen zuordnen. Mit Zoom für die kleinen Präfekturen rund um Tokio und Osaka.',
    bestKeys: [{ key: 'pv-geo-japan-best', label: '' }],
  },
  {
    href: '/private/geoguessr/usa', code: 'US', title: 'USA', meta: '50 Staaten · Hauptstädte',
    text: 'Alle Bundesstaaten und ihre Hauptstädte – auf der Karte finden, zuordnen oder direkt abfragen.',
    bestKeys: [{ key: 'pv-geo-usa-states-best', label: 'Staaten' }, { key: 'pv-geo-usa-capitals-best', label: 'Hauptstädte' }],
  },
  {
    href: '/private/geoguessr/brasilien', code: 'BR', title: 'Brasilien', meta: '67 Vorwahlen · 27 Bundesstaaten',
    text: 'Telefon-Vorwahlen (DDD) von Schildern und Werbung einer Gegend zuordnen – die erste Ziffer verrät schon viel.',
    bestKeys: [{ key: 'pv-geo-brasilien-ddd-best', label: 'Vorwahlen' }, { key: 'pv-geo-brasilien-uf-best', label: 'Staaten' }],
  },
  {
    href: '/private/geoguessr/indien', code: 'IN', title: 'Indien', meta: '17 Sprachen · 36 Staaten',
    text: 'Welche Sprache und Schrift wo? Mit Beispielwörtern in Hindi, Tamil, Telugu, Bengalisch und mehr.',
    bestKeys: [{ key: 'pv-geo-indien-langs-best', label: 'Sprachen' }, { key: 'pv-geo-indien-states-best', label: 'Staaten' }],
  },
  {
    href: '/private/geoguessr/tuerkei', code: 'TR', title: 'Türkei', meta: '30 Großstädte · 81 Provinzen',
    text: 'Großstädte finden und die Kennzeichen-Nummern der Provinzen lernen (34 = İstanbul, 06 = Ankara …).',
    bestKeys: [{ key: 'pv-geo-tuerkei-cities-best', label: 'Städte' }, { key: 'pv-geo-tuerkei-provinces-best', label: 'Provinzen' }],
  },
  {
    href: '/private/geoguessr/kyrillisch', code: 'Кр', title: 'Kyrillisch', meta: '33 Buchstaben · 9 Sprachen',
    text: 'Buchstaben lernen, Ortsnamen lesen und erkennen, ob ein Schild Russisch, Ukrainisch, Bulgarisch … ist.',
    bestKeys: [],
  },
]

export default function GeoGuessrHub() {
  const [best, setBest] = useState<Record<string, string>>({})

  useEffect(() => {
    const out: Record<string, string> = {}
    try {
      for (const t of TILES) {
        for (const b of t.bestKeys) {
          const raw = localStorage.getItem(b.key)
          if (!raw) continue
          const v = JSON.parse(raw)
          out[t.href] = `Bestwert: ${v.accuracy} %${b.label ? ` · ${b.label}` : v.mode ? ` · ${v.mode === 'regions' ? 'Regionen' : 'Präfekturen'}` : ''}`
          break
        }
      }
      const m = JSON.parse(localStorage.getItem('pv-geo-cyrillic-mastery') || '{}') as Record<string, number>
      const n = Object.values(m).filter(v => v >= 3).length
      if (n) out['/private/geoguessr/kyrillisch'] = `${n} von 33 Buchstaben sicher`
    } catch { /* egal */ }
    setBest(out)
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
        {TILES.map(t => (
          <Link key={t.href} href={t.href} className="pv-glass pv-geo-tile">
            <div className="pv-row">
              <span className="pv-tile-icon"><span className="pv-tile-code">{t.code}</span></span>
              <div className="pv-grow">
                <div className="pv-h2">{t.title}</div>
                <div className="pv-muted" style={{ fontSize: 13 }}>{t.meta}</div>
              </div>
              <Icon name="next" size={18} />
            </div>
            <div className="pv-muted" style={{ fontSize: 13.5 }}>{t.text}</div>
            {best[t.href]
              ? <span className="pv-badge ok" style={{ alignSelf: 'flex-start' }}>{best[t.href]}</span>
              : <span className="pv-badge" style={{ alignSelf: 'flex-start' }}>Noch nicht gespielt</span>}
          </Link>
        ))}
      </div>

      <section className="pv-glass pv-card">
        <div className="pv-h2" style={{ marginBottom: 12 }}>So funktionieren die Modi</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
          {[
            { icon: 'book', title: 'Lernen', text: 'Frei auf der Karte tippen – Name, Infos und Beispiele werden angezeigt.' },
            { icon: 'pointer', title: 'Auf Karte finden', text: 'Ein Name wird genannt, du tippst die richtige Stelle an.' },
            { icon: 'target', title: 'Namen zuordnen', text: 'Eine Fläche ist markiert, du wählst aus vier Namen.' },
            { icon: 'sparkle', title: 'Wissen', text: 'Ohne Karte: Hauptstadt, Vorwahl, Kennzeichen oder Schrift erkennen.' },
            { icon: 'shuffle', title: 'Gemischt', text: 'Alle Fragearten zufällig abwechselnd.' },
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