'use client'

// Geo-Admin → GeoGuessr: Welche Länder haben Street-View-Abdeckung in GeoGuessr (danach richten sich der GG-Modus
// und alle GG-Edition-Quizzes) – und einzelne Quizzes im GG-Modus fest ein- oder ausblenden.

import { useMemo, useState } from 'react'
import { useGeo } from '../../_components/GeoShell'
import Icon from '../../_components/Icon'
import { CATALOG, isBuilt } from '../../_lib/catalog'
import { GG_STANDARD, ggArt, type GgArt, type GgSettings } from '../../_lib/gg'
import { BEREICHE } from '../../_content/welt'
import { COUNTRIES } from '../../_data/world'
import { adminPost } from './shared'

/** Gebiete, die nicht in der Länderliste der Weltkarte stehen */
const EXTRA: Record<string, [string, string]> = {
  GIB: ['Gibraltar', 'europa'], JEY: ['Jersey', 'europa'], IMN: ['Isle of Man', 'europa'], FRO: ['Färöer', 'europa'], GRL: ['Grönland', 'nordamerika'],
  CUW: ['Curaçao', 'nordamerika'], PRI: ['Puerto Rico', 'nordamerika'], VIR: ['Amerikanische Jungferninseln', 'nordamerika'], BMU: ['Bermuda', 'nordamerika'],
  CXR: ['Weihnachtsinsel', 'ozeanien'], HKG: ['Hongkong', 'asien'], ASM: ['Amerikanisch-Samoa', 'ozeanien'], GUM: ['Guam', 'ozeanien'],
  MNP: ['Nördliche Marianen', 'ozeanien'], UMI: ['Kleinere Amerikanische Überseeinseln', 'ozeanien'], REU: ['Réunion', 'afrika'],
}

export default function AdminGg({ canWrite, flash }: { canWrite: boolean; flash: (msg: string, bad?: boolean) => void }) {
  const { state } = useGeo()
  const [gg, setGg] = useState<GgSettings>(() => JSON.parse(JSON.stringify(state.gg)))
  const [busy, setBusy] = useState(false)
  const [suche, setSuche] = useState('')
  const [nurFest, setNurFest] = useState(false)
  const ro = !canWrite

  const laender = useMemo(() => {
    const list = COUNTRIES.map(c => ({ id: c.id, name: c.name, kont: c.continents[0] }))
    for (const [id, [name, kont]] of Object.entries(EXTRA)) if (!list.some(c => c.id === id)) list.push({ id, name, kont })
    return list.sort((a, b) => a.name.localeCompare(b.name, 'de'))
  }, [])
  const set = new Set(gg.laender)
  const toggleLand = (id: string) => setGg(g => ({ ...g, laender: g.laender.includes(id) ? g.laender.filter(x => x !== id) : [...g.laender, id] }))

  const quizzes = useMemo(() => {
    const q = suche.trim().toLowerCase()
    return CATALOG.filter(isBuilt)
      .filter(e => !q || e.title.toLowerCase().includes(q) || e.slug.includes(q))
      .filter(e => !nurFest || gg.quizzes[e.slug])
      .slice(0, 300)
  }, [suche, nurFest, gg.quizzes])
  const setQuiz = (slug: string, v: GgArt | null) => setGg(g => {
    const quizzes = { ...g.quizzes }
    if (v) quizzes[slug] = v
    else delete quizzes[slug]
    return { ...g, quizzes }
  })
  const auto = (slug: string) => {
    const e = CATALOG.find(x => x.slug === slug)!
    return ggArt(e, { ...gg, quizzes: {} })
  }
  const anzahlJa = CATALOG.filter(e => ggArt(e, gg) === 'ja').length

  const save = async () => {
    setBusy(true)
    try {
      await adminPost({ action: 'gg', gg })
      flash('GeoGuessr-Einstellungen gespeichert – Seite neu laden, um sie überall zu sehen')
    } catch (e) { flash(e instanceof Error ? e.message : 'Fehler', true) } finally { setBusy(false) }
  }

  return (
    <div className="ga-adm-cols">
      <section className="ga-card" style={{ gridColumn: '1 / -1' }}>
        <h3 className="ga-adm-h">Länder mit Street View in GeoGuessr</h3>
        <p className="ga-muted ga-adm-hint">
          Danach richtet sich der GG-Modus: Quizzes zu einem Land erscheinen nur, wenn es hier angehakt ist. Die GG-Edition-Quizzes
          („Alle Flaggen der Welt – GG Edition“ usw.) nehmen genau diese Länder. Aktuell {gg.laender.length} Länder · {anzahlJa} Quizzes im GG-Modus.
        </p>
        {!ro && (
          <div className="ga-row ga-wrap" style={{ marginBottom: 10 }}>
            <button className="ga-btn ghost sm" onClick={() => setGg(g => ({ ...g, laender: [...GG_STANDARD] }))}>Standardliste (Geometas, Okt. 2026)</button>
          </div>
        )}
        {BEREICHE.filter(b => b.key !== 'welt' && b.key !== 'sprachen').map(b => {
          const ls = laender.filter(l => l.kont === b.key)
          return (
            <div key={b.key} style={{ marginBottom: 12 }}>
              <span className="ga-adm-label">{b.name} · {ls.filter(l => set.has(l.id)).length} von {ls.length}</span>
              <div className="ga-chips">
                {ls.map(l => (
                  <button key={l.id} type="button" disabled={ro} className={`ga-chip sm ${set.has(l.id) ? 'active' : ''}`} onClick={() => toggleLand(l.id)} title={l.id}>
                    {set.has(l.id) && <Icon name="check" size={12} />} {l.name}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </section>

      <section className="ga-card" style={{ gridColumn: '1 / -1' }}>
        <h3 className="ga-adm-h">Quizzes im GG-Modus</h3>
        <p className="ga-muted ga-adm-hint">
          „Auto“: GeoGuessr-Quizzes, Sprachen & Schriften und Quizzes zu Ländern mit Abdeckung sind dabei, alles andere nicht.
          Mit „Ja“/„Nein“ legst du ein Quiz fest.
        </p>
        <div className="ga-row ga-wrap" style={{ gap: 10, marginBottom: 10 }}>
          <input className="ga-input" style={{ maxWidth: 320 }} placeholder="Quiz suchen …" value={suche} onChange={e => setSuche(e.target.value)} />
          <label className="ga-row" style={{ gap: 6 }}><input type="checkbox" checked={nurFest} onChange={e => setNurFest(e.target.checked)} /> nur festgelegte</label>
        </div>
        <table className="ga-adm-mini">
          <thead><tr><th>Quiz</th><th>Auto</th><th>Festlegung</th></tr></thead>
          <tbody>
            {quizzes.map(e => {
              const fest = gg.quizzes[e.slug] ?? null
              return (
                <tr key={e.slug}>
                  <td>{e.title}<br /><small className="ga-muted">{e.slug}</small></td>
                  <td className="ga-muted">{auto(e.slug) === 'ja' ? 'dabei' : 'nicht dabei'}</td>
                  <td>
                    <div className="ga-chips">
                      {([[null, 'Auto'], ['ja', 'Ja'], ['nein', 'Nein']] as [GgArt | null, string][]).map(([v, l]) => (
                        <button key={l} type="button" disabled={ro} className={`ga-chip sm ${fest === v ? 'active' : ''}`} onClick={() => setQuiz(e.slug, v)}>{l}</button>
                      ))}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {quizzes.length === 300 && <p className="ga-muted" style={{ fontSize: 12.5 }}>Nur die ersten 300 – Suche benutzen.</p>}
      </section>

      {!ro && (
        <div className="ga-adm-savebar">
          <button className="ga-btn primary" disabled={busy} onClick={save}><Icon name="check" size={15} /> GeoGuessr-Einstellungen speichern</button>
          <button className="ga-btn ghost" disabled={busy} onClick={() => setGg(JSON.parse(JSON.stringify(state.gg)))}>Änderungen verwerfen</button>
        </div>
      )}
    </div>
  )
}