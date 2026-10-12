import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin, csrfError } from '@/app/lib/csrf'
import { canReadGeoAdmin, getGeoUser, isGeoAdmin } from '@/app/lib/geo-server'
import { applyPlan, clearGeoCache, loadConfig, loadPlan } from '@/app/lib/geo-data'
import { cleanPlan } from '@/app/geo/_lib/plan'
import { CATALOG_BY_SLUG } from '@/app/geo/_lib/catalog'
import { CLAN_ROLES, DIFFICULTIES, MODE_KEYS, mergeConfig } from '@/app/geo/_lib/xp'

// Geo-Adminpanel (/geo/admin): lesen = Team, ändern = Administrator/Owner
//
// GET  /api/geo/admin → { config, quizMeta, groupMeta, releases, autoReleases, plan, boosts, stats }
// POST /api/geo/admin  Body: { action, ... }
//   config      { config }                                   Einstellungen (XP, Schwierigkeiten, Level, Spielarten, Geo-Sternis) speichern
//   quiz        { slugs, patch?, release? }                  Quizzes ändern (mehrere auf einmal); Feld = null → zurück auf Standard
//   quizReset   { slugs }                                     alle Änderungen an diesen Quizzes verwerfen
//   group       { kind, key, patch?, release? }               Bereich / Abschnitt / Land ändern
//   order       { kind, keys }                                Reihenfolge speichern (kind: quiz | bereich | section | country)
//   boost       { label, factor, startsAt, endsAt }           XP-Boost anlegen (sofort oder geplant)
//   boostEnd    { id }                                        laufenden Boost jetzt beenden
//   boostDelete { id }                                        Boost löschen
//   plan        { plan, apply? }                              Freischalt-Plan speichern; apply = alle Plan-Termine neu verteilen
//   planClear   {}                                            alle zukünftigen Plan-Termine entfernen (Hand-Termine bleiben)
// release: { at: ISO-Zeitpunkt } = freischalten (sofort/geplant), { at: null } = sperren

const ROLE_KEYS = CLAN_ROLES.map(r => r.key)
const VIS = ['all', 'roles', 'admins']
const GROUP_KINDS = ['bereich', 'section', 'country']
const str = (v: unknown, max: number) => (v === null ? null : typeof v === 'string' ? v.trim().slice(0, max) || null : undefined)
const intOrNull = (v: unknown) => (v === null ? null : Number.isInteger(v) ? (v as number) : undefined)
const roles = (v: unknown) => (Array.isArray(v) ? [...new Set(v.map(String))].filter(r => ROLE_KEYS.includes(r)) : undefined)

function cleanModes(v: unknown): Record<string, unknown> | undefined {
  if (v === null) return {}
  if (!v || typeof v !== 'object') return undefined
  const out: Record<string, unknown> = {}
  for (const k of MODE_KEYS) {
    const r = (v as Record<string, unknown>)[k]
    if (r === 'all' || r === 'login' || r === 'none') out[k] = r
    else if (Array.isArray(r)) out[k] = r.map(String).filter(x => ROLE_KEYS.includes(x))
  }
  return out
}
function cleanXp(v: unknown): Record<string, unknown> | undefined {
  if (v === null) return {}
  if (!v || typeof v !== 'object') return undefined
  const o = v as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const k of ['item', 'perfect']) if (typeof o[k] === 'number' && o[k] as number >= 0 && (o[k] as number) <= 10000) out[k] = o[k]
  if (typeof o.factor === 'number' && o.factor > 0 && o.factor <= 50) out.factor = o.factor
  if (o.off === true) out.off = true
  return out
}

export async function GET(req: NextRequest) {
  const user = await getGeoUser(req).catch(() => null)
  if (!canReadGeoAdmin(user)) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  try {
    const [config, plan, raw, qm, gm, rel, boosts, stats, top] = await Promise.all([
      loadConfig(),
      loadPlan(),
      pool.query(`SELECT value, updated_at FROM geo_settings WHERE key = 'config'`),
      pool.query('SELECT * FROM geo_quiz_meta'),
      pool.query('SELECT * FROM geo_group_meta'),
      pool.query('SELECT slug, release_at, auto FROM geo_quiz_releases'),
      pool.query(`SELECT b.*, u.username AS created_by_name FROM geo_boosts b LEFT JOIN users u ON u.id = b.created_by ORDER BY starts_at DESC LIMIT 200`),
      pool.query(`SELECT (SELECT count(*)::int FROM geo_profile WHERE xp > 0) AS players,
                         (SELECT COALESCE(sum(xp), 0)::bigint FROM geo_profile) AS xp,
                         (SELECT COALESCE(sum(amount), 0)::bigint FROM geo_xp_log WHERE created_at > now() - interval '24 hours') AS xp_day,
                         (SELECT count(*)::int FROM geo_results WHERE created_at > now() - interval '24 hours') AS runs_day`),
      pool.query(`SELECT slug, count(*)::int AS n FROM geo_results WHERE created_at > now() - interval '30 days' GROUP BY slug ORDER BY n DESC LIMIT 30`),
    ])
    return NextResponse.json({
      canWrite: isGeoAdmin(user),
      config,
      configSavedAt: raw.rows[0]?.updated_at ?? null,
      quizMeta: Object.fromEntries(qm.rows.map(r => [r.slug, r])),
      groupMeta: gm.rows,
      releases: Object.fromEntries(rel.rows.map(r => [r.slug, new Date(r.release_at).toISOString()])),
      autoReleases: rel.rows.filter(r => r.auto).map(r => r.slug),
      plan,
      boosts: boosts.rows.map(b => ({ ...b, factor: Number(b.factor) })),
      stats: { ...stats.rows[0], xp: Number(stats.rows[0].xp), xp_day: Number(stats.rows[0].xp_day) },
      played: top.rows,
      now: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: unknown) {
    console.error('geo/admin GET', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Fehler' }, { status: 500 })
  }
}

async function setRelease(slug: string, at: unknown, userId: string) {
  if (at === null) { await pool.query('DELETE FROM geo_quiz_releases WHERE slug = $1', [slug]); return }
  const d = new Date(String(at))
  if (isNaN(d.getTime())) throw new Error('Ungültiger Zeitpunkt')
  await pool.query(
    `INSERT INTO geo_quiz_releases (slug, release_at, auto, updated_at, updated_by) VALUES ($1, $2, false, now(), $3)
     ON CONFLICT (slug) DO UPDATE SET release_at = EXCLUDED.release_at, auto = false, updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [slug, d.toISOString(), userId],
  )
}

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return csrfError()
  const user = await getGeoUser(req).catch(() => null)
  if (!isGeoAdmin(user)) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const uid = user!.id

  try {
    switch (b.action) {
      case 'config': {
        // Über die Standardwerte legen – so bleibt die gespeicherte Form immer vollständig und gültig
        const cfg = mergeConfig(b.config)
        for (const d of DIFFICULTIES) cfg.difficulties[d].factor = Math.max(0, Math.min(50, Number(cfg.difficulties[d].factor) || 0))
        cfg.xp.milestones = cfg.xp.milestones
          .map(m => ({ pct: Math.max(1, Math.min(100, Math.round(Number(m.pct)))), xp: Math.max(0, Math.round(Number(m.xp) || 0)) }))
          .sort((a, c) => a.pct - c.pct)
        cfg.level.base = Math.max(1, Math.round(Number(cfg.level.base) || 100))
        cfg.level.growth = Math.max(1, Math.min(3, Number(cfg.level.growth) || 1.15))
        cfg.modes = cleanModes(cfg.modes) as typeof cfg.modes
        // Geo-Sternis: ganze Zahlen, nicht negativ
        const whole = (v: unknown, max: number) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)))
        cfg.sternis.levelStart = whole(cfg.sternis.levelStart, 100000)
        cfg.sternis.levelGrowth = Math.max(1, Math.min(2, Number(cfg.sternis.levelGrowth) || 1.04))
        for (const d of DIFFICULTIES) {
          cfg.sternis.first[d] = whole(cfg.sternis.first[d], 100000)
          cfg.sternis.repeat[d] = whole(cfg.sternis.repeat[d], 100000)
          cfg.sternis.price[d] = whole(cfg.sternis.price[d], 10_000_000)
        }
        cfg.sternis.repeatPause = whole(cfg.sternis.repeatPause, 100000)
        cfg.sternis.repeatDailyMax = whole(cfg.sternis.repeatDailyMax, 10_000_000)
        await pool.query(
          `INSERT INTO geo_settings (key, value, updated_at, updated_by) VALUES ('config', $1, now(), $2)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`,
          [JSON.stringify(cfg), uid],
        )
        break
      }
      case 'quiz': {
        const slugs: string[] = Array.isArray(b.slugs) ? [...new Set(b.slugs.map(String))].filter((s): s is string => !!CATALOG_BY_SLUG[s as string]) : []
        if (!slugs.length || slugs.length > 2000) return NextResponse.json({ error: 'Keine gültigen Quizzes' }, { status: 400 })
        const p = (b.patch ?? {}) as Record<string, unknown>
        const set: Record<string, unknown> = {}
        const v = {
          title: str(p.title, 120), meta: str(p.meta, 160), description: str(p.description, 1000),
          difficulty: p.difficulty === null ? null : DIFFICULTIES.includes(p.difficulty as never) ? p.difficulty : undefined,
          sort: intOrNull(p.sort), popular: intOrNull(p.popular),
          visibility: VIS.includes(p.visibility as string) ? p.visibility : undefined,
          roles: roles(p.roles), modes: cleanModes(p.modes), xp: cleanXp(p.xp),
        }
        for (const [k, val] of Object.entries(v)) if (val !== undefined && k in p) set[k] = k === 'modes' || k === 'xp' ? JSON.stringify(val) : val
        const cols = Object.keys(set)
        for (const slug of slugs) {
          if (cols.length) {
            const vals = cols.map(c => set[c])
            await pool.query(
              `INSERT INTO geo_quiz_meta (slug, ${cols.join(', ')}, updated_at, updated_by)
               VALUES ($1, ${cols.map((_, i) => `$${i + 2}`).join(', ')}, now(), $${cols.length + 2})
               ON CONFLICT (slug) DO UPDATE SET ${cols.map(c => `${c} = EXCLUDED.${c}`).join(', ')}, updated_at = now(), updated_by = EXCLUDED.updated_by`,
              [slug, ...vals, uid],
            )
          }
          if (b.release && 'at' in b.release) await setRelease(slug, b.release.at, uid)
        }
        break
      }
      case 'quizReset': {
        const slugs = Array.isArray(b.slugs) ? b.slugs.map(String) : []
        await pool.query('DELETE FROM geo_quiz_meta WHERE slug = ANY($1)', [slugs])
        break
      }
      case 'group': {
        const kind = String(b.kind), key = String(b.key ?? '').slice(0, 80)
        if (!GROUP_KINDS.includes(kind) || !key) return NextResponse.json({ error: 'Ungültige Gruppe' }, { status: 400 })
        const p = (b.patch ?? {}) as Record<string, unknown>
        const v: Record<string, unknown> = {
          title: str(p.title, 120), description: str(p.description, 1000), sort: intOrNull(p.sort),
          visibility: VIS.includes(p.visibility as string) ? p.visibility : undefined, roles: roles(p.roles),
        }
        if (b.release && 'at' in b.release) {
          const at = b.release.at
          v.release_at = at === null ? null : isNaN(Date.parse(String(at))) ? undefined : new Date(String(at)).toISOString()
          p.release_at = true
        }
        const cols = Object.keys(v).filter(k => v[k] !== undefined && k in p)
        if (cols.length) {
          await pool.query(
            `INSERT INTO geo_group_meta (kind, key, ${cols.join(', ')}, updated_at, updated_by)
             VALUES ($1, $2, ${cols.map((_, i) => `$${i + 3}`).join(', ')}, now(), $${cols.length + 3})
             ON CONFLICT (kind, key) DO UPDATE SET ${cols.map(c => `${c} = EXCLUDED.${c}`).join(', ')}, updated_at = now(), updated_by = EXCLUDED.updated_by`,
            [kind, key, ...cols.map(c => v[c]), uid],
          )
        }
        break
      }
      case 'order': {
        const kind = String(b.kind)
        const keys: string[] = Array.isArray(b.keys) ? b.keys.map(String).slice(0, 3000) : []
        for (let i = 0; i < keys.length; i++) {
          if (kind === 'quiz') {
            if (!CATALOG_BY_SLUG[keys[i]]) continue
            await pool.query(
              `INSERT INTO geo_quiz_meta (slug, sort, updated_at, updated_by) VALUES ($1, $2, now(), $3)
               ON CONFLICT (slug) DO UPDATE SET sort = EXCLUDED.sort, updated_at = now(), updated_by = EXCLUDED.updated_by`,
              [keys[i], (i + 1) * 10, uid],
            )
          } else if (GROUP_KINDS.includes(kind)) {
            await pool.query(
              `INSERT INTO geo_group_meta (kind, key, sort, updated_at, updated_by) VALUES ($1, $2, $3, now(), $4)
               ON CONFLICT (kind, key) DO UPDATE SET sort = EXCLUDED.sort, updated_at = now(), updated_by = EXCLUDED.updated_by`,
              [kind, keys[i].slice(0, 80), (i + 1) * 10, uid],
            )
          }
        }
        break
      }
      case 'boost': {
        const factor = Number(b.factor)
        const s = new Date(String(b.startsAt)), e = new Date(String(b.endsAt))
        if (!(factor > 0 && factor <= 20) || isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) return NextResponse.json({ error: 'Ungültiger Boost' }, { status: 400 })
        await pool.query(
          'INSERT INTO geo_boosts (label, factor, starts_at, ends_at, created_by) VALUES ($1, $2, $3, $4, $5)',
          [str(b.label, 80) || 'XP-Boost', factor, s.toISOString(), e.toISOString(), uid],
        )
        break
      }
      case 'boostEnd':
        await pool.query('UPDATE geo_boosts SET ends_at = now() WHERE id = $1 AND ends_at > now() AND starts_at < now()', [Number(b.id)])
        break
      case 'boostDelete':
        await pool.query('DELETE FROM geo_boosts WHERE id = $1', [Number(b.id)])
        break
      case 'plan': {
        const plan = cleanPlan(b.plan)
        await pool.query(
          `INSERT INTO geo_settings (key, value, updated_at, updated_by) VALUES ('plan', $1, now(), $2)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`,
          [JSON.stringify(plan), uid],
        )
        clearGeoCache()
        const result = b.apply ? await applyPlan(plan, true, uid) : null
        clearGeoCache()
        return NextResponse.json({ ok: true, result })
      }
      case 'planClear': {
        const r = await pool.query('DELETE FROM geo_quiz_releases WHERE auto AND release_at > now()')
        clearGeoCache()
        return NextResponse.json({ ok: true, result: { count: 0, removed: r.rowCount ?? 0, first: null, last: null } })
      }
      default:
        return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
    }
    clearGeoCache()
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('geo/admin POST', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Fehler' }, { status: 500 })
  }
}