'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface Props {
  file: File
  kind: 'avatar' | 'banner' | 'background'
  onConfirm: (croppedFile: File) => void
  onCancel: () => void
}

interface CropBox { x: number; y: number; w: number; h: number }
type Handle = 'tl'|'tr'|'bl'|'br'|'t'|'b'|'l'|'r'|'move'|'pan'|null

const ASPECTS: Record<string, { label: string; w: number; h: number }[]> = {
  avatar:     [{ label: '1:1', w: 1, h: 1 }, { label: '4:3', w: 4, h: 3 }],
  banner:     [{ label: '4:1', w: 4, h: 1 }, { label: '3:1', w: 3, h: 1 }, { label: '16:9', w: 16, h: 9 }, { label: '21:9', w: 21, h: 9 }],
  background: [{ label: '16:9', w: 16, h: 9 }, { label: '4:3', w: 4, h: 3 }, { label: '1:1', w: 1, h: 1 }],
}
const DEFAULT_ASPECT: Record<string, { w: number; h: number } | null> = {
  avatar: { w: 1, h: 1 }, banner: { w: 4, h: 1 }, background: { w: 16, h: 9 },
}
const OUTPUT_PRESETS = [
  { label: '720p', w: 1280 }, { label: '1080p', w: 1920 },
  { label: '1440p', w: 2560 }, { label: '4K', w: 3840 },
]
const HANDLE_R  = 6    // handle radius px
const HIT_R     = 14   // hit radius px
const MIN_CROP  = 20   // minimum crop size in image px

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

function applyUnsharpMask(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) {
  if (amount <= 0) return
  const orig = ctx.getImageData(0, 0, w, h)
  const bc = document.createElement('canvas'); bc.width = w; bc.height = h
  const bctx = bc.getContext('2d')!
  bctx.filter = `blur(${Math.max(1, Math.round(amount * 2))}px)`
  bctx.drawImage(ctx.canvas, 0, 0)
  const blurred = bctx.getImageData(0, 0, w, h)
  const out = ctx.createImageData(w, h)
  const f = amount * 1.8
  for (let i = 0; i < orig.data.length; i += 4) {
    for (let c = 0; c < 3; c++)
      out.data[i+c] = clamp(Math.round(orig.data[i+c] + f * (orig.data[i+c] - blurred.data[i+c])), 0, 255)
    out.data[i+3] = orig.data[i+3]
  }
  ctx.putImageData(out, 0, 0)
}

export default function ImageCropModal({ file, kind, onConfirm, onCancel }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef       = useRef<HTMLImageElement | null>(null)
  const rafRef       = useRef<number>(0)
  const dragRef      = useRef<{ handle: Handle; startMX: number; startMY: number; startCrop: CropBox; startPanX: number; startPanY: number } | null>(null)

  const [imgW, setImgW]   = useState(0)
  const [imgH, setImgH]   = useState(0)
  const [viewW, setViewW] = useState(800)
  const [viewH, setViewH] = useState(460)
  const [zoom, setZoomRaw]  = useState(1)
  const [panX, setPanX]     = useState(0)
  const [panY, setPanY]     = useState(0)
  const [crop, setCrop]     = useState<CropBox>({ x: 0, y: 0, w: 100, h: 100 })
  const [aspect, setAspect] = useState<{ w: number; h: number } | null>(DEFAULT_ASPECT[kind] ?? null)
  const [outputW, setOutputW]   = useState(kind === 'avatar' ? 1920 : 3840)
  const [sharpness, setSharpness] = useState(0.3)
  const [rendering, setRendering] = useState(false)
  const [isVideo, setIsVideo]     = useState(false)
  const [cursor, setCursor]       = useState('crosshair')

  const setZoom = (fn: (z: number) => number) => setZoomRaw(z => clamp(fn(z), 0.02, 40))

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (file.type === 'video/mp4') { setIsVideo(true); return }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { imgRef.current = img; setImgW(img.naturalWidth); setImgH(img.naturalHeight); URL.revokeObjectURL(url) }
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    const el = containerRef.current; if (!el) return
    const ro = new ResizeObserver(e => { setViewW(Math.floor(e[0].contentRect.width)); setViewH(Math.floor(e[0].contentRect.height)) })
    ro.observe(el); return () => ro.disconnect()
  }, [])

  // ── Fit ───────────────────────────────────────────────────────────────────
  const doFit = useCallback(() => {
    if (!imgW || !imgH || !viewW || !viewH) return
    const z = Math.min((viewW * 0.88) / imgW, (viewH * 0.88) / imgH)
    setZoomRaw(z); setPanX(0); setPanY(0)
    const ar = aspect ? aspect.w / aspect.h : imgW / imgH
    let cw = imgW, ch = imgH
    if (imgW / imgH > ar) cw = Math.round(imgH * ar)
    else ch = Math.round(imgW / ar)
    setCrop({ x: Math.round((imgW - cw) / 2), y: Math.round((imgH - ch) / 2), w: cw, h: ch })
  }, [imgW, imgH, viewW, viewH, aspect])

  useEffect(() => { doFit() }, [imgW, imgH, viewW, viewH]) // eslint-disable-line

  // ── Coordinate helpers ────────────────────────────────────────────────────
  const origin = useCallback(() => ({
    left: viewW / 2 - (imgW * zoom) / 2 + panX,
    top:  viewH / 2 - (imgH * zoom) / 2 + panY,
  }), [viewW, viewH, imgW, imgH, zoom, panX, panY])

  const toScreen = useCallback((ix: number, iy: number) => {
    const o = origin()
    return { sx: o.left + ix * zoom, sy: o.top + iy * zoom }
  }, [origin, zoom])

  const cropScreenRect = useCallback(() => {
    const { sx: x1, sy: y1 } = toScreen(crop.x, crop.y)
    const { sx: x2, sy: y2 } = toScreen(crop.x + crop.w, crop.y + crop.h)
    return { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1 }
  }, [crop, toScreen])

  // ── Hit test ──────────────────────────────────────────────────────────────
  const hitHandle = useCallback((mx: number, my: number): Handle => {
    const { x1, y1, x2, y2 } = cropScreenRect()
    const xm = (x1 + x2) / 2, ym = (y1 + y2) / 2
    const pts: [Handle, number, number][] = [
      ['tl', x1, y1], ['tr', x2, y1], ['bl', x1, y2], ['br', x2, y2],
      ['t', xm, y1],  ['b', xm, y2],  ['l', x1, ym],  ['r', x2, ym],
    ]
    for (const [h, hx, hy] of pts) {
      if (Math.hypot(mx - hx, my - hy) <= HIT_R) return h
    }
    if (mx > x1 && mx < x2 && my > y1 && my < y2) return 'move'
    return 'pan'
  }, [cropScreenRect])

  const cursorForHandle = (h: Handle) => {
    if (h === 'tl' || h === 'br') return 'nwse-resize'
    if (h === 'tr' || h === 'bl') return 'nesw-resize'
    if (h === 'l'  || h === 'r')  return 'ew-resize'
    if (h === 't'  || h === 'b')  return 'ns-resize'
    if (h === 'move') return 'move'
    return 'grab'
  }

  // ── Draw ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const canvas = canvasRef.current; const img = imgRef.current
      if (!canvas || !img || !imgW || !imgH) return
      canvas.width = viewW; canvas.height = viewH
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#08080f'; ctx.fillRect(0, 0, viewW, viewH)

      const o = origin()
      const dw = imgW * zoom, dh = imgH * zoom

      // Dimmed full image
      ctx.globalAlpha = 0.28
      ctx.drawImage(img, o.left, o.top, dw, dh)
      ctx.globalAlpha = 1

      // Bright inside crop
      const cs = cropScreenRect()
      ctx.save(); ctx.beginPath(); ctx.rect(cs.x1, cs.y1, cs.w, cs.h); ctx.clip()
      ctx.drawImage(img, o.left, o.top, dw, dh)
      ctx.restore()

      // Border
      ctx.strokeStyle = 'rgba(255,255,255,0.88)'; ctx.lineWidth = 1.5
      ctx.strokeRect(cs.x1, cs.y1, cs.w, cs.h)

      // Grid thirds
      ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 0.7
      for (let i = 1; i <= 2; i++) {
        const gx = cs.x1 + cs.w / 3 * i, gy = cs.y1 + cs.h / 3 * i
        ctx.beginPath(); ctx.moveTo(gx, cs.y1); ctx.lineTo(gx, cs.y1 + cs.h); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(cs.x1, gy); ctx.lineTo(cs.x1 + cs.w, gy); ctx.stroke()
      }

      // Handles
      const xm = (cs.x1 + cs.x2) / 2, ym = (cs.y1 + cs.y2) / 2
      const pts: [number, number][] = [
        [cs.x1, cs.y1], [cs.x2, cs.y1], [cs.x1, cs.y2], [cs.x2, cs.y2],
        [xm, cs.y1], [xm, cs.y2], [cs.x1, ym], [cs.x2, ym],
      ]
      pts.forEach(([hx, hy]) => {
        ctx.beginPath(); ctx.arc(hx, hy, HANDLE_R, 0, Math.PI * 2)
        ctx.fillStyle = '#fff'; ctx.fill()
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.stroke()
      })

      // Info label
      const label = `${Math.round(crop.w)} × ${Math.round(crop.h)} px`
      ctx.font = '11px monospace'
      const tw = ctx.measureText(label).width
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(cs.x1 + 6, cs.y2 - 22, tw + 12, 18)
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillText(label, cs.x1 + 12, cs.y2 - 8)
    })
  })

  // ── Pointer ───────────────────────────────────────────────────────────────
  const onPD = (e: React.PointerEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    const mx = e.clientX - rect.left, my = e.clientY - rect.top
    const h = hitHandle(mx, my)
    dragRef.current = { handle: h, startMX: mx, startMY: my, startCrop: { ...crop }, startPanX: panX, startPanY: panY }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    setCursor(cursorForHandle(h) === 'grab' ? 'grabbing' : cursorForHandle(h))
  }

  const onPM = (e: React.PointerEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    const mx = e.clientX - rect.left, my = e.clientY - rect.top

    if (!dragRef.current) { setCursor(cursorForHandle(hitHandle(mx, my))); return }

    const { handle, startMX, startMY, startCrop, startPanX, startPanY } = dragRef.current
    const dsx = mx - startMX, dsy = my - startMY  // screen delta
    const dix = dsx / zoom, diy = dsy / zoom        // image delta

    if (handle === 'pan') {
      setPanX(startPanX + dsx); setPanY(startPanY + dsy); return
    }
    if (handle === 'move') {
      setCrop(prev => ({
        ...prev,
        x: clamp(startCrop.x + dix, 0, imgW - startCrop.w),
        y: clamp(startCrop.y + diy, 0, imgH - startCrop.h),
      })); return
    }

    // Resize with optional locked aspect
    let { x, y, w, h } = startCrop
    const ar = aspect ? aspect.w / aspect.h : null

    const lockAR = (nw: number, nh: number, byW: boolean): [number, number] => {
      if (!ar) return [nw, nh]
      return byW ? [nw, nw / ar] : [nh * ar, nh]
    }

    if (handle === 'r')  { const [fw, fh] = lockAR(Math.max(MIN_CROP, w + dix), h, true);  w = fw; h = fh }
    if (handle === 'l')  { const nw = Math.max(MIN_CROP, w - dix); const [fw, fh] = lockAR(nw, h, true);  x = startCrop.x + startCrop.w - fw; w = fw; h = fh }
    if (handle === 'b')  { const [fw, fh] = lockAR(w, Math.max(MIN_CROP, h + diy), false); w = fw; h = fh }
    if (handle === 't')  { const nh = Math.max(MIN_CROP, h - diy); const [fw, fh] = lockAR(w, nh, false); y = startCrop.y + startCrop.h - fh; w = fw; h = fh }
    if (handle === 'br') { const [fw, fh] = lockAR(Math.max(MIN_CROP, w + dix), Math.max(MIN_CROP, h + diy), true);  w = fw; h = fh }
    if (handle === 'bl') { const nw = Math.max(MIN_CROP, w - dix); const [fw, fh] = lockAR(nw, Math.max(MIN_CROP, h + diy), true);  x = startCrop.x + startCrop.w - fw; w = fw; h = fh }
    if (handle === 'tr') { const [fw, fh] = lockAR(Math.max(MIN_CROP, w + dix), Math.max(MIN_CROP, h - diy), true);  y = startCrop.y + startCrop.h - fh; w = fw; h = fh }
    if (handle === 'tl') { const nw = Math.max(MIN_CROP, w - dix); const [fw, fh] = lockAR(nw, Math.max(MIN_CROP, h - diy), true);  x = startCrop.x + startCrop.w - fw; y = startCrop.y + startCrop.h - fh; w = fw; h = fh }

    x = clamp(x, 0, imgW - MIN_CROP); y = clamp(y, 0, imgH - MIN_CROP)
    w = clamp(w, MIN_CROP, imgW - x);  h = clamp(h, MIN_CROP, imgH - y)
    setCrop({ x, y, w, h })
  }

  const onPU = () => { dragRef.current = null; setCursor('crosshair') }

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    setZoom(z => z * (e.deltaY < 0 ? 1.1 : 0.91))
  }

  // ── Aspect change ─────────────────────────────────────────────────────────
  const changeAspect = (a: { w: number; h: number } | null) => {
    setAspect(a)
    if (!a) return
    const ar = a.w / a.h
    let cw = crop.w, ch = crop.h
    if (cw / ch > ar) cw = Math.round(ch * ar); else ch = Math.round(cw / ar)
    cw = clamp(cw, MIN_CROP, imgW); ch = clamp(ch, MIN_CROP, imgH)
    setCrop(prev => ({
      x: clamp(prev.x + Math.round((prev.w - cw) / 2), 0, imgW - cw),
      y: clamp(prev.y + Math.round((prev.h - ch) / 2), 0, imgH - ch),
      w: cw, h: ch,
    }))
  }

  const selectAll = () => {
    const ar = aspect ? aspect.w / aspect.h : imgW / imgH
    let cw = imgW, ch = imgH
    if (imgW / imgH > ar) cw = Math.round(imgH * ar); else ch = Math.round(imgW / ar)
    setCrop({ x: Math.round((imgW - cw) / 2), y: Math.round((imgH - ch) / 2), w: cw, h: ch })
  }

  // ── Export ────────────────────────────────────────────────────────────────
  const confirmCrop = async () => {
    const img = imgRef.current; if (!img) return
    setRendering(true)
    const srcX = clamp(Math.round(crop.x), 0, imgW)
    const srcY = clamp(Math.round(crop.y), 0, imgH)
    const srcW = clamp(Math.round(crop.w), 1, imgW - srcX)
    const srcH = clamp(Math.round(crop.h), 1, imgH - srcY)
    const ar   = srcW / srcH
    const outH = Math.round(outputW / ar)

    const out = document.createElement('canvas')
    out.width = outputW; out.height = outH
    const ctx = out.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outputW, outH)

    if (sharpness > 0 && outputW > srcW) applyUnsharpMask(ctx, outputW, outH, sharpness)

    const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
    const ext  = mime === 'image/jpeg' ? 'jpg' : 'png'
    const q    = mime === 'image/jpeg' ? 0.95 : undefined

    out.toBlob(blob => {
      setRendering(false)
      if (!blob) return
      onConfirm(new File([blob], file.name.replace(/\.[^.]+$/, `_cropped.${ext}`), { type: mime }))
    }, mime, q)
  }

  // ── Video shortcut ────────────────────────────────────────────────────────
  if (isVideo) return (
    <Modal onCancel={onCancel}>
      <div className="flex flex-col items-center justify-center h-64 gap-4 px-8">
        <p className="text-4xl">🎬</p>
        <p className="text-white font-semibold">MP4-Video</p>
        <p className="text-sm text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>Videos können nicht zugeschnitten werden.</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="px-5 py-2 rounded-xl text-sm"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>Abbrechen</button>
          <button onClick={() => onConfirm(file)} className="px-5 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: '#7C3AED' }}>Hochladen</button>
        </div>
      </div>
    </Modal>
  )

  const outH      = aspect ? Math.round(outputW / (aspect.w / aspect.h)) : Math.round(outputW * (crop.h / Math.max(1, crop.w)))
  const upscale   = outputW > crop.w
  const fitPct    = Math.round(zoom / Math.min((viewW * 0.88) / Math.max(1, imgW), (viewH * 0.88) / Math.max(1, imgH)) * 100)

  return (
    <Modal onCancel={onCancel}>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0 flex-wrap"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>Format</span>
        {ASPECTS[kind]?.map(a => (
          <button key={a.label} onClick={() => changeAspect(a)}
            className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all"
            style={aspect?.w === a.w && aspect?.h === a.h
              ? { background: '#7C3AED', color: '#fff' }
              : { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>
            {a.label}
          </button>
        ))}
        <button onClick={() => changeAspect(null)}
          className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
          style={!aspect ? { background: '#7C3AED', color: '#fff' } : { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>
          Frei
        </button>
        <button onClick={selectAll}
          className="px-2.5 py-1 rounded-lg text-xs"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
          Alles
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={() => setZoom(z => z * 0.85)}
          className="w-7 h-7 rounded-lg text-sm flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.07)', color: '#fff' }}>−</button>
        <button onClick={doFit}
          className="px-2.5 py-1 rounded-lg text-xs font-mono"
          style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.55)', minWidth: '48px', textAlign: 'center' }}>
          {fitPct}%
        </button>
        <button onClick={() => setZoom(z => z * 1.15)}
          className="w-7 h-7 rounded-lg text-sm flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.07)', color: '#fff' }}>+</button>
        <button onClick={doFit}
          className="px-2.5 py-1 rounded-lg text-xs"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}>
          Reset
        </button>
      </div>

      {/* ── Canvas ── */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>
        <canvas ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ touchAction: 'none', cursor }}
          onPointerDown={onPD}
          onPointerMove={onPM}
          onPointerUp={onPU}
          onPointerLeave={onPU}
          onWheel={onWheel}
        />
        {!imgW && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-t-white border-white/20 animate-spin" />
          </div>
        )}
      </div>

      {/* ── Bottom bar ── */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0 flex-wrap"
        style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>

        {/* Resolution presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>Ausgabe</span>
          {OUTPUT_PRESETS.map(p => (
            <button key={p.label} onClick={() => setOutputW(p.w)}
              className="px-2 py-1 rounded-lg text-xs font-mono transition-all"
              style={outputW === p.w
                ? { background: '#7C3AED22', color: '#a78bfa', border: '1px solid #7C3AED55' }
                : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)' }}>
              {p.label}
            </button>
          ))}
          <input type="number" min={64} max={7680} step={1} value={outputW}
            onChange={e => setOutputW(clamp(Number(e.target.value), 64, 7680))}
            className="w-16 px-2 py-1 rounded-lg text-xs font-mono outline-none"
            style={{ background: 'rgba(255,255,255,0.07)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)' }} />
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.22)' }}>× {outH}px</span>
        </div>

        {/* Sharpness — only when upscaling */}
        {upscale && (
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>Schärfe</span>
            <input type="range" min={0} max={1} step={0.05} value={sharpness}
              onChange={e => setSharpness(Number(e.target.value))}
              className="w-20 h-1" style={{ accentColor: '#7C3AED' }} />
            <span className="text-xs font-mono" style={{ color: '#a78bfa' }}>{Math.round(sharpness * 100)}%</span>
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}>
              ↑ {(outputW / Math.max(1, crop.w)).toFixed(1)}×
            </span>
          </div>
        )}

        <div style={{ flex: 1 }} />
        <p className="text-xs hidden sm:block" style={{ color: 'rgba(255,255,255,0.18)' }}>
          Scroll = Zoom · Ziehen = Pan / Größe
        </p>
        <button onClick={onCancel}
          className="px-4 py-2 rounded-xl text-sm"
          style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.55)' }}>
          Abbrechen
        </button>
        <button onClick={confirmCrop} disabled={rendering || !imgW}
          className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: '#7C3AED', boxShadow: '0 4px 16px rgba(124,58,237,0.4)' }}>
          {rendering ? 'Wird erstellt…' : 'Zuschneiden & hochladen'}
        </button>
      </div>
    </Modal>
  )
}

function Modal({ children, onCancel }: { children: React.ReactNode; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(14px)' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="flex flex-col rounded-2xl overflow-hidden"
        style={{
          background: '#0e0e1a', border: '1px solid rgba(255,255,255,0.1)',
          width: 'min(920px, 96vw)', height: 'min(660px, 93vh)',
          boxShadow: '0 32px 100px rgba(0,0,0,0.85)',
        }}>
        {children}
      </div>
    </div>
  )
}