'use client'

// Verkleinert/komprimiert Bilder direkt im Browser, BEVOR sie hochgeladen werden.
// Grund: nginx vor unserem Server (Timons Konfiguration) limitiert die Request-Größe
// auf ca. 1 MB ("413 Content Too Large"). Da wir darauf aktuell keinen Zugriff haben,
// verkleinern wir Bilder clientseitig auf eine sichere Größe, bevor sie überhaupt
// gesendet werden.
//
// Nutzt die Canvas-API (in jedem modernen Browser eingebaut, keine Library nötig).

const MAX_DIMENSION = 1600 // längste Seite in Pixeln
const TARGET_MAX_BYTES = 900 * 1024 // 900 KB Sicherheitsmarge unter dem ~1MB-Limit
const JPEG_QUALITY_STEPS = [0.92, 0.85, 0.75, 0.65, 0.55, 0.45, 0.35]

/**
 * Komprimiert eine Bilddatei clientseitig. Gibt die Originaldatei unverändert zurück,
 * wenn sie bereits klein genug ist oder wenn es sich nicht um ein unterstütztes
 * Bildformat handelt (z.B. GIF — Animation würde sonst zerstört werden).
 */
export async function compressImageFile(file: File): Promise<File> {
  // Animierte GIFs nicht anfassen (Canvas würde nur das erste Frame rendern).
  if (file.type === 'image/gif') return file

  // Bereits klein genug? Dann nichts tun.
  if (file.size <= TARGET_MAX_BYTES) return file

  try {
    const bitmap = await createImageBitmap(file)
    const { width, height } = scaledDimensions(bitmap.width, bitmap.height, MAX_DIMENSION)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file

    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    // PNGs mit Transparenz bleiben PNG (kein Qualitätsverlust durch Format-Wechsel bei
    // kleinen Dateien), alles andere wird als JPEG komprimiert (deutlich kleiner).
    const keepPng = file.type === 'image/png' && (await hasTransparency(canvas, ctx))

    if (keepPng) {
      const blob = await canvasToBlob(canvas, 'image/png')
      if (blob && blob.size < file.size) {
        return new File([blob], renameExt(file.name, 'png'), { type: 'image/png' })
      }
      return file
    }

    // JPEG-Qualität schrittweise reduzieren, bis die Datei unter dem Ziel-Limit liegt.
    for (const quality of JPEG_QUALITY_STEPS) {
      const blob = await canvasToBlob(canvas, 'image/jpeg', quality)
      if (blob && blob.size <= TARGET_MAX_BYTES) {
        return new File([blob], renameExt(file.name, 'jpg'), { type: 'image/jpeg' })
      }
    }

    // Letzter Versuch mit niedrigster Qualität, auch wenn das Ziel-Limit knapp verfehlt wird —
    // immer noch besser als die unkomprimierte Originaldatei.
    const fallbackBlob = await canvasToBlob(canvas, 'image/jpeg', 0.3)
    if (fallbackBlob && fallbackBlob.size < file.size) {
      return new File([fallbackBlob], renameExt(file.name, 'jpg'), { type: 'image/jpeg' })
    }

    return file
  } catch (err) {
    console.error('Bildkomprimierung fehlgeschlagen, sende Original:', err)
    return file
  }
}

function scaledDimensions(width: number, height: number, maxDim: number) {
  if (width <= maxDim && height <= maxDim) return { width, height }
  const ratio = width > height ? maxDim / width : maxDim / height
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality))
}

function renameExt(filename: string, newExt: string): string {
  const base = filename.includes('.') ? filename.slice(0, filename.lastIndexOf('.')) : filename
  return `${base}.${newExt}`
}

async function hasTransparency(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): Promise<boolean> {
  // Nur eine Stichprobe prüfen (Performance) — reicht für die meisten Badge-Icons.
  const sampleSize = Math.min(canvas.width, canvas.height, 100)
  const data = ctx.getImageData(0, 0, sampleSize, sampleSize).data
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true
  }
  return false
}