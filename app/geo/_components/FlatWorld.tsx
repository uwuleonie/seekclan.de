'use client'

// Flache Weltkarte mit klickbaren Kontinenten.
// Startseite: Ersatz, falls der 3D-Globus nicht läuft. Kontinent-Seiten: Kopfbild mit hervorgehobenem Kontinent.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { geoCentroid, geoGraticule10, geoPath } from 'd3-geo'
import { loadLayer, pickProjection, type Layer } from '../_lib/scene'
import { BEREICH_BY_KEY, continentAt } from '../_content/welt'
import type { Bereich } from '../_lib/types'

export default function FlatWorld({ focus, height }: { focus?: Bereich; height?: number }) {
  const router = useRouter()
  const [layer, setLayer] = useState<Layer | null>(null)
  const [hover, setHover] = useState<string | null>(null)

  useEffect(() => { loadLayer('world').then(setLayer).catch(() => {}) }, [])

  const drawn = useMemo(() => {
    if (!layer) return null
    const b = focus && focus !== 'welt' ? BEREICH_BY_KEY[focus] : BEREICH_BY_KEY.welt
    const projection = pickProjection(focus && focus !== 'welt' ? 'auto' : 'naturalEarth', b.frame)
    const W = 1000
    const grid = { type: 'MultiPoint', coordinates: [] as [number, number][] }
    const [[w, s], [e, n]] = b.frame
    for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++) grid.coordinates.push([w + ((e - w) * i) / 10, s + ((n - s) * j) / 10])
    projection.fitWidth(W, grid as never)
    const path0 = geoPath(projection)
    const [[x0, y0], [x1, y1]] = path0.bounds(grid as never)
    const vb = { x: x0 - 6, y: y0 - 6, w: x1 - x0 + 12, h: y1 - y0 + 12 }
    projection.clipExtent([[vb.x - vb.w * 0.3, vb.y - vb.h * 0.3], [vb.x + vb.w * 1.3, vb.y + vb.h * 1.3]])
    const path = geoPath(projection).digits(1)
    const countries = layer.f.map(f => {
      const c = geoCentroid(f.g as never)
      const cont = f.i === 'ATA' ? null : continentAt(f.i, f.c?.[0] ?? c[0])
      return { id: f.i, d: path(f.g as never) ?? '', cont }
    }).filter(c => c.d)
    return {
      vb, countries,
      graticule: path(geoGraticule10()) ?? '',
      sphere: !focus || focus === 'welt' ? path({ type: 'Sphere' }) : null,
    }
  }, [layer, focus])

  if (!drawn) return <div className="ga-map-loading" style={{ aspectRatio: '2 / 1' }}>Karte lädt …</div>

  const fillOf = (cont: string | null) => {
    if (!cont) return 'var(--ga-context)'
    const col = BEREICH_BY_KEY[cont as Bereich]?.color ?? '#888'
    if (focus && focus !== 'welt') return cont === focus ? col : 'var(--ga-context)'
    return hover && hover !== cont ? `${col}55` : col
  }

  return (
    <svg className="ga-flat-world" viewBox={`${drawn.vb.x} ${drawn.vb.y} ${drawn.vb.w} ${drawn.vb.h}`} style={height ? { height, width: '100%' } : undefined}
      role="img" aria-label={focus && focus !== 'welt' ? `Karte: ${BEREICH_BY_KEY[focus].name}` : 'Weltkarte – Kontinent anklicken'}
      onPointerLeave={() => setHover(null)}>
      {drawn.sphere
        ? <path d={drawn.sphere} style={{ fill: 'var(--ga-ocean)' }} />
        : <rect x={drawn.vb.x} y={drawn.vb.y} width={drawn.vb.w} height={drawn.vb.h} style={{ fill: 'var(--ga-ocean)' }} />}
      <path d={drawn.graticule} style={{ fill: 'none', stroke: 'var(--ga-ocean-line)' }} strokeWidth={0.6} />
      {drawn.countries.map(c => (
        <path
          key={c.id}
          className={c.cont ? 'c' : ''}
          d={c.d}
          style={{ fill: fillOf(c.cont), stroke: 'var(--ga-land-stroke)', strokeOpacity: 0.5 }}
          strokeWidth={0.4}
          onPointerEnter={() => setHover(c.cont)}
          onClick={() => { if (c.cont) router.push(`/geo/${c.cont}`) }}
        />
      ))}
    </svg>
  )
}
