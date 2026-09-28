import { NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { MAX_HTML_BYTES, htmlToPlain, sanitizeRichHtml } from '@/app/lib/rich-html'

// Gemeinsame Helfer für die Notizen-Routen (nur Leonie)

/** Spalten für die Notizliste – ohne den (evtl. großen) formatierten Inhalt */
export const NOTE_LIST_COLS = `id, folder_id, title, content, paper, pinned, created_at, updated_at`
/** Spalten für eine einzelne, geöffnete Notiz */
export const NOTE_FULL_COLS = `${NOTE_LIST_COLS}, content_html`

export const PAPERS = ['plain', 'lined', 'grid'] as const

export const FOLDER_COLS = `id, name, color, sort_order, parent_id, created_at`

export function notesError(err: unknown, where: string) {
  const e = err as { code?: string; message?: string; status?: number }
  if (e?.status === 400) return NextResponse.json({ error: e.message }, { status: 400 })
  console.error(`Notizen (${where}):`, err)
  let msg = 'Serverfehler'
  if (e?.code === '42P01') msg = `Datenbank-Tabelle fehlt – SQL für Phase 2 ausführen (${(e.message || '').replace(/^relation /, '')})`
  else if (e?.code === '42703') msg = `Datenbank-Spalte fehlt – SQL für Phase 2 ausführen (${e.message})`
  else if (e?.code === '23503') msg = 'Ordner existiert nicht mehr'
  else if (e?.code === '23514') msg = 'Ungültiger Wert'
  else if (e?.message) msg = `Serverfehler: ${e.message.slice(0, 160)}`
  return NextResponse.json({ error: msg, code: e?.code ?? null }, { status: 500 })
}

export function badInput(message: string) {
  return Object.assign(new Error(message), { status: 400 })
}

export function parseId(raw: string): number | null {
  return /^\d{1,18}$/.test(raw) ? Number(raw) : null
}

/**
 * Felder einer Notiz aus dem Request lesen und prüfen.
 * Formatierter Inhalt (content_html) wird gereinigt; der Klartext (content)
 * dient für Suche, Vorschau und TXT-Export.
 */
export function readNoteFields(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  if (typeof body.title === 'string') out.title = body.title.trim().slice(0, 300) || 'Ohne Titel'
  if (typeof body.content_html === 'string') {
    if (Buffer.byteLength(body.content_html) > MAX_HTML_BYTES) throw badInput('Notiz ist zu groß (max. 6 MB)')
    const clean = sanitizeRichHtml(body.content_html)
    out.content_html = clean
    out.content = typeof body.content === 'string' ? body.content.slice(0, 1_000_000) : htmlToPlain(clean)
  } else if (typeof body.content === 'string') {
    out.content = body.content.slice(0, 1_000_000)
  }
  if ('paper' in body) {
    if (!PAPERS.includes(body.paper as (typeof PAPERS)[number])) throw badInput('Unbekannte Vorlage')
    out.paper = body.paper
  }
  if ('pinned' in body) out.pinned = body.pinned === true
  if ('folder_id' in body) {
    const f = body.folder_id
    if (f === null || f === '' || f === undefined) out.folder_id = null
    else if (Number.isSafeInteger(Number(f))) out.folder_id = Number(f)
    else throw badInput('Ungültiger Ordner')
  }
  return out
}

/** IDs eines Ordners und aller Unterordner (für Zyklus-Prüfung beim Verschieben) */
export async function folderDescendants(id: number): Promise<number[]> {
  const r = await pool.query(
    `WITH RECURSIVE t AS (
       SELECT id FROM leonie_folders WHERE id = $1
       UNION ALL
       SELECT f.id FROM leonie_folders f JOIN t ON f.parent_id = t.id
     ) SELECT id FROM t`,
    [id]
  )
  return r.rows.map(x => Number(x.id))
}