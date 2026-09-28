// Bildbearbeitung komplett im Browser (nichts wird dafür an den Server geschickt).
// Reihenfolge: drehen/spiegeln → zuschneiden → skalieren → Helligkeit/Kontrast/Sättigung → schärfen

export interface Crop { x: number; y: number; w: number; h: number } // Anteile 0–1 des gedrehten Bildes

export interface EditState {
  rotate: 0 | 90 | 180 | 270
  flipH: boolean
  flipV: boolean
  crop: Crop
  /** Zielgröße in Pixeln */
  outW: number
  outH: number
  brightness: number // -100 … 100
  contrast: number // -100 … 100
  saturation: number // -100 … 100
  /** Unscharf maskieren (klassisches Schärfen) */
  sharpAmount: number // 0 … 300 (%)
  sharpRadius: number // 0.3 … 5 (px)
  sharpThreshold: number // 0 … 40
}

export const FULL_CROP: Crop = { x: 0, y: 0, w: 1, h: 1 }

/** Bild laden. Handyfotos werden dabei richtig herum gedreht (EXIF). */
export async function loadBitmap(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' })
  } catch {
    // Fallback für ältere Browser
    const url = URL.createObjectURL(blob)
    try {
      const img = new Image()
      img.decoding = 'async'
      img.src = url
      await img.decode()
      return await createImageBitmap(img)
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

export function rotatedSize(src: { width: number; height: number }, rotate: number) {
  return rotate % 180 === 0 ? { w: src.width, h: src.height } : { w: src.height, h: src.width }
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  return c
}

/** Gedreht/gespiegelt + zugeschnitten, noch in Originalauflösung */
function geometry(src: CanvasImageSource & { width: number; height: number }, s: EditState): HTMLCanvasElement {
  const { w: rw, h: rh } = rotatedSize(src, s.rotate)
  const cx = Math.round(s.crop.x * rw), cy = Math.round(s.crop.y * rh)
  const cw = Math.max(1, Math.round(s.crop.w * rw)), ch = Math.max(1, Math.round(s.crop.h * rh))
  const out = canvas(cw, ch)
  const ctx = out.getContext('2d')!
  ctx.translate(-cx, -cy)
  ctx.translate(rw / 2, rh / 2)
  ctx.rotate((s.rotate * Math.PI) / 180)
  ctx.scale(s.flipH ? -1 : 1, s.flipV ? -1 : 1)
  ctx.drawImage(src, -src.width / 2, -src.height / 2)
  return out
}

/** Hochwertig verkleinern: in Schritten halbieren (verhindert Treppchen/Flimmern) */
function resize(src: HTMLCanvasElement, w: number, h: number): HTMLCanvasElement {
  let cur = src
  while (cur.width / 2 >= w && cur.height / 2 >= h) {
    const half = canvas(cur.width / 2, cur.height / 2)
    const c = half.getContext('2d')!
    c.imageSmoothingQuality = 'high'
    c.drawImage(cur, 0, 0, half.width, half.height)
    cur = half
  }
  const out = canvas(w, h)
  const c = out.getContext('2d')!
  c.imageSmoothingEnabled = true
  c.imageSmoothingQuality = 'high'
  c.drawImage(cur, 0, 0, out.width, out.height)
  return out
}

/** Weichzeichnen mit drei Box-Filtern (≈ Gauß), getrennt nach Kanälen */
function blurChannel(src: Uint8ClampedArray, w: number, h: number, ch: number, radius: number): Float32Array {
  const n = w * h
  const a = new Float32Array(n)
  const b = new Float32Array(n)
  for (let i = 0; i < n; i++) a[i] = src[i * 4 + ch]
  // Radius der drei Boxen so wählen, dass es einem Gauß mit sigma = radius nahekommt
  const sigma = Math.max(0.3, radius)
  const wIdeal = Math.sqrt((12 * sigma * sigma) / 3 + 1)
  let wl = Math.floor(wIdeal); if (wl % 2 === 0) wl--
  const wu = wl + 2
  const m = Math.round((12 * sigma * sigma - 3 * wl * wl - 12 * wl - 9) / (-4 * wl - 4))
  const boxes = [0, 1, 2].map(i => ((i < m ? wl : wu) - 1) / 2)
  for (const r of boxes) {
    if (r < 1) continue
    boxH(a, b, w, h, r); boxV(b, a, w, h, r)
  }
  return a
  function boxH(s: Float32Array, t: Float32Array, w: number, h: number, r: number) {
    const iarr = 1 / (r + r + 1)
    for (let y = 0; y < h; y++) {
      const row = y * w
      let acc = s[row] * (r + 1)
      for (let x = 0; x < r; x++) acc += s[row + Math.min(w - 1, x)]
      for (let x = 0; x < w; x++) {
        acc += s[row + Math.min(w - 1, x + r)] - s[row + Math.max(0, x - r - 1)]
        t[row + x] = acc * iarr
      }
    }
  }
  function boxV(s: Float32Array, t: Float32Array, w: number, h: number, r: number) {
    const iarr = 1 / (r + r + 1)
    for (let x = 0; x < w; x++) {
      let acc = s[x] * (r + 1)
      for (let y = 0; y < r; y++) acc += s[Math.min(h - 1, y) * w + x]
      for (let y = 0; y < h; y++) {
        acc += s[Math.min(h - 1, y + r) * w + x] - s[Math.max(0, y - r - 1) * w + x]
        t[y * w + x] = acc * iarr
      }
    }
  }
}

/** Farben + Schärfen direkt auf den Pixeln */
function pixels(c: HTMLCanvasElement, s: EditState, radiusScale: number) {
  const needColor = s.brightness || s.contrast || s.saturation
  const needSharp = s.sharpAmount > 0
  if (!needColor && !needSharp) return
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  const img = ctx.getImageData(0, 0, c.width, c.height)
  const d = img.data

  if (needColor) {
    const br = (s.brightness / 100) * 255 * 0.5
    const ct = (259 * (s.contrast * 1.275 + 255)) / (255 * (259 - s.contrast * 1.275))
    const sat = 1 + s.saturation / 100
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i], g = d[i + 1], b = d[i + 2]
      r = ct * (r - 128) + 128 + br
      g = ct * (g - 128) + 128 + br
      b = ct * (b - 128) + 128 + br
      if (sat !== 1) {
        const l = 0.2126 * r + 0.7152 * g + 0.0722 * b
        r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat
      }
      d[i] = r; d[i + 1] = g; d[i + 2] = b
    }
  }

  if (needSharp) {
    const radius = s.sharpRadius * radiusScale
    const amt = s.sharpAmount / 100
    const th = s.sharpThreshold
    const w = c.width, h = c.height
    const src = new Uint8ClampedArray(d) // Kopie als Grundlage
    for (let ch = 0; ch < 3; ch++) {
      const blur = blurChannel(src, w, h, ch, radius)
      for (let p = 0, i = ch; p < blur.length; p++, i += 4) {
        const diff = src[i] - blur[p]
        if (Math.abs(diff) >= th) d[i] = src[i] + diff * amt
      }
    }
  }
  ctx.putImageData(img, 0, 0)
}

/**
 * Fertiges Bild erzeugen.
 * maxSide: für die Vorschau kleiner rechnen (Schärfe-Radius wird mitskaliert, damit es gleich aussieht).
 */
export function render(src: ImageBitmap, s: EditState, maxSide?: number): HTMLCanvasElement {
  const geo = geometry(src, s)
  let w = s.outW, h = s.outH
  let scale = 1
  if (maxSide && Math.max(w, h) > maxSide) {
    scale = maxSide / Math.max(w, h)
    w = Math.round(w * scale); h = Math.round(h * scale)
  }
  const out = w === geo.width && h === geo.height ? geo : resize(geo, w, h)
  pixels(out, s, scale)
  return out
}

export function toBlob(c: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('Bild konnte nicht erzeugt werden'))), type, quality))
}