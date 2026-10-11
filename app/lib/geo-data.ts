import { promises as fs } from 'fs'
import path from 'path'
import { pool } from '@/app/lib/db'
import { CATALOG, CATALOG_BY_SLUG, bySort, isBuilt } from '@/app/geo/_lib/catalog'
import { berlinDay, cleanPlan, planQueue, planSlots, type PlanConfig } from '@/app/geo/_lib/plan'
import { itemCount } from '@/app/geo/_lib/items'
import { DEFAULT_CONFIG, boostFactor, defaultDifficulty, levelOf, mergeConfig, type BoostInfo, type Difficulty, type GeoConfig, type LevelInfo } from '@/app/geo/_lib/xp'
import type { QuizDef } from '@/app/geo/_lib/types'

// Server-Daten für seekclan.de/geo: Einstellungen, Überschreibungen aus dem Adminpanel, Einträge der Quizzes, XP vergeben.

/* ───────────── kleiner Zwischenspeicher (Einstellungen ändern sich selten) ───────────── */

const memo = new Map<string, { t: number; v: Promise<unknown> }>()
function cached<T>(key: string, ms: number, fn: () => Promise<T>): Promise<T> {
  const hit = memo.get(key)
  if (hit && Date.now() - hit.t < ms) return hit.v as Promise<T>
  const v = fn().catch(e => { memo.delete(key); throw e })
  memo.set(key, { t: Date.now(), v })
  return v
}
/** Nach Änderungen im Adminpanel: alles neu lesen */
export const clearGeoCache = () => memo.clear()

/* ───────────── Einstellungen ───────────── */

export function loadConfig(): Promise<GeoConfig> {
  return cached('config', 15000, async () => {
    try {
      const r = await pool.query(`SELECT value FROM geo_settings WHERE key = 'config'`)
      return mergeConfig(r.rows[0]?.value)
    } catch {
      return DEFAULT_CONFIG
    }
  })
}

/* ───────────── Überschreibungen pro Quiz / Bereich / Abschnitt / Land ───────────── */

export interface QuizMetaRow {
  slug: string
  title: string | null
  meta: string | null
  description: string | null
  difficulty: Difficulty | null
  sort: number | null
  visibility: 'all' | 'roles' | 'admins'
  roles: string[]
  modes: Record<string, unknown>
  xp: { item?: number; factor?: number; perfect?: number; off?: boolean }
  popular: number | null
}
export interface GroupMetaRow {
  kind: 'bereich' | 'section' | 'country'
  key: string
  title: string | null
  description: string | null
  sort: number | null
  release_at: string | null
  visibility: 'all' | 'roles' | 'admins'
  roles: string[]
}

export function loadQuizMeta(): Promise<Record<string, QuizMetaRow>> {
  return cached('quizMeta', 15000, async () => {
    try {
      const r = await pool.query('SELECT slug, title, meta, description, difficulty, sort, visibility, roles, modes, xp, popular FROM geo_quiz_meta')
      return Object.fromEntries(r.rows.map((x: QuizMetaRow) => [x.slug, x]))
    } catch {
      return {}
    }
  })
}

export function loadGroupMeta(): Promise<GroupMetaRow[]> {
  return cached('groupMeta', 15000, async () => {
    try {
      const r = await pool.query('SELECT kind, key, title, description, sort, release_at, visibility, roles FROM geo_group_meta')
      return r.rows.map((x: GroupMetaRow & { release_at: Date | null }) => ({ ...x, release_at: x.release_at ? new Date(x.release_at).toISOString() : null }))
    } catch {
      return []
    }
  })
}

export function loadBoosts(): Promise<BoostInfo[]> {
  return cached('boosts', 10000, async () => {
    try {
      // Laufende und kommende, dazu die der letzten 60 Tage (für den Kalender)
      const r = await pool.query(`SELECT id, label, factor, starts_at, ends_at FROM geo_boosts WHERE ends_at > now() - interval '60 days' ORDER BY starts_at`)
      return r.rows.map((b: { id: number; label: string; factor: string; starts_at: Date; ends_at: Date }) => ({
        id: Number(b.id), label: b.label, factor: Number(b.factor), startsAt: new Date(b.starts_at).toISOString(), endsAt: new Date(b.ends_at).toISOString(),
      }))
    } catch {
      return []
    }
  })
}

/* ───────────── Einträge der Quizzes (für die Prüfung beim XP-Vergeben) ───────────── */

const fileCache = new Map<string, Promise<Record<string, { key: string }[]>>>()
function readItemsFile(file: string) {
  let p = fileCache.get(file)
  if (!p) {
    p = fs.readFile(path.join(process.cwd(), 'public', 'geo', 'items', `${file}.json`), 'utf8').then(t => JSON.parse(t))
    p.catch(() => fileCache.delete(file))
    fileCache.set(file, p)
  }
  return p
}

const keyCache = new Map<string, Promise<Set<string>>>()
/** Alle Eintrags-Schlüssel eines Quiz */
export function quizKeys(slug: string): Promise<Set<string>> {
  let p = keyCache.get(slug)
  if (!p) {
    p = (async () => {
      const e = CATALOG_BY_SLUG[slug]
      if (!isBuilt(e)) return new Set<string>()
      if (e.items.length) return new Set(e.items.map(i => i.key))
      if (!e.itemsFile) return new Set<string>()
      const all = await readItemsFile(e.itemsFile)
      return new Set((all[slug] ?? []).map(i => i.key))
    })()
    p.catch(() => keyCache.delete(slug))
    keyCache.set(slug, p)
  }
  return p
}

/** Schwierigkeit eines Quiz (Adminpanel, sonst Standard) */
export function difficultyOf(slug: string, meta: Record<string, QuizMetaRow>): Difficulty {
  const m = meta[slug]?.difficulty
  if (m) return m
  const e = CATALOG_BY_SLUG[slug]
  return e ? defaultDifficulty(e, isBuilt(e) ? itemCount(e as QuizDef) : 0) : 'mittel'
}

/* ───────────── Profil ───────────── */

export interface GeoProfile { xp: number; hidden: boolean; xpFactor: number; level: LevelInfo }

export async function loadProfile(userId: string, cfg: GeoConfig): Promise<GeoProfile> {
  const r = await pool.query('SELECT xp, hidden, xp_factor FROM geo_profile WHERE user_id = $1', [userId])
  const row = r.rows[0]
  const xp = row ? Number(row.xp) : 0
  return { xp, hidden: !!row?.hidden, xpFactor: row ? Number(row.xp_factor) : 1, level: levelOf(xp, cfg) }
}

/* ───────────── XP vergeben ───────────── */

export interface XpPart { reason: string; amount: number; label: string }

/**
 * Wertet einen richtigen Treffer aus: erstes Mal richtig → Eintrags-XP, dazu erreichte %-Stufen.
 * total: Anzahl spielbarer Einträge laut Browser (wird auf sinnvolle Werte begrenzt).
 */
export async function awardItem(userId: string, slug: string, key: string, total: number, multi: boolean): Promise<{ parts: XpPart[]; solved: number; total: number }> {
  const [cfg, meta, boosts, keys] = await Promise.all([loadConfig(), loadQuizMeta(), loadBoosts(), quizKeys(slug)])
  const qm = meta[slug]
  if (qm?.xp?.off) return { parts: [], solved: 0, total: keys.size }
  const serverTotal = keys.size
  const t = Math.max(1, Math.min(serverTotal, Math.max(Math.ceil(serverTotal * 0.8), Math.floor(total) || serverTotal)))

  const ins = await pool.query(
    'INSERT INTO geo_item_progress (user_id, slug, item_key) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING 1',
    [userId, slug, key],
  )
  if (!ins.rowCount) return { parts: [], solved: -1, total: t }

  const prof = await pool.query('SELECT xp_factor FROM geo_profile WHERE user_id = $1', [userId])
  const userFactor = prof.rows[0] ? Number(prof.rows[0].xp_factor) : 1
  const diff = cfg.difficulties[difficultyOf(slug, meta)]
  const factor = diff.factor * (qm?.xp?.factor ?? 1) * userFactor * boostFactor(boosts, Date.now()) * (multi ? cfg.xp.multiplayer : 1)
  const parts: XpPart[] = []

  const itemXp = Math.round((qm?.xp?.item ?? cfg.xp.item) * factor)
  if (itemXp > 0) parts.push({ reason: 'item', amount: itemXp, label: 'Erstmals richtig' })

  // %-Stufen
  const c = await pool.query('SELECT count(*)::int AS n FROM geo_item_progress WHERE user_id = $1 AND slug = $2', [userId, slug])
  const solved = c.rows[0].n as number
  const pct = (solved / t) * 100
  for (const m of cfg.xp.milestones) {
    if (pct + 1e-9 < m.pct) continue
    const amount = Math.round(m.xp * factor)
    if (amount <= 0) continue
    const r = await pool.query(
      `INSERT INTO geo_xp_log (user_id, amount, reason, slug, ref) VALUES ($1, $2, 'milestone', $3, $4) ON CONFLICT DO NOTHING RETURNING 1`,
      [userId, amount, slug, String(m.pct)],
    )
    if (r.rowCount) parts.push({ reason: 'milestone', amount, label: m.pct >= 100 ? 'Quiz komplett' : `${m.pct} % geschafft` })
  }
  if (itemXp > 0) {
    await pool.query(`INSERT INTO geo_xp_log (user_id, amount, reason, slug, ref) VALUES ($1, $2, 'item', $3, $4)`, [userId, itemXp, slug, key])
  }
  const sum = parts.reduce((s, p) => s + p.amount, 0)
  if (sum) await addXp(userId, sum)
  return { parts, solved, total: t }
}

/** Fehlerfreier Durchlauf über das ganze Quiz (einmal pro Quiz) */
export async function awardPerfect(userId: string, slug: string): Promise<XpPart[]> {
  const [cfg, meta, boosts] = await Promise.all([loadConfig(), loadQuizMeta(), loadBoosts()])
  const qm = meta[slug]
  if (qm?.xp?.off) return []
  const prof = await pool.query('SELECT xp_factor FROM geo_profile WHERE user_id = $1', [userId])
  const userFactor = prof.rows[0] ? Number(prof.rows[0].xp_factor) : 1
  const factor = cfg.difficulties[difficultyOf(slug, meta)].factor * (qm?.xp?.factor ?? 1) * userFactor * boostFactor(boosts, Date.now())
  const amount = Math.round((qm?.xp?.perfect ?? cfg.xp.perfect) * factor)
  if (amount <= 0) return []
  const r = await pool.query(
    `INSERT INTO geo_xp_log (user_id, amount, reason, slug, ref) VALUES ($1, $2, 'perfect', $3, '') ON CONFLICT DO NOTHING RETURNING 1`,
    [userId, amount, slug],
  )
  if (!r.rowCount) return []
  await addXp(userId, amount)
  return [{ reason: 'perfect', amount, label: 'Fehlerfrei durchgespielt' }]
}

export async function addXp(userId: string, amount: number) {
  await pool.query(
    `INSERT INTO geo_profile (user_id, xp) VALUES ($1, GREATEST(0, $2))
     ON CONFLICT (user_id) DO UPDATE SET xp = GREATEST(0, geo_profile.xp + $2), updated_at = now()`,
    [userId, amount],
  )
}

/* ───────────── Beliebt ───────────── */

/** Beliebteste Quizzes: zuerst die im Adminpanel festgelegten (Platz 1, 2, …), dann die meistgespielten der letzten 30 Tage */
export function loadPopular(): Promise<{ pinned: string[]; auto: string[] }> {
  return cached('popular', 60000, async () => {
    try {
      const [pin, auto] = await Promise.all([
        pool.query('SELECT slug FROM geo_quiz_meta WHERE popular IS NOT NULL ORDER BY popular ASC, slug'),
        pool.query(
          `SELECT slug, count(DISTINCT user_id)::int AS players, count(*)::int AS runs FROM geo_results
           WHERE created_at > now() - interval '30 days' AND slug NOT LIKE 'mix:%'
           GROUP BY slug ORDER BY players DESC, runs DESC LIMIT 24`,
        ),
      ])
      return { pinned: pin.rows.map(r => r.slug), auto: auto.rows.map(r => r.slug) }
    } catch {
      return { pinned: [], auto: [] }
    }
  })
}

/* ───────────── Mehrspieler ───────────── */

/** Ist der Nutzer gerade in einer laufenden Mehrspieler-Runde mit diesem Quiz? (für den XP-Bonus) */
export async function inRunningRoom(userId: string, slug: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM geo_room_players p JOIN geo_rooms r ON r.id = p.room_id
     WHERE p.user_id = $1 AND r.status = 'running' AND r.started_at > now() - interval '3 hours'
       AND (r.slug = $2 OR (r.slug LIKE 'mix:%' AND '+' || substring(r.slug FROM 5) || '+' LIKE '%+' || $2 || '+%'))
       AND (SELECT count(*) FROM geo_room_players q WHERE q.room_id = r.id) >= 2
     LIMIT 1`,
    [userId, slug],
  )
  return !!r.rowCount
}

/* ───────────── Freischalt-Plan (siehe app/geo/_lib/plan.ts) ───────────── */

export function loadPlan(): Promise<PlanConfig> {
  return cached('plan', 15000, async () => {
    try {
      const r = await pool.query(`SELECT value FROM geo_settings WHERE key = 'plan'`)
      return cleanPlan(r.rows[0]?.value)
    } catch {
      return cleanPlan(null)
    }
  })
}

export interface PlanResult { count: number; removed: number; first: string | null; last: string | null }

/**
 * Plan in die Datenbank schreiben: alle gebauten Quizzes ohne Termin bekommen einen Plan-Termin (auto = true).
 * replace = true: vorher alle zukünftigen Plan-Termine löschen und alles neu verteilen (Hand-Termine bleiben immer).
 * Sonst werden nur neue Quizzes hinten angehängt.
 */
export async function applyPlan(p: PlanConfig, replace: boolean, userId: string | null): Promise<PlanResult> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // Nur ein Plan-Lauf gleichzeitig (z.B. zwei Seitenaufrufe zur selben Sekunde)
    await client.query('LOCK TABLE geo_quiz_releases IN SHARE ROW EXCLUSIVE MODE')
    let removed = 0
    if (replace) removed = (await client.query('DELETE FROM geo_quiz_releases WHERE auto AND release_at > now()')).rowCount ?? 0
    const rel = await client.query('SELECT slug, release_at, auto FROM geo_quiz_releases')
    const has = new Set<string>(rel.rows.map((r: { slug: string }) => r.slug))
    const meta = await loadQuizMeta()
    const list = bySort(CATALOG.filter(isBuilt), e => meta[e.slug]?.sort ?? null)
    const queue = planQueue(list, p, s => has.has(s))
    const now = new Date()
    // An den letzten zukünftigen Plan-Termin anschließen
    const future = rel.rows.filter((r: { auto: boolean; release_at: Date }) => r.auto && new Date(r.release_at) > now)
      .map((r: { release_at: Date }) => new Date(r.release_at)).sort((a: Date, b: Date) => a.getTime() - b.getTime())
    const last = future.at(-1)
    const after = last ? { at: last, sameDay: future.filter((d: Date) => berlinDay(d) === berlinDay(last)).length } : null
    const slots = planSlots(p, queue.length, now, after)
    for (let i = 0; i < queue.length; i++) {
      await client.query(
        `INSERT INTO geo_quiz_releases (slug, release_at, auto, updated_at, updated_by) VALUES ($1, $2, true, now(), $3)
         ON CONFLICT (slug) DO NOTHING`,
        [queue[i].slug, slots[i].toISOString(), userId],
      )
    }
    await client.query('COMMIT')
    return { count: queue.length, removed, first: slots[0]?.toISOString() ?? null, last: slots.at(-1)?.toISOString() ?? null }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
  }
}

/** Automatik: neue Quizzes ohne Termin hinten anhängen (höchstens alle 5 Minuten, Fehler werden nur geloggt) */
export function topUpPlan(): Promise<void> {
  return cached('planTopUp', 300000, async () => {
    try {
      const p = await loadPlan()
      if (p.active) {
        const r = await applyPlan(p, false, null)
        if (r.count) { console.log(`geo/plan: ${r.count} neue Quizzes eingeplant`); memo.delete('plan') }
      }
    } catch (err) {
      console.error('geo/plan', err)
    }
  })
}