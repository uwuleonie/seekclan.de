// Gemeinsame Typen und Laden für die Seiten „GeoGuessr Europa“ (/geo/geoguessr und /geo/geoguessr/<land>)
// Daten: public/geo/gg/index.json und public/geo/gg/laender/<slug>.json (erzeugt von scripts/geo/build-gg.mjs)

export interface GgLand {
  slug: string; name: string; flag: string; gruppe: string; iso3: string | null; kurz: string; sprachen: string[]
  merkmale: Record<string, string | null>
  anzahl: number; stark: number
  orts: string[]; zebra: string[]; strassen: { art: string; text: string; file: string }[]
}
export interface GgHinweis { kat: string; titel: string; text: string; staerke: 1 | 2 | 3; region?: string; compare?: string[]; src: 'p' | 's' }
export interface GgSteckbrief extends GgLand {
  info: Record<string, string | null>
  hinweise: GgHinweis[]
}
export interface GgIndex {
  gruppen: Record<string, string>
  kategorien: Record<string, string>
  merkmale: Record<string, { name: string; werte: string[] }>
  wertNamen: Record<string, string>
  laender: GgLand[]
  vergleiche: { thema: string; titel: string; text: string; laender: string[]; werte: Record<string, string> }[]
  sprachErkennung: { sprache: string; laender: string[]; zeichen: string[]; text: string }[]
}

let indexCache: Promise<GgIndex> | null = null
export function loadIndex(): Promise<GgIndex> {
  if (!indexCache) {
    indexCache = fetch('/geo/gg/index.json').then(r => { if (!r.ok) throw new Error(`Daten fehlen (${r.status})`); return r.json() })
    indexCache.catch(() => { indexCache = null })
  }
  return indexCache
}
export async function loadLand(slug: string): Promise<GgSteckbrief> {
  const r = await fetch(`/geo/gg/laender/${slug}.json`)
  if (!r.ok) throw new Error(`Steckbrief fehlt (${r.status})`)
  return r.json()
}

/** Farbe für einen Merkmals-Wert (Chips und Tabelle) */
export const WERT_FARBE: Record<string, string> = {
  'weiß': '#ece8de', 'gelb': '#f2c230', 'blau': '#3d74d0', 'grün': '#2f9b5f', 'rot': '#d14b4b', 'schwarz': '#2a2a2a', 'gemischt': '#9a8fb5',
  'rechts': '#5b9bd5', 'links': '#e07a5f', 'ja': '#3d74d0', 'nein': '#7a7a7a', 'teils': '#9a8fb5',
  'latein': '#c9a46a', 'kyrillisch': '#d9774b', 'griechisch': '#5b9bd5', 'latein+kyrillisch': '#c98a5a', 'latein+griechisch': '#8fa3b8',
  'blau-quadrat': '#3d74d0', 'gelbes-dreieck': '#f2c230', 'blau-gelbrand': '#7fb33d', 'hoch-blau': '#2f5aa8', 'bake': '#e8962b',
}
export const hellerText = (v: string) => ['weiß', 'gelb', 'gelbes-dreieck'].includes(v)
export const STAERKE = ['', 'Zusatzhinweis', 'Engt stark ein', 'Verrät das Land fast sicher']