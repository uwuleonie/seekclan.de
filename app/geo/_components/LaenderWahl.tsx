'use client'

// Länder-Auswahl auf der Kontinent-Seite: links alle Länder (mit Flagge und Suche), rechts die Quizzes des gewählten Landes,
// sortiert nach Themen. Das gewählte Land steht in der Adresse (#land-DEU), damit "Zurück" aus einem Quiz wieder dort landet.

import { useEffect, useMemo, useRef, useState } from 'react'
import Flag from './Flag'
import Icon from './Icon'
import QuizTile from './QuizTile'
import PinButton from './PinButton'
import { ISO2 } from '../_data/welt-extra'
import { COUNTRY_BY_ID } from '../_content/welt'
import type { CatalogEntry, Kind, QuizStatus } from '../_lib/types'

export interface LandGruppe { id: string; name: string; entries: CatalogEntry[] }

/** Themen, nach denen die Quizzes eines Landes sortiert werden */
export const THEMEN: { key: string; name: string; kinds: Kind[] }[] = [
  { key: 'karte', name: 'Regionen & Grenzen', kinds: ['regionen', 'laender', 'hauptstaedte', 'kennzeichen', 'postleitzahlen', 'kontinente'] },
  { key: 'staedte', name: 'Städte & Stadtteile', kinds: ['staedte', 'stadtteile'] },
  { key: 'verkehr', name: 'Verkehr', kinds: ['flughaefen', 'bahn', 'strassen', 'haefen'] },
  { key: 'natur', name: 'Natur', kinds: ['fluesse', 'berge', 'seen', 'meere', 'wuesten', 'gebiete'] },
  { key: 'wissen', name: 'Geschichte & Wissen', kinds: ['historisch', 'wissen', 'sprachen', 'vorwahlen', 'flaggen', 'domains', 'rekorde'] },
]
export const themaOf = (k: Kind) => THEMEN.find(t => t.kinds.includes(k))?.key ?? 'wissen'

const fromHash = () => (typeof window !== 'undefined' && window.location.hash.startsWith('#land-') ? window.location.hash.slice(6) : null)
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export default function LaenderWahl({ countries, status }: { countries: LandGruppe[]; status: (e: CatalogEntry) => QuizStatus }) {
  const [sel, setSel] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)

  // Auswahl aus der Adresse übernehmen (auch wenn oben ein Länder-Chip angeklickt wird)
  useEffect(() => {
    const apply = () => {
      const h = fromHash()
      if (h && countries.some(c => c.id === h)) {
        setSel(h)
        requestAnimationFrame(() => document.getElementById('laender')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
      }
    }
    apply()
    window.addEventListener('hashchange', apply)
    return () => window.removeEventListener('hashchange', apply)
  }, [countries])

  const openOf = (es: CatalogEntry[]) => es.filter(e => status(e).open).length
  const current = countries.find(c => c.id === sel) ?? countries.find(c => c.id === 'DEU') ?? countries[0]

  const pick = (id: string) => {
    setSel(id)
    history.replaceState(null, '', `#land-${id}`)
    // Auf dem Handy zum Inhalt springen
    if (window.matchMedia('(max-width: 860px)').matches) panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const list = useMemo(() => {
    const n = norm(q.trim())
    return n ? countries.filter(c => norm(c.name).includes(n) || c.id.toLowerCase().includes(n)) : countries
  }, [countries, q])

  const themen = useMemo(() => {
    if (!current) return []
    const sorted = [...current.entries].sort((x, y) => Number(status(y).open) - Number(status(x).open))
    return THEMEN.map(t => ({ ...t, entries: sorted.filter(e => themaOf(e.kind) === t.key) })).filter(t => t.entries.length)
  }, [current, status])

  if (!current) return null
  const info = COUNTRY_BY_ID[current.id]

  return (
    <div className="ga-lw">
      <aside className="ga-lw-side ga-card">
        <label className="ga-lw-search">
          <Icon name="compass" size={16} />
          <input className="ga-input" placeholder="Land suchen …" value={q} onChange={e => setQ(e.target.value)} aria-label="Land suchen" />
        </label>
        <div className="ga-lw-list" role="listbox" aria-label="Länder">
          {list.map(c => {
            const open = openOf(c.entries)
            return (
              <button key={c.id} type="button" role="option" aria-selected={c.id === current.id}
                className={`ga-lw-item ${c.id === current.id ? 'active' : ''} ${open ? '' : 'dim'}`} onClick={() => pick(c.id)}>
                {ISO2[c.id] ? <Flag code={ISO2[c.id]} size="sm" /> : <span className="ga-lw-noflag">{c.id}</span>}
                <span className="ga-lw-name">{c.name}</span>
                <span className="ga-lw-count" title={`${open} von ${c.entries.length} offen`}>{c.entries.length}</span>
              </button>
            )
          })}
          {!list.length && <p className="ga-muted" style={{ padding: '8px 10px', fontSize: 13 }}>Kein Land gefunden.</p>}
        </div>
      </aside>

      <div className="ga-lw-panel" ref={panelRef} id={`land-${current.id}`}>
        <div className="ga-lw-head ga-card">
          {ISO2[current.id] && <Flag code={ISO2[current.id]} size="md" />}
          <div>
            <p className="ga-eyebrow">{info?.capital ? `Hauptstadt ${info.capital}` : 'Land'}</p>
            <h3 className="ga-h2" style={{ margin: '2px 0 0' }}>{current.name}</h3>
          </div>
          <span className="ga-muted ga-lw-stat">{openOf(current.entries)} von {current.entries.length} Quizzes offen</span>
          <PinButton kind="country" pinKey={current.id} label={current.name} />
        </div>
        {themen.map(t => (
          <div key={t.key} className="ga-lw-thema">
            <p className="ga-eyebrow">{t.name}</p>
            <div className="ga-tiles">{t.entries.map(e => <QuizTile key={e.slug} entry={e} />)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}