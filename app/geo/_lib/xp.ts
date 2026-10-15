// XP, Level, Schwierigkeiten und Einstellungen von seekclan.de/geo – gemeinsam für Browser und Server.
//
// Alle Werte hier sind nur die STANDARDWERTE. Im Geo-Adminpanel (/geo/admin) lässt sich alles ändern;
// die Änderungen liegen in der Datenbank (geo_settings, Schlüssel "config") und überschreiben diese Werte.

import type { CatalogEntry, Kind } from './types'

/* ───────────── Schwierigkeiten ───────────── */

export type Difficulty = 'leicht' | 'mittel' | 'schwer' | 'sehr-schwer' | 'experte'
export const DIFFICULTIES: Difficulty[] = ['leicht', 'mittel', 'schwer', 'sehr-schwer', 'experte']

/* ───────────── Spielarten (für Rechte pro Quiz/Rolle) ───────────── */

export const MODE_KEYS = ['learn', 'click', 'name', 'type', 'text', 'mixed', 'sprint', 'leben'] as const
export type ModeKey = (typeof MODE_KEYS)[number]
export const MODE_LABEL: Record<ModeKey, string> = {
  learn: 'Lernen', click: 'Auf Karte finden', name: 'Namen zuordnen', type: 'Eintippen', text: 'Wissensfrage',
  mixed: 'Gemischt', sprint: 'Sprint', leben: '3 Leben',
}
/** Wer darf eine Spielart nutzen: alle, nur Eingeloggte, niemand, oder bestimmte Clan-Rollen */
export type ModeRule = 'all' | 'login' | 'none' | string[]

/* ───────────── Clan-Rollen (wie im Clansystem) ───────────── */

export const CLAN_ROLES: { key: string; label: string }[] = [
  { key: 'gast', label: 'Gast' },
  { key: 'clanmitglied', label: 'Clanmitglied' },
  { key: 'clanmoderator', label: 'Clanmoderator' },
  { key: 'teammitglied', label: 'Teammitglied' },
  { key: 'vip', label: 'VIP' },
  { key: 'administrator', label: 'Administrator' },
  { key: 'owner', label: 'Owner' },
]

/* ───────────── Einstellungen ───────────── */

export interface GeoConfig {
  xp: {
    /** XP für einen Ort/eine Frage, die man zum ersten Mal richtig hat (× Schwierigkeit) */
    item: number
    /** Bonus, wenn man x % aller Einträge eines Quiz einmal richtig hatte (× Schwierigkeit) */
    milestones: { pct: number; xp: number }[]
    /** Fehlerfreier Durchlauf über das ganze Quiz (einmal pro Quiz, × Schwierigkeit) */
    perfect: number
    /** Mehrspieler: Faktor auf alle XP */
    multiplayer: number
  }
  difficulties: Record<Difficulty, { label: string; factor: number; color: string }>
  /** XP bis zum nächsten Level = base · growth^(Level − 1) */
  level: { base: number; growth: number }
  /** Standard-Rechte der Spielarten (pro Quiz änderbar) */
  modes: Partial<Record<ModeKey, ModeRule>>
  /** Ton bei "+XP" */
  sound: boolean
  /** Ranglisten anzeigen */
  leaderboards: boolean
  /** Geo-Sternis: Währung zum Freikaufen von Quizzes */
  sternis: SterniConfig
}

export interface SterniConfig {
  /** Sternis für Level 2 */
  levelStart: number
  /** Jedes weitere Level gibt so viel mal mehr (1.04 = 4 % mehr als das Level davor) */
  levelGrowth: number
  /** Erstes Mal ein Quiz fertig gespielt (einmal pro Quiz) */
  first: Record<Difficulty, number>
  /** Jedes weitere fertige Durchspielen */
  repeat: Record<Difficulty, number>
  /** Preis zum Freikaufen eines Quiz */
  price: Record<Difficulty, number>
  /** Mindestabstand in Minuten zwischen zwei Wiederholungs-Belohnungen für dasselbe Quiz */
  repeatPause: number
  /** Höchstens so viele Sternis pro Tag aus Wiederholungen (0 = keine Grenze) */
  repeatDailyMax: number
}

export const DEFAULT_CONFIG: GeoConfig = {
  xp: {
    item: 5,
    milestones: [
      { pct: 25, xp: 10 },
      { pct: 50, xp: 20 },
      { pct: 75, xp: 35 },
      { pct: 100, xp: 75 },
    ],
    perfect: 40,
    multiplayer: 1.25,
  },
  difficulties: {
    leicht: { label: 'Leicht', factor: 1, color: '#7cc48f' },
    mittel: { label: 'Mittel', factor: 1.5, color: '#d8c36a' },
    schwer: { label: 'Schwer', factor: 2, color: '#e3a35a' },
    'sehr-schwer': { label: 'Sehr schwer', factor: 3, color: '#e27a5f' },
    experte: { label: 'Experte', factor: 4, color: '#c46aa8' },
  },
  level: { base: 100, growth: 1.15 },
  modes: {},
  sound: true,
  leaderboards: true,
  sternis: {
    levelStart: 10,
    levelGrowth: 1.04,
    first: { leicht: 2, mittel: 4, schwer: 6, 'sehr-schwer': 8, experte: 10 },
    repeat: { leicht: 1, mittel: 2, schwer: 2, 'sehr-schwer': 3, experte: 4 },
    price: { leicht: 50, mittel: 120, schwer: 250, 'sehr-schwer': 500, experte: 1000 },
    repeatPause: 5,
    repeatDailyMax: 100,
  },
}

/** Gespeicherte Einstellungen über die Standardwerte legen (fehlende Werte bleiben Standard) */
export function mergeConfig(saved: unknown): GeoConfig {
  const s = (saved && typeof saved === 'object' ? saved : {}) as Partial<GeoConfig>
  const d = DEFAULT_CONFIG
  const diffs = { ...d.difficulties }
  for (const k of DIFFICULTIES) if (s.difficulties?.[k]) diffs[k] = { ...d.difficulties[k], ...s.difficulties[k] }
  return {
    xp: { ...d.xp, ...(s.xp ?? {}), milestones: Array.isArray(s.xp?.milestones) ? s.xp!.milestones : d.xp.milestones },
    difficulties: diffs,
    level: { ...d.level, ...(s.level ?? {}) },
    modes: { ...d.modes, ...(s.modes ?? {}) },
    sound: s.sound ?? d.sound,
    leaderboards: s.leaderboards ?? d.leaderboards,
    sternis: {
      ...d.sternis,
      ...(s.sternis ?? {}),
      first: { ...d.sternis.first, ...(s.sternis?.first ?? {}) },
      repeat: { ...d.sternis.repeat, ...(s.sternis?.repeat ?? {}) },
      price: { ...d.sternis.price, ...(s.sternis?.price ?? {}) },
    },
  }
}

/* ───────────── Level ───────────── */

/** XP, die man von Level n zu Level n+1 braucht */
export const xpForLevel = (level: number, cfg: GeoConfig) => Math.max(1, Math.round(cfg.level.base * cfg.level.growth ** (level - 1)))

export interface LevelInfo {
  level: number
  /** XP innerhalb des aktuellen Levels */
  into: number
  /** XP, die dieses Level insgesamt braucht */
  need: number
  /** Noch fehlende XP bis zum nächsten Level */
  left: number
  pct: number
}

export function levelOf(xp: number, cfg: GeoConfig): LevelInfo {
  let level = 1
  let rest = Math.max(0, Math.floor(xp))
  for (;;) {
    const need = xpForLevel(level, cfg)
    if (rest < need || level >= 999) return { level, into: rest, need, left: need - rest, pct: (rest / need) * 100 }
    rest -= need
    level++
  }
}

/** Gesamt-XP, die man für ein Level braucht (für die Tabelle im Adminpanel) */
export function totalXpFor(level: number, cfg: GeoConfig): number {
  let s = 0
  for (let l = 1; l < level; l++) s += xpForLevel(l, cfg)
  return s
}

/* ───────────── Geo-Sternis ───────────── */

/** Sternis, die man beim Erreichen von Level n bekommt (ab Level 2) */
export const sternisForLevel = (level: number, cfg: GeoConfig) =>
  level < 2 ? 0 : Math.max(0, Math.round(cfg.sternis.levelStart * cfg.sternis.levelGrowth ** (level - 2)))

/** Sternis für alle Level von (from + 1) bis to zusammen */
export function sternisBetween(from: number, to: number, cfg: GeoConfig): number {
  let s = 0
  for (let l = Math.max(2, from + 1); l <= Math.min(to, 999); l++) s += sternisForLevel(l, cfg)
  return s
}

/* ───────────── Standard-Schwierigkeit eines Quiz ───────────── */

// Aufwendige Themen eine Stufe schwerer, sehr einfache eine leichter
const HARDER: Kind[] = ['stadtteile', 'strassen', 'bahn', 'historisch', 'postleitzahlen', 'flughaefen', 'haefen', 'vorwahlen', 'kennzeichen', 'domains']
const EASIER: Kind[] = ['kontinente', 'meere']

/** Feste Stufen für einzelne Quizzes (z.B. Russlands Städte in 4 Stufen) */
const FIXED: Record<string, Difficulty> = {
  'ru-staedte-einfach': 'leicht',
  'ru-staedte-mittel': 'mittel',
  'ru-staedte-schwer': 'schwer',
  'ru-staedte-sehr-schwer': 'sehr-schwer',
  'de-wahlkreise': 'experte',
}

/** Schwierigkeit aus Thema und Anzahl der Einträge – im Adminpanel pro Quiz überschreibbar */
export function defaultDifficulty(e: CatalogEntry, count: number): Difficulty {
  if (FIXED[e.slug]) return FIXED[e.slug]
  if (!e.planned && e.difficulty) return e.difficulty
  let i = count <= 15 ? 0 : count <= 40 ? 1 : count <= 100 ? 2 : count <= 250 ? 3 : 4
  if (HARDER.includes(e.kind)) i++
  if (EASIER.includes(e.kind)) i--
  return DIFFICULTIES[Math.max(0, Math.min(4, i))]
}

/* ───────────── Rechte ───────────── */

/** Darf diese Rolle (null = nicht eingeloggt) etwas mit dieser Regel? */
export function ruleAllows(rule: ModeRule | undefined, role: string | null, loggedIn: boolean): boolean {
  if (!rule || rule === 'all') return true
  if (rule === 'none') return false
  if (rule === 'login') return loggedIn
  return !!role && rule.includes(role)
}

/** Öffentlicher Stand eines XP-Boosts */
export interface BoostInfo { id: number; label: string; factor: number; startsAt: string; endsAt: string }

/** Aktiver Boost-Faktor (mehrere gleichzeitig → multipliziert) */
export function boostFactor(boosts: BoostInfo[], now: number): number {
  return boosts
    .filter(b => Date.parse(b.startsAt) <= now && Date.parse(b.endsAt) > now)
    .reduce((f, b) => f * b.factor, 1)
}