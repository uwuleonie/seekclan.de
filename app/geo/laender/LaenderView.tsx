'use client'

// /geo/laender: Übersicht aller Länderseiten, nach Kontinent, mit Suche.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Flag from '../_components/Flag'
import Icon from '../_components/Icon'
import { useGeo } from '../_components/GeoShell'
import { LAENDER } from '../_data/land'
import { KONTINENT_NAME, landHref } from '../_lib/land'
import { normalize } from '../_lib/text'

const KONTINENTE = ['europa', 'asien', 'afrika', 'nordamerika', 'suedamerika', 'ozeanien']

export default function LaenderView() {
  const { gg, state } = useGeo()
  const [q, setQ] = useState('')
  const liste = useMemo(() => {
    const n = normalize(q)
    return LAENDER.filter(l => (!n || normalize([l[2], ...l[5]].join(' ')).includes(n)) && (!gg || state.gg.laender.includes(l[1])))
  }, [q, gg, state.gg.laender])

  return (
    <div className="ga-page" style={{ maxWidth: 1120 }}>
      <p className="ga-eyebrow">Länderprofile</p>
      <h1 className="ga-title" style={{ margin: '2px 0 8px' }}>Alle Länder</h1>
      <p className="ga-lead">
        Jedes Land auf einer Seite: Steckbrief, Karte und Nachbarn, woher das Geld kommt (Wirtschaft mit Diagrammen), alle Zahlen aus Higher Lower,
        GeoGuessr-Hinweise und alle Quizzes, in denen das Land vorkommt.
      </p>
      <div className="ga-row ga-wrap" style={{ margin: '18px 0 6px', gap: 10 }}>
        <input className="ga-input" style={{ maxWidth: 340 }} placeholder="Land suchen …" value={q} onChange={e => setQ(e.target.value)} aria-label="Land suchen" />
        <span className="ga-muted" style={{ fontSize: 13 }}>{liste.length} Länder{gg ? ' mit Street View' : ''}</span>
      </div>
      {KONTINENTE.map(k => {
        const ls = liste.filter(l => l[4] === k)
        if (!ls.length) return null
        return (
          <section key={k} className="ga-land-sek">
            <h2 className="ga-h3">{KONTINENT_NAME[k]} <small className="ga-muted" style={{ fontStyle: 'normal', fontSize: 13 }}>{ls.length}</small></h2>
            <div className="ga-land-uebersicht">
              {ls.map(l => (
                <Link key={l[0]} href={landHref(l[0])} className="ga-land-kachel">
                  {l[3] ? <Flag code={l[3]} size="sm" /> : <Icon name="globe" size={16} />}
                  <span>{l[2]}</span>
                </Link>
              ))}
            </div>
          </section>
        )
      })}
      {!liste.length && <p className="ga-muted">Kein Land gefunden.</p>}
      <p className="ga-muted" style={{ fontSize: 12.5, marginTop: 24 }}><Link href="/geo/quellen">Quellen aller Daten</Link></p>
    </div>
  )
}
