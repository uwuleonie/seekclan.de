'use client'

// Verkleinert/komprimiert Bilder direkt im Browser, BEVOR sie hochgeladen werden.
// Nutzt die Canvas-API (in jedem modernen Browser eingebaut, keine Library nötig).

// Verschiedene Max-Dimensionen je nach Verwendungszweck
const DIMS: Record<string, number> = {
  avatar:     512,   // Profilbild — klein, quadratisch
  banner:     2560,  // Banner — volle Breite, hoch auflösen
  background: 2560,  // Hintergrundbild — volle Breite
  default:    1920,
}
const TARGET_MAX_BYTES = 3 * 1024 * 1024  // 3 MB
const JPEG_QUALITY_STEPS = [0.95, 0.90, 0.85, 0.80, 0.75, 0.70, 0.65, 0.60]

/**
 * Komprimiert eine Bilddatei clientseitig.
 * GIF, WebP und MP4 werden unverändert durchgereicht.
 */
export async function compressImageFile(file: File, kind?: string): Promise<File> {
  if (
    file.type === 'image/gif' ||
    file.type === 'image/webp' ||
    file.type === 'video/mp4'
  ) return file

  if (file.size <= TARGET_MAX_BYTES) return file

  const maxDim = DIMS[kind ?? 'default'] ?? DIMS.default

  try {
    const bitmap = await createImageBitmap(file)
    const { width, height } = scaledDimensions(bitmap.width, bitmap.height, maxDim)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file

    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const keepPng = file.type === 'image/png' && (await hasTransparency(canvas, ctx))

    if (keepPng) {
      let pngBlob = await canvasToBlob(canvas, 'image/png')
      let cw = width, ch = height, attempts = 0
      while (pngBlob && pngBlob.size > TARGET_MAX_BYTES && attempts < 6 && Math.min(cw, ch) > 64) {
        cw = Math.round(cw * 0.8); ch = Math.round(ch * 0.8)
        const sc = document.createElement('canvas'); sc.width = cw; sc.height = ch
        const sctx = sc.getContext('2d'); if (!sctx) break
        sctx.drawImage(canvas, 0, 0, cw, ch)
        pngBlob = await canvasToBlob(sc, 'image/png')
        attempts++
      }
      if (pngBlob && pngBlob.size < file.size)
        return new File([pngBlob], renameExt(file.name, 'png'), { type: 'image/png' })
      return file
    }

    for (const quality of JPEG_QUALITY_STEPS) {
      const blob = await canvasToBlob(canvas, 'image/jpeg', quality)
      if (blob && blob.size <= TARGET_MAX_BYTES)
        return new File([blob], renameExt(file.name, 'jpg'), { type: 'image/jpeg' })
    }

    const fallback = await canvasToBlob(canvas, 'image/jpeg', 0.55)
    if (fallback && fallback.size < file.size)
      return new File([fallback], renameExt(file.name, 'jpg'), { type: 'image/jpeg' })

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
  const sampleSize = Math.min(canvas.width, canvas.height, 100)
  const data = ctx.getImageData(0, 0, sampleSize, sampleSize).data
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true
  }
  return false
}

export async function convertToPng(file: File, maxDimension = 512, targetMaxBytes = 400 * 1024): Promise<File> {
  const bitmap = await createImageBitmap(file)
  let width = bitmap.width, height = bitmap.height
  if (width > maxDimension || height > maxDimension) {
    const ratio = width > height ? maxDimension / width : maxDimension / height
    width = Math.round(width * ratio); height = Math.round(height * ratio)
  }
  let canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
  let ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas-Kontext nicht verfügbar')
  ctx.drawImage(bitmap, 0, 0, width, height); bitmap.close()
  let blob = await canvasToBlob(canvas, 'image/png')
  let attempts = 0
  while (blob && blob.size > targetMaxBytes && attempts < 6 && Math.min(width, height) > 32) {
    width = Math.round(width * 0.75); height = Math.round(height * 0.75)
    const smaller = document.createElement('canvas'); smaller.width = width; smaller.height = height
    const sc = smaller.getContext('2d'); if (!sc) break
    sc.drawImage(canvas, 0, 0, width, height); canvas = smaller
    blob = await canvasToBlob(canvas, 'image/png'); attempts++
  }
  if (!blob) throw new Error('PNG-Konvertierung fehlgeschlagen')
  return new File([blob], renameExt(file.name, 'png'), { type: 'image/png' })
}