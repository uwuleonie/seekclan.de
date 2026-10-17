'use client'

// Länderseite → Karte zum Durchblättern: Lage in der Welt, das Land allein, dann seine Gliederungen
// (Bundesländer, Provinzen, Kreise …) mit kleinen Pfeilen. Gliederungen werden im Browser gezeichnet:
// Ebene laden (dieselben Dateien wie in den Quizzes), Name beim Zeigen/Antippen.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { geoBounds, geoCentroid, geoConicEqualArea, geoMercator, geoPath } from 'd3-geo'
import Icon from '../../_components/Icon'
import { useGeo } from '../../_components/GeoShell'
import type { Gliederung, LandDaten } from '../../_lib/land'

type Flaeche = { i: string; n?: string; g: GeoJSON.Geometry }
type Ansicht = { key: string; titel: string; bild?: string; gl?: Gliederung }

const FARBEN = ['#e9b35f', '#5fb0c9', '#6fcf97', '#ef8a6b', '#a78bda', '#d9c27a']
const W = 480, H = 320

const ebenenCache = new Map<string, Promise<{ f: Flaeche[] }>>()
function ladeEbene(url: string) {
  let p = ebenenCache.get(url)
  if (!p) {
    p = fetch(url).then(r => { if (!r.ok) throw new Error(`Karte fehlt (${r.status})`); return r.json() })
    p.catch(() => ebenenCache.delete(url))
    ebenenCache.set(url, p)
  }
  return p
}

/** Nachbarn grob über überlappende Rahmen, dann gierig färben – Nachbarflächen bekommen meist verschiedene Farben */
function faerben(boxes: [[number, number], [number, number]][]): number[] {
  const farbe: number[] = []
  boxes.forEach((b, i) => {
    const belegt = new Set<number>()
    for (let j = 0; j < i; j++) {
      const c = boxes[j]
      if (b[0][0] <= c[1][0] + 1 && c[0][0] <= b[1][0] + 1 && b[0][1] <= c[1][1] + 1 && c[0][1] <= b[1][1] + 1) belegt.add(farbe[j])
    }
    let k = 0
    while (belegt.has(k) && k < FARBEN.length - 1) k++
    farbe.push(belegt.has(k) ? i % FARBEN.length : k)
  })
  return farbe
}

function GliederungKarte({ gl, name }: { gl: Gliederung; name: string }) {
  const [flaechen, setFlaechen] = useState<Flaeche[] | null>(null)
  const [fehler, setFehler] = useState('')
  const [aktiv, setAktiv] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ladeEbene(gl.url)
      .then(d => {
        if (!alive) return
        const ids = gl.ids ? new Set(gl.ids) : null
        setFlaechen(d.f.filter(f => !ids || ids.has(f.i)))
      })
      .catch(e => { if (alive) setFehler(String(e?.message || e)) })
    return () => { alive = false }
  }, [gl])

  const bild = useMemo(() => {
    if (!flaechen?.length) return null
    const fc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: flaechen.map(f => ({ type: 'Feature', properties: {}, geometry: f.g })) }
    const [[x0, y0], [x1, y1]] = geoBounds(fc)
    const breit = x1 < x0 ? x1 + 360 - x0 : x1 - x0
    const ctr = geoCentroid(fc)
    const proj = breit > 25 || y1 - y0 > 20
      ? geoConicEqualArea().rotate([-ctr[0], 0]).parallels([y0 + (y1 - y0) / 6, y1 - (y1 - y0) / 6]).fitExtent([[10, 10], [W - 10, H - 10]], fc)
      : geoMercator().rotate([-ctr[0], 0]).fitExtent([[10, 10], [W - 10, H - 10]], fc)
    const pfad = geoPath(proj).digits(1)
    const teile = flaechen.map(f => ({ i: f.i, n: gl.namen[f.i] ?? f.n ?? f.i, d: pfad(f.g) ?? '', b: pfad.bounds(f.g) as [[number, number], [number, number]] }))
    const farbe = faerben(teile.map(t => t.b))
    return teile.map((t, k) => ({ ...t, c: FARBEN[farbe[k]] }))
  }, [flaechen, gl.namen])

  const aktivTeil = bild?.find(t => t.i === aktiv)
  const aktivName = aktivTeil?.n
  if (fehler) return <div className="ga-land-kbild leer"><Icon name="info" size={14} /> {fehler}</div>
  if (!bild) return <div className="ga-land-kbild leer">Karte lädt …</div>
  return (
    <div className="ga-land-kbild">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${gl.titel} von ${name}`} onMouseLeave={() => setAktiv(null)}>
        <rect width={W} height={H} fill="#173d4f" />
        {bild.map(t => (
          <path key={t.i} d={t.d} fill={t.c} fillOpacity={aktiv === t.i ? 1 : 0.62} stroke={aktiv === t.i ? '#fff' : '#173d4f'} strokeWidth={aktiv === t.i ? 1.6 : 0.6}
            onMouseEnter={() => setAktiv(t.i)} onClick={() => setAktiv(a => (a === t.i ? null : t.i))}>
            <title>{t.n}</title>
          </path>
        ))}
        {/* Aktive Fläche noch einmal obendrauf, damit der Rand nicht von Nachbarn verdeckt wird */}
        {aktivTeil && <path d={aktivTeil.d} fill="none" stroke="#fff" strokeWidth={1.8} pointerEvents="none" />}
      </svg>
      <span className={`ga-land-kname ${aktivName ? 'an' : ''}`}>{aktivName ?? 'Zeig oder tippe auf eine Fläche'}</span>
    </div>
  )
}

export default function LandKarten({ land, gliederungen }: { land: LandDaten; gliederungen: Gliederung[] }) {
  const { bySlug, status } = useGeo()
  const ansichten: Ansicht[] = useMemo(() => [
    ...(land.karte ? [{ key: 'lage', titel: 'Lage in der Welt', bild: `/geo/land/karte/${land.iso}.svg` }] : []),
    ...(land.form ? [{ key: 'form', titel: `${land.name} mit Hauptstadt und Großstädten`, bild: `/geo/land/karte/${land.iso}-form.svg` }] : []),
    ...gliederungen.map(gl => ({ key: gl.url, titel: `${gl.anzahl} ${gl.titel}`, gl })),
  ], [land, gliederungen])
  const [i, setI] = useState(0)
  if (!ansichten.length) return <p className="ga-muted">Keine Karte.</p>
  const a = ansichten[Math.min(i, ansichten.length - 1)]
  const geh = (d: number) => setI(x => (x + d + ansichten.length) % ansichten.length)
  const quiz = a.gl?.quiz ? bySlug[a.gl.quiz] : null
  const quizOffen = quiz && !quiz.planned && status(quiz).open

  return (
    <div className="ga-land-karten" onKeyDown={e => { if (e.key === 'ArrowLeft') geh(-1); if (e.key === 'ArrowRight') geh(1) }}>
      <div className="ga-land-kbuehne">
        {a.bild
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={a.bild} alt={`${a.titel}: ${land.name}`} width={W} height={H} />
          : <GliederungKarte key={a.key} gl={a.gl!} name={land.name} />}
        {ansichten.length > 1 && (
          <>
            <button type="button" className="ga-land-kpfeil l" onClick={() => geh(-1)} aria-label="Vorherige Karte"><Icon name="back" size={16} /></button>
            <button type="button" className="ga-land-kpfeil r" onClick={() => geh(1)} aria-label="Nächste Karte"><Icon name="next" size={16} /></button>
          </>
        )}
      </div>
      <div className="ga-land-kleiste">
        <span className="t">{a.titel}</span>
        {quizOffen && <Link href={`/geo/quiz/${quiz.slug}`} className="ga-chip sm">Als Quiz</Link>}
        {ansichten.length > 1 && (
          <span className="ga-land-kpunkte" role="tablist" aria-label="Karten">
            {ansichten.map((x, k) => (
              <button key={x.key} type="button" role="tab" aria-selected={k === i} title={x.titel} className={k === i ? 'an' : ''} onClick={() => setI(k)} />
            ))}
          </span>
        )}
      </div>
      {a.gl?.quelle === 'natural-earth' && <p className="ga-muted ga-land-klein" style={{ marginTop: 4 }}>Gliederung nach Natural Earth – kann veraltet sein.</p>}
    </div>
  )
}
