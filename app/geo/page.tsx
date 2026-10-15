'use client'

// seekclan.de/geo – Startseite: 3D-Globus + Kacheln

import { useCallback, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useGeo } from './_components/GeoShell'
import FlatWorld from './_components/FlatWorld'
import QuizTile, { fmtRelease } from './_components/QuizTile'
import Icon from './_components/Icon'
import QuizSearch from './_components/QuizSearch'
import PinButton from './_components/PinButton'
import AngefangeneQuizzes from './_components/AngefangeneQuizzes'
import { belongsTo, countryName } from './_lib/catalog'
import { itemCount } from './_lib/items'
import { BEREICHE } from './_content/welt'
import type { Bereich } from './_lib/types'

const Globe = dynamic(() => import('./_components/Globe'), {
  ssr: false,
  loading: () => <div className="ga-hero-globe" />,
})

export default function GeoHome() {
  const { status, loaded, catalog, bereichName, bySlug, popular, pins } = useGeo()
  const [globeFailed, setGlobeFailed] = useState(false)
  const onFail = useCallback(() => setGlobeFailed(true), [])

  const withStatus = useMemo(() => catalog.map(e => ({ e, st: status(e) })), [status, catalog])
  const openCount = withStatus.filter(x => x.st.open).length
  const items = withStatus.filter(x => x.st.open && !x.e.planned).reduce((n, x) => n + (x.e.planned ? 0 : itemCount(x.e)), 0)
  const newOnes = withStatus.filter(x => x.st.isNew)
  const upcoming = withStatus.filter(x => x.st.releaseAt && !x.st.released).sort((a, b) => a.st.releaseAt!.localeCompare(b.st.releaseAt!))
  const soonCount = withStatus.filter(x => !x.st.released).length

  const openContinents = useMemo(() => {
    const s = new Set<Bereich>()
    for (const { e, st } of withStatus) {
      if (!st.open) continue
      for (const b of BEREICHE) if (b.key !== 'welt' && b.key !== 'sprachen' && belongsTo(e, b.key)) s.add(b.key)
    }
    return s
  }, [withStatus])

  const worldQuiz = withStatus.find(x => x.e.slug === 'welt-laender')

  // Beliebt: zuerst die im Adminpanel festgelegten, dann die meistgespielten – nur offene
  const beliebt = useMemo(() => {
    const out: typeof catalog = []
    for (const slug of [...popular.pinned, ...popular.auto]) {
      const e = bySlug[slug]
      if (e && !out.includes(e) && status(e).open && !status(e).hidden) out.push(e)
      if (out.length >= 8) break
    }
    return out
  }, [popular, bySlug, status])

  // Angepinnt
  const pinnedQuizzes = pins.filter(p => p.startsWith('quiz:')).map(p => bySlug[p.slice(5)]).filter(e => e && !status(e).hidden)
  const pinnedGroups = pins.filter(p => !p.startsWith('quiz:')).map(p => {
    const i = p.indexOf(':'), kind = p.slice(0, i), key = p.slice(i + 1)
    if (kind === 'country') {
      const any = catalog.find(e => e.country === key)
      return { kind, key, label: countryName(key), href: `/geo/${any?.bereich === 'welt' ? 'europa' : any?.bereich ?? 'welt'}#land-${key}` }
    }
    if (kind === 'section') { const [b, sec] = key.split('/'); return { kind, key, label: `${sec || 'Allgemein'} · ${bereichName(b as Bereich)}`, href: `/geo/${b}` } }
    return { kind, key, label: bereichName(key as Bereich), href: `/geo/${key}` }
  })

  return (
    <div className="ga-page">
      <section className="ga-hero">
        <div>
          <p className="ga-eyebrow">seekclan · Atlas</p>
          <h1 className="ga-title">Die Welt lernen – <span className="grad">Karte für Karte.</span></h1>
          <p className="ga-lead">
            Länder, Hauptstädte, Bundesländer, Regionen und echtes GeoGuessr-Wissen. Auf der Karte finden,
            Namen zuordnen oder eintippen – mit Sprint, drei Leben und eigenem Quiz-Mix aus allem, was es gibt.
          </p>
          <div className="ga-row ga-wrap" style={{ marginTop: 20 }}>
            {worldQuiz?.st.open ? (
              <Link href="/geo/quiz/welt-laender" className="ga-btn primary"><Icon name="play" size={15} /> Länder der Welt</Link>
            ) : (
              <Link href="/geo/welt" className="ga-btn primary"><Icon name="globe" size={16} /> Zur Weltkarte</Link>
            )}
            <Link href="/geo/baukasten" className="ga-btn"><Icon name="layers" size={16} /> Quiz-Baukasten</Link>
          </div>
          <div className="ga-stat-row">
            <div><b>{loaded ? openCount : '–'}</b><span>Quizzes offen</span></div>
            <div><b>{loaded ? items.toLocaleString('de-DE') : '–'}</b><span>Orte & Fragen</span></div>
            <div><b>{loaded ? soonCount : '–'}</b><span>bald verfügbar</span></div>
          </div>
        </div>
        <div>
          {globeFailed ? <FlatWorld /> : <Globe open={openContinents} onFail={onFail} />}
        </div>
      </section>

      <AngefangeneQuizzes />

      <QuizSearch entries={catalog}>
      {(pinnedQuizzes.length > 0 || pinnedGroups.length > 0) && (
        <section className="ga-section">
          <div className="ga-section-head">
            <div>
              <p className="ga-eyebrow">Deine Auswahl</p>
              <h2 className="ga-h2">Angepinnt</h2>
            </div>
          </div>
          {pinnedGroups.length > 0 && (
            <div className="ga-chips" style={{ marginBottom: 14 }}>
              {pinnedGroups.map(g => (
                <span key={`${g.kind}:${g.key}`} className="ga-pinchip">
                  <Link href={g.href} className="ga-chip"><Icon name={g.kind === 'country' ? 'flag' : 'layers'} size={14} /> {g.label}</Link>
                  <PinButton kind={g.kind as 'country'} pinKey={g.key} label={g.label} />
                </span>
              ))}
            </div>
          )}
          {pinnedQuizzes.length > 0 && <div className="ga-tiles">{pinnedQuizzes.map(e => <QuizTile key={e!.slug} entry={e!} />)}</div>}
        </section>
      )}

      {beliebt.length > 0 && (
        <section className="ga-section">
          <div className="ga-section-head">
            <div>
              <p className="ga-eyebrow">Was alle spielen</p>
              <h2 className="ga-h2"><Icon name="fire" size={20} style={{ verticalAlign: '-2px', color: 'var(--ga-mark)' }} /> Beliebt</h2>
            </div>
          </div>
          <div className="ga-tiles">{beliebt.map(e => <QuizTile key={e.slug} entry={e} />)}</div>
        </section>
      )}

      {newOnes.length > 0 && (
        <section className="ga-section">
          <div className="ga-section-head">
            <div>
              <p className="ga-eyebrow">Frisch freigeschaltet</p>
              <h2 className="ga-h2">Neu im Atlas</h2>
            </div>
            <Link href="/geo/updates" className="ga-btn ghost sm">Alle Updates <Icon name="next" size={14} /></Link>
          </div>
          <div className="ga-tiles">{newOnes.map(x => <QuizTile key={x.e.slug} entry={x.e} />)}</div>
        </section>
      )}

      <section className="ga-section">
        <div className="ga-section-head">
          <div>
            <p className="ga-eyebrow">Wohin?</p>
            <h2 className="ga-h2">Bereiche</h2>
          </div>
        </div>
        <div className="ga-bereich-grid">
          {BEREICHE.map(b => {
            const list = withStatus.filter(x => belongsTo(x.e, b.key))
            const open = list.filter(x => x.st.open).length
            return (
              <Link key={b.key} href={`/geo/${b.key}`} className="ga-bereich" style={{ '--ga-tile': b.color } as React.CSSProperties}>
                <b>{bereichName(b.key)}</b>
                <span className="ga-muted" style={{ fontSize: 13 }}>{open} von {list.length} offen</span>
                <span className="bar"><span style={{ width: `${list.length ? (open / list.length) * 100 : 0}%`, background: b.color, color: b.color }} /></span>
              </Link>
            )
          })}
        </div>
      </section>

      {upcoming.length > 0 && (
        <section className="ga-section">
          <div className="ga-section-head">
            <div>
              <p className="ga-eyebrow">Kalender</p>
              <h2 className="ga-h2">Demnächst</h2>
            </div>
          </div>
          <div className="ga-card ga-timeline">
            {upcoming.slice(0, 8).map(x => (
              <div key={x.e.slug} className="ga-tl-item">
                <span className="ga-tl-date">{fmtRelease(x.st.releaseAt!)}</span>
                <span><b>{x.e.title}</b> <span className="ga-muted">· {x.e.meta}</span></span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="ga-section">
        <div className="ga-section-head">
          <div>
            <p className="ga-eyebrow">Spielen</p>
            <h2 className="ga-h2">Mehr</h2>
          </div>
        </div>
        <div className="ga-tiles">
          <Link href="/geo/higher-lower" className="ga-tile">
            <div className="ga-tile-top"><span className="ga-badge kind">Neu · Spiel</span></div>
            <div className="ga-tile-title">Higher Lower</div>
            <div className="ga-tile-text">Welches Land hat mehr? Über 60 Kategorien von Einwohnern bis Bier pro Kopf – mit Serien-Bonus, Sternis-Wetten und Tagesrunde.</div>
            <div className="ga-tile-foot"><span /><span className="ga-row go" style={{ gap: 4 }}>Spielen <Icon name="next" size={14} /></span></div>
          </Link>
          <Link href="/geo/baukasten" className="ga-tile">
            <div className="ga-tile-top"><span className="ga-badge kind">Baukasten</span></div>
            <div className="ga-tile-title">Eigenes Quiz mischen</div>
            <div className="ga-tile-text">Italien-Regionen + Frankreich-Regionen? Länder + Hauptstädte? Alles, was freigeschaltet ist, auf einer Karte kombinieren.</div>
            <div className="ga-tile-foot"><span /><span className="ga-row go" style={{ gap: 4 }}>Öffnen <Icon name="next" size={14} /></span></div>
          </Link>
          <div className="ga-tile locked">
            <div className="ga-tile-top"><span className="ga-badge kind">Täglich</span></div>
            <div className="ga-tile-title">Tageschallenge</div>
            <div className="ga-tile-text">Jeden Tag dasselbe Quiz für alle – mit Bestenliste.</div>
            <div className="ga-tile-foot"><span className="ga-badge soon"><Icon name="lock" size={13} /> Bald verfügbar</span></div>
          </div>
          <Link href="/geo/updates" className="ga-tile">
            <div className="ga-tile-top"><span className="ga-badge kind">Updates</span></div>
            <div className="ga-tile-title">Was kam dazu?</div>
            <div className="ga-tile-text">Alle Freischaltungen der Reihe nach – und was als Nächstes kommt.</div>
            <div className="ga-tile-foot"><span /><span className="ga-row go" style={{ gap: 4 }}>Öffnen <Icon name="next" size={14} /></span></div>
          </Link>
        </div>
      </section>
      </QuizSearch>
    </div>
  )
}