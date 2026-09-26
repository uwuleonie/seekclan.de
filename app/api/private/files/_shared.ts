// Gemeinsame Bausteine für alle Quick-Share-Routen (Ordner mit "_" wird von Next.js nicht als Route behandelt).

import { NextResponse } from 'next/server'

/** Spalten, die ans Frontend gehen (storage_key bleibt intern). */
export const FILE_COLS = `
  id, folder_id, original_name, mime_type, size_bytes, kind, has_thumb, width, height,
  source_device, device_id, seen_at, created_at, completed_at, updated_at`

export function parseId(raw: string): number | null {
  return /^\d{1,18}$/.test(raw) ? Number(raw) : null
}

export const forbidden = () => NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
export const notFound = () => NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
export const badRequest = (msg: string) => NextResponse.json({ error: msg }, { status: 400 })

/**
 * Unerwartete Fehler (DB, Festplatte) in eine verständliche Meldung übersetzen.
 * Die Meldung erscheint direkt in der Upload-Anzeige, statt nur "Fehler 500".
 * Details landen zusätzlich im Server-Log (pm2 logs seekclan).
 */
export function serverError(err: unknown, where: string) {
  const e = err as { code?: string; message?: string; path?: string }
  console.error(`Quick Share (${where}):`, err)

  let msg = 'Serverfehler'
  if (e?.code === '42P01') msg = 'Datenbank-Tabelle fehlt – SQL für Quick Share ausführen'
  else if (e?.code === '42703') msg = 'Datenbank-Spalte fehlt – SQL für Quick Share prüfen'
  else if (e?.code === '42501') msg = 'Keine Datenbank-Rechte auf die Quick-Share-Tabellen'
  else if (e?.code === '23503') msg = 'Datenbank-Verknüpfung passt nicht (User oder Ordner)'
  else if (e?.code === '22P02') msg = 'Datenbank-Typ passt nicht (z.B. User-ID ist keine UUID)'
  else if (e?.code === 'EACCES' || e?.code === 'EPERM') msg = `Keine Schreibrechte im Upload-Ordner (${e.path ?? 'private-files'})`
  else if (e?.code === 'ENOSPC') msg = 'Server-Festplatte ist voll'
  else if (e?.code === 'ENOENT') msg = `Ordner nicht gefunden (${e.path ?? 'private-files'})`
  else if (e?.message) msg = `Serverfehler: ${e.message.slice(0, 160)}`

  return NextResponse.json({ error: msg, code: e?.code ?? null }, { status: 500 })
}