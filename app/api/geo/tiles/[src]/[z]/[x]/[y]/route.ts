import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import sharp from 'sharp'

// GET /api/geo/tiles/<quelle>/<z>/<x>/<y>
// Kartenkacheln für die Ansichten "Relief" und "Satellit" der Geo-Quizzes.
//
// Der Server holt jede Kachel EINMAL bei der Quelle, speichert sie auf der Festplatte und liefert sie danach
// nur noch selbst aus. So gehen beim Seitenaufruf keine Daten der Besucher an fremde Server.
//
//   terrain – Höhendaten "Terrain Tiles" (AWS Open Data, Terrarium-Format). Daraus berechnet der Server
//             ein Relief (Höhenfarben + Schattierung) und speichert es als WebP.
//             Quellen/Lizenz: https://github.com/tilezen/joerd/blob/master/docs/attribution.md
//   sat     – Satellitenbild "Sentinel-2 cloudless 2016" von EOX (CC BY 4.0 – mit Quellenangabe frei nutzbar)
//             https://s2maps.eu – Sentinel-2 cloudless by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016)
//   night   – Erde bei Nacht "VIIRS Black Marble 2016" der NASA (gemeinfrei), über NASA GIBS
//             https://earthdata.nasa.gov/gibs
//
// Speicherort: Umgebungsvariable GEO_TILE_CACHE, sonst der Ordner ".geo-tiles" im Projekt.
// Nur für Entwicklung: GEO_TILE_MIRROR = Ordner mit bereits heruntergeladenen Original-Kacheln
// (<mirror>/<quelle>/<z>/<x>/<y>.png|jpg) – dann wird nichts aus dem Internet geladen.

export const runtime = 'nodejs'

type Source = {
  maxZ: number
  ext: 'png' | 'jpg'
  out: 'webp' | 'jpg'
  url: (z: number, x: number, y: number) => string
  /** Version: ändert sich die Berechnung, landet alles in einem neuen Ordner */
  version: number
}

const SOURCES: Record<string, Source> = {
  terrain: {
    maxZ: 12, ext: 'png', out: 'webp', version: 1,
    url: (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`,
  },
  sat: {
    maxZ: 13, ext: 'jpg', out: 'jpg', version: 1,
    url: (z, x, y) => `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/${z}/${y}/${x}.jpg`,
  },
  night: {
    maxZ: 8, ext: 'png', out: 'jpg', version: 1,
    url: (z, x, y) => `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/${z}/${y}/${x}.png`,
  },
}

const CACHE = process.env.GEO_TILE_CACHE || path.join(process.cwd(), '.geo-tiles')
const MIRROR = process.env.GEO_TILE_MIRROR || ''
const TYPES = { webp: 'image/webp', jpg: 'image/jpeg' }

/** Gleichzeitige Anfragen für dieselbe Kachel nur einmal bearbeiten */
const running = new Map<string, Promise<Buffer | null>>()

/* ── Relief aus Höhendaten ── */

// Höhenfarben (Meter → Farbe), passend zum bisherigen warmen Relief der Seite
const TINT: [number, number, number, number][] = [
  [-50, 168, 196, 150],
  [50, 172, 199, 148],
  [200, 186, 204, 150],
  [400, 205, 208, 156],
  [700, 222, 207, 160],
  [1000, 216, 188, 140],
  [1500, 198, 164, 122],
  [2100, 182, 152, 126],
  [2800, 196, 186, 176],
  [3600, 232, 228, 224],
  [5000, 248, 247, 245],
]
function tint(e: number): [number, number, number] {
  if (e <= TINT[0][0]) return [TINT[0][1], TINT[0][2], TINT[0][3]]
  for (let i = 1; i < TINT.length; i++) {
    const b = TINT[i]
    if (e <= b[0]) {
      const a = TINT[i - 1]
      const t = (e - a[0]) / (b[0] - a[0])
      return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t]
    }
  }
  const l = TINT[TINT.length - 1]
  return [l[1], l[2], l[3]]
}

async function renderTerrain(png: Buffer, z: number, y: number): Promise<Buffer> {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const W = info.width, H = info.height, C = info.channels
  const elev = new Float32Array(W * H)
  for (let i = 0; i < W * H; i++) elev[i] = data[i * C] * 256 + data[i * C + 1] + data[i * C + 2] / 256 - 32768

  // Bodengröße eines Bildpunkts (Meter) in der Mitte der Kachel
  const n = 2 ** z
  const lat = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / n)))
  const cell = (40075016.686 * Math.cos(lat)) / (W * n)
  // Bei kleinem Maßstab sind die Hänge flacher → stärker überhöhen, damit Gebirge sichtbar bleiben
  const exag = Math.min(14, Math.max(1.4, 2 ** ((11 - z) * 0.42)))
  // Licht von Nordwesten (315°), 45° hoch – umgerechnet in Mathe-Winkel (Esri-Formel)
  const az = ((360 - 315 + 90) * Math.PI) / 180, zen = (45 * Math.PI) / 180
  const cz = Math.cos(zen), sz = Math.sin(zen)

  const out = Buffer.alloc(W * H * 3)
  const at = (x: number, yy: number) => elev[Math.min(H - 1, Math.max(0, yy)) * W + Math.min(W - 1, Math.max(0, x))]
  for (let yy = 0; yy < H; yy++) {
    for (let x = 0; x < W; x++) {
      // Horn-Verfahren (3×3 Nachbarn); am Kachelrand werden die Randwerte wiederholt
      const a = at(x - 1, yy - 1), b = at(x, yy - 1), c = at(x + 1, yy - 1)
      const d = at(x - 1, yy), f = at(x + 1, yy)
      const g = at(x - 1, yy + 1), h = at(x, yy + 1), k = at(x + 1, yy + 1)
      const dzdx = ((c + 2 * f + k) - (a + 2 * d + g)) / (8 * cell) * exag
      const dzdy = ((g + 2 * h + k) - (a + 2 * b + c)) / (8 * cell) * exag
      const slope = Math.atan(Math.hypot(dzdx, dzdy))
      const aspect = Math.atan2(dzdy, -dzdx)
      let hs = cz * Math.cos(slope) + sz * Math.sin(slope) * Math.cos(az - aspect)
      hs = Math.max(0, hs)
      // Flaches Land (hs ≈ cos 45°) soll seine Farbe behalten → Faktor ≈ 1
      const shade = 0.42 + 0.82 * hs
      const [r, gg, bb] = tint(elev[yy * W + x])
      const i = (yy * W + x) * 3
      out[i] = Math.min(255, r * shade)
      out[i + 1] = Math.min(255, gg * shade)
      out[i + 2] = Math.min(255, bb * shade)
    }
  }
  return sharp(out, { raw: { width: W, height: H, channels: 3 } }).webp({ quality: 80 }).toBuffer()
}

/* ── Kachel holen ── */

async function original(src: string, s: Source, z: number, x: number, y: number): Promise<Buffer | null> {
  if (MIRROR) {
    try { return await fs.readFile(path.join(MIRROR, src, String(z), String(x), `${y}.${s.ext}`)) } catch { return null }
  }
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 15000)
  try {
    const r = await fetch(s.url(z, x, y), { signal: ctrl.signal, headers: { 'User-Agent': 'seekclan.de geo quiz tile cache' } })
    if (r.status === 404) return null
    if (!r.ok) throw new Error(`Quelle antwortet mit ${r.status}`)
    return Buffer.from(await r.arrayBuffer())
  } finally {
    clearTimeout(t)
  }
}

async function tile(src: string, s: Source, z: number, x: number, y: number): Promise<Buffer | null> {
  const file = path.join(CACHE, `${src}-v${s.version}`, String(z), String(x), `${y}.${s.out}`)
  try { return await fs.readFile(file) } catch { /* noch nicht gespeichert */ }

  const raw = await original(src, s, z, x, y)
  if (!raw) return null
  const buf = src === 'terrain' ? await renderTerrain(raw, z, y)
    : s.ext === 'png' && s.out === 'jpg' ? await sharp(raw).flatten({ background: '#000' }).jpeg({ quality: 82 }).toBuffer()
    : raw

  // Erst in eine Hilfsdatei schreiben, dann umbenennen – so liegt nie eine halbe Kachel im Speicher
  await fs.mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(tmp, buf)
  await fs.rename(tmp, file).catch(() => fs.unlink(tmp).catch(() => {}))
  return buf
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ src: string; z: string; x: string; y: string }> }) {
  const p = await ctx.params
  const s = SOURCES[p.src]
  const z = Number(p.z), x = Number(p.x), y = Number(p.y)
  const bad = (status: number, msg: string) => new NextResponse(msg, { status, headers: { 'Cache-Control': 'no-store' } })
  if (!s) return bad(404, 'Unbekannte Quelle')
  if (![z, x, y].every(Number.isInteger) || z < 0 || z > s.maxZ || x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z) return bad(400, 'Ungültige Kachel')

  const key = `${p.src}/${z}/${x}/${y}`
  let job = running.get(key)
  if (!job) {
    job = tile(p.src, s, z, x, y).finally(() => running.delete(key))
    running.set(key, job)
  }
  try {
    const buf = await job
    if (!buf) return bad(404, 'Keine Kachel')
    return new NextResponse(new Uint8Array(buf), {
      headers: { 'Content-Type': TYPES[s.out], 'Cache-Control': 'public, max-age=31536000, immutable' },
    })
  } catch (err) {
    console.error('geo/tiles', key, err)
    return bad(502, 'Kachel konnte nicht geladen werden')
  }
}