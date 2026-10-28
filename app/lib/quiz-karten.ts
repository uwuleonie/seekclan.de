import { promises as fs } from 'fs'
import path from 'path'
import { geoArea, geoBounds, geoCentroid, geoMercator, geoNaturalEarth1, geoPath, type GeoPermissibleObjects } from 'd3-geo'
import { pickProjection } from '@/app/geo/_lib/scene'
import { BEREICH_BY_KEY, continentAt } from '@/app/geo/_content/welt'
import type { CatalogEntry, LonLat } from '@/app/geo/_lib/types'

// Kleine Kartenbilder für die Quiz-Hauptseite (seekclan.de/quiz):
// Zu jedem Quiz der passende Ausschnitt aus der Weltkarte (public/geo/layers/world.json) –
// das Land des Quiz (z.B. Spanien) oder der Kontinent (z.B. Südamerika) hervorgehoben, alles andere als blasser Umriss.
// Gerechnet wird auf dem Server, ins Browserfenster gehen nur zwei kurze SVG-Pfade.
// Ergebnisse werden pro Ausschnitt im Speicher gehalten (ändern sich nie).

export interface KartenBild {
  w: number
  h: number
  /** Übriges Land im Ausschnitt */
  land: string
  /** Hervorgehobenes Land / hervorgehobener Kontinent */
  fokus: string
}

const W = 320
const H = 128
const RAND = 14

type Feature = { i: string; g: GeoPermissibleObjects; c?: LonLat }
let welt: Promise<Feature[]> | null = null
function loadWelt(): Promise<Feature[]> {
  if (!welt) {
    welt = fs.readFile(path.join(process.cwd(), 'public', 'geo', 'layers', 'world.json'), 'utf8')
      .then(t => (JSON.parse(t) as { f: Feature[] }).f)
    welt.catch(() => { welt = null })
  }
  return welt
}

/**
 * Sparsamer SVG-Pfad: ganze Pixel, Punkte näher als MIN_ABSTAND px am vorigen fallen weg, winzige Ringe auch,
 * dazu relative Befehle (l statt L). So bleibt selbst ein ganzer Kontinent bei 320 px Breite nur wenige KB groß.
 */
const MIN_ABSTAND = 2.2
class KurzPfad {
  private out: string[] = []
  private ring: [number, number][] = []
  moveTo(x: number, y: number) { this.flush(); this.ring = [[x, y]] }
  lineTo(x: number, y: number) {
    const l = this.ring[this.ring.length - 1]
    if (!l || Math.hypot(x - l[0], y - l[1]) >= MIN_ABSTAND) this.ring.push([x, y])
  }
  closePath() { this.flush() }
  arc() { /* Punkte werden nicht gezeichnet */ }
  private flush() {
    const r = this.ring.map(([x, y]) => [Math.round(x), Math.round(y)] as [number, number])
      .filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1])
    this.ring = []
    if (r.length < 3) return
    const xs = r.map(p => p[0]), ys = r.map(p => p[1])
    // Ringe kleiner als ~2 px weglassen (winzige Inseln)
    if (Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys) < 4) return
    let d = `M${r[0][0]},${r[0][1]}`
    for (let i = 1; i < r.length; i++) {
      const dx = r[i][0] - r[i - 1][0], dy = r[i][1] - r[i - 1][1]
      d += `l${dx}${dy < 0 ? '' : ','}${dy}`
    }
    this.out.push(d + 'z')
  }
  result() { this.flush(); return this.out.join('') }
}

/** Größte Teilfläche eines Landes (damit Überseegebiete den Ausschnitt nicht aufblähen) */
function hauptteil(g: GeoPermissibleObjects): GeoPermissibleObjects {
  const gg = g as { type: string; coordinates: LonLat[][][] }
  if (gg.type !== 'MultiPolygon') return g
  let best = gg.coordinates[0], bestA = -1
  for (const p of gg.coordinates) {
    const a = geoArea({ type: 'Polygon', coordinates: p } as never)
    if (a > bestA) { best = p; bestA = a }
  }
  return { type: 'Polygon', coordinates: best } as never
}

const memo = new Map<string, Promise<KartenBild | null>>()

/** Kartenbild zu einem Quiz: Land (country) vor Bereich; Sprachen haben keins */
export function kartenBild(e: CatalogEntry): Promise<KartenBild | null> {
  const key = e.country ? `land:${e.country}` : `bereich:${e.bereich}`
  if (e.bereich === 'sprachen' && !e.country) return Promise.resolve(null)
  let p = memo.get(key)
  if (!p) {
    p = baue(e.country ?? null, e.bereich).catch(err => { console.error('quiz-karten', key, err); memo.delete(key); return null })
    memo.set(key, p)
  }
  return p
}

async function baue(land: string | null, bereich: string): Promise<KartenBild | null> {
  const features = (await loadWelt()).filter(f => f.i !== 'ATA')
  const istWelt = !land && bereich === 'welt'
  const b = BEREICH_BY_KEY[bereich as keyof typeof BEREICH_BY_KEY]

  let projection
  if (land) {
    const f = features.find(x => x.i === land)
    if (!f) return null
    const teil = hauptteil(f.g)
    const [[w, s], [e, n]] = geoBounds(teil as never)
    // Kleine Länder: etwas mehr Umgebung zeigen
    const pad = Math.max(0, 6 - Math.max(e - w, n - s)) / 2
    projection = pickProjection('auto', [[w - pad, s - pad], [e + pad, n + pad]])
    projection.fitExtent([[RAND, RAND], [W - RAND, H - RAND]], teil as never)
  } else if (istWelt || !b) {
    projection = geoNaturalEarth1().rotate([-10, 0])
    projection.fitExtent([[6, 4], [W - 6, H - 4]], { type: 'Sphere' } as never)
  } else {
    const [[w, s], [e, n]] = b.frame
    projection = Math.abs((s + n) / 2) < 25 ? geoMercator().rotate([-(w + e) / 2, 0]) : pickProjection('auto', b.frame)
    const rahmen = { type: 'MultiPoint', coordinates: [[w, s], [e, s], [w, n], [e, n], [(w + e) / 2, s], [(w + e) / 2, n]] }
    projection.fitExtent([[RAND, RAND / 2], [W - RAND, H - RAND / 2]], rahmen as never)
  }
  projection.clipExtent([[-20, -20], [W + 20, H + 20]])

  const landPfad = new KurzPfad(), fokusPfad = new KurzPfad()
  const zeichneLand = geoPath(projection, landPfad as never)
  const zeichneFokus = geoPath(projection, fokusPfad as never)
  for (const f of features) {
    let imFokus: boolean
    if (land) imFokus = f.i === land
    else if (istWelt) imFokus = true
    else imFokus = continentAt(f.i, f.c?.[0] ?? geoCentroid(f.g as never)[0]) === bereich
    ;(imFokus ? zeichneFokus : zeichneLand)(f.g as never)
  }
  return { w: W, h: H, land: landPfad.result(), fokus: fokusPfad.result() }
}