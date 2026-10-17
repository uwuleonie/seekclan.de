'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useGeo } from '../../_components/GeoShell'
import Icon from '../../_components/Icon'
import ResultMap from '../../_components/ResultMap'
import { isBuilt } from '../../_lib/catalog'
import type { QuizDef } from '../../_lib/types'

type Share = {
  id: string; slug: string; title: string; mode: string; variant: string; total: number; right: number; wrong: number
  seconds: number; accuracy: number; bestStreak: number; solved: string[]; mistakes: string[]; username: string | null; name?: string | null; createdAt: string
}
const MODE_DE: Record<string, string> = { click: 'Auf Karte finden', name: 'Namen zuordnen', type: 'Eintippen', text: 'Wissensfrage', mixed: 'Gemischt' }
const VAR_DE: Record<string, string> = { normal: 'Normal', sprint: 'Sprint', leben: '3 Leben' }
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export default function ErgebnisView({ id }: { id: string }) {
  const { bySlug, status } = useGeo()
  const [share, setShare] = useState<Share | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    fetch(`/api/geo/share?id=${encodeURIComponent(id)}`).then(r => r.json())
      .then(d => (d.share ? setShare(d.share) : setError(d.error || 'Nicht gefunden'))).catch(() => setError('Fehler beim Laden'))
  }, [id])

  const slugs = useMemo(() => (share ? (share.slug.startsWith('mix:') ? share.slug.slice(4).split('+') : [share.slug]) : []), [share])
  const defs = useMemo(() => slugs.map(s => bySlug[s]).filter(e => isBuilt(e)) as QuizDef[], [slugs, bySlug])
  const playable = defs.length > 0 && defs.every(d => status(d).open)
  const playHref = slugs.length > 1 ? `/geo/quiz/mix?q=${slugs.join(',')}` : `/geo/quiz/${slugs[0]}`

  if (error) return <div className="ga-page"><div className="ga-card ga-locked"><h1 className="ga-h2">{error}</h1><Link href="/geo" className="ga-btn primary" style={{ marginTop: 12 }}>Zum Atlas</Link></div></div>
  if (!share) return <div className="ga-page"><div className="ga-map-loading">Lädt …</div></div>

  const answered = share.right + share.wrong
  const pctRight = answered ? (share.right / answered) * 100 : 0
  return (
    <div className="ga-page" style={{ maxWidth: 980 }}>
      <Link href="/geo" className="ga-btn ghost sm" style={{ marginLeft: -10 }}><Icon name="back" size={15} /> Atlas</Link>
      <p className="ga-eyebrow" style={{ marginTop: 8 }}>Ergebnis{share.username ? ` von ${share.name ?? share.username}` : ''} · {new Date(share.createdAt).toLocaleDateString('de-DE')}</p>
      <h1 className="ga-title" style={{ marginBottom: 14 }}>{share.title}</h1>

      <div className="ga-erg">
        <div className="ga-card ga-erg-card">
          <div className="ga-erg-ring" style={{ '--p': `${share.variant === 'sprint' ? pctRight : share.accuracy}` } as React.CSSProperties}>
            <span>{share.variant === 'sprint' ? share.right : `${share.accuracy} %`}</span>
            <small>{share.variant === 'sprint' ? 'richtig' : 'Treffer'}</small>
          </div>
          <div className="ga-erg-stats">
            <div><b>{share.right}</b><span>richtig</span></div>
            <div><b>{share.wrong}</b><span>Fehler</span></div>
            <div><b>{fmtTime(share.seconds)}</b><span>Minuten</span></div>
            {share.bestStreak > 1 && <div><b>{share.bestStreak}</b><span>beste Serie</span></div>}
          </div>
          <div className="ga-erg-bar" aria-hidden="true"><span className="ok" style={{ width: `${pctRight}%` }} /><span className="bad" style={{ width: `${100 - pctRight}%` }} /></div>
          <p className="ga-muted" style={{ fontSize: 13 }}>{MODE_DE[share.mode] ?? share.mode} · {VAR_DE[share.variant] ?? share.variant} · {share.total} Einträge</p>
          {playable
            ? <Link href={playHref} className="ga-btn primary"><Icon name="play" size={15} /> Selbst spielen – schaffst du mehr?</Link>
            : <Link href="/geo" className="ga-btn primary">Zum Atlas</Link>}
        </div>
        <div className="ga-card ga-erg-map">
          {defs.length ? <ResultMap defs={defs} solved={share.solved} mistakes={share.mistakes} /> : <p className="ga-muted">Karte nicht verfügbar.</p>}
          <div className="ga-erg-legend"><span className="ok">richtig</span><span className="bad">Fehler</span><span className="open">nicht gefragt</span></div>
        </div>
      </div>
    </div>
  )
}