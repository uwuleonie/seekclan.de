// Higher Lower (seekclan.de/geo/higher-lower) – gemeinsam für Browser und Server:
// Einstellungen (Standardwerte, im Geo-Adminpanel änderbar), Streak-Multiplikator, Wett-Quote, Zahlen-Format.
//
// Die Werte hier sind nur STANDARDWERTE. Änderungen aus dem Adminpanel liegen in geo_settings (Schlüssel "hl").

import type { HlKategorie, HlRegion } from '../_data/hl'

export type HlArt = 'klassisch' | 'leben' | 'sprint' | 'tag'
export type HlStufe = 'leicht' | 'mittel' | 'schwer'
export const HL_ARTEN: { key: HlArt; name: string; text: string }[] = [
  { key: 'klassisch', name: 'Klassisch', text: 'Ein Fehler und die Runde ist vorbei. Wie weit kommst du?' },
  { key: 'leben', name: '3 Leben', text: 'Fehler kosten ein Leben und eine Bonus-Stufe – die Runde läuft weiter.' },
  { key: 'sprint', name: 'Sprint', text: 'Gegen die Uhr: so viele richtige wie möglich. Ein Fehler kostet Zeit.' },
  { key: 'tag', name: 'Tagesrunde', text: 'Jeden Tag dieselben Paare für alle. Nur ein Versuch, eigene Rangliste.' },
]
export const HL_STUFEN: { key: HlStufe; name: string; text: string }[] = [
  { key: 'leicht', name: 'Leicht', text: 'Bekannte Länder, Werte weit auseinander' },
  { key: 'mittel', name: 'Mittel', text: 'Alle Länder, wird mit der Serie enger' },
  { key: 'schwer', name: 'Schwer', text: 'Alle Länder, von Anfang an knapp' },
]
export const HL_ART_NAME = Object.fromEntries(HL_ARTEN.map(a => [a.key, a.name])) as Record<HlArt, string>
export const HL_STUFE_NAME = Object.fromEntries(HL_STUFEN.map(a => [a.key, a.name])) as Record<HlStufe, string>
/** Kategorie „Mix“: jede Frage eine andere Kategorie */
export const MIX = 'mix'

/* ───────────── Einstellungen ───────────── */

export interface HlWettConfig {
  /** Wetten überhaupt erlaubt */
  an: boolean
  /** Anteil, der im Schnitt zurückfließt (0,85 = auf lange Sicht gehen 15 % der Einsätze verloren) */
  rueckgabe: number
  /** Höchste Quote (Einsatz × Quote = Auszahlung) */
  maxQuote: number
  /** Kleinstes und größtes Ziel (richtige in Folge) */
  minZiel: number
  maxZiel: number
  /** Höchster Einsatz pro Runde */
  maxEinsatz: number
  /** Sekunden pro Antwort, solange eine Wette läuft (0 = kein Limit) */
  zeit: number
  /** Start-Trefferquote je Stufe, solange es noch zu wenige gespielte Antworten gibt */
  startP: Record<HlStufe, number>
  /** Ab so vielen gespielten Antworten zählt nur noch die echte Trefferquote (davor gemischt) */
  minAntworten: number
}

export interface HlMehrConfig {
  /** Duell und Team erlaubt */
  an: boolean
  /** Höchstens so viele Spieler im Duell / im Team */
  maxDuell: number
  maxTeam: number
  /** Im Duell Sternis in einen Topf setzen (Sieger bekommt alles) */
  topf: boolean
  /** Höchster Einsatz pro Spieler im Duell */
  maxEinsatz: number
}

export interface HlConfig {
  /** Spiel für alle sichtbar (aus = nur Admins) */
  aktiv: boolean
  /** Freischaltung für alle (ISO-Zeitpunkt). Vorher sehen normale Nutzer nur einen Countdown, Admins können schon spielen. null = sofort */
  freigabe: string | null
  /** Punkte pro richtiger Antwort (× Multiplikator) */
  grund: number
  /** Streak-Multiplikator: ab dieser Serie dieser Faktor */
  stufen: { ab: number; faktor: number }[]
  /** Punkte ÷ xpTeiler = XP, Punkte ÷ sterniTeiler = Sternis (abgerundet) */
  xpTeiler: number
  sterniTeiler: number
  /** Neuer persönlicher Rekord (ab rekordMin richtigen) */
  rekordBonus: number
  rekordMin: number
  /** Höchstens so viele Sternis pro Tag aus Higher Lower (0 = keine Grenze; Wett-Gewinne zählen nicht mit) */
  tagesLimit: number
  /** Tagesrunde: Sternis für Platz 1, 2, 3 (am nächsten Tag) */
  tagBonus: number[]
  leben: number
  sprintSek: number
  sprintStrafe: number
  arten: Record<HlArt, boolean>
  wetten: HlWettConfig
  /** Mehrspieler: Duell (gegeneinander) und Team (miteinander) */
  mehrspieler: HlMehrConfig
  /** Pro Kategorie: aus, Wetten aus, eigene Höchstquote */
  kategorien: Record<string, { aus?: boolean; wettenAus?: boolean; maxQuote?: number }>
}

export const HL_DEFAULT: HlConfig = {
  aktiv: true,
  // 06.11.2026, 00:00 Uhr deutscher Zeit
  freigabe: '2026-11-05T23:00:00.000Z',
  grund: 10,
  stufen: [
    { ab: 0, faktor: 1 }, { ab: 5, faktor: 1.5 }, { ab: 10, faktor: 2 },
    { ab: 15, faktor: 3 }, { ab: 25, faktor: 4 }, { ab: 40, faktor: 5 },
  ],
  xpTeiler: 10,
  sterniTeiler: 50,
  rekordBonus: 10,
  rekordMin: 5,
  tagesLimit: 0,
  tagBonus: [30, 20, 10],
  leben: 3,
  sprintSek: 60,
  sprintStrafe: 3,
  arten: { klassisch: true, leben: true, sprint: true, tag: true },
  wetten: {
    an: true, rueckgabe: 0.85, maxQuote: 50, minZiel: 5, maxZiel: 50, maxEinsatz: 1000, zeit: 15,
    startP: { leicht: 0.88, mittel: 0.82, schwer: 0.76 }, minAntworten: 300,
  },
  mehrspieler: { an: true, maxDuell: 8, maxTeam: 4, topf: true, maxEinsatz: 500 },
  kategorien: {},
}

const num = (v: unknown, d: number, min: number, max: number) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : d
}

/** Gespeicherte Einstellungen über die Standardwerte legen und auf sinnvolle Grenzen bringen */
export function mergeHlConfig(raw: unknown): HlConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<HlConfig>
  const d = HL_DEFAULT
  const w = (r.wetten ?? {}) as Partial<HlWettConfig>
  const stufen = Array.isArray(r.stufen) && r.stufen.length
    ? r.stufen.map(s => ({ ab: Math.round(num(s?.ab, 0, 0, 1000)), faktor: num(s?.faktor, 1, 0, 100) })).sort((a, b) => a.ab - b.ab)
    : d.stufen
  if (stufen[0].ab !== 0) stufen.unshift({ ab: 0, faktor: 1 })
  const kategorien: HlConfig['kategorien'] = {}
  if (r.kategorien && typeof r.kategorien === 'object') {
    for (const [k, v] of Object.entries(r.kategorien)) {
      if (!/^[a-z0-9-]{2,40}$/.test(k) || !v || typeof v !== 'object') continue
      const o: { aus?: boolean; wettenAus?: boolean; maxQuote?: number } = {}
      if (v.aus) o.aus = true
      if (v.wettenAus) o.wettenAus = true
      if (v.maxQuote != null && Number(v.maxQuote) > 0) o.maxQuote = num(v.maxQuote, 50, 1, 100000)
      if (Object.keys(o).length) kategorien[k] = o
    }
  }
  const sp = (w.startP ?? {}) as Partial<Record<HlStufe, number>>
  const m = (r.mehrspieler ?? {}) as Partial<HlMehrConfig>
  return {
    aktiv: r.aktiv === undefined ? d.aktiv : !!r.aktiv,
    freigabe: r.freigabe === undefined ? d.freigabe : r.freigabe === null || r.freigabe === '' ? null
      : isNaN(Date.parse(String(r.freigabe))) ? d.freigabe : new Date(String(r.freigabe)).toISOString(),
    grund: Math.round(num(r.grund, d.grund, 0, 10000)),
    stufen,
    xpTeiler: num(r.xpTeiler, d.xpTeiler, 1, 100000),
    sterniTeiler: num(r.sterniTeiler, d.sterniTeiler, 1, 100000),
    rekordBonus: Math.round(num(r.rekordBonus, d.rekordBonus, 0, 100000)),
    rekordMin: Math.round(num(r.rekordMin, d.rekordMin, 1, 1000)),
    tagesLimit: Math.round(num(r.tagesLimit, d.tagesLimit, 0, 1e7)),
    tagBonus: [0, 1, 2].map(i => Math.round(num(r.tagBonus?.[i], d.tagBonus[i], 0, 1e6))),
    leben: Math.round(num(r.leben, d.leben, 1, 20)),
    sprintSek: Math.round(num(r.sprintSek, d.sprintSek, 10, 600)),
    sprintStrafe: Math.round(num(r.sprintStrafe, d.sprintStrafe, 0, 60)),
    arten: {
      klassisch: r.arten?.klassisch ?? d.arten.klassisch, leben: r.arten?.leben ?? d.arten.leben,
      sprint: r.arten?.sprint ?? d.arten.sprint, tag: r.arten?.tag ?? d.arten.tag,
    },
    wetten: {
      an: w.an === undefined ? d.wetten.an : !!w.an,
      rueckgabe: num(w.rueckgabe, d.wetten.rueckgabe, 0.1, 1.5),
      maxQuote: num(w.maxQuote, d.wetten.maxQuote, 1, 100000),
      minZiel: Math.round(num(w.minZiel, d.wetten.minZiel, 1, 500)),
      maxZiel: Math.round(num(w.maxZiel, d.wetten.maxZiel, 1, 500)),
      maxEinsatz: Math.round(num(w.maxEinsatz, d.wetten.maxEinsatz, 1, 1e7)),
      zeit: Math.round(num(w.zeit, d.wetten.zeit, 0, 300)),
      startP: {
        leicht: num(sp.leicht, d.wetten.startP.leicht, 0.3, 0.99),
        mittel: num(sp.mittel, d.wetten.startP.mittel, 0.3, 0.99),
        schwer: num(sp.schwer, d.wetten.startP.schwer, 0.3, 0.99),
      },
      minAntworten: Math.round(num(w.minAntworten, d.wetten.minAntworten, 0, 1e6)),
    },
    mehrspieler: {
      an: m.an === undefined ? d.mehrspieler.an : !!m.an,
      maxDuell: Math.round(num(m.maxDuell, d.mehrspieler.maxDuell, 2, 20)),
      maxTeam: Math.round(num(m.maxTeam, d.mehrspieler.maxTeam, 2, 10)),
      topf: m.topf === undefined ? d.mehrspieler.topf : !!m.topf,
      maxEinsatz: Math.round(num(m.maxEinsatz, d.mehrspieler.maxEinsatz, 1, 1e7)),
    },
    kategorien,
  }
}

/** Noch gesperrt (Freischaltung in der Zukunft)? Gibt den Zeitpunkt in ms zurück, sonst null */
export function hlGesperrtBis(cfg: Pick<HlConfig, 'freigabe'>, jetzt = Date.now()): number | null {
  const t = cfg.freigabe ? Date.parse(cfg.freigabe) : NaN
  return Number.isFinite(t) && t > jetzt ? t : null
}

/* ───────────── Multiplikator ───────────── */

/** Multiplikator bei dieser Serie (Anzahl richtige in Folge, die aktuelle Antwort schon mitgezählt) */
export function multiplikator(serie: number, cfg: HlConfig): number {
  let f = 1
  for (const s of cfg.stufen) if (serie >= s.ab) f = s.faktor
  return f
}
/** Index der Stufe (0 = erste) */
export function stufenIndex(serie: number, cfg: HlConfig): number {
  let i = 0
  cfg.stufen.forEach((s, k) => { if (serie >= s.ab) i = k })
  return i
}
/** Nächste Stufe (oder null, wenn schon ganz oben) */
export function naechsteStufe(serie: number, cfg: HlConfig) {
  return cfg.stufen.find(s => s.ab > serie) ?? null
}

/* ───────────── Wett-Quote ─────────────
 * Quote = Rückgabe ÷ Trefferquote^Ziel. Leichte Kombinationen (hohe Trefferquote) geben kleine Quoten,
 * schwere große – nach oben begrenzt durch die Höchstquote (gesamt oder pro Kategorie).
 */
export function quoteFuer(p: number, ziel: number, rueckgabe: number, maxQuote: number): number {
  const q = rueckgabe / Math.pow(Math.min(0.995, Math.max(0.05, p)), ziel)
  return Math.min(maxQuote, Math.floor(q * 100) / 100)
}

/* ───────────── Zahlen ───────────── */

const de = (v: number, dez: number) => v.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: dez })

/** Wert einer Kategorie lesbar (z. B. „84,1 Mio“, „52.745 US$“, „1,2 Bio. US$“) */
export function fmtWert(v: number, k: Pick<HlKategorie, 'fmt' | 'dez' | 'einheit'>): string {
  const gross = (x: number) => {
    const a = Math.abs(x)
    if (a >= 1e12) return `${de(x / 1e12, 2)} Bio.`
    if (a >= 1e9) return `${de(x / 1e9, a >= 1e11 ? 0 : 1)} Mrd.`
    if (a >= 1e6) return `${de(x / 1e6, a >= 1e8 ? 0 : 1)} Mio.`
    return de(x, 0)
  }
  switch (k.fmt) {
    case 'gross': return k.einheit ? `${gross(v)} ${k.einheit}` : gross(v)
    case 'usd-gross': return `${gross(v)} US$`
    case 'usd': return `${de(v, k.dez)} US$`
    default: return k.einheit ? `${de(v, k.dez)}${k.einheit === '%' ? ' %' : ' ' + k.einheit}` : de(v, k.dez)
  }
}

export const HL_REGION_NAME: Record<HlRegion, string> = { welt: 'Welt', europa: 'Europa', suedamerika: 'Südamerika' }