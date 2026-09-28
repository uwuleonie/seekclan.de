'use client'

// Farbwähler: Farbe wählen, vom Bildschirm/aus einem Bild aufnehmen, Werte kopieren,
// passende Farben (Harmonien, Abstufungen) und Lesbarkeit (Kontrast) prüfen.

import { useEffect, useRef, useState } from 'react'
import Icon from '../../_components/Icon'
import { usePrivate } from '../../_components/PrivateShell'

type RGB = [number, number, number]

const clamp = (n: number, a = 0, b = 255) => Math.min(b, Math.max(a, n))
const hex = ([r, g, b]: RGB) => `#${[r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`
function parseHex(s: string): RGB | null {
  let h = s.trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map(c => c + c).join('')
  if (!/^[0-9a-f]{6}$/i.test(h)) return null
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) as RGB
}
function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, Math.round(l * 100)]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  h *= 60
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)]
}
function hslToRgb(h: number, s: number, l: number): RGB {
  s /= 100; l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0) * 255, f(8) * 255, f(4) * 255].map(v => Math.round(v)) as RGB
}
function cmyk([r, g, b]: RGB) {
  const k = 1 - Math.max(r, g, b) / 255
  if (k >= 1) return [0, 0, 0, 100]
  return [(1 - r / 255 - k) / (1 - k), (1 - g / 255 - k) / (1 - k), (1 - b / 255 - k) / (1 - k), k].map(v => Math.round(v * 100))
}
/** Relative Leuchtdichte nach WCAG 2 */
function luminance([r, g, b]: RGB) {
  const c = [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
function contrast(a: RGB, b: RGB) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

const SAVED_KEY = 'pv-tools-colors'

declare global {
  interface Window { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }
}

export default function ColorTool() {
  const { toast } = usePrivate()
  const [rgb, setRgb] = useState<RGB>([194, 37, 127])
  const [hexInput, setHexInput] = useState('#c2257f')
  const [saved, setSaved] = useState<string[]>([])
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const imgCanvas = useRef<HTMLCanvasElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [hasEyeDropper, setHasEyeDropper] = useState(false)

  useEffect(() => {
    setHasEyeDropper(typeof window !== 'undefined' && !!window.EyeDropper)
    try { setSaved(JSON.parse(localStorage.getItem(SAVED_KEY) || '[]')) } catch { /* egal */ }
  }, [])

  const set = (c: RGB) => { setRgb(c); setHexInput(hex(c)) }
  const [h, s, l] = rgbToHsl(rgb)
  const H = hex(rgb)

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); toast(`${text} kopiert`) } catch { toast('Kopieren nicht möglich') }
  }
  function save() {
    const next = [H, ...saved.filter(x => x !== H)].slice(0, 24)
    setSaved(next)
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)) } catch { /* egal */ }
    toast('Farbe gemerkt')
  }
  function removeSaved(c: string) {
    const next = saved.filter(x => x !== c)
    setSaved(next)
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)) } catch { /* egal */ }
  }
  async function eyeDropper() {
    try {
      const r = await new window.EyeDropper!().open()
      const c = parseHex(r.sRGBHex)
      if (c) set(c)
    } catch { /* abgebrochen */ }
  }

  // Bild zum Farbe-Aufnehmen
  useEffect(() => {
    if (!imgUrl) return
    const img = new Image()
    img.onload = () => {
      const c = imgCanvas.current
      if (!c) return
      const scale = Math.min(1, 900 / Math.max(img.width, img.height))
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale)
      c.getContext('2d', { willReadFrequently: true })!.drawImage(img, 0, 0, c.width, c.height)
    }
    img.src = imgUrl
    return () => URL.revokeObjectURL(imgUrl)
  }, [imgUrl])
  function pickFromImage(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = e.currentTarget
    const r = c.getBoundingClientRect()
    const x = Math.floor(((e.clientX - r.left) / r.width) * c.width)
    const y = Math.floor(((e.clientY - r.top) / r.height) * c.height)
    const d = c.getContext('2d', { willReadFrequently: true })!.getImageData(x, y, 1, 1).data
    set([d[0], d[1], d[2]])
  }

  const values: [string, string][] = [
    ['HEX', H.toUpperCase()],
    ['RGB', `rgb(${rgb.join(', ')})`],
    ['HSL', `hsl(${h}, ${s}%, ${l}%)`],
    ['CMYK', `${cmyk(rgb).join('% ')}%`],
  ]
  const harmonies: [string, RGB[]][] = [
    ['Komplementär', [rgb, hslToRgb((h + 180) % 360, s, l)]],
    ['Analog', [hslToRgb((h + 330) % 360, s, l), rgb, hslToRgb((h + 30) % 360, s, l)]],
    ['Triade', [rgb, hslToRgb((h + 120) % 360, s, l), hslToRgb((h + 240) % 360, s, l)]],
    ['Abstufungen', [90, 75, 60, 45, 30, 15].map(L => hslToRgb(h, s, L))],
  ]
  const white: RGB = [255, 255, 255], black: RGB = [0, 0, 0]
  const cw = contrast(rgb, white), cb = contrast(rgb, black)
  const grade = (c: number) => (c >= 7 ? 'AAA' : c >= 4.5 ? 'AA' : c >= 3 ? 'nur groß' : 'zu wenig')

  return (
    <div className="pv-tool-grid">
      <div className="pv-glass pv-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="pv-color-hero" style={{ background: H, color: cw >= cb ? '#fff' : '#111' }}>
          <span>{H.toUpperCase()}</span>
        </div>
        <div className="pv-row pv-wrap" style={{ gap: 8 }}>
          <label className="pv-btn" style={{ position: 'relative', overflow: 'hidden' }}>
            <Icon name="palette" size={17} /> Farbe wählen
            <input type="color" value={H} onChange={e => set(parseHex(e.target.value)!)} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
          </label>
          {hasEyeDropper && <button className="pv-btn" onClick={eyeDropper}><Icon name="eyedropper" size={17} /> Vom Bildschirm</button>}
          <button className="pv-btn" onClick={() => fileInput.current?.click()}><Icon name="image" size={17} /> Aus Bild</button>
          <button className="pv-btn ghost" onClick={save}><Icon name="bookmark" size={17} /> Merken</button>
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) setImgUrl(URL.createObjectURL(f)); e.target.value = '' }} />
        </div>
        <div>
          <label className="pv-label">HEX eingeben</label>
          <input className="pv-input" value={hexInput} onChange={e => { setHexInput(e.target.value); const c = parseHex(e.target.value); if (c) setRgb(c) }} maxLength={7} />
        </div>
        {([['R', 0], ['G', 1], ['B', 2]] as const).map(([k, i]) => (
          <div key={k} className="pv-row" style={{ gap: 10 }}>
            <b style={{ width: 16 }}>{k}</b>
            <input className="pv-range pv-grow" type="range" min={0} max={255} value={rgb[i]} onChange={e => { const n = [...rgb] as RGB; n[i] = clamp(Number(e.target.value)); set(n) }} />
            <span style={{ width: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{rgb[i]}</span>
          </div>
        ))}
        {imgUrl && (
          <div>
            <p className="pv-label">Ins Bild tippen, um die Farbe aufzunehmen</p>
            <canvas ref={imgCanvas} className="pv-color-img" onPointerDown={pickFromImage} onPointerMove={e => { if (e.buttons) pickFromImage(e) }} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="pv-glass pv-card">
          {values.map(([k, v]) => (
            <button key={k} className="pv-copy-row" onClick={() => copy(v)}>
              <span className="pv-muted">{k}</span><b>{v}</b><Icon name="copy" size={15} />
            </button>
          ))}
        </div>

        <div className="pv-glass pv-card">
          <p className="pv-label">Lesbarkeit (Kontrast nach WCAG)</p>
          <div className="pv-row" style={{ gap: 10 }}>
            <div className="pv-contrast" style={{ background: H, color: '#fff' }}>Weiße Schrift<small>{cw.toFixed(1)} : 1 · {grade(cw)}</small></div>
            <div className="pv-contrast" style={{ background: H, color: '#000' }}>Schwarze Schrift<small>{cb.toFixed(1)} : 1 · {grade(cb)}</small></div>
          </div>
        </div>

        <div className="pv-glass pv-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {harmonies.map(([name, cols]) => (
            <div key={name}>
              <p className="pv-label" style={{ marginBottom: 4 }}>{name}</p>
              <div className="pv-swatch-row">
                {cols.map((c, i) => (
                  <button key={i} style={{ background: hex(c) }} title={hex(c)} onClick={() => set(c)}><span>{hex(c).toUpperCase()}</span></button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {saved.length > 0 && (
          <div className="pv-glass pv-card">
            <p className="pv-label">Gemerkte Farben</p>
            <div className="pv-row pv-wrap" style={{ gap: 6 }}>
              {saved.map(c => (
                <span key={c} className="pv-saved-color">
                  <button style={{ background: c }} title={c} onClick={() => set(parseHex(c)!)} />
                  <button className="x" aria-label={`${c} entfernen`} onClick={() => removeSaved(c)}><Icon name="x" size={11} /></button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}