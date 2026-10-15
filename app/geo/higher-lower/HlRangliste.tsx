'use client'

// Higher Lower – Rangliste: beste Runde je Spieler für Region × Kategorie × Spielart × Stufe (Tagesrunde: heute)

import { useEffect, useState } from 'react'
import Icon from '../_components/Icon'
import type { HlRegion } from '../_data/hl'
import type { HlArt, HlStufe } from '../_lib/hl'

type Zeile = { platz: number; name: string; richtige: number; punkte: number; ich: boolean }
type Zeitraum = 'heute' | 'woche' | 'alle'

export default function HlRangliste({ region, kategorie, art, stufe, titel, tick }: {
  region: HlRegion; kategorie: string; art: HlArt; stufe: HlStufe; titel: string; tick?: number
}) {
  const [zeitraum, setZeitraum] = useState<Zeitraum>('alle')
  const [liste, setListe] = useState<Zeile[] | null>(null)
  const [fehler, setFehler] = useState(false)

  useEffect(() => {
    let alive = true
    const q = new URLSearchParams({ was: 'rangliste', region, kat: kategorie, art, stufe, zeitraum })
    fetch(`/api/geo/hl?${q}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (alive) { setListe(Array.isArray(d.liste) ? d.liste : []); setFehler(!Array.isArray(d.liste)) } })
      .catch(() => { if (alive) { setListe([]); setFehler(true) } })
    return () => { alive = false }
  }, [region, kategorie, art, stufe, zeitraum, tick])

  return (
    <section className="ga-card ga-hl-rang">
      <div className="ga-row" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <h3 className="ga-adm-h" style={{ margin: 0 }}><Icon name="trophy" size={16} /> Rangliste</h3>
        {art !== 'tag' && (
          <div className="ga-seg sm">
            {([['heute', 'Heute'], ['woche', 'Woche'], ['alle', 'Immer']] as [Zeitraum, string][]).map(([k, l]) => (
              <button key={k} className={zeitraum === k ? 'active' : ''} onClick={() => setZeitraum(k)}>{l}</button>
            ))}
          </div>
        )}
      </div>
      <p className="ga-muted ga-hl-rang-titel">{titel}</p>
      {liste === null ? <p className="ga-muted">Lädt …</p>
        : fehler ? <p className="ga-muted">Rangliste gerade nicht erreichbar.</p>
          : liste.length === 0 ? <p className="ga-muted">Noch niemand – sei die oder der Erste!</p>
            : (
              <ol className="ga-hl-rang-liste">
                {liste.map(z => (
                  <li key={z.platz} className={z.ich ? 'ich' : ''}>
                    <span className={`pl p${z.platz}`}>{z.platz}</span>
                    <span className="nm">{z.name}</span>
                    <span className="sc"><b>{z.richtige}</b> <small>richtig</small></span>
                    <span className="pt">{z.punkte.toLocaleString('de-DE')} P.</span>
                  </li>
                ))}
              </ol>
            )}
    </section>
  )
}