// Clan-Historie – Typen, Sätze und Auswertung (ohne Datenbank, auch im Browser nutzbar).
//
// Ein Eintrag = ein Ereignis: jemand ist beigetreten, hat verlassen, wurde geworfen/entfernt, befördert oder degradiert.
// Gespeichert in der Tabelle clan_historie (siehe app/lib/clan-historie.ts).
//   quelle: gomme (Clan-Verlauf aus dem Spiel) · discord (alte Discord-Liste, nur Tag bekannt) · website (von Hand eingetragen)
//           · automatisch (Rang auf der Website/im Spiel geändert)

export const ARTEN = ['beigetreten', 'verlassen', 'geworfen', 'entfernt', 'befoerdert', 'degradiert', 'sonstiges'] as const
export type Art = (typeof ARTEN)[number]

export const ART_NAME: Record<Art, string> = {
  beigetreten: 'Beigetreten', verlassen: 'Verlassen', geworfen: 'Geworfen', entfernt: 'Entfernt',
  befoerdert: 'Befördert', degradiert: 'Degradiert', sonstiges: 'Sonstiges',
}
export const ART_FARBE: Record<Art, string> = {
  beigetreten: '#34d399', verlassen: '#94a3b8', geworfen: '#f87171', entfernt: '#fb923c',
  befoerdert: '#a78bfa', degradiert: '#fbbf24', sonstiges: '#60a5fa',
}
/** Ränge, die im Clan-Verlauf vorkommen (frei eintippbar, das hier sind Vorschläge) */
export const RANG_VORSCHLAEGE = ['Clan-Testmitglied', 'Clan-Mitglied', 'Clan-Moderator', 'Clan-Administrator']

export interface Eintrag {
  id: number
  /** ISO-Zeitpunkt */
  zeit: string
  /** false = nur der Tag ist bekannt (alte Discord-Liste) */
  genau: boolean
  art: Art
  spieler: string
  von: string | null
  rang: string | null
  notiz: string | null
  quelle: string
  /** Originaltext aus dem Import */
  original: string | null
}

/** Satz zum Eintrag, z. B. „Niffino wurde von uwuleonie zum Clan-Moderator befördert“ */
export function satz(e: Pick<Eintrag, 'art' | 'spieler' | 'von' | 'rang' | 'notiz'>): string {
  const von = e.von ? ` von ${e.von}` : ''
  switch (e.art) {
    case 'beigetreten': return e.von ? `${e.spieler} wurde von ${e.von} in den Clan aufgenommen` : `${e.spieler} ist dem Clan beigetreten`
    case 'verlassen': return `${e.spieler} hat den Clan verlassen`
    case 'geworfen': return `${e.spieler} wurde${von} aus dem Clan geworfen`
    case 'entfernt': return `${e.spieler} wurde${von} aus dem Clan entfernt`
    case 'befoerdert': return `${e.spieler} wurde${von} ${e.rang ? `zum ${e.rang} ` : ''}befördert`
    case 'degradiert': return `${e.spieler} wurde${von} ${e.rang ? `zum ${e.rang} ` : ''}degradiert`
    default: return e.notiz ? `${e.spieler}: ${e.notiz}` : e.spieler
  }
}

export const zeitText = (e: Pick<Eintrag, 'zeit' | 'genau'>) =>
  e.genau
    ? new Date(e.zeit).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })
    : new Date(e.zeit).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' })

/* ───────────── Auswertung: Mitgliedschaften einer Person ───────────── */

export interface Zeitraum {
  /** Beitritt (null = vor Beginn der Aufzeichnungen) */
  von: string | null
  vonGenau: boolean
  /** Austritt (null = noch drin) */
  bis: string | null
  bisGenau: boolean
  /** Wie es endete */
  wie: 'verlassen' | 'geworfen' | 'entfernt' | null
  durch: string | null
}

export interface Verlauf {
  /** drin = laut Verlauf im Clan, raus = ausgetreten, unbekannt = keine Mitgliedschaft erkennbar */
  status: 'drin' | 'raus' | 'unbekannt'
  zeitraeume: Zeitraum[]
  /** Beitritt der aktuellen (letzten) Mitgliedschaft, wenn bekannt */
  beitritt: string | null
  /** Höchster Rang, der je im Verlauf vorkam */
  hoechsterRang: string | null
}

const RANG_STUFE = (r: string | null) => {
  const t = (r ?? '').toLowerCase()
  return t.includes('admin') ? 4 : t.includes('mod') ? 3 : t.includes('test') ? 1 : t ? 2 : 0
}
/** Wer innerhalb dieser Zeit wieder eintritt, war durchgehend Mitglied (z. B. kurz raus für einen Rangwechsel) */
const KURZ_RAUS_MS = 24 * 3600 * 1000

/**
 * Mitgliedschaften aus den Einträgen EINER Person (beliebige Reihenfolge).
 * Regeln: Beitritt startet eine Mitgliedschaft; Verlassen/Geworfen/Entfernt beendet sie; wer weniger als 24 Stunden
 * raus war, gilt als durchgehend dabei. Ein Rangwechsel ohne vorherigen Beitritt heißt: war schon vor Beginn der
 * Aufzeichnungen drin (Beitritt unbekannt).
 */
export function verlauf(eintraege: Pick<Eintrag, 'zeit' | 'genau' | 'art' | 'rang' | 'von'>[]): Verlauf {
  const es = [...eintraege].sort((a, b) => +new Date(a.zeit) - +new Date(b.zeit))
  const zr: Zeitraum[] = []
  let offen: Zeitraum | null = null
  let offenSeit = 0
  let hoechster: string | null = null
  for (const e of es) {
    if ((e.art === 'befoerdert' || e.art === 'degradiert') && RANG_STUFE(e.rang) > RANG_STUFE(hoechster)) hoechster = e.rang
    if (e.art === 'verlassen' || e.art === 'geworfen' || e.art === 'entfernt') {
      if (!offen) offen = { von: null, vonGenau: false, bis: null, bisGenau: false, wie: null, durch: null }
      offen.bis = e.zeit; offen.bisGenau = e.genau; offen.wie = e.art; offen.durch = e.von
      zr.push(offen); offen = null
      continue
    }
    const eintritt = e.art === 'beigetreten' || (e.art === 'befoerdert' && !offen && zr.length > 0 && RANG_STUFE(e.rang) <= 2)
    if (!offen) {
      const letzter = zr[zr.length - 1]
      if (eintritt && letzter?.bis && +new Date(e.zeit) - +new Date(letzter.bis) < KURZ_RAUS_MS) {
        // Kurz raus und wieder rein → Mitgliedschaft geht weiter
        zr.pop(); offen = { ...letzter, bis: null, bisGenau: false, wie: null, durch: null }
      } else if (eintritt) {
        offen = { von: e.zeit, vonGenau: e.genau, bis: null, bisGenau: false, wie: null, durch: null }
      } else if (e.art !== 'sonstiges') {
        offen = { von: null, vonGenau: false, bis: null, bisGenau: false, wie: null, durch: null }
        offenSeit = +new Date(e.zeit)
      }
    } else if (e.art === 'beigetreten' && !offen.von && !zr.length && +new Date(e.zeit) - offenSeit < KURZ_RAUS_MS) {
      // Rangwechsel stand im Verlauf vor dem Beitritt (gleiche Minute) → Beitritt nachtragen
      offen.von = e.zeit; offen.vonGenau = e.genau
    }
  }
  if (offen) zr.push(offen)
  const letzter = zr[zr.length - 1]
  return {
    status: !letzter ? 'unbekannt' : letzter.bis ? 'raus' : 'drin',
    zeitraeume: zr,
    beitritt: letzter && !letzter.bis ? letzter.von : null,
    hoechsterRang: hoechster,
  }
}

/** Tage im Clan (nur Zeiträume mit bekanntem Beginn; offene bis heute) */
export function tageImClan(v: Verlauf): number {
  let ms = 0
  for (const z of v.zeitraeume) if (z.von) ms += +new Date(z.bis ?? Date.now()) - +new Date(z.von)
  return Math.max(0, Math.round(ms / 86_400_000))
}
