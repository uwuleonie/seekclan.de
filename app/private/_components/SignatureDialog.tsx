'use client'

// Unterschrift: mit Finger, Stift oder Maus zeichnen, speichern und in Notizen einfügen.
// Gespeichert wird ein zugeschnittenes PNG mit durchsichtigem Hintergrund.

import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import Portal from './Portal'

export interface Signature { id: number; name: string; data_url: string; width: number | null; height: number | null }

const INKS = [
  { color: '#1c1330', label: 'Schwarz' },
  { color: '#1f3fa8', label: 'Blau' },
  { color: '#c2257f', label: 'Pink' },
]

type Point = { x: number; y: number }

export default function SignatureDialog({
  onClose, onInsert, toast,
}: {
  onClose: () => void
  onInsert: (sig: { src: string; width: number; height: number }) => void
  toast: (t: string) => void
}) {
  const [list, setList] = useState<Signature[] | null>(null)
  const [drawing, setDrawing] = useState(false)
  const [ink, setInk] = useState(INKS[0].color)
  const [thickness, setThickness] = useState(3)
  const [name, setName] = useState('')
  const [hasInk, setHasInk] = useState(false)
  const [saving, setSaving] = useState(false)
  const [armedDelete, setArmedDelete] = useState<number | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const last = useRef<Point | null>(null)
  const mid = useRef<Point | null>(null)
  const active = useRef(false)

  useEffect(() => {
    fetch('/api/private/leonie/signatures', { cache: 'no-store' })
      .then(async r => {
        const d = await r.json().catch(() => [])
        if (!r.ok) throw new Error(d.error || `Fehler ${r.status}`)
        return d as Signature[]
      })
      .then(d => { setList(d); if (!d.length) setDrawing(true) })
      .catch(e => { toast((e as Error).message); setList([]); setDrawing(true) })
  }, [toast])

  /* Zeichenfläche an Größe + Bildschirmschärfe anpassen */
  const setupCanvas = useCallback(() => {
    const c = canvasRef.current
    if (!c) return
    const r = c.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    c.width = Math.round(r.width * dpr)
    c.height = Math.round(r.height * dpr)
    const ctx = c.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    setHasInk(false)
  }, [])

  useEffect(() => {
    if (!drawing) return
    setupCanvas()
    window.addEventListener('resize', setupCanvas)
    return () => window.removeEventListener('resize', setupCanvas)
  }, [drawing, setupCanvas])

  const pos = (e: React.PointerEvent): Point => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    active.current = true
    const p = pos(e)
    last.current = p
    mid.current = p
    const ctx = canvasRef.current!.getContext('2d')!
    ctx.fillStyle = ink
    ctx.beginPath()
    ctx.arc(p.x, p.y, thickness / 2, 0, Math.PI * 2)
    ctx.fill()
    setHasInk(true)
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!active.current || !last.current || !mid.current) return
    const ctx = canvasRef.current!.getContext('2d')!
    // Druck (Stift) leicht berücksichtigen, Maus/Finger = gleichmäßig
    const pressure = e.pointerType === 'pen' && e.pressure > 0 ? 0.6 + e.pressure * 0.8 : 1
    const p = pos(e)
    const m = { x: (last.current.x + p.x) / 2, y: (last.current.y + p.y) / 2 }
    ctx.strokeStyle = ink
    ctx.lineWidth = thickness * pressure
    ctx.beginPath()
    ctx.moveTo(mid.current.x, mid.current.y)
    ctx.quadraticCurveTo(last.current.x, last.current.y, m.x, m.y)
    ctx.stroke()
    last.current = p
    mid.current = m
  }

  function up() {
    active.current = false
    last.current = null
    mid.current = null
  }

  function clear() {
    const c = canvasRef.current
    if (!c) return
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    setHasInk(false)
  }

  /** Leeren Rand abschneiden → kleines PNG */
  function exportTrimmed(): { src: string; width: number; height: number } | null {
    const c = canvasRef.current
    if (!c) return null
    const ctx = c.getContext('2d')!
    const { width: w, height: h } = c
    const data = ctx.getImageData(0, 0, w, h).data
    let minX = w, minY = h, maxX = -1, maxY = -1
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 8) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    if (maxX < 0) return null
    const pad = 10
    minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad)
    maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad)
    const out = document.createElement('canvas')
    out.width = maxX - minX + 1
    out.height = maxY - minY + 1
    out.getContext('2d')!.drawImage(c, minX, minY, out.width, out.height, 0, 0, out.width, out.height)
    const dpr = c.width / c.getBoundingClientRect().width
    return { src: out.toDataURL('image/png'), width: Math.round(out.width / dpr), height: Math.round(out.height / dpr) }
  }

  async function saveAndInsert(insert: boolean) {
    const img = exportTrimmed()
    if (!img) { toast('Erst unterschreiben'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/private/leonie/signatures', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || 'Unterschrift', data_url: img.src, width: img.width, height: img.height }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || `Fehler ${res.status}`)
      setList(prev => [d as Signature, ...(prev ?? [])])
      if (insert) { onInsert(img); onClose() }
      else { setDrawing(false); toast('Unterschrift gespeichert') }
    } catch (e) {
      toast(`Speichern fehlgeschlagen: ${(e as Error).message}`)
      // Einfügen klappt trotzdem – nur eben nicht gespeichert
      if (insert) { onInsert(img); onClose() }
    } finally {
      setSaving(false)
    }
  }

  async function remove(sig: Signature) {
    if (armedDelete !== sig.id) { setArmedDelete(sig.id); return }
    const res = await fetch(`/api/private/leonie/signatures?id=${sig.id}`, { method: 'DELETE' })
    if (!res.ok) { toast('Löschen fehlgeschlagen'); return }
    setList(prev => (prev ?? []).filter(s => s.id !== sig.id))
    setArmedDelete(null)
    toast('Gelöscht – schon eingefügte Unterschriften bleiben in den Notizen')
  }

  return (
    <Portal>
      <div className="pv-overlay sheet" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="pv-modal" style={{ maxWidth: 620 }}>
          <div className="pv-grip" />
          <div className="pv-row">
            <div className="pv-h2 pv-grow">Unterschrift</div>
            <button className="pv-icon-btn ghost" aria-label="Schließen" onClick={onClose}><Icon name="x" /></button>
          </div>

          {!drawing && (
            <>
              {list === null && <div className="pv-center" style={{ padding: 20 }}><div className="pv-spinner" /></div>}
              {list && list.length > 0 && (
                <>
                  <p className="pv-muted" style={{ margin: 0, fontSize: 13 }}>Antippen zum Einfügen. Die Größe lässt sich danach in der Notiz an den Ecken ändern.</p>
                  <div className="pv-sig-grid">
                    {list.map(s => (
                      <div key={s.id} className="pv-sig-item">
                        <button className="pv-sig-pick" onClick={() => { onInsert({ src: s.data_url, width: s.width ?? 240, height: s.height ?? 90 }); onClose() }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={s.data_url} alt={s.name} />
                        </button>
                        <div className="pv-row" style={{ gap: 4 }}>
                          <span className="pv-grow pv-ellipsis" style={{ fontSize: 12.5 }}>{s.name}</span>
                          <button
                            className={`pv-btn sm ${armedDelete === s.id ? 'danger' : 'ghost'}`}
                            style={{ minHeight: 28, padding: '2px 8px' }}
                            onClick={() => remove(s)}
                            aria-label={`${s.name} löschen`}
                          >
                            {armedDelete === s.id ? 'Löschen?' : <Icon name="trash" size={14} />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <button className="pv-btn primary" onClick={() => setDrawing(true)}><Icon name="signature" size={17} /> Neue Unterschrift zeichnen</button>
            </>
          )}

          {drawing && (
            <>
              <div className="pv-sig-pad-wrap">
                <canvas
                  ref={canvasRef}
                  className="pv-sig-pad"
                  onPointerDown={down}
                  onPointerMove={move}
                  onPointerUp={up}
                  onPointerCancel={up}
                  onPointerLeave={up}
                />
                <div className="pv-sig-line" aria-hidden="true" />
                {!hasInk && <span className="pv-sig-hint">Hier unterschreiben</span>}
              </div>
              <div className="pv-row pv-wrap" style={{ gap: 10 }}>
                <div className="pv-row" style={{ gap: 6 }}>
                  {INKS.map(i => (
                    <button
                      key={i.color}
                      className={`pv-swatch ${ink === i.color ? 'active' : ''}`}
                      style={{ background: i.color }}
                      aria-label={i.label}
                      title={i.label}
                      onClick={() => setInk(i.color)}
                    />
                  ))}
                </div>
                <div className="pv-seg" role="group" aria-label="Strichstärke">
                  {[2, 3, 4.5].map(t => (
                    <button key={t} className={thickness === t ? 'active' : ''} onClick={() => setThickness(t)}>
                      {t === 2 ? 'Fein' : t === 3 ? 'Mittel' : 'Dick'}
                    </button>
                  ))}
                </div>
                <button className="pv-btn sm" onClick={clear} disabled={!hasInk}><Icon name="eraser" size={15} /> Neu</button>
              </div>
              <input className="pv-input" placeholder="Name (optional), z.B. Kurz oder Voller Name" value={name} onChange={e => setName(e.target.value)} maxLength={60} />
              <div className="pv-modal-actions">
                {list && list.length > 0 && <button className="pv-btn" style={{ marginRight: 'auto' }} onClick={() => setDrawing(false)}>Zurück</button>}
                <button className="pv-btn" onClick={() => saveAndInsert(false)} disabled={!hasInk || saving}>Nur speichern</button>
                <button className="pv-btn primary" onClick={() => saveAndInsert(true)} disabled={!hasInk || saving}>
                  <Icon name="check" size={16} /> Speichern & einfügen
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Portal>
  )
}