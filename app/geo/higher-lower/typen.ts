// Higher Lower: Daten, wie sie vom Server (/api/geo/hl) kommen

import type { HlRegion } from '../_data/hl'
import type { HlArt, HlStufe } from '../_lib/hl'

export interface Karte { id: string; name: string; flag: string | null; wert?: number; text?: string; jahr?: number | null; zusatz?: string }

export interface Runde {
  id: string; region: HlRegion; kategorie: string; art: HlArt; stufe: HlStufe; status: 'laeuft' | 'beendet'
  kat: string
  links: Karte; rechts: Karte
  richtige: number; fehler: number; serie: number; besteSerie: number; punkte: number
  multi: number; stufe_i: number
  leben: number | null; einsatz: number; ziel: number | null; quote: number | null; wette: 'offen' | 'gewonnen' | 'verloren' | null
  zeit: { bis: number } | null
  sprintEnde: number | null
  jetzt: number
  /** Anzahl beantworteter Paare */
  schritt: number
  /** Mehrspieler-Raum oder null */
  raum: string | null
  xp: number | null; sternis: number | null
}

export interface Gewinn { reason: string; amount: number; label: string; kind?: 'sterni' }
export interface Belohnung { xp: Gewinn[]; sternis: Gewinn[]; rekord: boolean; vorher: number }

export interface Aufloesung {
  richtig: boolean
  grund?: 'zeit' | 'sprint-ende'
  rechts: Karte
  punkte: number
  multi: number
  stufeHoch: boolean
  wette?: { status: 'gewonnen' | 'verloren'; betrag: number }
  ende?: Belohnung
}

export interface HlInfo {
  aus?: boolean
  /** Noch nicht freigeschaltet (nur bei normalen Nutzern gesetzt, dann fehlt der Rest) */
  gesperrt?: string
  config: {
    aktiv: boolean; freigabe: string | null; gesperrtBis: string | null; grund: number; stufen: { ab: number; faktor: number }[]; xpTeiler: number; sterniTeiler: number
    rekordBonus: number; rekordMin: number; leben: number; sprintSek: number; sprintStrafe: number
    arten: Record<HlArt, boolean>; tagBonus: number[]
    wetten: { an: boolean; minZiel: number; maxZiel: number; maxEinsatz: number; zeit: number; maxQuote: number }
    wettenAus: string[]
    mehrspieler: { an: boolean; maxDuell: number; maxTeam: number; topf: boolean; maxEinsatz: number }
  }
  kategorien: Record<HlRegion, string[]>
  admin: boolean
  eingeloggt: boolean
  name?: string
  sternis?: number
  rekorde?: Record<string, number>
  laufend?: Runde | null
  tagesrunde?: { richtige: number; punkte: number; laeuft: boolean } | null
}

/** Ende einer Runde für den Ergebnis-Bildschirm */
export interface Ergebnis { runde: Runde; letzte: Aufloesung | null; belohnung: Belohnung | null; gewinnWette: number }

/* ───────────── Mehrspieler ───────────── */

export interface RaumSpieler {
  id: string; name: string; me: boolean; online: boolean; verlassen: boolean
  status: 'wartet' | 'team' | 'zuschauer' | 'spielt' | 'fertig'
  richtige: number; serie: number; punkte: number; leben: number | null; bezahlt: number; gewinn: number
}
export interface RaumZustand {
  raum: {
    id: string; modus: 'duell' | 'team'; region: HlRegion; kategorie: string; art: HlArt; stufe: HlStufe
    einsatz: number; status: 'lobby' | 'laeuft' | 'fertig'; hostId: string; hostName: string; topf: number
    ergebnis: { sieger?: string[]; topf?: number; jeder?: number; richtige?: number; punkte?: number; xp?: number; sternis?: number } | null
    letzte: { nr: number; von: string; aufl: Aufloesung } | null
    vorschlaege: { name: string; wahl: 'hoeher' | 'niedriger'; me: boolean }[]
    amZug: string | null; amZugName: string | null; katName: string
  }
  spieler: RaumSpieler[]
  meineRunde: Runde | null
  ichDrin: boolean
  isHost: boolean
  mehr: { an: boolean; maxDuell: number; maxTeam: number; topf: boolean; maxEinsatz: number }
}