// GeoGuessr-Modus von seekclan.de/geo
//
// Ist der Schalter an, zeigt der Atlas nur Quizzes, die in GeoGuessr (GG) helfen. Welche das sind:
//  1. Festlegung im Adminpanel (Reiter „GeoGuessr“, geo_settings key 'gg' → quizzes)
//  2. Festlegung im Code (QuizDef.gg)
//  3. GeoGuessr-Quizzes (slug „gg-…“ oder Abschnitt „GeoGuessr …“) und Sprachen & Schriften → ja
//  4. Quizzes zu einem Land (QuizDef.country): ja, wenn das Land Street-View-Abdeckung in GG hat
//  5. alles andere → nein
//
// GG-Edition-Quizzes (QuizDef.ggQuelle) nehmen die Einträge eines anderen Quiz und behalten nur Länder mit Abdeckung –
// mit der Länderliste aus dem Adminpanel. So passen sie sich an, wenn Google neue Länder bringt.

import type { CatalogEntry, GeoItem, QuizDef } from './types'

/**
 * Länder mit offizieller GeoGuessr-Abdeckung (ISO3, wie in Natural Earth).
 * Quelle: geometas.com/learn/geoguessr_country_coverage (Stand Oktober 2026), dazu Namibia (Street View seit Juni 2025)
 * und die kleinen Gebiete Gibraltar, Jersey, San Marino. Im Adminpanel änderbar.
 */
export const GG_STANDARD: string[] = [
  // Westeuropa
  'AND', 'AUT', 'BEL', 'FRA', 'DEU', 'GRC', 'IRL', 'IMN', 'ITA', 'LUX', 'MLT', 'MCO', 'NLD', 'PRT', 'ESP', 'CHE', 'GBR', 'GIB', 'JEY', 'SMR',
  // Osteuropa
  'ALB', 'BGR', 'HRV', 'CZE', 'HUN', 'MNE', 'MKD', 'POL', 'ROU', 'RUS', 'SRB', 'SVK', 'SVN', 'UKR',
  // Nordeuropa und Baltikum
  'DNK', 'FRO', 'FIN', 'GRL', 'ISL', 'NOR', 'SWE', 'EST', 'LVA', 'LTU',
  // Lateinamerika
  'ARG', 'BOL', 'BRA', 'CHL', 'COL', 'CRI', 'CUW', 'DOM', 'ECU', 'GTM', 'MEX', 'PAN', 'PER', 'PRI', 'VIR', 'URY',
  // Nordamerika
  'BMU', 'CAN', 'USA',
  // Süd- und Südostasien
  'BGD', 'BTN', 'KHM', 'CXR', 'IND', 'IDN', 'LAO', 'MYS', 'PAK', 'PHL', 'SGP', 'LKA', 'THA', 'VNM',
  // übriges Asien
  'CHN', 'HKG', 'JPN', 'KAZ', 'KGZ', 'MNG', 'KOR', 'TWN',
  // Ozeanien
  'ASM', 'AUS', 'GUM', 'NZL', 'MNP', 'UMI',
  // Afrika
  'BWA', 'SWZ', 'GHA', 'KEN', 'LSO', 'MDG', 'NAM', 'NGA', 'REU', 'RWA', 'SEN', 'ZAF', 'UGA',
  // Naher Osten
  'ISR', 'JOR', 'PSX', 'QAT', 'TUN', 'TUR', 'ARE',
]

/** Linksverkehr (ISO3) – für „Linksverkehr oder Rechtsverkehr? (GG Edition)“ */
export const LINKSVERKEHR: string[] = [
  'GBR', 'IRL', 'IMN', 'JEY', 'GGY', 'MLT', 'CYP', 'AUS', 'NZL', 'JPN', 'IND', 'BGD', 'BTN', 'LKA', 'PAK', 'NPL', 'MYS', 'SGP', 'IDN', 'THA',
  'HKG', 'MAC', 'BRN', 'TLS', 'PNG', 'FJI', 'SLB', 'TON', 'WSM', 'KIR', 'TUV', 'NRU', 'CXR', 'MDV', 'KEN', 'UGA', 'TZA', 'ZAF', 'BWA', 'LSO',
  'SWZ', 'NAM', 'ZMB', 'ZWE', 'MOZ', 'MWI', 'MUS', 'SYC', 'GUY', 'SUR', 'JAM', 'BHS', 'BRB', 'TTO', 'VIR', 'VGB', 'BMU', 'CYM', 'TCA', 'AIA',
  'ATG', 'DMA', 'GRD', 'KNA', 'LCA', 'VCT', 'MSR', 'FLK', 'SHN',
]

export type GgArt = 'ja' | 'nein'

/** Einstellungen aus dem Adminpanel (geo_settings key 'gg') */
export interface GgSettings {
  /** Länder mit Abdeckung (ISO3) */
  laender: string[]
  /** Festlegung einzelner Quizzes (überschreibt alles andere) */
  quizzes: Record<string, GgArt>
}

export const GG_DEFAULT: GgSettings = { laender: GG_STANDARD, quizzes: {} }

export function mergeGg(saved: unknown): GgSettings {
  const s = (saved && typeof saved === 'object' ? saved : {}) as Partial<GgSettings>
  const laender = Array.isArray(s.laender) ? [...new Set(s.laender.map(String).filter(x => /^[A-Z]{3}$/.test(x)))] : GG_STANDARD
  const quizzes: Record<string, GgArt> = {}
  if (s.quizzes && typeof s.quizzes === 'object') {
    for (const [k, v] of Object.entries(s.quizzes)) if (v === 'ja' || v === 'nein') quizzes[k] = v
  }
  return { laender, quizzes }
}

/** Gehört ein Quiz in den GeoGuessr-Modus? */
export function ggArt(e: CatalogEntry, s: GgSettings): GgArt {
  const fest = s.quizzes[e.slug]
  if (fest) return fest
  if (e.gg) return e.gg
  if (e.slug.startsWith('gg-') || (e.section ?? '').startsWith('GeoGuessr')) return 'ja'
  if (e.bereich === 'sprachen') return 'ja'
  if (e.country) return s.laender.includes(e.country) ? 'ja' : 'nein'
  return 'nein'
}

/** Länder (ISO3) eines Eintrags: Feld iso, sonst Flächen der Weltkarte („world:DEU“), sonst Schlüssel („flagge:DEU“) */
export function itemIsos(it: GeoItem): string[] {
  if (it.iso) return [it.iso]
  const fromAreas = (it.areas ?? []).map(a => /^world:([A-Z]{3})$/.exec(a)?.[1]).filter((x): x is string => !!x)
  if (fromAreas.length) return fromAreas
  const k = /:([A-Z]{3})$/.exec(it.key)?.[1]
  return k ? [k] : []
}

/**
 * Einträge einer GG-Edition: nur Länder mit Abdeckung (filter) und/oder neue Gruppen ja/nein (teile).
 * Ohne erkennbares Land fliegt ein Eintrag beim Filtern raus.
 */
export function ggEintraege(items: GeoItem[], q: NonNullable<QuizDef['ggQuelle']>, laender: string[]): GeoItem[] {
  const set = new Set(laender)
  let out = q.filter ? items.filter(it => itemIsos(it).some(i => set.has(i))) : items
  if (q.teile) {
    const t = q.teile
    const liste = new Set(t.liste ?? laender)
    out = out.map(it => {
      const ja = itemIsos(it).some(i => liste.has(i))
      return { ...it, group: ja ? 'ja' : 'nein' }
    })
  }
  return out
}

/* ───────────── Länderliste im Browser (für das Nachladen der Einträge) ───────────── */

let liste: string[] = GG_STANDARD
export const setGgListe = (l: string[]) => { liste = l }
export const ggListe = () => liste