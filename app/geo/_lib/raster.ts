// Kachel-Bilder für die Kartenansichten "Relief (scharf)", "Satellit" und "Nachtlichter".
//
// Die Kacheln liegen im üblichen Web-Kachelformat (Web-Mercator, 256 × 256 Pixel, Zoomstufe z) und kommen von
// unserem eigenen Server (/api/geo/tiles/…), der sie einmal bei der Quelle holt und speichert.
// Hier werden die passenden Kacheln für einen Kartenausschnitt geladen, zu einem Bild zusammengesetzt und
// in die Projektion der Karte umgerechnet (jeder Bildpunkt → Länge/Breite → Farbe aus den Kacheln).
// Je weiter man hineinzoomt, desto feinere Kacheln werden genommen – deshalb bleibt das Bild scharf.

import type { GeoProjection } from 'd3-geo'
import { invertSafe, rangeOf, type ReliefImage, type ViewBox } from './relief'

export type TileSource = 'terrain' | 'sat' | 'night'

const TILE = 256
const MAX_LAT = 85.0511
const CFG: Record<TileSource, { minZ: number; maxZ: number; quality: number; maxTiles: number; sharp: number }> = {
  // sharp < 1: Kacheln dürfen etwas hochskaliert werden (das Relief ist ohnehin weich, spart Ladezeit)
  terrain: { minZ: 3, maxZ: 12, quality: 0.84, maxTiles: 42, sharp: 0.7 },
  sat: { minZ: 2, maxZ: 13, quality: 0.86, maxTiles: 56, sharp: 1 },
  // Nachtlichter gibt es nur bis Zoomstufe 8 – darüber wird hochskaliert (Lichter sind ohnehin weich)
  night: { minZ: 1, maxZ: 8, quality: 0.86, maxTiles: 56, sharp: 1 },
}

const tileUrl = (src: TileSource, z: number, x: number, y: number) => `/api/geo/tiles/${src}/${z}/${x}/${y}`

/* ── Kacheln laden (mit kleinem Zwischenspeicher) ── */
const cache = new Map<string, Promise<HTMLImageElement | null>>()
function loadTile(url: string): Promise<HTMLImageElement | null> {
  let p = cache.get(url)
  if (!p) {
    p = new Promise(resolve => {
      const img = new Image()
      img.decoding = 'async'
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = url
    })
    p.then(img => { if (!img) cache.delete(url) })
    cache.set(url, p)
    // Nicht unbegrenzt Bilder im Speicher halten
    if (cache.size > 600) cache.delete(cache.keys().next().value as string)
  }
  return p
}

const mercX = (lon: number, n: number) => ((lon + 180) / 360) * n
const mercY = (lat: number, n: number) => {
  const p = (Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * Math.PI) / 180
  return ((1 - Math.log(Math.tan(p) + 1 / Math.cos(p)) / Math.PI) / 2) * n
}
const pause = () => new Promise<void>(r => setTimeout(r, 0))

/** Wie viele Bildpunkte pro Längengrad ein Ausschnitt bei dieser Bildbreite braucht */
export function pxPerDegree(proj: GeoProjection, vb: ViewBox, outW: number): number {
  const rg = rangeOf(proj, vb, 0)
  return rg ? outW / Math.max(0.01, rg.east - rg.west) : 0
}

/**
 * Lädt die Kacheln für einen Kartenausschnitt und rechnet sie in die Projektion der Karte um.
 * outW: Breite des Ergebnisbildes in Pixeln. Wo keine Kachel kam, bleibt das Bild durchsichtig.
 * coarse: Zoomstufen gröber laden (wenige Kacheln) – für ein schnelles erstes Bild, das danach durch das scharfe ersetzt wird.
 */
export async function renderTiles(src: TileSource, proj: GeoProjection, vb: ViewBox, outW: number, signal?: { cancelled: boolean }, coarse = 0): Promise<ReliefImage | null> {
  const cfg = CFG[src]
  const rg = rangeOf(proj, vb, 0)
  if (!rg) return null
  const lonSpan = Math.max(0.01, rg.east - rg.west), latSpan = Math.max(0.01, rg.n - rg.s)
  const west = rg.west - lonSpan * 0.03, east = rg.east + lonSpan * 0.03
  const north = Math.min(MAX_LAT, rg.n + latSpan * 0.03), south = Math.max(-MAX_LAT, rg.s - latSpan * 0.03)
  const outH = Math.max(1, Math.round((outW * vb.h) / vb.w))

  // Zoomstufe: so fein, dass die Kacheln den Ausschnitt in voller Schärfe füllen – aber nicht zu viele Kacheln
  const need = (outW / lonSpan) * cfg.sharp
  let z = Math.max(cfg.minZ, Math.min(cfg.maxZ, Math.ceil(Math.log2((need * 360) / TILE)) - coarse))
  let n = 0, tx0 = 0, tx1 = 0, ty0 = 0, ty1 = 0
  for (;;) {
    n = 2 ** z
    tx0 = Math.floor(mercX(west, n)); tx1 = Math.floor(mercX(east, n))
    ty0 = Math.max(0, Math.floor(mercY(north, n))); ty1 = Math.min(n - 1, Math.floor(mercY(south, n)))
    if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) <= cfg.maxTiles || z <= cfg.minZ) break
    z--
  }
  const nx = tx1 - tx0 + 1, ny = ty1 - ty0 + 1

  // Kacheln laden und zu einem Bild zusammensetzen
  const mosaic = document.createElement('canvas')
  mosaic.width = nx * TILE; mosaic.height = ny * TILE
  const mctx = mosaic.getContext('2d', { willReadFrequently: true })!
  const jobs: Promise<void>[] = []
  let missing = false
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const wx = ((tx % n) + n) % n
      jobs.push(loadTile(tileUrl(src, z, wx, ty)).then(img => { if (img) mctx.drawImage(img, (tx - tx0) * TILE, (ty - ty0) * TILE, TILE, TILE); else missing = true }))
    }
  }
  await Promise.all(jobs)
  if (signal?.cancelled) return null
  const MW = mosaic.width, MH = mosaic.height
  const md = mctx.getImageData(0, 0, MW, MH).data

  // Umrechnen: Länge/Breite auf einem groben Raster exakt bestimmen, dazwischen interpolieren
  const out = new ImageData(outW, outH)
  const od = out.data
  const STEP = 4
  const gw = Math.ceil(outW / STEP) + 1, gh = Math.ceil(outH / STEP) + 1
  const gLon = new Float32Array(gw * gh), gLat = new Float32Array(gw * gh), gOk = new Uint8Array(gw * gh)
  const sx = vb.w / outW, sy = vb.h / outH
  const unroll = (lon: number) => (lon < rg.west - 1 ? lon + 360 : lon > rg.east + 1 ? lon - 360 : lon)
  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < gw; i++) {
      const ll = invertSafe(proj, vb.x + i * STEP * sx, vb.y + j * STEP * sy)
      const g = j * gw + i
      if (ll) { gLon[g] = unroll(ll[0]); gLat[g] = ll[1]; gOk[g] = 1 }
    }
    if (j % 40 === 0) { await pause(); if (signal?.cancelled) return null }
  }
  const kx = TILE * n / 360
  for (let y = 0; y < outH; y++) {
    const gj = Math.floor(y / STEP), fy = (y % STEP) / STEP
    for (let x = 0; x < outW; x++) {
      const gi = Math.floor(x / STEP), fx = (x % STEP) / STEP
      const a = gj * gw + gi, b = a + 1, c = a + gw, d = c + 1
      let lon: number, lat: number
      if (gOk[a] && gOk[b] && gOk[c] && gOk[d] && Math.abs(gLon[a] - gLon[d]) < 30 && Math.abs(gLon[b] - gLon[c]) < 30) {
        lon = (gLon[a] * (1 - fx) + gLon[b] * fx) * (1 - fy) + (gLon[c] * (1 - fx) + gLon[d] * fx) * fy
        lat = (gLat[a] * (1 - fx) + gLat[b] * fx) * (1 - fy) + (gLat[c] * (1 - fx) + gLat[d] * fx) * fy
      } else {
        const ll = invertSafe(proj, vb.x + (x + 0.5) * sx, vb.y + (y + 0.5) * sy)
        if (!ll) continue
        lon = unroll(ll[0]); lat = ll[1]
      }
      // Position in den zusammengesetzten Kacheln, weich zwischen den 4 nächsten Punkten gemischt
      const mx = (lon + 180) * kx - tx0 * TILE - 0.5
      const my = (mercY(lat, n) - ty0) * TILE - 0.5
      if (mx < -1 || my < -1 || mx > MW || my > MH) continue
      const fxs = Math.min(MW - 1, Math.max(0, mx)), fys = Math.min(MH - 1, Math.max(0, my))
      const x0 = Math.floor(fxs), y0 = Math.floor(fys)
      const x1 = Math.min(MW - 1, x0 + 1), y1 = Math.min(MH - 1, y0 + 1)
      const tx = fxs - x0, ty = fys - y0
      const i00 = (y0 * MW + x0) * 4, i10 = (y0 * MW + x1) * 4, i01 = (y1 * MW + x0) * 4, i11 = (y1 * MW + x1) * 4
      const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty
      const oi = (y * outW + x) * 4
      od[oi] = md[i00] * w00 + md[i10] * w10 + md[i01] * w01 + md[i11] * w11
      od[oi + 1] = md[i00 + 1] * w00 + md[i10 + 1] * w10 + md[i01 + 1] * w01 + md[i11 + 1] * w11
      od[oi + 2] = md[i00 + 2] * w00 + md[i10 + 2] * w10 + md[i01 + 2] * w01 + md[i11 + 2] * w11
      od[oi + 3] = md[i00 + 3] * w00 + md[i10 + 3] * w10 + md[i01 + 3] * w01 + md[i11 + 3] * w11
    }
    if (y % 60 === 0) { await pause(); if (signal?.cancelled) return null }
  }

  const can = document.createElement('canvas')
  can.width = outW; can.height = outH
  can.getContext('2d')!.putImageData(out, 0, 0)
  // JPEG wird viel schneller erzeugt als WebP (≈ 50 statt 350 ms). Nur wenn Kacheln fehlen, braucht es Durchsichtigkeit (WebP).
  const blob = await new Promise<Blob | null>(r => can.toBlob(r, missing ? 'image/webp' : 'image/jpeg', cfg.quality))
  if (!blob || signal?.cancelled) return null
  return { href: URL.createObjectURL(blob), x: vb.x, y: vb.y, w: vb.w, h: vb.h }
}