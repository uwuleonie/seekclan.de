import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin } from '@/app/lib/csrf'
import { getPrivateUser, type PrivateUser } from '@/app/lib/private-auth'

// Baukasten für die Planer-APIs (Kalender, Reminder, Wecker, Stundenplan …).
// Jede Tabelle wird einmal beschrieben (Felder + Typen), daraus entstehen automatisch
// sichere Routen für Liste/Anlegen/Ändern/Löschen:
//  - nur eingeloggte administrator/owner
//  - jeder sieht und ändert nur SEINE Einträge (user_id)
//  - alle Werte werden geprüft, bevor sie in die Datenbank gehen
//  - Verknüpfungen (z.B. Fach, Liste) müssen ebenfalls dem eigenen Account gehören

export type Field =
  | { type: 'text'; max?: number; required?: boolean }
  | { type: 'int'; min?: number; max?: number; required?: boolean; nullable?: boolean; default?: number }
  | { type: 'bool'; default?: boolean }
  | { type: 'ts'; required?: boolean }
  | { type: 'date'; required?: boolean }
  | { type: 'time'; required?: boolean }
  | { type: 'enum'; values: readonly string[]; required?: boolean }
  | { type: 'intarr'; min?: number; max?: number }
  | { type: 'fk'; table: string; required?: boolean }
  | { type: 'color' }
  | { type: 'url' }

export type Row = Record<string, unknown>

export interface ResourceDef {
  table: string
  label: string // für Fehlermeldungen, z.B. "Termin"
  fields: Record<string, Field>
  orderBy: string
  /** Zusätzliche Filter für die Liste aus der URL (z.B. ?from=…&to=…) */
  listFilter?: (sp: URLSearchParams, next: (v: unknown) => string) => string[]
  /** Letzte Anpassungen vor dem Speichern (z.B. nächste Weckzeit berechnen) */
  prepare?: (data: Row, ctx: { user: PrivateUser; existing: Row | null }) => Promise<Row> | Row
  /** Nach dem Speichern/Löschen (z.B. Glocke aktualisieren) */
  after?: (row: Row, action: 'create' | 'update' | 'delete', user: PrivateUser) => Promise<void> | void
}

/** Für verständliche 400-Fehler aus prepare()-Funktionen */
export class ValidationError extends Error {}

const TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/
const COLOR_RE = /^#[0-9a-f]{6}$/i

async function coerce(name: string, f: Field, v: unknown, user: PrivateUser): Promise<unknown> {
  const empty = v === null || v === undefined || v === ''
  if (empty) {
    if ('required' in f && f.required) throw new ValidationError(`${name} fehlt`)
    if (f.type === 'bool') return f.default ?? false
    if (f.type === 'intarr') return []
    if (f.type === 'int' && f.default !== undefined) return f.default
    return null
  }
  switch (f.type) {
    case 'text': {
      const s = String(v).trim()
      if (f.required && !s) throw new ValidationError(`${name} fehlt`)
      return s.slice(0, f.max ?? 2000)
    }
    case 'int': {
      const n = Number(v)
      if (!Number.isInteger(n)) throw new ValidationError(`${name} ist keine Zahl`)
      if (f.min !== undefined && n < f.min) throw new ValidationError(`${name} zu klein`)
      if (f.max !== undefined && n > f.max) throw new ValidationError(`${name} zu groß`)
      return n
    }
    case 'bool': return v === true || v === 'true' || v === 1
    case 'ts': {
      if (typeof v !== 'string' || !TS_RE.test(v) || Number.isNaN(Date.parse(v))) throw new ValidationError(`${name}: ungültiger Zeitpunkt`)
      return new Date(v).toISOString()
    }
    case 'date':
      if (typeof v !== 'string' || !DATE_RE.test(v)) throw new ValidationError(`${name}: ungültiges Datum`)
      return v
    case 'time':
      if (typeof v !== 'string' || !TIME_RE.test(v)) throw new ValidationError(`${name}: ungültige Uhrzeit`)
      return v.length === 4 ? `0${v}` : v.slice(0, 5)
    case 'enum':
      if (!f.values.includes(String(v))) throw new ValidationError(`${name}: ungültiger Wert`)
      return String(v)
    case 'intarr': {
      if (!Array.isArray(v)) throw new ValidationError(`${name}: Liste erwartet`)
      const arr = [...new Set(v.map(Number))].filter(n => Number.isInteger(n))
      if (arr.some(n => (f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max))) {
        throw new ValidationError(`${name}: ungültiger Wert`)
      }
      return arr.sort((a, b) => a - b)
    }
    case 'color':
      if (typeof v !== 'string' || !COLOR_RE.test(v)) throw new ValidationError(`${name}: ungültige Farbe`)
      return v.toLowerCase()
    case 'url': {
      const s = String(v).trim().slice(0, 2000)
      if (!/^https?:\/\//i.test(s)) throw new ValidationError(`${name}: Link muss mit http(s):// beginnen`)
      return s
    }
    case 'fk': {
      const id = Number(v)
      if (!Number.isSafeInteger(id) || id <= 0) throw new ValidationError(`${name}: ungültig`)
      // Tabellenname kommt ausschließlich aus unseren Definitionen, nie aus der Anfrage
      const r = await pool.query(`SELECT 1 FROM ${f.table} WHERE id = $1 AND user_id = $2`, [id, user.id])
      if (!r.rows[0]) throw new ValidationError(`${name}: nicht gefunden`)
      return id
    }
  }
}

async function readBody(req: NextRequest): Promise<Row> {
  const b = await req.json().catch(() => null)
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw new ValidationError('Ungültige Anfrage')
  return b as Row
}

async function validate(def: ResourceDef, body: Row, user: PrivateUser, partial: boolean): Promise<Row> {
  const out: Row = {}
  for (const [name, f] of Object.entries(def.fields)) {
    if (partial && !(name in body)) continue
    out[name] = await coerce(name, f, body[name], user)
  }
  return out
}

/** Einheitliche, verständliche Fehlermeldungen (erscheinen in der Oberfläche) */
export function apiError(err: unknown, where: string) {
  if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 })
  const e = err as { code?: string; message?: string }
  console.error(`Privatbereich (${where}):`, err)
  let msg = 'Serverfehler'
  if (e?.code === '42P01') msg = `Datenbank-Tabelle fehlt – bitte das SQL der passenden Phase ausführen (${(e.message || '').replace(/^relation /, '')})`
  else if (e?.code === '42703') msg = `Datenbank-Spalte fehlt – SQL prüfen (${e.message})`
  else if (e?.code === '42501') msg = 'Keine Datenbank-Rechte auf diese Tabelle'
  else if (e?.code === '23503') msg = 'Verknüpfung passt nicht (Eintrag existiert nicht mehr)'
  else if (e?.code === '23505') msg = 'Diesen Eintrag gibt es schon'
  else if (e?.message) msg = `Serverfehler: ${e.message.slice(0, 160)}`
  return NextResponse.json({ error: msg, code: e?.code ?? null }, { status: 500 })
}

export const forbidden = () => NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
export const csrf = () => NextResponse.json({ error: 'CSRF' }, { status: 403 })

function parseId(raw: string): number | null {
  return /^\d{1,18}$/.test(raw) ? Number(raw) : null
}

type IdCtx = { params: Promise<{ id: string }> }

/**
 * node-postgres macht aus DATE-Spalten ein Date-Objekt um Mitternacht (Server-Zeitzone).
 * Beim Versand als JSON kann sich dadurch der Tag verschieben → hier als "YYYY-MM-DD" zurückgeben.
 */
export function toDateKey(v: unknown): string | null {
  if (v === null || v === undefined) return null
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
  }
  return String(v).slice(0, 10)
}

function normalize(def: ResourceDef, row: Row): Row {
  if (!row) return row
  for (const [k, f] of Object.entries(def.fields)) {
    if (f.type === 'date' && k in row) row[k] = toDateKey(row[k])
    if (f.type === 'time' && typeof row[k] === 'string') row[k] = (row[k] as string).slice(0, 5)
  }
  return row
}

export function resource(def: ResourceDef) {
  const cols = Object.keys(def.fields)

  async function list(req: NextRequest) {
    try {
      const user = await getPrivateUser(req)
      if (!user) return forbidden()
      const params: unknown[] = [user.id]
      const next = (v: unknown) => { params.push(v); return `$${params.length}` }
      const where = ['user_id = $1', ...(def.listFilter?.(req.nextUrl.searchParams, next) ?? [])]
      const r = await pool.query(`SELECT * FROM ${def.table} WHERE ${where.join(' AND ')} ORDER BY ${def.orderBy}`, params)
      return NextResponse.json(r.rows.map(row => normalize(def, row)), { headers: { 'Cache-Control': 'no-store' } })
    } catch (err) {
      return apiError(err, `GET ${def.table}`)
    }
  }

  async function create(req: NextRequest) {
    try {
      if (!checkOrigin(req)) return csrf()
      const user = await getPrivateUser(req)
      if (!user) return forbidden()
      let data = await validate(def, await readBody(req), user, false)
      if (def.prepare) data = await def.prepare(data, { user, existing: null })
      const keys = Object.keys(data)
      const values = keys.map(k => data[k])
      const r = await pool.query(
        `INSERT INTO ${def.table} (user_id, ${keys.join(', ')})
         VALUES ($1, ${keys.map((_, i) => `$${i + 2}`).join(', ')})
         RETURNING *`,
        [user.id, ...values]
      )
      await def.after?.(r.rows[0], 'create', user)
      return NextResponse.json(normalize(def, r.rows[0]))
    } catch (err) {
      return apiError(err, `POST ${def.table}`)
    }
  }

  async function update(req: NextRequest, { params }: IdCtx) {
    try {
      if (!checkOrigin(req)) return csrf()
      const user = await getPrivateUser(req)
      if (!user) return forbidden()
      const id = parseId((await params).id)
      if (!id) return NextResponse.json({ error: `${def.label} nicht gefunden` }, { status: 404 })
      const existing = (await pool.query(`SELECT * FROM ${def.table} WHERE id = $1 AND user_id = $2`, [id, user.id])).rows[0]
      if (!existing) return NextResponse.json({ error: `${def.label} nicht gefunden` }, { status: 404 })

      let data = await validate(def, await readBody(req), user, true)
      if (def.prepare) data = await def.prepare(data, { user, existing })
      const keys = Object.keys(data).filter(k => cols.includes(k) || k in existing)
      if (!keys.length) return NextResponse.json(normalize(def, existing))

      const r = await pool.query(
        `UPDATE ${def.table} SET ${keys.map((k, i) => `${k} = $${i + 3}`).join(', ')}, updated_at = NOW()
         WHERE id = $1 AND user_id = $2 RETURNING *`,
        [id, user.id, ...keys.map(k => data[k])]
      )
      await def.after?.(r.rows[0], 'update', user)
      return NextResponse.json(normalize(def, r.rows[0]))
    } catch (err) {
      return apiError(err, `PATCH ${def.table}`)
    }
  }

  async function remove(req: NextRequest, { params }: IdCtx) {
    try {
      if (!checkOrigin(req)) return csrf()
      const user = await getPrivateUser(req)
      if (!user) return forbidden()
      const id = parseId((await params).id)
      if (!id) return NextResponse.json({ error: `${def.label} nicht gefunden` }, { status: 404 })
      const r = await pool.query(`DELETE FROM ${def.table} WHERE id = $1 AND user_id = $2 RETURNING *`, [id, user.id])
      if (!r.rows[0]) return NextResponse.json({ error: `${def.label} nicht gefunden` }, { status: 404 })
      await def.after?.(r.rows[0], 'delete', user)
      return NextResponse.json({ ok: true })
    } catch (err) {
      return apiError(err, `DELETE ${def.table}`)
    }
  }

  return { list, create, update, remove }
}