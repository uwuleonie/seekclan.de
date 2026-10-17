// Länderseiten (/geo/land/<slug>): Daten eines Landes, wie sie scripts/geo/build-laenderseiten.mjs
// nach public/geo/land/<ISO3>.json schreibt.

export interface LandDaten {
  iso: string
  slug: string
  name: string
  /** ISO2 klein, für die Flagge */
  flag: string | null
  kontinente: string[]
  hauptstadt: string
  cap: [number, number] | null
  aliases: string[]
  staatsform: string | null
  waehrung: { code: string; name: string } | null
  vorwahl: string | null
  domain: string | null
  fahrseite: 'links' | 'rechts'
  zeitzone: string | null
  sprachen: { name: string; offiziell: boolean; anteil: number | null }[]
  /** Grenzlänge in km; karte = Land hat eine eigene Seite */
  nachbarn: { iso: string; name: string; km: number; karte: boolean }[]
  staedte: { name: string; einwohner: string | null }[]
  wirtschaft: {
    /** BIP nach Sektoren in % */
    sektoren: { werte: Record<string, number>; jahr: number | null } | null
    /** BIP nach Verwendung in % (Importe negativ) */
    verwendung: { werte: Record<string, number>; jahr: number | null } | null
    wachstum: { wert: number; jahr: number | null } | null
    inflation: { wert: number; jahr: number | null } | null
    schulden: { wert: number; jahr: number | null } | null
    exporte: string[]
    exportJahr: number | null
    exportPartner: { iso: string | null; name: string; anteil: number }[]
    importe: string[]
    importPartner: { iso: string | null; name: string; anteil: number }[]
    agrar: string[]
    rohstoffe: string[]
  }
  /** GeoGuessr-Steckbrief (Europa, Südamerika, Afrika) */
  gg: { region: 'europa' | 'suedamerika' | 'afrika'; slug: string; anzahl: number } | null
  /** Datei im CIA World Factbook (github.com/factbook/factbook.json): „europe/gm“ */
  factbook: string | null
  /** Lagekarte unter /geo/land/karte/<ISO3>.svg vorhanden */
  karte: boolean
  /** Umriss des Landes allein unter /geo/land/karte/<ISO3>-form.svg (fehlt bei winzigen Ländern) */
  form: boolean
  /** Provinzen aus Natural Earth unter /geo/land/adm1/<ISO3>.json (Ersatz, wenn es kein eigenes Regionen-Quiz gibt) */
  adm1: { titel: string; anzahl: number } | null
}

/** Eine Gliederung des Landes für die Karte auf der Länderseite (Bundesländer, Provinzen, Kreise …) */
export interface Gliederung {
  titel: string
  anzahl: number
  /** Ebene als URL (public/geo/layers/<id>.json oder public/geo/land/adm1/<ISO3>.json) */
  url: string
  /** Nur diese Flächen der Ebene (null = alle) */
  ids: string[] | null
  /** Namen je Fläche (bei Natural Earth stehen sie in der Datei) */
  namen: Record<string, string>
  /** Quiz dazu */
  quiz: string | null
  quelle: 'atlas' | 'natural-earth'
}

export const KONTINENT_NAME: Record<string, string> = {
  europa: 'Europa', asien: 'Asien', afrika: 'Afrika', nordamerika: 'Nordamerika', suedamerika: 'Südamerika', ozeanien: 'Ozeanien',
}

/** Link zur Länderseite */
export const landHref = (slug: string) => `/geo/land/${slug}`
