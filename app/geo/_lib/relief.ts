// Reliefkarte für physische Karten (Flüsse, Gebirge, Meere, Seen, Städte …).
//
// Das Relief liegt als Plattkarte (Länge/Breite) in public/geo/relief/ – eine kleine Weltkarte (z0),
// 8 × 4 Kacheln in halber (z1) und 16 × 8 Kacheln in voller Auflösung (z2, Natural Earth 1:10m). Für die jeweilige Kartenansicht wird es im Browser in die
// Projektion der Karte umgerechnet (jeder Bildpunkt → Länge/Breite → Farbe aus der Plattkarte)
// und als Bild unter die Flüsse, Gebirge usw. gelegt. Beschnitten wird es mit den Landflächen.

import type { GeoProjection } from 'd3-geo'

const Z0 = { url: '/geo/relief/z0.webp', w: 2048, h: 1024 }
const Z1 = { cols: 8, rows: 4, w: 10800, h: 5400, url: (r: number, c: number) => `/geo/relief/z1-${r}-${c}.webp` }
const Z2 = { cols: 16, rows: 8, w: 21600, h: 10800, url: (r: number, c: number) => `/geo/relief/z2-${r}-${c}.webp` }

const images = new Map<string, Promise<HTMLImageElement>>()
function loadImage(url: string): Promise<HTMLImageElement> {
  let p = images.get(url)
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image()
      img.decoding = 'async'
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error(`Relief "${url}" konnte nicht geladen werden`))
      img.src = url
    })
    p.catch(() => images.delete(url))
    images.set(url, p)
  }
  return p
}

export interface ViewBox { x: number; y: number; w: number; h: number }
export interface ReliefImage { href: string; x: number; y: number; w: number; h: number }

const pause = () => new Promise<void>(r => setTimeout(r, 0))

/** Gültiger Kartenpunkt? (außerhalb der Erdkugel liefert invert Unsinn) */
export function invertSafe(proj: GeoProjection, x: number, y: number): [number, number] | null {
  const ll = proj.invert?.([x, y])
  if (!ll || !Number.isFinite(ll[0]) || !Number.isFinite(ll[1])) return null
  const back = proj(ll)
  if (!back || Math.abs(back[0] - x) > 0.5 || Math.abs(back[1] - y) > 0.5) return null
  return ll
}

/** Längen-/Breitenbereich, den ein Kartenausschnitt zeigt (Länge "ausgerollt", z.B. 110 … 190) */
export function rangeOf(proj: GeoProjection, vb: ViewBox, pad = 2) {
  const lons: number[] = []
  let s = 90, n = -90
  const N = 24
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const ll = invertSafe(proj, vb.x + (vb.w * i) / N, vb.y + (vb.h * j) / N)
    if (!ll) continue
    lons.push(ll[0]); s = Math.min(s, ll[1]); n = Math.max(n, ll[1])
  }
  if (!lons.length) return null
  // Größte Lücke zwischen den Längengraden suchen → der Rest ist der gezeigte Bereich
  lons.sort((a, b) => a - b)
  let gap = lons[0] + 360 - lons[lons.length - 1], west = lons[0], east = lons[lons.length - 1]
  for (let i = 1; i < lons.length; i++) {
    const g = lons[i] - lons[i - 1]
    if (g > gap) { gap = g; west = lons[i]; east = lons[i - 1] + 360 }
  }
  if (east - west > 300 || gap < 20) return { west: -180, east: 180, s: Math.max(-90, s - pad), n: Math.min(90, n + pad) }
  return { west: west - pad, east: east + pad, s: Math.max(-90, s - pad), n: Math.min(90, n + pad) }
}

/**
 * Rechnet das Relief für einen Kartenausschnitt in die Projektion der Karte um.
 * outW: Breite des Ergebnisbildes in Pixeln. Gibt null zurück, wenn kein Land zu sehen ist.
 */
export async function renderRelief(proj: GeoProjection, vb: ViewBox, outW: number, signal?: { cancelled: boolean }): Promise<ReliefImage | null> {
  const rg = rangeOf(proj, vb)
  if (!rg) return null
  const lonSpan = rg.east - rg.west, latSpan = rg.n - rg.s
  const outH = Math.max(1, Math.round((outW * vb.h) / vb.w))

  // Quelle wählen: kleine Weltkarte oder Kacheln in voller Auflösung
  const needPxPerDeg = outW / lonSpan
  const tiles = needPxPerDeg > (Z1.w / 360) * 1.2 ? Z2 : needPxPerDeg > (Z0.w / 360) * 1.3 ? Z1 : null
  const srcPxPerDeg = tiles ? tiles.w / 360 : Z0.w / 360
  // Zwischenbild nicht zu groß werden lassen (Speicher auf Handys)
  const k = Math.min(1, 4096 / (lonSpan * srcPxPerDeg), 3072 / (latSpan * srcPxPerDeg))
  const cw = Math.max(1, Math.round(lonSpan * srcPxPerDeg * k)), ch = Math.max(1, Math.round(latSpan * srcPxPerDeg * k))
  const src = document.createElement('canvas')
  src.width = cw; src.height = ch
  const sctx = src.getContext('2d', { willReadFrequently: true })!
  const toX = (lon: number) => ((lon - rg.west) / lonSpan) * cw
  const toY = (lat: number) => ((rg.n - lat) / latSpan) * ch

  if (!tiles) {
    const img = await loadImage(Z0.url)
    for (const shift of [-360, 0, 360]) {
      const x0 = toX(-180 + shift), x1 = toX(180 + shift)
      if (x1 < 0 || x0 > cw) continue
      sctx.drawImage(img, x0, toY(90), x1 - x0, toY(-90) - toY(90))
    }
  } else {
    const tw = 360 / tiles.cols, th = 180 / tiles.rows
    const jobs: Promise<void>[] = []
    for (let r = 0; r < tiles.rows; r++) {
      const latTop = 90 - r * th, latBot = latTop - th
      if (latBot > rg.n || latTop < rg.s) continue
      for (let c = 0; c < tiles.cols; c++) {
        for (const shift of [-360, 0, 360]) {
          const lonL = -180 + c * tw + shift, lonR = lonL + tw
          if (lonR < rg.west || lonL > rg.east) continue
          jobs.push(loadImage(tiles.url(r, c)).then(img => {
            sctx.drawImage(img, toX(lonL), toY(latTop), toX(lonR) - toX(lonL), toY(latBot) - toY(latTop))
          }))
        }
      }
    }
    await Promise.all(jobs)
  }
  if (signal?.cancelled) return null
  const sdata = sctx.getImageData(0, 0, cw, ch).data

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
      // Weich zwischen den 4 nächsten Quellpunkten mischen (bilinear) – sonst wirkt es beim Hineinzoomen klotzig
      const fxs = Math.min(cw - 1, Math.max(0, toX(lon) - 0.5)), fys = Math.min(ch - 1, Math.max(0, toY(lat) - 0.5))
      const x0 = Math.floor(fxs), y0 = Math.floor(fys)
      const x1 = Math.min(cw - 1, x0 + 1), y1 = Math.min(ch - 1, y0 + 1)
      const tx = fxs - x0, ty = fys - y0
      const i00 = (y0 * cw + x0) * 4, i10 = (y0 * cw + x1) * 4, i01 = (y1 * cw + x0) * 4, i11 = (y1 * cw + x1) * 4
      const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty
      const oi = (y * outW + x) * 4
      od[oi] = sdata[i00] * w00 + sdata[i10] * w10 + sdata[i01] * w01 + sdata[i11] * w11
      od[oi + 1] = sdata[i00 + 1] * w00 + sdata[i10 + 1] * w10 + sdata[i01 + 1] * w01 + sdata[i11 + 1] * w11
      od[oi + 2] = sdata[i00 + 2] * w00 + sdata[i10 + 2] * w10 + sdata[i01 + 2] * w01 + sdata[i11 + 2] * w11
      od[oi + 3] = 255
    }
    if (y % 60 === 0) { await pause(); if (signal?.cancelled) return null }
  }

  const can = document.createElement('canvas')
  can.width = outW; can.height = outH
  can.getContext('2d')!.putImageData(out, 0, 0)
  const blob = await new Promise<Blob | null>(r => can.toBlob(r, 'image/webp', 0.86))
  if (!blob || signal?.cancelled) return null
  return { href: URL.createObjectURL(blob), x: vb.x, y: vb.y, w: vb.w, h: vb.h }
}