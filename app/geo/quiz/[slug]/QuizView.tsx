'use client'

// Prüft die Freischaltung und startet dann das Karten-Quiz (einzeln oder kombiniert) – bzw. Zeitmaschine oder Lernkarten (Sprachen).
// Gesperrte Quizzes lassen sich hier mit Geo-Sternis freikaufen.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useGeo } from '../../_components/GeoShell'
import GeoQuiz from '../../_components/GeoQuiz'
import Zeitmaschine from '../../_components/Zeitmaschine'
import SchriftQuiz from '../../_components/SchriftQuiz'
import Icon from '../../_components/Icon'
import LandLeiste from '../../_components/LandLeiste'
import { fmtRelease } from '../../_components/QuizTile'
import { isBuilt } from '../../_lib/catalog'
import type { CatalogEntry, QuizDef } from '../../_lib/types'

export default function QuizView({ slugs }: { slugs: string[] }) {
  const { status, loaded, bySlug, bereichName } = useGeo()
  const entries = useMemo(() => slugs.map(s => bySlug[s]).filter(Boolean), [slugs, bySlug])
  const isMix = slugs.length > 1

  const blocked = entries.filter(e => !status(e).open)
  const defs = useMemo(() => entries.filter(isBuilt) as QuizDef[], [entries])

  if (!loaded) {
    return <div className="ga-page"><div className="ga-map-loading">Lädt …</div></div>
  }

  const first = entries[0]
  const back = isMix
    ? { href: '/geo/baukasten', label: 'Baukasten' }
    : { href: `/geo/${first.bereich}${first.country ? `#land-${first.country}` : ''}`, label: bereichName(first.bereich) }

  if (blocked.length) {
    const st = status(blocked[0])
    return (
      <div className="ga-page">
        <div className="ga-card ga-locked">
          <div className="ga-locked-icon"><Icon name={st.releaseAt ? 'calendar' : 'lock'} size={30} /></div>
          <p className="ga-eyebrow">{st.planned ? 'In Arbeit' : 'Noch gesperrt'}</p>
          <h1 className="ga-h2" style={{ margin: '6px 0 10px' }}>{blocked.length === 1 ? blocked[0].title : `${blocked.length} Quizzes noch gesperrt`}</h1>
          <p className="ga-lead" style={{ margin: '0 auto 18px' }}>
            {st.releaseAt && !st.released
              ? <>Wird freigeschaltet am <b>{fmtRelease(st.releaseAt)}</b>.</>
              : 'Bald verfügbar – dieses Quiz kommt mit einem der nächsten Updates.'}
          </p>
          {blocked.filter(e => status(e).buyable).map(e => <BuyBox key={e.slug} entry={e} showTitle={blocked.length > 1} />)}
          <Link href={back.href} className="ga-btn ghost"><Icon name="back" size={15} /> {back.label}</Link>
        </div>
      </div>
    )
  }

  const title = isMix ? 'Eigener Mix' : defs[0].title
  const key = isMix ? `mix:${[...slugs].sort().join('+')}` : defs[0].slug
  if (!isMix && defs[0].special === 'zeitmaschine') return <Zeitmaschine slug={key} title={title} backHref={back.href} backLabel={back.label} />
  if (!isMix && defs[0].special === 'schrift') return <SchriftQuiz key={key} def={defs[0]} backHref={back.href} backLabel={back.label} />
  return <GeoQuiz key={key} defs={defs} slug={key} title={title} backHref={back.href} backLabel={back.label} topBar={!isMix && defs[0].country ? <LandLeiste entry={defs[0]} /> : undefined} />
}

/** Quiz mit Geo-Sternis freikaufen (mit Rückfrage) */
function BuyBox({ entry, showTitle }: { entry: CatalogEntry; showTitle: boolean }) {
  const { loggedIn, profile, price, buyQuiz, config, difficulty } = useGeo()
  const [ask, setAsk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const cost = price(entry)
  const have = profile?.sternis ?? 0
  const diff = config.difficulties[difficulty(entry)]

  const buy = async () => {
    setBusy(true)
    setError('')
    const r = await buyQuiz(entry.slug)
    setBusy(false)
    setAsk(false)
    if (!r.ok) setError(r.error)
  }

  return (
    <div className="ga-buy">
      <div className="ga-buy-head">
        <span className="ga-buy-price"><Icon name="star" size={16} /> {cost.toLocaleString('de-DE')}</span>
        <span>
          <b>{showTitle ? entry.title : 'Jetzt freikaufen'}</b>
          <small className="ga-muted">Schwierigkeit {diff.label} · danach für immer offen</small>
        </span>
      </div>
      {!loggedIn ? (
        <Link href="/login" className="ga-btn sm">Einloggen, um mit Geo-Sternis freizukaufen</Link>
      ) : have < cost ? (
        <p className="ga-muted ga-buy-note">Du hast <b>{have.toLocaleString('de-DE')}</b> Geo-Sternis – es fehlen noch <b>{(cost - have).toLocaleString('de-DE')}</b>. Sternis gibt es für jedes neue Level und für fertige Quizzes.</p>
      ) : ask ? (
        <div className="ga-row ga-wrap" style={{ justifyContent: 'center' }}>
          <span>Für <b>{cost.toLocaleString('de-DE')}</b> von deinen {have.toLocaleString('de-DE')} Geo-Sternis freikaufen?</span>
          <button className="ga-btn primary sm" disabled={busy} onClick={buy}><Icon name="check" size={14} /> Ja, freikaufen</button>
          <button className="ga-btn ghost sm" disabled={busy} onClick={() => setAsk(false)}>Abbrechen</button>
        </div>
      ) : (
        <button className="ga-btn primary" onClick={() => setAsk(true)}><Icon name="star" size={15} /> Für {cost.toLocaleString('de-DE')} Geo-Sternis freikaufen</button>
      )}
      {error && <p className="ga-buy-error">{error}</p>}
    </div>
  )
}