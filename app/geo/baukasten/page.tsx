'use client'

// Quiz-Baukasten: beliebige freigeschaltete Quizzes zu einem Quiz auf einer gemeinsamen Karte kombinieren.
// Geordnet nach Bereich → "Ganzer Kontinent" und Ländern (aufklappbar), filterbar nach Thema, mit Suche.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useGeo } from '../_components/GeoShell'
import Icon from '../_components/Icon'
import Flag from '../_components/Flag'
import { countryName, isBuilt, KIND_LABEL } from '../_lib/catalog'
import { BEREICHE } from '../_content/welt'
import { ISO2 } from '../_data/welt-extra'
import { normalize } from '../_lib/text'
import { itemCount } from '../_lib/items'
import type { Bereich, Kind, QuizDef } from '../_lib/types'

type Group = { key: string; name: string; country?: string; entries: QuizDef[] }

export default function BaukastenPage() {
  const router = useRouter()
  const { status, loaded, catalog, bereichName } = useGeo()
  const [sel, setSel] = useState<string[]>([])
  const [q, setQ] = useState('')
  const [bereich, setBereich] = useState<Bereich | 'alle'>('alle')
  const [kinds, setKinds] = useState<Kind[]>([])
  const [openGroups, setOpenGroups] = useState<string[]>([])

  const available = useMemo(
    () => catalog.filter(isBuilt).filter(e => e.combinable !== false && status(e).open) as QuizDef[],
    [status, catalog],
  )
  const kindsHere = useMemo(() => [...new Set(available.map(e => e.kind))], [available])
  const bereicheHere = useMemo(() => BEREICHE.filter(b => available.some(e => e.bereich === b.key)), [available])

  const shown = useMemo(() => {
    const words = normalize(q).split(/\s+/).filter(Boolean)
    return available.filter(e =>
      (bereich === 'alle' || e.bereich === bereich) &&
      (!kinds.length || kinds.includes(e.kind)) &&
      (!words.length || words.every(w => normalize(`${e.title} ${e.meta} ${countryName(e.country)} ${KIND_LABEL[e.kind]}`).includes(w))))
  }, [available, q, bereich, kinds])

  // Bereich → Gruppen ("Ganz Europa", dann Länder)
  const tree = useMemo(() => BEREICHE.map(b => {
    const list = shown.filter(e => e.bereich === b.key)
    const groups: Group[] = []
    const general = list.filter(e => !e.country)
    if (general.length) groups.push({ key: `${b.key}:_`, name: b.key === 'welt' ? 'Ganze Welt' : `Ganz ${bereichName(b.key)}`, entries: general })
    const byCountry = new Map<string, QuizDef[]>()
    for (const e of list.filter(e => e.country)) byCountry.set(e.country!, [...(byCountry.get(e.country!) ?? []), e])
    for (const [c, es] of [...byCountry.entries()].sort((x, y) => countryName(x[0]).localeCompare(countryName(y[0]), 'de'))) {
      groups.push({ key: `${b.key}:${c}`, name: countryName(c), country: c, entries: es })
    }
    return { b, groups, count: list.length }
  }).filter(x => x.count), [shown, bereichName])

  const searching = !!q.trim() || kinds.length > 0
  const isOpen = (g: Group) => searching || openGroups.includes(g.key) || g.key.endsWith(':_')
  const toggleGroup = (k: string) => setOpenGroups(o => (o.includes(k) ? o.filter(x => x !== k) : [...o, k]))
  const toggle = (slug: string) => setSel(s => (s.includes(slug) ? s.filter(x => x !== slug) : [...s, slug]))
  const toggleAll = (g: Group) => {
    const all = g.entries.every(e => sel.includes(e.slug))
    setSel(s => (all ? s.filter(x => !g.entries.some(e => e.slug === x)) : [...new Set([...s, ...g.entries.map(e => e.slug)])]))
  }

  const selected = available.filter(e => sel.includes(e.slug))
  // Nachgeladene Quizzes zählen mit ihrer Anzahl (gleiche Orte werden erst im Quiz zusammengelegt)
  const total = new Set(selected.flatMap(e => e.items.map(i => i.key))).size + selected.filter(e => !e.items.length).reduce((n, e) => n + itemCount(e), 0)
  const href = sel.length === 1 ? `/geo/quiz/${sel[0]}` : `/geo/quiz/mix?q=${sel.join(',')}`

  return (
    <div className="ga-page">
      <Link href="/geo" className="ga-btn ghost sm" style={{ marginLeft: -10 }}><Icon name="back" size={15} /> Atlas</Link>
      <p className="ga-eyebrow" style={{ marginTop: 8 }}>Baukasten</p>
      <h1 className="ga-title">Eigenes Quiz mischen</h1>
      <p className="ga-lead">
        Wähle beliebige Quizzes aus – sie landen zusammen auf einer Karte. Gleiche Orte kommen nur einmal vor,
        jede Gruppe behält ihre Farbe. Alle Spielarten gehen auch hier.
      </p>

      <div className="ga-search" style={{ marginTop: 20 }}>
        <label className="ga-search-box">
          <Icon name="search" size={17} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Suchen, z.B. Hauptstädte, Japan …" aria-label="Quizzes durchsuchen" />
          {q && <button type="button" className="ga-search-x" onClick={() => setQ('')} aria-label="Suche leeren"><Icon name="x" size={14} /></button>}
        </label>
      </div>
      <div className="ga-chips" style={{ marginTop: 10 }}>
        <button className={`ga-chip sm ${bereich === 'alle' ? 'active' : ''}`} onClick={() => setBereich('alle')}>Alle Bereiche</button>
        {bereicheHere.map(b => <button key={b.key} className={`ga-chip sm ${bereich === b.key ? 'active' : ''}`} onClick={() => setBereich(b.key)}>{bereichName(b.key)}</button>)}
      </div>
      <div className="ga-chips" style={{ marginTop: 8 }}>
        {kindsHere.map(k => (
          <button key={k} className={`ga-chip sm ${kinds.includes(k) ? 'active' : ''}`} onClick={() => setKinds(ks => (ks.includes(k) ? ks.filter(x => x !== k) : [...ks, k]))}>{KIND_LABEL[k]}</button>
        ))}
        {kinds.length > 0 && <button className="ga-chip sm" onClick={() => setKinds([])}><Icon name="x" size={12} /> Themen</button>}
      </div>

      {!loaded ? (
        <div className="ga-map-loading">Lädt …</div>
      ) : available.length === 0 ? (
        <div className="ga-card ga-locked">
          <div className="ga-locked-icon"><Icon name="lock" size={28} /></div>
          <h2 className="ga-h2">Noch nichts freigeschaltet</h2>
          <p className="ga-lead" style={{ margin: '8px auto 0' }}>Sobald Quizzes freigeschaltet sind, kannst du sie hier kombinieren.</p>
        </div>
      ) : tree.length === 0 ? (
        <p className="ga-muted" style={{ marginTop: 24 }}>Nichts gefunden.</p>
      ) : tree.map(({ b, groups, count }) => (
        <section key={b.key} className="ga-section" style={{ marginTop: 26 }}>
          <h2 className="ga-h3" style={{ marginBottom: 10 }}>{bereichName(b.key)} <span className="ga-muted" style={{ fontSize: 14, fontWeight: 600 }}>· {count}</span></h2>
          <div className="ga-bk-groups">
            {groups.map(g => {
              const nSel = g.entries.filter(e => sel.includes(e.slug)).length
              const open = isOpen(g)
              return (
                <div key={g.key} className={`ga-card ga-bk-group ${open ? 'open' : ''}`}>
                  <div className="ga-bk-head">
                    <button className="ga-bk-toggle" onClick={() => toggleGroup(g.key)} aria-expanded={open}>
                      {g.country && ISO2[g.country] ? <Flag code={ISO2[g.country]} size="sm" /> : <Icon name="globe" size={16} />}
                      <b>{g.name}</b>
                      <span className="ga-muted">{g.entries.length}</span>
                      {nSel > 0 && <span className="ga-badge date">{nSel} gewählt</span>}
                      <Icon name="next" size={14} className="chev" />
                    </button>
                    <button className="ga-btn ghost sm" onClick={() => toggleAll(g)}>{g.entries.every(e => sel.includes(e.slug)) ? 'Keins' : 'Alle'}</button>
                  </div>
                  {open && (
                    <div className="ga-bk-list">
                      {g.entries.map(e => {
                        const on = sel.includes(e.slug)
                        return (
                          <label key={e.slug} className={`ga-check ${on ? 'on' : ''}`}>
                            <input type="checkbox" checked={on} onChange={() => toggle(e.slug)} />
                            <span className="ga-grow">
                              <b style={{ display: 'block' }}>{e.title}</b>
                              <span className="ga-muted" style={{ fontSize: 12.5 }}>{KIND_LABEL[e.kind]} · {e.meta}</span>
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ))}

      <div className="ga-sticky-bottom">
        <div className="ga-card ga-bk-tray" style={{ boxShadow: 'var(--ga-shadow-lg)' }}>
          {selected.length > 0 && (
            <div className="ga-chips ga-bk-sel">
              {selected.map(e => (
                <button key={e.slug} className="ga-chip sm active" onClick={() => toggle(e.slug)} title="Entfernen">
                  {e.title} <Icon name="x" size={12} />
                </button>
              ))}
            </div>
          )}
          <div className="ga-row ga-wrap" style={{ justifyContent: 'space-between' }}>
            <span>
              {sel.length === 0 ? <span className="ga-muted">Noch nichts ausgewählt</span>
                : <><b>{sel.length}</b> {sel.length === 1 ? 'Quiz' : 'Quizzes'} · <b>{total}</b> Einträge</>}
            </span>
            <span className="ga-row ga-wrap">
              {sel.length > 0 && <button className="ga-btn ghost sm" onClick={() => setSel([])}>Leeren</button>}
              <button className="ga-btn primary" disabled={!sel.length} onClick={() => router.push(href)}><Icon name="play" size={15} /> Mix starten</button>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}