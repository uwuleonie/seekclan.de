// Baut aus einem oder mehreren Quizzes eine fertige Karte (SVG-Pfade).
//
// 1. Karten-Ebenen laden (public/geo/layers/<id>.json, einmal pro Sitzung zwischengespeichert)
// 2. Projektion wählen und auf den Kartenausschnitt einpassen
// 3. Flächen, Punkte und Hintergrund (Nachbarländer, Gradnetz) in SVG-Pfade umrechnen

import {
  geoAlbersUsa, geoBounds, geoConicEqualArea, geoGraticule10, geoMercator, geoNaturalEarth1, geoPath,
  type GeoPermissibleObjects, type GeoProjection,
} from 'd3-geo'
import type { GeoItem, GroupDef, LonLat, OverlayLine, ProjectionKind, QuizDef } from './types'

/* ───────────── Ebenen laden ───────────── */

type Geometry = GeoPermissibleObjects
export interface LayerFeature { i: string; g: Geometry; c?: LonLat }
export interface Layer { id: string; f: LayerFeature[]; byId: Record<string, LayerFeature> }

const cache = new Map<string, Promise<Layer>>()

export function loadLayer(id: string): Promise<Layer> {
  let p = cache.get(id)
  if (!p) {
    p = fetch(`/geo/layers/${id}.json`)
      .then(r => {
        if (!r.ok) throw new Error(`Karte "${id}" konnte nicht geladen werden (${r.status})`)
        return r.json()
      })
      .then((raw: { id: string; f: LayerFeature[] }) => ({ ...raw, byId: Object.fromEntries(raw.f.map(f => [f.i, f])) }))
    p.catch(() => cache.delete(id))
    cache.set(id, p)
  }
  return p
}

/* ───────────── Ergebnis ───────────── */

/** Aussehen einer Ebene: Land (Standard), Überseegebiet, Meer, See, Gebirge, Wüste oder Linie (Fluss) */
export type Look = 'land' | 'terr' | 'water' | 'lake' | 'relief' | 'sand' | 'line'

/** Ebenen mit Linien statt Flächen: Straßen und Bahnstrecken (eu-de-autobahnen, eu-fr-bahn …) */
const isLineLayer = (layer: string) => /^eu-.*-(autobahnen|autoroutes|autovias|bahn|bundesstrassen|europastrassen)$/.test(layer)

export function lookOf(layer: string): Look {
  if (layer.startsWith('meere')) return 'water'
  if (layer === 'seen') return 'lake'
  if (layer === 'gebirge') return 'relief'
  if (layer === 'wuesten') return 'sand'
  if (layer.startsWith('fluesse') || isLineLayer(layer)) return 'line'
  if (layer === 'gebiete') return 'terr'
  return 'land'
}

/** Zeichenreihenfolge: Kontinente/Länder unten, Meere nach Stufe, Gebirge/Seen darüber, Flüsse ganz oben */
const RANK: Record<string, number> = {
  kontinente: -1, world: 0, 'meere-1': 0, 'meere-2': 1, 'meere-3': 2, wuesten: 1, gebiete: 2, gebirge: 2, seen: 3, fluesse: 5, 'fluesse-alle': 5,
}
export const layerRank = (shapeKey: string) => {
  const layer = shapeKey.slice(0, shapeKey.indexOf(':'))
  return RANK[layer] ?? (isLineLayer(layer) ? 5 : 1)
}

export interface SceneShape {
  key: string; d: string; lx: number; ly: number; tiny: boolean
  /** Farbnummer wie im Atlas: benachbarte Flächen bekommen nie dieselbe Nummer (0 … TINTS-1) */
  tint: number
  look: Look
  /** Größe auf der Karte (Diagonale) – kleinere Flächen werden über größere gezeichnet */
  size: number
  /** Umriss-Rechteck auf der Karte [x0, y0, x1, y1] (z.B. für Flaggen in der Fläche) */
  bb: [number, number, number, number]
}

/** Anzahl der Atlas-Farben (siehe GeoQuiz) */
export const TINTS = 7

/**
 * Nachbarn finden: Flächen, die sich einen Grenzpunkt teilen (auf 0,02° gerundet), gelten als benachbart.
 * Danach "Landkarten-Färbung": die Fläche mit den meisten Nachbarn zuerst, jeweils die erste freie Farbe.
 */
export function atlasColors(geoms: { key: string; g: Geometry }[]): Record<string, number> {
  const cells = new Map<string, Set<number>>()
  const pts: [number, number][][] = geoms.map(() => [])
  const walk = (c: unknown, i: number) => {
    if (!Array.isArray(c)) return
    if (typeof c[0] === 'number') {
      const cx = Math.round((c[0] as number) * 40), cy = Math.round((c[1] as number) * 40)
      pts[i].push([cx, cy])
      const k = `${cx},${cy}`
      let set = cells.get(k)
      if (!set) { set = new Set(); cells.set(k, set) }
      set.add(i)
      return
    }
    for (const x of c) walk(x, i)
  }
  geoms.forEach((f, i) => walk((f.g as { coordinates?: unknown }).coordinates, i))
  // Benachbart = ein Grenzpunkt liegt in derselben oder einer angrenzenden Zelle (≈ 2–4 km)
  const nb: Set<number>[] = geoms.map(() => new Set())
  pts.forEach((list, i) => {
    for (const [cx, cy] of list) {
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const set = cells.get(`${cx + dx},${cy + dy}`)
        if (set) for (const j of set) if (j !== i) { nb[i].add(j); nb[j].add(i) }
      }
    }
  })
  const order = geoms.map((_, i) => i).sort((a, b) => nb[b].size - nb[a].size)
  const color: number[] = geoms.map(() => -1)
  for (const i of order) {
    const used = new Set([...nb[i]].map(j => color[j]))
    // Reihum starten, damit nicht alle kleinen Flächen dieselbe Farbe bekommen
    let c = i % TINTS
    for (let n = 0; n < TINTS && used.has(c); n++) c = (c + 1) % TINTS
    color[i] = c
  }
  return Object.fromEntries(geoms.map((f, i) => [f.key, color[i]]))
}
export interface SceneItem extends GeoItem { /** projizierter Punkt */ pt?: [number, number] }
export interface Scene {
  viewBox: { x: number; y: number; w: number; h: number }
  shapes: SceneShape[]
  context: { key: string; d: string; bb: [number, number, number, number] }[]
  graticule: string
  sphere: string | null
  items: SceneItem[]
  groups: Record<string, GroupDef>
  /** Ein-Pixel-Einheit (für Strich- und Schriftgrößen) */
  unit: number
  /** Physische Karte (Meere, Flüsse, Gebirge, Punkte): Land wird als Land gezeichnet statt als Hintergrund */
  phys: boolean
  /** Projektion der Karte (für das Relief) */
  projection: GeoProjection
  /** Heutige Landesgrenzen zum Einblenden (ein Pfad) */
  today: string | null
  /** Zusätzliche Linien (Mauer, Grenzen) */
  lines: { ref: string; label: string; kind: OverlayLine['kind']; d: string }[]
}

/* ───────────── Quizzes zusammenführen ───────────── */

export interface MergedQuiz {
  items: GeoItem[]
  groups: Record<string, GroupDef>
  layers: string[]
  frame: [LonLat, LonLat] | null
  /** Im Mix: Flächen von Quizzes ohne festen Ausschnitt – der Ausschnitt wird um sie erweitert */
  growRefs?: string[]
  projection: ProjectionKind
  context: boolean
  /** Hintergrund-Ebene (Standard: heutige Welt) */
  contextLayer?: string
  contextSkip?: string[]
  today?: boolean
  lines?: OverlayLine[]
}

/** Mehrere Quizzes → ein Quiz. Gleiche Einträge (gleicher key) kommen nur einmal vor. */
export function mergeQuizzes(defs: QuizDef[]): MergedQuiz {
  if (defs.length === 1) {
    const d = defs[0]
    return {
      items: d.items, groups: d.groups ?? {}, layers: d.layers, frame: d.frame ?? null, projection: d.projection ?? 'auto', context: d.context !== false,
      contextLayer: d.contextLayer, contextSkip: d.contextSkip, today: d.today, lines: d.lines,
    }
  }
  const items: GeoItem[] = []
  const seen = new Set<string>()
  const groups: Record<string, GroupDef> = {}
  for (const d of defs) {
    for (const [k, g] of Object.entries(d.groups ?? {})) groups[`${d.slug}/${k}`] = { name: `${g.name} · ${d.title}`, color: g.color }
    for (const it of d.items) {
      if (seen.has(it.key)) continue
      seen.add(it.key)
      items.push({ ...it, group: `${d.slug}/${it.group}` })
    }
  }
  // Ausschnitt = alle festen Ausschnitte zusammen, erweitert um die Flächen der Quizzes ohne festen Ausschnitt
  let frame: [LonLat, LonLat] | null = null
  for (const d of defs) {
    if (!d.frame) continue
    frame = frame ? [[Math.min(frame[0][0], d.frame[0][0]), Math.min(frame[0][1], d.frame[0][1])], [Math.max(frame[1][0], d.frame[1][0]), Math.max(frame[1][1], d.frame[1][1])]] : d.frame
  }
  const growRefs = frame ? defs.filter(d => !d.frame).flatMap(d => d.items.flatMap(i => i.areas ?? [])) : undefined
  const allUsa = defs.every(d => d.projection === 'albersUsa')
  return {
    items,
    groups,
    layers: [...new Set(defs.flatMap(d => d.layers))],
    frame,
    growRefs,
    projection: allUsa ? 'albersUsa' : defs.some(d => d.projection === 'naturalEarth') ? 'naturalEarth' : 'auto',
    context: allUsa ? false : true,
  }
}

/* ───────────── Karte bauen ───────────── */

const W = 1000

function gridOf([[w, s], [e, n]]: [LonLat, LonLat]): Geometry {
  const pts: LonLat[] = []
  for (let i = 0; i <= 12; i++) for (let j = 0; j <= 12; j++) pts.push([w + ((e - w) * i) / 12, s + ((n - s) * j) / 12])
  return { type: 'MultiPoint', coordinates: pts }
}

export function pickProjection(kind: ProjectionKind, frame: [LonLat, LonLat]): GeoProjection {
  const [[w, s], [e, n]] = frame
  const lon0 = (w + e) / 2
  if (kind === 'albersUsa') return geoAlbersUsa() as unknown as GeoProjection
  if (kind === 'naturalEarth' || e - w > 170) return geoNaturalEarth1().rotate([e - w > 300 ? -10 : -lon0, 0])
  if (kind === 'mercator') return geoMercator().rotate([-lon0, 0])
  // Kegelprojektion mit flächentreuen Breitenkreisen im Ausschnitt – sieht für Länder/Kontinente natürlich aus
  const span = n - s
  if (Math.abs((s + n) / 2) < 12 && span < 40) return geoMercator().rotate([-lon0, 0])
  return geoConicEqualArea().rotate([-lon0, 0]).parallels([s + span / 6, n - span / 6])
}

/** Größte Teilfläche (für Beschriftung) */
function largestPart(g: Geometry): Geometry {
  const gg = g as { type: string; coordinates: unknown }
  if (gg.type !== 'MultiPolygon') return g
  const polys = gg.coordinates as LonLat[][][]
  let best = polys[0], bestN = -1
  for (const p of polys) {
    const n = p[0]?.length ?? 0
    if (n > bestN) { best = p; bestN = n }
  }
  return { type: 'Polygon', coordinates: best }
}

/** Ausschnitt, in dem die feine Europa-Ebene (Natural Earth 1:10m, world-eu) vollständig vorliegt */
const EU_HD: [LonLat, LonLat] = [[-32, 26], [62, 73]]
const insideEuHd = (f: [LonLat, LonLat] | null) =>
  !!f && f[0][0] >= EU_HD[0][0] && f[0][1] >= EU_HD[0][1] && f[1][0] <= EU_HD[1][0] && f[1][1] <= EU_HD[1][1]

export async function buildScene(q: MergedQuiz): Promise<Scene> {
  // Europa-Ausschnitt mit der normalen Weltkarte: Grenzen und Küsten automatisch aus der feinen Europa-Ebene
  const hd = (q.contextLayer ?? 'world') === 'world' && insideEuHd(q.frame) && !q.growRefs?.length && q.projection !== 'albersUsa'
  const ctxLayer = hd ? 'world-eu' : q.contextLayer ?? 'world'
  const lineLayers = (q.lines ?? []).map(l => l.ref.slice(0, l.ref.indexOf(':')))
  const layerIds = [...new Set([...q.layers, ...(q.context ? [ctxLayer] : []), ...(q.today ? ['world'] : []), ...(hd ? ['world', 'world-eu'] : []), ...lineLayers])]
  const layers = Object.fromEntries((await Promise.all(layerIds.map(loadLayer))).map(l => [l.id, l]))
  /** Feine Fläche, außer das Land reicht über den feinen Ausschnitt hinaus (Russland, Kasachstan, Nordafrika …) – dann ganz, aber gröber */
  const hdOf = (id: string): LayerFeature | undefined => {
    const fine = layers['world-eu']?.byId[id], coarse = layers.world?.byId[id]
    if (!fine) return coarse
    if (!coarse) return fine
    // Beschnitten = die feine Fläche stößt an den Rand des feinen Ausschnitts
    const [[w, s], [e, n]] = geoBounds(fine.g as never) as [LonLat, LonLat]
    const eps = 0.05
    if (w <= EU_HD[0][0] + eps || s <= EU_HD[0][1] + eps || e >= EU_HD[1][0] - eps || n >= EU_HD[1][1] - eps) return coarse
    return fine.c ? fine : { ...fine, c: coarse.c }
  }

  // Benötigte Flächen
  const refs = new Set<string>()
  for (const it of q.items) for (const a of it.areas ?? []) refs.add(a)
  const featureOf = (ref: string): LayerFeature | undefined => {
    const i = ref.indexOf(':')
    const lid = ref.slice(0, i), id = ref.slice(i + 1)
    if (hd && lid === 'world') return hdOf(id)
    return layers[lid]?.byId[id]
  }

  // Ausschnitt: vorgegeben oder aus den Flächen/Punkten
  let frame = q.frame
  let w = 180, s = 90, e = -180, n = -90
  const grow = (b: [LonLat, LonLat]) => {
    // Flächen über die Datumsgrenze (z.B. Russland, Fidschi) nicht über die ganze Welt ziehen
    const bw = b[0][0], be = b[1][0] < b[0][0] ? b[1][0] + 360 : b[1][0]
    w = Math.min(w, bw); e = Math.max(e, be); s = Math.min(s, b[0][1]); n = Math.max(n, b[1][1])
  }
  if (frame && q.growRefs?.length) {
    grow(frame)
    for (const r of q.growRefs) {
      const f = featureOf(r)
      if (f) grow(geoBounds(f.g as never) as [LonLat, LonLat])
    }
    frame = [[w, s], [e, n]]
  }
  if (!frame) {
    for (const r of refs) {
      const f = featureOf(r)
      if (f) grow(geoBounds(f.g as never) as [LonLat, LonLat])
    }
    for (const it of q.items) if (it.point) grow([it.point, it.point])
    if (w > e) { w = -180; e = 180; s = -60; n = 85 }
    const padX = Math.max(0.4, (e - w) * 0.04), padY = Math.max(0.3, (n - s) * 0.05)
    frame = [[w - padX, Math.max(-85, s - padY)], [e + padX, Math.min(85, n + padY)]]
  }

  const projection = pickProjection(q.projection, frame)
  const fitTarget = q.projection === 'albersUsa'
    ? ({ type: 'FeatureCollection', features: [...refs].map(r => ({ type: 'Feature', properties: {}, geometry: featureOf(r)?.g })).filter(f => f.geometry) } as unknown as Geometry)
    : gridOf(frame)
  projection.fitWidth(W, fitTarget as never)
  const path0 = geoPath(projection)
  const [[x0, y0], [x1, y1]] = path0.bounds(fitTarget as never)
  const pad = 14
  const viewBox = { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: Math.min(y1 - y0 + pad * 2, (x1 - x0) * 1.6) }

  // Großzügig abschneiden, damit weit entfernte Länder keine Riesen-Pfade erzeugen
  if (q.projection !== 'albersUsa') {
    const mx = viewBox.w * 0.6, my = viewBox.h * 0.6
    projection.clipExtent([[viewBox.x - mx, viewBox.y - my], [viewBox.x + viewBox.w + mx, viewBox.y + viewBox.h + my]])
  }
  const path = geoPath(projection).digits(1)
  const unit = viewBox.w / 1000

  // Flächen der Quiz-Einträge
  const shapes: SceneShape[] = []
  // Atlas-Farben nur für kleinere Karten berechnen (bei tausenden Flüssen zu teuer – und dort ungenutzt)
  const tints = refs.size <= 400 ? atlasColors([...refs].map(r => ({ key: r, g: featureOf(r)?.g })).filter(x => x.g) as { key: string; g: Geometry }[]) : {}
  for (const r of refs) {
    const f = featureOf(r)
    if (!f) continue
    const d = path(f.g as never)
    if (!d) continue
    const b = path.bounds(f.g as never)
    let lx: number, ly: number
    const c = f.c ? projection(f.c) : null
    if (c && Number.isFinite(c[0])) [lx, ly] = c
    else [lx, ly] = path.centroid(largestPart(f.g) as never)
    const size = Math.hypot(b[1][0] - b[0][0], b[1][1] - b[0][1])
    const tiny = size < 7 * unit
    // Umriss-Rechteck der Hauptfläche (ohne ferne Inseln wie Spitzbergen oder die Azoren)
    const mb = f.g && (f.g as { type: string }).type === 'MultiPolygon' ? path.bounds(largestPart(f.g) as never) : b
    shapes.push({ key: r, d, lx, ly, tiny, tint: tints[r] ?? 0, look: lookOf(r.slice(0, r.indexOf(':'))), size, bb: [mb[0][0], mb[0][1], mb[1][0], mb[1][1]] })
  }

  // Hintergrund: alle Länder (bzw. Staaten der historischen Ebene), die nicht selbst abgefragt werden
  const context: Scene['context'] = []
  const skip = new Set(q.contextSkip ?? [])
  if (q.context && layers[ctxLayer]) {
    for (const f0 of layers[ctxLayer].f) {
      if (refs.has(`${ctxLayer}:${f0.i}`) || (hd && refs.has(`world:${f0.i}`)) || skip.has(f0.i)) continue
      const f = hd ? hdOf(f0.i) ?? f0 : f0
      const d = path(f.g as never)
      if (!d) continue
      const b = path.bounds(largestPart(f.g) as never)
      context.push({ key: f.i, d, bb: [b[0][0], b[0][1], b[1][0], b[1][1]] })
    }
  }

  // Heutige Grenzen (nur Umrisse, zum Vergleich)
  let today: string | null = null
  if (q.today && layers.world) {
    today = layers.world.f.map(f => path(f.g as never) ?? '').join('')
  }
  const lines = (q.lines ?? []).map(l => {
    const f = featureOf(l.ref)
    return { ...l, d: f ? path(f.g as never) ?? '' : '' }
  }).filter(l => l.d)

  const items: SceneItem[] = q.items.map(it => {
    if (!it.point) return it
    const p = projection(it.point)
    return p && Number.isFinite(p[0]) ? { ...it, pt: [p[0], p[1]] as [number, number] } : it
  })

  const isGlobe = q.projection === 'naturalEarth' || frame[1][0] - frame[0][0] > 170
  return {
    viewBox,
    shapes,
    context,
    graticule: q.projection === 'albersUsa' ? '' : path(geoGraticule10()) ?? '',
    sphere: isGlobe ? path({ type: 'Sphere' }) : null,
    items,
    groups: q.groups,
    unit,
    phys: !shapes.some(sh => sh.look === 'land'),
    projection,
    today,
    lines,
  }
}