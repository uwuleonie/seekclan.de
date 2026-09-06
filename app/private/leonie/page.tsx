'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

// ─── shared styles ────────────────────────────────────────────────────────────
const BG = 'linear-gradient(135deg, #ffd6ec 0%, #ffb3d9 35%, #ff8cc8 65%, #ffaad4 100%)'
const glass = {
  background: 'rgba(255,255,255,0.38)',
  backdropFilter: 'blur(28px)',
  WebkitBackdropFilter: 'blur(28px)',
  border: '1px solid rgba(255,255,255,0.65)',
  borderRadius: '24px',
  boxShadow: '0 8px 40px rgba(255,80,160,0.12), inset 0 1px 0 rgba(255,255,255,0.85)',
} as React.CSSProperties

const btnStyle = (active = true, small = false) => ({
  display: 'inline-flex', alignItems: 'center', gap: '6px',
  padding: small ? '7px 14px' : '10px 22px',
  borderRadius: '12px', border: 'none',
  cursor: active ? 'pointer' : 'not-allowed',
  fontFamily: 'sans-serif',
  fontSize: small ? '12px' : '13px',
  fontWeight: 600, letterSpacing: '0.04em',
  background: active ? 'linear-gradient(135deg, #e91e8c, #ad1457)' : 'rgba(200,100,150,0.2)',
  color: active ? 'white' : 'rgba(180,60,120,0.4)',
  opacity: active ? 1 : 0.7,
  transition: 'opacity 0.15s',
} as React.CSSProperties)

const labelStyle: React.CSSProperties = {
  fontFamily: 'sans-serif', fontSize: '10px',
  letterSpacing: '0.18em', color: 'rgba(180,60,120,0.45)',
  textTransform: 'uppercase', marginBottom: '8px',
}
const titleStyle: React.CSSProperties = {
  fontFamily: '"Playfair Display", Georgia, serif',
  fontStyle: 'italic', fontSize: '26px',
  color: 'rgba(150,40,100,0.85)', marginBottom: '6px',
}
const hintStyle: React.CSSProperties = {
  fontFamily: 'sans-serif', fontSize: '12px',
  color: 'rgba(180,60,120,0.5)', marginBottom: '20px',
}

// ─── Save helper ──────────────────────────────────────────────────────────────
async function saveImage(dataUrl: string, tool: string): Promise<string | null> {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  const file = new File([blob], `${tool}_${Date.now()}.png`, { type: 'image/png' })
  const fd = new FormData()
  fd.append('file', file)
  fd.append('tool', tool)
  const r = await fetch('/api/private/leonie/save', { method: 'POST', body: fd })
  if (!r.ok) return null
  const json = await r.json()
  return json.url
}

// ─── BgRemover ────────────────────────────────────────────────────────────────
function BgRemover({ onSaved }: { onSaved: () => void }) {
  const [src, setSrc] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedUrl, setSavedUrl] = useState<string | null>(null)
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const onFile = (f: File) => {
    setOriginalFile(f); setResult(null); setError(''); setSavedUrl(null)
    setSrc(URL.createObjectURL(f))
  }
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f?.type.startsWith('image/')) onFile(f)
  }

  const removeBg = async () => {
    if (!src || !originalFile) return
    setLoading(true); setError(''); setSavedUrl(null)
    try {
      const base64 = await fileToBase64(originalFile)
      const mediaType = originalFile.type || 'image/jpeg'
      const res = await fetch('/api/private/leonie/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mediaType }),
      })
      const parsed = await res.json()
      setResult(await canvasRemoveBg(src, parsed))
    } catch { setError('Fehler beim Entfernen.') }
    setLoading(false)
  }

  const handleSave = async () => {
    if (!result) return
    setSaving(true)
    const url = await saveImage(result, 'bg-remove')
    if (url) { setSavedUrl(url); onSaved() }
    else setError('Speichern fehlgeschlagen.')
    setSaving(false)
  }

  return (
    <div style={{ ...glass, padding: '32px' }}>
      <p style={titleStyle}>Hintergrund entfernen</p>
      <p style={hintStyle}>Bild hochladen → KI analysiert → Hintergrund transparent</p>

      <div onDrop={onDrop} onDragOver={e => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        style={{ border: '2px dashed rgba(233,30,140,0.3)', borderRadius: '16px', padding: '32px',
          textAlign: 'center', cursor: 'pointer', marginBottom: '20px', background: 'rgba(255,255,255,0.2)' }}>
        {src
          ? <img src={src} alt="" style={{ maxHeight: '200px', maxWidth: '100%', borderRadius: '12px', objectFit: 'contain' }} />
          : <><p style={{ fontSize: '32px', marginBottom: '8px' }}>🖼️</p>
              <p style={{ fontFamily: 'sans-serif', fontSize: '13px', color: 'rgba(180,60,120,0.55)' }}>Bild hier ablegen oder klicken</p></>}
      </div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button style={btnStyle(!!src && !loading)} disabled={!src || loading} onClick={removeBg}>
          {loading ? '⏳ Verarbeite...' : '✨ Hintergrund entfernen'}
        </button>
        {result && !savedUrl && (
          <button style={btnStyle(!saving, true)} disabled={saving} onClick={handleSave}>
            {saving ? '⏳ Speichern...' : '💾 In Galerie speichern'}
          </button>
        )}
        {result && (
          <button style={btnStyle(true, true)} onClick={() => downloadUrl(result, 'ohne-hintergrund.png')}>
            ⬇ PNG
          </button>
        )}
        {savedUrl && <span style={{ fontFamily: 'sans-serif', fontSize: '12px', color: 'rgba(150,40,100,0.6)' }}>✓ Gespeichert</span>}
      </div>

      {error && <p style={{ fontFamily: 'sans-serif', fontSize: '12px', color: '#e91e8c', marginTop: '10px' }}>{error}</p>}

      {result && (
        <div style={{ marginTop: '20px' }}>
          <p style={{ ...labelStyle, marginBottom: '10px' }}>Ergebnis</p>
          <div style={{ borderRadius: '16px', overflow: 'hidden',
            background: 'repeating-conic-gradient(#ccc 0% 25%, white 0% 50%) 0 0 / 16px 16px', display: 'inline-block' }}>
            <img src={result} alt="Ergebnis" style={{ maxHeight: '240px', maxWidth: '100%', display: 'block' }} />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Upscaler ────────────────────────────────────────────────────────────────
const SCALE_OPTIONS = [{ label: '2×', value: 2 }, { label: '3×', value: 3 }, { label: '4× (4K)', value: 4 }]

function Upscaler({ onSaved }: { onSaved: () => void }) {
  const [src, setSrc] = useState<string | null>(null)
  const [origSize, setOrigSize] = useState<{ w: number; h: number } | null>(null)
  const [scale, setScale] = useState(2)
  const [sharpen, setSharpen] = useState(1.5)
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedUrl, setSavedUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const onFile = (f: File) => {
    setResult(null); setSavedUrl(null)
    const url = URL.createObjectURL(f)
    const img = new Image()
    img.onload = () => { setOrigSize({ w: img.width, h: img.height }); setSrc(url) }
    img.src = url
  }
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f?.type.startsWith('image/')) onFile(f)
  }

  const upscale = async () => {
    if (!src || !origSize) return
    setLoading(true); setResult(null); setSavedUrl(null)
    await new Promise(r => setTimeout(r, 30))
    const img = new Image(); img.src = src
    await new Promise(r => { img.onload = r })
    const outW = origSize.w * scale, outH = origSize.h * scale
    const canvas = document.createElement('canvas')
    canvas.width = outW; canvas.height = outH
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, outW, outH)
    if (sharpen > 0) { const id = ctx.getImageData(0, 0, outW, outH); applyUnsharpMask(id, sharpen); ctx.putImageData(id, 0, 0) }
    setResult(canvas.toDataURL('image/png'))
    setLoading(false)
  }

  const handleSave = async () => {
    if (!result) return
    setSaving(true)
    const url = await saveImage(result, 'upscale')
    if (url) { setSavedUrl(url); onSaved() }
    else setError('Speichern fehlgeschlagen.')
    setSaving(false)
  }

  const outSize = origSize ? `${origSize.w * scale} × ${origSize.h * scale}px` : null

  return (
    <div style={{ ...glass, padding: '32px' }}>
      <p style={titleStyle}>Bild schärfer & größer</p>
      <p style={hintStyle}>Vergrößern + Schärfen direkt im Browser — kein Upload nötig</p>

      <div onDrop={onDrop} onDragOver={e => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        style={{ border: '2px dashed rgba(233,30,140,0.3)', borderRadius: '16px', padding: '32px',
          textAlign: 'center', cursor: 'pointer', marginBottom: '20px', background: 'rgba(255,255,255,0.2)' }}>
        {src
          ? <img src={src} alt="" style={{ maxHeight: '180px', maxWidth: '100%', borderRadius: '12px', objectFit: 'contain' }} />
          : <><p style={{ fontSize: '32px', marginBottom: '8px' }}>📷</p>
              <p style={{ fontFamily: 'sans-serif', fontSize: '13px', color: 'rgba(180,60,120,0.55)' }}>Bild hier ablegen oder klicken</p></>}
      </div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />

      {origSize && <p style={{ ...hintStyle, marginBottom: '16px' }}>Original: {origSize.w} × {origSize.h}px → Ausgabe: {outSize}</p>}

      <div style={{ marginBottom: '16px' }}>
        <p style={labelStyle}>Skalierung</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          {SCALE_OPTIONS.map(o => (
            <button key={o.value} onClick={() => setScale(o.value)} style={{
              padding: '8px 18px', borderRadius: '12px', border: scale === o.value ? 'none' : '1px solid rgba(233,30,140,0.2)',
              cursor: 'pointer', fontFamily: 'sans-serif', fontSize: '13px', fontWeight: 600,
              background: scale === o.value ? 'linear-gradient(135deg, #e91e8c, #ad1457)' : 'rgba(255,255,255,0.5)',
              color: scale === o.value ? 'white' : 'rgba(150,40,100,0.7)',
            }}>{o.label}</button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <p style={{ ...labelStyle, marginBottom: 0 }}>Schärfe</p>
          <span style={{ fontFamily: 'sans-serif', fontSize: '12px', color: 'rgba(180,60,120,0.6)' }}>
            {sharpen === 0 ? 'Aus' : sharpen.toFixed(1)}
          </span>
        </div>
        <input type="range" min={0} max={3} step={0.1} value={sharpen}
          onChange={e => setSharpen(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#e91e8c' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'sans-serif', fontSize: '10px', color: 'rgba(180,60,120,0.4)' }}>Weich</span>
          <span style={{ fontFamily: 'sans-serif', fontSize: '10px', color: 'rgba(180,60,120,0.4)' }}>Sehr scharf</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button style={btnStyle(!!src && !loading)} disabled={!src || loading} onClick={upscale}>
          {loading ? '⏳ Verarbeite...' : '🔍 Vergrößern & schärfen'}
        </button>
        {result && !savedUrl && (
          <button style={btnStyle(!saving, true)} disabled={saving} onClick={handleSave}>
            {saving ? '⏳ Speichern...' : '💾 In Galerie speichern'}
          </button>
        )}
        {result && (
          <button style={btnStyle(true, true)} onClick={() => downloadUrl(result, `upscaled_${scale}x.png`)}>
            ⬇ PNG
          </button>
        )}
        {savedUrl && <span style={{ fontFamily: 'sans-serif', fontSize: '12px', color: 'rgba(150,40,100,0.6)' }}>✓ Gespeichert</span>}
      </div>

      {error && <p style={{ fontFamily: 'sans-serif', fontSize: '12px', color: '#e91e8c', marginTop: '10px' }}>{error}</p>}

      {result && (
        <div style={{ marginTop: '20px' }}>
          <p style={{ ...labelStyle, marginBottom: '10px' }}>Ergebnis ({outSize})</p>
          <img src={result} alt="Upscaled" style={{ maxHeight: '240px', maxWidth: '100%', borderRadius: '12px',
            border: '1px solid rgba(233,30,140,0.15)', objectFit: 'contain' }} />
        </div>
      )}
    </div>
  )
}

// ─── Gallery ─────────────────────────────────────────────────────────────────
const TOOL_LABEL: Record<string, string> = { 'bg-remove': '✨ Hintergrund entfernt', upscale: '🔍 Upscaled' }

function Gallery({ refresh }: { refresh: number }) {
  const [images, setImages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/private/leonie/images')
    if (res.ok) { const json = await res.json(); setImages(json.images) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load, refresh])

  if (loading) return (
    <div style={{ ...glass, padding: '32px', textAlign: 'center' }}>
      <p style={{ fontFamily: 'sans-serif', fontSize: '13px', color: 'rgba(180,60,120,0.45)' }}>Laden...</p>
    </div>
  )

  return (
    <div style={{ ...glass, padding: '32px' }}>
      <p style={titleStyle}>Gespeicherte Bilder</p>
      <p style={hintStyle}>{images.length} Bild{images.length !== 1 ? 'er' : ''} gespeichert</p>

      {images.length === 0 ? (
        <p style={{ fontFamily: 'sans-serif', fontSize: '13px', color: 'rgba(180,60,120,0.4)', textAlign: 'center', padding: '24px' }}>
          Noch keine Bilder gespeichert.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px' }}>
          {images.map(img => (
            <div key={img.id} style={{
              background: 'rgba(255,255,255,0.45)',
              border: '1px solid rgba(255,255,255,0.7)',
              borderRadius: '16px', overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ background: 'repeating-conic-gradient(#ddd 0% 25%, white 0% 50%) 0 0 / 12px 12px', flex: 1, minHeight: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={img.url} alt="" style={{ maxWidth: '100%', maxHeight: '140px', objectFit: 'contain', display: 'block' }} />
              </div>
              <div style={{ padding: '10px 12px' }}>
                <p style={{ fontFamily: 'sans-serif', fontSize: '10px', color: 'rgba(180,60,120,0.6)', marginBottom: '2px' }}>
                  {TOOL_LABEL[img.tool] ?? img.tool}
                </p>
                <p style={{ fontFamily: 'sans-serif', fontSize: '10px', color: 'rgba(180,60,120,0.4)', marginBottom: '8px' }}>
                  {new Date(img.created_at).toLocaleDateString('de-DE')}
                </p>
                <a href={img.url} download style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  fontFamily: 'sans-serif', fontSize: '11px', fontWeight: 600,
                  color: '#ad1457', textDecoration: 'none',
                }}>⬇ Download</a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res((r.result as string).split(',')[1])
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

function downloadUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a'); a.href = dataUrl; a.download = filename; a.click()
}

async function canvasRemoveBg(srcUrl: string, info: any): Promise<string> {
  const img = new Image(); img.crossOrigin = 'anonymous'; img.src = srcUrl
  await new Promise(r => { img.onload = r })
  const canvas = document.createElement('canvas')
  canvas.width = img.width; canvas.height = img.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  const bgHex = info.bg_color || '#ffffff'
  const bgR = parseInt(bgHex.slice(1, 3), 16)
  const bgG = parseInt(bgHex.slice(3, 5), 16)
  const bgB = parseInt(bgHex.slice(5, 7), 16)
  const tolerance = 45, feather = 20
  for (let i = 0; i < data.length; i += 4) {
    const dist = Math.sqrt((data[i] - bgR) ** 2 + (data[i + 1] - bgG) ** 2 + (data[i + 2] - bgB) ** 2)
    if (dist < tolerance) data[i + 3] = 0
    else if (dist < tolerance + feather) data[i + 3] = Math.round(((dist - tolerance) / feather) * 255)
  }
  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
}

function applyUnsharpMask(imageData: ImageData, strength: number) {
  const { data, width, height } = imageData
  const copy = new Uint8ClampedArray(data)
  const kernel = [0, -1, 0, -1, 4 + (1 / strength), -1, 0, -1, 0]
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let r = 0, g = 0, b = 0
      for (let ky = 0; ky < 3; ky++) {
        for (let kx = 0; kx < 3; kx++) {
          const px = ((y + ky - 1) * width + (x + kx - 1)) * 4
          const kv = kernel[ky * 3 + kx]
          r += copy[px] * kv; g += copy[px + 1] * kv; b += copy[px + 2] * kv
        }
      }
      const idx = (y * width + x) * 4
      const blend = Math.min(strength, 1)
      data[idx]     = Math.min(255, Math.max(0, copy[idx]     + r * blend))
      data[idx + 1] = Math.min(255, Math.max(0, copy[idx + 1] + g * blend))
      data[idx + 2] = Math.min(255, Math.max(0, copy[idx + 2] + b * blend))
    }
  }
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function LeoniePage() {
  const [galleryRefresh, setGalleryRefresh] = useState(0)
  const refresh = () => setGalleryRefresh(n => n + 1)

  return (
    <div style={{ minHeight: '100vh', background: BG, padding: '48px 32px' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <div>
          <p style={labelStyle}>privat · leonie</p>
          <p style={{ ...titleStyle, fontSize: '32px' }}>Bildtools ✦</p>
        </div>
        <BgRemover onSaved={refresh} />
        <Upscaler onSaved={refresh} />
        <Gallery refresh={galleryRefresh} />
      </div>
    </div>
  )
}