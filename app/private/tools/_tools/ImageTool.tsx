'use client'

// Bildbearbeitung: skalieren, zuschneiden, drehen/spiegeln, Farbe und klassisch schärfen.
// Alles läuft im Browser. Ergebnis landet als neue Datei in Quick Share oder als Download.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../../_components/Icon'
import AttachPicker from '../../_components/AttachPicker'
import { usePrivate } from '../../_components/PrivateShell'
import { fileUrl } from '../../_lib/files'
import { FULL_CROP, loadBitmap, render, rotatedSize, toBlob, type Crop, type EditState } from '../_lib/image'

type Panel = 'size' | 'crop' | 'turn' | 'color' | 'sharp'
type Format = 'image/jpeg' | 'image/png' | 'image/webp'

const PRESETS = {
  off: { sharpAmount: 0, sharpRadius: 1, sharpThreshold: 2 },
  light: { sharpAmount: 60, sharpRadius: 1, sharpThreshold: 2 },
  medium: { sharpAmount: 120, sharpRadius: 1.2, sharpThreshold: 3 },
  strong: { sharpAmount: 200, sharpRadius: 1.6, sharpThreshold: 4 },
}
const ASPECTS: [string, number | null][] = [['Frei', null], ['Original', -1], ['1:1', 1], ['4:3', 4 / 3], ['3:4', 3 / 4], ['16:9', 16 / 9], ['9:16', 9 / 16]]

function initialState(w: number, h: number): EditState {
  return {
    rotate: 0, flipH: false, flipV: false, crop: FULL_CROP, outW: w, outH: h,
    brightness: 0, contrast: 0, saturation: 0, ...PRESETS.off,
  }
}

export default function ImageTool() {
  const { toast, upload } = usePrivate()
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null)
  const [name, setName] = useState('bild')
  const [s, setS] = useState<EditState | null>(null)
  const [panel, setPanel] = useState<Panel>('size')
  const [lockAspect, setLockAspect] = useState(true)
  const [aspect, setAspect] = useState<number | null>(null)
  const [format, setFormat] = useState<Format>('image/jpeg')
  const [quality, setQuality] = useState(92)
  const [busy, setBusy] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [compare, setCompare] = useState(50)
  const [detail, setDetail] = useState(false)
  const [estimate, setEstimate] = useState<number | null>(null)

  const fileInput = useRef<HTMLInputElement>(null)
  const afterRef = useRef<HTMLCanvasElement>(null)
  const beforeRef = useRef<HTMLCanvasElement>(null)

  /* ── Laden ── */
  const open = useCallback(async (blob: Blob, fileName: string) => {
    setBusy('Bild wird geladen …')
    try {
      const bmp = await loadBitmap(blob)
      setBitmap(prev => { prev?.close(); return bmp })
      setName(fileName.replace(/\.[^.]+$/, '') || 'bild')
      setS(initialState(bmp.width, bmp.height))
      setAspect(null)
      setPanel('size')
      setFormat(blob.type === 'image/png' ? 'image/png' : blob.type === 'image/webp' ? 'image/webp' : 'image/jpeg')
    } catch {
      toast('Dieses Bild kann der Browser nicht öffnen (z.B. HEIC oder RAW). Bitte als JPG/PNG exportieren.')
    } finally {
      setBusy(null)
    }
  }, [toast])

  async function openFromQuickShare(ids: number[]) {
    setPickerOpen(false)
    const id = ids[0]
    if (!id) return
    setBusy('Bild wird geladen …')
    try {
      const res = await fetch(fileUrl(id, true))
      if (!res.ok) throw new Error(`Fehler ${res.status}`)
      const cd = res.headers.get('content-disposition') || ''
      const fn = decodeURIComponent(cd.match(/filename\*=UTF-8''([^;]+)/)?.[1] ?? '') || 'bild.jpg'
      await open(await res.blob(), fn)
    } catch (e) {
      toast(`Laden fehlgeschlagen: ${(e as Error).message}`)
      setBusy(null)
    }
  }

  /* ── Maße ── */
  const rot = useMemo(() => (bitmap && s ? rotatedSize(bitmap, s.rotate) : { w: 1, h: 1 }), [bitmap, s])
  const cropPx = useMemo(() => (s ? { w: Math.round(s.crop.w * rot.w), h: Math.round(s.crop.h * rot.h) } : { w: 1, h: 1 }), [s, rot])
  const pct = s ? Math.round((s.outW / cropPx.w) * 100) : 100

  const update = (patch: Partial<EditState>) => setS(prev => (prev ? { ...prev, ...patch } : prev))

  /** Nach Drehen/Zuschneiden die Zielgröße mit gleichem Prozentwert neu setzen */
  const setGeometry = (patch: Partial<EditState>) => setS(prev => {
    if (!prev || !bitmap) return prev
    const next = { ...prev, ...patch }
    const r = rotatedSize(bitmap, next.rotate)
    const scale = prev.outW / Math.max(1, Math.round(prev.crop.w * rotatedSize(bitmap, prev.rotate).w))
    const cw = Math.round(next.crop.w * r.w), ch = Math.round(next.crop.h * r.h)
    return { ...next, outW: Math.max(1, Math.round(cw * scale)), outH: Math.max(1, Math.round(ch * scale)) }
  })

  function setWidth(w: number) {
    if (!s || !w) return
    update(lockAspect ? { outW: w, outH: Math.max(1, Math.round((w * cropPx.h) / cropPx.w)) } : { outW: w })
  }
  function setHeight(h: number) {
    if (!s || !h) return
    update(lockAspect ? { outH: h, outW: Math.max(1, Math.round((h * cropPx.w) / cropPx.h)) } : { outH: h })
  }
  function setPct(p: number) {
    update({ outW: Math.max(1, Math.round((cropPx.w * p) / 100)), outH: Math.max(1, Math.round((cropPx.h * p) / 100)) })
  }

  /* ── Vorschau ── */
  useEffect(() => {
    if (!bitmap || !s) return
    let cancelled = false
    const t = setTimeout(() => {
      if (cancelled) return
      const cropMode = panel === 'crop'
      const view: EditState = cropMode ? { ...s, crop: FULL_CROP, outW: rot.w, outH: rot.h } : s
      const max = detail && !cropMode ? 3000 : 1400
      const after = render(bitmap, view, max)
      const before = cropMode ? after : render(bitmap, { ...view, brightness: 0, contrast: 0, saturation: 0, sharpAmount: 0 }, max)
      for (const [ref, c] of [[afterRef, after], [beforeRef, before]] as const) {
        const el = ref.current
        if (!el) continue
        el.width = c.width; el.height = c.height
        el.getContext('2d')!.drawImage(c, 0, 0)
      }
    }, 120)
    return () => { cancelled = true; clearTimeout(t) }
  }, [bitmap, s, panel, detail, rot])

  // Ungefähre Dateigröße
  useEffect(() => {
    if (!bitmap || !s) return
    let cancelled = false
    const t = setTimeout(async () => {
      const small = render(bitmap, s, 600)
      const blob = await toBlob(small, format, quality / 100)
      if (!cancelled) setEstimate(Math.round(blob.size * ((s.outW * s.outH) / (small.width * small.height))))
    }, 500)
    return () => { cancelled = true; clearTimeout(t) }
  }, [bitmap, s, format, quality])

  /* ── Speichern ── */
  async function produce(): Promise<File | null> {
    if (!bitmap || !s) return null
    if (s.outW * s.outH > 60_000_000) { toast('Zu groß – maximal ca. 60 Megapixel'); return null }
    setBusy('Bild wird berechnet …')
    await new Promise(r => setTimeout(r, 30)) // Hinweis anzeigen, bevor gerechnet wird
    try {
      const c = render(bitmap, s)
      const blob = await toBlob(c, format, quality / 100)
      const ext = format === 'image/png' ? 'png' : format === 'image/webp' ? 'webp' : 'jpg'
      return new File([blob], `${name}-bearbeitet.${ext}`, { type: format })
    } catch (e) {
      toast(`Fehler: ${(e as Error).message}`)
      return null
    } finally {
      setBusy(null)
    }
  }

  async function saveToQuickShare() {
    const f = await produce()
    if (!f) return
    upload([f])
    toast('Wird in Quick Share gespeichert …')
  }

  async function download() {
    const f = await produce()
    if (!f) return
    const url = URL.createObjectURL(f)
    const a = document.createElement('a')
    a.href = url; a.download = f.name
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  /* ── Zuschneiden: Rahmen ziehen ── */
  const dragRef = useRef<{ mode: string; sx: number; sy: number; start: Crop } | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  function applyAspect(c: Crop, a: number | null, anchor: 'keepW' | 'keepH' = 'keepW'): Crop {
    if (!a) return c
    const ratio = a === -1 ? rot.w / rot.h : a
    // Seitenverhältnis in Anteilen: w*rot.w / (h*rot.h) = ratio
    let { w, h } = c
    if (anchor === 'keepW') h = (w * rot.w) / ratio / rot.h
    else w = (h * rot.h * ratio) / rot.w
    if (h > 1) { h = 1; w = (h * rot.h * ratio) / rot.w }
    if (w > 1) { w = 1; h = (w * rot.w) / ratio / rot.h }
    return { x: Math.min(c.x, 1 - w), y: Math.min(c.y, 1 - h), w, h }
  }

  function chooseAspect(a: number | null) {
    setAspect(a)
    if (!s) return
    if (a === null) return
    const c = applyAspect({ ...s.crop, w: s.crop.w, h: s.crop.h }, a)
    // mittig im alten Rahmen
    setGeometry({ crop: { ...c, x: Math.max(0, Math.min(1 - c.w, s.crop.x + (s.crop.w - c.w) / 2)), y: Math.max(0, Math.min(1 - c.h, s.crop.y + (s.crop.h - c.h) / 2)) } })
  }

  function onCropDown(e: React.PointerEvent, mode: string) {
    if (!s) return
    e.preventDefault(); e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    dragRef.current = { mode, sx: e.clientX, sy: e.clientY, start: s.crop }
  }
  function onCropMove(e: React.PointerEvent) {
    const d = dragRef.current
    const box = stageRef.current?.getBoundingClientRect()
    if (!d || !box || !s) return
    const dx = (e.clientX - d.sx) / box.width
    const dy = (e.clientY - d.sy) / box.height
    let { x, y, w, h } = d.start
    const min = 0.03
    if (d.mode === 'move') {
      x = Math.max(0, Math.min(1 - w, x + dx)); y = Math.max(0, Math.min(1 - h, y + dy))
    } else {
      if (d.mode.includes('l')) { const nx = Math.max(0, Math.min(x + w - min, x + dx)); w += x - nx; x = nx }
      if (d.mode.includes('r')) w = Math.max(min, Math.min(1 - x, w + dx))
      if (d.mode.includes('t')) { const ny = Math.max(0, Math.min(y + h - min, y + dy)); h += y - ny; y = ny }
      if (d.mode.includes('b')) h = Math.max(min, Math.min(1 - y, h + dy))
      if (aspect) {
        const c = applyAspect({ x, y, w, h }, aspect, Math.abs(dx) >= Math.abs(dy) ? 'keepW' : 'keepH')
        // Bei Ziehen links/oben die gegenüberliegende Kante festhalten
        if (d.mode.includes('l')) c.x = Math.max(0, d.start.x + d.start.w - c.w)
        if (d.mode.includes('t')) c.y = Math.max(0, d.start.y + d.start.h - c.h)
        ;({ x, y, w, h } = c)
      }
    }
    setGeometry({ crop: { x, y, w, h } })
  }
  function onCropUp() { dragRef.current = null }

  /* ── Darstellung ── */
  if (!bitmap || !s) {
    return (
      <div className="pv-glass pv-card pv-tool-empty">
        <span className="pv-tile-icon" style={{ width: 56, height: 56 }}><Icon name="image" size={26} /></span>
        <div className="pv-h2">Bild öffnen</div>
        <p className="pv-muted" style={{ margin: 0, maxWidth: 440, fontSize: 14 }}>
          Skalieren, zuschneiden, drehen, Farben anpassen und schärfen. Das Bild wird nur in deinem Browser bearbeitet.
        </p>
        <div className="pv-row pv-wrap" style={{ justifyContent: 'center' }}>
          <button className="pv-btn primary" onClick={() => setPickerOpen(true)}><Icon name="share" size={17} /> Aus Quick Share</button>
          <button className="pv-btn" onClick={() => fileInput.current?.click()}><Icon name="upload" size={17} /> Vom Gerät</button>
        </div>
        {busy && <div className="pv-row"><span className="pv-spinner" /> {busy}</div>}
        <input ref={fileInput} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) open(f, f.name); e.target.value = '' }} />
        {pickerOpen && (
          <AttachPicker excludeIds={[]} onlyKind="image" single title="Bild aus Quick Share" subtitle="" confirmLabel="öffnen"
            onClose={() => setPickerOpen(false)} onPick={openFromQuickShare} />
        )}
      </div>
    )
  }

  const cropMode = panel === 'crop'
  const PANELS: [Panel, string, string][] = [
    ['size', 'image', 'Größe'], ['crop', 'crop', 'Zuschneiden'], ['turn', 'rotate', 'Drehen'], ['color', 'sliders', 'Farbe'], ['sharp', 'wand', 'Schärfen'],
  ]
  const sharpPreset = (Object.entries(PRESETS).find(([, p]) =>
    p.sharpAmount === s.sharpAmount && p.sharpRadius === s.sharpRadius && p.sharpThreshold === s.sharpThreshold)?.[0]) ?? 'custom'
  const edited = s.brightness || s.contrast || s.saturation || s.sharpAmount

  return (
    <div className="pv-img-layout">
      {/* Vorschau */}
      <div className="pv-glass pv-img-stage-wrap">
        <div className={`pv-img-stage ${detail && !cropMode ? 'detail' : ''} ${cropMode ? 'crop' : ''}`}>
          <div className="pv-img-canvas" ref={stageRef}>
            <canvas ref={beforeRef} className="pv-img-before" />
            <canvas ref={afterRef} className="pv-img-after" style={!cropMode && edited ? { clipPath: `inset(0 0 0 ${compare}%)` } : undefined} />
            {cropMode && (
              <div className="pv-crop-layer" onPointerMove={onCropMove} onPointerUp={onCropUp} onPointerCancel={onCropUp}>
                <div
                  className="pv-crop-box"
                  style={{ left: `${s.crop.x * 100}%`, top: `${s.crop.y * 100}%`, width: `${s.crop.w * 100}%`, height: `${s.crop.h * 100}%` }}
                  onPointerDown={e => onCropDown(e, 'move')}
                >
                  {['tl', 'tr', 'bl', 'br', 't', 'b', 'l', 'r'].map(h => (
                    <span key={h} className={`pv-crop-h ${h}`} onPointerDown={e => onCropDown(e, h)} />
                  ))}
                </div>
              </div>
            )}
            {!cropMode && edited ? (
              <>
                <div className="pv-img-split" style={{ left: `${compare}%` }} />
                <span className="pv-img-tag left">Vorher</span>
                <span className="pv-img-tag right">Nachher</span>
              </>
            ) : null}
          </div>
        </div>
        {!cropMode && edited ? (
          <input className="pv-range" type="range" min={0} max={100} value={compare} onChange={e => setCompare(Number(e.target.value))} aria-label="Vorher/Nachher vergleichen" />
        ) : null}
        <div className="pv-row pv-wrap" style={{ gap: 8, fontSize: 12.5 }}>
          <span className="pv-muted">Original {bitmap.width} × {bitmap.height} px</span>
          <span className="pv-grow" />
          {!cropMode && (
            <label className="pv-check-row" style={{ minHeight: 0, fontSize: 12.5 }}>
              <input type="checkbox" checked={detail} onChange={e => setDetail(e.target.checked)} /> Detailansicht (echte Pixel)
            </label>
          )}
        </div>
      </div>

      {/* Einstellungen */}
      <div className="pv-img-side">
        <div className="pv-glass pv-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="pv-img-tabs">
            {PANELS.map(([k, icon, label]) => (
              <button key={k} className={panel === k ? 'active' : ''} onClick={() => setPanel(k)}><Icon name={icon} size={17} /><span>{label}</span></button>
            ))}
          </div>

          {panel === 'size' && (
            <>
              <div className="pv-row" style={{ gap: 8, alignItems: 'flex-end' }}>
                <div className="pv-grow"><label className="pv-label">Breite (px)</label>
                  <input className="pv-input" type="number" min={1} max={20000} value={s.outW} onChange={e => setWidth(Number(e.target.value))} /></div>
                <button className={`pv-icon-btn ${lockAspect ? 'active' : ''}`} title="Seitenverhältnis beibehalten" aria-label="Seitenverhältnis beibehalten" onClick={() => setLockAspect(l => !l)}><Icon name="link" size={17} /></button>
                <div className="pv-grow"><label className="pv-label">Höhe (px)</label>
                  <input className="pv-input" type="number" min={1} max={20000} value={s.outH} onChange={e => setHeight(Number(e.target.value))} /></div>
              </div>
              <div>
                <label className="pv-label">Prozent: {pct} %</label>
                <input className="pv-range" type="range" min={5} max={400} step={1} value={Math.min(400, pct)} onChange={e => setPct(Number(e.target.value))} />
                <div className="pv-chips" style={{ flexWrap: 'wrap' }}>
                  {[25, 50, 75, 100, 150, 200].map(p => <button key={p} className={`pv-chip ${pct === p ? 'active' : ''}`} onClick={() => setPct(p)}>{p} %</button>)}
                </div>
              </div>
              <div className="pv-chips" style={{ flexWrap: 'wrap' }}>
                {[['Full HD', 1920], ['Instagram', 1080], ['Web', 1280], ['Klein', 640]].map(([l, w]) => (
                  <button key={l} className="pv-chip" onClick={() => { const W = Number(w); update(cropPx.w >= cropPx.h ? { outW: W, outH: Math.round((W * cropPx.h) / cropPx.w) } : { outH: W, outW: Math.round((W * cropPx.w) / cropPx.h) }) }}>
                    {l} ({w})
                  </button>
                ))}
              </div>
              {pct > 100 && <p className="pv-muted" style={{ fontSize: 12.5, margin: 0 }}>Beim Vergrößern entstehen keine neuen Details – Schärfen hilft etwas dagegen.</p>}
            </>
          )}

          {panel === 'crop' && (
            <>
              <div className="pv-chips" style={{ flexWrap: 'wrap' }}>
                {ASPECTS.map(([l, a]) => <button key={l} className={`pv-chip ${aspect === a ? 'active' : ''}`} onClick={() => chooseAspect(a)}>{l}</button>)}
              </div>
              <p className="pv-muted" style={{ fontSize: 13, margin: 0 }}>Rahmen im Bild verschieben oder an den Ecken ziehen. Ausschnitt: {cropPx.w} × {cropPx.h} px</p>
              <button className="pv-btn sm" onClick={() => { setAspect(null); setGeometry({ crop: FULL_CROP }) }}><Icon name="refresh" size={15} /> Ganzes Bild</button>
            </>
          )}

          {panel === 'turn' && (
            <div className="pv-row pv-wrap" style={{ gap: 8 }}>
              <button className="pv-btn" onClick={() => setGeometry({ rotate: ((s.rotate + 270) % 360) as EditState['rotate'], crop: FULL_CROP })}><Icon name="rotate" size={17} style={{ transform: 'scaleX(-1)' }} /> Links drehen</button>
              <button className="pv-btn" onClick={() => setGeometry({ rotate: ((s.rotate + 90) % 360) as EditState['rotate'], crop: FULL_CROP })}><Icon name="rotate" size={17} /> Rechts drehen</button>
              <button className={`pv-btn ${s.flipH ? 'primary' : ''}`} onClick={() => setGeometry({ flipH: !s.flipH })}><Icon name="flip" size={17} /> Spiegeln</button>
              <button className={`pv-btn ${s.flipV ? 'primary' : ''}`} onClick={() => setGeometry({ flipV: !s.flipV })}><Icon name="flip" size={17} style={{ transform: 'rotate(90deg)' }} /> Kippen</button>
            </div>
          )}

          {panel === 'color' && (
            <>
              {([['brightness', 'Helligkeit'], ['contrast', 'Kontrast'], ['saturation', 'Sättigung']] as const).map(([k, l]) => (
                <div key={k}>
                  <label className="pv-label">{l}: {s[k] > 0 ? '+' : ''}{s[k]}</label>
                  <input className="pv-range" type="range" min={-100} max={100} value={s[k]} onChange={e => update({ [k]: Number(e.target.value) } as Partial<EditState>)} />
                </div>
              ))}
              <button className="pv-btn sm" onClick={() => update({ brightness: 0, contrast: 0, saturation: 0 })}>Farben zurücksetzen</button>
            </>
          )}

          {panel === 'sharp' && (
            <>
              <div className="pv-seg" style={{ width: '100%' }}>
                {([['off', 'Aus'], ['light', 'Leicht'], ['medium', 'Mittel'], ['strong', 'Stark']] as const).map(([k, l]) => (
                  <button key={k} style={{ flex: 1 }} className={sharpPreset === k ? 'active' : ''} onClick={() => update(PRESETS[k])}>{l}</button>
                ))}
              </div>
              <div>
                <label className="pv-label">Stärke: {s.sharpAmount} %</label>
                <input className="pv-range" type="range" min={0} max={300} step={5} value={s.sharpAmount} onChange={e => update({ sharpAmount: Number(e.target.value) })} />
              </div>
              <div>
                <label className="pv-label">Radius: {s.sharpRadius.toFixed(1)} px</label>
                <input className="pv-range" type="range" min={0.8} max={5} step={0.1} value={s.sharpRadius} onChange={e => update({ sharpRadius: Number(e.target.value) })} />
              </div>
              <div>
                <label className="pv-label">Schwelle: {s.sharpThreshold} (schützt glatte Flächen vor Rauschen)</label>
                <input className="pv-range" type="range" min={0} max={40} value={s.sharpThreshold} onChange={e => update({ sharpThreshold: Number(e.target.value) })} />
              </div>
              <p className="pv-muted" style={{ fontSize: 12.5, margin: 0 }}>
                Klassisches Schärfen (Unscharf maskieren): Kanten werden kontrastreicher. Verwackelte oder sehr unscharfe Fotos
                werden dadurch deutlicher, aber nicht wie neu. Zum Beurteilen „Detailansicht“ einschalten.
              </p>
            </>
          )}
        </div>

        <div className="pv-glass pv-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="pv-row" style={{ gap: 8 }}>
            <select className="pv-input" value={format} onChange={e => setFormat(e.target.value as Format)} aria-label="Format" style={{ width: 'auto' }}>
              <option value="image/jpeg">JPG</option>
              <option value="image/png">PNG</option>
              <option value="image/webp">WebP</option>
            </select>
            {format !== 'image/png' && (
              <div className="pv-grow">
                <label className="pv-label" style={{ marginBottom: 0 }}>Qualität {quality}</label>
                <input className="pv-range" type="range" min={40} max={100} value={quality} onChange={e => setQuality(Number(e.target.value))} />
              </div>
            )}
          </div>
          <div className="pv-muted" style={{ fontSize: 12.5 }}>
            Ergebnis: {s.outW} × {s.outH} px{estimate !== null && ` · ca. ${estimate > 1048576 ? `${(estimate / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(estimate / 1024))} KB`}`}
          </div>
          {busy && <div className="pv-row" style={{ fontSize: 13 }}><span className="pv-spinner" style={{ width: 16, height: 16 }} /> {busy}</div>}
          <div className="pv-row pv-wrap" style={{ gap: 8 }}>
            <button className="pv-btn primary pv-grow" onClick={saveToQuickShare} disabled={!!busy}><Icon name="share" size={17} /> In Quick Share</button>
            <button className="pv-btn pv-grow" onClick={download} disabled={!!busy}><Icon name="download" size={17} /> Herunterladen</button>
          </div>
          <div className="pv-row" style={{ gap: 8 }}>
            <button className="pv-btn sm ghost" onClick={() => { setS(initialState(bitmap.width, bitmap.height)); setAspect(null) }}><Icon name="refresh" size={15} /> Alles zurücksetzen</button>
            <span className="pv-grow" />
            <button className="pv-btn sm ghost" onClick={() => { bitmap.close(); setBitmap(null); setS(null) }}><Icon name="x" size={15} /> Anderes Bild</button>
          </div>
        </div>
      </div>
    </div>
  )
}