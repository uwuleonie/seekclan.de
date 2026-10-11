'use client'

// Flagge als Bild. Alle heutigen Flaggen liegen gesammelt in public/geo/flags.json (aus flag-icons, MIT-Lizenz),
// historische Flaggen (Schlüssel beginnt mit "h-") in public/geo/flags-hist.json,
// Flaggen von Regionen (Schlüssel "r:" + ISO-3166-2, z.B. "r:DE-BY") als kleine WebP-Bilder in public/geo/flags-regions.json
// (aus Wikimedia Commons, erzeugt von scripts/geo/build-flaggen-regionen.py).
// Die Dateien werden erst geladen, wenn die erste Flagge daraus gebraucht wird.

import { useEffect, useState } from 'react'

type FlagFile = 'flags' | 'flags-hist' | 'flags-regions'
export const flagFileOf = (code: string): FlagFile => (code.startsWith('h-') ? 'flags-hist' : code.startsWith('r:') ? 'flags-regions' : 'flags')

const loaded: Partial<Record<FlagFile, Record<string, string>>> = {}
const pending: Partial<Record<FlagFile, Promise<Record<string, string>>>> = {}

export function loadFlags(file: FlagFile = 'flags'): Promise<Record<string, string>> {
  const have = loaded[file]
  if (have) return Promise.resolve(have)
  let p = pending[file]
  if (!p) {
    p = fetch(`/geo/${file}.json`)
      .then(r => {
        if (!r.ok) throw new Error(`Flaggen konnten nicht geladen werden (${r.status})`)
        return r.json()
      })
      .then((f: Record<string, string>) => (loaded[file] = f))
      .catch(e => { delete pending[file]; throw e })
    pending[file] = p
  }
  return p
}

/** SVG-Text oder fertige Bild-Adresse (data:image/webp…) → Bildquelle */
export const flagSrc = (svg: string) => (svg.startsWith('data:') ? svg : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)

/** Wie flagSrc, aber die Flagge füllt ihr Feld immer ganz aus (wird beschnitten statt mit leeren Rändern verkleinert).
 *  Nötig für die Kartenansicht „Flaggen“: Die SVG-Flaggen bringen ihr eigenes Seitenverhältnis mit (viewBox) –
 *  ohne diesen Zusatz zeigen Browser sie darin „eingepasst“ mit leeren Streifen an. */
export const flagFillSrc = (svg: string) => {
  if (svg.startsWith('data:')) return svg
  const filled = svg.replace(/<svg\b[^>]*>/, tag => {
    const clean = tag.replace(/\s(?:preserveAspectRatio|width|height)="[^"]*"/g, '')
    return clean.replace(/^<svg\b/, '<svg preserveAspectRatio="xMidYMid slice" width="100%" height="100%"')
  })
  return flagSrc(filled)
}

export default function Flag({ code, size = 'md', className = '' }: { code: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const file = flagFileOf(code)
  const [all, setAll] = useState<Record<string, string> | null>(loaded[file] ?? null)
  useEffect(() => {
    if (all) return
    let alive = true
    loadFlags(file).then(f => { if (alive) setAll(f) }).catch(() => { /* Platzhalter bleibt */ })
    return () => { alive = false }
  }, [all, file])
  const svg = all?.[code]
  if (!svg) return <span className={`ga-flag ${size} ph ${className}`} aria-hidden="true" />
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={`ga-flag ${size} ${file === 'flags-regions' ? 'rg' : ''} ${className}`} src={flagSrc(svg)} alt="Flagge" draggable={false} />
}