'use client'

// Zeigt ALLE Seiten eines PDFs untereinander an (für Notiz-Anhänge).
// - Nutzt pdf.js (npm-Paket "pdfjs-dist"), läuft komplett im Browser
// - Seiten werden erst gezeichnet, wenn sie in die Nähe des Bildschirms kommen
//   → auch PDFs mit 100+ Seiten bleiben flüssig
// - Schärfe passt sich an Breite und Bildschirm (Retina) an

import { useEffect, useRef, useState } from 'react'

type PdfDoc = import('pdfjs-dist').PDFDocumentProxy
type PdfLib = typeof import('pdfjs-dist')

let libPromise: Promise<PdfLib> | null = null

/** pdf.js nur einmal laden (erst wenn wirklich ein PDF angezeigt wird). */
function loadPdfJs(): Promise<PdfLib> {
  if (!libPromise) {
    libPromise = import('pdfjs-dist/legacy/build/pdf.mjs').then(mod => {
      const lib = mod as unknown as PdfLib
      if (!lib.GlobalWorkerOptions.workerPort) {
        lib.GlobalWorkerOptions.workerPort = new Worker(
          new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url),
          { type: 'module' }
        )
      }
      return lib
    })
  }
  return libPromise
}

export default function PdfPages({ url, onPageClick }: { url: string; onPageClick?: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [doc, setDoc] = useState<PdfDoc | null>(null)
  const [ratios, setRatios] = useState<number[]>([])
  const [error, setError] = useState(false)
  const [width, setWidth] = useState(0)

  /* Dokument laden + Seitenverhältnisse aller Seiten bestimmen (für Platzhalter) */
  useEffect(() => {
    let cancelled = false
    let task: ReturnType<PdfLib['getDocument']> | null = null
    setDoc(null)
    setRatios([])
    setError(false)
    loadPdfJs()
      .then(lib => {
        task = lib.getDocument({ url, withCredentials: true })
        return task.promise
      })
      .then(async d => {
        if (cancelled) return
        const r: number[] = []
        for (let i = 1; i <= d.numPages; i++) {
          const page = await d.getPage(i)
          const vp = page.getViewport({ scale: 1 })
          r.push(vp.height / vp.width)
          if (cancelled) return
        }
        setRatios(r)
        setDoc(d)
      })
      .catch(err => {
        if (cancelled) return
        console.error('PDF konnte nicht geladen werden', err)
        setError(true)
      })
    return () => {
      cancelled = true
      // Ladeauftrag beenden gibt auch das Dokument im Worker wieder frei
      ;(task as ReturnType<PdfLib['getDocument']> | null)?.destroy().catch(() => {})
    }
  }, [url])

  /* Breite verfolgen */
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(Math.round(el.getBoundingClientRect().width)))
    ro.observe(el)
    setWidth(Math.round(el.getBoundingClientRect().width))
    return () => ro.disconnect()
  }, [])

  if (error) {
    return (
      <div className="pv-pdf-error">
        PDF kann hier nicht angezeigt werden.{' '}
        <a href={url} target="_blank" rel="noopener noreferrer" className="pv-link">Öffnen</a>
      </div>
    )
  }

  return (
    <div ref={wrapRef} className="pv-pdf">
      {!doc && <div className="pv-pdf-page loading" style={{ aspectRatio: '1 / 1.414' }}><div className="pv-spinner" /></div>}
      {doc && ratios.map((ratio, i) => (
        <PdfPage key={i} doc={doc} pageNumber={i + 1} ratio={ratio} width={width} onClick={onPageClick} total={ratios.length} />
      ))}
    </div>
  )
}

function PdfPage({
  doc, pageNumber, ratio, width, onClick, total,
}: { doc: PdfDoc; pageNumber: number; ratio: number; width: number; onClick?: () => void; total: number }) {
  const holder = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [visible, setVisible] = useState(false)
  const renderedAt = useRef(0)

  /* Erst zeichnen, wenn die Seite in die Nähe kommt */
  useEffect(() => {
    const el = holder.current
    if (!el) return
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        setVisible(true)
        io.disconnect()
      }
    }, { rootMargin: '900px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!visible || !width || !canvasRef.current) return
    // Nicht bei jeder Mini-Größenänderung neu zeichnen
    if (renderedAt.current && Math.abs(renderedAt.current - width) < 40) return
    let task: { cancel: () => void; promise: Promise<void> } | null = null
    let cancelled = false
    doc.getPage(pageNumber).then(page => {
      if (cancelled || !canvasRef.current) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5)
      const base = page.getViewport({ scale: 1 })
      const scale = Math.min((width * dpr) / base.width, 2400 / base.width)
      const viewport = page.getViewport({ scale })
      const canvas = canvasRef.current
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      task = page.render({ canvas, viewport })
      task.promise.then(() => { renderedAt.current = width }).catch(() => {})
    })
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [visible, width, doc, pageNumber])

  return (
    <div ref={holder} className="pv-pdf-page" style={{ aspectRatio: `1 / ${ratio}` }} onClick={onClick}>
      <canvas ref={canvasRef} aria-label={`Seite ${pageNumber} von ${total}`} />
      {total > 1 && <span className="pv-pdf-num">{pageNumber} / {total}</span>}
    </div>
  )
}