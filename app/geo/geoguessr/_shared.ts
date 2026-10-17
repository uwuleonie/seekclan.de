// Gemeinsame Typen und Laden für die GeoGuessr-Seiten:
//   Europa:      /geo/geoguessr und /geo/geoguessr/<land>                  Daten: public/geo/gg/…    (scripts/geo/build-gg.mjs)
//   Südamerika:  /geo/geoguessr-suedamerika und …/<land>                   Daten: public/geo/gg-sa/… (scripts/geo/build-gg-sa.mjs)
//   Afrika:      /geo/geoguessr-afrika und …/<land>                        Daten: public/geo/gg-af/… (scripts/geo/build-gg-af.mjs)

import { GG_LAENDER } from '../_data/gg'
import { GG_SA_LAENDER } from '../_data/gg-sa'
import { GG_AF_LAENDER } from '../_data/gg-af'

export interface GgLand {
  slug: string; name: string; flag: string; gruppe: string; iso3: string | null; kurz: string; sprachen: string[]
  merkmale: Record<string, string | null>
  anzahl: number; stark: number
  orts: string[]; zebra: string[]; strassen: { art: string; text: string; file: string }[]
  /** Eigene Zeichnungen (Europa: scripts/geo/gg-zeichnungen.mjs) */
  poller: GgBild[]; wegweiser: GgBild[]; linien: GgBild[]
  /** Südamerika: Bilder je Galerie-Art (Kennzeichen, Taxis, Masten …) */
  galerie?: Record<string, GgBild[]>
  /** Südamerika: Bild auf der Länder-Kachel */
  titelbild?: string | null
}
export interface GgBild { file: string; titel: string }
/** src: p = Plonk It, s = älterer GeoGuessr-Guide, a = allgemein bekannt (Vorwahl, Domain) */
export interface GgHinweis { kat: string; titel: string; text: string; staerke: 1 | 2 | 3; region?: string; compare?: string[]; src: 'p' | 's' | 'a' }
export interface GgSteckbrief extends GgLand {
  info: Record<string, string | null>
  hinweise: GgHinweis[]
}
export interface GgGalerie { key: string; label: string; quiz: string; text: string }
export interface GgIndex {
  gruppen: Record<string, string>
  kategorien: Record<string, string>
  merkmale: Record<string, { name: string; werte: string[] }>
  wertNamen: Record<string, string>
  laender: GgLand[]
  vergleiche: { thema: string; titel: string; text: string; laender: string[]; werte: Record<string, string> }[]
  sprachErkennung: { sprache: string; laender: string[]; zeichen: string[]; text: string }[]
  /** Südamerika: Merkmale fürs Ausschluss-Training und Galerien */
  trainKeys?: string[]
  galerien?: GgGalerie[]
}

/** Eine GeoGuessr-Region (Europa, Südamerika) */
export interface GgRegion {
  key: 'europa' | 'suedamerika' | 'afrika'
  /** Datenordner unter /geo */
  data: string
  /** Seite */
  path: string
  name: string
  bereich: { href: string; name: string }
  laender: [string, string, string, string][]
  hinweisQuiz: string
}
export const GG_REGIONEN: Record<GgRegion['key'], GgRegion> = {
  europa: { key: 'europa', data: '/geo/gg', path: '/geo/geoguessr', name: 'Europa', bereich: { href: '/geo/europa', name: 'Europa' }, laender: GG_LAENDER, hinweisQuiz: 'gg-hinweise' },
  suedamerika: { key: 'suedamerika', data: '/geo/gg-sa', path: '/geo/geoguessr-suedamerika', name: 'Südamerika', bereich: { href: '/geo/suedamerika', name: 'Südamerika' }, laender: GG_SA_LAENDER, hinweisQuiz: 'gg-sa-hinweise' },
  afrika: { key: 'afrika', data: '/geo/gg-af', path: '/geo/geoguessr-afrika', name: 'Afrika', bereich: { href: '/geo/afrika', name: 'Afrika' }, laender: GG_AF_LAENDER, hinweisQuiz: 'gg-af-hinweise' },
}

const indexCache: Record<string, Promise<GgIndex> | undefined> = {}
export function loadIndex(region: GgRegion = GG_REGIONEN.europa): Promise<GgIndex> {
  let p = indexCache[region.key]
  if (!p) {
    p = fetch(`${region.data}/index.json`).then(r => { if (!r.ok) throw new Error(`Daten fehlen (${r.status})`); return r.json() })
    p.catch(() => { indexCache[region.key] = undefined })
    indexCache[region.key] = p
  }
  return p
}
export async function loadLand(slug: string, region: GgRegion = GG_REGIONEN.europa): Promise<GgSteckbrief> {
  const r = await fetch(`${region.data}/laender/${slug}.json`)
  if (!r.ok) throw new Error(`Steckbrief fehlt (${r.status})`)
  return r.json()
}

/** Farbe für einen Merkmals-Wert (Chips und Tabelle) */
export const WERT_FARBE: Record<string, string> = {
  'weiß': '#ece8de', 'gelb': '#f2c230', 'blau': '#3d74d0', 'grün': '#2f9b5f', 'rot': '#d14b4b', 'schwarz': '#2a2a2a', 'gemischt': '#9a8fb5',
  'rechts': '#5b9bd5', 'links': '#e07a5f', 'ja': '#3d74d0', 'nein': '#7a7a7a', 'teils': '#9a8fb5',
  'latein': '#c9a46a', 'kyrillisch': '#d9774b', 'griechisch': '#5b9bd5', 'latein+kyrillisch': '#c98a5a', 'latein+griechisch': '#8fa3b8',
  'blau-quadrat': '#3d74d0', 'gelbes-dreieck': '#f2c230', 'blau-gelbrand': '#7fb33d', 'hoch-blau': '#2f5aa8', 'bake': '#e8962b',
  'gelb-mitte': '#f3a51c', 'weiß+gelb': '#c9c37a', 'gelb-rand': '#e8d64a',
  // Südamerika
  'spanisch': '#d9774b', 'portugiesisch': '#2f9b5f', 'englisch': '#3d74d0', 'mercosur': '#3d74d0',
  'gelb-schwarz': '#f2c230', 'schwarz-gelb': '#3a3a3a', 'weiß-rot': '#d14b4b',
  // Afrika
  'französisch': '#3d74d0', 'arabisch': '#5fb07a', 'gelb-hinten': '#c9c37a',
}
export const hellerText = (v: string) => ['weiß', 'gelb', 'gelbes-dreieck', 'gelb-mitte', 'weiß+gelb', 'gelb-rand', 'gelb-schwarz', 'gelb-hinten'].includes(v)
export const STAERKE = ['', 'Zusatzhinweis', 'Engt stark ein', 'Verrät das Land fast sicher']