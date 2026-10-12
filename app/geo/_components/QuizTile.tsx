'use client'

import Link from 'next/link'
import { KIND_LABEL, isBuilt } from '../_lib/catalog'
import { itemCount } from '../_lib/items'
import type { CatalogEntry } from '../_lib/types'
import { BEREICH_BY_KEY } from '../_content/welt'
import { useGeo } from './GeoShell'
import Icon from './Icon'
import PinButton from './PinButton'

export const fmtRelease = (iso: string) =>
  new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' Uhr'

export const fmtReleaseShort = (iso: string) =>
  new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

/** Kachel für ein Quiz – offen (Link), nur für Admins sichtbar, geplant oder mit Freischalt-Datum */
export default function QuizTile({ entry }: { entry: CatalogEntry }) {
  const { status, bests, loaded, difficulty, config, progress, price } = useGeo()
  const st = status(entry)
  const diff = config.difficulties[difficulty(entry)]
  const count = isBuilt(entry) ? itemCount(entry) : 0
  const solvedPct = count && progress[entry.slug] ? Math.min(100, Math.round((progress[entry.slug] / count) * 100)) : 0
  const best = bests[entry.slug]
  const color = BEREICH_BY_KEY[entry.bereich]?.color
  const future = st.releaseAt && !st.released

  const top = (
    <div className="ga-tile-top">
      <span className="ga-badge kind">{KIND_LABEL[entry.kind]}</span>
      {!entry.planned && <span className="ga-badge diff" style={{ '--ga-diff': diff.color } as React.CSSProperties} title={`XP ×${diff.factor}`}>{diff.label}</span>}
      {st.isNew && <span className="ga-badge new">Neu</span>}
      {st.bought && <span className="ga-badge bought" title="Mit Geo-Sternis freigekauft"><Icon name="star" size={11} /> Freigekauft</span>}
      {st.open && !st.released && !st.bought && <span className="ga-badge admin">{st.adminOnly ? 'Unsichtbar für Besucher' : 'Nur Admins'}{future ? ` · ab ${fmtReleaseShort(st.releaseAt!)}` : ''}</span>}
      <PinButton kind="quiz" pinKey={entry.slug} label={entry.title} className="ga-tile-pin" />
    </div>
  )

  if (!st.open) {
    const foot = (
      <div className="ga-tile-foot">
        {!loaded ? <span>…</span> : future ? (
          <span className="ga-badge date"><Icon name="calendar" size={13} /> Ab {fmtRelease(st.releaseAt!)}</span>
        ) : (
          <span className="ga-badge soon"><Icon name="lock" size={13} /> Bald verfügbar</span>
        )}
        {loaded && st.buyable && <span className="ga-badge buy" title="Mit Geo-Sternis freikaufen"><Icon name="star" size={12} /> {price(entry).toLocaleString('de-DE')}</span>}
      </div>
    )
    const body = (
      <>
        <span className="ga-stripe" style={{ background: color, color, opacity: 0.4 }} />
        {top}
        <div className="ga-tile-title">{entry.title}</div>
        <div className="ga-tile-meta">{entry.meta}</div>
        {entry.text && <div className="ga-tile-text">{entry.text}</div>}
        {foot}
      </>
    )
    // Freikaufbar → Kachel führt zur Quiz-Seite mit „Freikaufen“
    return st.buyable && loaded
      ? <Link href={`/geo/quiz/${entry.slug}`} className="ga-tile locked buyable" style={{ '--ga-tile': color } as React.CSSProperties} title="Mit Geo-Sternis freikaufen">{body}</Link>
      : <div className="ga-tile locked" aria-disabled="true" style={{ '--ga-tile': color } as React.CSSProperties}>{body}</div>
  }

  return (
    <Link href={`/geo/quiz/${entry.slug}`} className="ga-tile" style={{ '--ga-tile': color } as React.CSSProperties}>
      <span className="ga-stripe" style={{ background: color, color }} />
      {top}
      <div className="ga-tile-title">{entry.title}</div>
      <div className="ga-tile-meta">{entry.meta}</div>
      {entry.text && <div className="ga-tile-text">{entry.text}</div>}
      {solvedPct > 0 && (
        <div className="ga-tile-prog" title={`${solvedPct} % aller Einträge schon einmal richtig`}><span style={{ width: `${solvedPct}%` }} /></div>
      )}
      <div className="ga-tile-foot">
        <span>{best !== undefined ? <>Bestwert <span className="ga-tile-best">{best} %</span></> : 'Noch nicht gespielt'}{solvedPct > 0 && <> · {solvedPct} % entdeckt</>}</span>
        <span className="ga-row go" style={{ gap: 4 }}>Spielen <Icon name="next" size={14} /></span>
      </div>
    </Link>
  )
}