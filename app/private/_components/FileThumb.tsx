'use client'

// Vorschaubild für eine Quick-Share-Datei.
// Reihenfolge bei Bildern:
//   1. kleines WebP-Vorschaubild vom Server (/thumb – wird dort bei Bedarf nacherzeugt)
//   2. klappt das nicht: das Originalbild, wenn der Browser es anzeigen kann (JPG, PNG, GIF, WebP, AVIF, BMP)
//   3. sonst: Symbol für den Dateityp
// Andere Dateitypen bekommen direkt das Symbol.

import { useState } from 'react'
import Icon from './Icon'
import { KIND_ICON, fileUrl, thumbUrl, type PFile } from '../_lib/files'

const BROWSER_IMAGE = /^image\/(jpeg|png|gif|webp|avif|bmp)$/

type Props = {
  file: Pick<PFile, 'id' | 'kind' | 'mime_type'>
  /** Größe des Symbols, falls kein Bild angezeigt werden kann */
  iconSize?: number
  alt?: string
}

export default function FileThumb({ file, iconSize = 38, alt = '' }: Props) {
  // 0 = Vorschaubild, 1 = Original, 2 = Symbol
  const [stage, setStage] = useState<0 | 1 | 2>(0)

  if (file.kind !== 'image' || stage === 2) {
    return <Icon name={KIND_ICON[file.kind]} size={iconSize} stroke={1.4} />
  }

  const src = stage === 0 ? thumbUrl(file.id) : fileUrl(file.id, true)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={stage}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setStage(s => (s === 0 && BROWSER_IMAGE.test(file.mime_type) ? 1 : 2))}
    />
  )
}

/** Soll unter dem Bild die Dateiendung (z.B. "PDF") stehen? Nur bei Nicht-Bildern und Nicht-Videos. */
export const showsExtension = (file: Pick<PFile, 'kind'>) => file.kind !== 'image' && file.kind !== 'video'