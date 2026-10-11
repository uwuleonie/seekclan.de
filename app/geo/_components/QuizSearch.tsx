'use client'

// Suche mit Stichwort-Filtern für eine Liste von Quizzes (Startseite, Kontinent-Seiten).
// Ohne Suchbegriff und ohne Filter wird der normale Inhalt (children) gezeigt, sonst die Treffer als Kacheln.

import { useMemo, useState, type ReactNode } from 'react'
import Icon from './Icon'
import QuizTile from './QuizTile'
import { useGeo } from './GeoShell'
import { KIND_LABEL, countryName, isBuilt } from '../_lib/catalog'
import { itemCount } from '../_lib/items'
import { normalize } from '../_lib/text'
import { DIFFICULTIES } from '../_lib/xp'
import type { CatalogEntry, Kind } from '../_lib/types'

type StatusFilter = 'offen' | 'neu' | 'ungespielt' | 'begonnen' | 'angepinnt'
const STATUS: [StatusFilter, string][] = [
  ['offen', 'Spielbar'], ['neu', 'Neu'], ['ungespielt', 'Noch nicht gespielt'], ['begonnen', 'Angefangen'], ['angepinnt', 'Angepinnt'],
]

export default function QuizSearch({ entries, placeholder = 'Quiz suchen – z.B. Hauptstädte, Flüsse, Japan …', children }: {
  entries: CatalogEntry[]; placeholder?: string; children: ReactNode
}) {
  const { status, difficulty, config, bests, progress, isPinned, bereichName } = useGeo()
  const [q, setQ] = useState('')
  const [kinds, setKinds] = useState<Kind[]>([])
  const [diffs, setDiffs] = useState<string[]>([])
  const [stat, setStat] = useState<StatusFilter[]>([])
  const [open, setOpen] = useState(false)

  const kindsHere = useMemo(() => {
    const count = new Map<Kind, number>()
    for (const e of entries) count.set(e.kind, (count.get(e.kind) ?? 0) + 1)
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k)
  }, [entries])

  const active = !!q.trim() || kinds.length > 0 || diffs.length > 0 || stat.length > 0

  const results = useMemo(() => {
    if (!active) return []
    // Jedes Wort muss irgendwo vorkommen (Titel, Kurzzeile, Text, Thema, Land, Bereich, Schwierigkeit)
    const words = normalize(q).split(/\s+/).filter(Boolean)
    return entries.filter(e => {
      const st = status(e)
      if (kinds.length && !kinds.includes(e.kind)) return false
      if (diffs.length && !diffs.includes(difficulty(e))) return false
      for (const s of stat) {
        if (s === 'offen' && !st.open) return false
        if (s === 'neu' && !st.isNew) return false
        if (s === 'ungespielt' && (bests[e.slug] !== undefined || progress[e.slug])) return false
        if (s === 'begonnen') {
          const n = isBuilt(e) ? itemCount(e) : 0
          if (!progress[e.slug] || (n && progress[e.slug] >= n)) return false
        }
        if (s === 'angepinnt' && !isPinned('quiz', e.slug)) return false
      }
      if (!words.length) return true
      const hay = normalize(`${e.title} ${e.meta} ${e.text ?? ''} ${KIND_LABEL[e.kind]} ${countryName(e.country)} ${bereichName(e.bereich)} ${config.difficulties[difficulty(e)].label} ${e.section ?? ''} ${e.slug.replace(/-/g, ' ')}`)
      return words.every(w => hay.includes(w))
    }).sort((a, b) => Number(status(b).open) - Number(status(a).open))
  }, [active, q, kinds, diffs, stat, entries, status, difficulty, bests, progress, isPinned, config, bereichName])

  const toggle = <T,>(list: T[], set: (v: T[]) => void, v: T) => set(list.includes(v) ? list.filter(x => x !== v) : [...list, v])
  const reset = () => { setQ(''); setKinds([]); setDiffs([]); setStat([]) }
  const nFilters = kinds.length + diffs.length + stat.length

  return (
    <>
      <div className="ga-search">
        <label className="ga-search-box">
          <Icon name="search" size={17} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder} aria-label="Quizzes durchsuchen" />
          {active && <button type="button" className="ga-search-x" onClick={reset} aria-label="Suche zurücksetzen"><Icon name="x" size={14} /></button>}
        </label>
        <button type="button" className={`ga-btn sm ${open || nFilters ? 'active' : ''}`} onClick={() => setOpen(o => !o)} aria-expanded={open}>
          Filter{nFilters ? ` (${nFilters})` : ''}
        </button>
      </div>
      {open && (
        <div className="ga-card ga-search-filters">
          <div><span className="ga-eyebrow">Thema</span>
            <div className="ga-chips">{kindsHere.map(k => <button key={k} className={`ga-chip sm ${kinds.includes(k) ? 'active' : ''}`} onClick={() => toggle(kinds, setKinds, k)}>{KIND_LABEL[k]}</button>)}</div>
          </div>
          <div><span className="ga-eyebrow">Schwierigkeit</span>
            <div className="ga-chips">{DIFFICULTIES.map(d => <button key={d} className={`ga-chip sm ${diffs.includes(d) ? 'active' : ''}`} onClick={() => toggle(diffs, setDiffs, d)}>{config.difficulties[d].label}</button>)}</div>
          </div>
          <div><span className="ga-eyebrow">Status</span>
            <div className="ga-chips">{STATUS.map(([k, l]) => <button key={k} className={`ga-chip sm ${stat.includes(k) ? 'active' : ''}`} onClick={() => toggle(stat, setStat, k)}>{l}</button>)}</div>
          </div>
        </div>
      )}
      {active ? (
        <section className="ga-section" style={{ marginTop: 18 }}>
          <div className="ga-section-head">
            <div>
              <p className="ga-eyebrow">Suche</p>
              <h2 className="ga-h2">{results.length} {results.length === 1 ? 'Treffer' : 'Treffer'}</h2>
            </div>
            <button className="ga-btn ghost sm" onClick={reset}>Zurücksetzen</button>
          </div>
          {results.length === 0 ? <p className="ga-muted">Nichts gefunden. Probier ein anderes Wort oder weniger Filter.</p>
            : <div className="ga-tiles">{results.slice(0, 120).map(e => <QuizTile key={e.slug} entry={e} />)}</div>}
        </section>
      ) : children}
    </>
  )
}