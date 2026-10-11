'use client'

// Zeitmaschine: Eine Karte von Europa wird gezeigt – in welchem Jahr ist sie entstanden?
// Die Karten liegen in public/geo/layers/hist-zeit-<jahr>.json (erzeugt von scripts/geo/build-historisch.mjs),
// "heute" ist die normale Weltkarte.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { geoGraticule10, geoPath } from 'd3-geo'
import Icon from './Icon'
import { useGeo } from './GeoShell'
import { atlasColors, loadLayer, pickProjection } from '../_lib/scene'
import { readBest, saveLocal, saveRemote, type Best } from '../_lib/results'
import type { LonLat } from '../_lib/types'

/** Jahre mit Tipp – die Tipps sind auch in scripts/geo/historisch-daten.mjs (ZEITEN) */
const ZEITEN: { year: number | 'heute'; hint: string }[] = [
  { year: 1715, hint: 'Schweden besitzt noch Finnland und Teile Pommerns (das Baltikum hat Russland gerade erobert). Polen-Litauen ist riesig.' },
  { year: 1783, hint: 'Polen-Litauen hat bei der ersten Teilung (1772) schon Land verloren. Russland hat gerade die Krim übernommen.' },
  { year: 1815, hint: 'Wiener Kongress: Polen ist aufgeteilt, Norwegen gehört zu Schweden, Italien und Deutschland sind zersplittert.' },
  { year: 1880, hint: 'Deutschland und Italien sind geeint. Serbien, Rumänien und Montenegro sind seit 1878 unabhängig.' },
  { year: 1914, hint: 'Kurz vor dem Ersten Weltkrieg: Österreich-Ungarn, das Deutsche Kaiserreich und das Russische Reich grenzen aneinander.' },
  { year: 1920, hint: 'Nach dem Ersten Weltkrieg: Polen, die Tschechoslowakei und Jugoslawien sind neu entstanden.' },
  { year: 1938, hint: 'Zwischen den Weltkriegen: Polen und das Baltikum sind unabhängig, im Osten liegt die Sowjetunion.' },
  { year: 1945, hint: 'Kriegsende: Deutschland ist in Besatzungszonen aufgeteilt.' },
  { year: 1960, hint: 'Kalter Krieg: zwei deutsche Staaten, die Sowjetunion reicht bis an die Ostsee.' },
  { year: 1994, hint: 'Nach dem Kalten Krieg: Deutschland ist wiedervereinigt, Sowjetunion und Jugoslawien sind zerfallen.' },
  { year: 'heute', hint: 'So sieht Europa heute aus – mit Kosovo, Montenegro und Nordmazedonien.' },
]
const ROUNDS = 10
const FRAME: [LonLat, LonLat] = [[-11, 35], [42, 65]]
const W = 1000

const label = (y: number | 'heute') => (y === 'heute' ? 'Heute' : String(y))
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

interface MapData { shapes: { key: string; d: string; tint: number }[]; grat: string; vb: string }
const mapCache = new Map<string, Promise<MapData>>()

function buildMap(year: number | 'heute'): Promise<MapData> {
  const id = year === 'heute' ? 'world' : `hist-zeit-${year}`
  let p = mapCache.get(id)
  if (!p) {
    p = loadLayer(id).then(layer => {
      const proj = pickProjection('auto', FRAME)
      const [[w, s], [e, n]] = FRAME
      const grid: LonLat[] = []
      for (let i = 0; i <= 12; i++) for (let j = 0; j <= 12; j++) grid.push([w + ((e - w) * i) / 12, s + ((n - s) * j) / 12])
      const target = { type: 'MultiPoint' as const, coordinates: grid }
      proj.fitWidth(W, target)
      const path0 = geoPath(proj)
      const [[x0, y0], [x1, y1]] = path0.bounds(target)
      proj.clipExtent([[x0 - 200, y0 - 200], [x1 + 200, y1 + 200]])
      const path = geoPath(proj).digits(1)
      const tints = atlasColors(layer.f.map(f => ({ key: f.i, g: f.g })))
      const shapes = layer.f.map(f => ({ key: f.i, d: path(f.g as never) ?? '', tint: tints[f.i] ?? 0 })).filter(s => s.d)
      return { shapes, grat: path(geoGraticule10()) ?? '', vb: `${x0} ${y0} ${x1 - x0} ${y1 - y0}` }
    })
    p.catch(() => mapCache.delete(id))
    mapCache.set(id, p)
  }
  return p
}

export default function Zeitmaschine({ slug, title, backHref, backLabel }: { slug: string; title: string; backHref: string; backLabel: string }) {
  const { loggedIn, refreshBests } = useGeo()
  const [order, setOrder] = useState<(number | 'heute')[]>([])
  const [round, setRound] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(false)
  const [score, setScore] = useState({ right: 0, wrong: 0 })
  const [startedAt, setStartedAt] = useState(() => Date.now())
  const [finished, setFinished] = useState<{ newBest: boolean; seconds: number } | null>(null)
  const [best, setBest] = useState<Best | null>(null)
  const [map, setMap] = useState<{ year: number | 'heute'; data: MapData } | null>(null)
  const [error, setError] = useState('')

  const restart = useCallback(() => {
    setOrder(shuffle(ZEITEN.map(z => z.year)).slice(0, ROUNDS))
    setRound(0)
    setPicked(null)
    setShowHint(false)
    setScore({ right: 0, wrong: 0 })
    setStartedAt(Date.now())
    setFinished(null)
  }, [])
  useEffect(() => { restart() }, [restart])
  useEffect(() => { setBest(readBest(slug, 'text', 'normal')) }, [slug, finished])

  const year = order[round]
  useEffect(() => {
    if (year === undefined) return
    let alive = true
    buildMap(year).then(data => { if (alive) setMap({ year, data }) }).catch(e => { if (alive) setError(String(e?.message || e)) })
    // nächste Karte schon vorladen
    const next = order[round + 1]
    if (next !== undefined) buildMap(next).catch(() => {})
    return () => { alive = false }
  }, [year, order, round])

  // Antworten: richtiges Jahr + drei andere
  const options = useMemo(() => {
    if (year === undefined) return []
    const others = shuffle(ZEITEN.map(z => z.year).filter(y => y !== year)).slice(0, 3)
    return shuffle([year, ...others]).map(label)
  }, [year])

  const done = round >= ROUNDS && order.length > 0
  useEffect(() => {
    if (!done || finished) return
    const seconds = Math.round((Date.now() - startedAt) / 1000)
    const result = { slug, mode: 'text' as const, variant: 'normal' as const, total: ROUNDS, right: score.right, wrong: score.wrong, seconds, accuracy: Math.round((score.right / ROUNDS) * 100) }
    const newBest = saveLocal(result)
    setFinished({ newBest, seconds })
    if (loggedIn) saveRemote(result).then(refreshBests)
    else if (newBest) refreshBests()
  }, [done, finished, startedAt, score, slug, loggedIn, refreshBests])

  function pick(a: string) {
    if (picked || year === undefined) return
    setPicked(a)
    const right = a === label(year)
    setScore(s => ({ right: s.right + (right ? 1 : 0), wrong: s.wrong + (right ? 0 : 1) }))
    setShowHint(true)
  }
  function next() {
    setPicked(null)
    setShowHint(false)
    setRound(r => r + 1)
  }

  const zeit = ZEITEN.find(z => z.year === year)
  const shown = map && map.year === year ? map.data : null

  return (
    <div className="ga-page" style={{ paddingTop: 18 }}>
      <div className="ga-quiz-head">
        <div style={{ minWidth: 0 }}>
          <Link href={backHref} className="ga-btn ghost sm" style={{ marginLeft: -10 }}>
            <Icon name="back" size={15} /> {backLabel}
          </Link>
          <h1 className="ga-quiz-title">{title}</h1>
          <p className="ga-quiz-sub">
            {done ? 'Fertig' : `Karte ${Math.min(round + 1, ROUNDS)} von ${ROUNDS}`}
            {best ? ` · Bestwert ${best.accuracy} %` : ''}
          </p>
        </div>
        <div className="ga-row ga-wrap">
          <button className="ga-icon-btn" aria-label="Neu starten" title="Neu starten" onClick={restart}><Icon name="refresh" size={17} /></button>
        </div>
      </div>

      <div className="ga-progress"><span style={{ width: `${(Math.min(round, ROUNDS) / ROUNDS) * 100}%` }} /></div>

      <div className="ga-quiz-layout">
        <div className="ga-map-wrap atlas">
          {done ? (
            <div className="ga-map-loading" style={{ flexDirection: 'column', gap: 6 }}>
              <Icon name="clock" size={28} />
              <span>Zeitreise beendet</span>
            </div>
          ) : !shown ? (
            <div className="ga-map-loading">{error ? <><Icon name="info" /> {error}</> : <><Icon name="clock" /> Karte wird geladen …</>}</div>
          ) : (
            <svg className="ga-map atlas" viewBox={shown.vb} role="img" aria-label="Karte von Europa – aus welchem Jahr?">
              <path className="grat" d={shown.grat} strokeWidth={0.6} />
              {shown.shapes.map(s => <path key={s.key} className={`a s-open t${s.tint}`} d={s.d} style={{ cursor: 'default' }} />)}
            </svg>
          )}
        </div>

        <aside className="ga-side">
          {done ? (
            <div className="ga-card ga-result">
              <p className="ga-eyebrow">Zeitreise beendet</p>
              <div className="ga-result-num">{score.right} / {ROUNDS}</div>
              <p className="ga-muted" style={{ margin: '0 0 14px', fontSize: 14 }}>
                {score.right === ROUNDS ? 'Perfekt – du kennst die Geschichte Europas!' : `${score.right} Jahre richtig erkannt`}
                {finished && ` · ${Math.floor(finished.seconds / 60)}:${String(finished.seconds % 60).padStart(2, '0')} Min.`}
              </p>
              {finished?.newBest && <p className="ga-badge ok" style={{ marginBottom: 14 }}>Neuer Bestwert</p>}
              {!loggedIn && <p className="ga-muted" style={{ fontSize: 12.5 }}>Melde dich an, damit deine Bestwerte im Konto gespeichert werden.</p>}
              <button className="ga-btn primary" onClick={restart}><Icon name="refresh" size={17} /> Nochmal</button>
            </div>
          ) : (
            <>
              <div className="ga-task">
                <span className="ga-task-icon"><Icon name="clock" size={20} /></span>
                <div className="ga-grow">
                  <p className="ga-task-ask">Aus welchem Jahr ist diese Karte?</p>
                  <div className="ga-task-target">{picked ? label(year!) : '?'}</div>
                  {picked && (
                    <div className={picked === label(year!) ? 'ga-task-reveal' : 'ga-task-warn'}>
                      {picked === label(year!) ? 'Richtig!' : `Leider nein – es ist ${label(year!)}.`}
                    </div>
                  )}
                </div>
              </div>
              <div className="ga-answers">
                {options.map((a, i) => {
                  const cls = picked ? (a === label(year!) ? 'right' : a === picked ? 'wrong' : '') : ''
                  return (
                    <button key={a} className={`ga-answer ${cls}`} disabled={!!picked || !shown} onClick={() => pick(a)}>
                      <kbd className="ga-desktop-only">{i + 1}</kbd><span>{a}</span>
                    </button>
                  )
                })}
              </div>
              {showHint && zeit ? (
                <div className="ga-card" style={{ fontSize: 13.5, lineHeight: 1.5 }}>
                  <p className="ga-label">{picked ? label(zeit.year) : 'Tipp'}</p>
                  <div className="ga-muted">{zeit.hint}</div>
                </div>
              ) : (
                <button className="ga-btn ghost sm" onClick={() => setShowHint(true)} disabled={!shown}><Icon name="sparkle" size={15} /> Tipp anzeigen</button>
              )}
              {picked && <button className="ga-btn primary" onClick={next}>{round + 1 >= ROUNDS ? 'Ergebnis' : 'Nächste Karte'} <Icon name="next" size={16} /></button>}
              <div className="ga-stats">
                <div className="ga-stat"><b>{score.right}</b><span>Richtig</span></div>
                <div className="ga-stat"><b>{score.wrong}</b><span>Falsch</span></div>
                <div className="ga-stat"><b>{ROUNDS - round}</b><span>Übrig</span></div>
              </div>
            </>
          )}
          <div className="ga-card" style={{ fontSize: 13.5, lineHeight: 1.5 }}>
            <p className="ga-label">So geht’s</p>
            <div className="ga-muted">Achte auf Polen, Deutschland, Italien und die Sowjetunion – an ihnen erkennt man die meisten Jahre. Grenzen nach historical-basemaps (vereinfacht).</div>
          </div>
        </aside>
      </div>
    </div>
  )
}