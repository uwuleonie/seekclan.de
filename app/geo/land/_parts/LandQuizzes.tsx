'use client'

// Länderseite → Quizzes: eigene Quizzes des Landes als Kacheln, dazu alle Quizzes, in denen das Land vorkommt
// (nach Bereich gruppiert). Gesperrte und unsichtbare Quizzes fallen weg, im GG-Modus nur GG-Quizzes.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import QuizTile from '../../_components/QuizTile'
import Icon from '../../_components/Icon'
import { useGeo } from '../../_components/GeoShell'
import { BEREICHE } from '../../_content/welt'
import { KIND_LABEL } from '../../_lib/catalog'
import type { CatalogEntry } from '../../_lib/types'

export default function LandQuizzes({ iso, name, slugs }: { iso: string; name: string; slugs: string[] }) {
  const { catalog, status, state } = useGeo()
  const [alle, setAlle] = useState(false)

  const { eigene, andere } = useMemo(() => {
    const set = new Set(slugs)
    const offen = catalog.filter(e => set.has(e.slug) && !e.planned && status(e).open)
      .filter(e => !('ggQuelle' in e && e.ggQuelle?.filter) || state.gg.laender.includes(iso))
    return { eigene: offen.filter(e => e.country === iso), andere: offen.filter(e => e.country !== iso) }
  }, [catalog, status, slugs, iso, state.gg.laender])

  const gruppen = useMemo(() => {
    const m = new Map<string, CatalogEntry[]>()
    for (const e of andere) {
      if (!m.has(e.bereich)) m.set(e.bereich, [])
      m.get(e.bereich)!.push(e)
    }
    return BEREICHE.filter(b => m.has(b.key)).map(b => ({ b, liste: m.get(b.key)! }))
  }, [andere])

  const zeigen = alle ? gruppen : gruppen.map(g => ({ ...g, liste: g.liste.slice(0, 12) }))
  const mehr = gruppen.some(g => g.liste.length > 12)

  return (
    <section className="ga-land-sek" id="quizzes">
      <div className="ga-land-sek-kopf">
        <h2 className="ga-h3">Quizzes</h2>
        <span className="ga-muted" style={{ fontSize: 13 }}>{eigene.length + andere.length} Quizzes mit {name}</span>
      </div>
      {eigene.length > 0 && (
        <>
          <p className="ga-eyebrow" style={{ margin: '0 0 10px' }}>Nur über {name}</p>
          <div className="ga-tiles">{eigene.map(e => <QuizTile key={e.slug} entry={e} />)}</div>
        </>
      )}
      {gruppen.length > 0 && (
        <div className="ga-land-quizliste">
          <p className="ga-eyebrow" style={{ margin: '18px 0 10px' }}>{name} kommt vor in</p>
          {zeigen.map(({ b, liste }) => (
            <div key={b.key} className="ga-land-quizgruppe">
              <span className="ga-adm-label"><span className="dot" style={{ background: b.color }} /> {b.name}</span>
              <div className="ga-chips">
                {liste.map(e => (
                  <Link key={e.slug} href={`/geo/quiz/${e.slug}`} className="ga-chip sm" title={KIND_LABEL[e.kind]}>{e.title}</Link>
                ))}
              </div>
            </div>
          ))}
          {mehr && (
            <button type="button" className="ga-btn ghost sm" onClick={() => setAlle(a => !a)}>
              <Icon name={alle ? 'back' : 'next'} size={14} /> {alle ? 'Weniger zeigen' : 'Alle zeigen'}
            </button>
          )}
        </div>
      )}
      {!eigene.length && !gruppen.length && <p className="ga-muted">Noch keine freigeschalteten Quizzes mit {name}.</p>}
      <p className="ga-muted" style={{ fontSize: 13, margin: '14px 0 0' }}>
        Auch dabei: <Link href="/geo/higher-lower">Higher Lower</Link> – welches Land hat mehr Einwohner, Bier, Küste …?
      </p>
    </section>
  )
}
