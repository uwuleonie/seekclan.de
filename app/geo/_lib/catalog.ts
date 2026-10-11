// Alle Quizzes von seekclan.de/geo an einer Stelle.
// Neue Quizzes: in eine Datei unter app/geo/_content/ schreiben und hier eintragen.
// Freigeschaltet wird im Admin-Panel unter /admin2/geo (Tabelle geo_quiz_releases).

import { DACH_QUIZZES } from '../_content/dach'
import { GEOGUESSR_QUIZZES } from '../_content/geoguessr'
import { GEPLANT } from '../_content/geplant'
import { BEREICH_BY_KEY, COUNTRY_BY_ID, WELT_QUIZZES } from '../_content/welt'
import { WELT_EXTRA_QUIZZES } from '../_content/welt-extra'
import { HISTORISCH_QUIZZES } from '../_content/historisch'
import { LAENDER_QUIZZES } from '../_content/laender'
import { EUROPA_QUIZZES } from '../_content/europa'
import { EUROPA_EXTRA_QUIZZES } from '../_content/europa-extra'
import { SPRACHEN_QUIZZES } from '../_content/sprachen'
import { GG_QUIZZES } from '../_content/gg-europa'
import type { Bereich, CatalogEntry, QuizDef, QuizStatus } from './types'
import { itemCount } from './items'
import { DEFAULT_CONFIG, MODE_KEYS, defaultDifficulty, ruleAllows, type BoostInfo, type Difficulty, type GeoConfig, type ModeKey, type ModeRule } from './xp'

const BUILT: QuizDef[] = [...WELT_QUIZZES, ...WELT_EXTRA_QUIZZES, ...HISTORISCH_QUIZZES, ...LAENDER_QUIZZES, ...EUROPA_QUIZZES, ...EUROPA_EXTRA_QUIZZES, ...DACH_QUIZZES, ...GEOGUESSR_QUIZZES, ...SPRACHEN_QUIZZES, ...GG_QUIZZES]
const builtSlugs = new Set(BUILT.map(q => q.slug))

/** Gebaute + geplante Quizzes (geplante, die inzwischen gebaut sind, fallen automatisch weg) */
export const CATALOG: CatalogEntry[] = [...BUILT, ...GEPLANT.filter(p => !builtSlugs.has(p.slug))]
export const CATALOG_BY_SLUG: Record<string, CatalogEntry> = Object.fromEntries(CATALOG.map(e => [e.slug, e]))

export function isBuilt(e: CatalogEntry | undefined): e is QuizDef {
  return !!e && !e.planned
}

/** Land-Name (deutsch) zu einem ISO3-Code */
export function countryName(id: string | undefined): string {
  if (!id) return ''
  return COUNTRY_BY_ID[id]?.name ?? id
}

/** Erscheint ein Quiz auf der Seite dieses Bereichs? (Länder auf mehreren Kontinenten erscheinen überall) */
export function belongsTo(e: CatalogEntry, b: Bereich): boolean {
  if (e.bereich === b) return true
  if (b === 'welt' || !e.country) return false
  return COUNTRY_BY_ID[e.country]?.continents.includes(b) ?? false
}

export const bereichName = (b: Bereich) => BEREICH_BY_KEY[b]?.name ?? b

export const KIND_LABEL: Record<CatalogEntry['kind'], string> = {
  laender: 'Länder', hauptstaedte: 'Hauptstädte', regionen: 'Regionen', staedte: 'Städte', fluesse: 'Flüsse',
  berge: 'Gebirge', flaggen: 'Flaggen', historisch: 'Historisch', bahn: 'Bahn', wissen: 'Wissen',
  sprachen: 'Sprachen', vorwahlen: 'Vorwahlen', kennzeichen: 'Kennzeichen',
  kontinente: 'Kontinente', meere: 'Meere', seen: 'Seen', wuesten: 'Wüsten', gebiete: 'Gebiete', flughaefen: 'Flughäfen',
  domains: 'Domains', rekorde: 'Rekorde',
  stadtteile: 'Stadtteile', strassen: 'Straßen', haefen: 'Häfen', postleitzahlen: 'Postleitzahlen',
}

/* ───────────── Freischalt-Status und Überschreibungen aus dem Adminpanel ───────────── */

/** Überschreibungen eines Quiz (Tabelle geo_quiz_meta) – leere Felder = Standard aus dem Code */
export interface QuizMeta {
  slug: string
  title: string | null
  meta: string | null
  description: string | null
  difficulty: Difficulty | null
  sort: number | null
  visibility: 'all' | 'roles' | 'admins'
  roles: string[]
  modes: Partial<Record<ModeKey, ModeRule>>
  xp: { item?: number; factor?: number; perfect?: number; off?: boolean }
  popular: number | null
}

/** Überschreibungen für Bereiche, Abschnitte und Länder (Tabelle geo_group_meta) */
export interface GroupMeta {
  kind: 'bereich' | 'section' | 'country'
  /** bereich: "europa" · section: "europa/Natur" · country: "DEU" */
  key: string
  title: string | null
  description: string | null
  sort: number | null
  release_at: string | null
  visibility: 'all' | 'roles' | 'admins'
  roles: string[]
}

export interface CatalogState {
  /** slug → Zeitpunkt der Freischaltung (ISO) */
  releases: Record<string, string>
  /** Admin (administrator/owner) – sieht alles, außer im Vorschau-Modus */
  admin: boolean
  preview: boolean
  /** Serverzeit beim Laden (ms) */
  now: number
  role: string | null
  loggedIn: boolean
  meta: Record<string, QuizMeta>
  groups: GroupMeta[]
  boosts: BoostInfo[]
  config: GeoConfig
}

const NEW_DAYS = 14

/** Schlüssel eines Abschnitts (z.B. "Natur" auf der Europa-Seite) */
export const sectionKey = (e: CatalogEntry) => `${e.bereich}/${e.section ?? ''}`

/** Die Gruppen (Bereich, Abschnitt, Land), zu denen ein Quiz gehört */
export function groupsOf(e: CatalogEntry, s: CatalogState): GroupMeta[] {
  return s.groups.filter(g =>
    (g.kind === 'bereich' && g.key === e.bereich) ||
    (g.kind === 'section' && !!e.section && g.key === sectionKey(e)) ||
    (g.kind === 'country' && !!e.country && g.key === e.country))
}

const visibleFor = (v: { visibility: string; roles: string[] } | undefined, role: string | null) =>
  !v || v.visibility === 'all' || (v.visibility === 'roles' && !!role && v.roles.includes(role))

/** Werkzeuge statt Inhalte: immer offen, brauchen keinen Freischalt-Termin (z.B. die Merkliste „Meine Wörter“) */
export const ALWAYS_OPEN = new Set(['meine-woerter'])

export function statusOf(e: CatalogEntry, s: CatalogState): QuizStatus {
  const staff = s.admin && !s.preview
  const groups = groupsOf(e, s)
  // Sichtbarkeit: Quiz und alle seine Gruppen müssen sichtbar sein
  const hidden = !visibleFor(s.meta[e.slug], s.role) || groups.some(g => !visibleFor(g, s.role))
  // Freischaltung: das Quiz UND seine Gruppen (falls dort ein Zeitpunkt steht) – es gilt der späteste
  let at: string | null = s.releases[e.slug] ?? null
  if (at) for (const g of groups) if (g.release_at && g.release_at > at) at = g.release_at
  const releasedAt = at ? new Date(at).getTime() : null
  const always = ALWAYS_OPEN.has(e.slug)
  if (always) at = null
  const released = !e.planned && !hidden && (always || (releasedAt !== null && releasedAt <= s.now))
  const open = !e.planned && (released || staff)
  return {
    open,
    released,
    releaseAt: at,
    planned: !!e.planned,
    isNew: released && !always && releasedAt !== null && s.now - releasedAt < NEW_DAYS * 86400_000,
    hidden: hidden && !staff,
    adminOnly: hidden,
  }
}

/** Quiz mit den Texten aus dem Adminpanel */
export function decorate(e: CatalogEntry, s: CatalogState): CatalogEntry {
  const m = s.meta[e.slug]
  if (!m || (!m.title && !m.meta && !m.description)) return e
  return { ...e, title: m.title ?? e.title, meta: m.meta ?? e.meta, text: m.description ?? e.text } as CatalogEntry
}

/** Schwierigkeit eines Quiz (Adminpanel, sonst Standard aus Thema + Anzahl) */
export function difficultyOfEntry(e: CatalogEntry, s: CatalogState): Difficulty {
  return s.meta[e.slug]?.difficulty ?? defaultDifficulty(e, isBuilt(e) ? itemCount(e) : 0)
}

/** Erlaubte Spielarten eines Quiz für den aktuellen Besucher */
export function modesOf(e: CatalogEntry | undefined, s: CatalogState): Record<ModeKey, boolean> {
  const staff = s.admin && !s.preview
  const out = {} as Record<ModeKey, boolean>
  for (const k of MODE_KEYS) {
    const rule = (e && s.meta[e.slug]?.modes?.[k]) ?? s.config.modes[k] ?? 'all'
    out[k] = staff || ruleAllows(rule, s.role, s.loggedIn)
  }
  return out
}

/** Sortierwert (Adminpanel); ohne Wert bleibt die Reihenfolge aus dem Code */
export const sortOf = (e: CatalogEntry, s: CatalogState) => s.meta[e.slug]?.sort ?? null
export const groupSort = (kind: GroupMeta['kind'], key: string, s: CatalogState) => s.groups.find(g => g.kind === kind && g.key === key)?.sort ?? null
export const groupTitle = (kind: GroupMeta['kind'], key: string, s: CatalogState) => s.groups.find(g => g.kind === kind && g.key === key)?.title ?? null

/** Stabil sortieren: zuerst nach Sortierwert (falls gesetzt), sonst ursprüngliche Reihenfolge */
export function bySort<T>(list: T[], value: (x: T) => number | null): T[] {
  return list
    .map((x, i) => ({ x, i, v: value(x) }))
    .sort((a, b) => (a.v ?? 1e9 + a.i) - (b.v ?? 1e9 + b.i) || a.i - b.i)
    .map(o => o.x)
}

export const EMPTY_STATE: CatalogState = {
  releases: {}, admin: false, preview: false, now: Date.now(), role: null, loggedIn: false,
  meta: {}, groups: [], boosts: [], config: DEFAULT_CONFIG,
}